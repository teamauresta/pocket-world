import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {buildBamboo,clump} from './bamboo.js';
import {buildPalms,palm} from './palms.js';
import {buildGroundcover,tuft,flower,applyDistanceFade} from './groundcover.js';
import {floorGeometry} from './forest-floor.js';
import {SpatialHash,makeSampler} from './scatter.js';
import {Heightfield} from '../world/heightfield.js';
import {applyWind,depthMaterialFor} from './materials.js';
// Strict drawing-operation recorder, not a rasterizer or WebGL substitute.
const operations=[];
const ctx={};for(const k of ['clearRect','fillRect','beginPath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath','save','restore','translate','rotate','fill','stroke'])ctx[k]=(...args)=>operations.push([k,...args]);
ctx.createLinearGradient=()=>({addColorStop:(...args)=>operations.push(['stop',...args])});
globalThis.document={createElement(type){assert.equal(type,'canvas');return {width:0,height:0,getContext(kind){assert.equal(kind,'2d');return ctx;}};}};
const finite=g=>{for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));assert.ok(g.index.count>0);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inventory=h=>[...h.map.values()].flat();
const hf=new Heightfield();

test('bounded actual blade and three distinct flower geometries',()=>{
  const grass=tuft(1);finite(grass);assert.equal(grass.attributes.position.count,16*8);assert.equal(grass.index.count/3,96);
  assert.ok(grass.index.count/3<=11*8*1.1);const hashes=[];
  for(const species of ['daisy','bell','cluster']){const g=flower(6,species);finite(g);assert.equal(g.userData.stems,3);hashes.push(digest([...g.attributes.position.array]));}
  assert.equal(new Set(hashes).size,3);
});
test('bamboo node collars and four leaf droopers; palm coconut and dead-frond geometry',()=>{
  const b=clump(11);finite(b.culms);finite(b.leaves);assert.ok(b.culms.userData.nodes>60);assert.equal(b.leaves.userData.leavesPerSpray,4);
  assert.equal(b.leaves.attributes.position.count,b.leaves.userData.sprays*4*8);
  const p=palm(1);for(const g of Object.values(p))finite(g);assert.equal(p.detail.userData.coconuts,5);assert.equal(p.detail.userData.fibers,12);
});
test('finite forest floor geometries are distinct',()=>{for(const k of ['leaves','needles','logs','mushrooms'])finite(floorGeometry(k));});
test('groundcover quality never mutates solid inventory and floor stays safely anchored',()=>{
  const h=new SpatialHash();for(const row of JSON.parse(fs.readFileSync(new URL('../fauna/fixtures/escape-world.json',import.meta.url))).hash)h.add(...row);
  const before=digest(inventory(h)),S=makeSampler(hf,1),counts={};
  for(const quality of ['high','low']){
    const g=buildGroundcover(hf,h,{quality});assert.equal(digest(inventory(h)),before);
    g.traverse(m=>{if(m.isMesh){finite(m.geometry);if(m.isInstancedMesh)assert.ok(Array.from(m.instanceMatrix.array).every(Number.isFinite));}});
    const floor=g.getObjectByName('forest-floor');
    for(const kind of ['leaves','needles']){const m=floor.getObjectByName('floor-'+kind);if(!m)continue;const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i++)assert.ok(Math.abs(pos.getY(i)-hf.heightAt(pos.getX(i),pos.getZ(i))-.018)<.00001);}
    counts[quality]=floor.userData.detail.counts;
    for(const [kind,list]of Object.entries(floor.userData.detail.placements))for(const p of list){const t=S.at(p.x,p.z);assert.ok(t.river>1.5&&t.coast< -3&&t.glade<.025&&t.slope<.13);assert.equal(p.y,hf.heightAt(p.x,p.z)+(kind==='logs'?-.025:.008));if(kind==='logs')assert.ok(Math.hypot(p.x-p.anchor[0],p.z-p.anchor[1])+.48<p.anchor[2]);}
    const mesh=g.getObjectByName('jungle-leaves');assert.ok(mesh.customDepthMaterial);assert.ok(mesh.material.customProgramCacheKey().includes('fade80-150'));assert.ok(mesh.customDepthMaterial.customProgramCacheKey().includes('fade80-150'));
  }
  assert.ok(counts.high.leaves+counts.high.needles>0);assert.ok(counts.low.leaves+counts.low.needles<=counts.high.leaves+counts.high.needles);
});
test('bamboo and palm world transforms are deterministic with unchanged baseline inventory',async()=>{
  for(const [name,builder]of [['bamboo',buildBamboo],['palms',buildPalms]]){
    // Load committed baseline fixtures with absolute module URLs.
    let source=fs.readFileSync(new URL('./fixtures/'+name+'-baseline.txt',import.meta.url),'utf8');
    source=source.replace(/from ['"](\.[^'"]+)['"]/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));
    const baseline=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll("from 'three'","from '"+new URL('../../node_modules/three/build/three.module.js',import.meta.url).href+"'").replaceAll("from 'three/addons/utils/BufferGeometryUtils.js'","from '"+new URL('../../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',import.meta.url).href+"'")).toString('base64'));
    const a=new SpatialHash(),b=new SpatialHash(),old=baseline[name==='bamboo'?'buildBamboo':'buildPalms'](hf,a),current=builder(hf,b);
    assert.deepEqual(inventory(b),inventory(a));assert.equal(current.userData.stats.count,old.userData.stats.count);
    const previous=old.children.filter(m=>m.isInstancedMesh),now=current.children.filter(m=>m.isInstancedMesh&&!m.name.includes('dead')&&!m.name.includes('coconuts'));
    assert.equal(now.length,previous.length);now.forEach((m,i)=>assert.deepEqual(m.instanceMatrix.array,previous[i].instanceMatrix.array));
  }
});
test('composed fade and wind shadow shaders preserve matching deformation',()=>{
  const opts={amp:.08,flutter:.015,heightScale:1.5,stiff:1.3},m=new THREE.MeshStandardMaterial();applyWind(m,opts);const d=depthMaterialFor(m,opts);applyDistanceFade(m,80,150);applyDistanceFade(d,80,150);
  const compile=mat=>{const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(s,{});return s;};
  const a=compile(m),b=compile(d);assert.equal(a.vertexShader,b.vertexShader);assert.ok(a.vertexShader.includes('transformed *= fd'));assert.equal(a.uniforms.uTime,b.uniforms.uTime);assert.equal(a.uniforms.uDetailViewer,b.uniforms.uDetailViewer);
  const camera=new THREE.PerspectiveCamera();camera.position.set(4,5,6);camera.updateMatrixWorld();m.onBeforeRender(null,null,camera);assert.deepEqual(a.uniforms.uDetailViewer.value.toArray(),[4,5,6]);
});
