import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildTrees} from './trees.js';
import {cardPlant} from './groundcover.js';
import {SpatialHash} from './scatter.js';
import {Heightfield} from '../world/heightfield.js';
import {LIANA_WIND_HEADER,LIANA_WIND_CHUNK,lianaBranchOffsetCPU} from './liana-wind.js';
import {U} from '../render/shared.js';
const texture=new THREE.Texture(),tex={leaf:Object.fromEntries(['oak','ash','pine','aspen'].map(k=>[k,texture])),bark:{oak:texture,pine:texture,birch:texture},barkN:{}};
const hf=new Heightfield(),hash=new SpatialHash(),trees=buildTrees(hf,tex,hash),links=trees.userData.detail.lianas;
const vec=(a,i)=>[a.getX(i),a.getY(i),a.getZ(i)];
// Independently transcribed branch shader macro law; inputs from real geometry/matrix.
function branchLaw(matrix,height,time,strength,gust,wind){
 const phase=matrix.elements[12]*.131+matrix.elements[14]*.173;
 const q=THREE.MathUtils.smoothstep(Math.sin((matrix.elements[12]*wind[0]+matrix.elements[14]*wind[1])*.08-time*.9*(.5+strength)),.6,1)*gust;
 const b=Math.pow(THREE.MathUtils.clamp(height,0,1.5),2.2);
 const sw=.6*Math.sin(time*1.25+phase)+.3*Math.sin(time*2.15+phase*1.7)+.1*Math.sin(time*3.7+phase*2.3);
 return new THREE.Vector3(wind[0],0,wind[1]).multiplyScalar(sw*b*.16*(.4+2.2*strength)*(1+q)+.6*strength*strength*b);
}
test('all standalone-tree measured liana endpoints agree with actual branch macro wind at 0–60 seconds',()=>{
 assert.equal(links.length,8);let worst=0; // tree-only fixture; full world has seven after rock exclusions
 for(const l of links)for(const [which,ref,offset] of [['start',l.startRef,0],['end',l.endRef,132]]){
  const tree=trees.getObjectByName(ref.treeMesh),m=new THREE.Matrix4();tree.getMatrixAt(ref.instance,m);
  const h=tree.geometry.attributes.position.getY(ref.vertex),g=trees.getObjectByName('liana-stems').geometry;
  const endpoint=vec(g.getAttribute(which==='start'?'aLianaStart':'aLianaEnd'),l.stemRange[0]+offset);
  assert.deepEqual(endpoint,[m.elements[12],m.elements[14],h]);assert.equal(ref.branchLocalHeight,h);
  for(const strength of [0,.8,1.5])for(let step=0;step<=600;step++){
   const time=step/10,wind=[.8,.6],a=new THREE.Vector3(...lianaBranchOffsetCPU(endpoint,{time,wind,strength,gust:1}));
   worst=Math.max(worst,a.distanceTo(branchLaw(m,h,time,strength,1,wind)));
  }
 }
 assert.ok(worst<1e-12);console.log('CPU maximum endpoint displacement-law disagreement',worst);
});
test('rings/cards have finite constant t/endpoints; rest vertices and card pivots are intact',()=>{
 for(const [name,size,rangeKey]of [['liana-stems',6,'stemRange'],['liana-leaves',4,'cardRange']]){
  const g=trees.getObjectByName(name).geometry,p=g.attributes.position;
  for(const a of Object.values(g.attributes))assert.ok([...a.array].every(Number.isFinite));
  for(const l of links){const [start,end]=l[rangeKey];
   for(let i=start;i<end;i+=size){for(let j=0;j<size;j++){
    for(const k of ['aLianaStart','aLianaEnd'])assert.deepEqual(vec(g.attributes[k],i+j),vec(g.attributes[k],start));
    assert.equal(g.attributes.aLianaT.getX(i+j),g.attributes.aLianaT.getX(i));
   }
   if(size===4){const c=new THREE.Vector3();for(let j=0;j<4;j++)c.add(new THREE.Vector3(...vec(p,i+j)));c.multiplyScalar(.25);assert.ok(c.distanceTo(new THREE.Vector3(...vec(g.attributes.aLeafPivot,i)))<2e-6);}
   }
   if(size===6){assert.equal(g.attributes.aLianaT.getX(start),0);assert.equal(g.attributes.aLianaT.getX(end-1),1);
    // Tube seams duplicate first vertex: average five distinct ring vertices.
    for(const [at,ref]of [[start,l.startRef],[end-6,l.endRef]]){const c=new THREE.Vector3();for(let j=0;j<5;j++)c.add(new THREE.Vector3(...vec(p,at+j)));c.multiplyScalar(.2);const m=new THREE.Matrix4(),tree=trees.getObjectByName(ref.treeMesh);tree.getMatrixAt(ref.instance,m);const branch=new THREE.Vector3().fromBufferAttribute(tree.geometry.attributes.position,ref.vertex).applyMatrix4(m);assert.ok(c.distanceTo(branch)<3e-6);}
   }
  }
 }
});
test('owned liana color/depth/distance compose identical wind; snag material unaffected',()=>{
 for(const name of ['liana-stems','liana-leaves']){const mesh=trees.getObjectByName(name),shaders=[];
  for(const material of [mesh.material,mesh.customDepthMaterial,mesh.customDistanceMaterial]){
   const lib=THREE.ShaderLib[material.isMeshDepthMaterial?'depth':material.isMeshDistanceMaterial?'distance':'standard'];
   const s={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};material.onBeforeCompile(s,{});shaders.push(s);
   assert.ok(s.vertexShader.includes(LIANA_WIND_HEADER));assert.ok(s.vertexShader.includes(LIANA_WIND_CHUNK));
   for(const k of ['uTime','uWind','uWindStrength','uWindGust','uReduced'])assert.equal(s.uniforms[k],U[k]);
  }
  const chunk=s=>s.vertexShader.slice(s.vertexShader.indexOf('vec3 vegBase'),s.vertexShader.indexOf('#include <project_vertex>'));
  assert.equal(chunk(shaders[0]),chunk(shaders[1]));assert.equal(chunk(shaders[0]),chunk(shaders[2]));
 }
 assert.ok(!trees.getObjectByName('broken-side-stems').material.userData.lianaWind);
});
test('eight fern ribbons have two inward tip steps, no centerline hairpin crossing, unchanged topology',()=>{
 const g=cardPlant(3,8,1.4,.55,.7,.55),p=g.attributes.position;assert.equal(p.count,128);assert.equal(g.index.count,8*7*6);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<128;i+=16){const c=[];for(let j=0;j<16;j+=2)c.push([Math.hypot((p.getX(i+j)+p.getX(i+j+1))/2,(p.getZ(i+j)+p.getZ(i+j+1))/2),p.getY(i+j)]);
  assert.ok(c[6][0]<c[5][0]&&c[7][0]<c[6][0]);
  for(let a=0;a<7;a++)for(let b=a+2;b<7;b++)assert.ok(!(cross(c[a],c[a+1],c[b])*cross(c[a],c[a+1],c[b+1])<0&&cross(c[b],c[b+1],c[a])*cross(c[b],c[b+1],c[a+1])<0),'no nonadjacent ribbon panels intersect in radial-height plane');
  for(let j=0;j<16;j++){const n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i+j);assert.ok(Number.isFinite(n.length())&&Math.abs(n.length()-1)<1e-5);}
  assert.ok(c.every(q=>q[0]<1.3&&q[1]>=0&&q[1]<.85));
 }
});
test('repair preserves tree matrices, live geometry, perches and collisions; later complete snags retain sites and footprints',async()=>{
 // Immutable local input recorded BEFORE edits, imports resolved to original directory.
 async function load(name,overrides={}){let s=fs.readFileSync(new URL('./fixtures/'+name+'-before.txt',import.meta.url),'utf8');s=s.replace(/from ['"]([^'"]+)['"]/g,(_,p)=>'from '+JSON.stringify(overrides[p]|| (p==='three'?new URL('../../node_modules/three/build/three.module.js',import.meta.url).href:p.startsWith('three/addons/')?new URL('../../node_modules/three/examples/jsm/'+p.slice(13),import.meta.url).href:new URL(p,import.meta.url).href)));return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64');}
 const forest=await load('forest-detail'),base=await import(await load('trees',{'./forest-detail.js':forest})),oldHash=new SpatialHash(),old=base.buildTrees(hf,tex,oldHash);
 assert.deepEqual([...hash.map],[...oldHash.map]);assert.deepEqual(trees.userData.perches,old.userData.perches);
 // The later owner-approved leaf/snags milestone intentionally replaced only
 // broken-side-stem geometry with complete bare trunks. Keep all live-tree,
 // instance, perch and collision assertions exact; independently test this one delta.
 old.traverse(m=>{if(!m.isMesh)return;const now=trees.getObjectByName(m.name);
  if(m.name==='broken-side-stems'){
   assert.notDeepEqual(now.geometry.attributes.position.array,m.geometry.attributes.position.array);
   const records=trees.userData.detail.snagAccents,previous=old.userData.detail.snagAccents;
   assert.deepEqual(records.map(r=>r.siteId),previous.map(r=>r.siteId));
   assert.ok(records.every(r=>r.kind==='independent-bare-dead-snag'&&r.height>4.7&&r.liveCanopyRetained));
   const selected=records.map(r=>trees.userData.detail.sites.find(s=>s.id===r.siteId)),p=now.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const s=selected.reduce((a,b)=>Math.hypot(p.getX(i)-a.x,p.getZ(i)-a.z)<Math.hypot(p.getX(i)-b.x,p.getZ(i)-b.z)?a:b);if(p.getY(i)-s.y<1.8)assert.ok(Math.hypot(p.getX(i)-s.x,p.getZ(i)-s.z)<.62,'animal-height snag vertices stay inside original occupied footprint');}
   return;
  }
  assert.deepEqual(now.geometry.attributes.position.array,m.geometry.attributes.position.array);if(m.isInstancedMesh)assert.deepEqual(now.instanceMatrix.array,m.instanceMatrix.array);
 });
 const strip=sites=>sites.map(({branchLocalHeight,branchBaseXZ,...s})=>s);assert.deepEqual(strip(trees.userData.detail.sites),strip(old.userData.detail.sites));
});
