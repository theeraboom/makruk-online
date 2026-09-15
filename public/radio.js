/* Radio UI; directory and stream failures remain independent of the game. */
(function(){
  if(window.__radioWidgetLoaded)return;window.__radioWidgetLoaded=true;
  const {station,stations,storage,fetchStations,Player,catalogueStation,mergeStations}=window.RadioCore;
  const catalogue=window.RadioCatalogue||{stations:[],replacements:[],excludedUrls:[]};
  let backend;try{backend=window.localStorage;}catch{backend={};}const saved=storage(backend);
  const cacheKey='mk_radio_stations_v5',tsKey='mk_radio_stations_ts';
  let directory=stations(saved.json(cacheKey,[])),custom=stations(saved.json('mk_radio_custom',[]));
  let favRaw=saved.json('mk_radio_favorites',[]);
  let favorites=new Set((Array.isArray(favRaw)?favRaw.filter(x=>typeof x==='string'):[]).map(id=>catalogue.replacements.find(r=>r.from===id)?.to||id));
  saved.set('mk_radio_favorites',JSON.stringify([...favorites]));
  const failed=new Set();
  let filter='fm',loading=false,loadError=false,loadPromise=null,hlsPromise=null,opener=null;
  const en=()=>window.I18N?.getLang()==='en'||document.documentElement.lang==='en';
  const t=(th,eng)=>en()?eng:th;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const dock=document.createElement('button');dock.id='radioBtn';dock.type='button';dock.setAttribute('aria-controls','radioPanel');dock.setAttribute('aria-expanded','false');
  dock.innerHTML='<span class="radio-dock-icon" aria-hidden="true">♫</span><i class="radio-playing-dot" aria-hidden="true"></i>';
  const panel=document.createElement('section');panel.id='radioPanel';panel.className='radio-studio';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','radioTitle');
  panel.innerHTML=`<div class="radio-heading"><div><span class="radio-eyebrow">PLAYMAKRUK RADIO</span><h2 id="radioTitle"></h2></div><button id="radioClose" type="button">✕</button></div>
    <div class="radio-now"><div class="radio-art" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div><div class="radio-track"><strong id="radioTrack"></strong><span id="radioState" role="status"></span></div><button id="radioPlayBtn" type="button"></button></div>
    <div class="radio-browse"><div class="radio-search-row"><input id="radioSearch" type="search" autocomplete="off"><button id="radioRefresh" type="button">↻</button><button id="radioAdd" type="button">＋</button></div>
    <div class="radio-tabs" role="group"><button type="button" data-radio-filter="fm"></button><button type="button" data-radio-filter="am"></button><button type="button" data-radio-filter="favorites"></button></div></div>
    <form id="radioAddForm" hidden><label><span id="radioNameLabel"></span><input id="radioCustomName" maxlength="100" required></label><label><span id="radioUrlLabel"></span><input id="radioCustomUrl" type="url" placeholder="https://…" required></label><p id="radioFormError" role="alert"></p><div><button id="radioSave" type="submit"></button><button id="radioCancel" type="button"></button></div></form>
    <p id="radioNotice" role="status" hidden></p><div id="radioList"></div><div class="radio-credit"><span id="radioCount"></span><a href="https://www.radio-browser.info/" target="_blank" rel="noopener">Radio Browser ↗</a></div>`;
  document.body.append(dock,panel);
  function loadHls(){
    if(window.Hls)return Promise.resolve(window.Hls);
    if(hlsPromise)return hlsPromise;
    hlsPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/hls-1.7.2.light.min.js';script.onload=()=>resolve(window.Hls);script.onerror=()=>{script.remove();hlsPromise=null;reject(new Error('hls-load'));};document.head.appendChild(script);});return hlsPromise;
  }
  const player=new Player({makeAudio:()=>new Audio(),loadHls,unlock:()=>window.GameAudio?.unlock(),onChange:p=>{
    saved.set('mk_radio_playing',['playing','loading'].includes(p.state)?'1':'0');
    if(p.current){saved.set('mk_radio_station_uuid',p.current.uuid);saved.set('mk_radio_last_station',JSON.stringify(p.current));}
    if(p.current){if(['error','timeout','unsupported','ended'].includes(p.state))failed.add(p.current.uuid);else if(p.state==='playing')failed.delete(p.current.uuid);}
    renderPlayer();renderList();
    if('mediaSession' in navigator){try{navigator.mediaSession.playbackState=p.state==='playing'?'playing':'paused';if(p.current&&window.MediaMetadata)navigator.mediaSession.metadata=new MediaMetadata({title:p.current.name,artist:'Playmakruk Radio'});}catch{}}
  }});
  // Device controls own loudness; discard old in-widget attenuation/mute.
  player.setVolume(1);player.setMuted(false);saved.set('mk_radio_volume','1');saved.set('mk_radio_muted','0');
  function all(){return mergeStations(catalogue,directory,custom);}
  function stateLabel(){return ({idle:t('เลือกสถานีที่อยากฟัง','Choose a station'),paused:t('พักเสียงอยู่','Paused'),loading:t('กำลังเชื่อมต่อ…','Connecting…'),playing:t('กำลังฟังสด','Listening live'),blocked:t('แตะเล่นเพื่อฟังต่อ','Tap play to continue'),timeout:t('เชื่อมต่อนานเกินไป · กดเล่นเพื่อลองใหม่','Connection timed out · tap play to retry'),error:t('สถานีไม่ตอบสนอง · ลองใหม่หรือเลือกสถานีอื่น','Stream unavailable · retry or choose another'),ended:t('สตรีมหยุดแล้ว · กดเล่นเพื่อต่อใหม่','Stream ended · tap play to reconnect'),unsupported:t('เบราว์เซอร์นี้ไม่รองรับสตรีมนี้','This browser cannot play this stream')})[player.state];}
  function renderPlayer(){
    const active=['playing','loading'].includes(player.state);
    $('radioTrack').textContent=player.current?.name||t('เพลงดี ๆ ระหว่างตา','A soundtrack for your next move');
    $('radioState').textContent=stateLabel();panel.dataset.state=player.state;
    $('radioPlayBtn').textContent=active?'Ⅱ':'▶';$('radioPlayBtn').disabled=!player.current;
    $('radioPlayBtn').setAttribute('aria-label',active?t('หยุดวิทยุ','Pause radio'):t('เล่นวิทยุ','Play radio'));
    dock.dataset.state=player.state;labelDock();

  }
  function updateRows(){panel.querySelectorAll('[data-station]').forEach(row=>{const selected=row.dataset.station===player.current?.uuid;row.classList.toggle('is-current',selected);row.querySelector('.radio-select').setAttribute('aria-pressed',String(selected));row.querySelector('.radio-row-icon').textContent=selected&&player.state==='playing'?'♫':'▶';});}
  function renderList(){
    const query=$('radioSearch').value.trim().toLocaleLowerCase();
    const list=all().filter(s=>(filter==='favorites'?favorites.has(s.uuid):filter==='am'?s.band==='AM':s.band!=='AM')&&(!query||(s.name+' '+s.tags).toLocaleLowerCase().includes(query))).sort((a,b)=>Number(failed.has(a.uuid))-Number(failed.has(b.uuid)));
    $('radioList').innerHTML=list.map(s=>`<div class="radio-station" data-station="${escape(s.uuid)}"><button type="button" class="radio-select" aria-pressed="false"><span class="radio-row-icon" aria-hidden="true">▶</span><span><b>${escape(s.name)}</b><small>${escape(failed.has(s.uuid)?t('ขัดข้องชั่วคราว · แตะเพื่อลองใหม่','Unavailable now · tap to retry'):[s.tags.split(',').slice(0,2).join(' · '),s.bitrate?s.bitrate+' kbps':'',s.hls?'HLS':s.codec].filter(Boolean).join(' · '))}</small></span></button><button type="button" class="radio-fav" aria-pressed="${favorites.has(s.uuid)}" aria-label="${escape(t('สถานีโปรด ','Favorite ')+s.name)}">${favorites.has(s.uuid)?'♥':'♡'}</button>${custom.some(c=>c.uuid===s.uuid)?`<button type="button" class="radio-delete" aria-label="${escape(t('ลบ ','Delete ')+s.name)}">×</button>`:''}</div>`).join('')||`<div class="radio-empty">${loading?t('กำลังหาสถานีให้คุณ…','Finding stations…'):filter==='favorites'?t('กด ♡ ข้างสถานีเพื่อเก็บไว้ฟัง','Tap ♡ beside a station to save it'):t('ไม่พบสถานี ลองคำอื่นหรือเพิ่มลิงก์ด้วย ＋','No stations found. Try another search or add a stream with ＋')}</div>`;
    $('radioCount').textContent=list.length+' '+t('สถานี','stations');
    panel.querySelectorAll('[data-radio-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.radioFilter===filter)));
    $('radioNotice').hidden=!loading&&!loadError;
    $('radioNotice').textContent=loading?t('กำลังอัปเดตรายชื่อ… สถานีที่บันทึกไว้ยังฟังได้','Updating… saved stations are still available'):t('โหลดรายชื่อใหม่ไม่ได้ กด ↻ เพื่อลองอีกครั้ง สถานีเดิมยังใช้ได้','Directory unavailable. Tap ↻ to retry; saved stations remain available.');
    $('radioRefresh').disabled=loading;updateRows();
  }
  function load(force=false){
    if(loadPromise)return loadPromise;
    if(!force&&directory.length&&Date.now()-Number(saved.get(tsKey,0))<86400000)return Promise.resolve();
    loading=true;loadError=false;renderList();
    loadPromise=fetchStations(window.fetch.bind(window),['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://de2.api.radio-browser.info']).then(list=>{directory=list;saved.set(cacheKey,JSON.stringify(list));saved.set(tsKey,Date.now());}).catch(()=>{loadError=true;}).finally(()=>{loading=false;loadPromise=null;renderList();});return loadPromise;
  }
  function labelDock(){const label=(panel.hidden?t('เปิดวิทยุ','Open radio'):t('ย่อวิทยุ','Minimize radio'))+(player.current?' · '+player.current.name:'');dock.setAttribute('aria-label',label);dock.title=label;}
  function open(){if(!panel.hidden)return;opener=document.activeElement;panel.hidden=false;dock.setAttribute('aria-expanded','true');labelDock();$('radioClose').focus();load();}
  function close(restoreFocus=true){if(panel.hidden)return;panel.hidden=true;dock.setAttribute('aria-expanded','false');labelDock();if(restoreFocus)(opener?.isConnected?opener:dock).focus();}
  dock.onclick=()=>panel.hidden?open():close();$('radioClose').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!dock.contains(e.target))close(false);},{capture:true});
  $('radioPlayBtn').onclick=()=>['playing','loading'].includes(player.state)?player.pause():player.play(player.current);
  $('radioSearch').oninput=renderList;$('radioRefresh').onclick=()=>load(true);
  panel.querySelectorAll('[data-radio-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.radioFilter;renderList();});
  $('radioList').onclick=e=>{
    const row=e.target.closest('[data-station]');if(!row)return;const item=all().find(s=>s.uuid===row.dataset.station);if(!item)return;
    if(e.target.closest('.radio-fav')){favorites.has(item.uuid)?favorites.delete(item.uuid):favorites.add(item.uuid);saved.set('mk_radio_favorites',JSON.stringify([...favorites]));renderList();}
    else if(e.target.closest('.radio-delete')){custom=custom.filter(s=>s.uuid!==item.uuid);favorites.delete(item.uuid);saved.set('mk_radio_custom',JSON.stringify(custom));saved.set('mk_radio_favorites',JSON.stringify([...favorites]));if(player.current?.uuid===item.uuid){player.pause();player.current=null;saved.set('mk_radio_last_station','null');saved.set('mk_radio_station_uuid','');renderPlayer();}renderList();}
    else if(e.target.closest('.radio-select')){if(player.current?.uuid===item.uuid&&['playing','loading'].includes(player.state))player.pause();else player.play(item);}
  };
  $('radioAdd').onclick=()=>{$('radioAddForm').hidden=false;$('radioCustomName').focus();};
  $('radioCancel').onclick=()=>{$('radioAddForm').hidden=true;$('radioFormError').textContent='';$('radioAdd').focus();};
  $('radioAddForm').onsubmit=e=>{
    e.preventDefault();const item=station({uuid:'custom_'+Date.now().toString(36),name:$('radioCustomName').value,url:$('radioCustomUrl').value.trim()});
    if(!item){$('radioFormError').textContent=t('ใช้ชื่อสถานีและลิงก์สตรีม HTTPS ที่ถูกต้อง','Enter a name and a valid HTTPS stream URL');return;}
    if(all().some(s=>s.url===item.url)){$('radioFormError').textContent=t('มีลิงก์สถานีนี้แล้ว','This stream is already in your list');return;}
    custom.push(item);saved.set('mk_radio_custom',JSON.stringify(custom));filter=item.band==='AM'?'am':'fm';$('radioSearch').value='';e.target.reset();$('radioFormError').textContent='';e.target.hidden=true;renderList();$('radioAdd').focus();
  };
  function translate(){
    $('radioTitle').textContent=t('ฟังเพลิน เดินหมากสนุก','Tune in. Make your move.');
    $('radioClose').setAttribute('aria-label',t('ย่อวิทยุ เพลงยังเล่นต่อ','Minimize radio, keep listening'));
    $('radioSearch').placeholder=t('ค้นหาสถานี แนวเพลง…','Search stations, genres…');$('radioSearch').setAttribute('aria-label',t('ค้นหาสถานีวิทยุ','Search radio stations'));
    $('radioRefresh').setAttribute('aria-label',t('อัปเดตสถานี','Refresh stations'));$('radioAdd').setAttribute('aria-label',t('เพิ่มสถานีเอง','Add a station'));
    panel.querySelector('[data-radio-filter="fm"]').textContent='FM';panel.querySelector('[data-radio-filter="am"]').textContent='AM';panel.querySelector('[data-radio-filter="favorites"]').textContent=t('รายการโปรด','Favorites');
    $('radioNameLabel').textContent=t('ชื่อสถานี','Station name');$('radioUrlLabel').textContent=t('ลิงก์สตรีม HTTPS','HTTPS stream URL');$('radioSave').textContent=t('เพิ่มสถานี','Add station');$('radioCancel').textContent=t('ยกเลิก','Cancel');renderPlayer();renderList();
  }
  document.addEventListener('langchange',translate);
  if('mediaSession' in navigator){for(const [action,handler]of Object.entries({play:()=>player.play(player.current),pause:()=>player.pause(),stop:()=>player.pause()})){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}}
  window.addEventListener('offline',()=>{if(['playing','loading'].includes(player.state)){player.release();player.update('error');}});
  const shouldResume=saved.get('mk_radio_playing')==='1';
  player.current=catalogueStation(saved.json('mk_radio_last_station',null),catalogue)||all().find(s=>s.uuid===saved.get('mk_radio_station_uuid'))||null;
  if(player.current)player.state='paused';translate();
  if(shouldResume&&player.current)player.play(player.current);
  // Release live connections for back/forward cache without changing the user's resume intent.
  window.addEventListener('pagehide',()=>{saved.set('mk_radio_playing',['playing','loading'].includes(player.state)?'1':'0');player.release();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&saved.get('mk_radio_playing')==='1'&&player.current)player.play(player.current);});
  window.Radio={open,close,pause:()=>player.pause()};
})();
