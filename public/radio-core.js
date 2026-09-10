/* Shared validation and playback lifecycle. No network proxy or stream recording. */
(function(root) {
  function station(raw) {
    if (!raw || typeof raw !== 'object') return null;
    try {
      const url = new URL(raw.url_resolved || raw.url);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      const name = String(raw.name || '').trim().slice(0,100);
      const uuid = String(raw.stationuuid || raw.uuid || '').slice(0,200);
      if (!name || !uuid) return null;
      return {uuid,name,url:url.href,tags:String(raw.tags || '').slice(0,180),codec:String(raw.codec || '').slice(0,20),bitrate:Math.max(0,Number(raw.bitrate)||0),hls:raw.hls === 1 || raw.hls === true || /\.m3u8(?:\?|$)/i.test(url.href)};
    } catch { return null; }
  }
  function radioOnly(raw) {
    return !/\b(?:tv|television|video|h\.?26[45])\b/i.test([raw?.name,raw?.tags,raw?.codec].join(' '));
  }
  function fixedMobileVolume(nav={}) {
    return /iPhone|iPad|iPod/i.test(nav.userAgent||'')||(/Mac/i.test(nav.platform||'')&&nav.maxTouchPoints>1);
  }
  function stations(raw) {
    const seen = new Set();
    return (Array.isArray(raw)?raw:[]).filter(radioOnly).map(station).filter(s=> {
      if (!s || seen.has(s.url) || seen.has(s.uuid)) return false;
      seen.add(s.url); seen.add(s.uuid); return true;
    });
  }
  function storage(backend) {
    const memory = new Map();
    return {
      get(key,fallback=null) { if(memory.has(key))return memory.get(key);try { const value=backend.getItem(key); return value === null ? fallback : value; } catch { return memory.has(key)?memory.get(key):fallback; } },
      set(key,value) { memory.set(key,String(value));try {backend.setItem(key,String(value));} catch {} },
      json(key,fallback) { try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; } }
    };
  }
  async function fetchStations(fetcher, hosts, timeout=4500) {
    for (const host of hosts) {
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
      try {
        const response=await fetcher(host+'/json/stations/search?countrycode=TH&hidebroken=true&order=clickcount&reverse=true&limit=150',{signal:controller.signal});
        if (!response.ok) throw new Error('HTTP '+response.status);
        const list=stations(await response.json());
        if (list.length) return list;
      } catch {} finally {clearTimeout(timer);}
    }
    throw new Error('directory-unavailable');
  }
  class Player {
    constructor({makeAudio,loadHls,onChange,prepareAudio,unlock,timeout=15000}) {
      Object.assign(this,{makeAudio,loadHls,onChange,prepareAudio,unlock,timeout});this.state='idle';this.current=null;this.generation=0;this.volume=1;this.muted=false;
    }
    update(state) { this.state=state;this.onChange(this); }
    release() {
      ++this.generation;clearTimeout(this.timer);this.timer=null;
      if(this.output){this.output.destroy();this.output=null;}
      if(this.hls){this.hls.destroy();this.hls=null;}
      if(this.audio){const a=this.audio;this.audio=null;a.onplaying=a.onwaiting=a.onstalled=a.onerror=a.onended=null;a.pause();a.removeAttribute('src');a.load();}
    }
    pause() {this.release();this.update(this.current?'paused':'idle');}
    setVolume(value) {this.volume=Math.min(1,Math.max(0,Number(value)||0));if(this.output)this.output.set(this.volume,this.muted);else if(this.audio)try{this.audio.volume=this.volume*this.volume;}catch{} }
    setMuted(value) {this.muted=!!value;if(this.audio)this.audio.muted=this.muted;if(this.output)this.output.set(this.volume,this.muted);}
    async play(next) {
      const target=station(next);if(!target)return;
      this.unlock?.();this.release();this.current=target;this.volumeSupported=undefined;const id=this.generation;
      const audio=this.makeAudio();this.audio=audio;audio.preload='none';try{audio.volume=this.volume*this.volume;}catch{}audio.muted=this.muted;
      const active=()=>id===this.generation;
      const fail=(state='error')=>{if(active()){this.release();this.update(state);}};
      const arm=()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>fail('timeout'),this.timeout);};
      audio.onplaying=()=>{if(active()){clearTimeout(this.timer);this.update('playing');}};
      audio.onwaiting=audio.onstalled=()=>{if(active()){this.update('loading');arm();}};
      audio.onerror=()=>fail('error');audio.onended=()=>fail('ended');
      this.update('loading');arm();
      try {
        let useHls=false;
        if(this.prepareAudio){const prepared=await this.prepareAudio(target,audio);if(!active()){prepared?.output?.destroy();return;}this.output=prepared?.output||null;useHls=!!prepared?.useHls;this.volumeSupported=prepared?.volumeSupported!==false;if(this.output)this.output.set(this.volume,this.muted);}
        if(target.hls && (useHls || !audio.canPlayType('application/vnd.apple.mpegurl'))) {
          const Hls=await this.loadHls();if(!active())return;
          if(!Hls.isSupported()){fail('unsupported');return;}
          audio.disableRemotePlayback=true;
          const hls=new Hls({maxBufferLength:15,backBufferLength:0,enableWorker:true});this.hls=hls;
          hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)fail('error');});
          hls.loadSource(target.url);hls.attachMedia(audio);
        } else audio.src=target.url;
        await audio.play();
        if(active()){clearTimeout(this.timer);this.update('playing');}
      } catch(error) {
        if(active()) fail(error.name==='NotAllowedError'?'blocked':'error');
      }
    }
  }
  const api={station,stations,storage,fetchStations,Player,fixedMobileVolume};
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.RadioCore=api;
})(typeof window!=='undefined'?window:globalThis);
