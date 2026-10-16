// Coral reef: staghorn, brain, table and fan corals, tube sponges, anemones, kelp and sea grass.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, Simplex } from '../core/noise.js';
import { patchUnderwater, U } from '../render/shared.js';
import { rockGeometry } from '../veg/rocks.js';
import { HALF, dOf, eOf } from '../world/config.js';

const lin = (r, g, b) => new THREE.Color(Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2));

function colorize(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), c, i);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// sway in the current: displacement grows with height above the base
function applyCurrent(material, { amp = 0.12, heightScale = 1, speed = 0.9, key = '' } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ib = instanceMatrix[3].xyz;
          #else
            vec3 ib = vec3(0.0);
          #endif
          float hN = clamp(transformed.y / ${heightScale.toFixed(3)}, 0.0, 1.0);
          float ph = dot(ib.xz, vec2(0.21, 0.17)) + transformed.x * 0.7 + transformed.z * 0.5;
          float s = sin(uTime * ${speed.toFixed(2)} + ph) * 0.7 + sin(uTime * ${(speed * 2.3).toFixed(2)} + ph * 1.9) * 0.3;
          transformed.x += s * hN * hN * ${amp.toFixed(3)};
          transformed.z += cos(uTime * ${(speed * 0.8).toFixed(2)} + ph * 1.3) * hN * hN * ${(amp * 0.6).toFixed(3)};
        }`);
  };
  const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => prevKey + 'current' + amp + heightScale + speed + key;
  return material;
}

function reefMaterial({ rough = 0.75, current = null, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0, side });
  m.onBeforeCompile = (shader) => patchUnderwater(shader);
  m.customProgramCacheKey = () => 'reef-uw';
  if (current) applyCurrent(m, current);
  return m;
}

// ---------------------------------------------------------------- geometries
function staghorn(seed, base, tip) {
  const rng = mulberry32(seed);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (pos, dir, len, rad, depth) => {
    const end = pos.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(rad * 0.75, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    g.translate(pos.x, pos.y, pos.z);
    const t = depth / 4;
    colorize(g, (x, y, z, c) => c.copy(base).lerp(tip, Math.min(1, t + (y - pos.y) / len * 0.25)));
    parts.push(g);
    if (depth >= 3) {
      const cap = new THREE.SphereGeometry(rad * 0.9, 4, 3);
      cap.translate(end.x, end.y, end.z);
      colorize(cap, (x, y, z, c) => c.copy(tip));
      parts.push(cap);
      return;
    }
    const kids = depth === 0 ? 5 : 2 + (rng() < 0.4 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const az = rng() * Math.PI * 2;
      const tilt = depth === 0 ? 0.5 + rng() * 0.5 : 0.25 + rng() * 0.45;
      const nd = dir.clone().lerp(new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), tilt).normalize();
      nd.y = Math.max(nd.y, 0.25);
      nd.normalize();
      grow(end, nd, len * (0.75 + rng() * 0.2), rad * 0.72, depth + 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.32, 0.11, 0);
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }));
}

function brain(seed, a, b) {
  const N = new Simplex(seed);
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const groove = Math.abs(Math.sin(N.noise3(v.x * 2.2, v.y * 2.2, v.z * 2.2) * 9));
    v.multiplyScalar(1 + groove * 0.05 + N.noise3(v.x, v.y, v.z) * 0.08);
    v.y = v.y < 0 ? v.y * 0.15 : v.y * 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return colorize(g, (x, y, z, c) => {
    const groove = Math.abs(Math.sin(N.noise3(x * 2.2, y / 0.72 * 2.2, z * 2.2) * 9));
    c.copy(a).lerp(b, groove);
  });
}

function table(seed, col) {
  const rng = mulberry32(seed);
  const parts = [];
  const stalk = new THREE.CylinderGeometry(0.12, 0.22, 0.7, 6);
  stalk.translate(0, 0.35, 0);
  stalk.deleteAttribute('uv');
  parts.push(colorize(stalk, (x, y, z, c) => c.copy(col).multiplyScalar(0.7)));
  const seg = 28;
  const pos = [0, 0.72, 0], idx = [];
  const radii = [];
  for (let i = 0; i < seg; i++) radii.push(1 + (rng() - 0.5) * 0.35);
  for (let ring = 1; ring <= 2; ring++) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const r = radii[i] * (ring === 1 ? 0.55 : 1.0);
      pos.push(Math.cos(a) * r, 0.72 + (ring === 2 ? -0.06 : 0.02), Math.sin(a) * r);
    }
  }
  for (let i = 0; i < seg; i++) {
    const n = (i + 1) % seg;
    idx.push(0, 1 + n, 1 + i);
    idx.push(1 + i, 1 + n, 1 + seg + i, 1 + n, 1 + seg + n, 1 + seg + i);
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  top.setIndex(idx);
  top.computeVertexNormals();
  const bottom = top.clone();
  const bi = bottom.index.array;
  for (let i = 0; i < bi.length; i += 3) { const t = bi[i + 1]; bi[i + 1] = bi[i + 2]; bi[i + 2] = t; }
  bottom.translate(0, -0.05, 0);
  bottom.computeVertexNormals();
  parts.push(colorize(top, (x, y, z, c) => c.copy(col).multiplyScalar(0.85 + 0.3 * Math.abs(Math.sin(x * 9) * Math.sin(z * 9)))));
  parts.push(colorize(bottom, (x, y, z, c) => c.copy(col).multiplyScalar(0.5)));
  return mergeGeometries(parts);
}

function sponge(seed, col) {
  const rng = mulberry32(seed);
  const parts = [];
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.6 + rng() * 0.9, r = 0.12 + rng() * 0.08;
    const g = new THREE.CylinderGeometry(r * 1.15, r, h, 9, 3, true);
    g.translate((rng() - 0.5) * 0.5, h / 2, (rng() - 0.5) * 0.5);
    g.rotateZ((rng() - 0.5) * 0.3);
    parts.push(colorize(g, (x, y, z, c) => c.copy(col).multiplyScalar(0.75 + 0.35 * (y / h))));
    const inner = new THREE.CylinderGeometry(r * 0.95, r * 0.8, h * 0.98, 9, 1, true);
    const ia = inner.index.array;
    for (let k = 0; k < ia.length; k += 3) { const t = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = t; }
    inner.translate(g.boundingBox ? 0 : 0, 0, 0);
    inner.computeVertexNormals();
    const gc = g.attributes.position;
    // place the inner wall where the outer one is
    let cx = 0, cz = 0;
    for (let k = 0; k < gc.count; k++) { cx += gc.getX(k); cz += gc.getZ(k); }
    cx /= gc.count; cz /= gc.count;
    inner.translate(cx, h / 2 + 0.01, cz);
    parts.push(colorize(inner, (x, y, z, c) => c.copy(col).multiplyScalar(0.35)));
  }
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }));
}

function anemone(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const base = new THREE.CylinderGeometry(0.42, 0.5, 0.35, 12, 1);
  base.translate(0, 0.17, 0);
  parts.push(colorize(base, (x, y, z, c) => c.copy(lin(0.55, 0.35, 0.3))));
  const n = 70;
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.42;
    const len = 0.45 + rng() * 0.35;
    const dir = new THREE.Vector3(Math.cos(a) * rr * 1.1, 1, Math.sin(a) * rr * 1.1).normalize();
    const g = new THREE.ConeGeometry(0.045, len, 4, 2, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(Math.cos(a) * rr, 0.33, Math.sin(a) * rr);
    parts.push(colorize(g, (x, y, z, c) => c.copy(lin(0.86, 0.62, 0.42)).lerp(lin(0.98, 0.86, 0.7), Math.min(1, (y - 0.33) / len))));
  }
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }));
}

function kelp(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const blades = 5 + Math.floor(rng() * 4);
  for (let b = 0; b < blades; b++) {
    const h = 3 + rng() * 5;
    const segs = 14;
    const a = rng() * Math.PI * 2;
    const ox = Math.cos(a) * 0.3 * rng(), oz = Math.sin(a) * 0.3 * rng();
    const pos = [], idx = [];
    const rot = rng() * Math.PI;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = 0.16 * Math.sin(Math.PI * Math.min(1, 0.15 + t)) + 0.04;
      const wave = Math.sin(t * 12 + b) * 0.05;
      const cx = ox + Math.sin(t * 3 + b) * 0.25, cz = oz + Math.cos(t * 2.4 + b) * 0.2;
      const dx = Math.cos(rot) * (w + wave), dz = Math.sin(rot) * (w + wave);
      pos.push(cx - dx, t * h, cz - dz, cx + dx, t * h, cz + dz);
      if (s < segs) { const k = s * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(colorize(g, (x, y, z, c) => c.copy(lin(0.42, 0.48, 0.08)).lerp(lin(0.65, 0.68, 0.18), y / h)));
  }
  return mergeGeometries(parts);
}

function fan(seed, col) {
  // a flat fractal fan of thin branches, built as narrow ribbons in the xy plane
  const rng = mulberry32(seed);
  const parts = [];
  const branch = (x, y, ang, len, w, depth) => {
    const x2 = x + Math.sin(ang) * len, y2 = y + Math.cos(ang) * len;
    const nx = Math.cos(ang) * w, ny = -Math.sin(ang) * w;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x - nx, y - ny, 0, x + nx, y + ny, 0, x2 + nx * 0.7, y2 + ny * 0.7, 0, x2 - nx * 0.7, y2 - ny * 0.7, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    parts.push(colorize(g, (px, py, pz, c) => c.copy(col).multiplyScalar(0.8 + 0.25 * depth / 5)));
    if (depth >= 5) return;
    const k = 2;
    for (let i = 0; i < k; i++) branch(x2, y2, ang + (i === 0 ? -1 : 1) * (0.25 + rng() * 0.3), len * (0.78 + rng() * 0.12), w * 0.75, depth + 1);
  };
  branch(0, 0, 0, 0.35, 0.05, 0);
  return mergeGeometries(parts);
}

function seagrass(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  for (let b = 0; b < 9; b++) {
    const h = 0.4 + rng() * 0.5, a = rng() * Math.PI * 2, rr = rng() * 0.25;
    const w = 0.035;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const lean = rng() * 0.25;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x - w, 0, z, x + w, 0, z, x + lean, h, z + lean * 0.5], 3));
    g.setIndex([0, 1, 2]);
    g.computeVertexNormals();
    parts.push(colorize(g, (px, py, pz, c) => c.copy(lin(0.25, 0.45, 0.12)).lerp(lin(0.5, 0.62, 0.2), py / h)));
  }
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------- placement
// Broad limestone gardens separated by sand channels; habitat data stays intact.
export function reefGardenMask(x, z) {
  const islands = [[-35,14,11,16],[-20,35,13,10],[8,28,10,9],[31,14,10,12],
    [40,39,12,10],[10,46,10,7],[43,-18,8,14],[-39,-25,6,13]];
  let weight = 0;
  for (const [cx,cz,rx,rz] of islands) {
    const r = Math.hypot((x-cx)/rx,(z-cz)/rz);
    weight = Math.max(weight,1-THREE.MathUtils.smoothstep(r,.48,1.25));
  }
  return weight;
}

export function buildReef(hf, { quality = 'high', releasePolish = false } = {}) {
  const keep = quality === 'high' ? 1 : 0.6;
  const group = new THREE.Group();
  group.name = 'reef';
  const rng = mulberry32(31337);
  const N = new Simplex(808);
  const pal = {
    stag: [[lin(0.62, 0.42, 0.3), lin(0.85, 0.7, 0.55)], [lin(0.7, 0.28, 0.5), lin(0.95, 0.6, 0.85)], [lin(0.45, 0.25, 0.6), lin(0.6, 0.75, 0.95)], [lin(0.68, 0.5, 0.2), lin(0.95, 0.85, 0.4)]],
    brain: [[lin(0.55, 0.55, 0.3), lin(0.3, 0.32, 0.15)], [lin(0.82, 0.58, 0.3), lin(0.5, 0.3, 0.15)], [lin(0.5, 0.62, 0.45), lin(0.25, 0.35, 0.22)]],
    table: [lin(0.45, 0.52, 0.35), lin(0.35, 0.55, 0.55), lin(0.6, 0.48, 0.3)],
    sponge: [lin(0.55, 0.2, 0.65), lin(0.95, 0.5, 0.12), lin(0.95, 0.82, 0.2), lin(0.8, 0.25, 0.3)],
    fan: [lin(0.65, 0.18, 0.55), lin(0.92, 0.35, 0.2), lin(0.95, 0.78, 0.2)],
  };
  if (releasePolish) {
    // Silted olive, limestone and muted terracotta; mauve is an accent.
    pal.stag = [[lin(.46,.43,.34),lin(.67,.62,.49)],[lin(.47,.34,.39),lin(.65,.49,.52)],[lin(.36,.42,.40),lin(.51,.60,.55)],[lin(.46,.43,.30),lin(.65,.59,.42)]];
    pal.brain = [[lin(.46,.48,.34),lin(.30,.33,.23)],[lin(.56,.43,.31),lin(.36,.29,.22)],[lin(.40,.49,.41),lin(.26,.34,.28)]];
    pal.table = [lin(.42,.47,.35),lin(.34,.48,.47),lin(.51,.44,.34)];
    pal.sponge = [lin(.46,.35,.43),lin(.58,.43,.30),lin(.58,.53,.35),lin(.51,.34,.32)];
    pal.fan = [lin(.49,.32,.42),lin(.59,.39,.30),lin(.58,.51,.32)];
  }
  const geos = {
    stag: pal.stag.map((c, i) => staghorn(100 + i, c[0], c[1])),
    brain: pal.brain.map((c, i) => brain(200 + i, c[0], c[1])),
    table: pal.table.map((c, i) => table(300 + i, c)),
    sponge: pal.sponge.map((c, i) => sponge(400 + i, c)),
    fan: pal.fan.map((c, i) => fan(500 + i, c)),
    anemone: [anemone(600)],
    kelp: [kelp(700), kelp(701), kelp(702)],
    grass: [seagrass(800), seagrass(801)],
    rock: [0, 1, 2].map((i) => colorize(rockGeometry(900 + i, { detail: 2, squash: 0.7 }), (x, y, z, c) => c.copy(lin(0.32, 0.3, 0.27)).multiplyScalar(0.8 + 0.3 * Math.abs(Math.sin(x * 5 + z * 3))))),
  };
  const lists = {};
  for (const k of Object.keys(geos)) lists[k] = geos[k].map(() => []);
  const put = (type, x, z, s, extra = {}) => {
    const y = hf.heightAt(x, z);
    const arr = lists[type];
    arr[Math.floor(rng() * arr.length)].push({ x, y: y - 0.08 * s, z, s, rot: rng() * Math.PI * 2, ...extra });
  };
  const anemones = [];
  const stable = (x,z,salt=0) => {
    const v = Math.sin(x*127.1+z*311.7+salt*74.7)*43758.5453;
    return v-Math.floor(v);
  };
  const nrm = [0, 1, 0];
  // reef density: a blotchy field, rich along the front of the island and next to the front glass
  const density = (x, z, h) => {
    if (h > -1.3) return 0;
    const n = N.noise2(x * 0.09, z * 0.09) * 0.5 + 0.5;
    const nearGlass = Math.max(0, Math.max(x, z) - (HALF - 12)) / 12;
    const slope = 1 - Math.min(1, Math.abs(h + 7) / 9);
    return Math.min(1, (n * 0.8 + 0.2) * (0.5 + slope * 0.6 + nearGlass * 1.3));
  };
  const SP = 1.55;
  for (let z = -HALF + 1; z < HALF - 1; z += SP) {
    for (let x = -HALF + 1; x < HALF - 1; x += SP) {
      const px = x + rng() * SP, pz = z + rng() * SP;
      const h = hf.heightAt(px, pz);
      if (h > -1.2) continue;
      // keep the river mouth sandy
      if (Math.abs(eOf(px, pz)) < 6 && dOf(px, pz) < 32 && dOf(px, pz) > 14) continue;
      hf.normalAt(px, pz, nrm);
      if (nrm[1] < 0.6) continue;
      const dens = density(px, pz, h) * (releasePolish ? 1 : keep);
      const r = rng();
      if (r > dens) {
        if (rng() < 0.05) put('grass', px, pz, 0.8 + rng() * 0.6);
        continue;
      }
      const t = rng();
      if (t < 0.3) put('stag', px, pz, 1.1 + rng() * 1.1);
      else if (t < 0.48) put('brain', px, pz, 0.7 + rng() * 0.9);
      else if (t < 0.57) put('table', px, pz, 1.0 + rng() * 0.9);
      else if (t < 0.7) put('sponge', px, pz, 0.9 + rng() * 0.7);
      else if (t < 0.82) put('fan', px, pz, 1.6 + rng() * 1.6, { fan: true });
      else if (t < 0.9) put('rock', px, pz, 0.7 + rng() * 1.2);
      else if (t < 0.95 && h < -5) put('kelp', px, pz, 0.8 + rng() * 0.5);
      else put('grass', px, pz, 0.8 + rng() * 0.6);
    }
  }
  // anemones in places the camera sees: just behind the front glass and on the shelf in front of the beach
  const spots = [[44, 30], [38, 44], [46, 12], [20, 46], [30, 38], [16, 30], [28, 18], [8, 40]];
  for (const [x, z] of spots) {
    const h = hf.heightAt(x, z);
    if (h > -1.5) continue;
    lists.anemone[0].push({ x, y: h - 0.05, z, s: 1.1 + rng() * 0.3, rot: rng() * 6.283 });
    anemones.push(new THREE.Vector3(x, h + 0.6, z));
  }

  if (releasePolish) {
    for (const [type,variants] of Object.entries(lists)) {
      if (type === 'anemone') continue; // Preserve all actual SeaLife homes.
      variants.forEach((list,variant) => {
        lists[type][variant] = list.filter(p => {
          const garden = reefGardenMask(p.x,p.z);
          // Low rock/grass link gardens; tall silhouettes leave sand corridors.
          const retain = type === 'rock' ? .68+.32*garden :
            type === 'grass' ? .30+.70*garden : type === 'kelp' ? garden*.70 : garden;
          return stable(p.x,p.z,1) < retain && (quality === 'high' || stable(p.x,p.z,2) < .65);
        });
      });
    }
  }
  const mats = {
    stag: reefMaterial({ rough: 0.8 }),
    brain: reefMaterial({ rough: 0.85 }),
    table: reefMaterial({ rough: 0.8 }),
    sponge: reefMaterial({ rough: 0.8, side: THREE.DoubleSide }),
    fan: reefMaterial({ rough: 0.8, side: THREE.DoubleSide, current: { amp: 0.12, heightScale: 3, speed: 0.8, key: 'fan' } }),
    anemone: reefMaterial({ rough: 0.6, current: { amp: 0.16, heightScale: 1.1, speed: 1.3, key: 'anem' } }),
    kelp: reefMaterial({ rough: 0.7, side: THREE.DoubleSide, current: { amp: 0.9, heightScale: 8, speed: 0.6, key: 'kelp' } }),
    grass: reefMaterial({ rough: 0.8, side: THREE.DoubleSide, current: { amp: 0.1, heightScale: 0.9, speed: 1.1, key: 'grass' } }),
    rock: reefMaterial({ rough: 0.9 }),
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  let count = 0, tris = 0;
  const byType = {};
  for (const [type, variants] of Object.entries(geos)) {
    variants.forEach((g, i) => {
      const list = lists[type][i];
      if (!list.length) return;
      const m = new THREE.InstancedMesh(g, mats[type], list.length);
      list.forEach((t, k) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
        sc.set(t.s, t.s, t.s);
        pos.set(t.x, t.y, t.z);
        m4.compose(pos, q, sc);
        m.setMatrixAt(k, m4);
      });
      m.name = `reef-${type}-${i}`;
      byType[type] = (byType[type] || 0) + list.length;
      m.castShadow = type === 'table' || type === 'rock' || type === 'brain' || type === 'kelp';
      m.receiveShadow = true;
      m.computeBoundingSphere();
      group.add(m);
      count += list.length;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * list.length;
    });
  }
  group.userData = { stats: { count, tris: Math.round(tris), byType }, anemones };
  return group;
}
