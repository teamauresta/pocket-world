import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeSkeleton } from './rig.js';
import { createAnimalMaterial, composeAnimalShader, attachAnimalDetail } from './animal-surface.js';
import { createAnimalFur, createHairVolume } from './animal-fur.js';
import { createAnimalEyes, blinkAt } from './animal-eye.js';
import { applyWet, patchUnderwater } from '../render/shared.js';
import { ANIMAL_PARTS as P } from './detail-contract.js';

function fixture(lod='near') {
  const joints=[{name:'pelvis',pos:[0,0.6,0],parent:null},{name:'head',pos:[1,1.1,0],parent:'pelvis'}];
  const rig=makeSkeleton(joints),geo=new THREE.SphereGeometry(0.4,8,6),n=geo.attributes.position.count;
  geo.translate(0,0.8,0);geo.setAttribute('aRestPosition',geo.attributes.position.clone());
  geo.setAttribute('aDetailPart',new THREE.Float32BufferAttribute(new Float32Array(n).fill(P.body),1));
  const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
  for(let i=0;i<n;i++){indices[i*4]=i%2;weights[i*4]=1;}
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geo,createAnimalMaterial('tiger'));mesh.add(rig.root);mesh.bind(new THREE.Skeleton(rig.bones));mesh.castShadow=true;mesh.receiveShadow=true;
  const data={geo,joints,detail:{species:'tiger',lod,eyes:[{center:[1.22,1.21,0.16],radius:[0.038,0.038,0.032],side:1},{center:[1.22,1.21,-0.16],radius:[0.038,0.038,0.032],side:-1}]}};
  return {mesh,rig,data};
}
function compile(material,kind='physical') {
  const lib=THREE.ShaderLib[kind],s={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}};
  material.onBeforeCompile(s,{});return s;
}

test('clean analytic coat uses rest coordinates, stable species keys, composes wet/underwater hooks',()=>{
  for(const species of ['tiger','stag','doe','fawn','bear','panda']){
    const m=createAnimalMaterial(species);assert.equal(m.vertexColors,false);assert(m.isMeshPhysicalMaterial);
    const key=m.customProgramCacheKey();assert.equal(key,createAnimalMaterial(species).customProgramCacheKey());
    composeAnimalShader(m,'underwater',s=>patchUnderwater(s));applyWet(m);
    const s=compile(m);assert(s.vertexShader.includes('vAnimalRest=aRestPosition'));
    assert(s.fragmentShader.indexOf('varying vec3 vAnimalRest;')<s.fragmentShader.indexOf('vec3 animalCoat()'));
    assert(s.vertexShader.includes('flat varying float vAnimalPart;'));
    assert(s.fragmentShader.includes('flat varying float vAnimalPart;'));
    assert(s.vertexShader.includes('vAnimalParts4=vec4('));
    assert(s.fragmentShader.includes('return vAnimalParts3[k-12]'));
    assert(!s.fragmentShader.includes('floor(vAnimalPart+0.5)'));
    assert(s.fragmentShader.includes('uSurfaceWet'));assert(s.fragmentShader.includes('uwDepth'));
    assert(s.fragmentShader.indexOf('diffuseColor.rgb = animalCoat();')<s.fragmentShader.indexOf('diffuseColor.rgb *= 1.0 - uSurfaceWet'));
    assert(!s.fragmentShader.includes('NaN'));
    assert(!/\bfloat\s+patch\b/.test(s.fragmentShader),'GLSL reserved keyword patch must not be a local');
  }
  const m=new THREE.MeshPhysicalMaterial();let calls=0;m.onBeforeCompile=()=>calls++;m.customProgramCacheKey=()=> 'prior';
  composeAnimalShader(m,'probe',()=>calls++);compile(m);assert.equal(calls,2);assert.equal(m.customProgramCacheKey(),'prior|animal-probe');
});

test('genuine volume samples have deterministic seeds and shell/depth shaders agree',()=>{
  const a=createHairVolume(7),b=createHairVolume(7),c=createHairVolume(8);
  assert(a.isData3DTexture);assert.deepEqual(a.image.data,b.image.data);assert.notDeepEqual(a.image.data,c.image.data);a.dispose();b.dispose();c.dispose();
  const {mesh,data}=fixture(),f=createAnimalFur(mesh,data,{species:'tiger',quality:'high',seed:7});
  assert.equal(f.shells.length,12);const shell=f.shells[0];
  for(const [material,kind] of [[shell.material,'physical'],[shell.customDepthMaterial,'depth'],[shell.customDistanceMaterial,'distance']]){
    const s=compile(material,kind);
    assert(s.fragmentShader.includes('texture(uAnimalHair,vAnimalRest*19.0)'));
    assert(s.fragmentShader.includes('discard'));assert(s.fragmentShader.includes('animalFurMask'));
    assert(s.vertexShader.indexOf('transformed +=')<s.vertexShader.indexOf('#include <skinning_vertex>'));
    assert(s.vertexShader.includes('normalize(normal)+animalComb'));
    assert.equal(s.uniforms.uAnimalShell.value,1/12);
    assert(s.fragmentShader.includes('smoothstep(0.02,0.72,vAnimalFurCoverage)'));
    assert(s.vertexShader.includes('animalFurCoverage(aRestPosition,normal,aDetailPart)'));
    assert(s.vertexShader.includes('uAnimalFurWet*0.52)*vAnimalFurCoverage'));
    assert(s.fragmentShader.includes('furAlpha<0.06'));
    if(kind!=='physical')assert(s.fragmentShader.includes('furAlpha<0.4'));
  }
  f.update(0,1,0);assert.equal(f.snapshot().visibleShells,12);assert.equal(f.snapshot().shadowShells,1);
  f.update(25,0,0);assert(f.snapshot().fade>0&&f.snapshot().fade<1);
  f.update(30,0,0);assert.equal(f.snapshot().visibleShells,0);f.dispose();
});

test('identity child shell shares owner bind and stays coincident under transformed roots and pose',()=>{
  const {mesh,rig,data}=fixture();const parent=new THREE.Group();parent.position.set(12,5,-8);parent.rotation.set(0.2,0.7,-0.1);parent.scale.setScalar(1.7);parent.add(mesh);
  mesh.position.set(-4,0.7,3);mesh.rotation.y=-0.4;mesh.scale.set(1.8,1.4,1.5);
  const inverseBefore=mesh.skeleton.boneInverses.map(m=>m.toArray());
  const f=createAnimalFur(mesh,data,{species:'tiger',quality:'low'});
  rig.byName.head.rotation.set(0.3,-0.6,0.2);parent.updateMatrixWorld(true);mesh.skeleton.update();
  for(const shell of f.shells){
    assert.equal(shell.skeleton,mesh.skeleton);assert.equal(shell.geometry,mesh.geometry);assert.deepEqual(shell.position.toArray(),[0,0,0]);
    assert.deepEqual(shell.bindMatrix.toArray(),mesh.bindMatrix.toArray());assert.deepEqual(shell.bindMatrixInverse.toArray(),mesh.bindMatrixInverse.toArray());
    for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){
      const base=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      const copy=shell.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(shell.matrixWorld);
      assert(base.distanceTo(copy)<1e-10);
    }
  }
  assert.deepEqual(mesh.skeleton.boneInverses.map(m=>m.toArray()),inverseBefore);f.dispose();
});

test('eyes use metadata head offsets, restrained curved iris/pupil, actual mesh blink and reflected catchlight',()=>{
  const {rig,data}=fixture();rig.byName.head.rotation.y=0.8;
  const eyes=createAnimalEyes(rig,data,{species:'tiger',seed:19});
  assert.equal(eyes.root.parent,rig.byName.head);assert.deepEqual(eyes.snapshot().offsets[0],data.detail.eyes[0].center.map((v,i)=>v-data.joints[1].pos[i]));
  const eye=eyes.root.children[0],iris=eye.getObjectByName('iris'),pupil=eye.getObjectByName('pupil'),lid=eye.getObjectByName('blinking-lid');
  assert.equal(iris.material.roughness,0.05);assert.equal(iris.material.clearcoat,1);assert.equal(iris.material.emissive.getHex(),0);assert.equal(pupil.position.length(),0);
  const before=lid.geometry.attributes.position.array.slice();
  let peak=0,at=0;for(let t=0;t<4.2;t+=0.001){const b=blinkAt(t,19);if(b>peak){peak=b;at=t;}}
  eyes.update(at,true,0,0);assert(eyes.snapshot().closure>0.99);assert.notDeepEqual(lid.geometry.attributes.position.array,before);eyes.dispose();
});

test('pause, deterministic reset, desynchronisation, finite weather, far LOD and idempotent ownership-safe disposal',()=>{
  const a=fixture(),f=attachAnimalDetail(a.mesh,a.rig,a.data,{seed:19});
  f.update({time:0,dt:0,distance:5});f.update({time:2,dt:2,distance:5});const elapsed=f.snapshot().elapsed;
  f.update({time:50,dt:0,distance:8,wet:NaN,night:Infinity});assert.equal(f.snapshot().elapsed,elapsed);assert.equal(f.snapshot().wet,0);assert.equal(f.snapshot().night,0);
  f.update({time:0,dt:0});assert.equal(f.snapshot().elapsed,0);
  f.update({time:2,dt:2});assert.equal(f.snapshot().eyes.closure,blinkAt(2,19));
  assert(Array.from({length:420},(_,i)=>blinkAt(i/100,19)).some((v,i)=>v!==blinkAt(i/100,20)));
  let geo=0,mat=0,skel=0;a.mesh.geometry.addEventListener('dispose',()=>geo++);a.mesh.material.addEventListener('dispose',()=>mat++);a.mesh.skeleton.dispose=()=>skel++;
  f.dispose();f.dispose();assert.deepEqual([geo,mat,skel],[0,0,0]);assert(!a.mesh.children.some(x=>x.userData.animalFur));assert(!a.rig.byName.head.children.some(x=>x.name==='animal-eyes'));
  const b=fixture('far'),far=attachAnimalDetail(b.mesh,b.rig,b.data,{seed:19});far.update({time:0,dt:0,distance:3});assert.equal(far.snapshot().fur.shellCount,0);assert.equal(far.snapshot().eyes.visible,false);far.dispose();
});
