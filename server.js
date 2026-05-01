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

  socket.on('create_room', (name) => {
    const id = makeRoomId();
    const room = {
      id,
      name: (typeof name === 'string' && name.trim()) ? name.trim().slice(0, 40) : 'วงหมากรุกไทย',
      board: Chess.initialBoard(),
      currentPlayer: 'w',
      players: { w: null, b: null },
      viewers: new Map(),
      messages: [],
      status: 'waiting',
    };
    rooms.set(id, room);
    socket.emit('room_created', { id });
    broadcastRoomList();
  });

  socket.on('join_room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) { socket.emit('error_msg', 'ไม่พบห้องนี้'); return; }

    socket.join(roomId);
    socket.data.roomId = roomId;

    let role;
    if (!room.players.w) {
      room.players.w = { id: socket.id, name: socket.data.user.name };
      role = 'w';
    } else if (!room.players.b) {
      room.players.b = { id: socket.id, name: socket.data.user.name };
      role = 'b';
      if (room.status === 'waiting') room.status = 'playing';
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

    room.board = Chess.applyMove(room.board, from.r, from.c, to.r, to.c);
    room.currentPlayer = room.currentPlayer === 'w' ? 'b' : 'w';

    const status = Chess.gameStatus(room.board, room.currentPlayer);
    broadcastRoomState(roomId);

    if (status.ended) {
      room.status = 'ended';
      const text = status.reason === 'checkmate'
        ? `รุกจน! ${status.winner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ 🎉`
        : 'อับ — เสมอ';
      pushSystemMessage(room, text);
      broadcastRoomState(roomId);
    } else if (status.inCheck) {
      pushSystemMessage(room, `${room.currentPlayer === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} กำลังถูกรุก!`);
    }
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
    room.board = Chess.initialBoard();
    room.currentPlayer = 'w';
    room.status = (room.players.w && room.players.b) ? 'playing' : 'waiting';
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`♛ หมากรุกไทยออนไลน์: http://localhost:${PORT}`);
});
