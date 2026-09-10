const {test}=require('node:test');const assert=require('node:assert/strict');
const {stations,station,storage,fetchStations,Player}=require('../public/radio-core');
const entry=(uuid='a')=>({uuid,name:uuid,url:'https://radio.example/'+uuid});
function harness(timeout=80){const audios=[],changes=[];const p=new Player({timeout,loadHls:async()=>{throw Error('unused');},makeAudio:()=>{let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});const a={volume:1,canPlayType:()=>'',play:()=>pending,pause(){this.paused=true;},removeAttribute(){},load(){},resolve,reject};audios.push(a);return a;},onChange:x=>changes.push(x.state)});return{p,audios,changes};}
test('station validation tolerates corrupt storage and removes insecure or duplicate stream URLs',()=>{
 assert.deepEqual(stations({bad:true}),[]);assert.equal(station({...entry(),url:'http://radio.example'}),null);assert.equal(station({...entry(),url:'https://user:pass@radio.example'}),null);
 assert.equal(stations([{...entry(),name:'Channel digital TV 30'},{...entry('video'),codec:'AAC,H.264'}]).length,0);
 assert.equal(stations([null,entry(),{...entry('b'),url:entry().url}]).length,1);
 assert.equal(station({...entry(),url:'https://radio.example/live.m3u8?token=1'}).hls,true);
 const saved=storage({getItem(){throw Error('blocked')},setItem(){throw Error('quota')}});saved.set('favorites','[]');assert.deepEqual(saved.json('favorites',{}),[]);saved.set('bad','{');assert.deepEqual(saved.json('bad',[]),[]);
});
test('late playback success and failure cannot change a newer station',async()=>{
 const{p,audios}=harness();const first=p.play(entry('a'));const firstError=audios[0].onerror;const second=p.play(entry('b'));firstError();audios[0].resolve();await first;assert.equal(p.current.uuid,'b');assert.equal(p.state,'loading');audios[1].resolve();await second;assert.equal(p.state,'playing');p.pause();assert.equal(audios[0].paused,true);assert.equal(audios[1].paused,true);
});
test('pause cancels pending playback and autoplay denial is distinct from stream failure',async()=>{
 const{p,audios}=harness();const pending=p.play(entry());p.pause();audios[0].resolve();await pending;assert.equal(p.state,'paused');const next=p.play(entry());audios[1].reject(Object.assign(Error(),{name:'NotAllowedError'}));await next;assert.equal(p.state,'blocked');
});
test('a hung stream times out and releases audio',async()=>{
 const{p,audios}=harness(10);p.play(entry());await new Promise(r=>setTimeout(r,25));assert.equal(p.state,'timeout');assert.equal(audios[0].paused,true);
});
test('directory timeouts and invalid responses fail over to the next host',async()=>{
 const calls=[];const list=await fetchStations(async(url,{signal})=>{calls.push(url);if(calls.length===1)return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout'))));if(calls.length===2)return{ok:true,json:async()=>({bad:true})};return{ok:true,json:async()=>[entry()]};},['https://a','https://b','https://c'],10);assert.equal(list.length,1);assert.equal(calls.length,3);
});
test('HLS is loaded only for unsupported native playback and destroyed on stop',async()=>{
 let destroyed=false,attached=false;class Hls{static isSupported(){return true}static Events={ERROR:'error'};on(){}loadSource(){}attachMedia(){attached=true}destroy(){destroyed=true}}
 const{p,audios}=harness();p.loadHls=async()=>Hls;const playing=p.play({...entry(),hls:true});await new Promise(r=>setImmediate(r));assert.equal(attached,true);audios[0].resolve();await playing;p.pause();assert.equal(destroyed,true);
});
test('media gain receives slider changes and stale preparation disconnects without replacing new audio',async()=>{
 const{p,audios}=harness();const outputs=[],pending=[];
 p.prepareAudio=()=>new Promise(resolve=>pending.push(resolve));
 const makeOutput=()=>{const o={calls:[],destroyed:false,set(v,m){this.calls.push([v,m])},destroy(){this.destroyed=true}};outputs.push(o);return o;};
 const first=p.play(entry('a')),second=p.play(entry('b'));
 const old=makeOutput();pending[0]({output:old,volumeSupported:true});await first;assert.equal(old.destroyed,true);
 const active=makeOutput();pending[1]({output:active,volumeSupported:true});await new Promise(r=>setImmediate(r));audios[1].resolve();await second;
 p.setVolume(.25);p.setMuted(true);assert.deepEqual(active.calls.slice(-2),[[.25,false],[.25,true]]);assert.equal(p.audio,audios[1]);p.pause();assert.equal(active.destroyed,true);
});
