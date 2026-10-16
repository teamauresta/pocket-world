// A tiny sculpting kit: creatures are described as smooth unions of SDF primitives, then polygonised with
// naive surface nets. Each primitive can carry a part id, used later for painting and animation.
import * as THREE from 'three';

const sq = (x) => x * x;
const dot3 = (ax, ay, az, bx, by, bz) => ax * bx + ay * by + az * bz;

export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// --- primitives -------------------------------------------------------------------------------------------
export function ellipsoid(c, r, opt = {}) {
  return { type: 'ell', c, r, ...opt };
}
// round cone between a (radius ra) and b (radius rb); a capsule when ra == rb
export function cone(a, b, ra, rb = ra, opt = {}) {
  return { type: 'cone', a, b, ra, rb, ...opt };
}
// thin fin: a rounded triangle in a plane, given three corners and a thickness
export function fin(p0, p1, p2, thick, opt = {}) {
  return { type: 'tri', p0, p1, p2, thick, ...opt };
}

function prepare(p) {
  if (p.type === 'cone') {
    const [ax, ay, az] = p.a, [bx, by, bz] = p.b;
    p.bax = bx - ax; p.bay = by - ay; p.baz = bz - az;
    p.l2 = dot3(p.bax, p.bay, p.baz, p.bax, p.bay, p.baz);
    p.rr = p.ra - p.rb;
    p.a2 = p.l2 - p.rr * p.rr;
    p.il2 = 1 / p.l2;
  } else if (p.type === 'tri') {
    const a = new THREE.Vector3(...p.p0), b = new THREE.Vector3(...p.p1), c = new THREE.Vector3(...p.p2);
    p.A = a; p.B = b; p.C = c;
    p.ba = b.clone().sub(a); p.cb = c.clone().sub(b); p.ac = a.clone().sub(c);
    p.nor = p.ba.clone().cross(p.ac);
  }
  // bounds for culling
  if (p.type === 'ell') {
    p.bmin = [p.c[0] - p.r[0], p.c[1] - p.r[1], p.c[2] - p.r[2]];
    p.bmax = [p.c[0] + p.r[0], p.c[1] + p.r[1], p.c[2] + p.r[2]];
  } else if (p.type === 'cone') {
    const r = Math.max(p.ra, p.rb);
    p.bmin = [Math.min(p.a[0], p.b[0]) - r, Math.min(p.a[1], p.b[1]) - r, Math.min(p.a[2], p.b[2]) - r];
    p.bmax = [Math.max(p.a[0], p.b[0]) + r, Math.max(p.a[1], p.b[1]) + r, Math.max(p.a[2], p.b[2]) + r];
  } else {
    const xs = [p.p0[0], p.p1[0], p.p2[0]], ys = [p.p0[1], p.p1[1], p.p2[1]], zs = [p.p0[2], p.p1[2], p.p2[2]];
    p.bmin = [Math.min(...xs) - p.thick, Math.min(...ys) - p.thick, Math.min(...zs) - p.thick];
    p.bmax = [Math.max(...xs) + p.thick, Math.max(...ys) + p.thick, Math.max(...zs) + p.thick];
  }
  return p;
}

const _v = new THREE.Vector3();
export function primDist(p, x, y, z) { return dist(p, x, y, z); }
function dist(p, x, y, z) {
  if (p.type === 'ell') {
    const qx = (x - p.c[0]) / p.r[0], qy = (y - p.c[1]) / p.r[1], qz = (z - p.c[2]) / p.r[2];
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    const k1 = Math.sqrt(sq(qx / p.r[0]) + sq(qy / p.r[1]) + sq(qz / p.r[2]));
    return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(...p.r);
  }
  if (p.type === 'cone') {
    // Inigo Quilez's round cone, arbitrary orientation
    const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2];
    const y_ = dot3(pax, pay, paz, p.bax, p.bay, p.baz);
    const z_ = y_ - p.l2;
    const xx = sq(pax * p.l2 - p.bax * y_) + sq(pay * p.l2 - p.bay * y_) + sq(paz * p.l2 - p.baz * y_);
    const y2 = y_ * y_ * p.l2, z2 = z_ * z_ * p.l2;
    const k = Math.sign(p.rr) * p.rr * p.rr * xx;
    if (Math.sign(z_) * p.a2 * z2 > k) return Math.sqrt(xx + z2) * p.il2 - p.rb;
    if (Math.sign(y_) * p.a2 * y2 < k) return Math.sqrt(xx + y2) * p.il2 - p.ra;
    return (Math.sqrt(xx * p.a2 * p.il2) + y_ * p.rr) * p.il2 - p.ra;
  }
  // triangle with thickness
  _v.set(x, y, z);
  const pa = _v.clone().sub(p.A), pb = _v.clone().sub(p.B), pc = _v.clone().sub(p.C);
  const s1 = Math.sign(p.ba.clone().cross(p.nor).dot(pa)) + Math.sign(p.cb.clone().cross(p.nor).dot(pb)) + Math.sign(p.ac.clone().cross(p.nor).dot(pc));
  let d2;
  if (s1 < 2) {
    const e = (ba, pa_) => {
      const t = Math.min(1, Math.max(0, ba.dot(pa_) / ba.lengthSq()));
      return ba.clone().multiplyScalar(t).sub(pa_).lengthSq();
    };
    d2 = Math.min(e(p.ba, pa), e(p.cb, pb), e(p.ac, pc));
  } else {
    d2 = sq(p.nor.dot(pa)) / p.nor.lengthSq();
  }
  return Math.sqrt(d2) - p.thick;
}

// --- the sculpt: union of primitives with per-primitive blend ---------------------------------------------
export class Sculpt {
  constructor(prims, { blend = 0.1 } = {}) {
    this.prims = prims.map(prepare);
    this.blend = blend;
    const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
    for (const p of this.prims) for (let i = 0; i < 3; i++) { bmin[i] = Math.min(bmin[i], p.bmin[i]); bmax[i] = Math.max(bmax[i], p.bmax[i]); }
    this.bmin = bmin; this.bmax = bmax;
  }
  // returns signed distance; also writes the dominant primitive index into this.lastPart
  eval(x, y, z) {
    let d = 1e9, best = 1e9, bi = -1;
    for (let i = 0; i < this.prims.length; i++) {
      const p = this.prims[i];
      const k = p.k ?? this.blend;
      if (x < p.bmin[0] - k - 0.3 || x > p.bmax[0] + k + 0.3 || y < p.bmin[1] - k - 0.3 || y > p.bmax[1] + k + 0.3 || z < p.bmin[2] - k - 0.3 || z > p.bmax[2] + k + 0.3) {
        continue;
      }
      const di = dist(p, x, y, z);
      if (p.subtract) { d = Math.max(d, -di); continue; }
      d = smin(d, di, k);
      if (di < best) { best = di; bi = i; }
    }
    this.lastPart = bi;
    return d;
  }
}

// --- naive surface nets ------------------------------------------------------------------------------------
export function polygonize(sculpt, cell, { paint, margin = 2 } = {}) {
  const bmin = sculpt.bmin.map((v) => v - cell * margin - sculpt.blend);
  const bmax = sculpt.bmax.map((v) => v + cell * margin + sculpt.blend);
  const nx = Math.ceil((bmax[0] - bmin[0]) / cell) + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / cell) + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / cell) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    vals[id(i, j, k)] = sculpt.eval(bmin[0] + i * cell, bmin[1] + j * cell, bmin[2] + k * cell);
  }
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = vals[id(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      cnt++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(bmin[0] + (i + sx / cnt) * cell, bmin[1] + (j + sy / cnt) * cell, bmin[2] + (k + sz / cnt) * cell);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = vals[id(i, j, k)];
    const in0 = v0 < 0;
    // edge along +x
    if (i < nx - 1 && in0 !== (vals[id(i + 1, j, k)] < 0)) {
      quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)], !in0);
    }
    if (j < ny - 1 && in0 !== (vals[id(i, j + 1, k)] < 0)) {
      quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i - 1, j, k)], cellVert[cid(i, j, k)], cellVert[cid(i, j, k - 1)], !in0);
    }
    if (k < nz - 1 && in0 !== (vals[id(i, j, k + 1)] < 0)) {
      quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], !in0);
    }
  }
  // smooth normals from the field gradient, and per-vertex part ids
  const n = pos.length / 3;
  const nor = new Float32Array(n * 3);
  const part = new Float32Array(n);
  const e = cell * 0.5;
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const gx = sculpt.eval(x + e, y, z) - sculpt.eval(x - e, y, z);
    const gy = sculpt.eval(x, y + e, z) - sculpt.eval(x, y - e, z);
    const gz = sculpt.eval(x, y, z + e) - sculpt.eval(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nor[v * 3] = gx / l; nor[v * 3 + 1] = gy / l; nor[v * 3 + 2] = gz / l;
    sculpt.eval(x, y, z);
    part[v] = sculpt.lastPart;
  }
  // make every triangle face along the field gradient
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx_ = nor[a] + nor[b] + nor[c], ny_ = nor[a + 1] + nor[b + 1] + nor[c + 1], nz_ = nor[a + 2] + nor[b + 2] + nor[c + 2];
    if (fx * nx_ + fy * ny_ + fz * nz_ < 0) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  geo.setIndex(idx);
  if (paint) {
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let v = 0; v < n; v++) {
      const pr = sculpt.prims[part[v]];
      paint(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2], pr, c);
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
