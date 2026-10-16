import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {Heightfield} from './heightfield.js';
import {buildRiver,configureRiverMist} from './river.js';
import {buildMist} from './mist.js';
import {buildTerrain} from './terrain.js';
import {buildLandscapeDetail} from './landscape-detail.js';
import {buildReef,reefGardenMask} from '../sea/reef.js';
const hf=new Heightfield();const hash=a=>createHash('sha256').update(Buffer.from(a.buffer)).digest('hex');
const before={h:hash(hf.h),zone:hash(hf.zone),coast:hash(hf.coastDist),river:JSON.stringify(hf.river)};
test('opt-in landscape leaves geography, river and terrain topology bit exact',()=>{
 const a=buildTerrain(hf,{}),b=buildTerrain(hf,{}, {releasePolish:true});
 assert.equal(hash(a.geometry.attributes.position.array),hash(b.geometry.attributes.position.array));
 assert.equal(hash(a.geometry.index.array),hash(b.geometry.index.array));
 buildLandscapeDetail(hf,{releasePolish:true});buildRiver(hf,null,{releasePolish:true});buildReef(hf,{releasePolish:true});
 assert.deepEqual({h:hash(hf.h),zone:hash(hf.zone),coast:hash(hf.coastDist),river:JSON.stringify(hf.river)},before);
});
test('default off, tiny non-solid relief and one batched draw',()=>{
 assert.equal(buildLandscapeDetail(hf).children.length,0);
 for(const quality of ['high','low']) {
  const g=buildLandscapeDetail(hf,{releasePolish:true,quality});assert.equal(g.children.length,1);assert.ok(g.userData.stats.tris<1600);
  const p=g.children[0].geometry.attributes.position;
  for(let i=0;i<p.count;i++){const delta=p.getY(i)-hf.heightAt(p.getX(i),p.getZ(i));assert.ok(delta>=0 && delta<.086);}
 }
});
test('source water follows existing upstream and arc runs downhill',()=>{
 const old=buildRiver(hf,null),g=buildRiver(hf,null,{releasePolish:true});assert.equal(old.children.length,2);assert.equal(g.children.length,4);
 const up=g.getObjectByName('river-source-reach');assert.ok(up);assert.equal(up.geometry.attributes.position.count,hf.river.up.length*2);
 for(const name of ['river-source-reach','river-downstream']) {
  const geom=g.getObjectByName(name).geometry,p=geom.attributes.position,a=geom.attributes.aArc;
  for(let i=2;i<p.count;i+=2){assert.ok(a.getX(i)>=a.getX(i-2));assert.ok(p.getY(i)<=p.getY(i-2)+.00001);}
 }
 assert.equal(g.userData.materials.length,3);assert.ok(g.userData.materials.every(m=>m.uniforms.uTime));
});
test('reef retains all habitat homes and species; mobile is exact composition subset',()=>{
 const old=buildReef(hf),hi=buildReef(hf,{releasePolish:true}),lo=buildReef(hf,{releasePolish:true,quality:'low'});
 assert.deepEqual(hi.userData.anemones,old.userData.anemones);assert.deepEqual(lo.userData.anemones,hi.userData.anemones);
 assert.deepEqual(Object.keys(hi.userData.stats.byType).sort(),Object.keys(old.userData.stats.byType).sort());
 assert.ok(hi.userData.stats.count<old.userData.stats.count*.7);assert.ok(hi.userData.stats.count>old.userData.stats.count*.2);
 const mats=g=>new Set(g.children.flatMap(m=>Array.from({length:m.count},(_,i)=>m.name+':'+Array.from(m.instanceMatrix.array.slice(i*16,i*16+16)).join(','))));
 const high=mats(hi);for(const item of mats(lo))assert.ok(high.has(item));
 assert.equal(reefGardenMask(25,35),0);assert.equal(reefGardenMask(40,39),1);
 console.log(JSON.stringify({baseline:old.userData.stats,high:hi.userData.stats,low:lo.userData.stats,detail:buildLandscapeDetail(hf,{releasePolish:true}).userData.stats}));
});
test('material extension compiles complete shader text with distinct caches',()=>{
 const a=buildTerrain(hf,{}),b=buildTerrain(hf,{}, {releasePolish:true});assert.notEqual(a.material.customProgramCacheKey(),b.material.customProgramCacheKey());
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};b.material.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('float fallWet'));assert.ok(shader.fragmentShader.includes('float bankSand'));assert.ok(!shader.fragmentShader.includes('vec3(0.42, 0.16, 0.30)'));
});

test('mist opt-in stays bounded, shared-time and deterministic without duplication',()=>{
 const a=buildMist(hf),b=buildMist(hf),old=a.material.fragmentShader;
 configureRiverMist(a,hf);assert.equal(a.material.fragmentShader,old);
 configureRiverMist(a,hf,{releasePolish:true});configureRiverMist(b,hf,{releasePolish:true});
 assert.equal(hash(a.geometry.attributes.position.array),hash(b.geometry.attributes.position.array));
 assert.equal(hash(a.geometry.attributes.aSeed.array),hash(b.geometry.attributes.aSeed.array));
 assert.equal(a.geometry.attributes.position.count,110);assert.ok(a.material.vertexShader.includes('min(uFallH * .14, 1.25)'));
 assert.ok(a.material.fragmentShader.includes('soft * 0.075'));
 const shader=a.material.fragmentShader;configureRiverMist(a,hf,{releasePolish:true});assert.equal(a.material.fragmentShader,shader);
});

test('fall terminates at carved pool rather than inside the rock face',()=>{
 const g=buildRiver(hf,null,{releasePolish:true}),f=hf.river.fall,p=g.getObjectByName('waterfall').geometry.attributes.position;
 const end=new THREE.Vector3();for(let i=p.count-11;i<p.count;i++)end.add(new THREE.Vector3().fromBufferAttribute(p,i));end.multiplyScalar(1/11);
 assert.ok(Math.hypot(end.x-hf.river.pool.x,end.z-hf.river.pool.z)<.00001);
 assert.ok(hf.heightAt(end.x,end.z)<end.y);assert.ok(Math.abs(end.y-f.bottom)<.15);
});
