import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildAnimal,animalFootRig,ANIMAL_KEYS} from './land.js';
import {ANIMAL_PARTS} from './detail-contract.js';
import {makeSkeleton} from './rig.js';
import {pose} from './gait.js';
import {LandMotion} from './motion.js';
import {orientSurfaceSheets,closeSmallSurfaceLoops} from './animal-mesh-detail.js';

const previousNear=new Map();
for(const key of ANIMAL_KEYS) for(const lod of ['near','far'])test(key+' '+lod+': final mesh, bind, semantic and physical support contract',()=>{
  const d=buildAnimal(key,{lod}),g=d.geo,a=g.attributes,p=a.position,n=a.normal,si=a.skinIndex,sw=a.skinWeight;
  assert.ok(g.index&&g.index.count%3===0);
  assert.ok(g.index.count/3<=(lod==='near'?20000:5000));
  assert.equal(d.detail.triangleCount,g.index.count/3);
  assert.deepEqual(d.joints,animalFootRig(key).joints);
  assert.equal(d.joints.filter(j=>!j.name.startsWith('tail')).length,17);
  if(lod==='near')previousNear.set(key,{feet:d.feet,eyes:d.detail.eyes});
  else {assert.deepEqual(d.feet,previousNear.get(key).feet,'LOD must not move support');assert.deepEqual(d.detail.eyes,previousNear.get(key).eyes);}
  assert.equal(d.feet.length,4);
  assert.deepEqual(new Set(d.feet.map(f=>f.bone)),new Set(['wristL','wristR','hockL','hockR']));
  assert.deepEqual(a.aRestPosition.array,p.array);
  assert.notEqual(a.aRestPosition.array.buffer,p.array.buffer);
  const partSet=new Set(a.aDetailPart.array);
  for(const id of partSet)assert.ok(Object.values(ANIMAL_PARTS).includes(id));
  assert.ok(!partSet.has(ANIMAL_PARTS.eye),'glossy eyes supplied separately');
  for(const name of ['head','nose','innerEar','lips'])assert.ok(partSet.has(ANIMAL_PARTS[name]),name+' actual sampled surface');
  assert.ok(partSet.has(ANIMAL_PARTS[['stag','doe','fawn'].includes(key)?'hoof':'toe']));
  if(key==='bear')assert.ok(partSet.has(ANIMAL_PARTS.claw));
  for(const attr of Object.values(a))assert.ok(attr.array.every(Number.isFinite));
  for(let i=0;i<p.count;i++) {
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    assert.ok(Math.abs(sw.getX(i)+sw.getY(i)+sw.getZ(i)+sw.getW(i)-1)<1e-6);
    for(let j=0;j<4;j++)assert.ok(si.array[i*4+j]>=0&&si.array[i*4+j]<d.joints.length);
  }
  const edges=new Map();
  for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){
    const a=g.index.array[i+j],b=g.index.array[i+(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b);
    if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);
  }
  let boundary=0;
  const head=d.joints.find(j=>j.name==='head').pos;
  for(const uses of edges.values()){
    assert.ok(uses.length<=2,'no edge has more than two faces');
    if(uses.length===2)assert.notEqual(uses[0][0],uses[1][0],'adjacent triangles consistently wound');
    else {boundary++;const center=[0,1,2].map(k=>(p.array[uses[0][0]*3+k]+p.array[uses[0][1]*3+k])/2);
      assert.ok(!(center[0]>head[0]-.35&&center[1]>head[1]-.3),'no remaining facial boundary edge');}
  }
  assert.equal(d.detail.seamRepair.orientation.conflicts,0);
  assert.equal(boundary,d.detail.seamRepair.boundaryEdgesAfter);
  assert.ok(d.detail.seamRepair.closedLoops.length>0);
  for(const loop of d.detail.seamRepair.closedLoops){
    assert.ok(loop.edges<=12&&loop.radius<=d.detail.cell*1.25);
    assert.ok(loop.sourceDistance<0,'cap is recessed inside source sculpt, never an outside patch');
  }
  assert.ok([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray(),g.boundingSphere.radius].every(Number.isFinite));
  const va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3();
  for(let i=0;i<g.index.count;i+=3) {
    const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];
    assert.equal(new Set(ids).size,3);assert.ok(ids.every(v=>v<p.count));
    va.fromBufferAttribute(p,ids[0]);vb.fromBufferAttribute(p,ids[1]);vc.fromBufferAttribute(p,ids[2]);
    assert.ok(vb.sub(va).cross(vc.sub(va)).length()>1e-11,'nondegenerate triangle');
  }
  // Every ray behind the cap/rim must hit a nearby closed facial surface,
  // not the distant opposite cheek or daylight through a sub-cell socket.
  const probe=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));probe.updateMatrixWorld(true);
  for(const eye of d.detail.eyes){
    const dir=new T.Vector3(key==='tiger'?.72:.45,.06,eye.side*.90).normalize();
    const right=new T.Vector3(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right).normalize();
    for(let ring=0;ring<=2;ring++)for(let sample=0;sample<16;sample++){
      const angle=sample*Math.PI/8,center=new T.Vector3(...eye.center).addScaledVector(right,Math.cos(angle)*eye.radius[0]*ring*.46).addScaledVector(up,Math.sin(angle)*eye.radius[1]*ring*.46);
      const origin=center.clone().addScaledVector(dir,.15),hits=new T.Raycaster(origin,dir.clone().negate(),0,.25).intersectObject(probe);
      assert.ok(hits.length,'facial skin behind eye sample');
      assert.ok(hits[0].point.distanceTo(center)<.065,'no hole to distant cheek');
      if(ring===0){const depth=hits[0].point.clone().sub(center).dot(dir);assert.ok(depth>0&&depth<Math.max(...eye.radius)*.68,'eye cap seated inside surface with visible cornea');}
    }
  }
  probe.material.dispose();
  const rig=makeSkeleton(d.joints),mesh=new T.SkinnedMesh(g,new T.MeshBasicMaterial());mesh.add(rig.root);mesh.bind(new T.Skeleton(rig.bones));
  const vertexIds=d.feet.map(f=>{
    const ji=d.joints.findIndex(j=>j.name===f.bone);let found=-1,min=Infinity;
    for(let i=0;i<p.count;i++)if(si.getX(i)===ji&&sw.getX(i)===1){min=Math.min(min,p.getY(i));if(f.sole.every((v,k)=>v===p.array[i*3+k]))found=i;}
    assert.ok(found>=0,'anchor is actual vertex with 100% distal weight');
    assert.equal(min,f.sole[1]);assert.ok(Math.abs(f.sole[1])<.025);
    assert.deepEqual(f.offset,f.sole.map((v,k)=>v-d.joints[ji].pos[k]));
    return found;
  });
  const motion=new LandMotion(rig,mesh,d.feet);let contacts=0,maxError=0;
  for(let frame=0;frame<120;frame++){
    const t=frame/60,phase=t%1;mesh.position.set(t*.25,-.06,0);
    pose(rig,{phase,stride:1,t,species:key,blend:0});motion.update({phase,speed:.25,baseSpeed:.5,ground:()=>0,walking:true});mesh.updateMatrixWorld(true);
    for(const leg of motion.legs)if(leg.mode==='stance'){
      const fi=d.feet.findIndex(f=>f.bone===leg.name),vi=vertexIds[fi];va.fromBufferAttribute(p,vi);mesh.applyBoneTransform(vi,va);va.applyMatrix4(mesh.matrixWorld);
      maxError=Math.max(maxError,va.distanceTo(leg.target));contacts++;
    }
  }
  assert.ok(contacts>100);assert.ok(maxError<1e-6,'actual skinned surface follows world contact');
  assert.deepEqual(a.aRestPosition.array,p.array,'posing never mutates rest geometry');
  assert.equal(d.detail.eyes.length,2);assert.deepEqual(d.detail.eyes.map(e=>e.side),[1,-1]);
  for(const e of d.detail.eyes)assert.ok([...e.center,...e.radius].every(Number.isFinite)&&e.radius.every(x=>x>0));
  console.log(JSON.stringify({species:key,lod,triangles:d.detail.triangleCount,inputTriangles:d.detail.inputTriangles,buildMs:d.detail.buildMs,soleY:d.feet.map(f=>f.sole[1]),seamRepair:d.detail.seamRepair,boundaryEdges:boundary,contacts,maxError}));
  g.dispose();mesh.material.dispose();
});
test('input validation',()=>{assert.throws(()=>buildAnimal('bad'),RangeError);assert.throws(()=>buildAnimal('tiger',{lod:'bad'}),RangeError);});
test('repeated builds own independent buffers, deterministic bind surface',()=>{
 const a=buildAnimal('panda',{lod:'far'}),b=buildAnimal('panda',{lod:'far'});
 for(const name of Object.keys(a.geo.attributes)){
   assert.deepEqual(a.geo.attributes[name].array,b.geo.attributes[name].array);
   assert.notEqual(a.geo.attributes[name].array.buffer,b.geo.attributes[name].array.buffer);
 }
 assert.deepEqual(a.geo.index.array,b.geo.index.array);a.geo.dispose();
 assert.ok(b.geo.attributes.position.array.every(Number.isFinite));b.geo.dispose();
});

test('local repair rejects oversized or outside-field holes and preserves existing vertices',()=>{
  const make=()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.01,0,0,0,.01,0,0,0,.01],3));g.setIndex([0,2,1,0,1,3,1,2,3]);return g;};
  for(const options of [{cell:.001,field:()=>-.001},{cell:.02,field:()=>.1},{cell:.02,field:()=>-.001,accept:()=>false}]){
    const g=make(),before=g.index.array.slice();closeSmallSurfaceLoops(g,options);assert.deepEqual(g.index.array,before);assert.equal(g.userData.seamRepair.closedLoops.length,0);
  }
  const g=make(),before=g.attributes.position.array.slice();
  // Deliberately invert one face before the adjacency repair.
  [g.index.array[1],g.index.array[2]]=[g.index.array[2],g.index.array[1]];
  orientSurfaceSheets(g);assert.equal(g.userData.surfaceOrientation.flippedTriangles,1);
  closeSmallSurfaceLoops(g,{cell:.02,field:()=>-.001});
  assert.equal(g.userData.seamRepair.boundaryEdgesAfter,0);assert.deepEqual(g.attributes.position.array.slice(0,before.length),before);
  const edges=new Map();for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){const a=g.index.array[i+j],b=g.index.array[i+(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);}
  for(const e of edges.values()){assert.equal(e.length,2);assert.equal(e[0][0],e[1][1]);}
});
