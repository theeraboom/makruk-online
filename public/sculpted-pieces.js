import * as T from './vendor/three-0.185.1/three.module.min.js';

// CPU templates stay local to this page. Each displayed piece owns its cloned
// buffers/materials, so captures and theme changes can dispose them safely.
const templates=new Map(), surfaces=new Map();
let loading;
export function prepareSculptedPieces(version='') {
  if(loading)return loading;
  loading=(async()=>{
    const response=await fetch('/models/sculpted-pieces.json?v='+encodeURIComponent(version),{signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Piece catalogue unavailable');
    const manifest=await response.json();
    const data=await fetch('/models/'+manifest.file,{signal:AbortSignal.timeout(15000)});
    if(!data.ok)throw new Error('Piece geometry unavailable');
    const binary=await data.arrayBuffer();
    for(const [code,item] of Object.entries(manifest.pieces)) {
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(binary,item.positions.offset,item.positions.count),3));
      geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(binary,item.normals.offset,item.normals.count),3));
      geometry.setIndex(new T.BufferAttribute(new Uint32Array(binary,item.indices.offset,item.indices.count),1));
      const position=geometry.attributes.position,uv=new Float32Array(position.count*2);
      for(let i=0;i<position.count;i++){uv[i*2]=Math.atan2(position.getZ(i),position.getX(i))/(2*Math.PI)+.5;uv[i*2+1]=position.getY(i)/item.height;}
      geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeBoundingSphere();templates.set(code,geometry);
    }
  })().catch(error=>{loading=null;throw error;});
  return loading;
}

function grainCanvas() {
  if(surfaces.has('grain'))return surfaces.get('grain');
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d'),image=ctx.createImageData(512,512);
  // Continuous vertical fibers; periodic across the lathe seam. Restrained
  // contrast reads as polished wood instead of painted stripes.
  for(let y=0;y<512;y++)for(let x=0;x<512;x++) {
    const bend=2.2*Math.sin(y*.012)+.8*Math.sin(y*.044),p=(x+bend)*Math.PI/256;
    const fiber=Math.sin(p*42+1.3*Math.sin(p*7))*.018+Math.sin(p*109+y*.003)*.009;
    const pore=Math.sin(x*19.17+y*37.91)*.003;
    const value=Math.round(246+(fiber+pore)*255),i=(y*512+x)*4;
    image.data[i]=value;image.data[i+1]=value-2;image.data[i+2]=value-5;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);surfaces.set('grain',c);return c;
}
function material(white,set) {
  const carved=set==='thai-carved',classic=set==='classic';
  const map=new T.CanvasTexture(grainCanvas());map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;
  const color=white?(carved?'#b38548':classic?'#bf985f':'#c9ad80'):(carved?'#4e2917':classic?'#382316':'#201711');
  return new T.MeshPhysicalMaterial({color,map,roughness:carved?.36:.27,metalness:0,clearcoat:carved?.22:.38,clearcoatRoughness:.27,envMapIntensity:.8});
}
function add(parent,geometry,material){
  // Soft cavity shading under carved lips keeps fine molding legible at game
  // scale, including when a device's shadow filter is less precise.
  const normals=geometry.attributes.normal;
  if(normals&&material.isMeshPhysicalMaterial){
    const colors=new Float32Array(normals.count*3);
    for(let i=0;i<normals.count;i++){const shade=1-.24*Math.max(0,-normals.getY(i));colors[i*3]=colors[i*3+1]=colors[i*3+2]=shade;}
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));material.vertexColors=true;
  }
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function groundContact(group,type,game) {
  let canvas=surfaces.get('contact');
  if(!canvas){canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,10,32,32,31);g.addColorStop(0,'rgba(24,12,4,.38)');g.addColorStop(.55,'rgba(24,12,4,.24)');g.addColorStop(1,'rgba(24,12,4,0)');c.fillStyle=g;c.fillRect(0,0,64,64);surfaces.set('contact',canvas);}
  const size=type==='P'&&game==='chess-intl'?.76:.9;
  const shadow=add(group,new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.003;shadow.castShadow=shadow.receiveShadow=false;
}
function turned(parent,points,mat) {
  // Subdivide each profile segment with a shape-preserving curve. Sharp molding
  // shoulders have closely spaced control points; the body stays smoothly round.
  const curve=new T.CatmullRomCurve3(points.map(([r,y])=>new T.Vector3(r,y,0)),false,'centripetal');
  const profile=curve.getPoints(Math.max(32,points.length*2)).map(p=>new T.Vector2(Math.max(0,p.x),p.y));
  return add(parent,new T.LatheGeometry(profile,48),mat);
}
function bead(parent,radius,tube,y,mat) {
  const ring=add(parent,new T.TorusGeometry(radius,tube,10,64),mat);ring.rotation.x=Math.PI/2;ring.position.y=y;return ring;
}
function thaiPiece(type,body,set) {
  const group=new T.Group(),carved=set==='thai-carved';
  if(type==='N') {
    const knight=add(group,templates.get('N').clone(),body);knight.scale.setScalar(.94);return group;
  }
  if(type==='P') {
    turned(group,[[0,0],[.25,0],[.29,.022],[.3,.055],[.294,.09],[.275,.135],[.23,.177],[.155,.202],[0,.212]],body);
    bead(group,.283,.008,.075,body);return group;
  }
  const foot=[[0,0],[.29,0],[.33,.02],[.35,.055],[.35,.09],[.335,.12],[.305,.137],[.299,.153],[.304,.168],[.303,.191],[.278,.212],[.256,.24]];
  let crown;
  if(type==='R')crown=[[.24,.27],[.23,.315],[.244,.36],[.276,.4],[.328,.443],[.36,.488],[.363,.526],[.35,.557],[.32,.566],[.301,.555],[.298,.53],[.303,.511],[.272,.475],[.205,.43],[.1,.413],[0,.411]];
  else if(type==='Q')crown=[[.242,.266],[.202,.29],[.198,.317],[.211,.341],[.213,.37],[.197,.399],[.152,.456],[.113,.509],[.071,.559],[.035,.607],[0,.629]];
  else if(type==='B')crown=[[.237,.28],[.245,.32],[.274,.385],[.28,.451],[.26,.51],[.216,.552],[.173,.596],[.16,.637],[.168,.671],[.166,.699],[.138,.72],[.133,.738],[.149,.765],[.147,.8],[.111,.849],[.067,.893],[.031,.943],[0,.987]];
  else crown=[[.237,.27],[.232,.304],[.256,.35],[.286,.414],[.298,.493],[.286,.56],[.253,.616],[.205,.662],[.171,.709],[.165,.745],[.175,.782],[.18,.812],[.164,.833],[.154,.858],[.152,.891],[.181,.915],[.181,.942],[.148,.964],[.13,.997],[.135,1.029],[.156,1.048],[.151,1.075],[.115,1.103],[.089,1.145],[.081,1.18],[.11,1.224],[.102,1.285],[.071,1.353],[.041,1.403],[.019,1.445],[0,1.488]];
  turned(group,[...foot,...crown],body);
  if(carved) {
    // Fine lathe-cut molding belongs to the same wood, not metallic decoration.
    for(const y of [.153,.185])bead(group,.301,.006,y,body);
    if(type==='K'||type==='B')for(let i=0;i<3;i++)bead(group,.24+i*.012,.004,.32+i*.017,body);
  }
  return group;
}

export function sculptedPiece(code,game,set) {
  if(!templates.size)return null;
  const white=code[0]==='w',type=code[1],body=material(white,set);
  const group=game==='chess'?thaiPiece(type,body,set):new T.Group();
  if(game==='chess-intl')add(group,templates.get(type).clone(),body);
  // The source horse faces -Z: white advances toward decreasing board rows,
  // while black advances toward +Z. Keep this independent of the camera.
  if(type==='N')group.rotation.y=white?0:Math.PI;
  groundContact(group,type,game);
  group.userData.sculpted=true;return group;
}
