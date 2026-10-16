import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import { ImportedSpecGlossMaterial, ImportedSpecGlossExtension, SPEC_GLOSS_EXTENSION } from './imported-materials.js';
import { applyWet } from '../render/shared.js';
test('legacy extension uses actual author diffuse texture, alpha and F0 without mutating JSON',async()=>{
 const json={materials:[{extensions:{[SPEC_GLOSS_EXTENSION]:{diffuseFactor:[.4,.3,.2,.7],diffuseTexture:{index:3},glossinessFactor:.8,specularFactor:[.12,.08,.03],specularGlossinessTexture:{index:4}}}}]};const original=JSON.stringify(json),calls=[];
 const ext=new ImportedSpecGlossExtension({json,async assignTexture(p,k,d,space){calls.push([k,d.index,space]);p[k]=new THREE.Texture();p[k].colorSpace=space;}}),params={metalnessMap:{},roughnessMap:{}};
 assert.equal(ext.getMaterialType(0),ImportedSpecGlossMaterial);await ext.extendMaterialParams(0,params);
 assert.equal(JSON.stringify(json),original);assert.deepEqual(calls,[['map',3,THREE.SRGBColorSpace],['specGlossMap',4,THREE.SRGBColorSpace]]);assert.equal(params.opacity,.7);assert.equal(params.metalness,0);assert.equal(params.metalnessMap,undefined);assert.deepEqual(params.specGlossColor,[.12,.08,.03]);
 const m=new ImportedSpecGlossMaterial(params);assert.equal(m.map,params.map);assert.equal(m.specGlossMap,params.specGlossMap);assert.ok(Math.abs(m.roughness-.2)<1e-9);assert.equal(m.opacity,.7);m.dispose();params.map.dispose();params.specGlossMap.dispose();
});
test('native legacy shader preserves F0 and gloss alpha in current Three BRDF and wet hook',()=>{
 const m=new ImportedSpecGlossMaterial({specGlossColor:[0,0,0],glossiness:0});applyWet(m,true);const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s);
 assert.ok(s.fragmentShader.includes('material.diffuseContribution=diffuseColor.rgb'));assert.ok(s.fragmentShader.includes('material.specularColorBlended=material.specularColor'));assert.ok(s.fragmentShader.includes('1.0-clamp(ownerSpecGloss.a'));assert.ok(s.fragmentShader.includes('uSurfaceWet'));assert.equal(s.uniforms.ownerSpecular.value,m.specGlossColor);assert.equal(s.uniforms.ownerGlossiness.value,0);m.dispose();
});
test('legacy material clone owns scalar/color state while preserving immutable texture ownership',()=>{
 const map=new THREE.Texture(),m=new ImportedSpecGlossMaterial({map,specGlossColor:[.1,.2,.3],glossiness:.7}),c=m.clone();assert.equal(c.map,map);assert.notEqual(c.specGlossColor,m.specGlossColor);assert.deepEqual(c.specGlossColor.toArray(),m.specGlossColor.toArray());c.specGlossColor.r=.8;assert.equal(m.specGlossColor.r,.1);assert.equal(c.glossiness,.7);assert.equal(c.customProgramCacheKey(),m.customProgramCacheKey());c.dispose();m.dispose();map.dispose();
});
test('legacy plugin does not override unrelated materials or silently accept unknown extensions',()=>{
 const e=new ImportedSpecGlossExtension({json:{materials:[{extensions:{some_other_extension:{}}}]}});assert.equal(e.getMaterialType(0),null);assert.equal(e.name,SPEC_GLOSS_EXTENSION);
});
