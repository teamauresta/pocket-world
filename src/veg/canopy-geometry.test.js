import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {generateTree,SPECIES} from './treegen.js';
import {crownAttributes} from './forest-detail.js';
import {buildTrees,TREE_SPEC} from './trees.js';
import {SpatialHash} from './scatter.js';
import {Heightfield} from '../world/heightfield.js';
const digest=g=>createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex');
const texture=new THREE.Texture(),tex={leaf:Object.fromEntries(['oak','ash','pine','aspen','blossom'].map(k=>[k,texture])),bark:{oak:texture,pine:texture,birch:texture},barkN:{}};

test('eight tree forms have five distinct finite real geometry variants',()=>{
  for(const [sp,s] of Object.entries(TREE_SPEC)){
    const hashes=[];
    for(const seed of s.seeds){
      const g=generateTree({...SPECIES[sp],seed,roots:sp!=='bush'});hashes.push(digest(g.branches)+digest(g.leaves));
      for(const geometry of [g.branches,g.leaves])for(const a of Object.values(geometry.attributes))assert.ok(Array.from(a.array).every(Number.isFinite),sp);
      const p=g.leaves.attributes.position;
      for(const name of ['aCrownDepth','aLeafVariant','color'])assert.equal(g.leaves.getAttribute(name).count,p.count);
      const depth=g.leaves.getAttribute('aCrownDepth'),variant=g.leaves.getAttribute('aLeafVariant');
      for(let i=0;i<p.count;i++){assert.ok(depth.getX(i)>=0&&depth.getX(i)<=1);assert.ok([0,1,2].includes(variant.getX(i)));assert.equal(depth.getX(i),depth.getX(i-i%4));assert.equal(variant.getX(i),variant.getX(i-i%4));}
      assert.ok(Math.max(...depth.array)-Math.min(...depth.array)>.15,sp+' depth range');
      if(sp!=='bush'){
        assert.ok(g.detail.tubes>=3&&g.detail.tubes<=5);
        const a=g.branches.attributes.position;
        for(let i=0;i<a.count;i++)if(a.getY(i)<.26)assert.ok(Math.hypot(a.getX(i),a.getZ(i))<=.069001);
      }
      if(sp==='fig')assert.equal(g.detail.aerialRoots,5);
      if(sp==='broadleaf'||sp==='fig')assert.equal(g.detail.buttresses,g.detail.tubes);
      g.branches.dispose();g.leaves.dispose();
    }
    assert.equal(new Set(hashes).size,5,sp);
  }
});

test('crown depth is geometry-derived, deterministic and independent of colour seed',()=>{
  const g=generateTree({...SPECIES.fig,seed:8101}),before=g.leaves.attributes.aCrownDepth.array.slice();
  crownAttributes(g.leaves,99);assert.deepEqual(g.leaves.attributes.aCrownDepth.array,before);
  const colors=g.leaves.attributes.color.array.slice();crownAttributes(g.leaves,99);assert.deepEqual(g.leaves.attributes.color.array,colors);
});

test('high/low share identical collision inventory, placements, perches and actual triangle accounting',()=>{
  const hf=new Heightfield(),a=new SpatialHash(),b=new SpatialHash(),high=buildTrees(hf,tex,a),low=buildTrees(hf,tex,b,{quality:'low'});
  assert.deepEqual([...a.map],[...b.map]);assert.deepEqual(high.userData.detail.sites,low.userData.detail.sites);
  assert.deepEqual(high.userData.perches,low.userData.perches);
  let tris=0,calls=0;
  high.traverse(m=>{if(m.isMesh){calls++;tris+=m.geometry.index.count/3*(m.isInstancedMesh?m.count:1);}});
  assert.equal(tris,high.userData.stats.tris);assert.ok(calls<=82);assert.ok(tris<750000);
  const m=new THREE.Matrix4(),p=new THREE.Vector3();
  for(const perch of high.userData.perches){const mesh=high.getObjectByName(perch.mesh);assert.ok(mesh?.isInstancedMesh);mesh.getMatrixAt(perch.instance,m);p.fromBufferAttribute(mesh.geometry.attributes.position,perch.vertex).applyMatrix4(m);assert.ok(p.distanceTo(new THREE.Vector3(perch.x,perch.y,perch.z))<.00001);assert.equal(perch.windAmp,.16);}
  for(const site of high.userData.detail.sites){
    if(site.species==='bush')continue;
    const mesh=high.getObjectByName(site.branchMesh),pos=mesh.geometry.attributes.position;mesh.getMatrixAt(site.instance,m);
    for(let i=0;i<pos.count;i++)if(pos.getY(i)<.26){p.fromBufferAttribute(pos,i).applyMatrix4(m);assert.ok(Math.hypot(p.x-site.x,p.z-site.z)<(site.originalSpecies==='pine'?1.3:1.6));}
  }
  assert.ok(high.userData.detail.snagAccents.length>0);
  assert.ok(high.userData.detail.lianas.length>0);
  for(const l of high.userData.detail.lianas){assert.ok(l.minimumSampledGroundClearance>=3.5);assert.deepEqual(l.start,high.userData.detail.sites[l.from].attach);assert.deepEqual(l.end,high.userData.detail.sites[l.to].attach);}
  for(const s of high.userData.detail.sites)if(['broadleaf','fig'].includes(s.species))assert.ok(s.biome.jungle>.55);
});
