// Skeletons for sculpted animals: bones from joint positions, skin weights from the sculpt primitives.
import * as THREE from 'three';
import { primDist } from './sculpt.js';

// joints: [{ name, pos: [x, y, z], parent }], parents listed before children
export function makeSkeleton(joints) {
  const bones = [], byName = {};
  for (const j of joints) {
    const b = new THREE.Bone();
    b.name = j.name;
    const pp = j.parent ? joints.find((q) => q.name === j.parent).pos : [0, 0, 0];
    b.position.set(j.pos[0] - pp[0], j.pos[1] - pp[1], j.pos[2] - pp[2]);
    if (j.parent) byName[j.parent].add(b);
    b.userData.rest = b.position.clone();
    bones.push(b);
    byName[j.name] = b;
  }
  return { bones, byName, root: bones[0] };
}

// Each primitive names its bone. A vertex is weighted toward every primitive it lies on or near,
// so joints bend where the sculpt's shapes blend into each other.
export function skinGeometry(geo, sculpt, joints, tau) {
  const names = joints.map((j) => j.name);
  const primBone = sculpt.prims.map((p) => names.indexOf(p.bone));
  const p = geo.attributes.position;
  const si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
  const acc = new Float32Array(names.length);
  for (let v = 0; v < p.count; v++) {
    acc.fill(0);
    const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    for (let i = 0; i < sculpt.prims.length; i++) {
      const b = primBone[i];
      if (b < 0) continue;
      const pr = sculpt.prims[i];
      // cheap reject: far outside this primitive's bounds
      if (x < pr.bmin[0] - 4 * tau || x > pr.bmax[0] + 4 * tau || y < pr.bmin[1] - 4 * tau || y > pr.bmax[1] + 4 * tau || z < pr.bmin[2] - 4 * tau || z > pr.bmax[2] + 4 * tau) continue;
      const d = Math.max(primDist(pr, x, y, z), 0);
      acc[b] += Math.exp(-d / tau) * (pr.weight ?? 1);
    }
    // keep the four strongest bones
    const top = [];
    for (let b = 0; b < acc.length; b++) if (acc[b] > 1e-4) top.push([acc[b], b]);
    top.sort((a, c) => c[0] - a[0]);
    let sum = 0;
    for (let k = 0; k < 4 && k < top.length; k++) sum += top[k][0];
    for (let k = 0; k < 4; k++) {
      if (k < top.length && sum > 0) { si[v * 4 + k] = top[k][1]; sw[v * 4 + k] = top[k][0] / sum; }
      else { si[v * 4 + k] = 0; sw[v * 4 + k] = 0; }
    }
    if (sum === 0) { si[v * 4] = 0; sw[v * 4] = 1; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

// Two-bone limb helpers for posing
const _e = new THREE.Euler();
export function setRot(bone, x, y, z) {
  _e.set(x, y, z, 'XYZ');
  bone.quaternion.setFromEuler(_e);
}
