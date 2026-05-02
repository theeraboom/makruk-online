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
  const LS_VOLUME = 'mk_radio_volume';
  const LS_STATION = 'mk_radio_station_uuid';

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
    #radioVolume {
      padding: 8px 12px; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #D4C5A0; font-size: 12px;
    }
    html[data-theme="dark"] #radioVolume { border-color: #2C3956; }
    #radioVolume input[type="range"] {
      flex: 1; accent-color: #B45309; height: 4px;
    }
    #radioList {
      flex: 1; overflow-y: auto; padding: 4px 0;
      -webkit-overflow-scrolling: touch;
    }
    .radio-station {
      padding: 10px 14px; cursor: pointer;
      border-bottom: 1px solid rgba(212, 197, 160, 0.4);
      transition: background 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    html[data-theme="dark"] .radio-station { border-color: rgba(44, 57, 86, 0.6); }
    .radio-station:hover { background: rgba(251, 191, 36, 0.1); }
    .radio-station.playing {
      background: rgba(251, 191, 36, 0.18);
      border-left: 3px solid #B45309;
      padding-left: 11px;
    }
    .radio-station .name { font-weight: 600; font-size: 13px; }
    .radio-station .meta { font-size: 11px; color: #6B5B45; margin-top: 2px; }
    html[data-theme="dark"] .radio-station .meta { color: #94A3B8; }
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
    <div id="radioVolume">
      <span>🔈</span>
      <input type="range" id="radioVol" min="0" max="100" step="1" value="60">
      <span id="radioVolLabel">60</span>
    </div>
    <div id="radioList"><div id="radioStatus">กำลังโหลดสถานี...</div></div>
  `;
  document.body.appendChild(panel);

  // ---- Audio element ----
  const audio = new Audio();
  audio.preload = 'none';
  audio.crossOrigin = 'anonymous';
  let currentStation = null;
  let isPlaying = false;

  // ---- Refs ----
  const closeBtn = document.getElementById('radioCloseBtn');
  const refreshBtn = document.getElementById('radioRefreshBtn');
  const nowName = document.getElementById('radioNowName');
  const playBtn = document.getElementById('radioPlayBtn');
  const list = document.getElementById('radioList');
  const status = document.getElementById('radioStatus');
  const volSlider = document.getElementById('radioVol');
  const volLabel = document.getElementById('radioVolLabel');
  const pulseDot = document.createElement('span');
  pulseDot.className = 'pulse';
  pulseDot.hidden = true;
  btn.appendChild(pulseDot);

  // ---- Volume ----
  const savedVolume = parseFloat(localStorage.getItem(LS_VOLUME));
  const initialVol = isFinite(savedVolume) ? savedVolume : 0.6;
  audio.volume = initialVol;
  volSlider.value = String(Math.round(initialVol * 100));
  volLabel.textContent = volSlider.value;
  volSlider.oninput = () => {
    const v = parseInt(volSlider.value, 10) / 100;
    audio.volume = v;
    volLabel.textContent = volSlider.value;
    localStorage.setItem(LS_VOLUME, String(v));
  };

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
    } catch (e) {
      status.textContent = 'โหลดสถานีไม่สำเร็จ — ลองกด ↻ รีเฟรช';
    }
  }

  function renderStations() {
    list.innerHTML = '';
    if (stations.length === 0) {
      list.innerHTML = '<div id="radioStatus">ไม่พบสถานี</div>';
      return;
    }
    const lastUuid = localStorage.getItem(LS_STATION);
    for (const s of stations) {
      const item = document.createElement('div');
      item.className = 'radio-station';
      if (currentStation && currentStation.uuid === s.uuid) item.classList.add('playing');
      const tags = s.tags ? s.tags.split(',').slice(0, 3).join(' • ') : '';
      const bitrate = s.bitrate ? s.bitrate + 'k' : '';
      item.innerHTML = `
        <div class="name"></div>
        <div class="meta"></div>
      `;
      item.querySelector('.name').textContent = s.name;
      item.querySelector('.meta').textContent = [bitrate, tags].filter(Boolean).join(' · ');
      item.onclick = () => playStation(s);
      list.appendChild(item);
    }
  }

  function playStation(s) {
    currentStation = s;
    nowName.textContent = s.name;
    audio.src = s.url;
    audio.play().then(() => {
      isPlaying = true;
      playBtn.disabled = false;
      playBtn.textContent = '⏸';
      pulseDot.hidden = false;
      localStorage.setItem(LS_STATION, s.uuid);
      // Update highlight
      list.querySelectorAll('.radio-station').forEach((el, i) => {
        el.classList.toggle('playing', stations[i] && stations[i].uuid === s.uuid);
      });
    }).catch((err) => {
      isPlaying = false;
      playBtn.disabled = false;
      playBtn.textContent = '▶';
      pulseDot.hidden = true;
      nowName.textContent = '⚠️ เล่นไม่สำเร็จ — ลองสถานีอื่น';
    });
  }

  playBtn.onclick = () => {
    if (!currentStation) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      playBtn.textContent = '▶';
      pulseDot.hidden = true;
    } else {
      audio.play().then(() => {
        isPlaying = true;
        playBtn.textContent = '⏸';
        pulseDot.hidden = false;
      }).catch(() => {});
    }
  };

  audio.onended = () => { isPlaying = false; playBtn.textContent = '▶'; pulseDot.hidden = true; };
  audio.onerror = () => {
    isPlaying = false;
    playBtn.textContent = '▶';
    pulseDot.hidden = true;
    nowName.textContent = '⚠️ Stream error';
  };

  refreshBtn.onclick = () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    stationsLoaded = false;
    loadStations(true);
  };

  // ---- Restore open state on load ----
  if (localStorage.getItem(LS_OPEN) === '1') {
    setTimeout(openPanel, 200); // slight delay so button doesn't flash
  }
})();
