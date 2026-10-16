// Boulders and stones: noise-displaced icosahedra with vertex-painted moss, placed on the mountain, river banks and shores.
import * as THREE from 'three';
import { Simplex, mulberry32 } from '../core/noise.js';
import { makeSampler } from './scatter.js';
import { patchUnderwater } from '../render/shared.js';

export function rockGeometry(seed, { detail = 2, squash = 0.65, rough = 0.32 } = {}) {
  const N = new Simplex(seed);
  const rng = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const sx = 0.8 + rng() * 0.5, sz = 0.8 + rng() * 0.5;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = N.noise3(v.x * 1.3, v.y * 1.3, v.z * 1.3) * rough + N.noise3(v.x * 3.1, v.y * 3.1, v.z * 3.1) * rough * 0.35;
    v.multiplyScalar(1 + n);
    v.x *= sx; v.z *= sz; v.y *= squash;
    if (v.y < -0.15) v.y = -0.15 + (v.y + 0.15) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // colour: weathered grey-brown, moss on upward faces
  const nrm = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const up = nrm.getY(i);
    const k = 0.75 + 0.35 * (N.noise3(v.x * 4, v.y * 4, v.z * 4) * 0.5 + 0.5);
    let r = 0.13 * k, gg = 0.12 * k, b = 0.105 * k;
    const moss = Math.max(0, Math.min(1, (up - 0.55) * 3)) * (0.6 + 0.4 * N.noise3(v.x * 2, 9, v.z * 2));
    r = r * (1 - moss) + 0.05 * moss; gg = gg * (1 - moss) + 0.085 * moss; b = b * (1 - moss) + 0.025 * moss;
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildRocks(hf, hash) {
  const group = new THREE.Group();
  group.name = 'rocks';
  const S = makeSampler(hf, 6060);
  const R = S.rng;
  const geos = [rockGeometry(1), rockGeometry(2, { squash: 0.8 }), rockGeometry(3, { squash: 0.5 }), rockGeometry(4, { rough: 0.45 })];
  const lists = geos.map(() => []);
  const add = (x, y, z, s, sink = 0.3) => {
    lists[Math.floor(R() * geos.length)].push({ x, y: y - s * sink, z, s, rot: R() * Math.PI * 2, tilt: (R() - 0.5) * 0.5 });
  };
  S.grid(1.7, (x, z) => {
    const p = S.at(x, z);
    if (p.h < -0.4) return;
    let prob = 0, size = 0.6;
    if (p.h > 13) { prob = 0.06 + p.slope * 0.12; size = 0.45 + R() * 0.9; }
    if (p.river < 1.6 && p.river > -0.6) { prob = Math.max(prob, 0.42); size = 0.35 + R() * 0.8; }
    if (p.coast > -2.2 && p.coast < 0.4) { prob = Math.max(prob, 0.05 + 0.1 * (p.forest + p.jungle)); size = 0.4 + R() * 1.1; }
    if (p.h > 1.5 && p.h < 13) prob = Math.max(prob, 0.02 + p.forest * 0.04 + p.glade * 0.03);
    if (R() > prob) return;
    if (!hash.free(x, z, size * 0.7)) return;
    hash.add(x, z, size * 0.7);
    add(x, p.h, z, size);
  });

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (shader) => patchUnderwater(shader);
  mat.customProgramCacheKey = () => 'rocks-uw';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  let count = 0;
  geos.forEach((g, i) => {
    const list = lists[i];
    if (!list.length) return;
    const m = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((t, k) => {
      e.set(t.tilt * 0.3, t.rot, t.tilt * 0.2);
      q.setFromEuler(e);
      sc.set(t.s, t.s, t.s);
      pos.set(t.x, t.y, t.z);
      m4.compose(pos, q, sc);
      m.setMatrixAt(k, m4);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    group.add(m);
    count += list.length;
  });
  group.userData.stats = { count };
  return group;
}
