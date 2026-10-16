// The display piece: earth cross-section walls under the sea and a lacquered walnut plinth.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HALF, BOTTOM, BASE_H, BASE_MARGIN, GRID } from './config.js';
import { GLSL_NOISE } from '../render/shared.js';
import { GLSL_BUMP } from './terrain.js';

// One vertical strip per side, following the terrain profile at the edge.
export function buildEarthWalls(hf) {
  const n = GRID;
  const pos = [], nor = [], top = [], idx = [];
  const sides = [
    { fixed: 'z', v: HALF, normal: [0, 0, 1] },
    { fixed: 'z', v: -HALF, normal: [0, 0, -1] },
    { fixed: 'x', v: HALF, normal: [1, 0, 0] },
    { fixed: 'x', v: -HALF, normal: [-1, 0, 0] },
  ];
  for (const s of sides) {
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const t = hf.x(i);
      const x = s.fixed === 'x' ? s.v : t;
      const z = s.fixed === 'z' ? s.v : t;
      const h = hf.heightAt(x, z);
      pos.push(x, h, z, x, BOTTOM, z);
      nor.push(...s.normal, ...s.normal);
      top.push(h, h);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      // winding so the face points along the outward normal
      const flip = (s.fixed === 'z' && s.v > 0) || (s.fixed === 'x' && s.v < 0);
      if (flip) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  geo.setIndex(idx);

  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTop; varying float vTop; varying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTop = aTop; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vTop; varying vec3 vWP;
        ${GLSL_NOISE}
        ${GLSL_BUMP}
        float gBump;
        vec3 strata(vec3 wp, float top) {
          float along = wp.x + wp.z;
          float depth = top - wp.y;
          float wob = fbm2(vec2(along * 0.06, 3.1)) * 2.2 + fbm2(vec2(along * 0.35, 7.7)) * 0.35;
          float y = wp.y + wob;
          // sand cap
          vec3 sandC = vec3(0.42, 0.33, 0.19) * (0.85 + 0.3 * vnoise(wp.xy * 3.0 + wp.zy * 3.0));
          // sediment bands
          float band = fract(y * 0.42);
          float bn = vnoise(vec2(along * 0.12, y * 1.7));
          vec3 sed = mix(vec3(0.13, 0.085, 0.045), vec3(0.27, 0.19, 0.10), smoothstep(0.2, 0.8, band + bn * 0.4 - 0.2));
          sed *= 0.8 + 0.35 * vnoise(vec2(along * 1.8, y * 6.0));
          // pebble band and dark bedrock
          float peb = smoothstep(0.72, 0.85, vnoise(vec2(along * 2.4, y * 2.4)));
          sed = mix(sed, vec3(0.10, 0.09, 0.08), peb * 0.75);
          vec3 rock = mix(vec3(0.03, 0.028, 0.03), vec3(0.11, 0.10, 0.095), fbm2(vec2(along * 0.4, y * 0.9)));
          float rockW = smoothstep(${(BOTTOM + 2.5).toFixed(2)}, ${(BOTTOM + 0.5).toFixed(2)}, y) ;
          rockW = max(rockW, smoothstep(9.0, 15.0, depth + wob * 1.5) * 0.85);
          vec3 c = mix(sed, rock, rockW);
          float cap = 1.0 - smoothstep(0.35, 0.9, depth + bn * 0.25);
          c = mix(c, sandC, cap);
          gBump = peb * 0.3 + vnoise(vec2(along * 3.0, y * 3.0)) * 0.15 + rockW * fbm2(vec2(along * 1.2, y * 1.2)) * 0.3;
          return c;
        }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = strata(vWP, vTop);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = perturbNormalArbX(-vViewPosition, normal, vec2(dFdx(gBump), dFdy(gBump)) * 0.25 * (1.0 - smoothstep(50.0, 200.0, length(vViewPosition))), faceDirection);`);
  };
  mat.customProgramCacheKey = () => 'earth-walls-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'earth-walls';
  return mesh;
}

export function buildPlinth() {
  const w = 2 * (HALF + BASE_MARGIN);
  const geo = new RoundedBoxGeometry(w, BASE_H, w, 4, 0.9);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        ${GLSL_NOISE}
        ${GLSL_BUMP}
        float gGrain;
        vec3 walnut(vec3 p, vec3 n) {
          // planks run along x on the front/back, along z on the sides
          float useZ = step(abs(n.z), abs(n.x));
          vec2 q = mix(vec2(p.x, p.z), vec2(p.z, p.x), useZ);
          float fy = p.y * 0.9;
          float warp = fbm2(vec2(q.x * 0.02, q.y * 0.35 + fy)) * 3.0;
          float rings = fract((q.y + fy * 0.5) * 1.6 + warp);
          float fine = vnoise(vec2(q.x * 0.6, (q.y + fy) * 22.0));
          vec3 dark = vec3(0.030, 0.013, 0.006);
          vec3 light = vec3(0.095, 0.046, 0.022);
          vec3 c = mix(dark, light, smoothstep(0.1, 0.9, rings) * 0.6 + fine * 0.4);
          c *= 0.85 + 0.3 * vnoise(vec2(q.x * 0.05, q.y * 0.2));
          gGrain = rings * 0.4 + fine * 0.6;
          return c;
        }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = walnut(vWP, normalize(vWN));')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = perturbNormalArbX(-vViewPosition, normal, vec2(dFdx(gGrain), dFdy(gGrain)) * 0.04, faceDirection);`);
  };
  mat.customProgramCacheKey = () => 'walnut-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = BOTTOM - BASE_H / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'plinth';
  return mesh;
}

// Soft contact shadow under the plinth on an invisible floor
export function buildFloorShadow() {
  const size = 2 * (HALF + BASE_MARGIN) * 1.9;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = BOTTOM - BASE_H - 0.05;
  m.renderOrder = -1;
  m.name = 'floor-shadow';
  return m;
}
