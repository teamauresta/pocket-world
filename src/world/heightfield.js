// Procedural island heightfield: coastline, mountain, reef shelf and drop-off, river with a waterfall, and biome zones.
// Layout follows the concept: mountain at the back corner, river running toward the viewer, forest/bamboo/jungle on
// the left (e < 0), meadow and birches on the right (e > 0), open sea in front.
import { Simplex, smoothstep, clamp, lerp } from '../core/noise.js';
import { HALF, GRID, CELL, PEAK, SEED, INSET, dOf, eOf } from './config.js';

const sig = (x) => 1 / (1 + Math.exp(-x));
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
const smax = (a, b, k) => -smin(-a, -b, k);

// Catmull-Rom through 2D control points, resampled to a fixed spacing
function resamplePath(ctrl, spacing) {
  const dense = [];
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      dense.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  dense.push(ctrl[ctrl.length - 1].slice());
  const out = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    acc += seg;
    while (acc >= spacing) {
      acc -= spacing;
      const f = 1 - acc / seg;
      out.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
    }
  }
  out.push(dense[dense.length - 1]);
  return out;
}

export class Heightfield {
  constructor() {
    this.n = GRID;
    this.h = new Float32Array(GRID * GRID);
    this.coastDist = new Float32Array(GRID * GRID); // signed: < 0 inland
    this.zone = new Float32Array(GRID * GRID * 4); // bamboo, meadow, jungle, forest
    this.noise = new Simplex(SEED);
    this.noiseB = new Simplex(SEED * 31 + 5);
    this.build();
  }

  x(i) { return -HALF + i * CELL; }

  // signed distance-like value to the coast (negative on land)
  coastSigned(x, z) {
    const N = this.noise, M = this.noiseB;
    const wx = x + 4.0 * N.fbm2(x * 0.035, z * 0.035, 3);
    const wz = z + 4.0 * N.fbm2(x * 0.035 + 41.3, z * 0.035 - 17.9, 3);
    const d = dOf(wx, wz), e = eOf(wx, wz);
    const coast = 8.5 + 9.5 * Math.exp(-(e / 22) * (e / 22)) + 3.0 * M.noise2(e * 0.055, 3.3) + 1.5 * M.noise2(e * 0.16, 7.7);
    const lim = HALF - INSET;
    const s1 = d - coast;
    const s2 = -lim - wx + 3.4 * M.noise2(wz * 0.055, 1.1) + 1.3 * M.noise2(wz * 0.17, 4.1);
    const s3 = -lim - wz + 3.4 * M.noise2(wx * 0.055, 2.2) + 1.3 * M.noise2(wx * 0.17, 5.3);
    const s4 = wx - lim + 2.5 * M.noise2(wz * 0.07, 8.8) + 3;
    const s5 = wz - lim + 2.5 * M.noise2(wx * 0.07, 9.9) + 3;
    return smax(smax(smax(smax(s1, s2, 8), s3, 8), s4, 9), s5, 9);
  }

  rawHeight(x, z) {
    const N = this.noise;
    const s = this.coastSigned(x, z);
    const mx = x - PEAK.x, mz = z - PEAK.z;
    const r2 = mx * mx + mz * mz;
    const rid = N.ridged2(x * 0.042 + 3.1, z * 0.042 - 7.7, 3);
    const sx = x - (PEAK.x - 6), sz = z - (PEAK.z + 7);
    const s2r = sx * sx + sz * sz;
    const summit = smoothstep(2.5, 8, Math.sqrt(r2));
    const mountain = 26 * Math.exp(-r2 / (2 * 7.8 * 7.8)) * (0.72 + 0.42 * (rid * summit + 0.45 * (1 - summit)))
      + 5 * Math.exp(-s2r / (2 * 5 * 5)) * (0.65 + 0.5 * rid)
      + 3.0 * Math.exp(-r2 / (2 * 14 * 14)) * rid;
    if (s < 0) {
      const f = -s;
      const e = eOf(x, z);
      const beach = 1.0 * smoothstep(0.0, 3.0, f);
      const inland = smoothstep(2.0, 17, f);
      const plateau = 4.0 * Math.pow(inland, 1.2);
      const leftHilly = 1 + 0.45 * sig((-e - 10) / 6);
      const hills = (1.2 * N.fbm2(x * 0.04 + 5, z * 0.04 - 3, 4) * leftHilly + 0.22 * N.fbm2(x * 0.15, z * 0.15, 3)) * inland;
      const mtn = mountain * smoothstep(0.5, 9, f);
      return beach + plateau + Math.max(-1.2, hills) + mtn;
    }
    // sea floor: reef flat, wall, deep sand with coral heads
    const u = s;
    const uw = u + 4.0 * N.noise2(x * 0.05 + 3, z * 0.05 - 8);
    let y = -3.0 * smoothstep(0, 4.0, u) - 1.4 * smoothstep(2.5, 7, u);
    y += -16.0 * smoothstep(5.5, 30, uw);
    const shelf = 1 - smoothstep(6, 10, u);
    const bumps = Math.max(0, N.fbm2(x * 0.12 + 11, z * 0.12 - 4, 3) - 0.08) * 2.6;
    y += bumps * shelf * smoothstep(0.8, 2.5, u);
    const edgeFade = smoothstep(2, 8, HALF - Math.max(Math.abs(x), Math.abs(z)));
    const deep = smoothstep(16, 26, u) * edgeFade;
    y += 0.9 * N.fbm2(x * 0.04 - 9, z * 0.04 + 2, 3) * deep;
    const mound = Math.max(0, N.fbm2(x * 0.075 + 20, z * 0.075 + 20, 3) - 0.24);
    y += (3.4 * Math.pow(smoothstep(0.0, 0.32, mound), 1.4) + 2.5 * mound) * deep;
    // the mountain continues as a submerged ridge behind the island
    y += Math.max(0, mountain - 4) * 0.35 * (1 - smoothstep(0, 8, u));
    return Math.min(y, -0.05 - 0.5 * smoothstep(0, 1.5, u));
  }

  build() {
    const n = this.n, h = this.h;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.x(i), z = this.x(j);
        h[j * n + i] = this.rawHeight(x, z);
        this.coastDist[j * n + i] = this.coastSigned(x, z);
      }
    }
    this.carveRiver();
    this.computeZones();
  }

  // ---------------------------------------------------------------- river + waterfall
  carveRiver() {
    const flow = [Math.SQRT1_2, Math.SQRT1_2];
    const DE = (d, e) => [(d + e) * Math.SQRT1_2, (d - e) * Math.SQRT1_2];
    const fallDE = DE(-30.0, 0.2);
    const fall = { x: fallDE[0], z: fallDE[1] };
    const upstream = [DE(-34.0, 0.6), DE(-32.6, 0.3), DE(-31.2, 0.2), [fall.x, fall.z]];
    const pool = { x: fall.x + flow[0] * 2.4, z: fall.z + flow[1] * 2.4 };
    const downstream = [[pool.x, pool.z], DE(-24.5, 0.9), DE(-19, 2.4), DE(-13, 1.2), DE(-7.5, -1.6), DE(-2, -0.8), DE(3.5, 1.8), DE(9, 2.6), DE(14, 0.9), DE(19, -0.4), DE(25, -0.3), DE(33, 0)];

    const up = resamplePath(upstream, 0.3);
    const down = resamplePath(downstream, 0.3);

    const levelsFor = (pts, start, margin) => {
      const raw = pts.map(([x, z]) => this.heightAt(x, z));
      const sm = raw.map((_, k) => {
        let s = 0, c = 0;
        for (let q = -4; q <= 4; q++) { s += raw[clamp(k + q, 0, raw.length - 1)]; c++; }
        return s / c;
      });
      const out = [];
      let L = start;
      for (let k = 0; k < pts.length; k++) { L = Math.min(L, sm[k] - margin); out.push(L); }
      return out;
    };

    const upLv = levelsFor(up, Infinity, 0.35);
    const topLevel = upLv[upLv.length - 1];
    const bottomLevel = Math.min(topLevel - 7.5, this.heightAt(pool.x, pool.z) - 0.6);

    const n = this.n, h = this.h;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.x(i), z = this.x(j);
        const px = x - fall.x, pz = z - fall.z;
        const along = px * flow[0] + pz * flow[1];
        const across = -px * flow[1] + pz * flow[0];
        const k = j * n + i;
        const lateral = Math.exp(-(across * across) / (2 * 3.8 * 3.8));
        if (along < 0 && along > -6) {
          const ledge = topLevel + 1.2 + 0.5 * this.noise.noise2(x * 0.5, z * 0.5);
          const w = lateral * smoothstep(-6, -1.0, along);
          h[k] = Math.max(h[k], lerp(h[k], ledge, w));
        } else if (along >= 0 && along < 10) {
          const basin = bottomLevel + 0.4 + 0.42 * along + 0.05 * across * across;
          const w = Math.exp(-(across * across) / (2 * 3.4 * 3.4)) * (1 - smoothstep(4.5, 10, along));
          h[k] = Math.min(h[k], lerp(h[k], basin, w));
        }
      }
    }

    const downLv = levelsFor(down, bottomLevel, 0.3);
    for (let k = 0; k < downLv.length; k++) {
      const t = k / (downLv.length - 1);
      downLv[k] = Math.min(downLv[k], lerp(bottomLevel, -0.05, smoothstep(0.0, 0.86, t)));
    }

    const carve = (pts, levels, w0, w1, d0, d1) => {
      const total = pts.length;
      const maxW = Math.max(w0, w1) + 4;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      const i0 = Math.max(0, Math.floor((minX - maxW + HALF) / CELL)), i1 = Math.min(n - 1, Math.ceil((maxX + maxW + HALF) / CELL));
      const j0 = Math.max(0, Math.floor((minZ - maxW + HALF) / CELL)), j1 = Math.min(n - 1, Math.ceil((maxZ + maxW + HALF) / CELL));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = this.x(i), z = this.x(j);
          let best = Infinity, bt = 0;
          for (let k = 0; k < total - 1; k++) {
            const ax = pts[k][0], az = pts[k][1], bx = pts[k + 1][0], bz = pts[k + 1][1];
            const vx = bx - ax, vz = bz - az;
            const l2 = vx * vx + vz * vz;
            let t = l2 > 0 ? ((x - ax) * vx + (z - az) * vz) / l2 : 0;
            t = clamp(t, 0, 1);
            const qx = ax + vx * t - x, qz = az + vz * t - z;
            const d2 = qx * qx + qz * qz;
            if (d2 < best) { best = d2; bt = k + t; }
          }
          const d = Math.sqrt(best);
          const tt = bt / (total - 1);
          const w = lerp(w0, w1, tt) * (1 + 0.15 * this.noise.noise2(x * 0.3, z * 0.3));
          if (d > w + 4) continue;
          const kf = Math.floor(bt), fr = bt - kf;
          const L = lerp(levels[kf], levels[Math.min(kf + 1, total - 1)], fr);
          const D = lerp(d0, d1, tt);
          const idx = j * n + i;
          if (d < w) {
            const bed = L - D * (1 - (d / w) * (d / w));
            h[idx] = Math.min(h[idx], bed);
          } else {
            const bank = L + 0.1 + (d - w) * 0.6;
            if (h[idx] > bank) h[idx] = lerp(bank, h[idx], smoothstep(w, w + 4, d));
            else if (h[idx] < L + 0.12 && L > 0.2) h[idx] = lerp(L + 0.12, h[idx], smoothstep(w + 1.5, w + 4, d));
          }
        }
      }
    };

    carve(up, upLv, 0.6, 1.0, 0.35, 0.5);
    carve(down, downLv, 0.9, 2.0, 0.55, 0.95);

    this.river = {
      up: up.map(([x, z], k) => ({ x, z, level: upLv[k] })),
      down: down.map(([x, z], k) => ({ x, z, level: downLv[k] })),
      fall: { x: fall.x, z: fall.z, top: topLevel, bottom: bottomLevel, dir: flow },
      pool,
      upWidth: [0.6, 1.0],
      downWidth: [0.9, 2.0],
    };
  }

  // ---------------------------------------------------------------- zones
  computeZones() {
    const n = this.n, N = this.noise;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.x(i), z = this.x(j);
        const k = j * n + i;
        const nz = 7 * N.fbm2(x * 0.05 - 30, z * 0.05 + 12, 3);
        const e = eOf(x, z) + nz, d = dOf(x, z) + nz * 0.6;
        const dm = Math.hypot(x - PEAK.x, z - PEAK.z);
        const mt = 1 - smoothstep(8, 15, dm);
        let meadow = sig((e - 2.5) / 2.5) * sig((d + 26) / 4);
        let bamboo = sig((-e - 2.5) / 2.5) * sig((e + 17) / 3) * sig((d + 25) / 3);
        let jungle = sig((-e - 17) / 3) * sig((d + 14) / 4);
        let forest = sig((-d - 18) / 4) + sig((-e - 36) / 4) * 0.8 + 0.04;
        const sum = meadow + bamboo + jungle + forest;
        const w = [bamboo / sum, meadow / sum, jungle / sum, forest / sum];
        for (let q = 0; q < 4; q++) this.zone[k * 4 + q] = q === 3 ? lerp(w[q], 1, mt) : lerp(w[q], 0, mt);
      }
    }
  }

  // ---------------------------------------------------------------- queries
  heightAt(x, z) {
    const n = this.n;
    const fx = clamp((x + HALF) / CELL, 0, n - 1.0001), fz = clamp((z + HALF) / CELL, 0, n - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const h = this.h;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  normalAt(x, z, out = [0, 1, 0]) {
    const e = CELL;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    const nx = hl - hr, ny = 2 * e, nz = hd - hu;
    const l = Math.hypot(nx, ny, nz);
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
    return out;
  }

  zoneAt(x, z, out = [0, 0, 0, 0]) {
    const n = this.n;
    const i = clamp(Math.round((x + HALF) / CELL), 0, n - 1), j = clamp(Math.round((z + HALF) / CELL), 0, n - 1);
    const k = (j * n + i) * 4;
    out[0] = this.zone[k]; out[1] = this.zone[k + 1]; out[2] = this.zone[k + 2]; out[3] = this.zone[k + 3];
    return out;
  }

  coastAt(x, z) {
    const n = this.n;
    const i = clamp(Math.round((x + HALF) / CELL), 0, n - 1), j = clamp(Math.round((z + HALF) / CELL), 0, n - 1);
    return this.coastDist[j * n + i];
  }

  riverInfo(x, z) {
    let best = Infinity, lvl = 0, w = 0, t = 0, reach = 0;
    const scan = (pts, w0, w1, r) => {
      for (let k = 0; k < pts.length; k += 2) {
        const p = pts[k];
        const d2 = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d2 < best) { best = d2; lvl = p.level; w = lerp(w0, w1, k / (pts.length - 1)); t = k / (pts.length - 1); reach = r; }
      }
    };
    scan(this.river.up, ...this.river.upWidth, 0);
    scan(this.river.down, ...this.river.downWidth, 1);
    return { dist: Math.sqrt(best), level: lvl, width: w, t, reach };
  }
}
