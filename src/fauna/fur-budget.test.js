import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Fauna,normalizeFurBudget} from './animals.js';
import {buildAnimal} from '../creatures/land.js';
import {makeSkeleton} from '../creatures/rig.js';
import {createAnimalMaterial} from '../creatures/animal-surface.js';
import {createAnimalFur} from '../creatures/animal-fur.js';
import {SpatialHash} from '../veg/scatter.js';
const flat={heightAt:()=>8,normalAt:()=>[0,1,0],riverInfo:()=>({dist:100,width:0})};
const budget={maxShells:6,maxTriangles:120000};
function costs(f){let calls=0,triangles=0;f.group.traverse(o=>{if(o.userData.animalFur&&o.visible){calls++;triangles+=o.geometry.index.count/3;}});return {calls,triangles};}
function dispose(f){for(const a of f.agents)a.detailAppearance.dispose();}
test('explicit world budget validates and default stays unlimited',()=>{
 assert.equal(normalizeFurBudget(),null);
 for(const value of [0,{}, {maxShells:1.2,maxTriangles:100}, {maxShells:2,maxTriangles:Infinity},{...budget,fadeTravel:0}])assert.throws(()=>normalizeFurBudget(value));
 const f=new Fauna(flat,new SpatialHash(),{coverHash:null});const a=f.agents[0],c=new THREE.PerspectiveCamera(45,1.3,.1,200);
 c.position.copy(a.mesh.position).add(new THREE.Vector3(3,2,5));c.lookAt(a.mesh.position);f.updateDetailView(c);
 assert.equal(a.detailAppearance.snapshot().fur.visibleShells,12);assert.equal(a.detailAppearance.snapshot().fur.budgeted,false);dispose(f);
});
test('real world shells stay inside both caps through camera changes, movement, pause and LOD',()=>{
 const f=new Fauna(flat,new SpatialHash(),{coverHash:null,furBudget:budget});const c=new THREE.PerspectiveCamera(45,1.3,.1,200),a=f.agents[0];
 c.position.copy(a.mesh.position).add(new THREE.Vector3(3,2,5));c.lookAt(a.mesh.position);f.updateDetailView(c);
 assert(costs(f).calls>0);assert(a.detailAppearance.snapshot().fur.visibleShells>0);
 const bones=a.rig.bones.map(b=>b.matrixWorld.toArray()),contacts=a.motion.snapshot();
 for(let i=0;i<90;i++){
  c.position.x+=.07;c.position.z+=.04;c.lookAt(a.mesh.position);f.updateDetailView(c);
  const cost=costs(f);assert(cost.calls<=budget.maxShells);assert(cost.triangles<=budget.maxTriangles);
  const snap=f.snapshot();f.update(0,f.time);f.updateDetailView(c);assert.deepEqual(f.snapshot(),snap);
 }
 assert.deepEqual(a.motion.snapshot(),contacts);assert.deepEqual(a.rig.bones.map(b=>b.matrixWorld.toArray()),bones);
 f.updateDetailView(c,{forceLod:'far'});assert.equal(costs(f).calls,0);assert(a.mesh.geometry.index.count/3<=5000);
 f.updateDetailView(c,{forceLod:'near'});assert(a.mesh.geometry.index.count/3<=20000);
 for(let i=0;i<30;i++){f.update(1/60,f.time+1/60);f.updateDetailView(c);assert(costs(f).calls<=6);assert(costs(f).triangles<=120000);}
 dispose(f);
});
test('view hysteresis retains allocations across subpixel camera perturbation',()=>{
 const f=new Fauna(flat,new SpatialHash(),{coverHash:null,furBudget:budget});const c=new THREE.PerspectiveCamera(45,1.3,.1,200),a=f.agents[0];
 c.position.copy(a.mesh.position).add(new THREE.Vector3(3,2,5));c.lookAt(a.mesh.position);f.updateDetailView(c);
 const before=f.agents.map(x=>x.detailAppearance.snapshot().fur.layerWeights);
 c.position.x+=1e-11;c.lookAt(a.mesh.position);f.updateDetailView(c);
 assert.deepEqual(f.agents.map(x=>x.detailAppearance.snapshot().fur.layerWeights),before);dispose(f);
});

test('budget transition is continuous, nearest inspection is furry, and skin correspondence is exact',()=>{
 const f=new Fauna(flat,new SpatialHash(),{coverHash:null,furBudget:budget}),c=new THREE.PerspectiveCamera(45,1.3,.1,200),a=f.agents[0];
 c.position.copy(a.mesh.position).add(new THREE.Vector3(0,2,6));c.lookAt(a.mesh.position);f.updateDetailView(c);
 const b=f.agents[9],start=c.position.clone(),end=b.mesh.position.clone().add(new THREE.Vector3(0,2,6));
 // Bounded travel steps produce intermediate weights rather than a binary pop.
 let partial=false;
 for(let i=0;i<70;i++){
  c.position.lerpVectors(start,end,Math.min(1,(i+1)/60));c.lookAt(a.mesh.position.clone().lerp(b.mesh.position,Math.min(1,(i+1)/60)));
  f.update(1/60,f.time+1/60);f.updateDetailView(c);
  partial ||= f.agents.some(x=>x.detailAppearance.snapshot().fur.layerWeights.some(w=>w>0&&w<1));
  assert(costs(f).calls<=6);assert(costs(f).triangles<=120000);
 }
 assert(partial);assert(b.detailAppearance.snapshot().fur.visibleShells>0);
 f.group.updateMatrixWorld(true);
 for(const actor of f.agents){actor.mesh.skeleton.update();for(const shell of actor.mesh.children.filter(x=>x.userData.animalFur)){
  assert.equal(shell.geometry,actor.detailData.geo);assert.equal(shell.skeleton,actor.mesh.skeleton);
  assert.deepEqual(shell.bindMatrix.toArray(),actor.mesh.bindMatrix.toArray());
  for(const index of [0,25,250]){
   // Both meshes use the exact same near base; account for far owner LOD by
   // checking correspondence only while the genuine near base is attached.
   if(actor.detailLod!=='near')continue;
   const base=actor.mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(actor.mesh.matrixWorld);
   const copy=shell.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(shell.matrixWorld);
   assert(base.distanceTo(copy)<1e-9);
  }
 }}dispose(f);
});

test('admitted layer fades have separate actual shader uniforms; unlimited low keeps six',()=>{
 const data=buildAnimal('tiger',{lod:'near'}),rig=makeSkeleton(data.joints),mesh=new THREE.SkinnedMesh(data.geo,createAnimalMaterial('tiger'));
 mesh.add(rig.root);mesh.bind(new THREE.Skeleton(rig.bones));const fur=createAnimalFur(mesh,data,{quality:'low'});
 fur.update(0,0,0);assert.equal(fur.snapshot().visibleShells,6);
 fur.setBudgetWeights([0,0,0,0,.25,.75]);fur.update(0,0,0);assert.equal(fur.snapshot().visibleShells,2);
 const values=fur.shells.map(shell=>{const lib=THREE.ShaderLib.physical,s={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}};shell.material.onBeforeCompile(s,{});return s.uniforms.uAnimalFurFade;});
 assert.deepEqual(values.map(u=>u.value),[0,0,0,0,.25,.75]);assert.notEqual(values[4],values[5]);
 fur.setBudgetWeights(null);fur.update(0,0,0);assert.equal(fur.snapshot().visibleShells,6);fur.dispose();
});
