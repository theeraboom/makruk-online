/* One audio context across navigation; independent radio and tabletop gains. */
(function(root){
  function level(value){return Math.pow(Math.max(0,Math.min(1,Number(value)||0)),2);}
  function material(theme,game){if(game==='connect4')return 'plastic';if(['marble','gray','green'].includes(theme))return 'stone';if(['blue','purple','neon'].includes(theme))return 'glass';return 'wood';}
  if(typeof module!=='undefined'&&module.exports){module.exports={level,material};return;}
  try{if(parent!==window&&parent.PlaymakrukShell)return;}catch{}
  let context=null,noise=null;
  function getContext(){if(!context){const AudioCtx=root.AudioContext||root.webkitAudioContext;if(!AudioCtx)return null;context=new AudioCtx();}return context;}
  function unlock(){const c=getContext();if(c?.state==='suspended')c.resume().catch(()=>{});}
  function noiseBuffer(c){if(noise?.sampleRate===c.sampleRate)return noise;noise=c.createBuffer(1,Math.floor(c.sampleRate*.25),c.sampleRate);const data=noise.getChannelData(0);let seed=9173;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=seed/1073741824-1;}return noise;}
  function strike(c,out,time,kind,strength=1){
    const profiles={wood:{tones:[185,520,1180],decay:.065,noise:1600},stone:{tones:[440,1550,3020],decay:.12,noise:3400},glass:{tones:[650,1950,4110],decay:.17,noise:2800},plastic:{tones:[310,770,1830],decay:.045,noise:2200}};
    const p=profiles[kind];
    p.tones.forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(f,time);o.frequency.exponentialRampToValueAtTime(f*.94,time+.035);g.gain.setValueAtTime(.0001,time);g.gain.linearRampToValueAtTime(strength*.16/(i+1),time+.0018);g.gain.exponentialRampToValueAtTime(.0001,time+p.decay*(1+i*.22));o.connect(g).connect(out);o.start(time);o.stop(time+p.decay*1.7);o.onended=()=>{o.disconnect();g.disconnect();};});
    const n=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();n.buffer=noiseBuffer(c);filter.type='bandpass';filter.frequency.value=p.noise;filter.Q.value=.7;g.gain.setValueAtTime(strength*.22,time);g.gain.exponentialRampToValueAtTime(.0001,time+.035);n.connect(filter).connect(g).connect(out);n.start(time);n.stop(time+.05);n.onended=()=>{n.disconnect();filter.disconnect();g.disconnect();};
  }
  function chime(c,out,time,frequency,duration,amplitude){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(.0001,time);g.gain.linearRampToValueAtTime(amplitude,time+.007);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g).connect(out);o.start(time);o.stop(time+duration);o.onended=()=>{o.disconnect();g.disconnect();};}
  function render(c,out,type,options={}){const now=c.currentTime+.004,kind=material(options.theme,options.gameType);
    if(type==='move'){if(options.gameType==='connect4'){strike(c,out,now,'plastic',.8);strike(c,out,now+.075,'plastic',.36);strike(c,out,now+.125,'plastic',.15);}else strike(c,out,now,kind,.85);}
    else if(type==='capture'){strike(c,out,now,kind,.95);strike(c,out,now+.058,kind,.62);}
    else if(type==='chat')chime(c,out,now,740,.085,.035);
    else if(type==='end'){[523.25,659.25,783.99].forEach((f,i)=>chime(c,out,now+i*.095,f,.28,.07));}
  }
  function volume(){try{return Number(localStorage.getItem('makruk_sfx_volume')??.65);}catch{return .65;}}
  function play(type,options={}){try{const c=getContext();if(!c)return;unlock();const out=c.createGain();out.gain.value=level(volume());out.connect(c.destination);render(c,out,type,options);setTimeout(()=>out.disconnect(),1100);}catch{}}
  function media(audio){const c=getContext();if(!c)return null;const source=c.createMediaElementSource(audio),gain=c.createGain();source.connect(gain).connect(c.destination);return{set(value,muted){audio.volume=1;gain.gain.cancelScheduledValues(c.currentTime);gain.gain.setTargetAtTime(muted?0:level(value),c.currentTime,.018);},destroy(){source.disconnect();gain.disconnect();},gain,context:c};}
  root.GameAudio={unlock,getContext,play,render,media,level,material,volume,setVolume(value){try{localStorage.setItem('makruk_sfx_volume',Math.max(0,Math.min(1,Number(value)||0)));}catch{}}};
})(typeof window!=='undefined'?window:globalThis);
