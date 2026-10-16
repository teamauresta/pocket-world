import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {Fauna} from './animals.js';import {SpatialHash} from '../veg/scatter.js';
const flat={heightAt:()=>8,normalAt:()=>[0,1,0],riverInfo:()=>({dist:100,width:0})};
test('real fauna LOD changes geometry without changing bones, contacts or rest-space contract',()=>{
 const f=new Fauna(flat,new SpatialHash(),{coverHash:null}),camera=new THREE.PerspectiveCamera();f.update(.4,.4);const a=f.agents[0];a.mesh.updateWorldMatrix(true,true);
 const bones=a.rig.bones.map(b=>b.matrixWorld.toArray()),contacts=a.motion.snapshot(),near=a.mesh.geometry;
 camera.position.copy(a.mesh.position).add(new THREE.Vector3(0,3,8));f.updateDetailView(camera,{forceLod:'near'});assert.equal(a.detailLod,'near');assert(near.index.count/3<=20000);
 f.updateDetailView(camera,{forceLod:'far'});assert.equal(a.detailLod,'far');assert.notEqual(a.mesh.geometry,near);assert(a.mesh.geometry.index.count/3<=5000);assert.equal(a.detailAppearance.snapshot().fur.visibleShells,0);
 assert.deepEqual(a.motion.snapshot(),contacts);assert.deepEqual(a.rig.bones.map(b=>b.matrixWorld.toArray()),bones);assert(a.mesh.geometry.hasAttribute('aRestPosition'));
 f.updateDetailView(camera,{forceLod:'near'});assert.equal(a.mesh.geometry,near);assert(a.detailAppearance.snapshot().fur.visibleShells>0);
 const snapshot=f.snapshot();f.update(0,.4);f.updateDetailView(camera,{forceLod:'near'});assert.deepEqual(f.snapshot(),snapshot);
 for(const x of f.agents)x.detailAppearance.dispose();
});
