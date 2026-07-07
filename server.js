const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const Chess = require('./public/chess.js');
const Checkers = require('./public/checkers.js');
const ChessIntl = require('./public/chess-intl.js');
const CheckersIntl = require('./public/checkers-intl.js');
const Connect4 = require('./public/connect4.js');
const Bot = require('./ai-bot.js');
const ENGINES = {
  chess: Chess,
  checkers: Checkers,
  'chess-intl': ChessIntl,
  'checkers-intl': CheckersIntl,
  connect4: Connect4,
};
const ALLOWED_GAME_TYPES = ['chess', 'checkers', 'chess-intl', 'checkers-intl', 'connect4'];
const CHECKERS_TYPES = ['checkers', 'checkers-intl'];
const CHESS_TYPES = ['chess', 'chess-intl'];
const CONNECT4_TYPES = ['connect4'];
const ALLOWED_BOT_DIFFICULTIES = ['easy', 'medium', 'hard'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Resilient for mobile backgrounding + Render free-tier network
  pingInterval: 25000,    // server pings every 25s
  pingTimeout: 60000,     // wait 60s for pong before declaring disconnect (mobile-friendly)
  transports: ['websocket', 'polling'],  // allow polling fallback
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,  // 2 min — recover state if reconnect within 2 min
    skipMiddlewares: true,
  },
});

const rooms = new Map();
const ALLOWED_REACTIONS = ['👍', '👏', '🔥', '😱', '♟', '🎉', '❤️', '🤔'];
const ALLOWED_TIME_BASE = [null, 1, 3, 5, 10, 15, 30, 60, 90];
const ALLOWED_TIME_INCREMENT = [0, 2, 3, 5, 10, 15, 30];

function buildInitialMatchState(gameType, timeBase, timeIncrement) {
  const ms = timeBase ? timeBase * 60 * 1000 : null;
  const engine = ENGINES[gameType] || Chess;
  const state = {
    gameType,
    board: engine.initialBoard(),
    currentPlayer: 'w',
    moves: [],
    timeBase,
    timeIncrement: timeIncrement || 0,
    whiteTime: ms,
    blackTime: ms,
    runningSince: null,
    endedReason: null,
    endedWinner: null,
    mustContinueFrom: null,
    winCells: null,
  };
  if (gameType === 'chess-intl') {
    state.castling = { wK: true, wQ: true, bK: true, bQ: true };
    state.enPassant = null;
  }
  return state;
}

function deductTime(room) {
  if (!room.timeBase || !room.runningSince) return;
  const elapsed = Date.now() - room.runningSince;
  if (room.currentPlayer === 'w') room.whiteTime = Math.max(0, room.whiteTime - elapsed);
  else room.blackTime = Math.max(0, room.blackTime - elapsed);
  room.runningSince = null;
}

function addIncrement(room) {
  if (!room.timeBase || !room.timeIncrement) return;
  const incMs = room.timeIncrement * 1000;
  if (room.currentPlayer === 'w') room.whiteTime += incMs;
  else room.blackTime += incMs;
}

function startClock(room) {
  if (room.timeBase) room.runningSince = Date.now();
}

function endGame(room, reason, winner) {
  room.status = 'ended';
  room.endedReason = reason;
  room.endedWinner = winner;
  room.runningSince = null;
}

function processMove(room, from, to, moveInfo) {
  const engine = ENGINES[room.gameType] || Chess;

  // Connect Four uses a column-drop model (no from/to piece), handle separately.
  if (CONNECT4_TYPES.includes(room.gameType)) {
    deductTime(room);
    if (room.timeBase && (room.whiteTime <= 0 || room.blackTime <= 0)) {
      const loser = room.currentPlayer;
      endGame(room, 'timeout', loser === 'w' ? 'b' : 'w');
      pushSystemMessage(room, 'sys.timeout', { loser, winner: loser === 'w' ? 'b' : 'w' });
      return;
    }
    const col = moveInfo.col;
    const landingRow = engine.findLandingRow(room.board, col);
    if (landingRow < 0) return;
    const movingPiece = room.currentPlayer === 'w' ? 'Y' : 'R';
    room.board = engine.applyMove(room.board, col, room.currentPlayer);
    const dropTo = { r: landingRow, c: col };
    room.moves.push({
      from: dropTo, to: dropTo,
      piece: movingPiece,
      capture: false,
      promoted: false,
      notation: engine.moveNotation(movingPiece, dropTo, dropTo, false, false, { col }),
      time: Date.now(),
      special: null,
    });
    addIncrement(room);
    room.currentPlayer = room.currentPlayer === 'w' ? 'b' : 'w';
    const status = engine.gameStatus(room.board);
    if (status.ended) {
      endGame(room, status.reason, status.winner);
      room.winCells = status.winCells || null;
      pushSystemMessage(room, status.reason === 'draw' ? 'sys.draw' : 'sys.connect4', { winner: status.winner });
    } else {
      startClock(room);
    }
    return;
  }

  const piece = room.board[from.r][from.c];
  if (!piece) return;

  deductTime(room);
  if (room.timeBase && (room.whiteTime <= 0 || room.blackTime <= 0)) {
    const loser = room.currentPlayer;
    endGame(room, 'timeout', loser === 'w' ? 'b' : 'w');
    pushSystemMessage(room, 'sys.timeout', { loser, winner: loser === 'w' ? 'b' : 'w' });
    return;
  }

  const movingPiece = piece;
  let captured = false;
  let promoted = false;

  if (CHECKERS_TYPES.includes(room.gameType)) {
    const result = engine.applyMove(room.board, from.r, from.c, to.r, to.c);
    room.board = result.newBoard;
    captured = result.captured;
    promoted = result.promoted;
  } else if (room.gameType === 'chess-intl') {
    const targetBefore = room.board[to.r][to.c];
    captured = !!targetBefore || !!moveInfo.enPassant;
    room.board = engine.applyMove(room.board, from.r, from.c, to.r, to.c, moveInfo);
    promoted = (movingPiece === 'wP' && to.r === 0) || (movingPiece === 'bP' && to.r === 7);
    if (movingPiece === 'wK') { room.castling.wK = false; room.castling.wQ = false; }
    if (movingPiece === 'bK') { room.castling.bK = false; room.castling.bQ = false; }
    if (movingPiece === 'wR' && from.r === 7 && from.c === 0) room.castling.wQ = false;
    if (movingPiece === 'wR' && from.r === 7 && from.c === 7) room.castling.wK = false;
    if (movingPiece === 'bR' && from.r === 0 && from.c === 0) room.castling.bQ = false;
    if (movingPiece === 'bR' && from.r === 0 && from.c === 7) room.castling.bK = false;
    if (to.r === 7 && to.c === 0) room.castling.wQ = false;
    if (to.r === 7 && to.c === 7) room.castling.wK = false;
    if (to.r === 0 && to.c === 0) room.castling.bQ = false;
    if (to.r === 0 && to.c === 7) room.castling.bK = false;
    if (moveInfo.doublePawn) {
      const dir = movingPiece === 'wP' ? -1 : 1;
      room.enPassant = { r: from.r + dir, c: from.c };
    } else {
      room.enPassant = null;
    }
  } else {
    const targetBefore = room.board[to.r][to.c];
    captured = !!targetBefore;
    room.board = engine.applyMove(room.board, from.r, from.c, to.r, to.c);
    promoted = (movingPiece === 'wP' && to.r === 2) || (movingPiece === 'bP' && to.r === 5);
  }

  room.moves.push({
    from, to,
    piece: movingPiece,
    capture: captured,
    promoted,
    notation: engine.moveNotation(movingPiece, from, to, captured, promoted, moveInfo),
    time: Date.now(),
    special: (moveInfo && (moveInfo.castle || moveInfo.enPassant || moveInfo.doublePawn)) ? {
      castle: moveInfo.castle, enPassant: moveInfo.enPassant, doublePawn: moveInfo.doublePawn
    } : null,
  });

  let switchTurn = true;
  if (CHECKERS_TYPES.includes(room.gameType) && captured) {
    if (engine.canContinueCapture(room.board, to.r, to.c)) {
      room.mustContinueFrom = { r: to.r, c: to.c };
      switchTurn = false;
    } else {
      room.mustContinueFrom = null;
    }
  } else {
    room.mustContinueFrom = null;
  }

  if (switchTurn) {
    addIncrement(room);
    room.currentPlayer = room.currentPlayer === 'w' ? 'b' : 'w';
  }

  let status;
  if (room.gameType === 'chess-intl') {
    status = engine.gameStatus(room.board, room.currentPlayer, { castling: room.castling, enPassant: room.enPassant });
  } else {
    status = engine.gameStatus(room.board, room.currentPlayer);
  }
  if (status.ended) {
    endGame(room, status.reason, status.winner);
    let key;
    if (CHECKERS_TYPES.includes(room.gameType)) {
      key = status.reason === 'no_pieces' ? 'sys.no_pieces' : 'sys.no_moves';
    } else {
      key = status.reason === 'checkmate' ? 'sys.checkmate' : 'sys.stalemate';
    }
    pushSystemMessage(room, key, { winner: status.winner });
  } else if (switchTurn) {
    startClock(room);
    if (status.inCheck) {
      pushSystemMessage(room, 'sys.check', { player: room.currentPlayer });
    }
  }
}

function maybeBotMove(roomId, delayMs) {
  const room = rooms.get(roomId);
  if (!room || !room.bot || room.status !== 'playing') return;
  if (room.currentPlayer !== room.bot.color && !room.mustContinueFrom) return;
  if (room.mustContinueFrom && room.currentPlayer !== room.bot.color) return;
  setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r || !r.bot || r.status !== 'playing') return;
    if (r.currentPlayer !== r.bot.color) return;
    const ctx = r.gameType === 'chess-intl' ? { castling: r.castling, enPassant: r.enPassant } : null;
    const move = Bot.chooseMove(r.board, r.gameType, r.bot.color, ctx, r.mustContinueFrom, r.bot.difficulty);
    if (!move) return;
    processMove(r, move.from, move.to, move.info);
    broadcastRoomState(roomId);
    broadcastRoomList();
    if (r.mustContinueFrom && r.currentPlayer === r.bot.color) {
      maybeBotMove(roomId, 400);
    } else if (r.currentPlayer === r.bot.color && r.status === 'playing') {
      maybeBotMove(roomId, 600);
    }
  }, delayMs || 600 + Math.random() * 700);
}

const VISITS_FILE = path.join(__dirname, 'visits.json');
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const VISITS_KEY = 'playmakruk:visits';
let totalVisits = 0;
let onlineUsers = 0;

async function upstashCmd(pathSegment) {
  const res = await fetch(`${UPSTASH_URL}/${pathSegment}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return (await res.json()).result;
}

// Pipeline a single command (supports large bodies via JSON, used for SET with big values)
async function upstashExec(args) {
  const res = await fetch(`${UPSTASH_URL}/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return (await res.json()).result;
}

// ============ Room state persistence (level 2: survive server restarts) ============
const ROOM_KEY_PREFIX = 'playmakruk:room:';
const ROOM_TTL_SEC = 24 * 60 * 60; // 24h: abandoned rooms eventually expire
const RECLAIM_WINDOW_MS = 5 * 60 * 1000; // 5min after disconnect, slot can be reclaimed by name

function snapshotRoom(room) {
  // Snapshot game state, freezing the running clock so restored time is fair
  let whiteTime = room.whiteTime, blackTime = room.blackTime;
  if (room.runningSince && room.timeBase) {
    const elapsed = Date.now() - room.runningSince;
    if (room.currentPlayer === 'w') whiteTime = Math.max(0, whiteTime - elapsed);
    else blackTime = Math.max(0, blackTime - elapsed);
  }
  return {
    id: room.id,
    name: room.name,
    hasDefaultName: !!room.hasDefaultName,
    password: room.password,
    creatorColor: room.creatorColor,
    bot: room.bot,
    gameType: room.gameType,
    board: room.board,
    currentPlayer: room.currentPlayer,
    moves: room.moves,
    timeBase: room.timeBase,
    timeIncrement: room.timeIncrement,
    whiteTime,
    blackTime,
    runningSince: null, // will resume on first reconnect after restore
    endedReason: room.endedReason,
    endedWinner: room.endedWinner,
    mustContinueFrom: room.mustContinueFrom,
    castling: room.castling || null,
    enPassant: room.enPassant || null,
    winCells: room.winCells || null,
    status: room.status,
    // Players: keep names + isBot, drop socket id (will be reclaimed on reconnect)
    // disconnectedAt timestamp lets us detect stale slots within reclaim window
    players: {
      w: room.players.w ? { name: room.players.w.name, uid: room.players.w.uid || null, isBot: !!room.players.w.isBot, botDifficulty: room.players.w.botDifficulty || null, disconnectedAt: Date.now() } : null,
      b: room.players.b ? { name: room.players.b.name, uid: room.players.b.uid || null, isBot: !!room.players.b.isBot, botDifficulty: room.players.b.botDifficulty || null, disconnectedAt: Date.now() } : null,
    },
    // Keep last 50 messages so chat survives restart (cheap, useful)
    messages: (room.messages || []).slice(-50),
    // viewers Map can't serialize and they're transient anyway — drop
  };
}

const persistTimers = new Map();
function persistRoom(room) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  // Debounce: at most one write per 500ms per room (avoid spamming on rapid moves)
  if (persistTimers.has(room.id)) clearTimeout(persistTimers.get(room.id));
  const t = setTimeout(async () => {
    persistTimers.delete(room.id);
    try {
      const snap = snapshotRoom(room);
      await upstashExec(['SET', ROOM_KEY_PREFIX + room.id, JSON.stringify(snap), 'EX', ROOM_TTL_SEC]);
    } catch (e) {
      console.error('[persist] room', room.id, 'failed:', e.message);
    }
  }, 500);
  persistTimers.set(room.id, t);
}

async function persistRoomNow(room) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  if (persistTimers.has(room.id)) {
    clearTimeout(persistTimers.get(room.id));
    persistTimers.delete(room.id);
  }
  try {
    const snap = snapshotRoom(room);
    await upstashExec(['SET', ROOM_KEY_PREFIX + room.id, JSON.stringify(snap), 'EX', ROOM_TTL_SEC]);
  } catch (e) {
    console.error('[persist-sync] room', room.id, 'failed:', e.message);
  }
}

async function deletePersistedRoom(roomId) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try { await upstashExec(['DEL', ROOM_KEY_PREFIX + roomId]); } catch (e) { /* ignore */ }
}

// Room is "abandoned" when no live humans (connected or within reclaim window) remain
function isRoomAbandoned(room) {
  const now = Date.now();
  const liveHuman = (slot) => {
    const p = room.players[slot];
    if (!p || p.isBot) return false;
    if (p.id) return true;
    if (p.disconnectedAt && (now - p.disconnectedAt < RECLAIM_WINDOW_MS)) return true;
    return false;
  };
  return !liveHuman('w') && !liveHuman('b') && room.viewers.size === 0;
}

async function restoreRooms() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0;
  try {
    const keys = await upstashExec(['KEYS', ROOM_KEY_PREFIX + '*']);
    if (!Array.isArray(keys) || keys.length === 0) return 0;
    let restored = 0;
    for (const key of keys) {
      try {
        const json = await upstashExec(['GET', key]);
        if (!json) continue;
        const room = JSON.parse(json);
        // Rehydrate runtime-only fields
        room.viewers = new Map();
        // Clear socket ids on human players (will be re-set on reconnect)
        if (room.players.w && !room.players.w.isBot) room.players.w.id = null;
        if (room.players.b && !room.players.b.isBot) room.players.b.id = null;
        // Pause clock — will resume when both players reconnect
        room.runningSince = null;
        rooms.set(room.id, room);
        restored++;
      } catch (e) {
        console.error('[restore] failed key', key, e.message);
      }
    }
    return restored;
  } catch (e) {
    console.error('[restore] scan failed:', e.message);
    return 0;
  }
}

async function loadVisits() {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const v = await upstashCmd(`get/${VISITS_KEY}`);
      return v ? Number(v) : 0;
    } catch (e) {
      console.error('[Upstash] load failed, falling back to file:', e.message);
    }
  }
  try {
    return JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8')).total || 0;
  } catch (e) { return 0; }
}

let fileSaveTimer = null;
function saveVisitsToFile() {
  if (fileSaveTimer) return;
  fileSaveTimer = setTimeout(() => {
    fileSaveTimer = null;
    fs.writeFile(VISITS_FILE, JSON.stringify({ total: totalVisits }), () => {});
  }, 1500);
}

async function incrVisits() {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const v = await upstashCmd(`incr/${VISITS_KEY}`);
      return Number(v);
    } catch (e) {
      console.error('[Upstash] incr failed, falling back to file:', e.message);
    }
  }
  totalVisits++;
  saveVisitsToFile();
  return totalVisits;
}

loadVisits().then((n) => {
  totalVisits = n;
  console.log(`[Visits] starting count: ${totalVisits}${UPSTASH_URL ? ' (Upstash)' : ' (file)'}`);
  io.emit('site_stats', { totalVisits, onlineUsers });
});

restoreRooms().then((n) => {
  if (n > 0) {
    console.log(`[Restore] restored ${n} active rooms from Redis`);
    broadcastRoomList();
  } else {
    console.log(`[Restore] no rooms to restore${UPSTASH_URL ? '' : ' (Upstash not configured)'}`);
  }
});

const HTML_PATHS = ['/', '/index.html', '/room.html', '/rules.html'];
app.use((req, res, next) => {
  if (req.method !== 'GET' || !HTML_PATHS.includes(req.path)) return next();
  const cookie = req.headers.cookie || '';
  if (!cookie.includes('mkv=1')) {
    res.setHeader('Set-Cookie', 'mkv=1; Path=/; Max-Age=31536000; SameSite=Lax');
    incrVisits().then((n) => {
      totalVisits = n;
      io.emit('site_stats', { totalVisits, onlineUsers });
    }).catch(() => {});
  }
  next();
});

// Health endpoint for uptime monitors (UptimeRobot, cron-job.org, etc.)
// Hitting this every 5-10 min prevents Render free tier from sleeping.
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    rooms: rooms.size,
    onlineUsers,
    timestamp: Date.now(),
  });
});

app.use(express.static(path.join(__dirname, 'public')));

const makeRoomId = () => Math.random().toString(36).slice(2, 8);

function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    hasDefaultName: !!room.hasDefaultName,
    gameType: room.gameType,
    board: room.board,
    playerCount: (room.players.w ? 1 : 0) + (room.players.b ? 1 : 0),
    viewerCount: room.viewers.size,
    status: room.status,
    currentPlayer: room.currentPlayer,
    timeBase: room.timeBase,
    timeIncrement: room.timeIncrement,
    isPrivate: !!room.password,
    hasBot: !!room.bot,
    botDifficulty: room.bot ? room.bot.difficulty : null,
  };
}

// Throttled: full room list (incl. every board) goes to every client — on a
// busy server this fired on every move in every room. Cap at ~1 emit/750ms.
let roomListTimer = null;
let roomListDirty = false;
function broadcastRoomList() {
  if (roomListTimer) { roomListDirty = true; return; }
  io.emit('rooms_list', Array.from(rooms.values()).map(publicRoom));
  roomListTimer = setTimeout(() => {
    roomListTimer = null;
    if (roomListDirty) {
      roomListDirty = false;
      broadcastRoomList();
    }
  }, 750);
}

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room_state', {
    id: room.id,
    name: room.name,
    hasDefaultName: !!room.hasDefaultName,
    gameType: room.gameType,
    board: room.board,
    currentPlayer: room.currentPlayer,
    status: room.status,
    players: {
      w: room.players.w ? { name: room.players.w.name, isBot: !!room.players.w.isBot, botDifficulty: room.players.w.botDifficulty || null } : null,
      b: room.players.b ? { name: room.players.b.name, isBot: !!room.players.b.isBot, botDifficulty: room.players.b.botDifficulty || null } : null,
    },
    viewerCount: room.viewers.size,
    viewers: Array.from(room.viewers.values()),
    moves: room.moves,
    timeBase: room.timeBase,
    timeIncrement: room.timeIncrement,
    whiteTime: room.whiteTime,
    blackTime: room.blackTime,
    runningSince: room.runningSince,
    endedReason: room.endedReason,
    endedWinner: room.endedWinner,
    isPrivate: !!room.password,
    mustContinueFrom: room.mustContinueFrom,
    castling: room.castling || null,
    enPassant: room.enPassant || null,
    winCells: room.winCells || null,
    hasBot: !!room.bot,
    botDifficulty: room.bot ? room.bot.difficulty : null,
    botColor: room.bot ? room.bot.color : null,
  });
}

function pushSystemMessage(room, key, params) {
  const msg = { type: 'system', key, params: params || {}, time: Date.now() };
  room.messages.push(msg);
  if (room.messages.length > 200) room.messages.shift();
  io.to(room.id).emit('chat_message', msg);
}

io.on('connection', (socket) => {
  socket.data.user = { name: 'Anon-' + socket.id.slice(0, 4), uid: null };
  onlineUsers++;
  io.emit('site_stats', { totalVisits, onlineUsers });

  socket.on('set_name', (name) => {
    if (typeof name === 'string' && name.trim()) {
      socket.data.user.name = name.trim().slice(0, 24);
    }
  });

  // Persistent user ID — stable across reconnects so slot reclaim works
  // even when the user has no saved name (random Anon-XXXX changes each connect)
  socket.on('set_uid', (uid) => {
    if (typeof uid === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(uid)) {
      socket.data.user.uid = uid;
    }
  });

  socket.on('list_rooms', () => {
    socket.emit('rooms_list', Array.from(rooms.values()).map(publicRoom));
  });

  socket.on('create_room', (payload) => {
    const id = makeRoomId();
    const p = (payload && typeof payload === 'object') ? payload : { name: payload };
    const gameType = ALLOWED_GAME_TYPES.includes(p.gameType) ? p.gameType : 'chess';
    const validBase = ALLOWED_TIME_BASE.includes(p.timeBase) ? p.timeBase : null;
    const validInc = ALLOWED_TIME_INCREMENT.includes(p.timeIncrement) ? p.timeIncrement : 0;
    const password = (typeof p.password === 'string' && p.password.trim()) ? p.password.trim().slice(0, 40) : null;
    const botEnabled = !!p.botEnabled;
    const botDifficulty = ALLOWED_BOT_DIFFICULTIES.includes(p.botDifficulty) ? p.botDifficulty : 'medium';
    // creator's preferred side ('w' or 'b'); falls back to 'w' if unset
    // backward-compat: legacy clients sent botColor (= bot's side); userColor is the inverse
    let creatorColor;
    if (p.userColor === 'w' || p.userColor === 'b') creatorColor = p.userColor;
    else if (p.botColor === 'w' || p.botColor === 'b') creatorColor = p.botColor === 'w' ? 'b' : 'w';
    else creatorColor = 'w';
    const botColor = creatorColor === 'w' ? 'b' : 'w';
    const userName = (typeof p.name === 'string' && p.name.trim()) ? p.name.trim().slice(0, 40) : null;
    const room = {
      id,
      name: userName || '',
      hasDefaultName: !userName,
      password,
      creatorColor,
      players: { w: null, b: null },
      viewers: new Map(),
      messages: [],
      status: 'waiting',
      bot: botEnabled ? { difficulty: botDifficulty, color: botColor } : null,
      ...buildInitialMatchState(gameType, validBase, validInc),
    };
    if (room.bot) {
      room.players[botColor] = { id: 'BOT', name: 'Bot', isBot: true, botDifficulty };
    }
    rooms.set(id, room);
    persistRoom(room);
    socket.emit('room_created', { id });
    broadcastRoomList();
  });

  socket.on('join_room', ({ roomId, password }) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit('error_msg', 'ไม่พบห้องนี้'); return; }

    if (room.password && room.password !== password) {
      socket.emit('password_required', { roomId, name: room.name });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    // Slot reclaim: match by UID first (stable across reconnects), fall back to name
    const userName = socket.data.user.name;
    const userUid = socket.data.user.uid;
    const now = Date.now();
    const isReclaimable = (slot) => {
      const p = room.players[slot];
      if (!p || p.isBot) return false;
      // Match by UID (preferred) or name (fallback for legacy slots without uid)
      const sameUser = (userUid && p.uid) ? (p.uid === userUid) : (p.name === userName);
      if (!sameUser) return false;
      // Idempotent: already us
      if (p.id === socket.id) return true;
      // Slot has stale socket id (old socket dropped but disconnect handler not yet run, or different tab)
      // If old socket isn't in the connected set, treat as reclaimable
      if (p.id) {
        const oldSocket = io.sockets.sockets.get(p.id);
        if (!oldSocket) return true;
        return false; // someone else with same uid is actively connected (e.g. second tab)
      }
      // No active socket — reclaim if within window
      if (p.disconnectedAt && (now - p.disconnectedAt > RECLAIM_WINDOW_MS)) return false;
      return true;
    };

    // Side priority: respect creator's preferred color first, then the other slot, else viewer
    // Bot slots are NEVER considered empty (active bot stays) — but a HUMAN slot that
    // was abandoned past the reclaim window IS considered free again
    const preferred = room.creatorColor || 'w';
    const other = preferred === 'w' ? 'b' : 'w';
    const slotEmpty = (c) => {
      const p = room.players[c];
      if (!p) return true;
      if (p.isBot) return false;
      if (!p.id && p.disconnectedAt && (now - p.disconnectedAt > RECLAIM_WINDOW_MS)) return true;
      return false;
    };

    let role;
    if (isReclaimable('w')) {
      room.players.w = { id: socket.id, name: userName, uid: userUid };
      role = 'w';
    } else if (isReclaimable('b')) {
      room.players.b = { id: socket.id, name: userName, uid: userUid };
      role = 'b';
    } else if (slotEmpty(preferred)) {
      room.players[preferred] = { id: socket.id, name: userName, uid: userUid };
      role = preferred;
    } else if (slotEmpty(other)) {
      room.players[other] = { id: socket.id, name: userName, uid: userUid };
      role = other;
    } else {
      room.viewers.set(socket.id, { name: userName, uid: userUid });
      role = 'viewer';
    }

    if (role !== 'viewer' && room.status === 'waiting') {
      const wHuman = room.players.w && !room.players.w.isBot;
      const bHuman = room.players.b && !room.players.b.isBot;
      const wFilled = !!room.players.w;
      const bFilled = !!room.players.b;
      // Start when both slots are filled (either both human, or human + bot)
      if (wFilled && bFilled && (wHuman || bHuman)) {
        room.status = 'playing';
        startClock(room);
      }
    }
    // Resume a paused clock (e.g. after server restart restore) once both
    // sides are live again — otherwise a timed game stays frozen forever.
    if (role !== 'viewer' && room.status === 'playing' && room.timeBase && !room.runningSince) {
      const live = (cc) => {
        const p = room.players[cc];
        return !!p && (p.isBot || (p.id && io.sockets.sockets.get(p.id)));
      };
      if (live('w') && live('b')) startClock(room);
    }
    socket.data.role = role;

    socket.emit('joined', { roomId, role });
    socket.emit('chat_history', room.messages);
    broadcastRoomState(roomId);
    broadcastRoomList();
    if (role !== 'viewer') persistRoom(room);

    pushSystemMessage(room, 'sys.joined.' + role, { name: userName });
    if (room.bot && room.status === 'playing' && room.currentPlayer === room.bot.color) {
      maybeBotMove(roomId, 800);
    }
  });

  socket.on('move', ({ from, to, col }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (socket.data.role !== room.currentPlayer) {
      socket.emit('error_msg', 'ยังไม่ถึงตาคุณ'); return;
    }

    // Connect Four: client sends a column index to drop into.
    if (CONNECT4_TYPES.includes(room.gameType)) {
      if (!Number.isInteger(col) || col < 0 || col >= Connect4.COLS) {
        socket.emit('error_msg', 'ตำแหน่งไม่ถูกต้อง'); return;
      }
      if (Connect4.findLandingRow(room.board, col) < 0) {
        socket.emit('error_msg', 'เดินไม่ได้'); return;
      }
      processMove(room, null, null, { col });
      broadcastRoomState(roomId);
      broadcastRoomList();
      persistRoom(room);
      if (room.bot && room.status === 'playing' && room.currentPlayer === room.bot.color) {
        maybeBotMove(roomId);
      }
      return;
    }

    if (!from || !to || ![from.r, from.c, to.r, to.c].every(n => Number.isInteger(n) && n >= 0 && n < 8)) {
      socket.emit('error_msg', 'ตำแหน่งไม่ถูกต้อง'); return;
    }
    const engine = ENGINES[room.gameType] || Chess;
    const piece = room.board[from.r][from.c];
    if (!piece || engine.pieceColor(piece) !== room.currentPlayer) {
      socket.emit('error_msg', 'หมากไม่ถูกต้อง'); return;
    }

    let legal;
    let chessIntlCtx = null;
    if (CHECKERS_TYPES.includes(room.gameType)) {
      legal = engine.getLegalMoves(room.board, from.r, from.c, room.currentPlayer, room.mustContinueFrom);
    } else if (room.gameType === 'chess-intl') {
      chessIntlCtx = { castling: room.castling, enPassant: room.enPassant };
      legal = engine.getLegalMoves(room.board, from.r, from.c, chessIntlCtx);
    } else {
      legal = engine.getLegalMoves(room.board, from.r, from.c);
    }
    const moveInfo = legal.find(m => m.r === to.r && m.c === to.c);
    if (!moveInfo) {
      socket.emit('error_msg', 'เดินไม่ได้'); return;
    }

    processMove(room, from, to, moveInfo);
    broadcastRoomState(roomId);
    broadcastRoomList();
    persistRoom(room);
    if (room.bot && room.status === 'playing' && room.currentPlayer === room.bot.color) {
      maybeBotMove(roomId);
    }
  });

  socket.on('resign', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.status !== 'playing') return;
    if (socket.data.role !== 'w' && socket.data.role !== 'b') return;
    deductTime(room);
    const loser = socket.data.role;
    const winner = loser === 'w' ? 'b' : 'w';
    endGame(room, 'resign', winner);
    pushSystemMessage(room, 'sys.resign', { user: socket.data.user.name, winner });
    broadcastRoomState(socket.data.roomId);
    broadcastRoomList();
    persistRoom(room);
  });

  socket.on('chat', (text) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (typeof text !== 'string') return;
    const trimmed = text.trim().slice(0, 300);
    if (!trimmed) return;
    const msg = {
      type: 'chat',
      user: socket.data.user.name,
      role: socket.data.role,
      text: trimmed,
      time: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 200) room.messages.shift();
    io.to(roomId).emit('chat_message', msg);
  });

  socket.on('reaction', (emoji) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (typeof emoji !== 'string' || !ALLOWED_REACTIONS.includes(emoji)) return;
    io.to(roomId).emit('reaction', { emoji, user: socket.data.user.name, time: Date.now() });
  });

  socket.on('reset_game', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.data.role !== 'w' && socket.data.role !== 'b') return;
    Object.assign(room, buildInitialMatchState(room.gameType, room.timeBase, room.timeIncrement));
    if (room.bot) {
      room.players[room.bot.color] = { id: 'BOT', name: 'Bot', isBot: true, botDifficulty: room.bot.difficulty };
    }
    // Only count slots with a live occupant (bot, or human with an active
    // socket) — a disconnected placeholder must not start the game.
    const liveSlot = (p) => !!p && (p.isBot || (p.id && io.sockets.sockets.get(p.id)));
    room.status = (liveSlot(room.players.w) && liveSlot(room.players.b)) ? 'playing' : 'waiting';
    if (room.status === 'playing') startClock(room);
    pushSystemMessage(room, 'sys.reset', { user: socket.data.user.name });
    broadcastRoomState(roomId);
    broadcastRoomList();
    persistRoom(room);
    if (room.bot && room.status === 'playing' && room.currentPlayer === room.bot.color) {
      maybeBotMove(roomId, 800);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit('site_stats', { totalVisits, onlineUsers });
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const role = socket.data.role;
    let removed = false;
    // Mark slot as disconnected (for reclaim window) instead of clearing entirely
    // — name is kept so the same user can reclaim within RECLAIM_WINDOW_MS
    if (role === 'w' && room.players.w && room.players.w.id === socket.id) {
      room.players.w = { name: room.players.w.name, uid: room.players.w.uid || null, isBot: false, id: null, disconnectedAt: Date.now() };
      removed = true;
    } else if (role === 'b' && room.players.b && room.players.b.id === socket.id) {
      room.players.b = { name: room.players.b.name, uid: room.players.b.uid || null, isBot: false, id: null, disconnectedAt: Date.now() };
      removed = true;
    } else if (role === 'viewer') {
      room.viewers.delete(socket.id);
    }

    if (removed) {
      pushSystemMessage(room, 'sys.left.' + role, { name: socket.data.user.name });
      if (room.status === 'playing') {
        deductTime(room); // freeze the clock fairly while waiting for a reclaim
        room.status = 'waiting';
      }
    }

    // Delete room when no live humans care anymore (bot doesn't count — bot games
    // exist for humans). A "live" human is connected OR disconnected within reclaim window.
    if (isRoomAbandoned(room)) {
      rooms.delete(roomId);
      deletePersistedRoom(roomId);
    } else {
      broadcastRoomState(roomId);
      if (removed) persistRoom(room);
    }
    broadcastRoomList();
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status !== 'playing' || !room.timeBase || !room.runningSince) continue;
    const elapsed = Date.now() - room.runningSince;
    const remaining = (room.currentPlayer === 'w' ? room.whiteTime : room.blackTime) - elapsed;
    if (remaining <= 0) {
      const loser = room.currentPlayer;
      if (loser === 'w') room.whiteTime = 0; else room.blackTime = 0;
      endGame(room, 'timeout', loser === 'w' ? 'b' : 'w');
      pushSystemMessage(room, 'sys.timeout', { loser, winner: loser === 'w' ? 'b' : 'w' });
      broadcastRoomState(room.id);
      broadcastRoomList();
    }
  }
}, 1000);

// Periodic cleanup: remove rooms whose humans abandoned past the reclaim window
setInterval(() => {
  let removed = 0;
  for (const [id, room] of rooms.entries()) {
    if (isRoomAbandoned(room)) {
      rooms.delete(id);
      deletePersistedRoom(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[cleanup] removed ${removed} abandoned room(s)`);
    broadcastRoomList();
  }
}, 60 * 1000); // every 60s

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`♛ หมากรุกไทยออนไลน์: http://localhost:${PORT}`);
});

// Graceful shutdown: warn clients, flush room state to Redis, then exit cleanly
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  const SHUTDOWN_DELAY_MS = 8000;
  console.log(`[shutdown] ${signal} received, broadcasting restart warning, exiting in ${SHUTDOWN_DELAY_MS}ms`);
  io.emit('server_restart', { in_seconds: Math.floor(SHUTDOWN_DELAY_MS / 1000) });

  setTimeout(async () => {
    // Flush all active rooms to Redis synchronously so they survive restart
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      console.log(`[shutdown] flushing ${rooms.size} rooms to Redis...`);
      const tasks = Array.from(rooms.values()).map(persistRoomNow);
      await Promise.allSettled(tasks);
      console.log(`[shutdown] flush done`);
    }
    io.close(() => {
      server.close(() => {
        console.log('[shutdown] clean exit');
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(0), 2000);
  }, SHUTDOWN_DELAY_MS);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
