// Offline asset build. Requires meshoptimizer 1.0.1 and the original glTF/bin
// from KhronosGroup/glTF-Sample-Assets/Models/ABeautifulGame/glTF.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const source = process.argv[2];
const output = process.argv[3] || 'public/models';
const { MeshoptSimplifier:S } = await import(pathToFileURL(process.env.MESHOPT_MODULE || '../mesh-tools/node_modules/meshoptimizer/index.js'));
await S.ready;
const gltf = JSON.parse(await fs.readFile(path.join(source,'ABeautifulGame.gltf'),'utf8'));
const bin = await fs.readFile(path.join(source,'ABeautifulGame.bin'));
function accessor(id) {
  const a=gltf.accessors[id], view=gltf.bufferViews[a.bufferView], count={SCALAR:1,VEC2:2,VEC3:3}[a.type];
  const type={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];
  const data=new type(a.count*count), offset=(view.byteOffset||0)+(a.byteOffset||0), stride=view.byteStride||count*type.BYTES_PER_ELEMENT;
  for(let v=0;v<a.count;v++) for(let c=0;c<count;c++) {
    const p=offset+v*stride+c*type.BYTES_PER_ELEMENT;
    data[v*count+c]=type===Float32Array?bin.readFloatLE(p):type===Uint16Array?bin.readUInt16LE(p):bin.readUInt32LE(p);
  }
  return data;
}
const spec={K:{meshes:[0],height:1.7,faces:5500},Q:{meshes:[2],height:1.55,faces:5000},R:{meshes:[9],height:1.12,faces:3800},B:{meshes:[13],height:1.4,faces:4800},N:{meshes:[11],height:1.3,faces:10000},P:{meshes:[6,5],height:.88,faces:3400}};
const chunks=[], manifest={version:1,source:'A Beautiful Game',pieces:{}};
let offset=0;
function append(array){const data=Buffer.from(array.buffer);const at=offset;chunks.push(data);offset+=data.length;return {offset:at,count:array.length};}
for(const [code,config] of Object.entries(spec)) {
  const pos=[],norm=[],idx=[];
  for(const m of config.meshes) {
    const p=gltf.meshes[m].primitives[0], pp=accessor(p.attributes.POSITION), nn=accessor(p.attributes.NORMAL), ii=accessor(p.indices), start=pos.length/3;
    // Pawn crown is a child mesh with a local transform in the source scene.
    const t=m===5?gltf.nodes[5].translation:[0,0,0];
    for(let i=0;i<pp.length;i++)pos.push(pp[i]+t[i%3]);
    for(const n of nn)norm.push(n); for(const i of ii)idx.push(start+i);
  }
  const positions=new Float32Array(pos), normals=new Float32Array(norm), indices=new Uint32Array(idx);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++){const j=i%3;lo[j]=Math.min(lo[j],positions[i]);hi[j]=Math.max(hi[j],positions[i]);}
  const scale=config.height/(hi[1]-lo[1]);
  for(let i=0;i<positions.length;i++){const j=i%3;positions[i]=(positions[i]-(j===1?lo[1]:(lo[j]+hi[j])/2))*scale;}
  const [simplified,error]=S.simplifyWithAttributes(indices,positions,3,normals,3,[.4,.4,.4],null,config.faces*3,.0025,['Permissive']);
  const remap=new Map(), smallPositions=[],smallNormals=[],smallIndices=[];
  for(const old of simplified){if(!remap.has(old)){remap.set(old,remap.size);smallPositions.push(...positions.subarray(old*3,old*3+3));smallNormals.push(...normals.subarray(old*3,old*3+3));}smallIndices.push(remap.get(old));}
  manifest.pieces[code]={positions:append(new Float32Array(smallPositions)),normals:append(new Float32Array(smallNormals)),indices:append(new Uint32Array(smallIndices)),height:config.height,triangles:smallIndices.length/3,error};
}
const binary=Buffer.concat(chunks),hash=createHash('sha256').update(binary).digest('hex').slice(0,12);
manifest.file=`sculpted-pieces-${hash}.bin`;
await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,manifest.file),binary);
await fs.writeFile(path.join(output,'sculpted-pieces.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({bytes:binary.length,pieces:Object.fromEntries(Object.entries(manifest.pieces).map(([k,v])=>[k,{triangles:v.triangles,error:v.error}]))}));
