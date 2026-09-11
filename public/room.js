const CHESS_SYMBOLS = {
  'wK': '♚', 'wQ': '♛', 'wB': '♝', 'wN': '♞', 'wR': '♜', 'wP': '♟',
  'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
};
const CHECKERS_SYMBOLS = {
  'wM': '⛂', 'wK': '⛃', 'bM': '⛂', 'bK': '⛃'
};
function getEngine() {
  if (gameType === 'checkers') return Checkers;
  if (gameType === 'checkers-intl') return CheckersIntl;
  if (gameType === 'chess-intl') return ChessIntl;
  if (gameType === 'connect4') return Connect4;
  return Chess;
}
function isCheckersGame() { return gameType === 'checkers' || gameType === 'checkers-intl'; }
function isConnect4Game() { return gameType === 'connect4'; }
function getSymbols() { return isCheckersGame() ? CHECKERS_SYMBOLS : CHESS_SYMBOLS; }

const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');
const initialPw = params.get('pw') || null;
if (!roomId) AppNavigation.go('/');

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,        // keep trying forever
  reconnectionDelay: 1000,               // start with 1s
  reconnectionDelayMax: 10000,           // cap at 10s between retries
  randomizationFactor: 0.3,
  timeout: 20000,                        // 20s to establish connection
  transports: ['websocket', 'polling'],
});
document.getElementById('langToggleBtn').onclick = () => I18N.toggleLang();
document.addEventListener('langchange', () => {
  document.getElementById('roomGameTypeLabel').textContent = I18N.t('game.' + gameType);
  updateRoleBadge();
  updateStatus();
  if (board) render();
  updatePlayerSlot('W', lastPlayers.w);
  updatePlayerSlot('B', lastPlayers.b);
  if (lastSiteStats) updateFooterStats();
  if (lastViewers !== null) updateViewersList(lastViewers, lastViewerCount);
  // Refresh chat count label
  const cc = document.getElementById('chatCount');
  if (cc && chatMsgCount > 0) cc.textContent = chatMsgCount + ' ' + I18N.t('chat.messages');
  // Refresh room name if default
  if (lastHasDefaultName) {
    const displayName = I18N.t('default.' + (gameType || 'chess'));
    const el = document.getElementById('roomName');
    if (el) el.textContent = displayName;
    document.title = displayName + ' — Playmakruk.com';
  }
  // Refresh chat history (system messages)
  refreshChatMessages();
});
let lastPlayers = { w: null, b: null };
let lastSiteStats = null;
let lastViewers = null;
let lastViewerCount = 0;
let lastRoomName = '';
let lastHasDefaultName = false;
let myRole = null;
let board = null;
let drawInfo=null, drawHasBot=false;
let currentPlayer = 'w';
let status = 'waiting';
let selected = null;
let validMoves = [];
let flipped = false;
let hasJoinedView = false;
let chatMsgCount = 0;
let gameType = 'chess';
let mustContinueFrom = null;
let chessCastling = null;
let chessEnPassant = null;
let timeBase = null;
let timeIncrement = 0;
let whiteTime = null;
let blackTime = null;
let runningSince = null;
let endedReason = null;
let endedWinner = null;
let moves = [];
let lastMoveCount = 0;
let winCells = null;          // connect4: winning 4-in-a-row cells to highlight
let c4AnimatedCount = 0;      // connect4: # of drops already animated (avoid re-animating on re-render)
let soundEnabled = localStorage.getItem('makruk_sound') !== 'off';
let boardTheme = localStorage.getItem('makruk_theme') || 'wood';
// Each newly opened board starts with the 3D studio pieces. The picker can
// still change the appearance for the current game.
let pieceSet = 'studio';

// Persistent UID so slot reclaim works even for anonymous users across reconnects
let userUid = localStorage.getItem('makruk_uid');
if (!userUid) {
  userUid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('makruk_uid', userUid);
}
const userName = localStorage.getItem('makruk_name') || '';
let currentDisplayName = userName;
// Last password that reached the server — reused on reconnect (so a player
// who typed it in the prompt isn't re-asked) and for building share links
let knownPw = initialPw;
let roomIsPrivate = false;
// Send identity + join_room. On reconnect, do the same so the new server
// socket knows our UID/name and we get placed back in our slot.
let isFirstConnect = true;
socket.on('connect', () => {
  socket.emit('set_uid', userUid);
  if (userName) socket.emit('set_name', userName);
  if (!isFirstConnect) {
    // reconnection — re-emit join_room so server reclaims our slot
    socket.emit('join_room', { roomId, password: knownPw });
  }
  isFirstConnect = false;
});
// Initial emit (Socket.IO queues until first connect; ordering preserved)
socket.emit('set_uid', userUid);
if (userName) socket.emit('set_name', userName);
socket.emit('join_room', { roomId, password: knownPw });

socket.on('password_required', ({ name }) => {
  const pw = prompt(`"${name}" ${I18N.t('prompt.privatePass')}`);
  if (!pw) { AppNavigation.go('/'); return; }
  knownPw = pw;
  socket.emit('join_room', { roomId, password: pw });
});

// Room no longer exists (expired / server lost it) — explain, then go home
socket.on('room_not_found', () => {
  showToast(I18N.t('err.notFoundRedirect'));
  setTimeout(() => { AppNavigation.go('/'); }, 3000);
});

socket.on('joined', ({ role, name }) => {
  myRole = role;
  currentDisplayName = typeof name === 'string' ? name : userName;
  if (!hasJoinedView) { flipped = role === 'b'; hasJoinedView = true; }
  applyCamera();
  updateRoleBadge();
});

socket.on('room_state', (state) => {
  lastRoomName = state.name;
  lastHasDefaultName = !!state.hasDefaultName;
  roomIsPrivate = !!state.isPrivate;
  const displayName = state.hasDefaultName ? I18N.t('default.' + (state.gameType || 'chess')) : state.name;
  document.getElementById('roomName').textContent = displayName;
  document.title = displayName + ' — Playmakruk.com';
  const prevStatus = status;
  gameType = state.gameType || 'chess';
  const labelEl = document.getElementById('roomGameTypeLabel');
  if (labelEl) labelEl.textContent = I18N.t('game.' + gameType);
  document.querySelectorAll('.rule-list').forEach((el) => {
    el.hidden = !el.classList.contains('rl-' + gameType);
  });
  const piecePicker = document.getElementById('piecePicker');
  if (piecePicker) piecePicker.hidden = isConnect4Game();
  refreshPiecePreviews();
  // Connect Four keeps its gravity orientation and fixed discs; the table material is selectable.
  const flipBtn = document.getElementById('flipBtn');
  if (flipBtn) flipBtn.hidden = isConnect4Game();
  const themePicker = document.querySelector('.theme-picker:not(.piece-picker)');
  if (themePicker) themePicker.hidden = false;
  const boardWrapper = document.getElementById('boardWrapper');
  if (boardWrapper) boardWrapper.classList.toggle('connect4', isConnect4Game());
  document.getElementById('boardCamera').hidden = isConnect4Game();
  applyCamera();
  // Tag players-bar so avatars switch to yellow/red for Connect 4
  const playersBar = document.querySelector('.players-bar');
  if (playersBar) playersBar.classList.toggle('connect4', isConnect4Game());
  // Move history makes less sense for Connect 4 (just "a1, b2..." column drops)
  const moveHistory = document.getElementById('moveHistory');
  if (moveHistory) moveHistory.hidden = isConnect4Game();
  // Rules summary label: "กฎการเดินหมาก" → "กฎ Connect Four"
  const rulesSummary = document.querySelector('details.rules > summary');
  if (rulesSummary) rulesSummary.textContent = isConnect4Game()
    ? I18N.t('c4.rules.summary')
    : I18N.t('rules.summary');
  board = state.board;
  currentPlayer = state.currentPlayer;
  status = state.status;
  mustContinueFrom = state.mustContinueFrom || null;
  chessCastling = state.castling || null;
  chessEnPassant = state.enPassant || null;
  timeBase = state.timeBase;
  timeIncrement = state.timeIncrement || 0;
  whiteTime = state.whiteTime;
  blackTime = state.blackTime;
  runningSince = state.runningSince;
  endedReason = state.endedReason;
  endedWinner = state.endedWinner;
  winCells = state.winCells || null;
  moves = state.moves || [];
  drawInfo = state.draw || null;
  drawHasBot=!!state.hasBot;
  renderDrawControls();

  if (moves.length > lastMoveCount && prevStatus === 'playing') {
    const lastMove = moves[moves.length - 1];
    playSound(lastMove && lastMove.capture ? 'capture' : 'move');
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

  lastPlayers = state.players;
  updatePlayerSlot('W', state.players.w);
  updatePlayerSlot('B', state.players.b);

  document.getElementById('playerW').classList.toggle('active', currentPlayer === 'w' && status === 'playing');
  document.getElementById('playerB').classList.toggle('active', currentPlayer === 'b' && status === 'playing');

  updateViewersList(state.viewers || [], state.viewerCount);

  updateRoleBadge();
  updateStatus();
  render();
});

function updateViewersList(viewers, count) {
  lastViewers = viewers;
  lastViewerCount = count;
  const list = document.getElementById('viewersList');
  document.getElementById('viewersTitle').textContent = `${I18N.t('viewers.title')} (${count})`;
  if (!viewers.length) {
    list.innerHTML = `<div class="viewers-empty">${I18N.t('viewers.empty')}</div>`;
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
  if (!slot) return;
  const avatarEl = document.getElementById('avatar' + side);
  const nameEl = slot.querySelector('.player-name');
  if (player) {
    if (player.isBot) {
      avatarEl.textContent = '🤖';
      avatarEl.classList.add('bot-avatar');
      avatarEl.classList.remove('empty');
      nameEl.textContent = player.botDifficulty ? I18N.t('bot.name.' + player.botDifficulty) : '🤖 Bot';
    } else {
      avatarEl.textContent = (player.name || '?').slice(0, 2).toUpperCase();
      avatarEl.classList.remove('bot-avatar');
      avatarEl.classList.remove('empty');
      nameEl.textContent = player.name;
    }
    nameEl.classList.remove('empty');
  } else {
    avatarEl.textContent = '?';
    avatarEl.classList.add('empty');
    avatarEl.classList.remove('bot-avatar');
    nameEl.textContent = I18N.t('player.waiting');
    nameEl.classList.add('empty');
  }
}

socket.on('chat_history', (msgs) => {
  const c = document.getElementById('chatMessages');
  c.innerHTML = '';
  chatMsgCount = 0;
  msgs.forEach((m) => appendChat(m));
  scrollChatToEnd();
});

socket.on('chat_message', (msg) => {
  appendChat(msg);
  if (msg.type === 'chat' && msg.user !== userName) playSound('chat');
});

const ERR_MAP = {
  'ยังไม่ถึงตาคุณ': 'err.notYourTurn',
  'ตำแหน่งไม่ถูกต้อง': 'err.invalidPos',
  'หมากไม่ถูกต้อง': 'err.invalidPiece',
  'เดินไม่ได้': 'err.cantMove',
  'ไม่พบห้องนี้': 'err.notFound',
};
socket.on('error_msg', (msg) => {
  const key = ERR_MAP[msg];
  showToast(key ? I18N.t(key) : msg);
});

socket.on('reaction', ({ emoji }) => {
  spawnFloatingReaction(emoji);
});

function updateFooterStats() {
  const footer = document.getElementById('footerStats');
  if (!footer || !lastSiteStats) return;
  const lang = I18N.getLang();
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const v = lastSiteStats.totalVisits.toLocaleString(locale);
  const o = lastSiteStats.onlineUsers.toLocaleString(locale);
  footer.innerHTML = `© 2026 Playmakruk.com — ${I18N.t('footer.visits')} <strong>${v}</strong> ${I18N.t('footer.times')} • ${I18N.t('footer.online')} <strong>${o}</strong> ${I18N.t('footer.people')}`;
}
socket.on('site_stats', ({ totalVisits, onlineUsers }) => {
  lastSiteStats = { totalVisits, onlineUsers };
  updateFooterStats();
});

// ============ Server status banner (graceful shutdown / reconnect) ============
function ensureServerBanner() {
  let el = document.getElementById('serverBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'serverBanner';
    document.body.appendChild(el);
  }
  return el;
}
function showBanner(text, kind, autoHideMs) {
  const el = ensureServerBanner();
  el.className = '';
  el.classList.add(kind || 'info');
  el.classList.add('show');
  el.textContent = text;
  if (autoHideMs) setTimeout(() => el.classList.remove('show'), autoHideMs);
}
function hideBanner() {
  const el = document.getElementById('serverBanner');
  if (el) el.classList.remove('show');
}

let restartCountdownTimer = null;
socket.on('server_restart', ({ in_seconds }) => {
  let remaining = in_seconds || 8;
  if (restartCountdownTimer) clearInterval(restartCountdownTimer);
  showBanner(I18N.t('sys.restart.warn').replace('{sec}', remaining), 'warn');
  restartCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(restartCountdownTimer);
      restartCountdownTimer = null;
      return;
    }
    showBanner(I18N.t('sys.restart.warn').replace('{sec}', remaining), 'warn');
  }, 1000);
});

let wasConnected = true;
socket.on('disconnect', () => {
  wasConnected = false;
  showBanner(I18N.t('sys.disconnect'), 'warn');
});
let justReconnected = false;
socket.on('connect', () => {
  if (!wasConnected) {
    wasConnected = true;
    justReconnected = true;
    setTimeout(() => { justReconnected = false; }, 5000);
    showBanner(I18N.t('sys.reconnected'), 'ok', 2500);
  }
});

// If room is gone after reconnect (server restarted, in-memory rooms lost), redirect to lobby
socket.on('error_msg', (msg) => {
  if (justReconnected && msg === 'ไม่พบห้องนี้') {
    showBanner(I18N.t('sys.room_expired'), 'warn');
    setTimeout(() => { AppNavigation.go('/'); }, 2500);
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
  if (isConnect4Game()) {
    if (myRole === 'w') { badge.textContent = I18N.t('c4.role.y'); badge.className = 'role-badge connect4 w'; }
    else if (myRole === 'b') { badge.textContent = I18N.t('c4.role.r'); badge.className = 'role-badge connect4 b'; }
    else if (myRole === 'viewer') { badge.textContent = I18N.t('role.viewer'); badge.className = 'role-badge viewer'; }
    else { badge.textContent = I18N.t('role.connecting'); badge.className = 'role-badge'; }
    return;
  }
  if (myRole === 'w') { badge.textContent = I18N.t('role.w'); badge.className = 'role-badge w'; }
  else if (myRole === 'b') { badge.textContent = I18N.t('role.b'); badge.className = 'role-badge b'; }
  else if (myRole === 'viewer') { badge.textContent = I18N.t('role.viewer'); badge.className = 'role-badge viewer'; }
  else { badge.textContent = I18N.t('role.connecting'); badge.className = 'role-badge'; }
}

function updateStatus() {
  const el = document.getElementById('status');
  el.className = 'status-pill';
  const lang = I18N.getLang();
  if(status==='ended'&&endedWinner===null&&endedReason!=='draw'&&endedReason!=='stalemate'){el.textContent='🤝 '+I18N.t('draw.'+endedReason);return;}
  if (isConnect4Game()) {
    const cSide = (c) => I18N.t(c === 'w' ? 'c4.side.y' : 'c4.side.r');
    if (status === 'waiting') {
      el.textContent = I18N.t('status.waiting');
      el.classList.add('waiting');
    } else if (status === 'ended') {
      const w = cSide(endedWinner);
      if (endedReason === 'draw') el.textContent = lang === 'th' ? '🤝 เสมอ (กระดานเต็ม)' : '🤝 Draw (board full)';
      else if (endedReason === 'resign') el.textContent = lang === 'th' ? `🏳 ${w} ชนะ (อีกฝ่ายยอมแพ้)` : `🏳 ${w} wins (opponent resigned)`;
      else if (endedReason === 'timeout') el.textContent = lang === 'th' ? `⏰ ${w} ชนะ (หมดเวลา)` : `⏰ ${w} wins (timeout)`;
      else el.textContent = I18N.t('c4.win').replace('{side}', w);
    } else {
      el.textContent = I18N.t(currentPlayer === 'w' ? 'c4.turnY' : 'c4.turnR');
      el.classList.add('playing');
    }
    return;
  }
  const sideName = (c) => c === 'w' ? (lang === 'th' ? 'ฝ่ายขาว' : 'White') : (lang === 'th' ? 'ฝ่ายดำ' : 'Black');
  if (status === 'waiting') {
    el.textContent = I18N.t('status.waiting');
    el.classList.add('waiting');
  } else if (status === 'ended') {
    const w = sideName(endedWinner);
    let label = I18N.t('status.ended');
    if (endedReason === 'checkmate') label = lang === 'th' ? `🏆 ${w} ชนะ (รุกจน)` : `🏆 ${w} wins (checkmate)`;
    else if (endedReason === 'resign') label = lang === 'th' ? `🏳 ${w} ชนะ (อีกฝ่ายยอมแพ้)` : `🏳 ${w} wins (opponent resigned)`;
    else if (endedReason === 'timeout') label = lang === 'th' ? `⏰ ${w} ชนะ (อีกฝ่ายหมดเวลา)` : `⏰ ${w} wins (opponent timed out)`;
    else if (endedReason === 'no_pieces') label = lang === 'th' ? `🏆 ${w} ชนะ — เก็บหมากหมด!` : `🏆 ${w} wins — captured all pieces!`;
    else if (endedReason === 'no_moves') label = lang === 'th' ? `🏆 ${w} ชนะ — อีกฝ่ายเดินไม่ได้` : `🏆 ${w} wins — opponent has no moves`;
    else if (endedReason === 'stalemate') label = lang === 'th' ? '🤝 เสมอ (อับ)' : '🤝 Draw (stalemate)';
    el.textContent = label;
  } else {
    const turnText = currentPlayer === 'w' ? I18N.t('status.turnW') : I18N.t('status.turnB');
    if (mustContinueFrom && currentPlayer === myRole) {
      el.textContent = `${turnText} • ${I18N.t('status.continue')}`;
      el.classList.add('check');
    } else if (!isCheckersGame() && getEngine().isInCheck && getEngine().isInCheck(board, currentPlayer)) {
      el.textContent = `${turnText} • ${I18N.t('status.check')}`;
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
  if (isConnect4Game()) { renderConnect4(); return; }
  const boardEl = document.getElementById('board');
  boardEl.className = 'board';
  boardEl.innerHTML = '';
  if (!board) return;

  const symbols = getSymbols();
  const engine = getEngine();
  const inCheck = !isCheckersGame() && engine.isInCheck && engine.isInCheck(board, currentPlayer);
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

      const last = moves[moves.length - 1];
      if (last && [last.from, last.to].some(pos => pos && pos.r === r && pos.c === c)) sq.classList.add('last-move');
      const piece = board[r][c];
      if (piece) {
        sq.innerHTML = Pieces.renderPiece(piece, gameType, pieceSet);
        sq.classList.add(engine.pieceColor(piece) === 'w' ? 'piece-w' : 'piece-b');
        if (isCheckersGame()) sq.classList.add('checker-piece');
        else sq.classList.add('piece-set-' + pieceSet);
      }

      if (i === 7) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'sq-label sq-label-file';
        fileLabel.textContent = 'abcdefgh'[c];
        sq.appendChild(fileLabel);
      }
      if (j === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'sq-label sq-label-rank';
        rankLabel.textContent = String(8 - r);
        sq.appendChild(rankLabel);
      }

      sq.setAttribute('role', 'button');
      sq.setAttribute('aria-label', 'abcdefgh'[c] + (8-r) + (piece ? ' · ' + (gameType === 'chess' ? Pieces.THAI_LETTERS[piece[1]] : piece[1]) + ' · ' + I18N.t('side.short.' + piece[0]) : ''));
      sq.tabIndex = i === 7 && j === 0 ? 0 : -1;
      sq.dataset.row = i; sq.dataset.col = j;
      sq.onclick = () => handleClick(r, c);
      sq.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(r,c); const replacement = boardEl.querySelector(`[data-row="${i}"][data-col="${j}"]`); if(replacement){replacement.tabIndex=0;replacement.focus();} return; }
        const delta = {ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
        if (!delta) return; e.preventDefault();
        const next = boardEl.querySelector(`[data-row="${Math.max(0,Math.min(7,i+delta[0]))}"][data-col="${Math.max(0,Math.min(7,j+delta[1]))}"]`);
        if(next){boardEl.querySelectorAll('.square').forEach(el=>el.tabIndex=-1);next.tabIndex=0;next.focus();}
      };
      boardEl.appendChild(sq);
    }
  }
}

// ============ Connect Four rendering ============
function renderConnect4() {
  const boardEl = document.getElementById('board');
  boardEl.className = 'board connect4';
  boardEl.innerHTML = '';
  if (!board) return;
  const ROWS = Connect4.ROWS, COLS = Connect4.COLS;
  const myTurn = status === 'playing' && myRole === currentPlayer;

  // Animate only the newest drop, and only once (re-renders from lang/theme must not re-trigger).
  let animateCell = null;
  if (moves.length > c4AnimatedCount) {
    const lm = moves[moves.length - 1];
    if (lm && lm.to) animateCell = { r: lm.to.r, c: lm.to.c };
  }
  c4AnimatedCount = moves.length;

  const winSet = new Set((winCells || []).map((w) => w.r + ',' + w.c));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'c4-cell';
      cell.dataset.col = c;
      const piece = board[r][c];
      if (piece) {
        const coin = document.createElement('div');
        coin.className = 'c4-coin ' + (piece === 'Y' ? 'coin-y' : 'coin-r');
        if (winSet.has(r + ',' + c)) coin.classList.add('win');
        if (animateCell && animateCell.r === r && animateCell.c === c) {
          coin.classList.add('dropping');
          coin.style.setProperty('--drop-rows', String(r + 1));
        }
        cell.appendChild(coin);
      }
      cell.onclick = () => dropColumn(c);
      cell.onmouseenter = () => hoverColumn(c, true);
      cell.onmouseleave = () => hoverColumn(c, false);
      boardEl.appendChild(cell);
    }
  }
  boardEl.classList.toggle('my-turn', myTurn);
}

function hoverColumn(col, on) {
  if (!isConnect4Game()) return;
  const boardEl = document.getElementById('board');
  const myTurn = status === 'playing' && myRole === currentPlayer;
  boardEl.querySelectorAll('.c4-cell[data-col="' + col + '"]').forEach((el) => {
    el.classList.toggle('col-hover', on && myTurn);
  });
  boardEl.querySelectorAll('.c4-ghost').forEach((g) => g.remove());
  if (on && myTurn) {
    const landing = Connect4.findLandingRow(board, col);
    if (landing >= 0) {
      const cell = boardEl.children[landing * Connect4.COLS + col];
      if (cell && !cell.querySelector('.c4-coin')) {
        const ghost = document.createElement('div');
        ghost.className = 'c4-ghost ' + (currentPlayer === 'w' ? 'coin-y' : 'coin-r');
        cell.appendChild(ghost);
      }
    }
  }
}

function dropColumn(col) {
  if (!isConnect4Game()) return;
  if (!socket.connected) { showToast(I18N.t('ui.connectError')); return; }
  if (status !== 'playing' || myRole !== currentPlayer) return;
  if (Connect4.findLandingRow(board, col) < 0) return; // column full
  socket.emit('move', { col });
}

function handleClick(r, c) {
  if (!socket.connected) { showToast(I18N.t('ui.connectError')); return; }
  if (status !== 'playing') return;
  if (myRole !== currentPlayer) return;

  const engine = getEngine();
  const piece = board[r][c];
  if (selected) {
    const vm = validMoves.find((m) => m.r === r && m.c === c);
    if (vm) {
      const from={r:selected.r,c:selected.c},to={r,c};
      if (gameType==='chess-intl'&&board[from.r][from.c]?.[1]==='P'&&(r===0||r===7)) {
        choosePromotion(from,to);return;
      }
      submitMove(from,to);
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

function submitMove(from,to,promotion) {
  socket.emit('move',{from,to,promotion,claimDraw:document.getElementById('claimNextMove').checked});
}
function choosePromotion(from,to){
  if(document.getElementById('promotionDialog'))return;
  const th=I18N.getLang()==='th',dialog=document.createElement('dialog');dialog.id='promotionDialog';dialog.className='studio-dialog';
  dialog.innerHTML=`<button class="ghost dialog-close" aria-label="${th?'ยกเลิก':'Cancel'}">✕</button><h2>${th?'เลื่อนเบี้ยเป็นตัวไหน?':'Promote to which piece?'}</h2><p>${th?'เลือกตัวหมากเพื่อเดินตานี้ให้สมบูรณ์':'Choose a piece to complete your move'}</p><div class="dialog-options"></div>`;
  for(const [type,thName,enName] of [['Q','ควีน','Queen'],['R','เรือ','Rook'],['B','บิชอป','Bishop'],['N','ม้า','Knight']]){
    const button=document.createElement('button');button.type='button';button.dataset.promotion=type;button.innerHTML=Pieces.renderPiece(myRole+type,'chess-intl','classic')+`<span>${th?thName:enName}</span>`;
    button.onclick=()=>{submitMove(from,to,type);selected=null;validMoves=[];dialog.close();render();};dialog.querySelector('.dialog-options').append(button);
  }
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
function drawAction(action){if(socket.connected)socket.emit('draw_action',{action});}
document.getElementById('claimDrawBtn').onclick=()=>drawAction('claim');
document.getElementById('offerDrawBtn').onclick=()=>drawAction('offer');
document.getElementById('countDrawBtn').onclick=()=>drawAction('count');
document.getElementById('stopCountBtn').onclick=()=>drawAction('stop_count');
document.getElementById('acceptDrawBtn').onclick=()=>drawAction('accept');
document.getElementById('declineDrawBtn').onclick=()=>drawAction('decline');
function renderDrawControls(){
  const th=I18N.getLang()==='th',player=['w','b'].includes(myRole),active=status==='playing',mine=currentPlayer===myRole;
  document.getElementById('drawControls').hidden=!player||!active;
  if(!active)document.getElementById('promotionDialog')?.close();
  const button=document.getElementById('claimDrawBtn');button.textContent=th?'ขอเสมอตามกติกา':'Claim draw';button.hidden=isConnect4Game();button.disabled=!mine||!drawInfo?.claim;
  const offer=document.getElementById('offerDrawBtn');offer.textContent=th?'เสนอเสมอ':'Offer draw';offer.hidden=drawHasBot;offer.disabled=!!drawInfo?.offer;
  const incoming=drawInfo?.offer&&drawInfo.offer!==myRole;
  document.getElementById('drawOffer').hidden=!drawInfo?.offer;document.getElementById('drawOfferText').textContent=incoming?(th?'อีกฝ่ายขอเสมอ':'Opponent offers a draw'):(th?'ส่งคำขอเสมอแล้ว':'Draw offered');
  for(const [id,label,en] of [['acceptDrawBtn','ตกลง','Accept'],['declineDrawBtn','เล่นต่อ','Decline']]){const b=document.getElementById(id);b.hidden=!incoming;b.textContent=th?label:en;}
  const count=drawInfo?.count,eligible=drawInfo?.canCount?.[myRole];
  const countButton=document.getElementById('countDrawBtn');countButton.hidden=!eligible||(count?.side===myRole&&count.type===eligible.type);countButton.disabled=!mine||!!mustContinueFrom;countButton.textContent=count?.type==='board'&&eligible?.type==='pieces'?(th?'เปลี่ยนเป็นนับศักดิ์หมาก':'Switch to piece count'):(th?'เริ่มนับศักดิ์':'Start counting');
  const stop=document.getElementById('stopCountBtn');stop.hidden=count?.side!==myRole;stop.textContent=th?'หยุดนับ':'Stop counting';
  document.getElementById('drawCountStatus').textContent=count?(th?`นับศักดิ์${count.type==='pieces'?'หมาก':'กระดาน'} ${count.value} / ${count.limit} · ฝ่าย${count.side==='w'?'ขาว':'ดำ'}`:`${count.type} count ${count.value} / ${count.limit} · ${count.side==='w'?'White':'Black'}`):drawInfo?.claim?I18N.t('draw.'+drawInfo.claim):'';
  document.getElementById('claimNextLabel').hidden=!['chess-intl','checkers-intl','checkers'].includes(gameType);document.getElementById('claimNextText').textContent=th?'ขอเสมอถ้าตาถัดไปทำให้ครบเกณฑ์':'Claim a draw if my next move qualifies';
}
function legalMovesFor(r, c) {
  const engine = getEngine();
  if (isCheckersGame()) {
    return engine.getLegalMoves(board, r, c, currentPlayer, mustContinueFrom);
  }
  if (gameType === 'chess-intl') {
    return engine.getLegalMoves(board, r, c, { castling: chessCastling, enPassant: chessEnPassant });
  }
  return engine.getLegalMoves(board, r, c);
}

document.getElementById('flipBtn').onclick = () => {
  flipped = !flipped;
  cameraRotation = 0; applyCamera();
  render();
};

let cameraTilt = 24;
let cameraRotation = 0;
function applyCamera() {
  cameraTilt = Math.max(0, Math.min(45, Number.isFinite(cameraTilt) ? cameraTilt : 24));
  cameraRotation = Math.max(-180, Math.min(180, Number.isFinite(cameraRotation) ? cameraRotation : 0));
  const tilt = isConnect4Game() ? 0 : cameraTilt;
  const angle = isConnect4Game() ? 0 : cameraRotation;
  const radians = angle * Math.PI / 180;
  const scale = (tilt ? .93 : 1) / (Math.abs(Math.sin(radians)) + Math.abs(Math.cos(radians)));
  const stage = document.getElementById('boardStage');
  stage.style.setProperty('--stage-ratio', isConnect4Game() ? .92 : tilt ? Math.cos(tilt*Math.PI/180)*.93+.11 : 1.04);
  stage.style.setProperty('--camera-tilt', tilt+'deg');stage.style.setProperty('--camera-rotation', angle+'deg');stage.style.setProperty('--camera-scale', scale);
  document.getElementById('cameraTilt').value=cameraTilt;document.getElementById('cameraRotation').value=cameraRotation;
  document.getElementById('cameraTiltValue').value=cameraTilt+'°';document.getElementById('cameraRotationValue').value=cameraRotation+'°';
  document.getElementById('cameraTop').setAttribute('aria-pressed', String(!tilt));document.getElementById('camera3D').setAttribute('aria-pressed', String(tilt>0));
  document.getElementById('cameraMine').setAttribute('aria-pressed',String(flipped === (myRole==='b')));document.getElementById('cameraOpponent').setAttribute('aria-pressed',String(flipped !== (myRole==='b')));
  localStorage.setItem('makruk_camera_tilt',cameraTilt);localStorage.setItem('makruk_camera_rotation',cameraRotation);
}
document.getElementById('cameraTilt').oninput=e=>{cameraTilt=Number(e.target.value);applyCamera();};
document.getElementById('cameraRotation').oninput=e=>{cameraRotation=Number(e.target.value);applyCamera();};
document.getElementById('camera3D').onclick=()=>{cameraTilt=30;cameraRotation=-10;applyCamera();};
document.getElementById('cameraTop').onclick=()=>{cameraTilt=0;cameraRotation=0;applyCamera();};
document.getElementById('cameraMine').onclick=()=>{flipped=myRole==='b';cameraRotation=0;applyCamera();render();};
document.getElementById('cameraOpponent').onclick=()=>{flipped=myRole!=='b';cameraRotation=0;applyCamera();render();};
applyCamera();

function closePicker(button) {
  const details=button.closest('details'); details.open=false; details.querySelector('summary').focus();
}
function refreshPiecePreviews() {
  document.querySelectorAll('#pieceOptions button').forEach(button=>{
    button.querySelector('.ps-preview').innerHTML=Pieces.renderPiece('wK',gameType,button.dataset.pieceset);
  });
}
document.querySelectorAll('.theme-picker,.sound-settings').forEach(details=>{
  details.addEventListener('toggle',()=>{if(details.open)document.querySelectorAll('.theme-picker,.sound-settings').forEach(other=>{if(other!==details)other.open=false;});});
  details.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;details.querySelector('summary').focus();}});
});
function applyTheme(theme) {
  boardTheme = theme;
  localStorage.setItem('makruk_theme', theme);
  document.body.dataset.boardTheme = theme;
  document.querySelectorAll('#themeOptions .theme-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.theme === theme); b.setAttribute('aria-pressed',String(b.dataset.theme===theme));
  });
}
applyTheme(boardTheme);

document.querySelectorAll('#themeOptions .theme-btn').forEach((btn) => {
  btn.onclick = () => { applyTheme(btn.dataset.theme); closePicker(btn); playSound('move'); };
});

function applyPieceSet(set) {
  pieceSet = set;
  localStorage.setItem('makruk_pieceset', set);
  document.querySelectorAll('#pieceOptions .theme-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.pieceset === set); b.setAttribute('aria-pressed',String(b.dataset.pieceset===set));
  });
  if (board) render();
}
applyPieceSet(pieceSet);
refreshPiecePreviews();

document.querySelectorAll('#pieceOptions .theme-btn').forEach((btn) => {
  btn.onclick = () => { applyPieceSet(btn.dataset.pieceset); closePicker(btn); };
});

document.getElementById('resetBtn').onclick = () => {
  if (myRole !== 'w' && myRole !== 'b') {
    showToast(I18N.t('err.playerOnly'));
    return;
  }
  if (!socket.connected) { showToast(I18N.t('ui.connectError')); return; }
  if (confirm(I18N.t('confirm.reset'))) socket.emit('reset_game');
};

document.getElementById('resignBtn').onclick = () => {
  if (!socket.connected) { showToast(I18N.t('ui.connectError')); return; }
  if (confirm(I18N.t('confirm.resign'))) socket.emit('resign');
};

document.getElementById('shareBtn').onclick = () => {
  const th=I18N.getLang()==='th';
  const urls=ShareLinks.links(location.origin,roomId,roomIsPrivate,knownPw);
  const dialog=document.createElement('dialog');dialog.className='studio-dialog';
  dialog.innerHTML=`<button type="button" class="ghost dialog-close" aria-label="${th?'ปิด':'Close'}">✕</button><h2>${th?'ชวนเพื่อนมาเล่น':'Invite a friend'}</h2><p>${th?'เลือกหน้าที่อยากให้เพื่อนเปิด':'Choose where your friend will arrive'}</p><button class="share-choice" data-destination="room"><strong>${th?'↗ ชวนเข้าวงนี้':'↗ Invite to this room'}</strong><span>${th?'เปิดวงที่คุณกำลังเล่นหรือดูอยู่':'Open the game you are playing or watching'}</span></button><button class="share-choice" data-destination="website"><strong>${th?'⌂ แชร์หน้าเว็บไซต์':'⌂ Share the website'}</strong><span>${th?'เปิดหน้าแรก ให้เพื่อนเลือกเกมและวงเอง':'Open the lobby to choose a game or room'}</span></button><label for="shareUrl">${th?'ลิงก์ที่จะส่ง':'Link to share'}</label><input id="shareUrl" class="share-url" readonly><p id="shareExplanation"></p><div class="dialog-actions"><button id="copyShareLink" class="ghost">${th?'คัดลอกลิงก์':'Copy link'}</button> <button id="nativeShareLink">${th?'แชร์ให้เพื่อน':'Share with a friend'}</button></div><p id="shareResult" role="status"></p>`;
  document.body.append(dialog);let destination='room';
  function choose(value){destination=value;dialog.querySelector('#shareUrl').value=urls[value];dialog.querySelectorAll('[data-destination]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.destination===value)));dialog.querySelector('#shareExplanation').textContent=value==='website'?(th?'เพื่อนจะเปิดหน้าแรกของ Playmakruk':'Your friend will open the Playmakruk lobby'):roomIsPrivate?(th?'วงส่วนตัว · ลิงก์นี้มีรหัสเข้าวง ส่งให้เพื่อนที่ต้องการชวนเท่านั้น':'Private room · this link includes the room password'):(th?'เพื่อนเข้ามาดูได้ และเลือกนั่งเล่นเมื่อมีที่ว่าง':'Friends can watch, or take a seat when one is available');dialog.querySelector('#shareResult').textContent='';}
  dialog.querySelectorAll('[data-destination]').forEach(button=>button.onclick=()=>choose(button.dataset.destination));
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
  async function copy(){try{await navigator.clipboard.writeText(urls[destination]);dialog.querySelector('#shareResult').textContent=th?'คัดลอกแล้ว':'Copied';}catch{dialog.querySelector('#shareUrl').select();dialog.querySelector('#shareResult').textContent=th?'เลือกลิงก์ไว้แล้ว กดคัดลอกได้เลย':'Select and copy the link above';}}
  dialog.querySelector('#copyShareLink').onclick=copy;
  dialog.querySelector('#nativeShareLink').onclick=async()=>{try{const result=await ShareLinks.send(navigator,{title:'Playmakruk',text:destination==='room'?(th?'มาเล่นด้วยกันที่วงนี้':'Join me at this table'):(th?'แวะมาเล่นหมากด้วยกัน':'Play a board game with me'),url:urls[destination]});if(result!=='cancelled')dialog.querySelector('#shareResult').textContent=result==='copied'?(th?'คัดลอกแล้ว':'Copied'):(th?'แชร์แล้ว':'Shared');}catch{await copy();}};
  choose('room');dialog.showModal();
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

const sfxVolume=document.getElementById('sfxVolume');
sfxVolume.value=window.GameAudio?.volume()??.65;
function updateSfxVolume(){document.getElementById('sfxVolumeValue').value=Math.round(Number(sfxVolume.value)*100)+'%';document.getElementById('sfxDown').setAttribute('aria-label',I18N.getLang()==='th'?'ลดเสียงเดินหมาก':'Lower game sound');document.getElementById('sfxUp').setAttribute('aria-label',I18N.getLang()==='th'?'เพิ่มเสียงเดินหมาก':'Raise game sound');}
updateSfxVolume();
function setSfxVolume(value){sfxVolume.value=Math.max(0,Math.min(1,value));window.GameAudio?.setVolume(Number(sfxVolume.value));soundEnabled=true;localStorage.setItem('makruk_sound','on');updateSoundBtn();updateSfxVolume();document.getElementById('sfxStatus').hidden=true;window.GameAudio?.unlock();}
sfxVolume.oninput=()=>setSfxVolume(Number(sfxVolume.value));
sfxVolume.onchange=()=>{setSfxVolume(Number(sfxVolume.value));playSound('move');};
document.getElementById('sfxDown').onclick=()=>{setSfxVolume(Number(sfxVolume.value)-.1);playSound('move');};
document.getElementById('sfxUp').onclick=()=>{setSfxVolume(Number(sfxVolume.value)+.1);playSound('move');};
let sfxStatusTimer;
document.getElementById('sfxPreview').onclick=async()=>{
  const message=document.getElementById('sfxStatus'),th=I18N.getLang()==='th';clearTimeout(sfxStatusTimer);message.hidden=false;
  if(Number(sfxVolume.value)===0){message.textContent=th?'ระดับเสียงเป็น 0% กด + เพื่อเพิ่มเสียง':'Volume is 0%. Press + to raise it.';return;}
  soundEnabled=true;localStorage.setItem('makruk_sound','on');updateSoundBtn();window.GameAudio?.setVolume(Number(sfxVolume.value));
  message.textContent=th?'กำลังเปิดเสียง…':'Starting audio…';
  const played=await playSound('move');
  message.textContent=played?(th?'เล่นเสียงตัวอย่างแล้ว':'Preview played'):(th?'ยังเปิดเสียงไม่ได้ ลองแตะปุ่มลองฟังอีกครั้ง':'Audio could not start. Tap Preview again.');
  if(played)sfxStatusTimer=setTimeout(()=>{message.hidden=true;},1400);
};
function playSound(type) {
  if(soundEnabled)return window.GameAudio?.play(type,{gameType,theme:boardTheme});
  return Promise.resolve(false);
}
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
chatForm.onsubmit = (e) => {
  e.preventDefault();
  const t = chatInput.value.trim();
  if (!t) return;
  if (!socket.connected) { showToast(I18N.t('ui.connectError')); return; }
  socket.emit('chat', t);
  chatInput.value = '';
  chatInput.style.height = '';
  scrollChatToEnd();
};

chatInput.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){e.preventDefault();chatForm.requestSubmit();}
});
chatInput.addEventListener('input',()=>{chatInput.style.height='auto';chatInput.style.height=Math.min(chatInput.scrollHeight,110)+'px';});
const chatNew = document.getElementById('chatNewMessages');
function scrollChatToEnd(){const c=document.getElementById('chatMessages');c.scrollTop=c.scrollHeight;chatNew.hidden=true;}
chatNew.onclick=scrollChatToEnd;
document.getElementById('chatMessages').addEventListener('scroll',e=>{const c=e.target;if(c.scrollHeight-c.scrollTop-c.clientHeight<55)chatNew.hidden=true;});
document.getElementById('roomRadioBtn').onclick=()=>window.Radio?.open();

function formatSystemMessage(msg) {
  if (msg.key) {
    // Connect Four uses yellow/red instead of white/black for join/leave notices.
    let key = msg.key;
    if (isConnect4Game() && /^sys\.(joined|left)\.(w|b)$/.test(key)) key = 'c4.' + key.slice(4);
    let template = I18N.t(key);
    const params = msg.params || {};
    const sideShort = (c) => isConnect4Game() ? I18N.t(c === 'w' ? 'c4.side.y' : 'c4.side.r') : I18N.t('side.short.' + c);
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === 'winner_side') return params.winner ? sideShort(params.winner) : '';
      if (key === 'loser_side') return params.loser ? sideShort(params.loser) : '';
      if (key === 'player_side') return params.player ? sideShort(params.player) : '';
      return params[key] !== undefined ? params[key] : '';
    });
  }
  return msg.text || '';
}

function refreshChatMessages() {
  const c = document.getElementById('chatMessages');
  if (!c) return;
  c.querySelectorAll('.msg.system[data-key]').forEach((el) => {
    const key = el.getAttribute('data-key');
    let params = {};
    try { params = JSON.parse(el.getAttribute('data-params') || '{}'); } catch (e) {}
    el.textContent = formatSystemMessage({ key, params });
  });
}

function appendChat(msg) {
  const c = document.getElementById('chatMessages');
  const nearEnd = c.scrollHeight - c.scrollTop - c.clientHeight < 70;
  const own = msg.type === 'chat' && msg.user === currentDisplayName && msg.role === myRole;
  const div = document.createElement('div');
  if (msg.type === 'system') {
    div.className = 'msg system';
    div.textContent = formatSystemMessage(msg);
    if (msg.key) {
      div.setAttribute('data-key', msg.key);
      div.setAttribute('data-params', JSON.stringify(msg.params || {}));
    }
  } else {
    div.className = 'msg ' + (msg.role || 'viewer') + (own ? ' own' : '');
    const roleEmoji = msg.role === 'w' ? '⚪' : msg.role === 'b' ? '⚫' : '👁';
    const userSpan = document.createElement('span');
    userSpan.className = 'msg-user';
    userSpan.textContent = roleEmoji + ' ' + msg.user;
    const textSpan = document.createElement('span');
    textSpan.className = 'msg-text';
    textSpan.textContent = msg.text;
    div.appendChild(userSpan);
    if (Number.isFinite(msg.time)) { const time=document.createElement('time');time.className='msg-time';time.dateTime=new Date(msg.time).toISOString();time.textContent=new Date(msg.time).toLocaleTimeString(I18N.getLang()==='en'?'en-US':'th-TH',{hour:'2-digit',minute:'2-digit'});div.appendChild(time); }
    div.appendChild(textSpan);
  }
  c.appendChild(div);
  if (nearEnd || own) scrollChatToEnd(); else chatNew.hidden=false;
  chatMsgCount++;
  document.getElementById('chatCount').textContent = chatMsgCount + ' ' + I18N.t('chat.messages');
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

document.addEventListener('langchange',renderDrawControls);
