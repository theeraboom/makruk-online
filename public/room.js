const CHESS_SYMBOLS = {
  'wK': '♔', 'wQ': '♕', 'wB': '♗', 'wN': '♘', 'wR': '♖', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
};
const CHECKERS_SYMBOLS = {
  'wM': '⛀', 'wK': '⛁', 'bM': '⛂', 'bK': '⛃'
};
function getEngine() { return gameType === 'checkers' ? Checkers : Chess; }
function getSymbols() { return gameType === 'checkers' ? CHECKERS_SYMBOLS : CHESS_SYMBOLS; }

const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');
const initialPw = params.get('pw') || null;
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
let gameType = 'chess';
let mustContinueFrom = null;
let timeBase = null;
let timeIncrement = 0;
let whiteTime = null;
let blackTime = null;
let runningSince = null;
let endedReason = null;
let endedWinner = null;
let moves = [];
let lastMoveCount = 0;
let soundEnabled = localStorage.getItem('makruk_sound') !== 'off';
let boardTheme = localStorage.getItem('makruk_theme') || 'wood';

const userName = localStorage.getItem('makruk_name') || '';
if (userName) socket.emit('set_name', userName);
socket.emit('join_room', { roomId, password: initialPw });

socket.on('password_required', ({ name }) => {
  const pw = prompt(`ห้อง "${name}" เป็นห้องส่วนตัว\nกรุณาใส่รหัสห้อง:`);
  if (!pw) { window.location.href = '/'; return; }
  socket.emit('join_room', { roomId, password: pw });
});

socket.on('joined', ({ role }) => {
  myRole = role;
  if (role === 'b') flipped = true;
  updateRoleBadge();
});

socket.on('room_state', (state) => {
  document.getElementById('roomName').textContent = state.name;
  document.title = state.name + ' — Playmakruk';
  const prevStatus = status;
  gameType = state.gameType || 'chess';
  const labelEl = document.getElementById('roomGameTypeLabel');
  if (labelEl) labelEl.textContent = gameType === 'checkers' ? 'หมากฮอสไทย' : 'หมากรุกไทย';
  const chessRules = document.getElementById('chessRulesList');
  const checkersRules = document.getElementById('checkersRulesList');
  if (chessRules && checkersRules) {
    chessRules.hidden = gameType === 'checkers';
    checkersRules.hidden = gameType !== 'checkers';
  }
  board = state.board;
  currentPlayer = state.currentPlayer;
  status = state.status;
  mustContinueFrom = state.mustContinueFrom || null;
  timeBase = state.timeBase;
  timeIncrement = state.timeIncrement || 0;
  whiteTime = state.whiteTime;
  blackTime = state.blackTime;
  runningSince = state.runningSince;
  endedReason = state.endedReason;
  endedWinner = state.endedWinner;
  moves = state.moves || [];

  if (moves.length > lastMoveCount && prevStatus === 'playing') {
    const lastMove = moves[moves.length - 1];
    if (lastMove.piece && lastMove.piece[0] !== myRole) playSound('move');
  }
  lastMoveCount = moves.length;

  if (status === 'ended' && prevStatus === 'playing') playSound('end');

  renderMoves();
  renderClocks();
  renderControls();

  if (mustContinueFrom && currentPlayer === myRole) {
    selected = { r: mustContinueFrom.r, c: mustContinueFrom.c };
    validMoves = legalMovesFor(mustContinueFrom.r, mustContinueFrom.c);
  } else if (!mustContinueFrom) {
    selected = null;
    validMoves = [];
  }

  updatePlayerSlot('W', state.players.w);
  updatePlayerSlot('B', state.players.b);

  document.getElementById('playerW').classList.toggle('active', currentPlayer === 'w' && status === 'playing');
  document.getElementById('playerB').classList.toggle('active', currentPlayer === 'b' && status === 'playing');

  document.getElementById('viewerCount').textContent = state.viewerCount;
  updateViewersList(state.viewers || [], state.viewerCount);

  updateStatus();
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
  if (msg.type === 'chat' && msg.user !== userName) playSound('chat');
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
    footer.innerHTML = `© 2026 Playmakruk.com — ผู้เข้าชมทั้งหมด <strong>${totalVisits.toLocaleString('th-TH')}</strong> ครั้ง • ออนไลน์ตอนนี้ <strong>${onlineUsers.toLocaleString('th-TH')}</strong> คน`;
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
    let label = '🏁 เกมจบ';
    if (endedReason === 'checkmate') label = `🏆 ${endedWinner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ (รุกจน)`;
    else if (endedReason === 'resign') label = `🏳 ${endedWinner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ (อีกฝ่ายยอมแพ้)`;
    else if (endedReason === 'timeout') label = `⏰ ${endedWinner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ (อีกฝ่ายหมดเวลา)`;
    else if (endedReason === 'no_pieces') label = `🏆 ${endedWinner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ — เก็บหมากหมด!`;
    else if (endedReason === 'no_moves') label = `🏆 ${endedWinner === 'w' ? 'ฝ่ายขาว' : 'ฝ่ายดำ'} ชนะ — อีกฝ่ายเดินไม่ได้`;
    else if (endedReason === 'stalemate') label = '🤝 เสมอ (อับ)';
    el.textContent = label;
  } else {
    const turnText = currentPlayer === 'w' ? 'ตาฝ่ายขาว' : 'ตาฝ่ายดำ';
    if (mustContinueFrom && currentPlayer === myRole) {
      el.textContent = `${turnText} • กินต่อได้!`;
      el.classList.add('check');
    } else if (gameType === 'chess' && Chess.isInCheck(board, currentPlayer)) {
      el.textContent = `${turnText} • ถูกรุก!`;
      el.classList.add('check');
    } else {
      el.textContent = turnText;
      el.classList.add('playing');
    }
  }
}

function fmtClock(ms) {
  if (ms == null) return '--:--';
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 10) return `${m}:${String(s).padStart(2, '0')}`;
  if (total < 10) return `${m}:${String(s).padStart(2, '0')}.${Math.floor((Math.max(0, ms) % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderClocks() {
  const cw = document.getElementById('clockW');
  const cb = document.getElementById('clockB');
  if (!timeBase) {
    cw.hidden = true; cb.hidden = true;
    return;
  }
  cw.hidden = false; cb.hidden = false;

  const liveAdjust = (color) => {
    const base = color === 'w' ? whiteTime : blackTime;
    if (status === 'playing' && currentPlayer === color && runningSince) {
      return base - (Date.now() - runningSince);
    }
    return base;
  };

  const wms = liveAdjust('w');
  const bms = liveAdjust('b');
  cw.textContent = fmtClock(wms);
  cb.textContent = fmtClock(bms);
  cw.classList.toggle('low', wms != null && wms < 30000);
  cb.classList.toggle('low', bms != null && bms < 30000);
  cw.classList.toggle('active', status === 'playing' && currentPlayer === 'w');
  cb.classList.toggle('active', status === 'playing' && currentPlayer === 'b');
}

setInterval(() => { if (timeBase) renderClocks(); }, 200);

function renderControls() {
  const isPlayer = myRole === 'w' || myRole === 'b';
  const playing = status === 'playing';
  document.getElementById('resignBtn').hidden = !(isPlayer && playing);
}

function renderMoves() {
  const list = document.getElementById('movesList');
  const counter = document.getElementById('moveCount');
  counter.textContent = moves.length ? `(${moves.length})` : '';
  if (!moves.length) {
    list.innerHTML = '<div class="moves-empty">ยังไม่มีการเดิน</div>';
    return;
  }
  list.innerHTML = '';
  for (let i = 0; i < moves.length; i += 2) {
    const num = (i / 2 + 1) + '.';
    const wMove = moves[i];
    const bMove = moves[i + 1];
    const row = document.createElement('div');
    row.className = 'move-row';
    row.innerHTML = `<span class="move-num">${num}</span><span class="move-w">${wMove.notation}</span><span class="move-b">${bMove ? bMove.notation : ''}</span>`;
    list.appendChild(row);
  }
  list.scrollTop = list.scrollHeight;
}

function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  if (!board) return;

  const symbols = getSymbols();
  const engine = getEngine();
  const inCheck = gameType === 'chess' && engine.isInCheck && engine.isInCheck(board, currentPlayer);
  const kingPos = inCheck ? engine.findKing(board, currentPlayer) : null;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const r = flipped ? 7 - i : i;
      const c = flipped ? 7 - j : j;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

      if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
      if (mustContinueFrom && mustContinueFrom.r === r && mustContinueFrom.c === c) sq.classList.add('selected');
      const vm = validMoves.find((m) => m.r === r && m.c === c);
      if (vm) sq.classList.add((vm.capture || vm.captured) ? 'valid-capture' : 'valid-move');
      if (kingPos && kingPos.r === r && kingPos.c === c) sq.classList.add('check');

      const piece = board[r][c];
      if (piece) {
        sq.textContent = symbols[piece] || '';
        sq.classList.add(engine.pieceColor(piece) === 'w' ? 'piece-w' : 'piece-b');
        if (gameType === 'checkers') sq.classList.add('checker-piece');
      }

      sq.onclick = () => handleClick(r, c);
      boardEl.appendChild(sq);
    }
  }
}

function handleClick(r, c) {
  if (status !== 'playing') return;
  if (myRole !== currentPlayer) return;

  const engine = getEngine();
  const piece = board[r][c];
  if (selected) {
    const vm = validMoves.find((m) => m.r === r && m.c === c);
    if (vm) {
      socket.emit('move', { from: { r: selected.r, c: selected.c }, to: { r, c } });
      if (!mustContinueFrom) { selected = null; validMoves = []; }
      render();
      return;
    }
    if (mustContinueFrom) return;
    if (piece && engine.pieceColor(piece) === myRole) {
      selected = { r, c };
      validMoves = legalMovesFor(r, c);
      render();
      return;
    }
    selected = null;
    validMoves = [];
    render();
    return;
  }
  if (piece && engine.pieceColor(piece) === myRole) {
    selected = { r, c };
    validMoves = legalMovesFor(r, c);
    render();
  }
}

function legalMovesFor(r, c) {
  const engine = getEngine();
  if (gameType === 'checkers') {
    return engine.getLegalMoves(board, r, c, currentPlayer, mustContinueFrom);
  }
  return engine.getLegalMoves(board, r, c);
}

document.getElementById('flipBtn').onclick = () => {
  flipped = !flipped;
  render();
};

function applyTheme(theme) {
  boardTheme = theme;
  localStorage.setItem('makruk_theme', theme);
  document.body.dataset.boardTheme = theme;
  document.querySelectorAll('#themeOptions .theme-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}
applyTheme(boardTheme);

document.querySelectorAll('#themeOptions .theme-btn').forEach((btn) => {
  btn.onclick = () => applyTheme(btn.dataset.theme);
});

document.getElementById('resetBtn').onclick = () => {
  if (myRole !== 'w' && myRole !== 'b') {
    showToast('เฉพาะผู้เล่นเท่านั้นที่เริ่มเกมใหม่ได้');
    return;
  }
  if (confirm('เริ่มเกมใหม่?')) socket.emit('reset_game');
};

document.getElementById('resignBtn').onclick = () => {
  if (confirm('ยอมแพ้เกมนี้?')) socket.emit('resign');
};

document.getElementById('shareBtn').onclick = async () => {
  const url = window.location.href;
  const gameLabel = gameType === 'checkers' ? 'หมากฮอส' : 'หมากรุก';
  const text = `มาดูวง${gameLabel}ไทยที่ ${url}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Playmakruk', text, url }); return; } catch (e) {}
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('คัดลอกลิงก์แล้ว — ส่งให้เพื่อนได้เลย');
  } catch (e) {
    showToast('คัดลอกไม่ได้ — ' + url);
  }
};

const soundBtn = document.getElementById('soundBtn');
function updateSoundBtn() {
  soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
  soundBtn.title = soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง';
}
updateSoundBtn();
soundBtn.onclick = () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('makruk_sound', soundEnabled ? 'on' : 'off');
  updateSoundBtn();
  if (soundEnabled) playSound('chat');
};

let audioCtx = null;
function playSound(type) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    if (type === 'move') {
      tone(ctx, now, 600, 0.08);
      tone(ctx, now + 0.05, 800, 0.08);
    } else if (type === 'chat') {
      tone(ctx, now, 880, 0.06);
    } else if (type === 'end') {
      tone(ctx, now, 523, 0.15);
      tone(ctx, now + 0.13, 659, 0.15);
      tone(ctx, now + 0.26, 784, 0.25);
    }
  } catch (e) {}
}
function tone(ctx, when, freq, dur) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.15, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur);
}

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
