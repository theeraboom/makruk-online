const CHESS_SYMBOLS = {
  'wK': '♚', 'wQ': '♛', 'wB': '♝', 'wN': '♞', 'wR': '♜', 'wP': '♟',
  'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
};
const CHECKERS_SYMBOLS = {
  'wM': '⛂', 'wK': '⛃', 'bM': '⛂', 'bK': '⛃'
};

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
  transports: ['websocket', 'polling'],
});

document.getElementById('langToggleBtn').onclick = () => I18N.toggleLang();
document.addEventListener('langchange', () => { socket.emit('list_rooms'); });
const nameInput = document.getElementById('nameInput');

// Persistent UID (shared with room.js) so slot reclaim works across reconnects
let userUid = localStorage.getItem('makruk_uid');
if (!userUid) {
  userUid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('makruk_uid', userUid);
}
let savedName = localStorage.getItem('makruk_name') || '';
nameInput.value = savedName;
updateProfileButton();
// Re-send identity on every connect (initial + reconnects)
socket.on('connect', () => {
  socket.emit('set_uid', userUid);
  if (savedName) socket.emit('set_name', savedName);
});
socket.emit('set_uid', userUid);
if (savedName) socket.emit('set_name', savedName);

const profileButton=document.getElementById('profileButton');
const profileDialog=document.getElementById('profileDialog');
const profileForm=document.getElementById('profileForm');
function updateProfileButton(){
  const action=document.getElementById('profileAction'),name=document.getElementById('profileName');
  const key=savedName?'profile.edit':'profile.set';action.dataset.i18n=key;action.textContent=I18N.t(key);
  name.textContent=savedName;name.hidden=!savedName;
}
function savePlayerName(){
  const name=nameInput.value.trim().slice(0,24);
  if(!name){
    document.getElementById('nameFeedback').textContent=I18N.t('ui.nameRequired');
    nameInput.setAttribute('aria-invalid','true');nameInput.focus();return false;
  }
  savedName=name;localStorage.setItem('makruk_name',name);updateProfileButton();
  socket.emit('set_name',name);
  if(profileDialog.open)profileDialog.close();
  return true;
}
profileButton.onclick=()=>{
  nameInput.value=savedName;nameInput.removeAttribute('aria-invalid');document.getElementById('nameFeedback').textContent='';
  profileDialog.showModal();window.AppNavigation?.setModalOpen(true);nameInput.focus();nameInput.select();
};
document.getElementById('closeProfile').onclick=()=>profileDialog.close();
profileDialog.addEventListener('close',()=>{
  // Discard an unconfirmed edit so starting a game cannot save a cancelled name.
  window.AppNavigation?.setModalOpen(false);nameInput.value=savedName;profileButton.focus({preventScroll:true});
});
profileForm.addEventListener('submit',event=>{event.preventDefault();savePlayerName();});
nameInput.addEventListener('input',()=>{nameInput.removeAttribute('aria-invalid');document.getElementById('nameFeedback').textContent='';});
document.addEventListener('langchange',updateProfileButton);

const newRoomInput = document.getElementById('newRoomName');
const newRoomPasswordInput = document.getElementById('newRoomPassword');
const createBtn = document.getElementById('createBtn');
const incRow = document.getElementById('incRow');
let selectedTimeBase = null;
let selectedTimeIncrement = 0;
let selectedGameType = 'chess';

const GAME_TYPE_LABELS = {
  'chess': 'วงหมากรุกไทย',
  'chess-intl': 'วงหมากรุกสากล',
  'checkers': 'วงหมากฮอสไทย',
  'checkers-intl': 'วงหมากฮอสสากล',
  'connect4': 'Connect Four',
};
// Side picker labels switch between chess/checkers (white/black) and connect4 (yellow/red)
function updateSidePickerLabels() {
  const wBtn = document.querySelector('#userColorOptions .tc-btn[data-uc="w"]');
  const bBtn = document.querySelector('#userColorOptions .tc-btn[data-uc="b"]');
  if (!wBtn || !bBtn) return;
  const wKey = selectedGameType === 'connect4' ? 'side.yellow' : selectedGameType === 'checkers-intl' ? 'side.whiteSecond' : 'side.white';
  const bKey = selectedGameType === 'connect4' ? 'side.red' : selectedGameType === 'checkers-intl' ? 'side.blackFirst' : 'side.black';
  wBtn.setAttribute('data-i18n', wKey);
  bBtn.setAttribute('data-i18n', bKey);
  wBtn.textContent = I18N.t(wKey);
  bBtn.textContent = I18N.t(bKey);
}

document.querySelectorAll('#gameTypeOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#gameTypeOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedGameType = btn.dataset.gt;
    updateSidePickerLabels();
    syncSetup();
  };
});

document.querySelectorAll('#tcBaseOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#tcBaseOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tc = btn.dataset.tc;
    selectedTimeBase = tc ? Number(tc) : null;

    if (!selectedTimeBase) {
      selectedTimeIncrement = 0;
      document.querySelectorAll('#tcIncOptions .tc-btn').forEach(b => b.classList.toggle('active', b.dataset.tc === '0'));
    }
    syncSetup();
  };
});

document.querySelectorAll('#tcIncOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    if (!selectedTimeBase) return;
    document.querySelectorAll('#tcIncOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTimeIncrement = Number(btn.dataset.tc);
    syncSetup();
  };
});

// Side selection — independent from bot mode (default: white)
let selectedUserColor = 'w';
document.querySelectorAll('#userColorOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#userColorOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedUserColor = btn.dataset.uc;
    syncSetup();
  };
});

let botEnabled = false;
let selectedBotDifficulty = 'medium';
const botEnabledInput = document.getElementById('botEnabled');
const botOptions = document.getElementById('botOptions');
function setBotEnabled(on) {
  botEnabled = !!on;
  botEnabledInput.checked = botEnabled;
  document.getElementById('botDifficultyRow').hidden = !botEnabled;
  document.querySelectorAll('#opponentOptions button').forEach(b => {
    const active = (b.dataset.mode === 'bot') === botEnabled;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('#botOptions .tc-btn').forEach(b => b.classList.toggle('active', b.dataset.bd === selectedBotDifficulty));
  syncSetup();
}
botEnabledInput.onchange = () => setBotEnabled(botEnabledInput.checked);
document.querySelectorAll('#opponentOptions button').forEach(b => {
  b.onclick = () => setBotEnabled(b.dataset.mode === 'bot');
});
document.querySelectorAll('#botOptions .tc-btn').forEach(btn => {
  btn.onclick = () => { selectedBotDifficulty = btn.dataset.bd; setBotEnabled(true); };
});

let creatingRoom = false;
let createTimer = null;
let connectionState = 'connecting';
let lastRooms = [];
function syncSetup() {
  document.querySelectorAll('#tcIncOptions button').forEach(btn => {
    btn.disabled = !selectedTimeBase;
    btn.setAttribute('aria-describedby', 'incrementHint');
  });
  document.getElementById('incrementHint').textContent = I18N.t(selectedTimeBase ? 'ui.incrementHelp' : 'ui.incrementHint');
  document.querySelectorAll('.tc-btn').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
  document.getElementById('selectedGameName').textContent = I18N.t('game.' + selectedGameType);
  document.getElementById('createLabel').textContent = I18N.t(creatingRoom ? 'ui.creating' : botEnabled ? 'ui.createBot' : 'ui.createFriend');
  document.getElementById('playHint').textContent = I18N.t(botEnabled ? 'ui.botHint' : 'ui.friendHint');
  document.getElementById('setupSummary').textContent = [
    botEnabled ? I18N.t('ui.bot') + ' · ' + I18N.t('bot.' + selectedBotDifficulty) : I18N.t('ui.friend'),
    formatTimeControl(selectedTimeBase, selectedTimeIncrement) || I18N.t('tc.none'),
    ...(newRoomPasswordInput.value.trim() ? [I18N.t('ui.private')] : [])
  ].join(' • ');
  createBtn.disabled = creatingRoom || !socket.connected;
  createBtn.setAttribute('aria-busy', String(creatingRoom));
  const chip = document.getElementById('connectionStatus');
  chip.classList.toggle('offline', connectionState !== 'online');
  document.getElementById('connectionLabel').textContent = I18N.t('ui.' + connectionState);
  if (savedName) {
    const profile = document.getElementById('profileName');
    profile.removeAttribute('data-i18n');
    profile.textContent = savedName;
  }
}
function resetCreate(errorKey) {
  clearTimeout(createTimer);
  creatingRoom = false;
  const error = document.getElementById('createError');
  error.hidden = !errorKey;
  error.textContent = errorKey ? I18N.t(errorKey) : '';
  syncSetup();
}
newRoomPasswordInput.addEventListener('input', syncSetup);
document.addEventListener('DOMContentLoaded', syncSetup);
document.addEventListener('langchange', () => { syncSetup(); updateSidePickerLabels(); renderRooms(lastRooms); });
socket.on('connect', () => { connectionState = 'online'; resetCreate(); });
socket.on('disconnect', () => { connectionState = 'offline'; resetCreate('ui.connectError'); });
socket.on('connect_error', () => {
  connectionState = 'offline';
  document.getElementById('roomsList').setAttribute('aria-busy', 'false');
  resetCreate('ui.connectError');
});
socket.on('error_msg', () => { if (creatingRoom) resetCreate('ui.createError'); });

let lastCreatedPw = null;
function createRoom() {
  if (creatingRoom) return;
  if (!socket.connected) { resetCreate('ui.connectError'); return; }
  creatingRoom = true;
  document.getElementById('createError').hidden = true;
  syncSetup();
  createTimer = setTimeout(() => resetCreate('ui.createError'), 12000);
  // Save a name typed in the profile even if the player did not press Save.
  if (nameInput.value.trim() && nameInput.value.trim() !== savedName) savePlayerName();
  const name = newRoomInput.value.trim();
  const password = newRoomPasswordInput.value.trim();
  lastCreatedPw = password || null;
  socket.emit('create_room', {
    name,
    gameType: selectedGameType,
    timeBase: selectedTimeBase,
    timeIncrement: selectedTimeIncrement,
    password: password || null,
    botEnabled,
    botDifficulty: selectedBotDifficulty,
    userColor: selectedUserColor,
  });
}
createBtn.onclick = createRoom;
newRoomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createRoom();
});
newRoomPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createRoom();
});

socket.on('room_created', ({ id }) => {
  clearTimeout(createTimer);
  // Carry the password into the room URL so the creator's share link
  // lets friends enter the private room directly (no prompt).
  AppNavigation.go(lastCreatedPw
    ? `/room.html?id=${id}&pw=${encodeURIComponent(lastCreatedPw)}`
    : `/room.html?id=${id}`);
});

socket.on('rooms_list', (rooms) => {
  lastRooms = rooms;
  document.getElementById('roomsList').setAttribute('aria-busy', 'false');
  renderStats(rooms);
  renderRooms(rooms);
});

let lastSiteStats = null;
function fmtFooterLobby(totalVisits, onlineUsers) {
  const lang = I18N.getLang();
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const v = totalVisits.toLocaleString(locale);
  const o = onlineUsers.toLocaleString(locale);
  return `© 2026 Playmakruk.com — ${I18N.t('footer.visits')} <strong>${v}</strong> ${I18N.t('footer.times')} • ${I18N.t('footer.online')} <strong>${o}</strong> ${I18N.t('footer.people')}`;
}
socket.on('site_stats', ({ totalVisits, onlineUsers }) => {
  lastSiteStats = { totalVisits, onlineUsers };
  const onlineEl = document.getElementById('statOnline');
  if (onlineEl) onlineEl.textContent = onlineUsers.toLocaleString(I18N.getLang() === 'th' ? 'th-TH' : 'en-US');
  const footer = document.getElementById('footerStats');
  if (footer) footer.innerHTML = fmtFooterLobby(totalVisits, onlineUsers);
});
document.addEventListener('langchange', () => {
  if (lastSiteStats) {
    const f = document.getElementById('footerStats');
    if (f) f.innerHTML = fmtFooterLobby(lastSiteStats.totalVisits, lastSiteStats.onlineUsers);
    const o = document.getElementById('statOnline');
    if (o) o.textContent = lastSiteStats.onlineUsers.toLocaleString(I18N.getLang() === 'th' ? 'th-TH' : 'en-US');
  }

});

function renderStats(rooms) {
  const totalPlayers = rooms.reduce((sum, r) => sum + r.playerCount, 0);
  const totalViewers = rooms.reduce((sum, r) => sum + r.viewerCount, 0);
  document.getElementById('statRooms').textContent = rooms.length;
  document.getElementById('statPlayers').textContent = totalPlayers;
  document.getElementById('statViewers').textContent = totalViewers;
}

function renderRooms(rooms) {
  const list = document.getElementById('roomsList');
  if (!rooms || rooms.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon" aria-hidden="true">♙</div>
        <h3>${I18N.t('ui.emptyTitle')}</h3>
        <p>${I18N.t('rooms.empty')}</p>
        <button type="button" class="ghost" id="emptyPractice">${I18N.t('ui.emptyAction')}</button>
      </div>`;
    document.getElementById('emptyPractice').onclick = () => {
      setBotEnabled(true);
      createBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
      createBtn.focus({ preventScroll: true });
    };
    return;
  }
  // Keep the outer links stable as boards update, preserving keyboard focus.
  const existing = new Map([...list.querySelectorAll('.room-card')].map(card => [card.dataset.roomId, card]));
  list.querySelector('.empty')?.remove();
  const roomIds = new Set(rooms.map(r => r.id));
  for (const card of [...list.children]) {
    if (!roomIds.has(card.dataset.roomId)) card.remove();
  }
  rooms.forEach((r, index) => {
    const card = existing.get(r.id) || document.createElement('a');
    card.className = 'room-card room-card-v2';
    card.dataset.roomId = r.id;
    card.dataset.status = r.status;
    card.href = '/room.html?id=' + encodeURIComponent(r.id);
    const displayName = r.hasDefaultName ? I18N.t('default.' + r.gameType) : r.name;
    const canJoin = r.status === 'waiting' && r.playerCount < 2;
    const actionLabel = I18N.t(canJoin ? 'ui.join' : 'ui.watch');
    const isC4 = r.gameType === 'connect4';
    const art = r.gameType === 'chess' ? 'thai' : r.gameType === 'chess-intl' ? 'chess' : isC4 ? 'connect4' : 'checkers';
    const stateKey = r.status === 'playing' ? 'ui.roomLive' : r.status === 'waiting' ? (canJoin ? 'ui.roomWaiting' : 'ui.playersReturning') : 'ui.roomEnded';
    const time = formatTimeControl(r.timeBase, r.timeIncrement) || I18N.t('tc.none');
    const turn = r.status === 'playing'
      ? I18N.t(isC4 ? (r.currentPlayer === 'w' ? 'c4.turnY' : 'c4.turnR') : (r.currentPlayer === 'w' ? 'room.turnW' : 'room.turnB'))
      : I18N.t(canJoin ? 'ui.seatOpen' : r.status === 'waiting' ? 'ui.playersReturning' : 'ui.finished');
    card.setAttribute('aria-label', actionLabel + ': ' + displayName);
    function playerSlot(color) {
      const player = r.players?.[color];
      const name = r.isPrivate ? I18N.t('ui.hiddenPlayer') : player
        ? (player.isBot ? I18N.t('bot.name.' + player.botDifficulty) : player.name)
        : I18N.t('player.waiting');
      const initial = r.isPrivate ? '•' : player?.isBot ? 'AI' : player ? Array.from(player.name.trim())[0] || '?' : '+';
      return `<span class="room-player ${color} ${!player && !r.isPrivate ? 'vacant' : ''}"><span class="room-player-avatar" aria-hidden="true">${escapeHtml(initial)}</span><span class="room-player-name">${escapeHtml(name)}</span></span>`;
    }
    card.innerHTML = `
      <div class="room-preview ${isC4 ? 'c4-preview' : ''}">
        <img class="room-scenery" src="img/game-${art}-3d.webp" alt="" loading="lazy" width="720" height="480">
        <div class="room-status-row"><span class="room-state ${r.status}"><span class="live-dot" aria-hidden="true"></span>${I18N.t(stateKey)}</span><span class="room-audience">${r.viewerCount} ${I18N.t('room.viewers')}</span></div>
        <div class="room-live-board" aria-hidden="true">${renderMiniBoard(r.board, r.gameType)}</div>
        <span class="room-time-tag">${escapeHtml(time)}</span>
        ${r.isPrivate ? `<span class="room-lock-tag">${I18N.t('room.private')}</span>` : ''}
      </div>
      <div class="room-card-body">
        <div class="room-game-line"><span>${I18N.t('game.' + r.gameType)}</span><span>${r.moveCount || 0} ${I18N.t('ui.movesUnit')}</span></div>
        <h3 class="room-name">${escapeHtml(displayName)}</h3>
        <div class="room-matchup">${playerSlot('w')}<span class="room-versus" aria-hidden="true">VS</span>${playerSlot('b')}</div>
        <div class="room-entry-row"><span class="room-turn"><span class="turn-dot ${r.currentPlayer === 'b' ? 'b' : 'w'} ${isC4 ? 'c4' : ''}" aria-hidden="true"></span>${turn}</span><span class="room-enter">${actionLabel}<span aria-hidden="true">↗</span></span></div>
      </div>`;
    card.onclick = event => {
      if (!r.isPrivate) return;
      event.preventDefault();
      const pw = prompt(`"${displayName}" ${I18N.t('prompt.privatePass')}`);
      if (!pw) return;
      AppNavigation.go(`/room.html?id=${encodeURIComponent(r.id)}&pw=${encodeURIComponent(pw)}`);
    };
    if (list.children[index] !== card) list.insertBefore(card, list.children[index] || null);
  });
}

function formatTimeControl(base, inc) {
  if (!base) return null;
  const baseStr = base >= 60 ? `${base / 60}${I18N.t('tc.hour')}` : `${base}${I18N.t('tc.min')}`;
  return inc ? `${baseStr} +${inc}${I18N.t('tc.sec')}` : baseStr;
}

function renderMiniBoard(board, gameType) {
  if (!board) return '<div class="mini-board-empty">♟</div>';
  if (gameType === 'connect4') return renderMiniConnect4(board);
  const isCheckers = gameType === 'checkers' || gameType === 'checkers-intl';
  const symbols = isCheckers ? CHECKERS_SYMBOLS : CHESS_SYMBOLS;
  let html = '<div class="mini-board">';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sqClass = (r + c) % 2 === 0 ? 'mb-light' : 'mb-dark';
      const piece = board[r][c];
      const sym = piece ? Pieces.renderPiece(piece, gameType, 'studio') : '';
      const colorClass = piece ? (piece[0] === 'w' ? 'mb-w' : 'mb-b') : '';
      html += `<div class="mb-sq ${sqClass} ${colorClass}">${sym}</div>`;
    }
  }
  html += '</div>';
  return html;
}

function renderMiniConnect4(board) {
  const ROWS = board.length, COLS = board[0] ? board[0].length : 7;
  let html = '<div class="mini-board mini-connect4">';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      const cls = p === 'Y' ? 'mc4-y' : p === 'R' ? 'mc4-r' : '';
      html += `<div class="mc4-cell"><div class="mc4-hole ${cls}"></div></div>`;
    }
  }
  html += '</div>';
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

socket.emit('list_rooms');

// ============ Server status banner (graceful shutdown / reconnect) ============
function ensureLobbyBanner() {
  let el = document.getElementById('serverBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'serverBanner';
    document.body.appendChild(el);
  }
  return el;
}
function showLobbyBanner(text, kind, autoHideMs) {
  const el = ensureLobbyBanner();
  el.className = '';
  el.classList.add(kind || 'info');
  el.classList.add('show');
  el.textContent = text;
  if (autoHideMs) setTimeout(() => el.classList.remove('show'), autoHideMs);
}

let restartCountdownTimer = null;
socket.on('server_restart', ({ in_seconds }) => {
  let remaining = in_seconds || 8;
  if (restartCountdownTimer) clearInterval(restartCountdownTimer);
  showLobbyBanner(I18N.t('sys.restart.warn').replace('{sec}', remaining), 'warn');
  restartCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(restartCountdownTimer);
      restartCountdownTimer = null;
      return;
    }
    showLobbyBanner(I18N.t('sys.restart.warn').replace('{sec}', remaining), 'warn');
  }, 1000);
});

let lobbyWasConnected = true;
socket.on('disconnect', () => {
  lobbyWasConnected = false;
  showLobbyBanner(I18N.t('sys.disconnect'), 'warn');
});
socket.on('connect', () => {
  if (!lobbyWasConnected) {
    lobbyWasConnected = true;
    socket.emit('list_rooms');
    showLobbyBanner(I18N.t('sys.reconnected'), 'ok', 2500);
  }
});
