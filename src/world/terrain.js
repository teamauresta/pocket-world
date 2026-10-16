// Island + sea floor mesh with a splatted, procedural PBR material.
import * as THREE from 'three';
import { GRID, HALF } from './config.js';
import { U, GLSL_NOISE, patchUnderwater } from '../render/shared.js';

export const GLSL_BUMP = /* glsl */ `
vec3 perturbNormalArbX(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = dFdx(surf_pos);
  vec3 vSigmaY = dFdy(surf_pos);
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

export function buildTerrain(hf, textures, { releasePolish = false } = {}) {
  const n = GRID;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  const zone = new Float32Array(n * n * 4);
  const tmp = [0, 1, 0];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = hf.x(i), z = hf.x(j);
      pos[k * 3] = x; pos[k * 3 + 1] = hf.h[k]; pos[k * 3 + 2] = z;
      hf.normalAt(x, z, tmp);
      nor[k * 3] = tmp[0]; nor[k * 3 + 1] = tmp[1]; nor[k * 3 + 2] = tmp[2];
      for (let q = 0; q < 4; q++) zone[k * 4 + q] = hf.zone[k * 4 + q];
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      // alternate the diagonal along the steepest direction for smoother silhouettes
      if (Math.abs(hf.h[a] - hf.h[d]) < Math.abs(hf.h[b] - hf.h[c])) {
        idx[p++] = a; idx[p++] = c; idx[p++] = d; idx[p++] = a; idx[p++] = d; idx[p++] = b;
      } else {
        idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aZone', new THREE.BufferAttribute(zone, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = U.uWet; shader.uniforms.uRain = U.uRain;
    shader.uniforms.tGrass = { value: textures.grass };
    shader.uniforms.tDirt = { value: textures.dirt };
    shader.uniforms.uRiverMask = { value: textures.riverMask };
    shader.uniforms.uHalf = { value: HALF };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aZone; varying vec4 vZone; varying vec3 vWNormal;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vZone = aZone; vWNormal = objectNormal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tGrass; uniform sampler2D tDirt; uniform sampler2D uRiverMask; uniform float uHalf;
        varying vec4 vZone; varying vec3 vWNormal;
        uniform float uWet; uniform float uRain;
        float gRock; float gRough; float gWet; float gPuddle;
        ${GLSL_BUMP}
        vec3 terrainAlbedo(vec3 wp, vec3 wn) {
          float h = wp.y;
          float slope = 1.0 - wn.y;
          float n1 = fbm2(wp.xz * 0.13);
          float n2 = vnoise(wp.xz * 1.1);
          vec3 gTex = texture2D(tGrass, wp.xz * 0.13).rgb * 0.6 + texture2D(tGrass, wp.xz * 0.031).rgb * 0.4;
          float gLum = dot(gTex, vec3(0.3, 0.59, 0.11));
          vec3 dTex = texture2D(tDirt, wp.xz * 0.11).rgb;
          vec3 cBamboo = vec3(0.115, 0.20, 0.035);
          vec3 cMeadow = vec3(0.15, 0.22, 0.035);
          vec3 cJungle = vec3(0.045, 0.12, 0.022);
          vec3 cForest = vec3(0.055, 0.095, 0.028);
          vec3 grass = vZone.x * cBamboo + vZone.y * cMeadow + vZone.z * cJungle + vZone.w * cForest;
          grass *= 0.55 + 6.0 * gLum;
          grass *= 0.85 + 0.3 * n2;
          grass = mix(grass, grass * vec3(1.35, 1.12, 0.6), smoothstep(0.55, 0.78, n1) * (vZone.y + vZone.x * 0.5));
          vec3 soil = dTex * vec3(0.8, 0.68, 0.55);
          vec3 ground = mix(grass, soil, clamp(0.5 * vZone.w * smoothstep(0.35, 0.65, n1) + 0.35 * vZone.z * smoothstep(0.45, 0.7, n1), 0.0, 0.8));
          // rock: layered, with moss on gentle ledges
          float rn = fbm3(wp * vec3(0.22, 0.75, 0.22));
          float strata = 0.5 + 0.5 * sin(wp.y * 2.3 + rn * 5.0);
          float big = fbm3(wp * vec3(0.09, 0.05, 0.09));
          float crev = smoothstep(0.0, 0.07, abs(vnoise3(wp * vec3(0.42, 0.11, 0.42)) - 0.5));
          vec3 rock = mix(vec3(0.040, 0.036, 0.031), vec3(0.17, 0.155, 0.13), rn * 0.6 + strata * 0.2 + big * 0.35);
          rock *= 0.45 + 0.55 * crev;
          rock = mix(rock, rock * vec3(1.15, 1.0, 0.82), smoothstep(0.55, 0.8, big));
          float moss = smoothstep(0.5, 0.72, fbm2(wp.xz * 0.45 + 7.0)) * smoothstep(0.55, 0.8, wn.y);
          rock = mix(rock, vec3(0.05, 0.085, 0.025), moss * 0.85);
          // sand
          float sandN = vnoise(wp.xz * 2.4) * 0.45 + vnoise(wp.xz * 0.45) * 0.55;
          vec3 sand = vec3(0.44, 0.33, 0.185) * (0.85 + 0.25 * sandN);
          float sandW = 1.0 - smoothstep(0.55, 1.15, h + (n2 - 0.5) * 0.45);
          float rockW = smoothstep(0.42, 0.66, slope + (n1 - 0.5) * 0.3) + smoothstep(16.5, 22.0, h + n1 * 4.0) * 0.75;
          rockW = clamp(rockW, 0.0, 1.0);
          vec3 col = mix(mix(ground, rock, rockW), sand, sandW * (1.0 - rockW * 0.6));
          // river banks: damp dark soil and pebbles
          float rv = texture2D(uRiverMask, (wp.xz + uHalf) / (2.0 * uHalf)).r;
          col = mix(col, mix(soil * 0.75, rock * 1.3, 0.4), rv * (1.0 - sandW) * 0.85);
          // wet band at the waterline
          float wet = (1.0 - smoothstep(0.03, 0.4, h)) * smoothstep(-0.7, -0.02, h);
          gWet = max(max(wet, rv * .7), uWet * (1.0 - slope * .5) * step(0.0, h));
          gPuddle = smoothstep(.97, 1.0, wn.y) * smoothstep(.65, .8, n1) * uWet * step(0.0, h);
          col *= 1.0 - 0.38 * gWet;
          // sea floor
          if (h < -0.15) {
            float uwRock = smoothstep(0.45, 0.7, slope + (n1 - 0.5) * 0.3);
            vec3 reefRock = vec3(0.12, 0.11, 0.10) * (0.7 + 0.6 * rn);
            float cn = fbm2(wp.xz * 0.9 + 17.0);
            reefRock = mix(reefRock, vec3(0.42, 0.16, 0.30), smoothstep(0.55, 0.7, cn) * 0.8);
            reefRock = mix(reefRock, vec3(0.30, 0.36, 0.12), smoothstep(0.55, 0.7, 1.0 - cn) * 0.6);
            vec3 sea = mix(vec3(0.44, 0.38, 0.26) * (0.85 + 0.25 * sandN), reefRock, uwRock);
            float grassPatch = smoothstep(0.58, 0.72, fbm2(wp.xz * 0.16 + 30.0)) * smoothstep(-7.0, -2.0, h) * (1.0 - uwRock);
            sea = mix(sea, vec3(0.07, 0.11, 0.03), grassPatch * 0.55);
            col = mix(col, sea, smoothstep(-0.15, -0.9, h));
            rockW = max(rockW, uwRock);
          }
          gRock = rockW;
          gRough = mix(0.96, 0.93, rockW);
          gRough = mix(mix(gRough, .45, gWet), .08, gPuddle);
          col = mix(col, col * .65, gPuddle);
          return col;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = terrainAlbedo(vWorldPos, normalize(vWNormal));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = gRough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float dist = length(vViewPosition);
          float fadeB = 1.0 - smoothstep(60.0, 220.0, dist);
          float fadeC = 1.0 - smoothstep(180.0, 420.0, dist);
          float crag = gRock * smoothstep(1.5, 4.0, vWorldPos.y) * (fbm3(vWorldPos * vec3(0.38, 0.16, 0.38)) * 2.4 + vnoise3(vWorldPos * vec3(0.42, 0.11, 0.42)) * 0.8) * fadeC;
          float bh = crag + (gRock * fbm3(vWorldPos * 1.7) * 0.55 + (1.0 - gRock) * vnoise(vWorldPos.xz * 2.6) * 0.1) * fadeB;
          if (vWorldPos.y < -0.2) bh += 0.04 * sin(vWorldPos.x * 3.1 + vWorldPos.z * 1.3 + vnoise(vWorldPos.xz * 0.7) * 6.0);
          bh += sin(length(fract(vWorldPos.xz * 1.25) - .5) * 32.0 - uTime * 8.0) * .015 * gPuddle * uRain;
          vec2 dH = vec2(dFdx(bh), dFdy(bh));
          normal = perturbNormalArbX(-vViewPosition, normal, dH, faceDirection);
        }`);
    if (releasePolish) {
      shader.uniforms.uFallLocation = { value: new THREE.Vector2(hf.river.fall.x,hf.river.fall.z) };
      shader.uniforms.uFallDir = { value: new THREE.Vector2(...hf.river.fall.dir) };
      shader.uniforms.uFallLevels = { value: new THREE.Vector2(hf.river.fall.bottom,hf.river.fall.top) };
      shader.fragmentShader = shader.fragmentShader
        .replace('float gRock;', 'uniform vec2 uFallLocation; uniform vec2 uFallDir; uniform vec2 uFallLevels; float gRock;')
        .replace('rock *= 0.45 + 0.55 * crev;',           'rock *= 0.78 + 0.22 * crev; float seam = 1.0-smoothstep(0.025,0.11,abs(sin(wp.y*1.55+wp.x*.10+wp.z*.07+big*.85))); rock *= 1.0-seam*.13*smoothstep(.28,.68,big);')
        .replace('float bh = crag +', 'float stratRelief = (1.0-smoothstep(.025,.13,abs(sin(vWorldPos.y*1.55+vWorldPos.x*.10+vWorldPos.z*.07))))*.055*gRock*fadeB; float bh = crag*.55+stratRelief +')
        .replace('vec3(0.42, 0.16, 0.30)', 'vec3(0.19,0.15,0.13)')
        .replace('vec3(0.30, 0.36, 0.12)', 'vec3(0.15,0.17,0.11)')
        .replace('// wet band at the waterline',           'float bankSand = rv*(1.0-rv)*3.0*(1.0-rockW)*smoothstep(.0,.7,h); col = mix(col,sand*vec3(.77,.83,.87),bankSand*.65);\n// wet band at the waterline')
        .replace('gPuddle = smoothstep',           'vec2 fd = wp.xz-uFallLocation; float along = dot(fd,uFallDir); float across = dot(fd,vec2(-uFallDir.y,uFallDir.x)); float fallWet = (1.0-smoothstep(1.0,2.7,abs(across)))*(1.0-smoothstep(.3,2.8,abs(along)))*smoothstep(uFallLevels.x-.5,uFallLevels.x+1.0,h)*(1.0-smoothstep(uFallLevels.y,uFallLevels.y+1.0,h)); gWet = max(gWet,fallWet*.92);\ngPuddle = smoothstep');
    }
    // must run last: it prepends the noise helpers the terrain code relies on
    patchUnderwater(shader);
  };
  mat.customProgramCacheKey = () => releasePolish ? 'terrain-release-landscape-v1' : 'terrain-v1';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// Top-down textures the shaders read: terrain height (half float) and river proximity
export function buildDataTextures(hf) {
  const n = GRID;
  const hdata = new Uint16Array(n * n);
  for (let k = 0; k < n * n; k++) hdata[k] = THREE.DataUtils.toHalfFloat(hf.h[k]);
  const height = new THREE.DataTexture(hdata, n, n, THREE.RedFormat, THREE.HalfFloatType);
  height.magFilter = THREE.LinearFilter; height.minFilter = THREE.LinearFilter;
  height.wrapS = height.wrapT = THREE.ClampToEdgeWrapping;
  height.needsUpdate = true;

  const R = 256;
  const rdata = new Uint8Array(R * R * 4);
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < R; i++) {
      const x = -HALF + (i + 0.5) / R * 2 * HALF, z = -HALF + (j + 0.5) / R * 2 * HALF;
      const info = hf.riverInfo(x, z);
      const m = 1 - THREE.MathUtils.smoothstep(info.dist, info.width * 0.9, info.width + 1.6);
      const k = (j * R + i) * 4;
      rdata[k] = Math.round(m * 255); rdata[k + 3] = 255;
    }
  }
  const riverMask = new THREE.DataTexture(rdata, R, R, THREE.RGBAFormat);
  riverMask.magFilter = THREE.LinearFilter; riverMask.minFilter = THREE.LinearFilter;
  riverMask.needsUpdate = true;
  return { height, riverMask };
}
