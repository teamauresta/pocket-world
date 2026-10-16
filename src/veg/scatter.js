// Placement helpers: jittered grid sampling over the slice plus terrain queries used by every plant type.
import { mulberry32, smoothstep } from '../core/noise.js';
import { HALF, dOf, eOf, GLADES } from '../world/config.js';

// 1 inside an open glade, fading to 0 at its rim
export function gladeMask(x, z) {
  const d = dOf(x, z), e = eOf(x, z);
  let m = 0;
  for (const g of GLADES) {
    const r = Math.hypot(d - g.d, e - g.e);
    m = Math.max(m, smoothstep(g.r, g.r * 0.55, r));
  }
  return m;
}

export function makeSampler(hf, seed) {
  const rng = mulberry32(seed);
  const nrm = [0, 1, 0];
  const zw = [0, 0, 0, 0];
  const at = (x, z) => {
    hf.normalAt(x, z, nrm);
    hf.zoneAt(x, z, zw);
    const r = hf.riverInfo(x, z);
    return {
      x, z,
      h: hf.heightAt(x, z),
      slope: 1 - nrm[1],
      bamboo: zw[0], meadow: zw[1], jungle: zw[2], forest: zw[3],
      river: r.dist - r.width,
      coast: hf.coastAt(x, z),
      d: dOf(x, z), e: eOf(x, z),
      glade: gladeMask(x, z),
    };
  };
  const grid = (spacing, fn, margin = 1) => {
    for (let z = -HALF + margin; z < HALF - margin; z += spacing) {
      for (let x = -HALF + margin; x < HALF - margin; x += spacing) {
        const px = x + rng() * spacing, pz = z + rng() * spacing;
        fn(px, pz);
      }
    }
  };
  return { rng, at, grid, smoothstep };
}

// Fast spatial hash to keep plants from overlapping
export class SpatialHash {
  constructor(cell = 2) { this.cell = cell; this.map = new Map(); }
  key(x, z) { return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; }
  add(x, z, r) {
    const k = this.key(x, z);
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push([x, z, r]);
  }
  free(x, z, r) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    const reach = Math.ceil((r + 4) / this.cell);
    for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
      const list = this.map.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const [px, pz, pr] of list) {
        const dx = px - x, dz = pz - z;
        if (dx * dx + dz * dz < (r + pr) * (r + pr)) return false;
      }
    }
    return true;
  }
}
