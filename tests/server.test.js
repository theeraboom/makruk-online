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
  async connect(uid) {
    const handshake = await this.request();
    this.sid = JSON.parse(handshake.slice(1)).sid;
    await this.request('POST', '40');
    await this.next('site_stats');
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
  const client = async uid => { const c = new Client(base); clients.push(c); return c.connect(uid); };
  const create = async (c, options = {}) => { await c.emit('create_room', { gameType: 'chess', ...options }); return (await c.next('room_created')).id; };
  const join = async (c, id, password) => { await c.emit('join_room', { roomId: id, password }); return (await c.next('joined')).role; };

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
});
