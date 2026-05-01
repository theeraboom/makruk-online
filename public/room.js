const PIECE_SYMBOLS = {
  'wK': '♔', 'wQ': '♕', 'wB': '♗', 'wN': '♘', 'wR': '♖', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
};

const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');
if (!roomId) window.location.href = '/';

const socket = io();
let myRole = null;
let board = null;
let currentPlayer = 'w';
let status = 'waiting';
let selected = null;
let validMoves = [];
let flipped = false;
let chatMsgCount = 0;

const userName = localStorage.getItem('makruk_name') || '';
if (userName) socket.emit('set_name', userName);
socket.emit('join_room', { roomId });

socket.on('joined', ({ role }) => {
  myRole = role;
  if (role === 'b') flipped = true;
  updateRoleBadge();
});

socket.on('room_state', (state) => {
  document.getElementById('roomName').textContent = state.name;
  document.title = state.name + ' — หมากรุกไทยออนไลน์';
  board = state.board;
  currentPlayer = state.currentPlayer;
  status = state.status;

  updatePlayerSlot('W', state.players.w);
  updatePlayerSlot('B', state.players.b);

  document.getElementById('playerW').classList.toggle('active', currentPlayer === 'w' && status === 'playing');
  document.getElementById('playerB').classList.toggle('active', currentPlayer === 'b' && status === 'playing');

  document.getElementById('viewerCount').textContent = state.viewerCount;
  updateViewersList(state.viewers || [], state.viewerCount);

  updateStatus();
  selected = null;
  validMoves = [];
  render();
});

function updateViewersList(viewers, count) {
  const list = document.getElementById('viewersList');
  document.getElementById('viewersTitle').textContent = `ผู้ชม (${count})`;
  if (!viewers.length) {
    list.innerHTML = '<div class="viewers-empty">ยังไม่มีคนยืนดู</div>';
    return;
  }
  list.innerHTML = '';
  viewers.forEach((v) => {
    const chip = document.createElement('div');
    chip.className = 'viewer-chip';
    const initials = (v.name || '?').slice(0, 2).toUpperCase();
    const colorHash = hashColor(v.name || '');
    chip.innerHTML = `
      <div class="viewer-avatar" style="background:${colorHash}">${escapeHtml(initials)}</div>
      <span>${escapeHtml(v.name || '')}</span>
    `;
    list.appendChild(chip);
  });
}

function hashColor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = ['#60A5FA', '#F472B6', '#34D399', '#FBBF24', '#A78BFA', '#FB923C', '#22D3EE', '#F87171'];
  return palette[h % palette.length];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function updatePlayerSlot(side, player) {
  const slot = document.getElementById('player' + side);
  const avatarEl = document.getElementById('avatar' + side);
  const nameEl = slot.querySelector('.player-name');
  if (player) {
    avatarEl.textContent = (player.name || '?').slice(0, 2).toUpperCase();
    nameEl.textContent = player.name;
    nameEl.classList.remove('empty');
    avatarEl.classList.remove('empty');
  } else {
    avatarEl.textContent = '?';
    avatarEl.classList.add('empty');
    nameEl.textContent = 'รอผู้เล่น';
    nameEl.classList.add('empty');
  }
}

socket.on('chat_history', (msgs) => {
  const c = document.getElementById('chatMessages');
  c.innerHTML = '';
  chatMsgCount = 0;
  msgs.forEach((m) => appendChat(m));
});

socket.on('chat_message', (msg) => {
  appendChat(msg);
});

socket.on('error_msg', (msg) => {
  showToast(msg);
});

socket.on('reaction', ({ emoji }) => {
  spawnFloatingReaction(emoji);
});

socket.on('site_stats', ({ totalVisits, onlineUsers }) => {
  const footer = document.getElementById('footerStats');
  if (footer) {
    footer.innerHTML = `© 2026 หมากรุกไทยออนไลน์ — ผู้เข้าชมทั้งหมด <strong>${totalVisits.toLocaleString('th-TH')}</strong> ครั้ง • ออนไลน์ตอนนี้ <strong>${onlineUsers.toLocaleString('th-TH')}</strong> คน`;
  }
});

document.querySelectorAll('.reaction-btn').forEach((btn) => {
  btn.onclick = () => {
    const emoji = btn.dataset.emoji;
    socket.emit('reaction', emoji);
    btn.classList.add('reacted');
    setTimeout(() => btn.classList.remove('reacted'), 300);
  };
});

function spawnFloatingReaction(emoji) {
  const overlay = document.getElementById('reactionOverlay');
  if (!overlay) return;
  const el = document.createElement('div');
  el.className = 'floating-reaction';
  el.textContent = emoji;
  el.style.left = (Math.random() * 70 + 15) + '%';
  el.style.fontSize = (32 + Math.random() * 20) + 'px';
  el.style.animationDuration = (2.5 + Math.random() * 1.2) + 's';
  overlay.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function updateRoleBadge() {
  const badge = document.getElementById('roleBadge');
  if (myRole === 'w') { badge.textContent = '⚪ คุณคือฝ่ายขาว'; badge.className = 'role-badge w'; }
  else if (myRole === 'b') { badge.textContent = '⚫ คุณคือฝ่ายดำ'; badge.className = 'role-badge b'; }
  else { badge.textContent = '👁 คุณกำลังดู'; badge.className = 'role-badge viewer'; }
}

function updateStatus() {
  const el = document.getElementById('status');
  el.className = 'status-pill';
  if (status === 'waiting') {
    el.textContent = '⏳ รอผู้เล่นอีก 1 คน';
    el.classList.add('waiting');
  } else if (status === 'ended') {
    el.textContent = '🏁 เกมจบแล้ว';
  } else {
    const inCheck = Chess.isInCheck(board, currentPlayer);
    const turnText = currentPlayer === 'w' ? 'ตาฝ่ายขาว' : 'ตาฝ่ายดำ';
    if (inCheck) {
      el.textContent = `${turnText} • ถูกรุก!`;
      el.classList.add('check');
    } else {
      el.textContent = turnText;
      el.classList.add('playing');
    }
  }
}

function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  if (!board) return;

  const inCheck = Chess.isInCheck(board, currentPlayer);
  const kingPos = inCheck ? Chess.findKing(board, currentPlayer) : null;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const r = flipped ? 7 - i : i;
      const c = flipped ? 7 - j : j;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

      if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
      const vm = validMoves.find((m) => m.r === r && m.c === c);
      if (vm) sq.classList.add(vm.capture ? 'valid-capture' : 'valid-move');
      if (kingPos && kingPos.r === r && kingPos.c === c) sq.classList.add('check');

      const piece = board[r][c];
      if (piece) {
        sq.textContent = PIECE_SYMBOLS[piece];
        sq.classList.add(Chess.pieceColor(piece) === 'w' ? 'piece-w' : 'piece-b');
      }

      sq.onclick = () => handleClick(r, c);
      boardEl.appendChild(sq);
    }
  }
}

function handleClick(r, c) {
  if (status !== 'playing') return;
  if (myRole !== currentPlayer) return;

  const piece = board[r][c];
  if (selected) {
    const vm = validMoves.find((m) => m.r === r && m.c === c);
    if (vm) {
      socket.emit('move', { from: { r: selected.r, c: selected.c }, to: { r, c } });
      selected = null;
      validMoves = [];
      render();
      return;
    }
    if (piece && Chess.pieceColor(piece) === myRole) {
      selected = { r, c };
      validMoves = Chess.getLegalMoves(board, r, c);
      render();
      return;
    }
    selected = null;
    validMoves = [];
    render();
    return;
  }
  if (piece && Chess.pieceColor(piece) === myRole) {
    selected = { r, c };
    validMoves = Chess.getLegalMoves(board, r, c);
    render();
  }
}

document.getElementById('flipBtn').onclick = () => {
  flipped = !flipped;
  render();
};

document.getElementById('resetBtn').onclick = () => {
  if (myRole !== 'w' && myRole !== 'b') {
    showToast('เฉพาะผู้เล่นเท่านั้นที่เริ่มเกมใหม่ได้');
    return;
  }
  if (confirm('เริ่มเกมใหม่?')) socket.emit('reset_game');
};

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
chatForm.onsubmit = (e) => {
  e.preventDefault();
  const t = chatInput.value.trim();
  if (!t) return;
  socket.emit('chat', t);
  chatInput.value = '';
};

function appendChat(msg) {
  const c = document.getElementById('chatMessages');
  const div = document.createElement('div');
  if (msg.type === 'system') {
    div.className = 'msg system';
    div.textContent = msg.text;
  } else {
    div.className = 'msg ' + (msg.role || 'viewer');
    const roleEmoji = msg.role === 'w' ? '⚪' : msg.role === 'b' ? '⚫' : '👁';
    const userSpan = document.createElement('span');
    userSpan.className = 'msg-user';
    userSpan.textContent = roleEmoji + ' ' + msg.user;
    const textSpan = document.createElement('span');
    textSpan.className = 'msg-text';
    textSpan.textContent = ': ' + msg.text;
    div.appendChild(userSpan);
    div.appendChild(textSpan);
  }
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
  chatMsgCount++;
  document.getElementById('chatCount').textContent = chatMsgCount + ' ข้อความ';
}

function showToast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}
