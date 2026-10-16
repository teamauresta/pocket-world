import { Vector2, Vector3, Matrix4, Box3 } from 'three';
// Every segment (including diagonal grid edges and path shortcuts) is swept.
export function clearSegment(ok, a, b, spacing = .3) {
  const n = Math.max(1, Math.ceil(a.distanceTo(b) / spacing));
  for (let i = 0; i <= n; i++) if (!ok(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
  return true;
}
export function landRoute(ok, start, goal, { step = 1.25, limit = 1800, bounds = 49 } = {}) {
  if (![start.x, start.y, goal.x, goal.y].every(Number.isFinite) || !ok(start.x, start.y) || !ok(goal.x, goal.y)) return null;
  if (clearSegment(ok, start, goal)) return [goal.clone()];
  const key = (x, y) => x + ',' + y;
  const first = { x: 0, y: 0, p: start.clone(), g: 0, f: start.distanceTo(goal), prev: null };
  const open = [first], best = new Map([[key(0, 0), 0]]);
  let found = null, visits = 0;
  while (open.length && visits++ < limit) {
    let index = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[index].f) index = i;
    const n = open.splice(index, 1)[0];
    if (n.g !== best.get(key(n.x, n.y))) continue;
    if (n.p.distanceTo(goal) < step * 1.5 && clearSegment(ok, n.p, goal)) { found = n; break; }
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      if (!x && !y) continue;
      const p = new Vector2(start.x + (n.x + x) * step, start.y + (n.y + y) * step);
      if (Math.abs(p.x) > bounds || Math.abs(p.y) > bounds) continue;
      const g = n.g + Math.hypot(x, y) * step, k = key(n.x + x, n.y + y);
      if (g >= (best.get(k) ?? Infinity) || !clearSegment(ok, n.p, p)) continue;
      best.set(k, g); open.push({ x: n.x + x, y: n.y + y, p, g, f: g + p.distanceTo(goal), prev: n });
    }
  }
  if (!found) return null;
  const raw = [goal.clone()]; for (let n = found; n; n = n.prev) raw.unshift(n.p);
  const route = []; let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1; while (j > i + 1 && !clearSegment(ok, raw[i], raw[j])) j--;
    route.push(raw[j].clone()); i = j;
  }
  return route;
}
// Radial destinations miss safe bends around a trunk. Every edge/shortcut
// uses the original safety predicate. Exhaustion describes the bounded local
// grid, not the whole island or an exhaustive continuous-mesh proof.
export function reachableEscape(ok, start, source, { step = .35, limit = 2500, range = 15 } = {}) {
  const away = start.clone().sub(source);
  if (!ok(start.x, start.y) || away.lengthSq() < 1e-10) return null;
  away.normalize();
  const first = { x: 0, z: 0, p: start.clone(), prev: null };
  const queue = [first], seen = new Set(['0,0']), valid = new Map();
  let head = 0, best = first, gain = 0;
  while (head < queue.length && head < limit) {
    const node = queue[head++], score = node.p.clone().sub(start).dot(away);
    if (score > gain) { gain = score; best = node; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const x = node.x + dx, z = node.z + dz, key = x + ',' + z;
      if (Math.abs(x * step) > range || Math.abs(z * step) > range || seen.has(key)) continue;
      const p = start.clone().add(new Vector2(x * step, z * step));
      if (!valid.has(key)) valid.set(key, ok(p.x, p.y));
      if (!valid.get(key)) { seen.add(key); continue; }
      if (!clearSegment(ok, node.p, p, step / 2)) continue;
      seen.add(key); queue.push({ x, z, p, prev: node });
    }
  }
  const raw = []; for (let n = best; n; n = n.prev) raw.unshift(n.p);
  const path = [];
  for (let i = 0; i < raw.length - 1;) {
    let j = raw.length - 1;
    while (j > i + 1 && !clearSegment(ok, raw[i], raw[j], step / 2)) j--;
    path.push(raw[j].clone()); i = j;
  }
  return { target: best.p.clone(), path, gain, visited: head, exhausted: head >= queue.length, range, step };
}
// Only actual vegetation records with tree/bamboo-sized radii. Small bushes,
// ferns and groundcover are not shelter. Caller must pass a pre-rock clone.
export function coverRecords(hash) {
  if (!hash?.map) return [];
  return [...hash.map.values()].flat().filter(p => p.length >= 3 && p.every(Number.isFinite) && p[2] >= 1.05)
    .map(([x, z, r]) => {
      const envelope = hash.canopies?.find(c => Math.hypot(c.x-x,c.z-z)<.05);
      return { x, z, r, ...(envelope ? { envelope: { ...envelope } } : {}) };
    }).filter(c => !hash.canopies || c.envelope);
}
export function shelterCandidates(records, home, radius, clearance, ok) {
  const points = [];
  for (const tree of records) {
    if (Math.hypot(tree.x - home.x, tree.z - home.y) > radius + 7) continue;
    // The hash radius is a collision exclusion, not a measured canopy radius.
    // Points lie just outside it, <=2 units from its edge (not inside trunks).
    const distance = tree.r + clearance + .15;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, p = new Vector2(tree.x + Math.cos(a) * distance, tree.z + Math.sin(a) * distance);
      const box = tree.envelope;
      // A measured leaf envelope takes precedence over the legacy radius proxy.
      const inside = !box || (p.x >= box.minX && p.x <= box.maxX && p.y >= box.minZ && p.y <= box.maxZ);
      if (inside && p.distanceTo(home) <= radius + 5 && ok(p.x, p.y)) points.push({ p, tree });
    }
  }
  return points;
}

// Parent wiring: annotateCoverCanopies(preRockHash, [bamboo, trees, palms]).
// Uses actual leaf/frond instance geometry bounds, not a guessed trunk radius.
// Alpha-tested foliage has gaps: this is a canopy ENVELOPE, not rainfall occlusion.
export function annotateCoverCanopies(hash, groups) {
  const canopies = [], local = new Matrix4(), world = new Matrix4(), origin = new Vector3();
  for (const group of groups) {
    if (!group) continue;
    group.updateWorldMatrix(true, true);
    group.traverse(mesh => {
      if (!mesh.isInstancedMesh || !mesh.material?.alphaTest || !mesh.geometry?.attributes.position) return;
      mesh.geometry.computeBoundingBox();
      for (let i=0;i<mesh.count;i++) {
        mesh.getMatrixAt(i, local);world.multiplyMatrices(mesh.matrixWorld, local);origin.set(0,0,0).applyMatrix4(world);
        const box = new Box3().copy(mesh.geometry.boundingBox).applyMatrix4(world);
        canopies.push({ x: origin.x, z: origin.z, minX: box.min.x, maxX: box.max.x,
          minZ: box.min.z, maxZ: box.max.z, minY: box.min.y, maxY: box.max.y, source: 'leaf-instance-bounds' });
      }
    });
  }
  hash.canopies = canopies;
  return hash;
}
