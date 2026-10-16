// Procedural tree geometry. Branching algorithm adapted from EZ-Tree by Daniel Greenheck (MIT License,
// https://github.com/dgreenheck/ez-tree); trimmed to geometry only and tuned for instancing.
import * as THREE from 'three';
import { crownAttributes, addRootGeometry } from './forest-detail.js';

class RNG {
  constructor(seed) { this.w = (123456789 + seed) & 0xffffffff; this.z = (987654321 - seed) & 0xffffffff; }
  random(max = 1, min = 0) {
    this.z = (36969 * (this.z & 65535) + (this.z >> 16)) & 0xffffffff;
    this.w = (18000 * (this.w & 65535) + (this.w >> 16)) & 0xffffffff;
    let r = ((this.z << 16) + (this.w & 65535)) >>> 0;
    r /= 4294967296;
    return (max - min) * r + min;
  }
}

const UP = new THREE.Vector3(0, 1, 0);

export function generateTree(o) {
  const rng = new RNG(o.seed);
  const B = { verts: [], normals: [], uvs: [], idx: [], hgt: [] };
  const L = { verts: [], uvs: [], idx: [] };
  const queue = [{ origin: new THREE.Vector3(), orient: new THREE.Euler(), length: o.length[0], radius: o.radius[0], level: 0, sections: o.sections[0], segments: o.segments[0] }];
  const evergreen = o.type === 'evergreen';

  const leaf = (origin, orient) => {
    const size = o.leafSize * (1 + rng.random(o.leafVar, -o.leafVar));
    const W = size, H = size;
    const make = (rot) => {
      let i = L.verts.length / 3;
      const vs = [new THREE.Vector3(-W / 2, H, 0), new THREE.Vector3(-W / 2, 0, 0), new THREE.Vector3(W / 2, 0, 0), new THREE.Vector3(W / 2, H, 0)]
        .map((v) => v.applyEuler(new THREE.Euler(0, rot, 0)).applyEuler(orient).add(origin));
      for (const v of vs) L.verts.push(v.x, v.y, v.z);
      L.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
      L.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    make(0);
    if (o.leafDouble) make(Math.PI / 2);
    if(o.detailKind==='flowering') {
      // Three smaller rosette cards at a shoot tip, not a recoloured ash crown.
      // They remain leaf-layout quads for atlas/flicker/depth compatibility.
      for(let petal=0;petal<3;petal++) {
        const angle=petal*Math.PI*2/3,center=origin.clone().add(new THREE.Vector3(Math.cos(angle)*size*.22,size*.35,Math.sin(angle)*size*.22));
        const i=L.verts.length/3;
        for(const [x,y]of [[-.18,.36],[-.18,0],[.18,0],[.18,.36]]) {
          const v=new THREE.Vector3(x*size,y*size,0).applyEuler(new THREE.Euler(.3,angle,0)).applyEuler(orient).add(center);L.verts.push(v.x,v.y,v.z);
        }
        L.uvs.push(0,1,0,0,1,0,1,1);L.idx.push(i,i+1,i+2,i,i+2,i+3);
      }
    }
  };

  while (queue.length) {
    const br = queue.shift();
    const indexOffset = B.verts.length / 3;
    const orient = br.orient.clone();
    const origin = br.origin.clone();
    const secLen = br.length / br.sections;
    const sections = [];
    for (let i = 0; i <= br.sections; i++) {
      let r = br.radius;
      if (i === br.sections && br.level === o.levels) r = 0.001;
      else if (!evergreen) r *= 1 - o.taper[br.level] * (i / br.sections);
      else r *= 1 - i / br.sections;
      let first = null;
      for (let j = 0; j < br.segments; j++) {
        const a = (2 * Math.PI * j) / br.segments;
        const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyEuler(orient).normalize();
        const v = n.clone().multiplyScalar(r).add(origin);
        B.verts.push(v.x, v.y, v.z);
        B.normals.push(n.x, n.y, n.z);
        B.uvs.push(j / br.segments, i % 2 === 0 ? 0 : 1);
        B.hgt.push(br.level);
        if (j === 0) first = { v, n };
      }
      B.verts.push(first.v.x, first.v.y, first.v.z);
      B.normals.push(first.n.x, first.n.y, first.n.z);
      B.uvs.push(1, i % 2 === 0 ? 0 : 1);
      B.hgt.push(br.level);
      sections.push({ origin: origin.clone(), orient: orient.clone(), radius: r });
      origin.add(new THREE.Vector3(0, secLen, 0).applyEuler(orient));
      const g = Math.max(1, 1 / Math.sqrt(Math.max(r, 1e-3))) * o.gnarl[br.level];
      orient.x += rng.random(g, -g);
      orient.z += rng.random(g, -g);
      const q = new THREE.Quaternion().setFromEuler(orient);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, o.twist[br.level] || 0));
      q.rotateTowards(new THREE.Quaternion().setFromUnitVectors(UP, o.force.dir), o.force.strength / Math.max(r, 1e-3));
      orient.setFromQuaternion(q);
    }
    const N = br.segments + 1;
    for (let i = 0; i < br.sections; i++) {
      for (let j = 0; j < br.segments; j++) {
        const v1 = indexOffset + i * N + j, v2 = v1 + 1, v3 = v1 + N, v4 = v2 + N;
        B.idx.push(v1, v3, v2, v2, v3, v4);
      }
    }
    if (!evergreen) {
      const last = sections[sections.length - 1];
      if (br.level < o.levels) {
        queue.push({ origin: last.origin, orient: last.orient, length: o.length[br.level + 1], radius: last.radius, level: br.level + 1, sections: br.sections, segments: br.segments });
      } else {
        leaf(last.origin, last.orient);
      }
    }
    if (br.level === o.levels) {
      const off = rng.random();
      for (let i = 0; i < o.leafCount; i++) {
        const t = rng.random(1, o.leafStart);
        const si = Math.floor(t * (sections.length - 1));
        const A = sections[si], Bs = sections[Math.min(si + 1, sections.length - 1)];
        const al = (t - si / (sections.length - 1)) * (sections.length - 1);
        const org = new THREE.Vector3().lerpVectors(A.origin, Bs.origin, al);
        const qa = new THREE.Quaternion().setFromEuler(A.orient), qb = new THREE.Quaternion().setFromEuler(Bs.orient);
        const parent = new THREE.Euler().setFromQuaternion(qb.slerp(qa, al));
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(o.leafAngle));
        const q2 = new THREE.Quaternion().setFromAxisAngle(UP, 2 * Math.PI * (off + i / o.leafCount));
        const q3 = new THREE.Quaternion().setFromEuler(parent);
        leaf(org, new THREE.Euler().setFromQuaternion(q3.multiply(q2.multiply(q1))));
      }
    } else if (br.level < o.levels) {
      const lvl = br.level + 1;
      const off = rng.random();
      const count = o.children[br.level];
      for (let i = 0; i < count; i++) {
        const t = rng.random(1, o.start[lvl]);
        const si = Math.floor(t * (sections.length - 1));
        const A = sections[si], Bs = sections[Math.min(si + 1, sections.length - 1)];
        const al = (t - si / (sections.length - 1)) * (sections.length - 1);
        const org = new THREE.Vector3().lerpVectors(A.origin, Bs.origin, al);
        const rad = o.radius[lvl] * ((1 - al) * A.radius + al * Bs.radius);
        const qa = new THREE.Quaternion().setFromEuler(A.orient), qb = new THREE.Quaternion().setFromEuler(Bs.orient);
        const parent = new THREE.Euler().setFromQuaternion(qb.slerp(qa, al));
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(o.angle[lvl]));
        const q2 = new THREE.Quaternion().setFromAxisAngle(UP, 2 * Math.PI * (off + i / count));
        const q3 = new THREE.Quaternion().setFromEuler(parent);
        const orientC = new THREE.Euler().setFromQuaternion(q3.multiply(q2.multiply(q1)));
        const len = o.length[lvl] * (evergreen ? 1 - t : 1);
        queue.push({ origin: org, orient: orientC, length: len, radius: rad, level: lvl, sections: o.sections[lvl], segments: o.segments[lvl] });
      }
    }
  }

  // normalise: base at origin, height 1
  let maxY = 0;
  for (let i = 1; i < B.verts.length; i += 3) maxY = Math.max(maxY, B.verts[i]);
  for (let i = 1; i < L.verts.length; i += 3) maxY = Math.max(maxY, L.verts[i]);
  const s = 1 / maxY;

  let bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(B.verts.map((v) => v * s), 3));
  bg.setAttribute('normal', new THREE.Float32BufferAttribute(B.normals, 3));
  const buv = [];
  for (let i = 0; i < B.uvs.length; i += 2) buv.push(B.uvs[i] * o.barkRepeat[0], B.uvs[i + 1] * o.barkRepeat[1]);
  bg.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
  bg.setIndex(B.idx);

  const lg = new THREE.BufferGeometry();
  const lv = L.verts.map((v) => v * s);
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3));
  lg.setAttribute('uv', new THREE.Float32BufferAttribute(L.uvs, 2));
  lg.setIndex(L.idx);
  // Different scaffold proportions AND a compressed upper crown distinguish
  // tropical forms. Positions/normals, not labels, change here.
  if (o.crownFlatten) for (const geometry of [bg,lg]) {
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++) if(p.getY(i)>.62) p.setY(i,.62+(p.getY(i)-.62)*o.crownFlatten);
    geometry.computeVertexNormals();
  }
  if(o.roots!==false) bg=addRootGeometry(bg,{seed:o.seed,kind:o.detailKind||'ordinary'});
  crownAttributes(lg,o.seed,o.detailKind==='flowering');
  // canopy normals: blend each card's normal toward a sphere around the crown for soft, volumetric lighting
  lg.computeVertexNormals();
  lg.computeBoundingBox();
  const c = new THREE.Vector3();
  lg.boundingBox.getCenter(c);
  const size = new THREE.Vector3();
  lg.boundingBox.getSize(size);
  c.y -= size.y * 0.15;
  const nrm = lg.attributes.normal;
  const p = lg.attributes.position;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(c);
    v.y *= 0.8;
    v.normalize();
    n.fromBufferAttribute(nrm, i);
    if (n.dot(v) < 0) n.negate();
    n.lerp(v, 0.8).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  bg.computeBoundingBox();bg.computeBoundingSphere();lg.computeBoundingSphere();
  return { branches: bg, leaves: lg, tris: (bg.index.count + lg.index.count) / 3,
    detail:{...bg.userData.roots,...lg.userData.crown,kind:o.detailKind||o.type} };
}

// Species tuned for a miniature scale and modest triangle counts
const deg = (a) => a;
export const SPECIES = {
  pine: {
    type: 'evergreen', levels: 1,
    length: [50, 19], radius: [1.0, 0.35], sections: [9, 3], segments: [6, 3],
    children: [64], angle: [0, deg(104)], start: [0, 0.14], taper: [0.7, 0.7], gnarl: [0.02, 0.05], twist: [0, 0],
    force: { dir: new THREE.Vector3(0, 1, 0), strength: -0.006 },
    leafCount: 8, leafStart: 0.0, leafAngle: 38, leafSize: 5.4, leafVar: 0.2, leafDouble: true, barkRepeat: [1, 3],
  },
  oak: {
    type: 'deciduous', levels: 3,
    length: [30, 12, 11, 7], radius: [1.5, 0.8, 0.7, 1.0], sections: [6, 4, 3, 1], segments: [6, 4, 3, 3],
    children: [5, 3, 2], angle: [0, 52, 55, 35], start: [0, 0.48, 0.1, 0.12], taper: [0.72, 0.45, 0.7, 0.75], gnarl: [0.02, -0.1, -0.15, 0.09], twist: [-0.2, 0.4, 0, 0],
    force: { dir: new THREE.Vector3(0, 1, 0), strength: -0.01 },
    leafCount: 5, leafStart: 0.15, leafAngle: 42, leafSize: 7.0, leafVar: 0.4, leafDouble: true, barkRepeat: [1, 6],
  },
  ash: {
    type: 'deciduous', levels: 3,
    length: [34, 12, 9, 6], radius: [1.25, 0.7, 0.7, 0.9], sections: [6, 4, 3, 1], segments: [6, 4, 3, 3],
    children: [6, 3, 2], angle: [0, 48, 50, 35], start: [0, 0.55, 0.15, 0.1], taper: [0.7, 0.5, 0.7, 0.75], gnarl: [0.02, 0.05, 0.1, 0.05], twist: [0.1, 0.3, 0, 0],
    force: { dir: new THREE.Vector3(0, 1, 0), strength: 0.006 },
    leafCount: 5, leafStart: 0.2, leafAngle: 45, leafSize: 6.4, leafVar: 0.35, leafDouble: true, barkRepeat: [1, 6],
  },
  birch: {
    type: 'deciduous', levels: 3,
    length: [44, 9, 7, 5], radius: [0.9, 0.5, 0.6, 0.8], sections: [7, 3, 3, 1], segments: [6, 4, 3, 3],
    children: [7, 3, 2], angle: [0, 38, 42, 30], start: [0, 0.4, 0.2, 0.1], taper: [0.75, 0.6, 0.7, 0.75], gnarl: [0.03, 0.05, 0.12, 0.05], twist: [0, 0.2, 0, 0],
    force: { dir: new THREE.Vector3(0, 1, 0), strength: 0.012 },
    leafCount: 5, leafStart: 0.2, leafAngle: 35, leafSize: 5.2, leafVar: 0.3, leafDouble: true, barkRepeat: [1, 5],
  },
  bush: {
    type: 'deciduous', levels: 2,
    length: [6, 8, 6], radius: [0.6, 0.6, 0.7], sections: [3, 3, 2], segments: [4, 3, 3],
    children: [6, 3], angle: [0, 60, 45], start: [0, 0.1, 0.2], taper: [0.7, 0.7, 0.7], gnarl: [0.1, 0.2, 0.2], twist: [0, 0, 0],
    force: { dir: new THREE.Vector3(0, 1, 0), strength: 0.02 },
    leafCount: 7, leafStart: 0.0, leafAngle: 50, leafSize: 5.0, leafVar: 0.3, leafDouble: true, barkRepeat: [1, 2],
  },
};

// Tropical architecture: long bole, high spreading scaffold, layered flat crown.
SPECIES.broadleaf={...SPECIES.ash,detailKind:'broadleaf',length:[48,17,10,7],radius:[1.65,.95,.65,.7],
  children:[5,3,2],angle:[0,72,55,38],start:[0,.69,.12,.12],gnarl:[.008,.045,.07,.06],
  leafCount:7,leafSize:7.6,crownFlatten:.78};
SPECIES.fig={...SPECIES.oak,detailKind:'fig',length:[35,20,12,7],radius:[1.8,1,.75,.8],
  children:[5,3,2],angle:[0,79,58,46],start:[0,.62,.12,.1],gnarl:[.013,.055,.065,.08],
  leafCount:7,leafSize:7.2,crownFlatten:.50};
SPECIES.flowering={...SPECIES.oak,detailKind:'flowering',length:[26,14,9,6],radius:[1.25,.7,.6,.7],
  children:[5,3,2],angle:[0,65,57,43],start:[0,.48,.14,.1],leafSize:5.6,leafCount:6,crownFlatten:.82};
