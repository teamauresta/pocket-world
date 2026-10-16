// Sea creatures sculpted from SDF primitives: reef fish species, reef shark, manta ray and green sea turtle.
// Convention: +x is forward (head), +y up, z lateral. Fish are built at real size in world units.
import * as THREE from 'three';
import { Sculpt, polygonize, ellipsoid, cone, fin } from './sculpt.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const lin = (r, g, b) => [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)]; // sRGB-ish picks -> linear

// ------------------------------------------------------------------ generic fish body
// L: length, H: body height, W: body width (thickness), opts for fins/shape
function fishPrims(o) {
  const L = o.L, H = o.H, W = o.W;
  const hx = L * 0.5; // head tip x
  const ft = L * 0.022; // fin thickness, must stay above the sculpt cell size
  const prims = [
    ellipsoid([L * 0.04, 0, 0], [L * 0.4, H * 0.5, W * 0.5], { part: 'body' }),
    ellipsoid([L * 0.3, -H * 0.04, 0], [L * 0.16, H * 0.34, W * 0.4], { part: 'head' }),
    cone([-L * 0.2, 0, 0], [-L * 0.4, 0, 0], H * 0.2, H * 0.06, { part: 'body' }),
    // eyes
    ellipsoid([L * 0.33, H * 0.1, W * 0.36], [L * 0.04, L * 0.04, L * 0.025], { part: 'eye', k: 0.01 }),
    ellipsoid([L * 0.33, H * 0.1, -W * 0.36], [L * 0.04, L * 0.04, L * 0.025], { part: 'eye', k: 0.01 }),
  ];
  // caudal fin
  const cx = -L * 0.38;
  if (o.forked) {
    prims.push(fin([cx, 0.0, 0], [cx - L * 0.2, H * 0.62, 0], [cx - L * 0.1, 0, 0], ft, { part: 'tail', k: 0.02 }));
    prims.push(fin([cx, 0.0, 0], [cx - L * 0.2, -H * 0.62, 0], [cx - L * 0.1, 0, 0], ft, { part: 'tail', k: 0.02 }));
  } else {
    prims.push(fin([cx + L * 0.03, 0, 0], [cx - L * 0.16, H * (o.tailH ?? 0.4), 0], [cx - L * 0.16, -H * (o.tailH ?? 0.4), 0], ft, { part: 'tail', k: 0.03 }));
  }
  // dorsal & anal fins
  const dh = o.dorsalH ?? 0.35, ah = o.analH ?? 0.25;
  prims.push(fin([L * 0.18, H * 0.4, 0], [-L * 0.3, H * 0.12, 0], [-L * (o.dorsalBack ?? 0.18), H * (0.5 + dh), 0], ft, { part: 'dorsal', k: 0.04 }));
  prims.push(fin([L * 0.0, -H * 0.4, 0], [-L * 0.3, -H * 0.12, 0], [-L * 0.2, -H * (0.5 + ah), 0], ft, { part: 'anal', k: 0.04 }));
  // pectorals
  for (const s of [1, -1]) prims.push(fin([L * 0.2, -H * 0.06, s * W * 0.4], [L * 0.1, -H * 0.1, s * W * 0.44], [L * 0.02, -H * 0.18, s * W * 1.2], ft * 0.8, { part: 'pec', k: 0.02 }));
  if (o.extra) prims.push(...o.extra(L, H, W));
  return prims;
}

function paintFish(painter) {
  return (x, y, z, nx, ny, nz, pr, c) => {
    const [r, g, b] = painter(x, y, z, nx, ny, nz, pr ? pr.part : 'body');
    c.setRGB(r, g, b);
  };
}

export const FISH = {
  clown: {
    L: 0.85, H: 0.36, W: 0.2, tailH: 0.42, dorsalH: 0.22, analH: 0.2,
    paint: (L, H) => (x, y, z, nx, ny, nz, part) => {
      if (part === 'eye') return [0.01, 0.01, 0.01];
      const s = x / L;
      const bands = [0.27, 0.0, -0.36];
      let col = lin(0.98, 0.42, 0.04);
      for (const bc of bands) {
        const d = Math.abs(s - bc);
        if (d < 0.05) col = lin(0.97, 0.97, 0.95);
        else if (d < 0.068) col = lin(0.05, 0.03, 0.02);
      }
      if (part === 'tail' || part === 'dorsal' || part === 'anal' || part === 'pec') {
        const edge = part === 'tail' ? ss(-0.47, -0.53, s) : (part === 'pec' ? 0 : ss(0.62, 0.8, Math.abs(y) / H));
        col = edge > 0.5 ? lin(0.05, 0.03, 0.02) : lin(0.98, 0.5, 0.08);
      }
      return col;
    },
  },
  bluetang: {
    L: 1.15, H: 0.6, W: 0.18, tailH: 0.4, dorsalH: 0.1, analH: 0.08, dorsalBack: 0.3,
    paint: (L, H) => (x, y, z, nx, ny, nz, part) => {
      if (part === 'eye') return [0.01, 0.01, 0.02];
      if (part === 'tail') return lin(0.98, 0.84, 0.08);
      if (part === 'pec') return lin(0.95, 0.8, 0.1);
      const s = x / L, t = y / H;
      // the dark "palette" loop on the upper flank
      const loop = Math.abs(t - (0.12 + 0.18 * Math.sin((s + 0.2) * 3.0))) < 0.09 && s > -0.33 && s < 0.32;
      const blob = Math.hypot((s + 0.05) / 0.22, (t - 0.05) / 0.12) < 1 && Math.hypot((s + 0.07) / 0.14, (t - 0.04) / 0.06) > 1;
      if (loop || blob || (part === 'dorsal' && t > 0.55) || (part === 'anal' && t < -0.55)) return lin(0.03, 0.04, 0.1);
      return lin(0.12, 0.36, 0.95);
    },
  },
  yellowtang: {
    L: 1.0, H: 0.66, W: 0.14, tailH: 0.4, dorsalH: 0.32, analH: 0.28, dorsalBack: 0.12,
    extra: (L, H, W) => [ellipsoid([L * 0.44, -H * 0.02, 0], [L * 0.1, H * 0.12, W * 0.35], { part: 'head' })],
    paint: () => (x, y, z, nx, ny, nz, part) => {
      if (part === 'eye') return [0.01, 0.01, 0.01];
      const t = 0.92 + 0.08 * Math.sin(x * 40 + y * 30);
      return lin(1.0 * t, 0.86 * t, 0.06);
    },
  },
  angel: {
    L: 1.25, H: 0.72, W: 0.16, tailH: 0.42, dorsalH: 0.18, analH: 0.16, dorsalBack: 0.3,
    paint: (L, H) => (x, y, z, nx, ny, nz, part) => {
      if (part === 'eye') return [0.01, 0.01, 0.01];
      if (part === 'tail') return lin(0.98, 0.78, 0.1);
      const s = x / L, t = y / H;
      if (s > 0.25 && s < 0.36 && Math.abs(t) < 0.5) return lin(0.05, 0.05, 0.12); // eye mask
      if (s > 0.36) return lin(0.85, 0.85, 0.75);
      const stripe = Math.abs(((t * 7 + s * 1.6) % 1 + 1) % 1 - 0.5) < 0.2;
      return stripe ? lin(0.98, 0.84, 0.15) : lin(0.12, 0.2, 0.75);
    },
  },
  idol: {
    L: 0.95, H: 0.78, W: 0.12, tailH: 0.34, dorsalH: 0.25, analH: 0.3, dorsalBack: 0.0,
    extra: (L, H, W) => [
      cone([L * 0.08, H * 0.6, 0], [-L * 0.55, H * 1.05, 0], L * 0.02, L * 0.006, { part: 'streamer', k: 0.02 }),
      cone([L * 0.38, -H * 0.06, 0], [L * 0.58, -H * 0.05, 0], W * 0.3, W * 0.18, { part: 'snout', k: 0.03 }),
    ],
    paint: (L) => (x, y, z, nx, ny, nz, part) => {
      if (part === 'eye') return [0.01, 0.01, 0.01];
      if (part === 'snout') return lin(0.95, 0.55, 0.15);
      if (part === 'streamer') return lin(0.95, 0.95, 0.92);
      const s = x / L;
      if (part === 'tail') return lin(0.04, 0.04, 0.04);
      if ((s > 0.12 && s < 0.32) || (s > -0.3 && s < -0.15)) return lin(0.03, 0.03, 0.03);
      if (s > -0.15 && s < 0.12 && y < 0) return lin(0.98, 0.86, 0.2);
      return lin(0.95, 0.94, 0.86);
    },
  },
  silver: {
    L: 0.75, H: 0.2, W: 0.11, forked: true, dorsalH: 0.15, analH: 0.1,
    paint: (L, H) => (x, y, z, nx, ny, nz, part) => {
      if (part === 'eye') return [0.02, 0.02, 0.02];
      const t = ss(-0.3, 0.6, ny * 0.6 + y / H);
      const c0 = lin(0.88, 0.9, 0.92), c1 = lin(0.25, 0.38, 0.5);
      return [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)];
    },
  },
};

export function fishGeometry(key) {
  const o = FISH[key];
  const prims = fishPrims(o);
  const sc = new Sculpt(prims, { blend: o.L * 0.04 });
  const geo = polygonize(sc, o.L / (key === 'silver' ? 20 : 25), { paint: paintFish(o.paint(o.L, o.H, o.W)) });
  // body coordinate for the swim wave: 0 at the head tip, 1 at the tail tip
  const p = geo.attributes.position;
  const bx = new Float32Array(p.count);
  const head = geo.boundingBox.max.x, tail = geo.boundingBox.min.x;
  for (let i = 0; i < p.count; i++) bx[i] = (head - p.getX(i)) / (head - tail);
  geo.setAttribute('aBody', new THREE.BufferAttribute(bx, 1));
  return geo;
}

// ------------------------------------------------------------------ reef shark
export function sharkGeometry() {
  const P = [];
  P.push(ellipsoid([0.6, 0.02, 0], [2.5, 0.82, 0.86], { part: 'body' }));
  P.push(ellipsoid([2.55, -0.02, 0], [1.6, 0.56, 0.64], { part: 'head' }));
  P.push(ellipsoid([3.55, -0.08, 0], [0.75, 0.3, 0.44], { part: 'head' }));
  P.push(ellipsoid([-1.6, 0.05, 0], [1.7, 0.5, 0.46], { part: 'body' }));
  P.push(cone([-2.5, 0.08, 0], [-3.4, 0.16, 0], 0.32, 0.13, { part: 'body' }));
  P.push(fin([1.3, 0.72, 0], [-0.25, 0.62, 0], [0.05, 2.05, 0], 0.05, { part: 'fin', k: 0.18 }));
  P.push(fin([-2.0, 0.42, 0], [-2.6, 0.36, 0], [-2.55, 0.78, 0], 0.035, { part: 'fin', k: 0.08 }));
  for (const s of [1, -1]) {
    P.push(fin([2.0, -0.42, s * 0.52], [1.15, -0.5, s * 0.6], [0.55, -1.05, s * 2.25], 0.075, { part: 'fin', k: 0.14 }));
    P.push(fin([-0.9, -0.48, s * 0.3], [-1.45, -0.44, s * 0.3], [-1.55, -0.82, s * 0.75], 0.06, { part: 'fin', k: 0.06 }));
    P.push(ellipsoid([3.15, 0.16, s * 0.43], [0.08, 0.075, 0.05], { part: 'eye', k: 0.02 }));
  }
  P.push(fin([-2.25, -0.34, 0], [-2.65, -0.3, 0], [-2.65, -0.7, 0], 0.03, { part: 'fin', k: 0.06 }));
  P.push(fin([-3.2, 0.2, 0], [-3.55, 0.02, 0], [-4.75, 2.0, 0], 0.045, { part: 'fin', k: 0.1 }));
  P.push(fin([-3.25, 0.05, 0], [-3.55, 0.12, 0], [-4.25, -1.15, 0], 0.04, { part: 'fin', k: 0.08 }));
  const sc = new Sculpt(P, { blend: 0.2 });
  const top = lin(0.42, 0.46, 0.5), belly = lin(0.92, 0.92, 0.9), tip = lin(0.06, 0.07, 0.08);
  const geo = polygonize(sc, 0.075, {
    paint: (x, y, z, nx, ny, nz, pr, c) => {
      if (pr && pr.part === 'eye') { c.setRGB(0.01, 0.01, 0.01); return; }
      const isFin = pr && pr.part === 'fin';
      const t = isFin && Math.abs(z) > 0.7 ? ss(-0.3, 0.3, ny) : ss(-0.22, 0.12, y + ny * 0.25 - (x > 2.5 ? 0.08 : 0));
      let r = mix(belly[0], top[0], t), g = mix(belly[1], top[1], t), b = mix(belly[2], top[2], t);
      if (pr && pr.part === 'fin') {
        // dark fin tips
        const far = Math.max(Math.abs(y) - 0.9, Math.abs(z) - 1.6, -x - 4.2, 0);
        const k = ss(0.5, 0.9, far + (Math.abs(y) > 1.6 ? 0.6 : 0));
        r = mix(r, tip[0], k); g = mix(g, tip[1], k); b = mix(b, tip[2], k);
      }
      // gill slits
      if (x > 1.75 && x < 2.45 && Math.abs(nz) > 0.6 && y > -0.35 && y < 0.25) {
        const f = Math.abs(((x - 1.75) / 0.14) % 1 - 0.5);
        if (f < 0.12) { r *= 0.55; g *= 0.55; b *= 0.6; }
      }
      c.setRGB(r, g, b);
    },
  });
  const p = geo.attributes.position;
  const bx = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) bx[i] = (4.0 - p.getX(i)) / 8.7;
  geo.setAttribute('aBody', new THREE.BufferAttribute(bx, 1));
  return geo;
}

// ------------------------------------------------------------------ manta ray
export function mantaGeometry() {
  const P = [];
  P.push(ellipsoid([0.1, 0, 0], [1.5, 0.36, 1.15], { part: 'body' }));
  for (const s of [1, -1]) {
    P.push(fin([1.05, 0.02, s * 0.8], [-1.0, 0.0, s * 0.8], [-0.55, 0.08, s * 3.7], 0.11, { part: 'wing', k: 0.55 }));
    P.push(cone([1.35, 0.02, s * 0.55], [2.1, -0.12, s * 0.48], 0.14, 0.06, { part: 'horn', k: 0.1 }));
    P.push(ellipsoid([1.32, 0.12, s * 0.62], [0.07, 0.06, 0.05], { part: 'eye', k: 0.02 }));
  }
  P.push(cone([-1.25, 0, 0], [-3.9, 0.02, 0], 0.12, 0.018, { part: 'tail', k: 0.12 }));
  const sc = new Sculpt(P, { blend: 0.3 });
  const geo = polygonize(sc, 0.07, {
    paint: (x, y, z, nx, ny, nz, pr, c) => {
      if (pr && pr.part === 'eye') { c.setRGB(0.01, 0.01, 0.01); return; }
      if (ny < -0.2) { // belly
        const k = ss(2.6, 3.6, Math.abs(z));
        c.setRGB(mix(0.85, 0.3, k), mix(0.86, 0.32, k), mix(0.84, 0.36, k));
        return;
      }
      const shoulder = Math.hypot((x - 0.45) / 0.38, (Math.abs(z) - 1.05) / 0.5) < 1 ? 1 : 0;
      const v = 0.04 + 0.006 * Math.sin(x * 9 + z * 7);
      c.setRGB(mix(v, 0.55, shoulder * 0.6), mix(v + 0.004, 0.56, shoulder * 0.6), mix(v + 0.012, 0.58, shoulder * 0.6));
    },
  });
  const p = geo.attributes.position;
  const span = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) span[i] = Math.abs(p.getZ(i)) / 3.7;
  geo.setAttribute('aSpan', new THREE.BufferAttribute(span, 1));
  return geo;
}

// ------------------------------------------------------------------ green sea turtle
export function turtleGeometry() {
  const P = [];
  P.push(ellipsoid([0, 0.16, 0], [1.6, 0.55, 1.22], { part: 'shell' }));
  P.push(ellipsoid([0, -0.12, 0], [1.45, 0.24, 1.08], { part: 'belly' }));
  P.push(cone([1.25, 0.04, 0], [1.75, 0.08, 0], 0.3, 0.26, { part: 'skin' }));
  P.push(ellipsoid([2.02, 0.1, 0], [0.48, 0.3, 0.32], { part: 'skin' }));
  for (const s of [1, -1]) {
    P.push(fin([1.05, -0.04, s * 0.85], [0.5, -0.06, s * 0.98], [-0.25, -0.16, s * 2.6], 0.075, { part: s > 0 ? 'flipL' : 'flipR', k: 0.14 }));
    P.push(fin([-1.15, -0.08, s * 0.62], [-1.5, -0.08, s * 0.5], [-1.95, -0.1, s * 1.05], 0.05, { part: 'skin', k: 0.08 }));
    P.push(ellipsoid([2.22, 0.2, s * 0.24], [0.06, 0.06, 0.04], { part: 'eye', k: 0.02 }));
  }
  P.push(cone([-1.5, -0.02, 0], [-1.95, -0.06, 0], 0.12, 0.03, { part: 'skin' }));
  const sc = new Sculpt(P, { blend: 0.12 });
  const geo = polygonize(sc, 0.06, {
    paint: (x, y, z, nx, ny, nz, pr, c) => {
      const part = pr ? pr.part : 'shell';
      if (part === 'eye') { c.setRGB(0.01, 0.01, 0.01); return; }
      if (part === 'belly') { const k = lin(0.78, 0.7, 0.45); c.setRGB(...k); return; }
      if (part === 'shell') {
        // scutes: a row of vertebrals, costals either side, and small marginals around the rim
        const az = Math.abs(z);
        const rim = Math.hypot(x / 1.6, z / 1.22);
        let seam = false, cx0 = 0, cz0 = 0;
        if (rim > 0.86) {
          const ang = Math.atan2(z, x);
          seam = Math.abs(((ang * 7.5) % 1 + 1) % 1 - 0.5) > 0.44 || Math.abs(rim - 0.86) < 0.025;
          cx0 = Math.cos(Math.round(ang * 7.5) / 7.5) * 1.5; cz0 = Math.sin(Math.round(ang * 7.5) / 7.5) * 1.15;
        } else if (az < 0.42) {
          const xs = [-1.05, -0.45, 0.15, 0.75, 1.3];
          for (const b of xs) if (Math.abs(x - b) < 0.03) seam = true;
          if (Math.abs(az - 0.42) < 0.03) seam = true;
          cx0 = Math.round((x - 0.15) / 0.6) * 0.6 + 0.15 - 0.3; cz0 = 0;
        } else {
          const xs = [-0.75, -0.05, 0.6];
          for (const b of xs) if (Math.abs(x - b - (az - 0.42) * 0.25) < 0.03) seam = true;
          cx0 = x; cz0 = Math.sign(z) * 0.7;
        }
        const ang2 = Math.atan2(z - cz0, x - cx0);
        const streak = 0.5 + 0.5 * Math.sin(ang2 * 9 + az * 3);
        const amber = lin(0.62, 0.42, 0.16), dark = lin(0.28, 0.17, 0.07);
        let r = mix(amber[0], dark[0], streak * 0.75), g = mix(amber[1], dark[1], streak * 0.75), b = mix(amber[2], dark[2], streak * 0.75);
        if (seam) { r = 0.42; g = 0.36; b = 0.2; }
        c.setRGB(r, g, b);
        return;
      }
      // skin: olive with pale scale outlines
      const sc2 = Math.abs(Math.sin(x * 22) * Math.sin(z * 22 + y * 10));
      const k = sc2 > 0.85 ? 1 : 0;
      const a = lin(0.36, 0.33, 0.22), b2 = lin(0.62, 0.58, 0.42);
      c.setRGB(mix(a[0], b2[0], k), mix(a[1], b2[1], k), mix(a[2], b2[2], k));
    },
  });
  // smooth flipper weight: +1 on the left front flipper, -1 on the right, blending in at the shoulder
  const pp = geo.attributes.position;
  const flip = new Float32Array(pp.count);
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), z = pp.getZ(i);
    const w = ss(0.95, 1.4, Math.abs(z)) * ss(-0.7, -0.3, x) * (1 - ss(1.05, 1.35, x));
    flip[i] = Math.sign(z) * w;
  }
  geo.setAttribute('aFlip', new THREE.BufferAttribute(flip, 1));
  return geo;
}
