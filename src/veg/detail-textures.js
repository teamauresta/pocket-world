// Original CPU-authored detail maps, not EZ-Tree asset maps or upscaled photographs.
// Three full-resolution variants are packed horizontally; each cell is 1024² (low: 512²).
import * as THREE from 'three';
const cache = new Map();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const byte = v => Math.round(clamp(v) * 255);
function hash(x, y, seed) { let n = Math.imul(x + seed * 71, 374761393) ^ Math.imul(y + seed, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295; }
export function leafSpecies(tex, requested) {
  if (requested) return /pine/.test(requested) ? 'pine' : /ash/.test(requested) ? 'ash' : /birch|aspen/.test(requested) ? 'aspen' : 'oak';
  const name = tex?.name || tex?.image?.currentSrc || tex?.image?.src || '';
  return name.match(/leaf_(pine|ash|aspen|oak)/)?.[1] || 'legacy';
}
function texture(data, w, h, name, repeat = false) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.name = name; t.colorSpace = THREE.NoColorSpace; t.flipY = false;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 2; t.needsUpdate = true;
  return t;
}
// Veins are authored in leaf-local UV, with a central stem and paired oblique veins.
// These are bounded modulation maps: original photographed/canvas silhouette and alpha stay authoritative.
export function createLeafDetail(species = 'oak', quality = 'high') {
  const size = quality === 'low' ? 512 : 1024, width = size * 3;
  const rgb = new Uint8Array(width * size * 4), normal = new Uint8Array(rgb.length);
  const heights = new Float32Array(width * size);
  const seed = { oak: 13, ash: 29, aspen: 47, pine: 61, legacy: 79 }[species] || 13;
  for (let y = 0; y < size; y++) for (let x = 0; x < width; x++) {
    const variant = Math.floor(x / size), u = (x % size + .5) / size, v = (y + .5) / size;
    // Multiple individual leaf forms per card; pine uses slender needle fascicles.
    const rows = species === 'pine' ? 12 : species === 'ash' ? 5 : 3;
    const columns = species === 'pine' ? 5 : 3;
    const sy = v * rows, row = Math.floor(sy), ly = sy - row;
    const sx = u * columns + .22 * (row % 2) + variant * .11, lx = sx - Math.floor(sx);
    const mid = .5 + .05 * Math.sin(ly * 6 + variant);
    const dx = Math.abs(lx - mid), shape = Math.pow(Math.max(0, Math.sin(ly * Math.PI)), species === 'aspen' ? .6 : 1.1);
    const mask = clamp((shape * (species === 'pine' ? .13 : .42) - dx) * 50);
    const stem = Math.exp(-Math.pow((lx - mid) * (species === 'pine' ? 95 : 130), 2));
    const veins = Math.pow(.5 + .5 * Math.cos((ly - dx * .68) * (species === 'pine' ? 40 : 67) + variant * .8), 18) * Math.exp(-dx * 2);
    const grain = hash(x, y, seed + variant * 11) - .5;
    const cell = .5 + .5 * Math.sin(lx * 233 + Math.sin(ly * 181) * 2);
    const h = mask * (.25 * stem + .095 * veins + .012 * grain + .015 * cell);
    const i = (y * width + x) * 4;
    const tone = .91 + mask * (.025 * grain + .06 * veins + .055 * stem) + .015 * Math.sin(u * 31 + v * 49 + variant);
    rgb[i] = byte(tone * (1 + variant * .012)); rgb[i + 1] = byte(tone); rgb[i + 2] = byte(tone * (.97 - variant * .006)); rgb[i + 3] = 255;
    heights[y * width + x] = h;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < width; x++) {
    const cellStart = Math.floor(x / size) * size, at = y * width + x;
    // Never sample the neighbouring variant when differentiating normals.
    const dx = (heights[y * width + Math.min(cellStart + size - 1, x + 1)] - heights[y * width + Math.max(cellStart, x - 1)]) * 6;
    const dy = (heights[Math.min(size - 1, y + 1) * width + x] - heights[Math.max(0, y - 1) * width + x]) * 6;
    const len = Math.hypot(dx, dy, 1), i = at * 4;
    normal[i] = byte(-dx / len * .5 + .5); normal[i + 1] = byte(-dy / len * .5 + .5); normal[i + 2] = byte(1 / len * .5 + .5); normal[i + 3] = 255;
  }
  return { color: texture(rgb, width, size, 'procedural-leaf-detail-' + species), normal: texture(normal, width, size, 'procedural-leaf-normal-' + species), size, variants: 3, bytes: rgb.byteLength + normal.byteLength, provenance: 'Original procedural UV-local vein/stem modulation; source silhouette retained, not reconstructed asset anatomy.' };
}
export function createBarkDetail(quality = 'high') {
  const size = quality === 'low' ? 256 : 512, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ridge = .5 + .5 * Math.sin(u * Math.PI * 32 + Math.sin(v * Math.PI * 6) * .8 + Math.sin(v * Math.PI * 14) * .25);
    const fissure = Math.pow(1 - ridge, 7), grain = hash(x, y, 83);
    const i = (y * size + x) * 4;
    data[i] = byte(.78 + .22 * (1 - fissure)); // AO, sampled only into indirect illumination
    data[i + 1] = byte(.83 + .14 * fissure + .03 * grain); // roughness
    data[i + 2] = byte(ridge * .65 + grain * .35); // moss breakup
    data[i + 3] = 255;
  }
  return { surface: texture(data, size, size, 'procedural-bark-AO-roughness-moss', true), size, bytes: data.byteLength, provenance: 'Original procedural packed AO/Roughness/Moss. Existing bark colour/normal maps retained; not supplied EZ-Tree roughness/AO assets.' };
}
function acquire(key, build) {
  let entry = cache.get(key); if (!entry) { entry = { maps: build(), refs: 0 }; cache.set(key, entry); }
  entry.refs++; let released = false;
  return { ...entry.maps, release() { if (released) return; released = true; if (--entry.refs === 0) { for (const t of Object.values(entry.maps)) if (t?.isTexture) t.dispose(); cache.delete(key); } } };
}
export function acquireLeafDetail(species, quality = 'high') { return acquire('leaf:' + species + ':' + quality, () => createLeafDetail(species, quality)); }
export function acquireBarkDetail(quality = 'high') { return acquire('bark:' + quality, () => createBarkDetail(quality)); }
export function vegetationTextureCacheInfo() { return [...cache].map(([key, e]) => ({ key, refs: e.refs, bytes: e.maps.bytes })); }
