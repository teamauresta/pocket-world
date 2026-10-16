// Coconut palms along the beaches: curved ringed trunks and arching fronds, leaning toward the sea.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { applyWind, leafMaterial, depthMaterialFor } from './materials.js';
import { palmFrondTexture, palmBarkTexture } from './canvas.js';
import { makeSampler } from './scatter.js';

const H = 8.5;
const WIND = { amp: 0.3, flutter: 0.05, heightScale: H, stiff: 2.0 };

function frond(origin, az, len, pitch, droop, width) {
  // a folded strip: rachis in the middle, leaflet edges dipping down
  const segs = 12;
  const pos = [], uv = [], idx = [];
  const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const p = origin.clone();
  let ang = pitch;
  const step = len / segs;
  const spine = [];
  for (let i = 0; i <= segs; i++) {
    spine.push(p.clone());
    const d = dir.clone().multiplyScalar(Math.cos(ang) * step).add(new THREE.Vector3(0, Math.sin(ang) * step, 0));
    p.add(d);
    ang -= droop / segs * (0.6 + 1.4 * (i / segs));
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = width * (i % 4 === 2 ? .69 : 1) * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * 0.5;
    const c = spine[i];
    const fold = w * 0.38;
    const l = c.clone().addScaledVector(side, -w).add(new THREE.Vector3(0, -fold, 0));
    const r = c.clone().addScaledVector(side, w).add(new THREE.Vector3(0, -fold, 0));
    pos.push(l.x, l.y, l.z, c.x, c.y + 0.02, c.z, r.x, r.y, r.z);
    uv.push(0, t, 0.5, t, 1, t);
    if (i < segs) {
      const a = i * 3;
      // Open notches in alternating outer edges; the central rachis stays connected.
      if(i%5!==2) idx.push(a,a+3,a+1);
      idx.push(a+1,a+3,a+4,a+1,a+4,a+2);
      if(i%5!==4) idx.push(a+2,a+4,a+5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // bias normals upward so the crown lights softly
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const v = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
    if (v.y < 0) v.negate();
    v.lerp(new THREE.Vector3(0, 1, 0), 0.4).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

export function palm(seed) {
  const rng = mulberry32(seed);
  const lean = 1.2 + rng() * 1.6;
  const h = H * (0.9 + rng() * 0.2);
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.15, h * 0.55, 0),
    new THREE.Vector3(lean, h, 0),
  );
  const trunk = new THREE.TubeGeometry(curve, 18, 1, 7, false);
  // taper the tube and stretch the ring texture
  const pos = trunk.attributes.position, uvA = trunk.attributes.uv;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = uvA.getX(i);
    const c = curve.getPoint(t);
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(c);
    const r = 0.2 * (1 - 0.38 * t) * (1 + 0.4 * Math.exp(-t * 30));
    tmp.multiplyScalar(r).add(c);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    uvA.setXY(i, uvA.getY(i), t * h / 1.6);
  }
  trunk.computeVertexNormals();
  const top = curve.getPoint(1);
  const fronds = [];
  const n = 10 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 + rng() * 0.3;
    const upper = i % 3 === 0;
    fronds.push(frond(top, az, 3.6 + rng() * 1.0, upper ? 0.75 : 0.35 + rng() * 0.25, upper ? 1.5 : 1.9 + rng() * 0.5, 1.5 + rng() * 0.3));
  }
  const dead=[];
  for(let i=0;i<3;i++)dead.push(frond(top.clone().add(new THREE.Vector3(0,-.18,0)),i*Math.PI*2/3+seed,2.5,-.38,1.5,.75));
  const crown=[];
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,g=new THREE.SphereGeometry(.16,6,4);g.scale(1,1.22,1);g.translate(top.x+Math.cos(a)*.32,top.y-.28-(i%2)*.15,Math.sin(a)*.32);crown.push(g);
  }
  // Tangled old leaf bases surrounding the crown junction.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,g=new THREE.ConeGeometry(.035,.62,3);g.rotateZ(.42);g.rotateY(a);g.translate(top.x+Math.cos(a)*.16,top.y-.1,Math.sin(a)*.16);crown.push(g);
  }
  const detail=mergeGeometries(crown);detail.userData={coconuts:5,fibers:12};
  return {trunk,fronds:mergeGeometries(fronds),dead:mergeGeometries(dead),detail};
}

export function buildPalms(hf, hash) {
  const group = new THREE.Group();
  group.name = 'palms';
  const S = makeSampler(hf, 909);
  const R = S.rng;
  const variants = [palm(1), palm(2), palm(3), palm(4)];
  const lists = variants.map(() => []);
  const nrm = [0, 1, 0];
  S.grid(2.2, (x, z) => {
    const p = S.at(x, z);
    if (p.h < 0.55 || p.h > 3.2 || p.slope > 0.35 || p.river < 0.8 || p.coast > -1.2 || p.coast < -9) return;
    // palms on the front beaches and the jungle shore, fewer at the back
    const front = S.smoothstep(-30, 0, p.d);
    const prob = (0.08 + 0.22 * front) * (1 - p.forest * 0.7) * (1 - p.glade * 0.5);
    if (R() > prob) return;
    if (!hash.free(x, z, 2.2)) return;
    hash.add(x, z, 2.2);
    hf.normalAt(x, z, nrm);
    // lean downhill, toward the water
    const dx = nrm[0], dz = nrm[2];
    const rot = Math.atan2(-dz, dx) + (R() - 0.5) * 0.9;
    lists[Math.floor(R() * variants.length)].push({ x, y: p.h - 0.2, z, rot, s: 0.85 + R() * 0.3 });
  });

  const bark = palmBarkTexture();
  bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
  const trunkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.9, metalness: 0 });
  applyWind(trunkMat, { amp: WIND.amp, heightScale: H, stiff: WIND.stiff });
  const frondMat = leafMaterial(palmFrondTexture(), new THREE.Color(0.68, 0.78, 0.52), { wind: WIND, translucency: 0.4, alphaTest: 0.3 });
  const depth=depthMaterialFor(frondMat,WIND);
  const deadMat=leafMaterial(palmFrondTexture(),new THREE.Color(.38,.23,.09),{wind:WIND,translucency:.12,alphaTest:.3});
  const detailMat=new THREE.MeshStandardMaterial({color:0x655232,roughness:.96});
  applyWind(detailMat,{amp:WIND.amp,heightScale:H,stiff:WIND.stiff});
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  let count = 0;
  variants.forEach((v, i) => {
    const list = lists[i];
    if (!list.length) return;
    const tm = new THREE.InstancedMesh(v.trunk, trunkMat, list.length);
    const fm = new THREE.InstancedMesh(v.fronds, frondMat, list.length);
    fm.customDepthMaterial=depth;
    tm.customDepthMaterial=depthMaterialFor(trunkMat,{amp:WIND.amp,heightScale:H,stiff:WIND.stiff});
    const dm=new THREE.InstancedMesh(v.dead,deadMat,list.length),cm=new THREE.InstancedMesh(v.detail,detailMat,list.length);
    dm.customDepthMaterial=depthMaterialFor(deadMat,WIND);cm.customDepthMaterial=depthMaterialFor(detailMat,{amp:WIND.amp,heightScale:H,stiff:WIND.stiff});
    tm.name='palm-trunk-'+i;fm.name='palm-fronds-'+i;dm.name='palm-dead-fronds-'+i;cm.name='palm-coconuts-fibers-'+i;
    list.forEach((t, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      sc.set(t.s, t.s, t.s);
      pos.set(t.x, t.y, t.z);
      m4.compose(pos, q, sc);
      tm.setMatrixAt(k, m4);
      fm.setMatrixAt(k, m4);dm.setMatrixAt(k,m4);cm.setMatrixAt(k,m4);
      const b = 0.85 + R() * 0.25;
      col.setRGB(b, b, b * (0.85 + R() * 0.2));
      fm.setColorAt(k, col);
    });
    for (const m of [tm, fm, dm, cm]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); }
    count += list.length;
  });
  group.userData.stats={count,first:lists.flat()[0],positions:lists.flat()};
  group.userData.detail={deadFronds:count*3,coconuts:count*5,fibers:count*12,collisionRadius:2.2};
  return group;
}
