import * as T from './vendor/three-0.185.1/three.module.min.js';
import { OrbitControls } from './vendor/three-0.185.1/OrbitControls.js';
import { RoomEnvironment } from './vendor/three-0.185.1/RoomEnvironment.js';
import { sculptedPiece, prepareSculptedPieces } from './sculpted-pieces.js';
export { prepareSculptedPieces };

const PALETTES = {
  wood: ['#e7c998','#a67448','#94633c','#c1a074','#1c292b'],
  darkwood: ['#cba67c','#634b40','#4a3024','#b49362','#2f2b29'],
  marble: ['#f0f0e9','#78908b','#aab9b3','#e0d4ad','#343f40'],
  neon: ['#405d77','#17273c','#172434','#62ebdd','#172533'],
  green: ['#ccdac1','#437060','#274e43','#b8c990','#273b35'],
  blue: ['#c5dfeb','#356887','#234558','#9ac6d5','#283a48'],
  purple: ['#e1cfea','#77548d','#4f345f','#d4b9e3','#392f43'],
  gray: ['#cfced0','#5c6269','#3a4148','#b8bec3','#30343a']
};
const deg = Math.PI / 180;

// Deterministic surface grain: no downloads, and the material stays the same
// across moves. Textures and geometry are disposed when a theme is replaced.
function surfaceTexture(kind, base) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'); c.fillStyle=base; c.fillRect(0,0,256,256);
  let seed=37; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<180;i++) {
    c.strokeStyle=`rgba(${kind==='marble'?'255,255,255':'35,17,4'},${random()*.075})`;
    c.lineWidth=kind==='marble'?random()*2.5:random()*.9;
    c.beginPath();const y=random()*256;c.moveTo(-5,y);
    if(kind==='marble')c.bezierCurveTo(70,y-60,140,y+100,270,y-90);
    else c.bezierCurveTo(70,y+random()*9,160,y-random()*9,270,y+3);
    c.stroke();
  }
  const t=new T.CanvasTexture(canvas); t.colorSpace=T.SRGBColorSpace;
  t.wrapS=t.wrapT=T.RepeatWrapping; t.anisotropy=4; return t;
}
function labelTexture(text,color='#deca9f',bg=null) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const c=canvas.getContext('2d');if(bg){c.fillStyle=bg;c.fillRect(0,0,256,128);}
  c.fillStyle=color;c.font=`600 ${text.length>4?44:text.length>2?56:74}px "Manrope", "Noto Sans Thai", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,128,69);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
function disposeTree(root) {
  const geometries=new Set(), materials=new Set(), textures=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);if(m.map)textures.add(m.map);}});
  for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  root.clear();
}
function mat(color,roughness=.4,metalness=.05,extra={}) {return new T.MeshStandardMaterial({color,roughness,metalness,...extra});}
function mesh(geometry,material,parent,x=0,y=0,z=0) {
  const object=new T.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
}
function box(parent,w,h,d,material,x=0,y=0,z=0) {return mesh(new T.BoxGeometry(w,h,d),material,parent,x,y,z);}
function beveledBox(parent,w,h,d,material,y) {
  const b=.065,x=w/2-b,z=d/2-b,s=new T.Shape();
  s.moveTo(-x,-z);s.lineTo(x,-z);s.lineTo(x,z);s.lineTo(-x,z);s.closePath();
  const geometry=new T.ExtrudeGeometry(s,{depth:h-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:3,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-(h-2*b)/2,0);return mesh(geometry,material,parent,0,y);
}
function contactShadow(parent,c4) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.shadowColor='#000';c.shadowBlur=23;c.fillStyle='#000';c.fillRect(43,43,170,170);
  const m=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,opacity:.38,depthWrite:false});
  const o=mesh(new T.PlaneGeometry(c4?11:11.5,c4?5:11.5),m,parent,0,-.687,0);o.rotation.x=-Math.PI/2;o.castShadow=false;
}
function lathe(parent,points,material) {return mesh(new T.LatheGeometry(points.map(([r,y])=>new T.Vector2(r,y)),32),material,parent);}
function sphere(parent,r,material,x,y,z=0,sx=1,sy=1,sz=1) {const o=mesh(new T.SphereGeometry(r,20,12),material,parent,x,y,z);o.scale.set(sx,sy,sz);return o;}
function ring(parent,r,t,material,y=0) {const o=mesh(new T.TorusGeometry(r,t,8,40),material,parent,0,y,0);o.rotation.x=Math.PI/2;return o;}
function inscription(parent,text,color,w,h,x,y,z,rotation=-Math.PI/2) {
  const o=mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:labelTexture(text,color),transparent:true,depthWrite:false,side:T.DoubleSide}),parent,x,y,z);
  o.rotation.x=rotation;o.castShadow=false;return o;
}
function makePiece(code,game,set,lang) {
  if((game==='chess'||game==='chess-intl')&&set!=='outline'&&set!=='thai-letters') {
    const piece=sculptedPiece(code,game,set);if(piece)return piece;
  }
  const group=new T.Group(),white=code[0]==='w',type=code[1];
  const carved=set==='thai-carved',outline=set==='outline',classic=set==='classic';
  const body=mat(white?(carved?'#e0b676':classic?'#f2ddae':'#f6eed9'):(carved?'#623623':classic?'#43342c':'#202f35'),carved?.43:.26,.1,{wireframe:outline});
  const trim=mat(white?'#b89651':'#c69b55',.25,.65,{wireframe:outline});
  const detail=mat(white?'#513827':'#f4dfac',.32,.3,{wireframe:outline});
  const base=()=>{lathe(group,[[0,0],[.3,0],[.35,.035],[.35,.085],[.31,.12],[.29,.16],[.29,.19],[.23,.23],[0,.23]],body);ring(group,.315,.017,trim,.11);};
  if(game.startsWith('checkers')) {
    const height=type==='K'?.32:.19;
    lathe(group,[[0,0],[.34,0],[.38,.04],[.38,height-.025],[.34,height],[0,height]],body);
    ring(group,.34,.015,trim,.065);ring(group,.29,.018,trim,height+.003);
    if(type==='K')ring(group,.34,.015,trim,.22);
    if(set==='thai-letters'){inscription(group,window.Pieces.getName(code,game,lang),white?'#543829':'#fff1c9',.58,.3,0,height+.02,0);group.rotation.y=white?0:Math.PI;}
    else if(type==='K')inscription(group,'♛',white?'#745024':'#ffe0a0',.5,.25,0,height+.02,0);
    else ring(group,.19,.009,detail,height+.005);
    if(carved){ring(group,.345,.008,detail,height*.5);ring(group,.245,.01,trim,height+.005);}
    return group;
  }
  if(set==='thai-letters') {
    lathe(group,[[0,0],[.34,0],[.36,.06],[.35,.19],[.29,.25],[0,.25]],body);ring(group,.31,.02,trim,.225);
    inscription(group,window.Pieces.getName(code,game,lang),white?'#543829':'#fff1c9',.59,.3,0,.257,0);group.rotation.y=white?0:Math.PI;return group;
  }
  const thai=game==='chess';
  if(thai&&type==='P') {
    sphere(group,.3,body,0,.13,0,1,.46,.82);ring(group,.245,.012,trim,.085);
    box(group,.018,.012,.3,detail,0,.266,0);return group;
  }
  base();
  if(type==='N') {
    // A thick sculpted horse silhouette, with muzzle, mane and paired eyes.
    const s=new T.Shape();s.moveTo(-.23,.2);s.lineTo(.2,.2);s.bezierCurveTo(.18,.48,.04,.56,.23,.69);s.lineTo(.37,.71);s.lineTo(.38,.84);s.lineTo(.17,.98);s.lineTo(.12,1.13);s.lineTo(.035,1.04);s.lineTo(-.1,1.11);s.lineTo(-.11,.96);s.bezierCurveTo(-.32,.83,-.31,.42,-.23,.2);
    const g=new T.ExtrudeGeometry(s,{depth:.26,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.05,bevelThickness:.045,curveSegments:10});g.translate(0,0,-.13);
    mesh(g,body,group);sphere(group,.14,body,.25,.81,0,1.25,.68,1.05);
    for(const z of [-.115,.115]){const ear=mesh(new T.ConeGeometry(.05,.2,12),body,group,.02,1.105,z);ear.rotation.z=.18;}
    sphere(group,.028,detail,.16,.89,.177);sphere(group,.028,detail,.16,.89,-.177);
    for(let i=0;i<5;i++)sphere(group,.045,trim,-.19-i*.012,.88-i*.09,0,.7,.9,2.4);
    group.rotation.y=white?.2:Math.PI+.2;
  } else if(type==='R'&&thai) {
    lathe(group,[[0,.2],[.22,.2],[.2,.33],[.25,.42],[.35,.5],[.35,.57],[.27,.57],[.24,.49],[0,.45]],body);ring(group,.32,.025,trim,.54);
  } else if(type==='R') {
    lathe(group,[[0,.2],[.23,.2],[.19,.3],[.18,.64],[.29,.7],[.29,.85],[.21,.85],[.21,.76],[0,.76]],body);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const b=box(group,.13,.15,.13,body,Math.sin(a)*.24,.89,Math.cos(a)*.24);b.rotation.y=a;}
    ring(group,.21,.02,trim,.31);
  } else if(thai) {
    const h=type==='K'?1.17:type==='B'?.89:.64;
    lathe(group,[[0,.2],[.23,.2],[.19,.28],[.21,.33],[.24,.38],[.2,.43],[.12,.43+(h-.43)*.3],[.14,.43+(h-.43)*.53],[.09,.43+(h-.43)*.76],[.025,h],[0,h]],body);
    ring(group,.205,.014,trim,.385);
    if(type==='K'){ring(group,.13,.017,trim,.87);sphere(group,.06,trim,0,1.14);}
    if(carved)for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere(group,.036,trim,Math.sin(a)*.205,.46,Math.cos(a)*.205,.7,1.6,.7);}
  } else {
    const h=type==='K'?1.05:type==='Q'?1.0:type==='B'?.9:.63;
    lathe(group,[[0,.2],[.23,.2],[.23,.26],[.16,.3],[.115,h*.65],[.16,h*.76],[.19,h*.8],[.16,h*.86],[.09,h*.89],[0,h*.89]],body);ring(group,.21,.014,trim,.265);
    if(type==='P')sphere(group,.145,body,0,.64);
    if(type==='B'){sphere(group,.145,body,0,.86,0,1,1.42,1);const slash=box(group,.024,.17,.24,detail,.035,.96);slash.rotation.z=-.4;sphere(group,.044,trim,0,1.08);}
    if(type==='Q'){lathe(group,[[0,.86],[.15,.86],[.24,1.04],[.19,1.07],[.14,.95],[0,.95]],body);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;sphere(group,.042,trim,Math.sin(a)*.213,1.065,Math.cos(a)*.213);}sphere(group,.06,body,0,1.08);}
    if(type==='K'){sphere(group,.125,body,0,.99);box(group,.08,.29,.08,trim,0,1.19);box(group,.26,.07,.08,trim,0,1.23);}
  }
  if(carved){ring(group,.29,.012,detail,.165);ring(group,.25,.011,trim,.225);}
  return group;
}

export class BoardScene {
  constructor(host,{onSquare,onColumn,onCameraChange,onError}) {
    this.host=host;this.callbacks={onSquare,onColumn,onCameraChange,onError};this.disposed=false;this.visible=true;this.frame=0;this.animations=[];this.pieces=new Map();this.snapshot=null;
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(38,1,.1,100);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.9;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.canvas=this.renderer.domElement;this.canvas.className='board-canvas';this.canvas.setAttribute('aria-hidden','true');this.canvas.style.touchAction='none';host.append(this.canvas);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enablePan=false;this.controls.enableDamping=true;this.controls.dampingFactor=.13;
    this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.7;this.controls.minPolarAngle=.025;this.controls.maxPolarAngle=81*deg;
    this.controls.minDistance=9;this.controls.maxDistance=30;this.controls.touches.TWO=T.TOUCH.DOLLY_ROTATE;
    this.controls.addEventListener('change',()=>{this.requestRender();this.callbacks.onCameraChange?.({tilt:this.controls.getPolarAngle()/deg,rotation:this.controls.getAzimuthalAngle()/deg,distance:this.controls.getDistance()});});
    this.scene.add(new T.HemisphereLight('#eef4ff','#57432f',.24));
    const key=new T.DirectionalLight('#fff0d8',3.1);key.position.set(-4,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});key.shadow.normalBias=.009;key.shadow.bias=-.00008;key.shadow.radius=3;this.scene.add(key);
    const rim=new T.DirectionalLight('#c5dcf5',.85);rim.position.set(7,6,-6);this.scene.add(rim);
    const environment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.35;environment.dispose();pmrem.dispose();
    this.table=new T.Group();this.markers=new T.Group();this.pieceLayer=new T.Group();this.scene.add(this.table,this.markers,this.pieceLayer);
    this.raycaster=new T.Raycaster();this.pointer=new T.Vector2();this.installInput();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    this.onVisibility=()=>{if(!document.hidden)this.requestRender();};document.addEventListener('visibilitychange',this.onVisibility);
    this.onContextLost=e=>{e.preventDefault();this.callbacks.onError?.('context-lost');};this.canvas.addEventListener('webglcontextlost',this.onContextLost);
    this.setView({tilt:43,rotation:0});this.resize();
  }
  requestRender() {if(this.disposed||this.frame||!this.visible||document.hidden)return;this.frame=requestAnimationFrame(time=>this.draw(time));}
  draw(time) {
    this.frame=0;if(this.disposed||!this.visible)return;
    const moved=this.controls.update();this.animations=this.animations.filter(a=>{
      const t=Math.min(1,(time-a.start)/a.duration),ease=1-(1-t)**3;
      a.object.position.lerpVectors(a.from,a.to,ease);if(!a.drop)a.object.position.y+=Math.sin(t*Math.PI)*.25;
      return t<1;
    });
    this.renderer.render(this.scene,this.camera);if(moved||this.animations.length)this.requestRender();
  }
  resize() {
    const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;
    const previousAspect=this.camera.aspect;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    if(this.snapshot&&Math.abs(previousAspect-this.camera.aspect)>.15)this.setView({tilt:this.controls.getPolarAngle()/deg,rotation:this.controls.getAzimuthalAngle()/deg});
    this.requestRender();
  }
  setVisible(value) {this.visible=value;this.controls.enabled=value;if(!value&&this.frame){cancelAnimationFrame(this.frame);this.frame=0;}if(value){this.resize();this.requestRender();}}
  setView({tilt=43,rotation=0,distance}={}) {
    const c4=this.snapshot?.gameType==='connect4';
    // Drain any remaining gesture damping before applying an explicit preset.
    this.controls.enableDamping=false;this.controls.update();
    this.controls.target.set(0,c4?2.9:-.2,0);
    let radius=distance??16.5;
    const polar=Math.max(.025,Math.min(81*deg,tilt*deg));
    const position=()=>{this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSphericalCoords(radius,polar,rotation*deg));this.camera.lookAt(this.controls.target);this.camera.updateMatrixWorld();};
    // Fit the board edges and actual piece envelope, rather than an oversized
    // cube. This leaves comfortable tap targets on portrait phone screens.
    if(distance===undefined) {
      const points=[];
      for(const [half,y0,y1,depth] of c4?[[4.4,-.75,6.8,1.65]]:[[4.55,-.7,.08,4.55],[3.85,.05,1.82,3.85]])
        for(const x of [-half,half])for(const y of [y0,y1])for(const z of [-depth,depth])points.push(new T.Vector3(x,y,z));
      let near=9,far=29;
      for(let attempt=0;attempt<13;attempt++) {
        radius=(near+far)/2;position();let extent=0;
        for(const point of points){const p=point.clone().project(this.camera);extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));}
        if(extent>.91)near=radius;else far=radius;
      }
      radius=far;
    }
    position();this.controls.update();
    this.controls.enableDamping=true;this.requestRender();
  }
  zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();this.requestRender();}
  installInput() {
    this.contacts=new Set();this.tap=null;
    this.onDown=e=>{this.contacts.add(e.pointerId);if(this.contacts.size===1&&e.button===0)this.tap={id:e.pointerId,x:e.clientX,y:e.clientY,cancelled:false};else if(this.tap)this.tap.cancelled=true;};
    this.onMove=e=>{if(this.tap&&Math.hypot(e.clientX-this.tap.x,e.clientY-this.tap.y)>7)this.tap.cancelled=true;};
    this.onUp=e=>{const tap=this.tap;this.contacts.delete(e.pointerId);if(tap&&tap.id===e.pointerId){this.tap=null;if(!tap.cancelled&&e.type==='pointerup'&&this.visible)this.pick(e.clientX,e.clientY);}if(!this.contacts.size)this.tap=null;};
    // Capture runs before OrbitControls releases pointer capture on pointerup.
    for(const [event,fn] of [['pointerdown',this.onDown],['pointermove',this.onMove],['pointerup',this.onUp],['pointercancel',this.onUp]])this.canvas.addEventListener(event,fn,true);
  }
  pick(clientX,clientY) {
    if(!this.snapshot)return;const rect=this.canvas.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
    this.camera.updateMatrixWorld();this.scene.updateMatrixWorld(true);this.raycaster.setFromCamera(this.pointer,this.camera);
    if(this.snapshot.gameType==='connect4') {
      const p=this.raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),0),new T.Vector3());
      if(p&&p.x>=-3.5&&p.x<3.5&&p.y>=.3&&p.y<7)this.callbacks.onColumn?.(Math.floor(p.x+3.5));return;
    }
    const hit=this.raycaster.intersectObject(this.pieceLayer,true)[0];let object=hit?.object;
    while(object&&!object.userData.square)object=object.parent;
    if(object?.userData.square){const {r,c}=object.userData.square;this.callbacks.onSquare?.(r,c);return;}
    const p=this.raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.045),new T.Vector3());
    if(p&&p.x>=-4&&p.x<4&&p.z>=-4&&p.z<4)this.callbacks.onSquare?.(Math.floor(p.z+4),Math.floor(p.x+4));
  }
  // Also used by guided hints and the integration tests: projection never changes game state.
  projectSquare(r,c,piece=false) {
    const p=this.snapshot?.gameType==='connect4'?new T.Vector3(c-3,5.7-r,0):new T.Vector3(c-3.5,piece?.42:.05,r-3.5);
    this.camera.updateMatrixWorld();p.project(this.camera);const rect=this.canvas.getBoundingClientRect();return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
  }
  buildTable(game,theme,scenery=false) {
    disposeTree(this.table);const [light,dark,frame,accent,floor]=PALETTES[theme]||PALETTES.wood,kind=theme==='marble'?'marble':'wood';
    this.scene.background=scenery?null:new T.Color(floor);this.scene.fog=scenery?null:new T.Fog(floor,22,65);
    const edge=mat(frame,.33,.12,{map:surfaceTexture(kind,'#ffffff')}),trim=mat(accent,.28,.6),ground=scenery?new T.ShadowMaterial({opacity:.25}):mat(floor,.96,0);
    box(this.table,200,.15,200,ground,0,-.77,0).castShadow=false;contactShadow(this.table,game==='connect4');
    if(game==='connect4') {
      const shape=new T.Shape();shape.moveTo(-3.85,.25);shape.lineTo(3.85,.25);shape.lineTo(3.85,6.6);shape.lineTo(-3.85,6.6);shape.closePath();
      for(let r=0;r<6;r++)for(let c=0;c<7;c++){const hole=new T.Path();hole.absarc(c-3,5.7-r,.407,0,Math.PI*2,true);shape.holes.push(hole);}
      const slab=new T.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.04,curveSegments:20});slab.translate(0,0,-.16);mesh(slab,edge,this.table);
      box(this.table,.22,7,.44,trim,-3.92,2.9);box(this.table,.22,7,.44,trim,3.92,2.9);
      for(const x of [-3.92,3.92])box(this.table,.8,.22,3.2,edge,x,-.59);
      for(let c=0;c<7;c++){inscription(this.table,String(c+1),accent,.32,.16,c-3,6.35,.211,0);const back=inscription(this.table,String(c+1),accent,.32,.16,c-3,6.35,-.211,0);back.rotation.y=Math.PI;}
      return;
    }
    beveledBox(this.table,8.95,.48,8.95,edge,-.29);box(this.table,9.02,.045,9.02,trim,0,-.49);box(this.table,8.9,.12,8.9,edge,0,-.56);
    const tileGeometry=new T.BoxGeometry(.998,.095,.998);
    const tiles=[mat(light,.48,.06,{map:surfaceTexture(kind,'#ffffff')}),mat(dark,.42,.07,{map:surfaceTexture(kind,'#ffffff')})];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++)mesh(tileGeometry,tiles[(r+c)%2],this.table,c-3.5,0,r-3.5);
    for(const sign of [-1,1]){
      box(this.table,8.07,.02,.035,trim,0,.047,sign*4.035);box(this.table,.035,.02,8.07,trim,sign*4.035,.047,0);
      for(let i=0;i<8;i++){
        const letter=inscription(this.table,'abcdefgh'[i],theme==='wood'?'#5b3c22':accent,.3,.15,i-3.5,-.04,sign*4.26);if(sign<0)letter.rotation.z=Math.PI;
        const rank=inscription(this.table,String(8-i),theme==='wood'?'#5b3c22':accent,.25,.15,sign*4.26,-.04,i-3.5);rank.rotation.z=sign<0?-Math.PI/2:Math.PI/2;
      }
    }
    for(const x of [-4.25,4.25])for(const z of [-4.25,4.25])sphere(this.table,.035,trim,x,-.017,z,1,.2,1);
  }
  update(state) {
    if(this.disposed||!state.board)return;const old=this.snapshot;
    const newTable=!old||old.theme!==state.theme||old.gameType!==state.gameType||old.scenery!==state.scenery;
    const newPieces=!old||old.pieceSet!==state.pieceSet||old.gameType!==state.gameType||(state.pieceSet==='thai-letters'&&old.lang!==state.lang);
    if(newTable)this.buildTable(state.gameType,state.theme,state.scenery);
    if(newPieces){disposeTree(this.pieceLayer);this.pieces.clear();this.animations=[];}
    const c4=state.gameType==='connect4';
    if(old&&state.moveCount<old.moveCount)this.animations=[];
    const last=state.lastMove;const changed=old&&state.moveCount>old.moveCount;
    // Reconcile by square. Moving geometry is retained, including each capture
    // in a forced chain. Server position remains the sole source of truth.
    if(changed&&!newPieces&&last?.from&&last?.to){
      const from=last.from.r+','+last.from.c,to=last.to.r+','+last.to.c,mover=this.pieces.get(from),captured=this.pieces.get(to);
      if(captured){this.pieceLayer.remove(captured);disposeTree(captured);this.pieces.delete(to);}
      if(mover){this.pieces.delete(from);this.pieces.set(to,mover);}
    }
    const present=new Set();
    for(let r=0;r<state.board.length;r++)for(let c=0;c<state.board[r].length;c++) {
      const code=state.board[r][c];if(!code)continue;const key=r+','+c;present.add(key);let object=this.pieces.get(key);
      if(object&&object.userData.code!==code){this.pieceLayer.remove(object);disposeTree(object);this.pieces.delete(key);object=null;}
      if(!object){
        if(c4){object=new T.Group();const color=code==='Y'?'#ffc631':'#d7384c',material=mat(color,.27,.13);const coin=mesh(new T.CylinderGeometry(.365,.365,.25,40),material,object);coin.rotation.x=Math.PI/2;for(const z of [-.133,.133]){const ringMesh=mesh(new T.TorusGeometry(.275,.014,8,36),material,object,0,0,z);ringMesh.castShadow=false;}}
        else object=makePiece(code,state.gameType,state.pieceSet,state.lang);
        object.userData.code=code;this.pieces.set(key,object);this.pieceLayer.add(object);
      }
      object.userData.square={r,c};const destination=c4?new T.Vector3(c-3,5.7-r,0):new T.Vector3(c-3.5,.055,r-3.5);
      const isLast=changed&&last?.to?.r===r&&last?.to?.c===c;
      if(isLast&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        this.animations=this.animations.filter(a=>a.object!==object);
        const from=c4?new T.Vector3(c-3,7.2,0):last.from?new T.Vector3(last.from.c-3.5,.055,last.from.r-3.5):destination.clone();
        this.animations.push({object,from,to:destination,start:performance.now(),duration:c4?420:280,drop:c4});object.position.copy(from);
      }else if(!this.animations.some(a=>a.object===object))object.position.copy(destination);
    }
    for(const[key,object]of this.pieces)if(!present.has(key)){this.pieceLayer.remove(object);disposeTree(object);this.pieces.delete(key);this.animations=this.animations.filter(a=>a.object!==object);}
    disposeTree(this.markers);
    const mark=(r,c,color,style='ring')=>{
      const material=new T.MeshBasicMaterial({color,transparent:true,opacity:style==='tile'?.28:.92,side:T.DoubleSide,depthWrite:false});let object;
      if(c4){object=mesh(new T.TorusGeometry(.42,.034,8,32),material,this.markers,c-3,5.7-r,.22);const back=object.clone();back.position.z=-.22;this.markers.add(back);}
      else {object=mesh(style==='tile'?new T.PlaneGeometry(.97,.97):new T.RingGeometry(style==='dot'?0:.37,style==='dot'?.1:.405,40),material,this.markers,c-3.5,.053,r-3.5);object.rotation.x=-Math.PI/2;}
      object.castShadow=false;
    };
    if(!c4){for(const p of [last?.from,last?.to])if(p)mark(p.r,p.c,'#e8bb56','tile');if(state.selected)mark(state.selected.r,state.selected.c,'#57ffe0');for(const p of state.validMoves||[])mark(p.r,p.c,p.capture||p.captured?'#ff8579':'#67efd3',p.capture||p.captured?'ring':'dot');if(state.check)mark(state.check.r,state.check.c,'#ff4d67');}
    else for(const p of state.winCells||[])mark(p.r,p.c,'#fff3b9');
    this.snapshot={...state,board:state.board.map(row=>row.slice())};
    if(!old||old.gameType!==state.gameType)this.setView({tilt:c4?75:43,rotation:(state.flipped?180:0)-(c4?10:12)});
    this.requestRender();
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();
    document.removeEventListener('visibilitychange',this.onVisibility);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);
    for(const[event,fn]of [['pointerdown',this.onDown],['pointermove',this.onMove],['pointerup',this.onUp],['pointercancel',this.onUp]])this.canvas.removeEventListener(event,fn,true);
    disposeTree(this.scene);this.environment.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove();this.pieces.clear();this.animations=[];
  }
}
