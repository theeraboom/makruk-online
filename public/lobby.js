const CHESS_SYMBOLS = {
  'wK': '♚', 'wQ': '♛', 'wB': '♝', 'wN': '♞', 'wR': '♜', 'wP': '♟',
  'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
};
const CHECKERS_SYMBOLS = {
  'wM': '⛂', 'wK': '⛃', 'bM': '⛂', 'bK': '⛃'
};

const socket = io();

document.getElementById('langToggleBtn').onclick = () => I18N.toggleLang();
document.addEventListener('langchange', () => { socket.emit('list_rooms'); });
const nameInput = document.getElementById('nameInput');
const saveNameBtn = document.getElementById('saveName');

const savedName = localStorage.getItem('makruk_name') || '';
nameInput.value = savedName;
if (savedName) socket.emit('set_name', savedName);

saveNameBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (name) {
    localStorage.setItem('makruk_name', name);
    socket.emit('set_name', name);
    saveNameBtn.textContent = I18N.t('name.saved');
    setTimeout(() => (saveNameBtn.textContent = I18N.t('name.save')), 1500);
  }
};

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
};
document.querySelectorAll('#gameTypeOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#gameTypeOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedGameType = btn.dataset.gt;
    newRoomInput.placeholder = I18N.t('create.roomName') + ' (' + I18N.t('gt.' + selectedGameType) + ')';
  };
});

document.querySelectorAll('#tcBaseOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#tcBaseOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tc = btn.dataset.tc;
    selectedTimeBase = tc ? Number(tc) : null;
    incRow.hidden = !selectedTimeBase;
    if (!selectedTimeBase) selectedTimeIncrement = 0;
  };
});

document.querySelectorAll('#tcIncOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#tcIncOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTimeIncrement = Number(btn.dataset.tc);
  };
});

// Side selection — independent from bot mode
let selectedUserColor = null; // 'w' | 'b' | null (server defaults to 'w')
document.querySelectorAll('#userColorOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#userColorOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedUserColor = btn.dataset.uc;
  };
});

let botEnabled = false;
let selectedBotDifficulty = 'medium';
const botEnabledInput = document.getElementById('botEnabled');
const botOptions = document.getElementById('botOptions');
function setBotEnabled(on) {
  botEnabled = on;
  botEnabledInput.checked = on;
  if (!on) {
    document.querySelectorAll('#botOptions .tc-btn').forEach((b) => b.classList.remove('active'));
  }
}
botEnabledInput.onchange = () => {
  setBotEnabled(botEnabledInput.checked);
  if (botEnabledInput.checked) {
    // Reset difficulty default to easy when user manually checks
    document.querySelectorAll('#botOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    const easyBtn = document.querySelector('#botOptions .tc-btn[data-bd="easy"]');
    if (easyBtn) easyBtn.classList.add('active');
    selectedBotDifficulty = 'easy';
  }
};

document.querySelectorAll('#botOptions .tc-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('#botOptions .tc-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedBotDifficulty = btn.dataset.bd;
    setBotEnabled(true);
  };
});

function createRoom() {
  const name = newRoomInput.value.trim();
  const password = newRoomPasswordInput.value.trim();
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
  window.location.href = `/room.html?id=${id}`;
});

socket.on('rooms_list', (rooms) => {
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
  // Update placeholder when active button selected
  const activeBtn = document.querySelector('#gameTypeOptions .tc-btn.active');
  if (activeBtn) {
    selectedGameType = activeBtn.dataset.gt;
    newRoomInput.placeholder = I18N.t('create.roomName') + ' (' + I18N.t('gt.' + selectedGameType) + ')';
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
        <div class="empty-icon">♟</div>
        <div>${I18N.t('rooms.empty')}</div>
      </div>`;
    return;
  }
  list.innerHTML = '';
  rooms.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'room-card';

    let statusBadge = '';
    if (r.status === 'waiting') {
      statusBadge = `<span class="badge waiting">${I18N.t('room.waiting')}</span>`;
    } else if (r.status === 'playing') {
      statusBadge = `<span class="badge live"><span class="live-dot"></span>${I18N.t('room.live').replace('🔴 ', '')}</span>`;
    } else {
      statusBadge = `<span class="badge ended">${I18N.t('room.ended')}</span>`;
    }

    const turnIcon = r.currentPlayer === 'w' ? '⚪' : '⚫';
    const turnPill = r.status === 'playing'
      ? `<span class="thumb-pill">${turnIcon} ${r.currentPlayer === 'w' ? I18N.t('room.turnW') : I18N.t('room.turnB')}</span>`
      : '';
    const tcPill = formatTimeControl(r.timeBase, r.timeIncrement);
    const tcPillHTML = tcPill ? `<span class="thumb-pill">⏱ ${tcPill}</span>` : '';
    const lockBadge = r.isPrivate ? `<span class="thumb-pill private">${I18N.t('room.private')}</span>` : '';
    const botBadge = r.hasBot ? `<span class="thumb-pill bot-badge">${I18N.t('bot.name.' + r.botDifficulty)}</span>` : '';
    const displayName = r.hasDefaultName ? I18N.t('default.' + r.gameType) : r.name;
    const gtBadge = `<span class="thumb-pill game-type">${I18N.t('gt.' + r.gameType)}</span>`;

    card.innerHTML = `
      <div class="room-thumb">
        ${renderMiniBoard(r.board, r.gameType)}
        <div class="thumb-overlay">
          <div class="thumb-overlay-top">
            ${statusBadge}
            <div style="display:flex;gap:4px;flex-direction:column;align-items:flex-end">
              <span class="thumb-pill">👁 ${r.viewerCount}</span>
              ${tcPillHTML}
              ${lockBadge}
              ${botBadge}
            </div>
          </div>
          <div class="thumb-overlay-bottom">
            <div style="display:flex;gap:4px;flex-direction:column;align-items:flex-start">
              ${gtBadge}
              ${turnPill}
            </div>
            <span class="thumb-pill">👥 ${r.playerCount}/2</span>
          </div>
        </div>
      </div>
      <div class="room-card-body">
        <div class="room-name">${escapeHtml(displayName)}</div>
        <div class="room-meta">
          <span>${r.status === 'waiting' ? I18N.t('room.waiting').replace(/^[⏳]\s/, '') : (r.status === 'playing' ? I18N.t('room.live').replace(/^[🔴]\s/, '') : I18N.t('room.ended').replace(/^[✓]\s/, ''))}</span>
          <span>•</span>
          <span>${r.viewerCount} ${I18N.t('room.viewers')}</span>
        </div>
      </div>
    `;
    card.onclick = () => {
      if (r.isPrivate) {
        const pw = prompt(`"${displayName}" ${I18N.t('prompt.privatePass')}`);
        if (!pw) return;
        window.location.href = `/room.html?id=${r.id}&pw=${encodeURIComponent(pw)}`;
      } else {
        window.location.href = `/room.html?id=${r.id}`;
      }
    };
    list.appendChild(card);
  });
}

function formatTimeControl(base, inc) {
  if (!base) return null;
  const baseStr = base >= 60 ? `${base / 60}${I18N.t('tc.hour')}` : `${base}${I18N.t('tc.min')}`;
  return inc ? `${baseStr} +${inc}${I18N.t('tc.sec')}` : baseStr;
}

function renderMiniBoard(board, gameType) {
  if (!board) return '<div class="mini-board-empty">♟</div>';
  const isCheckers = gameType === 'checkers' || gameType === 'checkers-intl';
  const symbols = isCheckers ? CHECKERS_SYMBOLS : CHESS_SYMBOLS;
  let html = '<div class="mini-board">';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sqClass = (r + c) % 2 === 0 ? 'mb-light' : 'mb-dark';
      const piece = board[r][c];
      const sym = piece ? (symbols[piece] || '') : '';
      const colorClass = piece ? (piece[0] === 'w' ? 'mb-w' : 'mb-b') : '';
      html += `<div class="mb-sq ${sqClass} ${colorClass}">${sym}</div>`;
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
