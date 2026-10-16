import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { leafMaterial, barkMaterial, applyWind, depthMaterialFor, distanceMaterialFor, prepareLeafMotion, prepareVegetationDefaults } from './materials.js';
import { createLeafDetail, createBarkDetail, vegetationTextureCacheInfo } from './detail-textures.js';
import { U, applyWet } from '../render/shared.js';
const digest = a => crypto.createHash('sha256').update(a).digest('hex');
const shader = (mat, type='standard') => {const s={uniforms:{},vertexShader:THREE.ShaderLib[type].vertexShader,fragmentShader:THREE.ShaderLib[type].fragmentShader};mat.onBeforeCompile(s);return s;};
const source = () => {const t=new THREE.Texture();t.name='leaf_oak';return t;};
test('legacy foliage fallback buffers survive VAO/program order without changing geometry',()=>{
 const g=new THREE.PlaneGeometry(1,1),m=leafMaterial(source(),0xffffff,{quality:'low',wind:{flutter:.02}});
 const positions=g.attributes.position.array.slice(),indices=g.index.array.slice();
 assert.equal(prepareVegetationDefaults(g,m),6);assert.equal(prepareVegetationDefaults(g,m),0);
 for(const [key,value] of Object.entries({aLeafPivot:[0,0,0],aLeafAxis:[0,1,0],aLeafMotion:[0],aCrownDepth:[0],aLeafVariant:[0],color:[1,1,1]})){
  const a=g.attributes[key];assert.equal(a.count,g.attributes.position.count);assert.equal(a.itemSize,value.length);
  for(let i=0;i<a.count;i++)assert.deepEqual(Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)),value);
 }
 assert.deepEqual(g.attributes.position.array,positions);assert.deepEqual(g.index.array,indices);
 const authored=g.attributes.color;authored.setXYZ(0,.4,.6,.2);prepareVegetationDefaults(g,m);assert.equal(g.attributes.color,authored);assert.ok(Math.abs(authored.getX(0)-.4)<1e-7);
 const bark=new THREE.MeshStandardMaterial();applyWind(bark,{});const b=new THREE.BoxGeometry();assert.equal(prepareVegetationDefaults(b,bark),3);assert.equal(b.hasAttribute('aCrownDepth'),false);
 g.dispose();b.dispose();m.dispose();bark.dispose();
});
test('procedural 1024 leaf cells have genuine independent detail and unit normals',()=>{
 const m=createLeafDetail('oak');assert.equal(m.size,1024);assert.equal(m.color.image.width,3072);assert.equal(m.color.image.height,1024);assert.equal(m.variants,3);
 assert.equal(m.color.colorSpace,THREE.NoColorSpace);assert.equal(m.color.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(m.normal.flipY,false);
 const a=m.color.image.data,n=m.normal.image.data;let tilted=0,maxError=0,subpixelVariation=0;
 for(let i=0;i<n.length;i+=4){assert.equal(a[i+3],255);assert.equal(n[i+3],255);const nx=n[i]/255*2-1,ny=n[i+1]/255*2-1,nz=n[i+2]/255*2-1;maxError=Math.max(maxError,Math.abs(Math.hypot(nx,ny,nz)-1));if(Math.abs(nx)+Math.abs(ny)>.08)tilted++;if(i+4<a.length&&a[i]!==a[i+4])subpixelVariation++;}
 assert.ok(maxError<.007);assert.ok(tilted>10000);assert.ok(subpixelVariation>10000);assert.notEqual(digest(a.subarray(0,4096)),digest(a.subarray(4096,8192)));
 m.color.dispose();m.normal.dispose();
});
test('low leaf generation deterministic, quarter memory and finite',()=>{
 const a=createLeafDetail('ash','low'),b=createLeafDetail('ash','low');assert.equal(a.size,512);assert.equal(a.bytes,3*512*512*8);assert.equal(digest(a.color.image.data),digest(b.color.image.data));assert.equal(digest(a.normal.image.data),digest(b.normal.image.data));for(const m of[a,b]){m.color.dispose();m.normal.dispose();}
});
test('shared texture refs released only when last material is disposed',()=>{
 const a=leafMaterial(source(),0xffffff,{quality:'low'}),b=leafMaterial(source(),0xffffff,{quality:'low'});
 assert.equal(shader(a).uniforms.uLeafDetail.value,shader(b).uniforms.uLeafDetail.value);assert.equal(vegetationTextureCacheInfo().find(e=>e.key==='leaf:oak:low').refs,2);
 a.dispose();assert.equal(vegetationTextureCacheInfo().find(e=>e.key==='leaf:oak:low').refs,1);b.dispose();assert.equal(vegetationTextureCacheInfo().length,0);
});
test('leaf defaults, source alpha and categorical flat variants are safe for legacy',()=>{
 const t=source(),m=leafMaterial(t,0xffffff,{quality:'low',alphaTest:.37}),s=shader(m);assert.equal(m.map,t);assert.equal(m.alphaTest,.37);assert.equal(m.vertexColors,true);
 for(const k of ['aLeafVariant','aCrownDepth','aLeafPivot','aLeafAxis','aLeafMotion','color'])assert.ok(m.defaultAttributeValues[k].every(Number.isFinite));
 assert.ok(s.fragmentShader.includes('flat varying float vLeafVariant'));assert.ok(s.fragmentShader.includes('1.0 - .5 * clamp(vCrownDepth'));assert.ok(s.fragmentShader.includes('#include <alphatest_fragment>'));assert.ok(!s.fragmentShader.includes('dFdx(vLeafVariant)'));m.dispose();
});
test('wind wet translucency hooks compose with stable bounded program keys',()=>{
 const m=leafMaterial(source(),0xffffff,{quality:'low',wind:{flutter:.02}});applyWet(m,true);const key=m.customProgramCacheKey();applyWet(m,true);assert.equal(key,m.customProgramCacheKey());const s=shader(m);
 for(const k of ['uTime','uWind','uWindStrength','uWindGust','uReduced','uSunDir','uSunColor'])assert.equal(s.uniforms[k],U[k]);assert.equal(s.uniforms.uSurfaceWet,U.uWet);assert.ok(s.fragmentShader.includes('vegUnderside'));assert.equal((s.fragmentShader.match(/uniform float uSurfaceWet/g)||[]).length,1);
 const m2=leafMaterial(source(),0xffffff,{quality:'low',wind:{flutter:.02}});applyWet(m2,true);assert.equal(key,m2.customProgramCacheKey());m.dispose();m2.dispose();
});
test('preexisting hooks preserved, wind idempotent, malformed floats sanitized',()=>{
 const m=new THREE.MeshStandardMaterial();let calls=0;m.onBeforeCompile=()=>calls++;m.customProgramCacheKey=()=> 'upstream';applyWind(m,{amp:NaN,heightScale:0,stiff:Infinity});applyWind(m);const s=shader(m);assert.equal(calls,1);assert.ok(m.customProgramCacheKey().startsWith('upstream|'));assert.ok(!s.vertexShader.includes('NaN'));assert.equal((s.vertexShader.match(/uniform float uTime/g)||[]).length,1);
});
test('colour depth distance share exact deformation and uniforms',()=>{
 const m=leafMaterial(source(),0xffffff,{quality:'low',wind:{flutter:.02}}),d=depthMaterialFor(m),p=distanceMaterialFor(m);const s=shader(m),ds=shader(d,'depth'),ps=shader(p,'distance');
 const chunk=s=>s.vertexShader.slice(s.vertexShader.indexOf('    vec3 vegBase'),s.vertexShader.indexOf('#include <project_vertex>'));
 assert.equal(chunk(s),chunk(ds));assert.equal(chunk(s),chunk(ps));for(const k of ['uTime','uWind','uWindStrength','uWindGust','uReduced'])assert.equal(s.uniforms[k],ds.uniforms[k]);assert.equal(d.map,m.map);assert.equal(d.alphaTest,m.alphaTest);assert.ok(s.vertexShader.includes('transformed += inverse(mat3(instanceMatrix)) * vegOffset'));m.dispose();d.dispose();p.dispose();
});
test('rigid card pivot attributes preserve positions and constant per-card axis',()=>{
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-1,2,0,-1,0,0,1,0,0,1,2,0],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,0,0,1,0,1,1],2));g.setAttribute('aLeafVariant',new THREE.Float32BufferAttribute([2,2,2,2],1));const before=g.attributes.position.array.slice();prepareLeafMotion(g);assert.deepEqual(before,g.attributes.position.array);assert.deepEqual([...g.attributes.aLeafMotion.array],[1,1,1,1]);assert.deepEqual([...g.attributes.aLeafPivot.array],Array(12).fill(0));assert.deepEqual([...g.attributes.aLeafAxis.array],[1,0,0,1,0,0,1,0,0,1,0,0]);const a=g.attributes.aLeafAxis;prepareLeafMotion(g);assert.equal(a,g.attributes.aLeafAxis);
 const legacy=new THREE.PlaneGeometry();prepareLeafMotion(legacy);assert.equal(legacy.attributes.aLeafMotion,undefined);g.dispose();legacy.dispose();
});
test('bark is truthful packed procedural AO roughness with retained normal and metre base moss',()=>{
 const b=createBarkDetail('low');assert.equal(b.size,256);assert.ok(b.provenance.includes('not supplied'));let ao=255,rough=255;const data=b.surface.image.data;for(let i=0;i<data.length;i+=4){ao=Math.min(ao,data[i]);rough=Math.min(rough,data[i+1]);assert.equal(data[i+3],255);}assert.ok(ao<230&&ao>=198);assert.ok(rough>=211);b.surface.dispose();
 const normal=new THREE.Texture(),m=barkMaterial(source(),normal,0xffffff,{quality:'low'});applyWet(m);const s=shader(m);assert.equal(m.normalMap,normal);assert.ok(s.vertexShader.includes('(modelMatrix * vegRest).y - (modelMatrix * vegRoot).y'));assert.ok(s.fragmentShader.includes('smoothstep(.12, 1.8, vBarkHeight)'));assert.ok(s.fragmentShader.includes('vBarkUp'));assert.ok(s.fragmentShader.includes('reflectedLight.indirectDiffuse *='));m.dispose();
});
