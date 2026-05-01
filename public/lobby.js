const PIECE_SYMBOLS = {
  'wK': '♔', 'wQ': '♕', 'wB': '♗', 'wN': '♘', 'wR': '♖', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bB': '♝', 'bN': '♞', 'bR': '♜', 'bP': '♟'
};

const socket = io();
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
    saveNameBtn.textContent = '✓ บันทึก';
    setTimeout(() => (saveNameBtn.textContent = 'บันทึก'), 1500);
  }
};

const newRoomInput = document.getElementById('newRoomName');
const newRoomPasswordInput = document.getElementById('newRoomPassword');
const createBtn = document.getElementById('createBtn');
const incRow = document.getElementById('incRow');
let selectedTimeBase = null;
let selectedTimeIncrement = 0;

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

function createRoom() {
  const name = newRoomInput.value.trim() || 'วงหมากรุกไทย';
  const password = newRoomPasswordInput.value.trim();
  socket.emit('create_room', {
    name,
    timeBase: selectedTimeBase,
    timeIncrement: selectedTimeIncrement,
    password: password || null,
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

socket.on('site_stats', ({ totalVisits, onlineUsers }) => {
  const visitsEl = document.getElementById('statVisits');
  if (visitsEl) visitsEl.textContent = totalVisits.toLocaleString('th-TH');
  const footer = document.getElementById('footerStats');
  if (footer) {
    footer.innerHTML = `© 2026 หมากรุกไทยออนไลน์ — ผู้เข้าชมทั้งหมด <strong>${totalVisits.toLocaleString('th-TH')}</strong> ครั้ง • ออนไลน์ตอนนี้ <strong>${onlineUsers.toLocaleString('th-TH')}</strong> คน`;
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
        <div>ยังไม่มีวงเปิด — เปิดวงใหม่ได้เลย</div>
      </div>`;
    return;
  }
  list.innerHTML = '';
  rooms.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'room-card';

    let statusBadge = '';
    if (r.status === 'waiting') {
      statusBadge = '<span class="badge waiting">⏳ รอผู้เล่น</span>';
    } else if (r.status === 'playing') {
      statusBadge = '<span class="badge live"><span class="live-dot"></span>LIVE</span>';
    } else {
      statusBadge = '<span class="badge ended">✓ จบเกม</span>';
    }

    const turnIcon = r.currentPlayer === 'w' ? '⚪' : '⚫';
    const turnPill = r.status === 'playing'
      ? `<span class="thumb-pill">${turnIcon} ตา${r.currentPlayer === 'w' ? 'ขาว' : 'ดำ'}</span>`
      : '';
    const tcPill = formatTimeControl(r.timeBase, r.timeIncrement);
    const tcPillHTML = tcPill ? `<span class="thumb-pill">⏱ ${tcPill}</span>` : '';
    const lockBadge = r.isPrivate ? '<span class="thumb-pill private">🔒 ส่วนตัว</span>' : '';

    card.innerHTML = `
      <div class="room-thumb">
        ${renderMiniBoard(r.board)}
        <div class="thumb-overlay">
          <div class="thumb-overlay-top">
            ${statusBadge}
            <div style="display:flex;gap:4px;flex-direction:column;align-items:flex-end">
              <span class="thumb-pill">👁 ${r.viewerCount}</span>
              ${tcPillHTML}
              ${lockBadge}
            </div>
          </div>
          <div class="thumb-overlay-bottom">
            ${turnPill}
            <span class="thumb-pill">👥 ${r.playerCount}/2</span>
          </div>
        </div>
      </div>
      <div class="room-card-body">
        <div class="room-name">${escapeHtml(r.name)}</div>
        <div class="room-meta">
          <span>${r.status === 'waiting' ? 'รอคู่แข่ง' : (r.status === 'playing' ? 'กำลังเล่น' : 'จบแล้ว')}</span>
          <span>•</span>
          <span>${r.viewerCount} คนดู</span>
        </div>
      </div>
    `;
    card.onclick = () => {
      if (r.isPrivate) {
        const pw = prompt(`ห้อง "${r.name}" เป็นห้องส่วนตัว\nกรุณาใส่รหัสห้อง:`);
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
  const baseStr = base >= 60 ? `${base / 60}ชม.` : `${base}น.`;
  return inc ? `${baseStr} +${inc}วิ` : baseStr;
}

function renderMiniBoard(board) {
  if (!board) return '<div class="mini-board-empty">♟</div>';
  let html = '<div class="mini-board">';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sqClass = (r + c) % 2 === 0 ? 'mb-light' : 'mb-dark';
      const piece = board[r][c];
      const sym = piece ? PIECE_SYMBOLS[piece] : '';
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
