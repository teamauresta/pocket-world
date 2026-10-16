// Bamboo grove: clumps of jointed culms with leaf sprays, instanced across the bamboo zone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { applyWind, leafMaterial, depthMaterialFor } from './materials.js';
import { bambooLeafTexture } from './canvas.js';
import { makeSampler } from './scatter.js';

const H = 9;
const WIND = { amp: 0.4, flutter: 0.03, heightScale: H, stiff: 1.8 };

function culm(rng, base, height, radius, lean) {
  const pts = [];
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const off = lean.clone().multiplyScalar(height * (0.15 * t + 0.85 * t * t));
    pts.push(new THREE.Vector3(base.x + off.x, height * t, base.z + off.z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs * 2, radius, 5, false);
  // vertex colours: green culm with darker nodes, yellowing toward the base
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tone = 0.85 + rng() * 0.3;
  const nodeGap = 0.75 + rng() * 0.25;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / height;
    const node = Math.abs(((y / nodeGap) % 1) - 0.5) > 0.46 ? 0.55 : 1.0;
    const r = (tone > 1.06 ? 0.34 : (0.10 + 0.10 * (1 - t))) * tone * node;
    const g = (0.20 + 0.05 * t) * tone * node;
    const b = 0.035 * tone * node;
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute('uv');
  // Raised collars and pointed sheaths: geometry, no placement RNG.
  const parts=[geo]; let nodes=0;
  for(let y=nodeGap;y<height-.3;y+=nodeGap) {
    const t=y/height,center=curve.getPoint(t);
    const ring=new THREE.TorusGeometry(radius*1.11,radius*.18,3,6);
    ring.rotateX(Math.PI/2);ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangent(t)));ring.translate(center.x,center.y,center.z);
    const sheath=new THREE.ConeGeometry(radius*1.2,.22,5,1,true,0,Math.PI*1.35);sheath.translate(center.x,center.y+.055,center.z);
    for(const part of [ring,sheath]) {part.deleteAttribute('uv');const color=new Float32Array(part.attributes.position.count*3);for(let i=0;i<color.length;i+=3)color.set([.28,.26,.09],i);part.setAttribute('color',new THREE.BufferAttribute(color,3));parts.push(part);}
    nodes++;
  }
  const merged=mergeGeometries(parts);merged.userData.nodes=nodes;return {geo:merged,curve,nodeGap};
}

function leafCard(origin, dir, size, droop) {
  // Four separate lanceolate leaves, each with a visibly drooping tip.
  const parts=[],out=dir.clone().normalize(),side=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),out).normalize();
  for(let leaf=0;leaf<4;leaf++) {
    const axis=out.clone().addScaledVector(side,(leaf-1.5)*.23).normalize(),root=origin.clone().addScaledVector(out,leaf*.065*size);
    const length=size*(.75+.07*(leaf%3)),pos=[],uv=[],idx=[];
    for(let row=0;row<=3;row++) {
      const t=row/3,width=Math.sin(Math.PI*t)*size*.058,c=root.clone().addScaledVector(axis,length*t);c.y+=size*(.25*t-(.3+droop*.42)*t*t);
      for(const sign of [-1,1]){const v=c.clone().addScaledVector(side,width*sign);pos.push(v.x,v.y,v.z);}uv.push(0,t,1,t);
      if(row<3){const k=row*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();parts.push(g);
  }
  return mergeGeometries(parts);
}

export function clump(seed) {
  const rng = mulberry32(seed);
  const culms = [], leaves = [];
  const n = 10 + Math.floor(rng() * 5);
  for (let c = 0; c < n; c++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.95;
    const base = new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const lean = out.clone().multiplyScalar(0.05 + rng() * 0.1).add(new THREE.Vector3((rng() - 0.5) * 0.05, 0, (rng() - 0.5) * 0.05));
    const height = H * (0.7 + rng() * 0.35);
    const { geo, curve, nodeGap } = culm(rng, base, height, 0.047 + rng() * 0.027, lean);
    culms.push(geo);
    for (let y = height * 0.42; y < height * 0.98; y += nodeGap) {
      const t = y / height;
      const p = curve.getPoint(t);
      const k = 1 + (rng() < 0.6 ? 1 : 0);
      for (let q = 0; q < k; q++) {
        const az = rng() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).lerp(out, 0.45);
        leaves.push(leafCard(p, dir, 1.3 + rng() * 0.6 + t * 0.4, 0.25 + rng() * 0.5));
      }
    }
    // a top tuft
    const top = curve.getPoint(1);
    for (let q = 0; q < 3; q++) {
      const az = rng() * Math.PI * 2;
      leaves.push(leafCard(top, new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), 1.4 + rng() * 0.5, 0.1 + rng() * 0.3));
    }
  }
  const result={culms:mergeGeometries(culms),leaves:mergeGeometries(leaves)};
  result.culms.userData={culms:n,nodes:culms.reduce((sum,g)=>sum+g.userData.nodes,0)};result.leaves.userData={sprays:leaves.length,leavesPerSpray:4};return result;
}

export function buildBamboo(hf, hash) {
  const group = new THREE.Group();
  group.name = 'bamboo';
  const S = makeSampler(hf, 777);
  const R = S.rng;
  const variants = [clump(11), clump(23), clump(37)];
  const lists = variants.map(() => []);
  S.grid(2.6, (x, z) => {
    const p = S.at(x, z);
    if (p.h < 1.6 || p.slope > 0.45 || p.river < 0.8 || p.coast > -3) return;
    const prob = Math.min(1, p.bamboo * 1.35) * (p.h < 18 ? 1 : 0) * (1 - p.glade) * S.smoothstep(7, 1, p.d);
    if (R() > prob) return;
    if (!hash.free(x, z, 1.1)) return;
    hash.add(x, z, 1.1);
    lists[Math.floor(R() * variants.length)].push({ x, y: p.h - 0.15, z, rot: R() * Math.PI * 2, s: 0.85 + R() * 0.35 });
  });

  const culmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
  applyWind(culmMat, { amp: WIND.amp, heightScale: H, stiff: WIND.stiff });
  const leafTex = bambooLeafTexture();
  const leafMat = leafMaterial(leafTex, new THREE.Color(0.55, 0.66, 0.42), { wind: WIND, translucency: 0.35, alphaTest: 0.35 });
  const depth = depthMaterialFor(leafMat, WIND);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const col = new THREE.Color();
  let count = 0;
  variants.forEach((v, i) => {
    const list = lists[i];
    if (!list.length) return;
    const cm = new THREE.InstancedMesh(v.culms, culmMat, list.length);
    const lm = new THREE.InstancedMesh(v.leaves, leafMat, list.length);
    lm.customDepthMaterial=depth;
    cm.customDepthMaterial=depthMaterialFor(culmMat,{amp:WIND.amp,heightScale:H,stiff:WIND.stiff});
    cm.name='bamboo-culms-'+i;lm.name='bamboo-leaves-'+i;
    list.forEach((t, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      sc.set(t.s, t.s, t.s);
      pos.set(t.x, t.y, t.z);
      m4.compose(pos, q, sc);
      cm.setMatrixAt(k, m4);
      lm.setMatrixAt(k, m4);
      const b = 0.85 + R() * 0.3;
      col.setRGB(b, b * (0.95 + R() * 0.1), b * 0.9);
      lm.setColorAt(k, col);
    });
    for (const m of [cm, lm]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); }
    count += list.length;
  });
  group.userData.detail={variants:variants.map(v=>({...v.culms.userData,...v.leaves.userData})),collisionRadius:1.1};
  group.userData.stats = { count, positions: lists.flat() };
  return group;
}
