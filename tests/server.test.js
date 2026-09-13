'use strict';
// Integration tests use the Socket.IO polling protocol, so no test packages are needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

class Client {
  constructor(base) { this.base = base; this.events = []; }
  async request(method = 'GET', body) {
    const url = this.base + '/socket.io/?EIO=4&transport=polling' + (this.sid ? '&sid=' + this.sid : '');
    const r = await fetch(url, { method, body, headers: body ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {}, signal: AbortSignal.timeout(6000) });
    assert.equal(r.status, 200);
    return r.text();
  }
  async connect(uid, authenticate = false) {
    const handshake = await this.request();
    this.sid = JSON.parse(handshake.slice(1)).sid;
    await this.request('POST', '40' + (authenticate ? JSON.stringify({ uid }) : ''));
    this.initialStats = await this.next('site_stats');
    await this.emit('set_uid', uid);
    return this;
  }
  async emit(event, payload) { await this.request('POST', '42' + JSON.stringify([event, payload])); }
  async next(event, predicate = () => true) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const idx = this.events.findIndex(e => e[0] === event && predicate(e[1]));
      if (idx >= 0) return this.events.splice(idx, 1)[0][1];
      const packets = (await this.request()).split('\x1e');
      for (const p of packets) {
        if (p.startsWith('42')) this.events.push(JSON.parse(p.slice(2)));
        else if (p === '2') await this.request('POST', '3');
      }
    }
    throw new Error('Timed out waiting for ' + event);
  }
  async close() { if (this.sid) { await this.request('POST', '1').catch(() => {}); this.sid = null; } }
}

test('real server gameplay and reconnect regressions', { timeout: 40000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'playmakruk-test-'));
  const clients = [];
  let server;
  t.after(async () => {
    await Promise.allSettled(clients.map(c => c.close()));
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGKILL');
      await exited;
    }
    await fs.rm(dir, { recursive: true, force: true });
  });
  for (const file of ['server.js', 'ai-bot.js']) await fs.copyFile(path.join(root, file), path.join(dir, file));
  // Fixtures exist only in this temporary, loopback-bound test server.
  await fs.appendFile(path.join(dir,'server.js'), `
    io.on('connection', socket => socket.on('test_fixture', fixture => {
      const room=rooms.get(socket.data.roomId);
      Object.assign(room,buildInitialMatchState(room.gameType,fixture.timeBase||null,fixture.timeIncrement||0),{board:fixture.board,currentPlayer:fixture.currentPlayer||'w',status:'playing'});
      delete room.drawState;Rules.ensure(room);
      if(fixture.quietPlies)room.drawState.quietPlies=fixture.quietPlies;
      startClock(room);broadcastRoomState(room.id);socket.emit('fixture_ready',true);
    }));
  `);
  await fs.symlink(path.join(root, 'public'), path.join(dir, 'public'), 'junction');
  await fs.symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
  server = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  server.stderr.on('data', chunk => { stderr += chunk; });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timeout: ' + stderr)), 6000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error('Server exited: ' + code + ' ' + stderr)));
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
    });
  });
  const client = async (uid, authenticate) => { const c = new Client(base); clients.push(c); return c.connect(uid, authenticate); };
  const create = async (c, options = {}) => { await c.emit('create_room', { gameType: 'chess', ...options }); return (await c.next('room_created')).id; };
  const join = async (c, id, password) => { await c.emit('join_room', { roomId: id, password }); return (await c.next('joined')).role; };

  await t.test('online presence counts seven tabs from one browser once and removes closed connections', async () => {
    const tabs = [];
    const stats = async () => (await fetch(base + '/health')).json();
    try {
      assert.equal((await stats()).onlineUsers, 0);
      for (let i = 0; i < 7; i++) {
        const tab = await client('presence_same_browser', i % 2 === 0);
        tabs.push(tab);
        assert.equal((await stats()).onlineUsers, 1, 'a repeated browser UID must not add a person');
        if (i % 2 === 0) assert.equal(tab.initialStats.onlineUsers, 1, 'identity is known in the first stats packet');
      }
      assert.equal((await stats()).onlineConnections, 7);
      const other = await client('presence_other_browser', true);
      tabs.push(other);
      assert.equal((await stats()).onlineUsers, 2);
      await tabs[0].next('site_stats', value => value.onlineUsers === 2);
      // Repeated identity messages and invalid IDs must not change the count.
      await tabs[0].emit('set_uid', 'presence_same_browser');
      await tabs[0].emit('set_uid', { invalid: true });
      assert.equal((await stats()).onlineUsers, 2);
      for (const tab of tabs.slice(0, 6)) await tab.close();
      assert.equal((await stats()).onlineUsers, 2, 'the last tab keeps its browser online');
      await tabs[6].close();
      assert.equal((await stats()).onlineUsers, 1);
      await other.next('site_stats', value => value.onlineUsers === 1);
      const reconnected = await client('presence_other_browser', true);
      tabs.push(reconnected);
      assert.equal((await stats()).onlineUsers, 1, 'overlapping reconnects must not double count');
      await other.close();
      assert.equal((await stats()).onlineUsers, 1);
      await reconnected.close();
      assert.equal((await stats()).onlineUsers, 0);
      // HTTP visits, preview crawlers and health monitors are not online players.
      await fetch(base + '/', { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
      assert.equal((await stats()).onlineUsers, 0);
    } finally {
      await Promise.allSettled(tabs.map(tab => tab.close()));
    }
  });

  await t.test('malformed join and move payloads do not crash the server', async () => {
    const c = await client('test_bad_payload');
    for (const value of [null, 7, 'bad', []]) {
      await c.emit('join_room', value);
      assert.equal(await c.next('error_msg'), 'ไม่พบห้องนี้');
    }
    for (const value of [null, 7, 'bad']) {
      await c.emit('move', value);
      assert.equal(await c.next('error_msg'), 'ตำแหน่งไม่ถูกต้อง');
    }
    assert.equal((await fetch(base + '/health')).status, 200);
  });
  await t.test('all five game types create and preserve setup options', async () => {
    const c = await client('test_all_games');
    for (const gameType of ['chess', 'chess-intl', 'checkers', 'checkers-intl', 'connect4']) {
      const id = await create(c, { gameType, timeBase: 5, timeIncrement: 3, userColor: 'b' });
      const player = await client('player_' + gameType);
      assert.equal(await join(player, id), 'b');
      const state = await player.next('room_state');
      assert.equal(state.gameType, gameType);
      assert.equal(state.board.length, gameType === 'connect4' ? 6 : 8);
      assert.equal(state.timeBase, 5);
      assert.equal(state.timeIncrement, 3);
      assert.equal(state.currentPlayer,gameType==='checkers-intl'?'b':'w');
    }
  });
  await t.test('private rooms reject wrong passwords and accept correct ones', async () => {
    const c = await client('test_private_room');
    const id = await create(c, { password: 'secret-123' });
    await c.emit('join_room', { roomId: id, password: 'wrong' });
    assert.equal((await c.next('password_required')).roomId, id);
    assert.equal(await join(c, id, 'secret-123'), 'w');
  });
  await t.test('lobby previews include public names but never private-room identities or socket IDs', async () => {
    const c = await client('test_lobby_metadata');
    await c.emit('set_name', 'Preview Player');
    const id = await create(c);
    await join(c, id);
    const rooms = await c.next('rooms_list', rooms => rooms.some(r => r.id === id && r.players?.w));
    const preview = rooms.find(r => r.id === id);
    assert.deepEqual(preview.players.w, { name: 'Preview Player', isBot: false, botDifficulty: null });
    assert.equal(preview.players.b, null);
    assert.equal(preview.moveCount, 0);
    const privateOwner = await client('test_hidden_metadata');
    const privateId = await create(privateOwner, { password: 'only-friends' });
    await join(privateOwner, privateId, 'only-friends');
    const privateRooms = await privateOwner.next('rooms_list', rooms => rooms.some(r => r.id === privateId));
    assert.equal(privateRooms.find(r => r.id === privateId).players, null);
  });
  await t.test('a spectator cannot move and valid moves reach both players', async () => {
    const w = await client('test_game_white');
    const b = await client('test_game_black');
    const viewer = await client('test_game_viewer');
    const id = await create(w);
    assert.equal(await join(w, id), 'w');
    assert.equal(await join(b, id), 'b');
    assert.equal(await join(viewer, id), 'viewer');
    const move = { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } };
    await viewer.emit('move', move);
    assert.equal(await viewer.next('error_msg'), 'ยังไม่ถึงตาคุณ');
    await w.emit('move', move);
    const state = await b.next('room_state', s => s.moves.length === 1);
    assert.equal(state.board[4][0], 'wP');
    assert.equal(state.board[5][0], null);
    assert.equal(state.currentPlayer, 'b');
    await b.emit('chat', 'hello table');
    assert.equal((await viewer.next('chat_message', m => m.type === 'chat')).text, 'hello table');
  });
  await t.test('reconnecting one player does not start the clock while the other is offline', async () => {
    const w = await client('test_clock_white');
    const b = await client('test_clock_black');
    const id = await create(w, { timeBase: 5 });
    await join(w, id); await join(b, id);
    await w.next('room_state', s => s.status === 'playing');
    await w.close(); await b.close();
    const reconnected = await client('test_clock_white');
    assert.equal(await join(reconnected, id), 'w');
    const paused = await reconnected.next('room_state');
    assert.equal(paused.status, 'waiting');
    assert.equal(paused.runningSince, null);
    const returnedOpponent = await client('test_clock_black');
    assert.equal(await join(returnedOpponent, id), 'b');
    const resumed = await reconnected.next('room_state', s => s.status === 'playing');
    assert.ok(resumed.runningSince);
  });
  await t.test('AI responds to a legal opening move', async () => {
    const c = await client('test_bot_white');
    const id = await create(c, { botEnabled: true, botDifficulty: 'easy' });
    await join(c, id);
    await c.emit('move', { from: { r: 5, c: 0 }, to: { r: 4, c: 0 } });
    const state = await c.next('room_state', s => s.moves.length >= 2);
    assert.equal(state.currentPlayer, 'w');
    assert.equal(state.moves.length, 2);
  });
  const blank=()=>Array.from({length:8},()=>Array(8).fill(null));
  async function fixture(gameType,board,extra={}){
    const a=await client('fixture_w_'+clients.length),b=await client('fixture_b_'+clients.length),id=await create(a,{gameType});
    await join(a,id);await join(b,id);await a.emit('test_fixture',{board,...extra});await a.next('fixture_ready');
    a.events=[];b.events=[];return{a,b,id};
  }
  await t.test('clock runs throughout a forced chain and increment is applied only once',async()=>{
    const board=blank();board[5][0]='wM';board[4][1]='bM';board[2][3]='bM';board[0][7]='bM';
    const{a}=await fixture('checkers',board,{timeBase:1,timeIncrement:2});
    await a.emit('move',{from:{r:5,c:0},to:{r:3,c:2}});const first=await a.next('room_state',s=>s.moves.length===1);
    assert.equal(first.currentPlayer,'w');assert.deepEqual(first.mustContinueFrom,{r:3,c:2});assert.ok(first.runningSince);assert.ok(first.whiteTime<=60000);
    await new Promise(r=>setTimeout(r,85));await a.emit('move',{from:{r:3,c:2},to:{r:1,c:4}});const second=await a.next('room_state',s=>s.moves.length===2);
    assert.equal(second.currentPlayer,'b');assert.equal(second.mustContinueFrom,null);assert.ok(second.whiteTime<first.whiteTime+1960);assert.ok(second.whiteTime>first.whiteTime+1800);
  });
  await t.test('Thai and English crowning ends a capture even when a new king could jump back',async()=>{
    for(const game of ['checkers','checkers-intl']){const board=blank();board[2][1]='wM';board[1][2]='bM';board[1][4]='bM';const{a}=await fixture(game,board);
      await a.emit('move',{from:{r:2,c:1},to:{r:0,c:3}});const s=await a.next('room_state',s=>s.moves.length===1);assert.equal(s.currentPlayer,'b');assert.equal(s.mustContinueFrom,null);assert.equal(s.board[0][3],'wK');}
  });
  await t.test('server accepts underpromotion and rejects invented promotion pieces',async()=>{
    const board=blank();board[7][7]='wK';board[0][7]='bK';board[1][0]='wP';board[3][5]='bR';const{a}=await fixture('chess-intl',board);
    await a.emit('move',{from:{r:1,c:0},to:{r:0,c:0},promotion:'K'});assert.match(await a.next('error_msg'),/เลื่อนขั้น/);
    await a.emit('move',{from:{r:1,c:0},to:{r:0,c:0},promotion:'N'});const s=await a.next('room_state',s=>s.moves.length===1);assert.equal(s.board[0][0],'wN');assert.equal(s.moves[0].special.promotion,'N');assert.ok(s.moves[0].notation.endsWith('=N'));
  });
  await t.test('checkmate takes precedence over the 75-move rule',async()=>{
    const board=blank();board[0][0]='bK';board[2][2]='wK';board[2][1]='wQ';const{a}=await fixture('chess-intl',board,{quietPlies:149});
    await a.emit('move',{from:{r:2,c:1},to:{r:1,c:1}});const s=await a.next('room_state',s=>s.moves.length===1);assert.equal(s.endedReason,'checkmate');assert.equal(s.endedWinner,'w');
  });
  await t.test('current and announced-move draw claims end the match correctly',async()=>{
    const board=blank();board[7][7]='wK';board[0][0]='bK';board[6][2]='wR';board[1][5]='bR';
    const one=await fixture('chess-intl',board,{quietPlies:100});await one.a.emit('draw_action',{action:'claim'});assert.equal((await one.a.next('room_state',s=>s.status==='ended')).endedReason,'fifty');
    const two=await fixture('chess-intl',board,{quietPlies:99});await two.a.emit('move',{from:{r:6,c:2},to:{r:5,c:2},claimDraw:true});const s=await two.a.next('room_state',s=>s.status==='ended');assert.equal(s.endedReason,'fifty');assert.equal(s.moves.length,0);assert.equal(s.board[6][2],'wR');
  });
  await t.test('draw offers require the other player; spectators cannot accept',async()=>{
    const{a,b,id}=await fixture('chess',require('../public/chess').initialBoard());const viewer=await client('draw_viewer');assert.equal(await join(viewer,id),'viewer');
    await a.emit('draw_action',{action:'offer'});await b.next('room_state',s=>s.draw.offer==='w');await viewer.emit('draw_action',{action:'accept'});await a.emit('draw_action',{action:'accept'});const unchanged=await a.next('room_state',s=>s.draw.offer==='w');assert.equal(unchanged.status,'playing');
    await b.emit('draw_action',{action:'accept'});const result=await a.next('room_state',s=>s.status==='ended');assert.equal(result.endedReason,'agreement');assert.equal(result.endedWinner,null);
  });
  await t.test('Thai counting can be started only by an eligible player and is broadcast',async()=>{
    const board=blank();board[7][7]='wK';board[0][0]='bK';board[1][2]='bR';const{a,b}=await fixture('chess',board);
    await b.emit('draw_action',{action:'count'});await a.emit('draw_action',{action:'count'});const s=await a.next('room_state',s=>s.draw.count?.side==='w');assert.deepEqual(s.draw.count,{side:'w',type:'pieces',limit:16,value:3});await a.emit('draw_action',{action:'stop_count'});assert.equal((await a.next('room_state',s=>!s.draw.count)).draw.count,null);
  });
  await t.test('HTML returns a persistent shell, clean room metadata and safely escaped room names',async()=>{
    const a=await client('meta_client'),id=await create(a,{name:'Room <title> & "friends"'});
    const html=await(await fetch(base+'/room.html?id='+id)).text();assert.match(html,/id="appFrame"/);assert.match(html,/Room &lt;title&gt; &amp; &quot;friends&quot;/);assert.ok(html.includes('https://playmakruk.com/room.html?id='+id));
    const imageUrl = html.match(/property="og:image" content="([^"]+)"/)[1];
    assert.equal(html.match(/name="twitter:image" content="([^"]+)"/)[1], imageUrl);
    assert.equal((await fetch(base + new URL(imageUrl).pathname)).status, 200);
    const content=await(await fetch(base+'/room.html?id='+id+'&_view=content')).text();assert.ok(!/src="radio(?:-core)?\.js/.test(content));assert.match(content,/src="\/navigation\.js\?v=[a-f0-9]{12}"/);
    const version=html.match(/name="playmakruk-build" content="([a-f0-9]{12})"/)[1];
    for(const page of [html,content]){const scripts=[...page.matchAll(/src="([^" ]+\.js[^" ]*)"/g)].map(x=>x[1]);assert.ok(scripts.length>0);assert.ok(scripts.every(url=>url.endsWith('?v='+version)));assert.ok(page.includes('radio.css?v='+version));}
  });
  await t.test('lobby fallback never nests noscript and cannot leak the old lobby under the room',async()=>{
    const html=await(await fetch(base+'/')).text();assert.equal((html.match(/<noscript\b/g)||[]).length,1);assert.equal((html.match(/<\/noscript>/g)||[]).length,1);
    const after=html.split('</noscript>')[1];assert.ok(!after.includes('<main'));assert.ok(!after.includes('YOUR NEXT MOVE'));
  });

});
