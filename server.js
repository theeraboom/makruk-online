const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const Chess = require('./public/chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();
const ALLOWED_REACTIONS = ['👍', '👏', '🔥', '😱', '♟', '🎉', '❤️', '🤔'];
const ALLOWED_TIME_BASE = [null, 1, 3, 5, 10, 15, 30, 60, 90];
const ALLOWED_TIME_INCREMENT = [0, 2, 3, 5, 10, 15, 30];

function buildInitialMatchState(timeBase, timeIncrement) {
  const ms = timeBase ? timeBase * 60 * 1000 : null;
  return {
    board: Chess.initialBoard(),
    currentPlayer: 'w',
    moves: [],
    timeBase,
    timeIncrement: timeIncrement || 0,
    whiteTime: ms,
    blackTime: ms,
    runningSince: null,
    endedReason: null,
    endedWinner: null,
  };
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

const VISITS_FILE = path.join(__dirname, 'visits.json');
let totalVisits = 0;
let onlineUsers = 0;
try {
  const data = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
  totalVisits = data.total || 0;
} catch (e) {}

let saveTimer = null;
function saveVisits() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.writeFile(VISITS_FILE, JSON.stringify({ total: totalVisits }), () => {});
  }, 1500);
}

const HTML_PATHS = ['/', '/index.html', '/room.html', '/rules.html'];
app.use((req, res, next) => {
  if (req.method !== 'GET' || !HTML_PATHS.includes(req.path)) return next();
  const cookie = req.headers.cookie || '';
  if (!cookie.includes('mkv=1')) {
    totalVisits++;
    saveVisits();
    res.setHeader('Set-Cookie', 'mkv=1; Path=/; Max-Age=31536000; SameSite=Lax');
    io.emit('site_stats', { totalVisits, onlineUsers });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const makeRoomId = () => Math.random().toString(36).slice(2, 8);

function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    board: room.board,
    playerCount: (room.players.w ? 1 : 0) + (room.players.b ? 1 : 0),
    viewerCount: room.viewers.size,
    status: room.status,
    currentPlayer: room.currentPlayer,
    timeBase: room.timeBase,
    timeIncrement: room.timeIncrement,
    isPrivate: !!room.password,
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
    board: room.board,
    currentPlayer: room.currentPlayer,
    status: room.status,
    players: {
      w: room.players.w ? { name: room.players.w.name } : null,
      b: room.players.b ? { name: room.players.b.name } : null,
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
  });
}

function pushSystemMessage(room, text) {
  const msg = { type: 'system', text, time: Date.now() };
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
    const validBase = ALLOWED_TIME_BASE.includes(p.timeBase) ? p.timeBase : null;
    const validInc = ALLOWED_TIME_INCREMENT.includes(p.timeIncrement) ? p.timeIncrement : 0;
    const password = (typeof p.password === 'string' && p.password.trim()) ? p.password.trim().slice(0, 40) : null;
    const room = {
      id,
      name: (typeof p.name === 'string' && p.name.trim()) ? p.name.trim().slice(0, 40) : 'วงหมากรุกไทย',
      password,
      players: { w: null, b: null },
      viewers: new Map(),
      messages: [],
      status: 'waiting',
      ...buildInitialMatchState(validBase, validInc),
    };
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
    if (!room.players.w) {
      room.players.w = { id: socket.id, name: socket.data.user.name };
      role = 'w';
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
    socket.data.role = role;

    socket.emit('joined', { roomId, role });
    socket.emit('chat_history', room.messages);
    broadcastRoomState(roomId);
    broadcastRoomList();

    const roleText = role === 'viewer' ? 'ผู้ชม' : (role === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ');
    pushSystemMessage(room, `${socket.data.user.name} เข้าร่วมเป็น${roleText}`);
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
    const piece = room.board[from.r][from.c];
    if (!piece || Chess.pieceColor(piece) !== room.currentPlayer) {
      socket.emit('error_msg', 'หมากไม่ถูกต้อง'); return;
    }
    const legal = Chess.getLegalMoves(room.board, from.r, from.c);
    if (!legal.some(m => m.r === to.r && m.c === to.c)) {
      socket.emit('error_msg', 'เดินไม่ได้'); return;
    }

    deductTime(room);
    if (room.timeBase && (room.whiteTime <= 0 || room.blackTime <= 0)) {
      const loser = room.currentPlayer;
      endGame(room, 'timeout', loser === 'w' ? 'b' : 'w');
      pushSystemMessage(room, `${loser === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} หมดเวลา — ${loser === 'w' ? 'ฝ่ายดำ' : 'ฝ่ายขาว'} ชนะ ⏰`);
      broadcastRoomState(roomId);
      broadcastRoomList();
      return;
    }
    addIncrement(room);

    const movingPiece = piece;
    const targetBefore = room.board[to.r][to.c];
    const captured = !!targetBefore;
    room.board = Chess.applyMove(room.board, from.r, from.c, to.r, to.c);
    const promoted = (movingPiece === 'wP' && to.r === 2) || (movingPiece === 'bP' && to.r === 5);
    room.moves.push({
      from, to,
      piece: movingPiece,
      capture: captured,
      promoted,
      notation: Chess.moveNotation(movingPiece, from, to, captured, promoted),
      time: Date.now(),
    });
    room.currentPlayer = room.currentPlayer === 'w' ? 'b' : 'w';

    const status = Chess.gameStatus(room.board, room.currentPlayer);
    if (status.ended) {
      endGame(room, status.reason, status.winner);
      const text = status.reason === 'checkmate'
        ? `รุกจน! ${status.winner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ 🎉`
        : 'อับ — เสมอ';
      pushSystemMessage(room, text);
    } else {
      startClock(room);
      if (status.inCheck) {
        pushSystemMessage(room, `${room.currentPlayer === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} กำลังถูกรุก!`);
      }
    }
    broadcastRoomState(roomId);
    broadcastRoomList();
  });

  socket.on('resign', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.status !== 'playing') return;
    if (socket.data.role !== 'w' && socket.data.role !== 'b') return;
    deductTime(room);
    const loser = socket.data.role;
    const winner = loser === 'w' ? 'b' : 'w';
    endGame(room, 'resign', winner);
    pushSystemMessage(room, `${socket.data.user.name} ยอมแพ้ — ${winner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ 🏳`);
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
    Object.assign(room, buildInitialMatchState(room.timeBase, room.timeIncrement));
    room.status = (room.players.w && room.players.b) ? 'playing' : 'waiting';
    if (room.status === 'playing') startClock(room);
    pushSystemMessage(room, `${socket.data.user.name} เริ่มเกมใหม่ 🔁`);
    broadcastRoomState(roomId);
    broadcastRoomList();
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
      pushSystemMessage(room, `${socket.data.user.name} (${role === 'w' ? 'ขาว' : 'ดำ'}) ออกจากห้อง`);
      if (room.status === 'playing') room.status = 'waiting';
    }

    if (!room.players.w && !room.players.b && room.viewers.size === 0) {
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
      pushSystemMessage(room, `${loser === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} หมดเวลา — ${loser === 'w' ? 'ฝ่ายดำ' : 'ฝ่ายขาว'} ชนะ ⏰`);
      broadcastRoomState(room.id);
      broadcastRoomList();
    }
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`♛ หมากรุกไทยออนไลน์: http://localhost:${PORT}`);
});
