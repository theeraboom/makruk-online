const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const Chess = require('./public/chess.js');
const Checkers = require('./public/checkers.js');
const ChessIntl = require('./public/chess-intl.js');
const CheckersIntl = require('./public/checkers-intl.js');
const Bot = require('./ai-bot.js');
const ENGINES = {
  chess: Chess,
  checkers: Checkers,
  'chess-intl': ChessIntl,
  'checkers-intl': CheckersIntl,
};
const ALLOWED_GAME_TYPES = ['chess', 'checkers', 'chess-intl', 'checkers-intl'];
const CHECKERS_TYPES = ['checkers', 'checkers-intl'];
const CHESS_TYPES = ['chess', 'chess-intl'];
const ALLOWED_BOT_DIFFICULTIES = ['easy', 'medium', 'hard'];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

function broadcastRoomList() {
  io.emit('rooms_list', Array.from(rooms.values()).map(publicRoom));
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
  socket.data.user = { name: 'Anon-' + socket.id.slice(0, 4) };
  onlineUsers++;
  io.emit('site_stats', { totalVisits, onlineUsers });

  socket.on('set_name', (name) => {
    if (typeof name === 'string' && name.trim()) {
      socket.data.user.name = name.trim().slice(0, 24);
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
    const botColor = p.botColor === 'w' ? 'w' : 'b';
    const userName = (typeof p.name === 'string' && p.name.trim()) ? p.name.trim().slice(0, 40) : null;
    const room = {
      id,
      name: userName || '',
      hasDefaultName: !userName,
      password,
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

    let role;
    if (!room.players.w || (room.players.w && room.players.w.isBot)) {
      if (!room.players.w) {
        room.players.w = { id: socket.id, name: socket.data.user.name };
        role = 'w';
        if (room.bot && room.bot.color === 'b' && room.status === 'waiting') {
          room.status = 'playing';
          startClock(room);
        }
      } else if (!room.players.b) {
        room.players.b = { id: socket.id, name: socket.data.user.name };
        role = 'b';
        if (room.status === 'waiting') {
          room.status = 'playing';
          startClock(room);
        }
      } else {
        room.viewers.set(socket.id, { name: socket.data.user.name });
        role = 'viewer';
      }
    } else if (!room.players.b || (room.players.b && room.players.b.isBot)) {
      if (!room.players.b) {
        room.players.b = { id: socket.id, name: socket.data.user.name };
        role = 'b';
        if (room.status === 'waiting') {
          room.status = 'playing';
          startClock(room);
        }
      } else {
        room.viewers.set(socket.id, { name: socket.data.user.name });
        role = 'viewer';
      }
    } else {
      room.viewers.set(socket.id, { name: socket.data.user.name });
      role = 'viewer';
    }
    socket.data.role = role;

    socket.emit('joined', { roomId, role });
    socket.emit('chat_history', room.messages);
    broadcastRoomState(roomId);
    broadcastRoomList();

    pushSystemMessage(room, 'sys.joined.' + role, { name: socket.data.user.name });
    if (room.bot && room.status === 'playing' && room.currentPlayer === room.bot.color) {
      maybeBotMove(roomId, 800);
    }
  });

  socket.on('move', ({ from, to }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (socket.data.role !== room.currentPlayer) {
      socket.emit('error_msg', 'ยังไม่ถึงตาคุณ'); return;
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
    room.status = (room.players.w && room.players.b) ? 'playing' : 'waiting';
    if (room.status === 'playing') startClock(room);
    pushSystemMessage(room, 'sys.reset', { user: socket.data.user.name });
    broadcastRoomState(roomId);
    broadcastRoomList();
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
    if (role === 'w' && room.players.w && room.players.w.id === socket.id) {
      room.players.w = null; removed = true;
    } else if (role === 'b' && room.players.b && room.players.b.id === socket.id) {
      room.players.b = null; removed = true;
    } else if (role === 'viewer') {
      room.viewers.delete(socket.id);
    }

    if (removed) {
      pushSystemMessage(room, 'sys.left.' + role, { name: socket.data.user.name });
      if (room.status === 'playing') room.status = 'waiting';
    }

    const wEmpty = !room.players.w || room.players.w.isBot;
    const bEmpty = !room.players.b || room.players.b.isBot;
    if (wEmpty && bEmpty && room.viewers.size === 0) {
      rooms.delete(roomId);
    } else {
      broadcastRoomState(roomId);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`♛ หมากรุกไทยออนไลน์: http://localhost:${PORT}`);
});
