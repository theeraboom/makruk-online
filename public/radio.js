/**
 * Floating Thai radio player
 * - Stations from radio-browser.info (free public API, no key)
 * - HTML5 <audio> playback — no iframe, no CORS issues
 * - Persists open state, volume, last station in localStorage
 * - Self-contained: creates its own DOM + styles on load
 */
(function () {
  if (window.__radioWidgetLoaded) return;
  window.__radioWidgetLoaded = true;

  const API_HOSTS = [
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
    'https://fr1.api.radio-browser.info',
  ];
  const CACHE_KEY = 'mk_radio_stations_v1';
  const CACHE_TS_KEY = 'mk_radio_stations_ts';
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
  const LS_OPEN = 'mk_radio_open';
  const LS_STATION = 'mk_radio_station_uuid';
  const LS_PLAYING = 'mk_radio_playing'; // '1' = was playing, auto-resume on next page
  const LS_FAVORITES = 'mk_radio_favorites'; // JSON array of station uuids
  const LS_CUSTOM = 'mk_radio_custom'; // JSON array of {uuid, name, url}

  // ---- Inject styles ----
  const style = document.createElement('style');
  style.textContent = `
    #radioBtn {
      position: fixed; right: 16px; bottom: 16px; z-index: 9998;
      width: 54px; height: 54px; border-radius: 50%;
      background: linear-gradient(135deg, #FCD34D, #B45309);
      color: #1F1611; font-size: 26px; line-height: 1;
      border: 1.5px solid #B45309;
      box-shadow: 0 4px 14px rgba(180, 83, 9, 0.35), 0 0 0 1px #FFF inset;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s, box-shadow 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    #radioBtn:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(180, 83, 9, 0.5); }
    #radioBtn .pulse {
      position: absolute; top: 4px; right: 4px;
      width: 10px; height: 10px; border-radius: 50%;
      background: #22C55E; box-shadow: 0 0 0 2px #FFF;
      animation: rPulse 1.4s ease-in-out infinite;
    }
    @keyframes rPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }
    #radioPanel {
      position: fixed; right: 16px; bottom: 80px; z-index: 9999;
      width: 360px; max-width: calc(100vw - 32px);
      max-height: 540px; height: calc(100vh - 120px);
      background: #FFFCF3; color: #1F1611;
      border: 1px solid #D4C5A0; border-radius: 14px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
      display: flex; flex-direction: column; overflow: hidden;
      transform-origin: bottom right;
      transform: scale(0.92) translateY(8px); opacity: 0; pointer-events: none;
      transition: transform 0.18s ease, opacity 0.18s ease;
    }
    html[data-theme="dark"] #radioPanel {
      background: #1A2438; color: #F1F5F9; border-color: #2C3956;
    }
    #radioPanel.show { transform: scale(1) translateY(0); opacity: 1; pointer-events: auto; }
    #radioPanel header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid #D4C5A0;
      background: linear-gradient(135deg, #FCD34D, #D97706); color: #1F1611;
      font-weight: 700; font-size: 14px;
    }
    html[data-theme="dark"] #radioPanel header { border-color: #2C3956; }
    #radioPanel header .title { flex: 1; }
    #radioPanel header button {
      background: rgba(0,0,0,0.15); color: inherit; border: none;
      width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
      font-size: 14px; padding: 0; line-height: 1;
    }
    #radioPanel header button:hover { background: rgba(0,0,0,0.28); }
    #radioNowPlaying {
      padding: 10px 12px; background: rgba(251, 191, 36, 0.12);
      font-size: 12px; display: flex; align-items: center; gap: 8px;
      border-bottom: 1px solid #D4C5A0;
    }
    html[data-theme="dark"] #radioNowPlaying {
      background: rgba(251, 191, 36, 0.08); border-color: #2C3956;
    }
    #radioNowPlaying .np-name { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #radioPlayBtn {
      width: 32px; height: 32px; border-radius: 50%;
      background: #B45309; color: #FFF; border: none; cursor: pointer;
      font-size: 14px; padding: 0; line-height: 1; flex-shrink: 0;
    }
    #radioPlayBtn:hover { background: #92400E; }
    #radioPlayBtn:disabled { opacity: 0.4; cursor: not-allowed; }
    #radioList {
      flex: 1; overflow-y: auto; padding: 4px 0;
      -webkit-overflow-scrolling: touch;
    }
    .radio-station {
      padding: 10px 14px; cursor: pointer;
      border-bottom: 1px solid rgba(212, 197, 160, 0.4);
      transition: background 0.1s;
      -webkit-tap-highlight-color: transparent;
      display: flex; align-items: center; gap: 8px;
    }
    html[data-theme="dark"] .radio-station { border-color: rgba(44, 57, 86, 0.6); }
    .radio-station:hover { background: rgba(251, 191, 36, 0.1); }
    .radio-station.playing {
      background: rgba(34, 197, 94, 0.16);
      border-left: 3px solid #22C55E;
      padding-left: 11px;
    }
    html[data-theme="dark"] .radio-station.playing { background: rgba(34, 197, 94, 0.18); }
    .radio-station.playing .name::before {
      content: '●';
      color: #22C55E;
      margin-right: 6px;
      animation: rPulse 1.4s ease-in-out infinite;
      display: inline-block;
    }
    .radio-station .body { flex: 1; min-width: 0; }
    .radio-station .name { font-weight: 600; font-size: 13px; }
    .radio-station .meta { font-size: 11px; color: #6B5B45; margin-top: 2px; }
    html[data-theme="dark"] .radio-station .meta { color: #94A3B8; }
    .radio-fav {
      background: transparent; border: none; cursor: pointer;
      font-size: 18px; padding: 4px 6px; opacity: 0.4;
      flex-shrink: 0; line-height: 1;
    }
    .radio-fav:hover { opacity: 1; }
    .radio-fav.on { opacity: 1; color: #FBBF24; }
    .radio-search {
      padding: 8px 12px; border-bottom: 1px solid #D4C5A0;
      display: flex; gap: 6px;
    }
    html[data-theme="dark"] .radio-search { border-color: #2C3956; }
    .radio-search input {
      flex: 1; padding: 6px 10px; font-size: 13px;
      border: 1px solid #D4C5A0; border-radius: 6px;
      background: #FFF; color: inherit; min-width: 0;
    }
    html[data-theme="dark"] .radio-search input { background: #0F1729; border-color: #2C3956; }
    .radio-search button {
      padding: 6px 10px; font-size: 13px; cursor: pointer;
      background: #B45309; color: #FFF; border: none; border-radius: 6px;
      flex-shrink: 0;
    }
    .radio-section-label {
      padding: 6px 14px 2px; font-size: 10px; font-weight: 700;
      color: #B45309; text-transform: uppercase; letter-spacing: 0.05em;
      background: rgba(251, 191, 36, 0.06);
    }
    html[data-theme="dark"] .radio-section-label { color: #FBBF24; background: rgba(251, 191, 36, 0.04); }
    #radioStatus { padding: 16px; text-align: center; font-size: 13px; color: #6B5B45; }
    html[data-theme="dark"] #radioStatus { color: #94A3B8; }
    @media (max-width: 480px) {
      #radioPanel {
        right: 8px; left: 8px; bottom: 78px; width: auto; max-width: none;
        height: 70vh;
      }
      #radioBtn { right: 12px; bottom: 12px; }
    }
  `;
  document.head.appendChild(style);

  // ---- Build DOM ----
  const btn = document.createElement('button');
  btn.id = 'radioBtn';
  btn.title = 'Thai radio';
  btn.innerHTML = '📻';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'radioPanel';
  panel.innerHTML = `
    <header>
      <span>📻</span>
      <span class="title">Thai Radio</span>
      <button id="radioRefreshBtn" title="Refresh stations">↻</button>
      <button id="radioCloseBtn" title="Close" aria-label="Close">✕</button>
    </header>
    <div id="radioNowPlaying">
      <span class="np-name" id="radioNowName">— เลือกสถานี —</span>
      <button id="radioPlayBtn" disabled>▶</button>
    </div>
    <div class="radio-search">
      <input type="text" id="radioSearchInput" placeholder="ค้นหาสถานี / ใส่ Stream URL...">
      <button id="radioAddBtn" title="Add custom URL">➕</button>
    </div>
    <div id="radioList"><div id="radioStatus">กำลังโหลดสถานี...</div></div>
  `;
  document.body.appendChild(panel);

  // ---- Audio element ----
  // No crossOrigin → maximum stream compatibility (most stations don't send CORS headers)
  // Volume is controlled by hardware/system (iOS doesn't allow JS volume control anyway)
  const audio = new Audio();
  audio.preload = 'none';
  let currentStation = null;
  let isPlaying = false;

  // ---- Refs ----
  const closeBtn = document.getElementById('radioCloseBtn');
  const refreshBtn = document.getElementById('radioRefreshBtn');
  const nowName = document.getElementById('radioNowName');
  const playBtn = document.getElementById('radioPlayBtn');
  const list = document.getElementById('radioList');
  const status = document.getElementById('radioStatus');
  const searchInput = document.getElementById('radioSearchInput');
  const addBtn = document.getElementById('radioAddBtn');
  const pulseDot = document.createElement('span');
  pulseDot.className = 'pulse';
  pulseDot.hidden = true;
  btn.appendChild(pulseDot);

  audio.volume = 1.0; // max — system volume controls actual loudness

  // ---- Open / close ----
  let panelOpen = false;
  function openPanel() {
    panelOpen = true;
    panel.classList.add('show');
    if (!stationsLoaded) loadStations();
    localStorage.setItem(LS_OPEN, '1');
  }
  function closePanel() {
    panelOpen = false;
    panel.classList.remove('show');
    localStorage.setItem(LS_OPEN, '0');
  }
  btn.onclick = () => panelOpen ? closePanel() : openPanel();
  closeBtn.onclick = closePanel;

  // ---- Stations: load from API or cache ----
  let stationsLoaded = false;
  let stations = [];

  async function fetchFromApi() {
    // Try each API host until one works
    const path = '/json/stations/search?countrycode=TH&hidebroken=true&order=clickcount&reverse=true&limit=80';
    for (const host of API_HOSTS) {
      try {
        const r = await fetch(host + path, {
          headers: { 'User-Agent': 'Playmakruk/1.0' },
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) return data;
      } catch (e) { /* try next host */ }
    }
    throw new Error('All API hosts failed');
  }

  async function loadStations(forceRefresh) {
    status.textContent = 'กำลังโหลดสถานี...';
    list.innerHTML = '';
    list.appendChild(status);

    // Try cache first
    if (!forceRefresh) {
      const ts = parseInt(localStorage.getItem(CACHE_TS_KEY), 10);
      if (ts && (Date.now() - ts < CACHE_TTL)) {
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
          if (Array.isArray(cached) && cached.length > 0) {
            stations = cached;
            stationsLoaded = true;
            renderStations();
            maybeAutoResume();
            return;
          }
        } catch (e) { /* fall through to fetch */ }
      }
    }

    try {
      const raw = await fetchFromApi();
      // Filter: must have a stream URL, prefer https, keep useful fields
      stations = raw
        .filter(s => s.url_resolved || s.url)
        .map(s => ({
          uuid: s.stationuuid,
          name: s.name,
          url: s.url_resolved || s.url,
          tags: s.tags || '',
          bitrate: s.bitrate || 0,
          codec: s.codec || '',
          favicon: s.favicon || '',
        }));
      localStorage.setItem(CACHE_KEY, JSON.stringify(stations));
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
      stationsLoaded = true;
      renderStations();
      maybeAutoResume();
    } catch (e) {
      status.textContent = 'โหลดสถานีไม่สำเร็จ — ลองกด ↻ รีเฟรช';
    }
  }

  function getFavorites() {
    try { return JSON.parse(localStorage.getItem(LS_FAVORITES)) || []; } catch (e) { return []; }
  }
  function setFavorites(arr) {
    localStorage.setItem(LS_FAVORITES, JSON.stringify(arr));
  }
  function toggleFavorite(uuid) {
    const favs = getFavorites();
    const i = favs.indexOf(uuid);
    if (i >= 0) favs.splice(i, 1); else favs.unshift(uuid);
    setFavorites(favs);
  }
  function getCustomStations() {
    try { return JSON.parse(localStorage.getItem(LS_CUSTOM)) || []; } catch (e) { return []; }
  }
  function addCustomStation(name, url) {
    const customs = getCustomStations();
    const uuid = 'custom-' + Date.now();
    customs.unshift({ uuid, name, url, tags: 'custom', bitrate: 0, codec: '' });
    localStorage.setItem(LS_CUSTOM, JSON.stringify(customs));
    return uuid;
  }
  function removeCustomStation(uuid) {
    const customs = getCustomStations().filter(s => s.uuid !== uuid);
    localStorage.setItem(LS_CUSTOM, JSON.stringify(customs));
  }

  function buildStationItem(s, isFav) {
    const item = document.createElement('div');
    item.className = 'radio-station';
    if (currentStation && currentStation.uuid === s.uuid) item.classList.add('playing');
    const tags = s.tags ? s.tags.split(',').slice(0, 3).join(' • ') : '';
    const bitrate = s.bitrate ? s.bitrate + 'k' : '';
    const isCustom = s.uuid.startsWith('custom-');
    item.innerHTML = `
      <div class="body">
        <div class="name"></div>
        <div class="meta"></div>
      </div>
      <button class="radio-fav ${isFav ? 'on' : ''}" title="Favorite">${isFav ? '★' : '☆'}</button>
      ${isCustom ? '<button class="radio-fav" title="Remove" data-remove="1">✕</button>' : ''}
    `;
    item.querySelector('.name').textContent = s.name;
    item.querySelector('.meta').textContent = [bitrate, tags].filter(Boolean).join(' · ');
    const favBtn = item.querySelector('.radio-fav');
    favBtn.onclick = (e) => { e.stopPropagation(); toggleFavorite(s.uuid); renderStations(); };
    if (isCustom) {
      const rmBtn = item.querySelector('[data-remove]');
      if (rmBtn) rmBtn.onclick = (e) => { e.stopPropagation(); removeCustomStation(s.uuid); renderStations(); };
    }
    item.onclick = () => playStation(s);
    return item;
  }

  function renderStations() {
    list.innerHTML = '';
    if (stations.length === 0 && getCustomStations().length === 0) {
      list.innerHTML = '<div id="radioStatus">ไม่พบสถานี</div>';
      return;
    }
    const query = (searchInput.value || '').trim().toLowerCase();
    const favs = new Set(getFavorites());
    const customs = getCustomStations();
    const allStations = customs.concat(stations);
    const matches = (s) => !query || s.name.toLowerCase().includes(query) || (s.tags || '').toLowerCase().includes(query);

    // Favorites section
    const favStations = allStations.filter(s => favs.has(s.uuid) && matches(s));
    if (favStations.length > 0) {
      const label = document.createElement('div');
      label.className = 'radio-section-label';
      label.textContent = '⭐ FAVORITES';
      list.appendChild(label);
      favStations.forEach(s => list.appendChild(buildStationItem(s, true)));
    }

    // Custom (non-favorited) section
    const customNonFav = customs.filter(s => !favs.has(s.uuid) && matches(s));
    if (customNonFav.length > 0) {
      const label = document.createElement('div');
      label.className = 'radio-section-label';
      label.textContent = '➕ MY STATIONS';
      list.appendChild(label);
      customNonFav.forEach(s => list.appendChild(buildStationItem(s, false)));
    }

    // All other stations
    const others = stations.filter(s => !favs.has(s.uuid) && matches(s));
    if (others.length > 0) {
      if (favStations.length > 0 || customNonFav.length > 0) {
        const label = document.createElement('div');
        label.className = 'radio-section-label';
        label.textContent = '📻 ALL STATIONS';
        list.appendChild(label);
      }
      others.forEach(s => list.appendChild(buildStationItem(s, false)));
    }

    if (favStations.length === 0 && customNonFav.length === 0 && others.length === 0) {
      const empty = document.createElement('div');
      empty.id = 'radioStatus';
      empty.textContent = 'ไม่พบสถานีที่ตรงกับ "' + query + '"';
      list.appendChild(empty);
    }
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    playBtn.textContent = playing ? '⏸' : '▶';
    pulseDot.hidden = !playing;
    localStorage.setItem(LS_PLAYING, playing ? '1' : '0');
  }

  function playStation(s) {
    currentStation = s;
    nowName.textContent = s.name;
    audio.src = s.url;
    localStorage.setItem(LS_STATION, s.uuid);
    audio.play().then(() => {
      playBtn.disabled = false;
      setPlayingState(true);
      list.querySelectorAll('.radio-station').forEach((el, i) => {
        el.classList.toggle('playing', stations[i] && stations[i].uuid === s.uuid);
      });
    }).catch((err) => {
      playBtn.disabled = false;
      setPlayingState(false);
      nowName.textContent = '⚠️ เล่นไม่สำเร็จ — ลองสถานีอื่น';
    });
  }

  playBtn.onclick = () => {
    if (!currentStation) return;
    if (isPlaying) {
      audio.pause();
      setPlayingState(false);
    } else {
      audio.play().then(() => setPlayingState(true)).catch(() => {});
    }
  };

  audio.onended = () => setPlayingState(false);
  audio.onerror = () => {
    setPlayingState(false);
    nowName.textContent = '⚠️ Stream error';
  };

  // Persist last play position on page unload (for cross-page continuity)
  window.addEventListener('pagehide', () => {
    if (isPlaying) localStorage.setItem(LS_PLAYING, '1');
  });

  refreshBtn.onclick = () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    stationsLoaded = false;
    loadStations(true);
  };

  // Search filter
  searchInput.oninput = () => { if (stationsLoaded) renderStations(); };

  // Add custom URL: if input looks like a URL, treat as stream URL; else search
  addBtn.onclick = () => {
    const val = (searchInput.value || '').trim();
    if (!val) return;
    // Detect URL
    if (/^https?:\/\//i.test(val)) {
      const name = prompt('ตั้งชื่อสถานี (เช่น "Wave FM 88")', 'Custom Station');
      if (!name) return;
      addCustomStation(name.trim(), val);
      searchInput.value = '';
      renderStations();
    } else {
      // Plain text → just trigger search render (already debounced by oninput)
      renderStations();
    }
  };

  // Auto-resume: if user was playing radio before navigating, resume the same station
  let autoResumeTried = false;
  function maybeAutoResume() {
    if (autoResumeTried) return;
    autoResumeTried = true;
    const wasPlaying = localStorage.getItem(LS_PLAYING) === '1';
    const lastUuid = localStorage.getItem(LS_STATION);
    if (!wasPlaying || !lastUuid) return;
    const s = stations.find(x => x.uuid === lastUuid) || getCustomStations().find(x => x.uuid === lastUuid);
    if (!s) return;
    currentStation = s;
    nowName.textContent = s.name + ' (กำลังเริ่ม...)';
    audio.src = s.url;
    audio.play().then(() => {
      playBtn.disabled = false;
      setPlayingState(true);
      nowName.textContent = s.name;
      list.querySelectorAll('.radio-station').forEach((el, i) => {
        el.classList.toggle('playing', stations[i] && stations[i].uuid === s.uuid);
      });
    }).catch(() => {
      // Browser blocked autoplay — show resume hint on the button
      playBtn.disabled = false;
      nowName.textContent = '▶ แตะที่ 📻 เพื่อเล่นต่อ';
      pulseDot.hidden = false;
      pulseDot.style.background = '#FBBF24'; // amber = needs gesture
    });
  }

  // ---- Restore open state on load ----
  // If user was playing, attempt early auto-resume from customs (without waiting for API)
  const wasPlaying = localStorage.getItem(LS_PLAYING) === '1';

  if (wasPlaying && !stationsLoaded) {
    const lastUuid = localStorage.getItem(LS_STATION);
    const customStation = getCustomStations().find(x => x.uuid === lastUuid);
    if (customStation) {
      // Resume custom station immediately without waiting for API
      stations = [];
      stationsLoaded = true;
      renderStations();
      maybeAutoResume();
    }
  }

  if (localStorage.getItem(LS_OPEN) === '1') {
    setTimeout(openPanel, 200);
  } else if (wasPlaying && !autoResumeTried) {
    if (!stationsLoaded) loadStations();
  }
})();
