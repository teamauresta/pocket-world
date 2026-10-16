import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {deformSeaPoint,createOwnerSeaMotion} from './owner-sea-motion.js';
import {seaFloorMaximum,OWNER_SEA_PROFILES} from './owner-sea-pack.js';
import {createImportedAsset} from '../creatures/imported-assets.js';
import {Heightfield} from '../world/heightfield.js';
test('generated fish flex tail and dorsal fins, turtle preserves medial shell',()=>{
 const p=new THREE.Vector3(-.46,.1,.03);assert.ok(deformSeaPoint(p,'fish',1,1).distanceTo(p)>.01);
 const shell=new THREE.Vector3(0,.2,0);assert.ok(deformSeaPoint(shell,'turtle',1,1).distanceTo(shell)<1e-12);
 const fin=new THREE.Vector3(.15,-.1,.45);assert.ok(deformSeaPoint(fin,'turtle',1,1).distanceTo(fin)>.05);
 for(const kind of ['fish','coralFish','turtle'])assert.deepEqual(deformSeaPoint(fin,kind,1,.7,0).toArray(),fin.toArray());
});
test('static deformation owns geometry, preserves source UV/material/normals at rest',()=>{
 const scene=new THREE.Group(),g=new THREE.SphereGeometry(1,12,8),m=new THREE.MeshStandardMaterial();scene.add(new THREE.Mesh(g,m));const asset=createImportedAsset({scene,animations:[]}),i=asset.instantiate({size:2,align:'center'}),motion=createOwnerSeaMotion(i,'fish',2),source=g.attributes.position.array.slice();motion.apply(1);const r=motion.records[0];assert.notEqual(r.geometry,g);assert.equal(r.mesh.material,m);assert.deepEqual(g.attributes.position.array,source);assert.deepEqual(r.geometry.attributes.uv.array,g.attributes.uv.array);motion.apply(0,0);assert.deepEqual(r.geometry.attributes.position.array,g.attributes.position.array);assert.deepEqual(r.geometry.attributes.normal.array,g.attributes.normal.array);motion.dispose();i.dispose();asset.dispose();
});
test('full terrain rectangle captures interior ridges and fails offgrid',()=>{
 const hf=new Heightfield();const max=seaFloorMaximum(hf,-10,10,-10,10);for(let x=-10;x<=10;x+=.21)for(let z=-10;z<=10;z+=.21)assert.ok(hf.heightAt(x,z)<=max+1e-8);assert.equal(seaFloorMaximum(hf,49,51,0,1),Infinity);
});
test('native profiles explicitly distinguish school whale and generated static species',()=>{assert.equal(OWNER_SEA_PROFILES.school.members,9);assert.equal(OWNER_SEA_PROFILES.school.mode,'school-centre');assert.equal(OWNER_SEA_PROFILES.whale.size,10);assert.equal(OWNER_SEA_PROFILES.turtle.clip,undefined);assert.ok(OWNER_SEA_PROFILES.shark.derivedRequired);});

import {ImportedSpecGlossMaterial} from '../creatures/imported-materials.js';
import {createOwnerSeaPack} from './owner-sea-pack.js';
test('native sea owns mapped legacy material with its required shader define',async()=>{
 const scene=new THREE.Group(),m=new ImportedSpecGlossMaterial({specGlossMap:new THREE.Texture()}),g=new THREE.SphereGeometry(1,8,6);scene.add(new THREE.Mesh(g,m));const asset=createImportedAsset({scene,animations:[]}),pack=await createOwnerSeaPack({hf:{heightAt:()=>-20},assets:{fish:asset},samples:60});const own=pack.actors[0].visuals[0].materials[0];assert.equal(own.defines.OWNER_SPEC_GLOSS_MAP,1);assert.notEqual(own,m);assert.equal(own.specGlossMap,m.specGlossMap);pack.dispose();asset.dispose();
});

test('controller consumes coarse delta, freezes, resets, and rejects raw overbudget assets',async()=>{
 const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial()));const asset=createImportedAsset({scene,animations:[]}),pack=await createOwnerSeaPack({hf:{heightAt:()=>-20},assets:{fish:asset},samples:60});const initial=JSON.stringify(pack.snapshot());pack.update(0);assert.equal(JSON.stringify(pack.snapshot()),initial);pack.update(2);assert.ok(Math.abs(pack.snapshot().time-2)<1e-10);pack.reset();assert.equal(JSON.stringify(pack.snapshot()),initial);assert.throws(()=>pack.update(-1));pack.dispose();asset.dispose();
 const heavy=new THREE.Group();heavy.add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(20000*9),3)),new THREE.MeshStandardMaterial()));heavy.children[0].geometry.attributes.position.setXYZ(0,1,1,1);const bad=createImportedAsset({scene:heavy,animations:[]});await assert.rejects(createOwnerSeaPack({hf:{heightAt:()=>-20},assets:{fish:bad},samples:60}),/exceeds strict triangle budget/);bad.dispose();
});
