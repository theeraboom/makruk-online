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
  return Chess;
}
function isCheckersGame() { return gameType === 'checkers' || gameType === 'checkers-intl'; }
function getSymbols() { return isCheckersGame() ? CHECKERS_SYMBOLS : CHESS_SYMBOLS; }

const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');
const initialPw = params.get('pw') || null;
if (!roomId) window.location.href = '/';

const socket = io();
document.getElementById('langToggleBtn').onclick = () => I18N.toggleLang();
document.addEventListener('langchange', () => {
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
let currentPlayer = 'w';
let status = 'waiting';
let selected = null;
let validMoves = [];
let flipped = false;
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
let soundEnabled = localStorage.getItem('makruk_sound') !== 'off';
let boardTheme = localStorage.getItem('makruk_theme') || 'wood';
let pieceSet = localStorage.getItem('makruk_pieceset') || 'classic';

const userName = localStorage.getItem('makruk_name') || '';
if (userName) socket.emit('set_name', userName);
socket.emit('join_room', { roomId, password: initialPw });

socket.on('password_required', ({ name }) => {
  const pw = prompt(`"${name}" ${I18N.t('prompt.privatePass')}`);
  if (!pw) { window.location.href = '/'; return; }
  socket.emit('join_room', { roomId, password: pw });
});

socket.on('joined', ({ role }) => {
  myRole = role;
  if (role === 'b') flipped = true;
  updateRoleBadge();
});

socket.on('room_state', (state) => {
  lastRoomName = state.name;
  lastHasDefaultName = !!state.hasDefaultName;
  const displayName = state.hasDefaultName ? I18N.t('default.' + (state.gameType || 'chess')) : state.name;
  document.getElementById('roomName').textContent = displayName;
  document.title = displayName + ' — Playmakruk.com';
  const prevStatus = status;
  gameType = state.gameType || 'chess';
  const labelEl = document.getElementById('roomGameTypeLabel');
  const gameLabels = { 'chess': 'หมากรุกไทย', 'chess-intl': 'หมากรุกสากล', 'checkers': 'หมากฮอสไทย', 'checkers-intl': 'หมากฮอสสากล' };
  if (labelEl) labelEl.textContent = gameLabels[gameType] || 'Playmakruk.com';
  document.querySelectorAll('.rule-list').forEach((el) => {
    el.hidden = !el.classList.contains('rl-' + gameType);
  });
  const piecePicker = document.getElementById('piecePicker');
  if (piecePicker) piecePicker.hidden = isCheckersGame();
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
  moves = state.moves || [];

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

  document.getElementById('viewerCount').textContent = state.viewerCount;
  updateViewersList(state.viewers || [], state.viewerCount);

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
    // Re-join the same room with same password
    const params = new URLSearchParams(location.search);
    const roomId = params.get('id');
    const password = params.get('pw') || sessionStorage.getItem('mk_pw_' + roomId) || '';
    if (roomId) {
      if (userName) socket.emit('set_name', userName);
      socket.emit('join_room', { roomId, password });
    }
    showBanner(I18N.t('sys.reconnected'), 'ok', 2500);
  }
});

// If room is gone after reconnect (server restarted, in-memory rooms lost), redirect to lobby
socket.on('error_msg', (msg) => {
  if (justReconnected && msg === 'ไม่พบห้องนี้') {
    showBanner(I18N.t('sys.room_expired'), 'warn');
    setTimeout(() => { location.href = '/'; }, 2500);
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
  if (myRole === 'w') { badge.textContent = I18N.t('role.w'); badge.className = 'role-badge w'; }
  else if (myRole === 'b') { badge.textContent = I18N.t('role.b'); badge.className = 'role-badge b'; }
  else if (myRole === 'viewer') { badge.textContent = I18N.t('role.viewer'); badge.className = 'role-badge viewer'; }
  else { badge.textContent = I18N.t('role.connecting'); badge.className = 'role-badge'; }
}

function updateStatus() {
  const el = document.getElementById('status');
  el.className = 'status-pill';
  const lang = I18N.getLang();
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
  const boardEl = document.getElementById('board');
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

function applyPieceSet(set) {
  pieceSet = set;
  localStorage.setItem('makruk_pieceset', set);
  document.querySelectorAll('#pieceOptions .theme-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.pieceset === set);
  });
  if (board) render();
}
applyPieceSet(pieceSet);

document.querySelectorAll('#pieceOptions .theme-btn').forEach((btn) => {
  btn.onclick = () => applyPieceSet(btn.dataset.pieceset);
});

// Sound style picker: select + preview
function applySoundStyle(style, preview) {
  soundStyle = style;
  localStorage.setItem('makruk_sound_style', style);
  document.querySelectorAll('#soundStyleOptions .theme-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.sound === style);
  });
  if (preview && soundEnabled) {
    // Force-enable temporarily (in case user wants to hear even when sound is off)
    playSound('move');
  }
}
applySoundStyle(soundStyle, false);
document.querySelectorAll('#soundStyleOptions .theme-btn').forEach((btn) => {
  btn.onclick = () => applySoundStyle(btn.dataset.sound, true);
});

document.getElementById('resetBtn').onclick = () => {
  if (myRole !== 'w' && myRole !== 'b') {
    showToast(I18N.t('err.playerOnly'));
    return;
  }
  if (confirm(I18N.t('confirm.reset'))) socket.emit('reset_game');
};

document.getElementById('resignBtn').onclick = () => {
  if (confirm(I18N.t('confirm.resign'))) socket.emit('resign');
};

document.getElementById('shareBtn').onclick = async () => {
  const url = window.location.href;
  const lang = I18N.getLang();
  const gameTypeName = I18N.t('gt.' + gameType).replace(/^[♛♚⛀⛂]\s/, '');
  const text = lang === 'th' ? `มาดูวง${gameTypeName}ที่ ${url}` : `Watch this ${gameTypeName} game at ${url}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Playmakruk.com', text, url }); return; } catch (e) {}
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast(I18N.t('toast.copied'));
  } catch (e) {
    showToast(I18N.t('toast.copyFail') + url);
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
let noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

let audioUnlocked = false;
let audioOutput = null; // master input node — all sounds connect here
function ensureAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    // Chain: sources → BIG GAIN (~30x) → brick-wall LIMITER → destination
    // Limiter sits AFTER gain so we can boost hard without clipping
    try {
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 30.0; // ~+30dB — much louder for mobile speakers
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -1;   // engage just below 0 dBFS
      limiter.knee.value = 0;          // hard knee
      limiter.ratio.value = 20;        // brick-wall limiter
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;
      masterGain.connect(limiter).connect(audioCtx.destination);
      audioOutput = masterGain;
    } catch (e) {
      audioOutput = audioCtx.destination;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// iOS Safari / Chrome mobile: AudioContext is locked until first user gesture.
// Keep retrying unlock on EVERY interaction until state === 'running'.
function tryUnlockAudio() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  try {
    // Play a silent 1-sample buffer — iOS unlock trick
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(audioOutput || ctx.destination);
    src.start(0);
  } catch (e) {}
  // Resume returns a Promise — when it resolves, mark unlocked + remove listeners
  if (ctx.resume) {
    ctx.resume().then(() => {
      if (ctx.state === 'running' && !audioUnlocked) {
        audioUnlocked = true;
        ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'].forEach((ev) => {
          document.removeEventListener(ev, tryUnlockAudio, { capture: true });
          document.removeEventListener(ev, tryUnlockAudio, true);
        });
      }
    }).catch(() => {});
  }
}
['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'].forEach((ev) => {
  document.addEventListener(ev, tryUnlockAudio, { capture: true, passive: true });
});

// ============ Sound style presets ============
let soundStyle = localStorage.getItem('makruk_sound_style') || 'pop';

const SOUND_GENERATORS = {
  pop:    (ctx, when, i) => popClick(ctx, when, i),
  wood:   (ctx, when, i) => woodTap(ctx, when, i),
  glass:  (ctx, when, i) => glassClink(ctx, when, i, 2400),
  marble: (ctx, when, i) => marbleTap(ctx, when, i),
  bell:   (ctx, when, i) => bellRing(ctx, when, i),
  tap:    (ctx, when, i) => uiTap(ctx, when, i),
};

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gen = SOUND_GENERATORS[soundStyle] || SOUND_GENERATORS.pop;
    if (type === 'move') {
      gen(ctx, now, 1.0);
    } else if (type === 'capture') {
      gen(ctx, now, 1.3);
      gen(ctx, now + 0.05, 0.7);
    } else if (type === 'chat') {
      tone(ctx, now, 880, 0.06);
    } else if (type === 'end') {
      tone(ctx, now, 523, 0.15);
      tone(ctx, now + 0.13, 659, 0.15);
      tone(ctx, now + 0.26, 784, 0.25);
    }
  } catch (e) {}
}

// ============ Sound generators ============
// Pop: pitch drop, soft, modern UI feel
function popClick(ctx, when, intensity) {
  const out = audioOutput || ctx.destination;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, when);
  osc.frequency.exponentialRampToValueAtTime(400, when + 0.04);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.5 * intensity, when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + 0.13);
}

// Wood: warm 350Hz body + click attack (mid-freq, mobile-friendly)
function woodTap(ctx, when, intensity) {
  const out = audioOutput || ctx.destination;
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(350, when);
  osc.frequency.exponentialRampToValueAtTime(180, when + 0.06);
  oscGain.gain.setValueAtTime(0, when);
  oscGain.gain.linearRampToValueAtTime(0.45 * intensity, when + 0.003);
  oscGain.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
  osc.connect(oscGain).connect(out);
  osc.start(when);
  osc.stop(when + 0.11);
  // Click attack
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 2;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.35 * intensity, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
  noise.connect(filter).connect(noiseGain).connect(out);
  noise.start(when);
  noise.stop(when + 0.05);
}

// Glass: ringing harmonics (current default)
function glassClink(ctx, when, intensity, fundamental) {
  fundamental = fundamental || 2400;
  const out = audioOutput || ctx.destination;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5 * intensity, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.018);
  noise.connect(noiseFilter).connect(noiseGain).connect(out);
  noise.start(when);
  noise.stop(when + 0.02);
  const harmonics = [
    { mult: 1.0, gain: 0.45, decay: 0.45 },
    { mult: 2.01, gain: 0.22, decay: 0.35 },
    { mult: 3.04, gain: 0.12, decay: 0.25 },
  ];
  for (const h of harmonics) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = fundamental * h.mult;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(h.gain * intensity, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, when + h.decay);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + h.decay + 0.05);
  }
}

// Marble: sharp 1500Hz click + brief ring
function marbleTap(ctx, when, intensity) {
  const out = audioOutput || ctx.destination;
  // Sharp transient
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1500;
  filter.Q.value = 4;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.55 * intensity, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.025);
  noise.connect(filter).connect(noiseGain).connect(out);
  noise.start(when);
  noise.stop(when + 0.03);
  // Brief ring (square wave for snap)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 1500;
  oscGain.gain.setValueAtTime(0.18 * intensity, when);
  oscGain.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
  osc.connect(oscGain).connect(out);
  osc.start(when);
  osc.stop(when + 0.09);
}

// Bell: soft musical chime
function bellRing(ctx, when, intensity) {
  const out = audioOutput || ctx.destination;
  const fundamental = 600;
  const harmonics = [
    { mult: 1.0, gain: 0.4, decay: 0.6 },
    { mult: 2.0, gain: 0.25, decay: 0.5 },
    { mult: 3.0, gain: 0.15, decay: 0.4 },
    { mult: 4.0, gain: 0.08, decay: 0.3 },
  ];
  for (const h of harmonics) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = fundamental * h.mult;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(h.gain * intensity, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, when + h.decay);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + h.decay + 0.05);
  }
}

// Tap: minimal UI tap (very short noise burst)
function uiTap(ctx, when, intensity) {
  const out = audioOutput || ctx.destination;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 1.5;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6 * intensity, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.025);
  noise.connect(filter).connect(noiseGain).connect(out);
  noise.start(when);
  noise.stop(when + 0.03);
}

function tone(ctx, when, freq, dur) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.15, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(gain).connect(audioOutput || ctx.destination);
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

function formatSystemMessage(msg) {
  if (msg.key) {
    let template = I18N.t(msg.key);
    const params = msg.params || {};
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === 'winner_side') return params.winner ? I18N.t('side.short.' + params.winner) : '';
      if (key === 'loser_side') return params.loser ? I18N.t('side.short.' + params.loser) : '';
      if (key === 'player_side') return params.player ? I18N.t('side.short.' + params.player) : '';
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
  const div = document.createElement('div');
  if (msg.type === 'system') {
    div.className = 'msg system';
    div.textContent = formatSystemMessage(msg);
    if (msg.key) {
      div.setAttribute('data-key', msg.key);
      div.setAttribute('data-params', JSON.stringify(msg.params || {}));
    }
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
