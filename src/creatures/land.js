// Land animals sculpted from SDF primitives on a shared quadruped skeleton: tiger, deer (stag, doe, fawn),
// brown bear and giant panda. +x is forward, +y up, feet on y = 0. Primitives name the bone they move with.
import * as THREE from 'three';
import { Sculpt, polygonize, ellipsoid, cone, primDist } from './sculpt.js';
import { skinGeometry } from './rig.js';
import { Simplex } from '../core/noise.js';
import { ANIMAL_PARTS } from './detail-contract.js';
import { taubinSmooth, quadricSimplify, splitSurfaceFans, orientSurfaceSheets, closeSmallSurfaceLoops } from './animal-mesh-detail.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lin = (r, g, b) => [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const N = new Simplex(77);

// --- joint layout shared by all quadrupeds ---------------------------------------------------------------
function quadJoints(j) {
  const out = [
    { name: 'pelvis', pos: j.pelvis, parent: null },
    { name: 'spine', pos: j.spine, parent: 'pelvis' },
    { name: 'chest', pos: j.chest, parent: 'spine' },
    { name: 'neck', pos: j.neck, parent: 'chest' },
    { name: 'head', pos: j.head, parent: 'neck' },
  ];
  j.tail.forEach((p, i) => out.push({ name: `tail${i + 1}`, pos: p, parent: i === 0 ? 'pelvis' : `tail${i}` }));
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const m = (p) => [p[0], p[1], p[2] * side];
    out.push({ name: `shoulder${s}`, pos: m(j.shoulder), parent: 'chest' });
    out.push({ name: `elbow${s}`, pos: m(j.elbow), parent: `shoulder${s}` });
    out.push({ name: `wrist${s}`, pos: m(j.wrist), parent: `elbow${s}` });
    out.push({ name: `hip${s}`, pos: m(j.hip), parent: 'pelvis' });
    out.push({ name: `knee${s}`, pos: m(j.knee), parent: `hip${s}` });
    out.push({ name: `hock${s}`, pos: m(j.hock), parent: `knee${s}` });
  }
  return out;
}

// limb primitives following the joints; r: radii [upper start, upper end, lower start, lower end, paw]
function legs(j, o) {
  const P = [];
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const m = (p, dz = 0) => [p[0], p[1], (p[2] + dz) * side];
    const fr = o.front, hr = o.hind;
    P.push(cone(m(j.shoulder, -0.03), m(j.elbow), fr[0], fr[1], { bone: `shoulder${s}`, part: 'legF', k: o.kLeg }));
    P.push(cone(m(j.elbow), m(j.wrist), fr[2], fr[3], { bone: `elbow${s}`, part: 'legF', k: 0.05 }));
    P.push(ellipsoid(m([j.wrist[0] + o.pawF[0], o.pawF[1], j.wrist[2]]), [o.pawF[2], o.pawF[3], o.pawF[4]], { bone: `wrist${s}`, part: 'paw', k: 0.05 }));
    P.push(cone(m(j.hip, -0.03), m(j.knee), hr[0], hr[1], { bone: `hip${s}`, part: 'legH', k: o.kLeg }));
    if (o.thigh) P.push(ellipsoid(m(o.thigh.c), o.thigh.r, { bone: `hip${s}`, part: 'legH', k: o.kLeg }));
    P.push(cone(m(j.knee), m(j.hock), hr[2], hr[3], { bone: `knee${s}`, part: 'legH', k: 0.05 }));
    P.push(cone(m(j.hock), m([j.hock[0] + o.pawH[0], o.pawH[1] + 0.02, j.hock[2]]), hr[3], hr[4], { bone: `hock${s}`, part: 'legH', k: 0.04 }));
    P.push(ellipsoid(m([j.hock[0] + o.pawH[0], o.pawH[1], j.hock[2]]), [o.pawH[2], o.pawH[3], o.pawH[4]], { bone: `hock${s}`, part: 'paw', k: 0.05 }));
  }
  return P;
}

function tail(j, radii, part = 'tail') {
  const P = [];
  for (let i = 0; i < j.tail.length; i++) {
    const a = j.tail[i], b = j.tail[i + 1] || j.tailTip;
    P.push(cone(a, b, radii[i], radii[i + 1], { bone: `tail${i + 1}`, part, k: 0.05 }));
  }
  return P;
}

// =========================================================================================================
// TIGER
function tiger() {
  const j = {
    pelvis: [-0.68, 1.0, 0], spine: [-0.08, 1.04, 0], chest: [0.48, 1.02, 0], neck: [0.82, 1.07, 0], head: [1.18, 1.16, 0],
    tail: [[-1.08, 0.98, 0], [-1.48, 0.78, 0], [-1.88, 0.6, 0], [-2.26, 0.53, 0]], tailTip: [-2.6, 0.62, 0],
    shoulder: [0.62, 0.86, 0.26], elbow: [0.52, 0.47, 0.29], wrist: [0.58, 0.13, 0.29],
    hip: [-0.74, 0.86, 0.25], knee: [-0.52, 0.5, 0.29], hock: [-0.84, 0.21, 0.29],
  };
  const P = [
    ellipsoid([-0.6, 0.98, 0], [0.48, 0.36, 0.32], { bone: 'pelvis', part: 'body', k: 0.18 }),
    ellipsoid([-0.05, 0.99, 0], [0.5, 0.36, 0.33], { bone: 'spine', part: 'body', k: 0.18 }),
    ellipsoid([0.44, 0.98, 0], [0.46, 0.43, 0.36], { bone: 'chest', part: 'body', k: 0.18 }),
    ellipsoid([-0.1, 0.8, 0], [0.48, 0.2, 0.27], { bone: 'spine', part: 'body', k: 0.15 }),
    cone([0.66, 1.03, 0], [1.02, 1.13, 0], 0.32, 0.28, { bone: 'neck', part: 'body', k: 0.12 }),
    ellipsoid([1.26, 1.17, 0], [0.33, 0.3, 0.31], { bone: 'head', part: 'head', k: 0.1 }),
    ellipsoid([1.55, 1.07, 0], [0.21, 0.16, 0.19], { bone: 'head', part: 'muzzle', k: 0.07 }),
    ellipsoid([1.22, 1.05, 0.21], [0.2, 0.18, 0.13], { bone: 'head', part: 'cheek', k: 0.07 }),
    ellipsoid([1.22, 1.05, -0.21], [0.2, 0.18, 0.13], { bone: 'head', part: 'cheek', k: 0.07 }),
    ellipsoid([1.74, 1.11, 0], [0.055, 0.05, 0.075], { bone: 'head', part: 'nose', k: 0.03 }),
    ellipsoid([1.12, 1.44, 0.22], [0.06, 0.1, 0.09], { bone: 'head', part: 'ear', k: 0.04 }),
    ellipsoid([1.12, 1.44, -0.22], [0.06, 0.1, 0.09], { bone: 'head', part: 'ear', k: 0.04 }),
    ellipsoid([1.525, 1.24, 0.15], [0.038, 0.038, 0.032], { bone: 'head', part: 'eye', k: 0.01 }),
    ellipsoid([1.525, 1.24, -0.15], [0.038, 0.038, 0.032], { bone: 'head', part: 'eye', k: 0.01 }),
    ...legs(j, { front: [0.2, 0.14, 0.13, 0.095, 0], hind: [0.22, 0.14, 0.12, 0.08, 0.08], pawF: [0.08, 0.075, 0.15, 0.085, 0.12], pawH: [0.1, 0.07, 0.14, 0.075, 0.11], kLeg: 0.12, thigh: { c: [-0.68, 0.72, 0.22], r: [0.26, 0.31, 0.15] } }),
    ...tail(j, [0.085, 0.075, 0.07, 0.065, 0.06]),
  ];
  const orange = lin(0.93, 0.52, 0.16), white = lin(0.95, 0.93, 0.88), black = lin(0.07, 0.06, 0.05), pink = lin(0.85, 0.55, 0.5);
  const paint = (x, y, z, nx, ny, nz, pr) => {
    const part = pr ? pr.part : 'body';
    if (part === 'eye') return lin(0.75, 0.6, 0.15);
    if (part === 'nose') return pink;
    const n = N.noise3(x * 6, y * 6, z * 6);
    if (part === 'ear') return nx < -0.2 ? black : white;
    if (part === 'tail') {
      const ring = Math.abs(((x * 4.2 + n * 0.3) % 1 + 1) % 1 - 0.5) < 0.16;
      return x < -2.35 || ring ? black : orange;
    }
    if (part === 'muzzle' || part === 'cheek') return (ny < 0.3 || part === 'cheek') ? white : orange;
    if (part === 'head') {
      if (ny < -0.2) return white;
      // white brows over the eyes, forehead stripes
      if (Math.hypot((x - 1.45) / 0.07, (y - 1.31) / 0.045) < 1 && Math.abs(Math.abs(z) - 0.15) < 0.07) return white;
      const fs = Math.abs(((z * 7 + n * 0.3) % 1 + 1) % 1 - 0.5) < 0.1 && y > 1.3 && x < 1.42;
      return fs ? black : orange;
    }
    const belly = ss(-0.15, -0.55, ny) * ss(1.0, 0.75, y);
    const inner = (part === 'legF' || part === 'legH') ? ss(0.0, -0.6, nz * Math.sign(z)) : 0;
    let col = mix3(orange, white, Math.max(belly, inner * 0.8));
    // stripes: vertical wedges on the body, horizontal bands on the legs
    let stripe = false;
    if (part === 'body') {
      const u = x * 4.1 + 0.9 * Math.sin(y * 3.2 + Math.abs(z) * 2.0) + n * 0.35;
      const w = 0.17 * ss(0.6, 1.3, y) + 0.04;
      stripe = Math.abs(((u % 1) + 1) % 1 - 0.5) < w && belly < 0.5 && x < 0.85;
    } else if (part === 'legF' || part === 'legH') {
      const v = y * 6.0 + n * 0.4;
      stripe = Math.abs(((v % 1) + 1) % 1 - 0.5) < 0.11 && inner < 0.5 && y > 0.25;
    }
    if (stripe) col = black;
    return col;
  };
  return { j, P, paint, cell: 0.042, tau: 0.07, blend: 0.12 };
}

// =========================================================================================================
// DEER (sika-style with spots). variant: 'stag' | 'doe' | 'fawn'
function deer(variant) {
  const j = {
    pelvis: [-0.6, 1.12, 0], spine: [-0.05, 1.15, 0], chest: [0.5, 1.15, 0], neck: [0.78, 1.25, 0], head: [1.1, 1.85, 0],
    tail: [[-0.95, 1.18, 0], [-1.08, 1.08, 0]], tailTip: [-1.14, 0.95, 0],
    shoulder: [0.58, 0.98, 0.19], elbow: [0.52, 0.62, 0.2], wrist: [0.55, 0.13, 0.2],
    hip: [-0.66, 1.0, 0.18], knee: [-0.48, 0.66, 0.2], hock: [-0.78, 0.4, 0.2],
  };
  const P = [
    ellipsoid([-0.5, 1.12, 0], [0.42, 0.28, 0.24], { bone: 'pelvis', part: 'body', k: 0.15 }),
    ellipsoid([0.0, 1.12, 0], [0.5, 0.28, 0.25], { bone: 'spine', part: 'body', k: 0.15 }),
    ellipsoid([0.45, 1.15, 0], [0.36, 0.31, 0.25], { bone: 'chest', part: 'body', k: 0.15 }),
    cone([0.62, 1.22, 0], [1.02, 1.72, 0], 0.17, 0.11, { bone: 'neck', part: 'neck', k: 0.12 }),
    ellipsoid([1.14, 1.86, 0], [0.17, 0.13, 0.12], { bone: 'head', part: 'head', k: 0.06 }),
    cone([1.16, 1.84, 0], [1.42, 1.72, 0], 0.11, 0.06, { bone: 'head', part: 'muzzle', k: 0.06 }),
    ellipsoid([1.43, 1.72, 0], [0.04, 0.035, 0.05], { bone: 'head', part: 'nose', k: 0.02 }),
    ellipsoid([1.215, 1.89, 0.095], [0.026, 0.029, 0.022], { bone: 'head', part: 'eye', k: 0.01 }),
    ellipsoid([1.215, 1.89, -0.095], [0.026, 0.029, 0.022], { bone: 'head', part: 'eye', k: 0.01 }),
    // big ears angled out
    ellipsoid([1.03, 2.0, 0.15], [0.05, 0.12, 0.04], { bone: 'head', part: 'ear', k: 0.03 }),
    ellipsoid([1.03, 2.0, -0.15], [0.05, 0.12, 0.04], { bone: 'head', part: 'ear', k: 0.03 }),
    ...legs(j, { front: [0.1, 0.06, 0.05, 0.04, 0], hind: [0.13, 0.07, 0.055, 0.04, 0.035], pawF: [0.02, 0.06, 0.05, 0.06, 0.045], pawH: [0.03, 0.06, 0.05, 0.06, 0.045], kLeg: 0.1, thigh: { c: [-0.62, 0.9, 0.17], r: [0.2, 0.24, 0.1] } }),
    ...tail(j, [0.07, 0.06, 0.04]),
  ];
  if (variant === 'stag') {
    // antlers: two main beams with tines
    for (const s of [1, -1]) {
      const base = [1.06, 2.0, 0.09 * s];
      const b1 = [1.0, 2.3, 0.2 * s], b2 = [0.93, 2.6, 0.26 * s], tip = [1.0, 2.82, 0.2 * s];
      P.push(cone(base, b1, 0.03, 0.025, { bone: 'head', part: 'antler', k: 0.01 }));
      P.push(cone(b1, b2, 0.025, 0.02, { bone: 'head', part: 'antler', k: 0.01 }));
      P.push(cone(b2, tip, 0.02, 0.012, { bone: 'head', part: 'antler', k: 0.01 }));
      P.push(cone([1.03, 2.12, 0.14 * s], [1.22, 2.25, 0.15 * s], 0.018, 0.01, { bone: 'head', part: 'antler', k: 0.01 }));
      P.push(cone(b2, [1.12, 2.7, 0.33 * s], 0.016, 0.009, { bone: 'head', part: 'antler', k: 0.01 }));
      P.push(cone(b1, [0.84, 2.45, 0.36 * s], 0.016, 0.009, { bone: 'head', part: 'antler', k: 0.01 }));
    }
  }
  const coat = variant === 'stag' ? lin(0.55, 0.33, 0.17) : lin(0.66, 0.4, 0.2);
  const back = lin(0.38, 0.22, 0.1), cream = lin(0.93, 0.88, 0.78), dark = lin(0.06, 0.05, 0.04);
  const spotsOn = variant !== 'stag';
  const paint = (x, y, z, nx, ny, nz, pr) => {
    const part = pr ? pr.part : 'body';
    if (part === 'eye' || part === 'nose') return dark;
    if (part === 'antler') return lin(0.62, 0.52, 0.38);
    if (part === 'ear') return nx > 0.3 ? lin(0.85, 0.78, 0.7) : coat;
    if (part === 'muzzle') return ny < 0 ? cream : mix3(coat, back, 0.3);
    if (part === 'tail') return nx < -0.5 || ny < -0.3 ? cream : dark;
    if (part === 'paw') return dark;
    const belly = ss(-0.1, -0.55, ny) * (part === 'body' ? 1 : 0);
    const rump = Math.hypot((x + 0.9) / 0.14, (y - 1.07) / 0.17) < 1 && nx < -0.3 ? 1 : 0;
    const inner = (part === 'legF' || part === 'legH') ? ss(0.0, -0.6, nz * Math.sign(z)) : 0;
    let col = mix3(coat, back, ss(0.55, 0.95, ny) * (part === 'body' ? 0.7 : 0.4));
    col = mix3(col, cream, Math.max(belly, rump, inner * 0.6));
    if (part === 'neck' && ny < -0.2) col = mix3(col, cream, 0.6);
    if (part === 'head' && ny < -0.2) col = cream;
    // white spots in loose rows along the flanks
    if (spotsOn && part === 'body' && ny > -0.1 && belly < 0.3) {
      const row = Math.round((y - 1.0) / 0.075);
      const cx = x * 9 + row * 0.5;
      const fx = ((cx % 1) + 1) % 1 - 0.5, fy = (y - 1.0) / 0.075 - row;
      if (fx * fx + fy * fy * 0.6 < 0.07 && row > 0 && row < 5) col = cream;
    }
    return col;
  };
  return { j, P, paint, cell: 0.032, tau: 0.05, blend: 0.1 };
}

// =========================================================================================================
// BROWN BEAR
function bear() {
  const j = {
    pelvis: [-0.8, 1.0, 0], spine: [-0.15, 1.1, 0], chest: [0.45, 1.12, 0], neck: [0.85, 1.12, 0], head: [1.15, 1.08, 0],
    tail: [[-1.25, 1.0, 0]], tailTip: [-1.38, 0.92, 0],
    shoulder: [0.55, 0.92, 0.3], elbow: [0.5, 0.52, 0.33], wrist: [0.55, 0.14, 0.34],
    hip: [-0.85, 0.88, 0.3], knee: [-0.68, 0.52, 0.33], hock: [-0.92, 0.2, 0.34],
  };
  const P = [
    ellipsoid([-0.7, 1.0, 0], [0.62, 0.48, 0.47], { bone: 'pelvis', part: 'body', k: 0.25 }),
    ellipsoid([-0.05, 1.05, 0], [0.62, 0.52, 0.5], { bone: 'spine', part: 'body', k: 0.25 }),
    ellipsoid([0.42, 1.12, 0], [0.48, 0.55, 0.47], { bone: 'chest', part: 'body', k: 0.22 }),
    ellipsoid([0.3, 1.45, 0], [0.4, 0.22, 0.32], { bone: 'chest', part: 'body', k: 0.2 }), // shoulder hump
    cone([0.72, 1.12, 0], [1.02, 1.08, 0], 0.36, 0.3, { bone: 'neck', part: 'body', k: 0.15 }),
    ellipsoid([1.2, 1.1, 0], [0.3, 0.27, 0.28], { bone: 'head', part: 'head', k: 0.1 }),
    ellipsoid([1.47, 1.0, 0], [0.18, 0.13, 0.14], { bone: 'head', part: 'muzzle', k: 0.08 }),
    ellipsoid([1.63, 1.03, 0], [0.05, 0.05, 0.07], { bone: 'head', part: 'nose', k: 0.03 }),
    ellipsoid([1.12, 1.36, 0.19], [0.06, 0.08, 0.07], { bone: 'head', part: 'ear', k: 0.05 }),
    ellipsoid([1.12, 1.36, -0.19], [0.06, 0.08, 0.07], { bone: 'head', part: 'ear', k: 0.05 }),
    ellipsoid([1.445, 1.16, 0.13], [0.03, 0.03, 0.025], { bone: 'head', part: 'eye', k: 0.01 }),
    ellipsoid([1.445, 1.16, -0.13], [0.03, 0.03, 0.025], { bone: 'head', part: 'eye', k: 0.01 }),
    ...legs(j, { front: [0.24, 0.18, 0.17, 0.14, 0], hind: [0.27, 0.18, 0.16, 0.13, 0.12], pawF: [0.08, 0.08, 0.18, 0.09, 0.15], pawH: [0.1, 0.07, 0.19, 0.08, 0.14], kLeg: 0.15, thigh: { c: [-0.82, 0.72, 0.28], r: [0.3, 0.34, 0.2] } }),
    ...tail(j, [0.09, 0.05]),
  ];
  const fur = lin(0.36, 0.22, 0.12), tips = lin(0.5, 0.34, 0.19), dark = lin(0.14, 0.09, 0.06);
  const paint = (x, y, z, nx, ny, nz, pr) => {
    const part = pr ? pr.part : 'body';
    if (part === 'eye' || part === 'nose') return lin(0.04, 0.03, 0.03);
    const n = N.noise3(x * 9, y * 9, z * 9) * 0.5 + 0.5;
    if (part === 'muzzle') return mix3(lin(0.55, 0.42, 0.28), fur, ss(0.2, 0.8, ny) * 0.4);
    if (part === 'paw' || ((part === 'legF' || part === 'legH') && y < 0.45)) return mix3(dark, fur, n * 0.4);
    return mix3(mix3(fur, dark, ss(0.6, 0.2, y) * 0.5), tips, n * 0.45 * ss(0.0, 0.8, ny));
  };
  return { j, P, paint, cell: 0.045, tau: 0.08, blend: 0.15 };
}

// =========================================================================================================
// GIANT PANDA
function panda() {
  const j = {
    pelvis: [-0.62, 0.82, 0], spine: [-0.1, 0.88, 0], chest: [0.38, 0.9, 0], neck: [0.7, 0.92, 0], head: [0.95, 0.95, 0],
    tail: [[-1.02, 0.86, 0]], tailTip: [-1.1, 0.8, 0],
    shoulder: [0.45, 0.72, 0.26], elbow: [0.42, 0.42, 0.28], wrist: [0.46, 0.12, 0.29],
    hip: [-0.66, 0.7, 0.26], knee: [-0.5, 0.42, 0.28], hock: [-0.7, 0.17, 0.29],
  };
  const P = [
    ellipsoid([-0.55, 0.85, 0], [0.5, 0.42, 0.42], { bone: 'pelvis', part: 'body', k: 0.22 }),
    ellipsoid([-0.05, 0.88, 0], [0.5, 0.44, 0.43], { bone: 'spine', part: 'body', k: 0.22 }),
    ellipsoid([0.36, 0.9, 0], [0.4, 0.44, 0.42], { bone: 'chest', part: 'body', k: 0.2 }),
    cone([0.58, 0.92, 0], [0.86, 0.95, 0], 0.32, 0.3, { bone: 'neck', part: 'body', k: 0.15 }),
    ellipsoid([1.02, 1.0, 0], [0.32, 0.3, 0.33], { bone: 'head', part: 'head', k: 0.12 }),
    ellipsoid([1.28, 0.93, 0], [0.14, 0.11, 0.14], { bone: 'head', part: 'muzzle', k: 0.08 }),
    ellipsoid([1.41, 0.95, 0], [0.04, 0.04, 0.06], { bone: 'head', part: 'nose', k: 0.03 }),
    ellipsoid([0.9, 1.3, 0.24], [0.07, 0.09, 0.09], { bone: 'head', part: 'ear', k: 0.05 }),
    ellipsoid([0.9, 1.3, -0.24], [0.07, 0.09, 0.09], { bone: 'head', part: 'ear', k: 0.05 }),
    ellipsoid([1.29, 1.07, 0.13], [0.026, 0.026, 0.02], { bone: 'head', part: 'eye', k: 0.01 }),
    ellipsoid([1.29, 1.07, -0.13], [0.026, 0.026, 0.02], { bone: 'head', part: 'eye', k: 0.01 }),
    ...legs(j, { front: [0.21, 0.16, 0.15, 0.13, 0], hind: [0.22, 0.15, 0.14, 0.12, 0.11], pawF: [0.06, 0.07, 0.15, 0.08, 0.13], pawH: [0.08, 0.065, 0.15, 0.07, 0.12], kLeg: 0.14, thigh: { c: [-0.64, 0.6, 0.24], r: [0.26, 0.28, 0.17] } }),
    ...tail(j, [0.07, 0.04]),
  ];
  const white = lin(0.93, 0.91, 0.85), black = lin(0.07, 0.065, 0.06);
  const paint = (x, y, z, nx, ny, nz, pr) => {
    const part = pr ? pr.part : 'body';
    if (part === 'eye') return lin(0.02, 0.02, 0.02);
    if (part === 'nose' || part === 'ear') return black;
    if (part === 'legF' || part === 'legH' || part === 'paw') return black;
    if (part === 'head' || part === 'muzzle') {
      // tear-drop eye patches tilted down toward the muzzle
      const ex = x - 1.25, ey = y - 1.04, ez = Math.abs(z) - 0.14;
      const a = 0.5;
      const u = ex * Math.cos(a) + ey * Math.sin(a), v = -ex * Math.sin(a) + ey * Math.cos(a);
      if (Math.hypot(u / 0.14, v / 0.09, ez / 0.12) < 1 && nx > 0) return black;
      return white;
    }
    // shoulder band: a black saddle over the shoulders joining the front legs
    const band = Math.abs(x - 0.35 + 0.15 * (y - 0.9)) < 0.17 && y > 0.45;
    if (band) return black;
    return white;
  };
  return { j, P, paint, cell: 0.04, tau: 0.07, blend: 0.14 };
}

const DEFS = { tiger, stag: () => deer('stag'), doe: () => deer('doe'), fawn: () => deer('fawn'), bear, panda };

// Keep the original joint positions/hierarchy. Extra anatomy is sculpted around
// those bind coordinates; actor scale remains the caller's responsibility.
function detailedDefinition(key) {
  const d=DEFS[key](), cervid=['stag','doe','fawn'].includes(key);
  const oldEyes=d.P.filter(p=>p.part==='eye');
  d.eyes=oldEyes.map(p=>({center:[...p.c],radius:p.r.map(r=>r*1.18),side:Math.sign(p.c[2])}));
  const paws=d.P.filter(p=>p.part==='paw'), ears=d.P.filter(p=>p.part==='ear');
  d.P=d.P.filter(p=>!['eye','paw','ear'].includes(p.part));
  const cuts=[];
  const add=(c,r,part='head',bone='head',k=.014)=>d.P.push(ellipsoid(c,r,{part,bone,k}));
  for(const side of [-1,1]) {
    if(key==='tiger') {
      add([.43,1.15,.30*side],[.29,.31,.12],'body','chest',.085);
      add([-.72,1.13,.27*side],[.25,.26,.11],'body','pelvis',.075);
      add([.93,1.15,.23*side],[.28,.29,.17],'neck','neck',.065);
      add([1.19,1.02,.285*side],[.19,.18,.13],'cheek','head',.035);
    } else if(cervid) {
      add([.43,1.25,.20*side],[.23,.24,.095],'body','chest',.055);
      add([-.65,1.27,.18*side],[.23,.17,.085],'body','pelvis',.055);
      if(key==='stag')add([.79,1.42,.025*side],[.20,.30,.15],'neck','neck',.04);
    }
  }
  if(key==='bear')add([.25,1.49,0],[.45,.30,.38],'body','chest',.10);
  if(key==='panda')add([-.15,.66,0],[.49,.30,.43],'body','spine',.09);
  if(key==='fawn') {
    const muzzle=d.P.find(p=>p.part==='muzzle');muzzle.b[0]-=.035;
    add([1.105,1.90,0],[.19,.15,.14],'head','head',.025);
  }
  for(const e of d.eyes) {
    const [x,y,z]=e.center;
    // One shallow, fully blended brow, not ten sub-cell beads forming a ring.
    // There is deliberately NO socket subtraction: the separate shallow glossy
    // cap seats into a continuous face, so a missed voxel cannot expose daylight.
    add([x-.032,y+e.radius[1]*.72,z-.023*e.side],
      [e.radius[0]*1.40,e.radius[1]*.38,e.radius[2]*1.05],
      'head','head',.045);
  }
  for(const ear of ears) {
    const c=[...ear.c],r=[...ear.r];
    if(cervid){c[2]*=1.18;r[1]*=key==='fawn'?1.25:1.16;r[2]*=1.38;r[0]*=1.15;}
    if(key==='panda'){r[1]*=1.17;r[2]*=1.12;}
    add(c,r,'ear','head',.018);
    if(cervid) {
      // The expanded lateral cups need a real cartilage base; otherwise their
      // thin lower tips detach after smoothing even though the cup is sealed.
      const side=Math.sign(c[2]);
      d.P.push(cone([d.j.head[0]-.035,d.j.head[1]+.025,side*.055],
        [c[0],c[1]-r[1]*.62,c[2]],.062,.048,{part:'ear',bone:'head',k:.035}));
    }
    cuts.push(ellipsoid([c[0]+r[0]*.75,c[1]+r[1]*.06,c[2]],[r[0]*.78,r[1]*.70,r[2]*.70],{subtract:true,bone:'head',part:'innerEar',k:0}));
  }
  const nose=d.P.find(p=>p.part==='nose'), muzzle=d.P.find(p=>p.part==='muzzle');
  const mc=muzzle.c||muzzle.b, mr=muzzle.r||[.09,.065,.065];
  add([mc[0]-.025,mc[1]-mr[1]*.66,0],[mr[0]*.95,mr[1]*.48,mr[2]*.83],'muzzle','head',.02);
  for(const side of [-1,1]) {
    add([mc[0]+mr[0]*.20,mc[1]-mr[1]*.31,mr[2]*.56*side],[mr[0]*.85,.017,cervid?.026:.044],'lips','head',.004);
    const nc=nose.c,nr=nose.r;
    cuts.push(ellipsoid([nc[0]+nr[0]*.72,nc[1]+nr[1]*.07,nr[2]*.55*side],[nr[0]*.52,nr[1]*.35,nr[2]*.28],{subtract:true,bone:'head',part:'nose',k:0}));
  }
  cuts.push(ellipsoid([mc[0]+mr[0]*.46,mc[1]-mr[1]*.36,0],[mr[0]*.78,.007,mr[2]*.95],{subtract:true,bone:'head',part:'lips',k:0}));
  d.support=[];
  for(const p of paws) {
    const [x,y,z]=p.c,[rx,ry,rz]=p.r,bone=p.bone,sole=y-ry;
    d.support.push({bone,center:[x,sole,z],radius:[rx,ry,rz]});
    if(cervid) {
      for(const side of [-1,1]) {
        add([x+.009,y,z+side*rz*.64],[rx*1.20,ry,rz*.43],'hoof',bone,0);
        add([x-rx*.73,y+ry*.83,z+side*rz*.58],[.022,.027,.019],'hoof',bone,.001);
      }
      cuts.push(ellipsoid([x+rx*.58,y-.01,z],[rx*.90,ry*1.2,.010],{subtract:true,bone,part:'hoof',k:0}));
    } else {
      add([x-rx*.16,y+.008,z],[rx*.79,ry*.96,rz*.93],'paw',bone,.012);
      for(let i=0;i<4;i++) {
        const dz=(i-1.5)*rz*.48,edge=Math.abs(i-1.5)/1.5;
        const tx=x+rx*(.57-.10*edge),tz=z+dz;
        add([tx,y-.004,tz],[rx*.59,ry*.94,rz*.205],'toe',bone,.003);
        if(key==='bear')d.P.push(cone([tx+rx*.40,y+.015,tz],[tx+rx*.87,y-.028,tz],.018,.004,{bone,part:'claw',k:.002}));
      }
    }
  }
  // Keep fine antler tines above the surface-net sampling limit; undersampled
  // taper ends produced detached beads, not usable anatomical detail.
  if(key==='stag')for(const p of d.P)if(p.part==='antler'&&p.type==='cone') {
    p.ra=Math.max(p.ra,.022);p.rb=Math.max(p.rb,.018);
  }
  // Subtractions last: subsequent unions would fill the cavities.
  d.P.push(...cuts);d.cell=cervid?.022:.026;
  return d;
}

export function buildAnimal(key,{lod='near'}={}) {
  if(!DEFS[key])throw new RangeError('Unknown animal: '+key);
  if(!['near','far'].includes(lod))throw new RangeError('Unknown animal LOD: '+lod);
  const started=performance.now(),d=detailedDefinition(key),joints=quadJoints(d.j);
  const sc=new Sculpt(d.P,{blend:d.blend});
  const raw=polygonize(sc,d.cell),inputTriangles=raw.index.count/3;
  splitSurfaceFans(raw);
  taubinSmooth(raw,2);
  orientSurfaceSheets(raw);
  closeSmallSurfaceLoops(raw,{field:(x,y,z)=>sc.eval(x,y,z),cell:d.cell,accept:p=>p[0]>d.j.head[0]-.35&&p[1]>d.j.head[1]-.3});
  const seamRepair={...raw.userData.seamRepair,orientation:raw.userData.surfaceOrientation};
  // Seat the appearance worker's oriented shallow caps against the ACTUAL fine
  // smoothed surface, identically for both LODs. A cap rim (theta=1.05) remains
  // beneath skin; its central cornea protrudes by about .18 * radius.
  raw.computeBoundingSphere();raw.computeBoundingBox();
  const eyeProbe=new THREE.Mesh(raw,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  eyeProbe.updateMatrixWorld(true);
  for(const e of d.eyes) {
    const outward=new THREE.Vector3(key==='tiger'?.72:.45,.06,e.side*.90).normalize();
    const origin=new THREE.Vector3(...e.center).addScaledVector(outward,.25);
    const hits=new THREE.Raycaster(origin,outward.clone().negate(),0,.6).intersectObject(eyeProbe);
    if(!hits.length)throw new Error('No facial surface for '+key+' eye');
    e.center=hits[0].point.addScaledVector(outward,-Math.max(...e.radius)*.50).toArray();
  }
  eyeProbe.material.dispose();
  // Flatten only the low support skin to its authored sole plane. Smooth-union
  // inflation previously pushed bear heels below the paw and caused penetration.
  const rawP=raw.attributes.position;
  for(let i=0;i<rawP.count;i++)for(const foot of d.support) {
    const [x,y,z]=foot.center,r=foot.radius;
    if(Math.abs(rawP.getX(i)-x)<r[0]*1.7&&Math.abs(rawP.getZ(i)-z)<r[2]*1.3&&rawP.getY(i)<y+.016)rawP.setY(i,y);
  }
  // Choose a real fine-surface support vertex centrally; keep it in BOTH LODs.
  // This prevents contact offsets jumping when the parent swaps geometry only.
  for(const foot of d.support) {
    let best=Infinity;
    for(let i=0;i<rawP.count;i++) {
      const dx=rawP.getX(i)-foot.center[0],dz=rawP.getZ(i)-foot.center[2];
      if(Math.abs(dx)>foot.radius[0]*1.7||Math.abs(dz)>foot.radius[2]*1.3||rawP.getY(i)>.055)continue;
      const score=(rawP.getY(i)-foot.center[1])*100+dx*dx+dz*dz;
      if(score<best){best=score;foot.anchor=[rawP.getX(i),rawP.getY(i),rawP.getZ(i)];}
    }
  }
  const protect=p=>d.support.some(f=>f.anchor.every((v,i)=>v===p[i])) || (lod==='near'&&(p[1]<.045||(p[0]>d.j.head[0]+.13&&p[1]>d.j.head[1]-.22)));
  const geo=quadricSimplify(raw,lod==='near'?19500:4900,{protect});raw.dispose();
  if(geo.index.count/3>(lod==='near'?20000:5000))throw new Error('Animal mesh exceeds '+lod+' triangle budget');
  geo.computeVertexNormals();
  const p=geo.attributes.position,n=geo.attributes.normal,parts=new Float32Array(p.count),colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);sc.eval(x,y,z);
    let pr=sc.prims[sc.lastPart];
    for(const cut of sc.prims)if(cut.subtract&&Math.abs(primDist(cut,x,y,z))<d.cell*.65)pr=cut;
    parts[i]=ANIMAL_PARTS[pr?.part]??ANIMAL_PARTS.body;
    const col=d.paint(x,y,z,n.getX(i),n.getY(i),n.getZ(i),pr);colors.set(col,i*3);
  }
  geo.setAttribute('aDetailPart',new THREE.BufferAttribute(parts,1));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  skinGeometry(geo,sc,joints,d.tau);
  const si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight;
  // Distal support skin stays rigid; the ankle transition remains weighted.
  for(let i=0;i<p.count;i++)for(const foot of d.support) {
    const [x,,z]=foot.center,r=foot.radius;
    if(p.getY(i)<.115&&Math.abs(p.getX(i)-x)<r[0]*1.7&&Math.abs(p.getZ(i)-z)<r[2]*1.3) {
      si.setXYZW(i,joints.findIndex(j=>j.name===foot.bone),0,0,0);sw.setXYZW(i,1,0,0,0);break;
    }
  }
  geo.setAttribute('aRestPosition',new THREE.Float32BufferAttribute(p.array.slice(),3));
  geo.computeBoundingBox();geo.computeBoundingSphere();
  const feet=footMetadata(d,joints,geo);
  return {geo,joints,feet,height:d.j.chest[1],length:d.j.chest[0]-d.j.pelvis[0],detail:{species:key,lod,eyes:d.eyes,triangleCount:geo.index.count/3,cell:d.cell,inputTriangles,seamRepair,smoothing:'2 Taubin iterations (.5,-.53)',decimator:'edge-constrained-plane-quadric',buildMs:performance.now()-started}};
}

export const ANIMAL_KEYS=Object.keys(DEFS);

function footMetadata(d,joints,geo) {
  return d.support.map(foot=>{
    const joint=joints.find(j=>j.name===foot.bone);let sole=[...foot.center];
    if(geo)sole=[...foot.anchor];
    return {bone:foot.bone,sole,offset:sole.map((v,i)=>v-joint.pos[i])};
  });
}
// Lightweight analytic sole path for motion-only tests. Full builds select an
// actual retained sole vertex, not an ankle or estimated primitive centre.
export function animalFootRig(key) {
  const d=detailedDefinition(key),joints=quadJoints(d.j);
  return {joints,feet:footMetadata(d,joints)};
}
