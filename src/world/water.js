// The sea as a glass-sided block: top surface and four side faces share one screen-space shader that reads the
// opaque scene's colour and depth to compute absorption, refraction, light shafts, foam and glass highlights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALF, GRID, BOTTOM } from './config.js';
import { U, GLSL_NOISE, GLSL_RAIN } from '../render/shared.js';

const vert = /* glsl */ `
attribute float aSide;
uniform float uTime;
uniform float uHalf; uniform float uWaves; uniform float uWindStrength;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSide;
float waveH(vec2 p, float t) {
  return 0.07 * sin(dot(p, vec2(0.21, 0.13)) + t * 1.1)
       + 0.045 * sin(dot(p, vec2(-0.17, 0.27)) + t * 1.4)
       + 0.025 * sin(dot(p, vec2(0.41, -0.33)) + t * 2.1);
}
void main() {
  vec3 p = position;
  vSide = aSide;
  if (aSide < 0.5) {
    float edge = 1.0 - smoothstep(uHalf - 5.0, uHalf - 0.5, max(abs(p.x), abs(p.z)));
    p.y += waveH(p.xz, uTime * (1.0+.5*uWaves)) * (.6+1.8*uWaves+.6*uWindStrength) * edge;
  }
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vNormalW = normal;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform sampler2D tHeight;
uniform vec2 uResolution;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform float uHalf;
uniform float uBottom;
uniform float uTime;
uniform float uNight;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uAmbient;
uniform vec3 uWaterAbsorb;
uniform vec3 uBackTop;
uniform vec3 uBackBottom;
uniform vec3 uWaterTint;
uniform vec4 uDebug;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSide;
${GLSL_NOISE}
${GLSL_RAIN}

vec3 worldFromDepth(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * ndc;
  v /= v.w;
  return (uViewInv * v).xyz;
}
float sceneDist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return d >= 0.99999 ? 1e5 : length(worldFromDepth(uv, d) - cameraPosition);
}
float boxExit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tm = max(t0, t1);
  return min(min(tm.x, tm.y), tm.z);
}
vec2 waveGrad(vec2 p, float t) {
  return 0.07 * cos(dot(p, vec2(0.21, 0.13)) + t * 1.1) * vec2(0.21, 0.13)
       + 0.045 * cos(dot(p, vec2(-0.17, 0.27)) + t * 1.4) * vec2(-0.17, 0.27)
       + 0.025 * cos(dot(p, vec2(0.41, -0.33)) + t * 2.1) * vec2(0.41, -0.33);
}

void main() {
  vec3 V = vWorld - cameraPosition;
  float distSurf = length(V);
  vec3 rd = V / distSurf;
  vec3 N = normalize(vNormalW);
  if (dot(N, rd) > 0.0) discard;
  vec2 suv = gl_FragCoord.xy / uResolution;
  float dScene = sceneDist(suv);
  if (dScene < distSurf - 0.6) discard;
  float contact = smoothstep(-0.6, 0.35, dScene - distSurf);
  vec3 base = texture2D(tScene, suv).rgb;

  bool isTop = vSide < 0.5;
  float tExit = boxExit(cameraPosition, rd, vec3(-uHalf, uBottom, -uHalf), vec3(uHalf, 0.4, uHalf));
  float px = distSurf * 0.0012;

  vec3 n = N;
  if (isTop) {
    vec2 p = vWorld.xz;
    vec3 a = texture2D(tNormal, p * 0.055 + uTime * (1.0+uWindStrength) * vec2(0.011, 0.007)).rgb * 2.0 - 1.0;
    vec3 b = texture2D(tNormal, p * 0.09 + uTime * (1.0+uWindStrength) * vec2(-0.008, 0.012)).rgb * 2.0 - 1.0;
    vec2 g = waveGrad(p, uTime*(1.0+.5*uWaves)) * (.6+1.8*uWaves+.6*uWindStrength);
    g += rainNormal(p,uTime);
    float far = smoothstep(80.0, 260.0, distSurf);
    vec2 det = (a.xy + b.xy) * mix(0.16, 0.07, far);
    n = normalize(vec3(-g.x + det.x, 1.0, -g.y + det.y));
  }

  // refraction (top surface only)
  vec2 ruv = suv;
  float thick = clamp(min(dScene, tExit) - distSurf, 0.0, 400.0);
  if (isTop) {
    vec2 off = n.xz * 0.05 * clamp(thick / 4.0, 0.0, 1.0) * (40.0 / max(distSurf, 40.0));
    vec2 cand = suv + off;
    float d1 = sceneDist(cand);
    if (d1 > distSurf + 0.2) { ruv = cand; thick = clamp(min(d1, tExit) - distSurf, 0.0, 400.0); }
  }
  vec3 sceneCol = texture2D(tScene, ruv).rgb;

  float sunUp = clamp(uSunDir.y * 1.6, 0.0, 1.0);
  vec3 lightIn = uSunColor * (0.2 + 0.8 * sunUp) * 0.55 + uAmbient * 0.9;
  vec3 mid = vWorld + rd * thick * 0.5;
  float midDepth = max(0.0, -mid.y);
  vec3 lightMid = lightIn * exp(-uWaterAbsorb * midDepth * 0.55);
  vec3 trans = exp(-uWaterAbsorb * thick);
  vec3 inscatter = uWaterTint * lightMid * (1.0 - exp(-0.022 * thick)) * (1.0 - 0.55 * uNight);
  vec3 col = sceneCol * trans + inscatter * (1.0+uFog*.7);
  col *= mix(vec3(1),vec3(.8,.92,.86),uWaves*.25);

  // sun shafts inside the volume
  float L = min(thick, 70.0);
  float shafts = 0.0;
  for (int i = 0; i < 10; i++) {
    float t = (float(i) + 0.5) / 10.0 * L;
    vec3 p = vWorld + rd * t;
    float dp = max(0.0, -p.y);
    vec2 q = p.xz - p.y * uSunDir.xz / max(uSunDir.y, 0.3);
    float s = vnoise(q * 0.21 + vec2(uTime * 0.05, uTime * 0.03)) * vnoise(q * 0.47 - vec2(uTime * 0.04, 0.0));
    shafts += smoothstep(0.22, 0.55, s) * exp(-dp * 0.08) * smoothstep(0.0, 1.5, dp);
  }
  col += uSunColor * vec3(0.55, 0.92, 1.0) * shafts * (L / 10.0) * 0.003 * sunUp * (1.0 - uDebug.x) * (1.0 - uNight);

  float cosT = clamp(dot(-rd, n), 0.0, 1.0);
  if (isTop) {
    float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 R = reflect(rd, n);
    vec3 skyR = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.6, R.y));
    float sd = max(dot(R, uSunDir), 0.0);
    vec3 spec = uSunColor * (pow(sd, mix(1200.0,380.0,uRain)) * (22.0-12.0*uRain) + pow(sd, 160.0) * 0.9) * (1.0 - uNight);
    col = mix(col, skyR, F) + spec + vec3(.55,.7,1.0)*pow(max(dot(R,uMoonDir),0.0),300.0)*4.0*uMoonIntensity;
    // shoreline foam
    vec2 huv = (vWorld.xz + uHalf) / (2.0 * uHalf);
    float wd = -texture2D(tHeight, huv).r;
    float shore = 1.0 - smoothstep(0.0, .5+uWaves*.8, wd);
    float fn = vnoise(vWorld.xz * 1.7 + uTime * vec2(0.35, 0.2)) * 0.6 + vnoise(vWorld.xz * 4.6 - uTime * 0.5) * 0.4;
    float surge = 0.5 + 0.5 * sin(wd * 8.0 - uTime * 1.7 + fn * 3.0);
    float foam = shore * smoothstep(0.5, 0.82, fn * 0.65 + surge * 0.42 + shore * 0.3);
    foam = max(foam,smoothstep(.72,.92,fn) * smoothstep(.4,1.0,uWaves) * .7);
    vec3 foamCol = uSunColor * sunUp * 0.55 + uAmbient * 1.3;
    col = mix(col, foamCol, foam * 0.7);
    // glowing plankton after dark, thickest where the surf breaks
    if (uNight > 0.3) {
      float nightK = smoothstep(0.3, 1.0, uNight);
      vec2 cell = floor(vWorld.xz * 2.4);
      float hh = hash12(cell);
      vec2 fo = fract(vWorld.xz * 2.4) - 0.5 - (hash22(cell) - 0.5) * 0.6;
      float dotm = smoothstep(0.13, 0.0, length(fo));
      float tw = 0.5 + 0.5 * sin(uTime * (1.3 + hh * 3.0) + hh * 40.0);
      float sp = step(0.9 - 0.25 * shore, hh) * dotm * tw;
      col += vec3(0.15, 0.95, 1.1) * sp * nightK * 1.6;
      float patchy = smoothstep(0.45, 0.8, vnoise(vWorld.xz * 0.35 + uTime * 0.05));
      col += vec3(0.04, 0.45, 0.65) * foam * nightK * 0.6 * patchy;
    }
    // rim of the block seen from above
    float rim = 1.0 - smoothstep(0.0, 0.16 + px, uHalf - max(abs(vWorld.x), abs(vWorld.z)));
    col += rim * (uSkyHorizon * 0.7 + uSunColor * 0.2);
  } else {
    // seen through the glass: the surface from below
    if (rd.y > 0.0) {
      float tTop = -cameraPosition.y / rd.y;
      if (tTop <= tExit + 0.05 && dScene + 0.5 > tTop) {
        vec3 ps = cameraPosition + rd * tTop;
        float win = smoothstep(0.62, 0.72, rd.y);
        float rip = (1.0+uWaves*.7)*vnoise(ps.xz * 0.8 + uTime * 0.45) * 0.6 + vnoise(ps.xz * 2.6 - uTime * 0.35) * 0.4;
        vec3 tir = uWaterTint * lightIn * (1.3 + 1.2 * rip);
        vec3 snell = (uSkyHorizon * 0.8 + uSunColor * 0.25) * (0.8 + 0.5 * rip);
        vec3 under = mix(tir, snell, win);
        float k = exp(-(tTop - distSurf) * 0.025);
        col = mix(col, under, 0.65 * k);
      }
    }
    float F = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);
    vec3 R = reflect(rd, n);
    vec3 env = mix(uBackBottom, uBackTop, smoothstep(-0.2, 0.7, R.y));
    float sd = max(dot(R, uSunDir), 0.0);
    col += vec3(.55,.7,1.0)*pow(max(dot(R,uMoonDir),0.0),300.0)*.25*uMoonIntensity;
    col = mix(col, env, F * 0.75) + uSunColor * pow(sd, 500.0) * 3.0 * (1.0 - uNight);
    // bevelled glass edges catching light
    float along = abs(N.x) > 0.5 ? vWorld.z : vWorld.x;
    float dCorner = uHalf - abs(along);
    float edgeV = 1.0 - smoothstep(0.0, 0.22 + px, dCorner);
    float edgeT = 1.0 - smoothstep(0.0, 0.16 + px, -vWorld.y);
    vec3 edgeCol = uSkyHorizon * 0.55 + uSunColor * 0.22 + uWaterTint * 0.3;
    col += (edgeV * 0.55 + edgeT * 0.8) * edgeCol;
    col = mix(col, col * vec3(0.92, 1.03, 1.0), 0.5);
  }
  col = mix(base, col, contact);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function buildWater(hf, { normalTex, heightTex, quality = 'high' }) {
  const n = GRID;
  const top = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, 200, 200);
  top.rotateX(-Math.PI / 2);
  top.deleteAttribute('uv');
  top.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(top.attributes.position.count), 1));

  const pos = [], nor = [], side = [], idx = [];
  const sides = [
    { fixed: 'z', v: HALF, normal: [0, 0, 1] },
    { fixed: 'z', v: -HALF, normal: [0, 0, -1] },
    { fixed: 'x', v: HALF, normal: [1, 0, 0] },
    { fixed: 'x', v: -HALF, normal: [-1, 0, 0] },
  ];
  for (const s of sides) {
    const b = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const t = hf.x(i);
      const x = s.fixed === 'x' ? s.v : t;
      const z = s.fixed === 'z' ? s.v : t;
      const h = Math.min(hf.heightAt(x, z), 0);
      pos.push(x, h, z, x, 0, z);
      nor.push(...s.normal, ...s.normal);
      side.push(1, 1);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = b + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  sg.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  sg.setIndex(idx);
  const geo = mergeGeometries([top, sg]);

  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  const uniforms = {
    ...U, uRippleScale: { value: quality === 'low' ? .625 : 1.25 },
    tScene: { value: null },
    tDepth: { value: null },
    tNormal: { value: normalTex },
    tHeight: { value: heightTex },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uProjInv: { value: new THREE.Matrix4() },
    uViewInv: { value: new THREE.Matrix4() },
    uHalf: { value: HALF },
    uBottom: { value: BOTTOM },
    uBackTop: { value: new THREE.Color(0.5, 0.6, 0.7) },
    uBackBottom: { value: new THREE.Color(0.3, 0.35, 0.4) },
    uWaterTint: { value: new THREE.Color(0.02, 0.36, 0.40) },
    uTime: U.uTime,
    uNight: U.uNight,
    uSunDir: U.uSunDir,
    uSunColor: U.uSunColor,
    uSkyZenith: U.uSkyZenith,
    uSkyHorizon: U.uSkyHorizon,
    uAmbient: U.uAmbient,
    uWaterAbsorb: U.uWaterAbsorb,
    uDebug: U.uDebug,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'sea';
  return mesh;
}
