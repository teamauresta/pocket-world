// Composed foliage/bark hooks; original source silhouette remains authoritative.
import * as THREE from 'three';
import { U, GLSL_NOISE } from '../render/shared.js';
import { acquireLeafDetail, acquireBarkDetail, leafSpecies } from './detail-textures.js';

function hook(material, key, compile) {
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) { prev.call(this, shader, renderer); compile(shader, renderer); };
  material.customProgramCacheKey = () => prevKey + '|' + key;
}
function defaults(material) {
  material.defaultAttributeValues = { ...material.defaultAttributeValues, aCrownDepth: [0], aLeafVariant: [0], aLeafPivot: [0, 0, 0], aLeafAxis: [0, 1, 0], aLeafMotion: [0], color: [1, 1, 1] };
}
// Generic WebGL attribute constants are context-global, not VAO state. A
// shadow/other-material draw can overwrite a cached geometry's missing values.
// Material defaults alone are therefore not reliable across camera/draw orders.
// Materialise only missing fallback data before the first renderer upload.
export function prepareVegetationDefaults(geometry, material) {
  const p = geometry.attributes.position;
  if (!p || (!material.userData.vegetationWind && !material.userData.vegetationDetail)) return 0;
  const keys = ['aLeafPivot', 'aLeafAxis', 'aLeafMotion'];
  if (material.userData.vegetationDetail?.kind === 'leaf') keys.push('aCrownDepth', 'aLeafVariant', 'color');
  let added = 0;
  for (const key of keys) {
    if (geometry.hasAttribute(key)) continue;
    const value = material.defaultAttributeValues?.[key];
    if (!value) continue;
    const data = new Float32Array(p.count * value.length);
    for (let i = 0; i < p.count; i++) data.set(value, i * value.length);
    geometry.setAttribute(key, new THREE.Float32BufferAttribute(data, value.length));
    added++;
  }
  return added;
}
function windOptions(opts = {}) {
  const n = (key, fallback, min, max) => Number.isFinite(opts[key]) ? Math.max(min, Math.min(max, opts[key])) : fallback;
  return { amp: n('amp', .12, 0, 2), flutter: n('flutter', 0, 0, .2), heightScale: n('heightScale', 1, .01, 100), stiff: n('stiff', 2, .1, 8) };
}
// Optional rigid-card attrs must be identical on all vertices. Legacy motion=0 avoids rotating a whole plant.
const windHeader = /* glsl */ `
uniform float uTime; uniform vec2 uWind; uniform float uWindStrength; uniform float uWindGust; uniform float uReduced;
attribute vec3 aLeafPivot; attribute vec3 aLeafAxis; attribute float aLeafMotion;
vec3 vegRotate(vec3 p, vec3 axis, float angle) {
  return p * cos(angle) + cross(axis, p) * sin(angle) + axis * dot(axis, p) * (1.0 - cos(angle));
}
float vegLeafAngle() {
  float phase = dot(aLeafPivot, vec3(51.7, 37.1, 29.3));
  #ifdef USE_INSTANCING
    phase += dot(instanceMatrix[3].xz, vec2(.131, .173));
  #endif
  return (sin(uTime * (9.0 + 3.0 * uWindStrength) + phase) + .3 * sin(uTime * 17.1 + phase * 1.3))
    * clamp(uWindStrength, 0.0, 1.5) * (1.0 - uReduced) * aLeafMotion;
}
`;
function windChunk(o) {
  return /* glsl */ `
    vec3 vegBase = vec3(0.0);
    #ifdef USE_INSTANCING
      vegBase = instanceMatrix[3].xyz;
    #endif
    float vegHeight = clamp(transformed.y / ${o.heightScale.toFixed(4)}, 0.0, 1.5);
    ${o.flutter > 0 ? `
    if (aLeafMotion > .5) {
      transformed = aLeafPivot + vegRotate(transformed - aLeafPivot, normalize(aLeafAxis), vegLeafAngle() * ${Math.min(.2, o.flutter * 5).toFixed(4)});
    }` : ''}
    vec4 vegPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      vegPosition = instanceMatrix * vegPosition;
    #endif
    float vegBend = pow(vegHeight, ${o.stiff.toFixed(4)});
    float vegPhase = dot(vegBase.xz, vec2(.131, .173));
    float vegGust = smoothstep(.6, 1.0, sin(dot(vegBase.xz, uWind) * .08 - uTime * .9 * (.5 + uWindStrength))) * uWindGust;
    float vegSway = sin(uTime * 1.25 + vegPhase) * .6 + sin(uTime * 2.15 + vegPhase * 1.7) * .3 + sin(uTime * 3.7 + vegPhase * 2.3) * .1;
    vec3 vegOffset = vec3(0.0);
    vegOffset.xz = uWind * vegSway * vegBend * ${o.amp.toFixed(4)} * (.4 + 2.2 * uWindStrength) * (1.0 + vegGust);
    vegOffset.xz += uWind * .6 * uWindStrength * uWindStrength * vegBend;
    ${o.flutter > 0 ? `
    if (aLeafMotion < .5) {
      float vegFl = sin(uTime * 6.0 * (1.0 + uWindStrength) + dot(vegPosition.xyz, vec3(3.1, 1.7, 2.3))) * ${o.flutter.toFixed(4)} * vegHeight * clamp(uWindStrength, 0.0, 1.0) * (1.0 - uReduced);
      vegOffset += vec3(vegFl, vegFl * .6, -vegFl * .8);
    }` : ''}
    // All projection/worldpos/shadow chunks subsequently consume the same deformed position.
    #ifdef USE_INSTANCING
      transformed += inverse(mat3(instanceMatrix)) * vegOffset;
    #else
      transformed += vegOffset;
    #endif
    #include <project_vertex>
  `;
}
export function applyWind(material, opts = {}) {
  if (material.userData.vegetationWind) return material;
  const o = windOptions(opts); material.userData.vegetationWind = o; defaults(material);
  hook(material, 'veg-wind-v3:' + JSON.stringify(o), shader => {
    for (const key of ['uTime', 'uWind', 'uWindStrength', 'uWindGust', 'uReduced']) shader.uniforms[key] = U[key];
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + windHeader)
      .replace('#include <project_vertex>', windChunk(o));
    if (o.flutter > 0) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      if (aLeafMotion > .5) objectNormal = vegRotate(objectNormal, normalize(aLeafAxis), vegLeafAngle() * ${Math.min(.2, o.flutter * 5).toFixed(4)});`);
  });
  return material;
}
export function applyTranslucency(material, strength = .5) {
  const amount = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : .5));
  hook(material, 'veg-translucency-v2:' + amount, shader => {
    shader.uniforms.uSunDir = U.uSunDir; shader.uniforms.uSunColor = U.uSunColor;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunDir; uniform vec3 uSunColor;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        vec3 vegLs = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        vec3 vegVd = normalize(vViewPosition);
        float vegBack = pow(clamp(dot(-vegVd, vegLs), 0.0, 1.0), 3.0);
        float vegWrap = clamp(dot(normal, vegLs) * .5 + .5, 0.0, 1.0);
        float vegUnderside = gl_FrontFacing ? 1.0 : 1.18;
        reflectedLight.directDiffuse += diffuseColor.rgb * uSunColor * (vegBack * ${amount.toFixed(3)} * vegUnderside + vegWrap * .12);
      }`);
  });
  return material;
}
function shadowMaterial(material, opts, distance) {
  const params = { map: material.map || null, alphaMap: material.alphaMap || null, alphaTest: material.alphaTest || 0, side: THREE.DoubleSide };
  const d = distance ? new THREE.MeshDistanceMaterial(params) : new THREE.MeshDepthMaterial({ ...params, depthPacking: THREE.RGBADepthPacking });
  const wind = opts || material.userData.vegetationWind;
  if (wind) applyWind(d, wind);
  return d;
}
export function depthMaterialFor(material, windOpts) { return shadowMaterial(material, windOpts, false); }
export function distanceMaterialFor(material, windOpts) { return shadowMaterial(material, windOpts, true); }

export function prepareLeafAtlasUV(geometry,material){
  const atlas=material.userData.vegetationDetail?.baseAtlas;
  if(!atlas||geometry.userData.leafAtlasUV)return false;
  const uv=geometry.attributes.uv,variant=geometry.attributes.aLeafVariant;if(!uv||!variant)throw new Error('Leaf atlas requires actual UV/category buffers');
  const edge=.5/atlas.size;
  for(let i=0;i<uv.count;i++){const v=Math.max(0,Math.min(2,Math.floor(variant.getX(i)+.5))),x=Math.max(edge,Math.min(1-edge,uv.getX(i)));uv.setX(i,(x+v)/3);}
  uv.needsUpdate=true;geometry.userData.leafAtlasUV={size:atlas.size,variants:3,layout:'native map/depth/distance UV; detail reconstructs original card UV'};return true;
}
function applyLeafDetail(m, maps, legacy, normals) {
  defaults(m); m.vertexColors = true;
  const baseAtlas=!!m.userData.vegetationDetail.baseAtlas;
  hook(m, 'veg-leaf-v4:' + Number(legacy) + ':' + Number(normals)+':'+Number(baseAtlas), shader => {
    shader.uniforms.uLeafDetail = { value: maps.color };
    shader.uniforms.uLeafDetailNormal = { value: maps.normal };
    shader.uniforms.uLeafDetailSize = { value: maps.size };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute float aCrownDepth; attribute float aLeafVariant;
      varying float vCrownDepth; flat varying float vLeafVariant; varying vec2 vVegUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vCrownDepth = clamp(aCrownDepth, 0.0, 1.0);
      vLeafVariant = clamp(floor(aLeafVariant + .5), 0.0, 2.0);
      vVegUv = ${baseAtlas?'vec2(uv.x * 3.0 - vLeafVariant, uv.y)':'uv'};`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uLeafDetail; uniform sampler2D uLeafDetailNormal; uniform float uLeafDetailSize;
      varying float vCrownDepth; flat varying float vLeafVariant; varying vec2 vVegUv;
      vec2 vegDetailUv() {
        vec2 q = clamp(vVegUv, vec2(.5 / uLeafDetailSize), vec2(1.0 - .5 / uLeafDetailSize));
        return vec2((q.x + vLeafVariant) / 3.0, q.y);
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 1.0 - .5 * clamp(vCrownDepth, 0.0, 1.0);
      diffuseColor.rgb *= mix(vec3(1.0), texture2D(uLeafDetail, vegDetailUv()).rgb / .94, ${legacy ? '.22' : '.65'});`);
    if (normals) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 vegN = texture2D(uLeafDetailNormal, vegDetailUv()).xyz * 2.0 - 1.0;
        // Derivative basis uses original card UV, never atlas enum derivatives.
        vec3 vegQx = dFdx(-vViewPosition), vegQy = dFdy(-vViewPosition);
        vec2 vegUx = dFdx(vVegUv), vegUy = dFdy(vVegUv);
        vec3 vegT = cross(vegQy, normal) * vegUx.x + cross(normal, vegQx) * vegUy.x;
        vec3 vegB = cross(vegQy, normal) * vegUx.y + cross(normal, vegQx) * vegUy.y;
        float vegInv = inversesqrt(max(max(dot(vegT, vegT), dot(vegB, vegB)), 1e-10));
        normal = normalize(normal * vegN.z + (vegT * vegN.x + vegB * vegN.y) * vegInv * ${legacy ? '.12' : '.32'} * faceDirection);
      }`);
  });
}
// Geometry owner need not add new attributes: enrich only recognised independent four-vertex cards.
// Call during mesh construction BEFORE renderer upload; no RNG/placement/index/topology edits.
export function prepareLeafMotion(geometry) {
  if (geometry.userData.vegetationMotionPrepared) return;
  geometry.userData.vegetationMotionPrepared = true;
  const p = geometry.attributes.position, uv = geometry.attributes.uv;
  if (!p || !uv || p.count % 4 !== 0 || !geometry.attributes.aLeafVariant) return;
  const pivots = new Float32Array(p.count * 3), axes = new Float32Array(p.count * 3), motion = new Float32Array(p.count);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), axis = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 4) {
    // Original tree quad layout: top-left, base-left, base-right, top-right.
    if (Math.abs(uv.getY(i)-1) > .001 || Math.abs(uv.getY(i+1)) > .001 || Math.abs(uv.getY(i+2)) > .001 || Math.abs(uv.getY(i+3)-1) > .001) continue;
    a.fromBufferAttribute(p,i+1); b.fromBufferAttribute(p,i+2); axis.copy(b).sub(a);
    if (axis.lengthSq() < 1e-12) continue;
    axis.normalize(); a.add(b).multiplyScalar(.5);
    for (let j=0;j<4;j++) { a.toArray(pivots,(i+j)*3); axis.toArray(axes,(i+j)*3); motion[i+j]=1; }
  }
  geometry.setAttribute('aLeafPivot',new THREE.BufferAttribute(pivots,3));
  geometry.setAttribute('aLeafAxis',new THREE.BufferAttribute(axes,3));
  geometry.setAttribute('aLeafMotion',new THREE.BufferAttribute(motion,1));
}

export function leafMaterial(tex, color, { wind, translucency = .45, alphaTest = .42, quality = 'high', species } = {}) {
  const sp = leafSpecies(tex, species), legacy = sp === 'legacy';
  const actualQuality = legacy ? 'low' : quality === 'low' ? 'low' : 'high';
  const maps = acquireLeafDetail(sp, actualQuality);
  const m = new THREE.MeshStandardMaterial({ map: tex, color, alphaTest, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .78, metalness: 0 });
  m.userData.vegetationDetail = { kind: 'leaf', species: sp, quality: actualQuality, resolution: maps.size, variants: maps.variants, normalDetail: actualQuality !== 'low', bytes: maps.bytes, provenance: maps.provenance,baseAtlas:tex.userData?.leafAtlas||null };
  if(actualQuality!=='low'&&tex.leafAtlasNormal){m.normalMap=tex.leafAtlasNormal;m.normalScale.set(.3,.3);}
  m.addEventListener('dispose', maps.release);
  applyWind(m, wind); applyLeafDetail(m, maps, legacy, actualQuality !== 'low'); applyTranslucency(m, translucency);
  return m;
}
export function barkMaterial(tex, normalTex, color, { wind, quality = 'high' } = {}) {
  const maps = acquireBarkDetail(quality === 'low' ? 'low' : 'high');
  const m = new THREE.MeshStandardMaterial({ map: tex, normalMap: normalTex || null, color, roughness: .92, metalness: 0 });
  if (normalTex) m.normalScale.set(.8, .8);
  m.userData.vegetationDetail = { kind: 'bark', resolution: maps.size, bytes: maps.bytes, provenance: maps.provenance };
  m.addEventListener('dispose', maps.release); applyWind(m, wind);
  hook(m, 'veg-bark-v3', shader => {
    shader.uniforms.uBarkSurface = { value: maps.surface };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec2 vBarkUv; varying vec3 vBarkLocal; varying float vBarkHeight; varying float vBarkUp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vBarkUv = uv; vBarkLocal = position;
      vec4 vegRest = vec4(position, 1.0); vec4 vegRoot = vec4(0.0, 0.0, 0.0, 1.0);
      vec3 vegNrm = normal;
      #ifdef USE_INSTANCING
        vegRest = instanceMatrix * vegRest; vegRoot = instanceMatrix * vegRoot;
        mat3 vegIm = mat3(instanceMatrix);
        vegNrm /= vec3(dot(vegIm[0],vegIm[0]), dot(vegIm[1],vegIm[1]), dot(vegIm[2],vegIm[2]));
        vegNrm = vegIm * vegNrm;
      #endif
      vBarkHeight = max(0.0, (modelMatrix * vegRest).y - (modelMatrix * vegRoot).y);
      vBarkUp = normalize(mat3(modelMatrix) * vegNrm).y;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uBarkSurface;
      varying vec2 vBarkUv; varying vec3 vBarkLocal; varying float vBarkHeight; varying float vBarkUp;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float vegMossNoise = texture2D(uBarkSurface, vBarkLocal.xz * 17.0 + vBarkLocal.y * vec2(5.0, 7.0)).b;
      float vegMoss = (1.0 - smoothstep(.12, 1.8, vBarkHeight)) * smoothstep(-.08, .65, vBarkUp) * smoothstep(.24, .7, vegMossNoise);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.48, .82, .32), vegMoss * .65);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor *= texture2D(uBarkSurface, vBarkUv).g;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
      reflectedLight.indirectDiffuse *= texture2D(uBarkSurface, vBarkUv).r;`);
  });
  return m;
}
export { GLSL_NOISE };
