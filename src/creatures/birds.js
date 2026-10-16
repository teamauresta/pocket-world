// Birds sculpted like the other creatures: bald eagle, scarlet macaw and seagull. Wings flap in the vertex shader.
import * as THREE from 'three';
import { Sculpt, polygonize, ellipsoid, cone, fin } from './sculpt.js';

const lin = (r, g, b) => [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// span: half wingspan; body length L
function birdPrims(o) {
  const L = o.L, S = o.span;
  const P = [
    ellipsoid([0, 0, 0], [L * 0.32, L * 0.13, L * 0.13], { part: 'body' }),
    ellipsoid([L * 0.33, L * 0.04, 0], [L * 0.11, L * 0.1, L * 0.095], { part: 'head', k: L * 0.05 }),
    cone([L * 0.42, L * 0.03, 0], [L * 0.52, L * 0.0, 0], L * 0.035, L * 0.008, { part: 'beak', k: L * 0.01 }),
    fin([-L * 0.25, 0, 0], [-L * (0.55 + o.tail), L * 0.01, L * 0.13], [-L * (0.55 + o.tail), L * 0.01, -L * 0.13], L * 0.012, { part: 'tail', k: L * 0.03 }),
  ];
  for (const s of [1, -1]) {
    P.push(fin([L * 0.14, L * 0.04, s * L * 0.08], [-L * 0.16, L * 0.04, s * L * 0.08], [-L * 0.05, L * 0.05, s * S], L * 0.014, { part: 'wing', k: L * 0.05 }));
    P.push(fin([L * 0.06, L * 0.045, s * S * 0.55], [-L * 0.22, L * 0.045, s * S * 0.45], [-L * 0.16, L * 0.05, s * S * 0.98], L * 0.012, { part: 'wing', k: L * 0.04 }));
    P.push(ellipsoid([L * 0.4, L * 0.07, s * L * 0.075], [L * 0.02, L * 0.02, L * 0.015], { part: 'eye', k: L * 0.004 }));
  }
  return P;
}

export const BIRDS = {
  eagle: {
    L: 1.1, span: 1.35, tail: 0.12,
    paint: (x, y, z, part, L, S) => {
      if (part === 'eye') return lin(0.9, 0.75, 0.2);
      if (part === 'beak') return lin(0.95, 0.75, 0.15);
      if (part === 'head' || (part === 'body' && x > L * 0.24)) return lin(0.95, 0.94, 0.9);
      if (part === 'tail') return lin(0.95, 0.94, 0.9);
      return Math.abs(z) > S * 0.85 ? lin(0.12, 0.08, 0.05) : lin(0.3, 0.2, 0.12);
    },
  },
  macaw: {
    L: 0.75, span: 0.75, tail: 0.6,
    paint: (x, y, z, part, L, S) => {
      if (part === 'eye') return lin(0.95, 0.95, 0.9);
      if (part === 'beak') return lin(0.92, 0.88, 0.78);
      if (part === 'wing') {
        const f = Math.abs(z) / S;
        return f > 0.62 ? lin(0.1, 0.3, 0.85) : f > 0.38 ? lin(0.98, 0.82, 0.1) : lin(0.85, 0.08, 0.06);
      }
      if (part === 'tail') return x < -L * 0.9 ? lin(0.1, 0.35, 0.85) : lin(0.85, 0.08, 0.06);
      return lin(0.88, 0.1, 0.06);
    },
  },
  gull: {
    L: 0.8, span: 0.95, tail: 0.08,
    paint: (x, y, z, part, L, S) => {
      if (part === 'eye') return lin(0.05, 0.05, 0.05);
      if (part === 'beak') return lin(0.95, 0.8, 0.2);
      if (part === 'wing') return Math.abs(z) > S * 0.85 ? lin(0.1, 0.1, 0.1) : (y > 0.03 ? lin(0.62, 0.65, 0.7) : lin(0.95, 0.95, 0.95));
      return lin(0.96, 0.96, 0.96);
    },
  },
};

export function birdGeometry(key) {
  const o = BIRDS[key];
  const sc = new Sculpt(birdPrims(o), { blend: o.L * 0.04 });
  const geo = polygonize(sc, o.L / 30, {
    paint: (x, y, z, nx, ny, nz, pr, c) => { const k = o.paint(x, y, z, pr ? pr.part : 'body', o.L, o.span); c.setRGB(k[0], k[1], k[2]); },
  });
  const p = geo.attributes.position;
  const span = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) span[i] = ss(o.L * 0.1, o.span, Math.abs(p.getZ(i))) * Math.sign(p.getZ(i));
  geo.setAttribute('aSpan', new THREE.BufferAttribute(span, 1));
  geo.deleteAttribute('aPart');
  return geo;
}
