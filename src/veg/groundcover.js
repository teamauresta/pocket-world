// Grass tufts, wildflowers, ferns and big jungle leaves. Small things fade out with distance to save work.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { applyWind, leafMaterial, depthMaterialFor } from './materials.js';
import { fernTexture, bigLeafTexture } from './canvas.js';
import { makeSampler } from './scatter.js';
import { buildForestFloor } from './forest-floor.js';
import { U } from '../render/shared.js';

// shrink instances to nothing beyond a camera distance (vertex stage)
const detailViewer = { value: new THREE.Vector3(0, 80, 100) };
export function applyDistanceFade(material, near, far) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (prev) prev.call(material,shader,r);
    shader.uniforms.uDetailViewer=detailViewer;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uDetailViewer;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      {
        vec3 ib = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
        float fd = 1.0 - smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, distance(ib, uDetailViewer));
        transformed *= fd;
      }
      #endif`);
  };
  // Shadow casters set this same uniform from onBeforeShadow (viewer camera).
  // Color-only decoration refreshes it here too.
  const prevRender=material.onBeforeRender;
  material.onBeforeRender=function(renderer,scene,camera,...args){
    if(prevRender)prevRender.call(this,renderer,scene,camera,...args);
    if(!this.isMeshDepthMaterial&&!this.isMeshDistanceMaterial)camera.getWorldPosition(detailViewer.value);
  };
  const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => prevKey + `fade${near}-${far}`;
  return material;
}

export function tuft(seed) {
  const rng = mulberry32(seed);
  const blades = [];
  const n = 16;
  for (let b = 0; b < n; b++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.35;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    const h = 0.45 + rng() * 0.4;
    const w = 0.05 + rng() * 0.03;
    const lean = 0.15 + rng() * 0.35, la = a + (rng() - 0.5) * 1.2;
    const lx = Math.cos(la), lz = Math.sin(la);
    const sx = -lz, sz = lx;
    const pos = [], col = [], idx = [];
    const rows = 3;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const ww = w * (1 - t * 0.92);
      const off = lean * t * t * h;
      const cx = bx + lx * off, cz = bz + lz * off, cy = h * t;
      pos.push(cx - sx * ww, cy, cz - sz * ww, cx + sx * ww, cy, cz + sz * ww);
      const g = 0.35 + 0.65 * t;
      const dry=t>.7 && b%3===0, rgb=dry?[.76,.59,.28]:[g*.7,g,g*.55];col.push(...rgb,...rgb);
      if (i < rows) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const nn = [];
    for (let i = 0; i < pos.length / 3; i++) nn.push(lx * 0.25, 1, lz * 0.25);
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    geo.setIndex(idx);
    blades.push(geo);
  }
  const geometry=mergeGeometries(blades);geometry.userData.blades=n;return geometry;
}

function coloredGeometry(g, color) {
  g.deleteAttribute('uv');const c=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<c.length;i+=3)c.set(color,i);g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;
}

export function flower(seed, species='daisy') {
  const rng=mulberry32(seed),parts=[];
  for(let stem=0;stem<3;stem++) {
    const a=rng()*Math.PI*2,rr=rng()*.25,h=.55+rng()*.45,tilt=(rng()-.5)*.25;
    const base=new THREE.Vector3(Math.cos(a)*rr,0,Math.sin(a)*rr),top=base.clone().add(new THREE.Vector3(tilt,h,tilt*.5));
    const curve=new THREE.QuadraticBezierCurve3(base,base.clone().lerp(top,.5).add(new THREE.Vector3(.06,0,0)),top);
    parts.push(coloredGeometry(new THREE.TubeGeometry(curve,3,.012,3,false),[.18,.35,.08]));
    if(species==='daisy') {
      for(let i=0;i<8;i++){
        const az=i*Math.PI/4,dir=new THREE.Vector3(Math.cos(az),0,Math.sin(az)),side=new THREE.Vector3(-dir.z,0,dir.x);
        const vertices=[top.clone().addScaledVector(dir,.035),top.clone().addScaledVector(dir,.13).addScaledVector(side,.052),top.clone().addScaledVector(dir,.22).add(new THREE.Vector3(0,-.035,0)),top.clone().addScaledVector(dir,.13).addScaledVector(side,-.052)];
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(v=>v.toArray()),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();parts.push(coloredGeometry(g,[.95,.93,.82]));
      }
      const center=new THREE.SphereGeometry(.055,6,3);center.scale(1,.5,1);center.translate(top.x,top.y+.01,top.z);parts.push(coloredGeometry(center,[.95,.58,.05]));
    } else if(species==='bell') {
      // Hollow, downward-facing bell with a flared scalloped mouth.
      const pos=[],idx=[];
      for(let row=0;row<3;row++)for(let i=0;i<10;i++){
        const az=i*Math.PI/5,r=[.025,.09,.12][row];pos.push(top.x+Math.cos(az)*r,top.y-row*.09-(row===2?(i%2)*.03:0),top.z+Math.sin(az)*r);
        if(row<2){const k=row*10+i,next=row*10+(i+1)%10;idx.push(k,next,k+10,next,next+10,k+10);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();parts.push(coloredGeometry(g,[.55,.35,.85]));
    } else {
      for(let i=0;i<7;i++){
        const az=i*2.4,r=i===0?0:.1,g=new THREE.SphereGeometry(.047,5,3);g.scale(1,.72,1);g.translate(top.x+Math.cos(az)*r,top.y+(i===0?.05:0),top.z+Math.sin(az)*r);parts.push(coloredGeometry(g,[.88,.56,.66]));
      }
    }
  }
  const geometry=mergeGeometries(parts);geometry.userData={species,stems:3};return geometry;
}

export function cardPlant(seed, count, len, width, arch, rise) {
  const rng = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const az = (i / count) * Math.PI * 2 + rng() * 0.5;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const L = len * (0.8 + rng() * 0.4);
    const segs = 7;
    const pos = [], uv = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Tangent-matched inward/upward tip; last two sampled segments return.
      const join=4/7,curl=arch>.6?Math.max(0,(t-join)/(1-join)):0;
      const baseY=u=>rise*L*Math.sin(u*Math.PI*.9)*(1-arch*u);
      let radial=L*t*.85,y=baseY(t);
      if(curl>0){
        const dy=rise*(Math.PI*.9*Math.cos(join*Math.PI*.9)*(1-arch*join)-arch*Math.sin(join*Math.PI*.9));
        const tangent=Math.atan2(dy,.85),turn=Math.PI*1.38,radius=.09*L;
        radial=L*join*.85+radius*(Math.sin(tangent+turn*curl)-Math.sin(tangent));
        y=baseY(join)+radius*(Math.cos(tangent)-Math.cos(tangent+turn*curl));
      }
      const out = dir.clone().multiplyScalar(radial);
      const c = out.add(new THREE.Vector3(0, y, 0));
      const w = width * 0.5 * (1-.75*curl);
      pos.push(c.x - side.x * w, c.y, c.z - side.z * w, c.x + side.x * w, c.y, c.z + side.z * w);
      uv.push(0, 1 - t, 1, 1 - t);
      if (s < segs) { const k = s * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(n.getX(k), n.getY(k), n.getZ(k));
      if (v.y < 0) v.negate();
      v.lerp(new THREE.Vector3(0, 1, 0), 0.5).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function instanced(geo, mat, list, R, colorFn) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  list.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    sc.set(t.s, t.sy ?? t.s, t.s);
    p.set(t.x, t.y, t.z);
    m4.compose(p, q, sc);
    m.setMatrixAt(i, m4);
    if (colorFn) { colorFn(t, c, R); m.setColorAt(i, c); }
  });
  m.computeBoundingSphere();
  return m;
}

const FLOWER_COLORS = [[0.95, 0.95, 0.92], [1.0, 0.82, 0.12], [0.62, 0.38, 0.95], [0.95, 0.45, 0.62], [0.45, 0.55, 1.0], [0.98, 0.98, 0.98]];

export function buildGroundcover(hf, hash, { quality = 'high', density } = {}) {
  // Private spacing inventory; soft plants must never enter caller navigation.
  const solidHash=hash;
  hash=new (solidHash.constructor)(solidHash.cell);
  for(const list of solidHash.map.values())for(const [x,z,r]of list)hash.add(x,z,r);
  const keep = density ?? (quality === 'high' ? 1 : 0.55);
  const group = new THREE.Group();
  group.name = 'groundcover';
  const S = makeSampler(hf, 5150);
  const R = S.rng;
  const grass = [], flowers = [], ferns = [], bigleaf = [];
  const detailR=mulberry32(75150);

  S.grid(0.95, (x, z) => {
    const p = S.at(x, z);
    if (p.h < 0.9 || p.slope > 0.5 || p.river < 0.25 || p.h > 20) return;
    const open = p.meadow * 0.9 + p.glade * 0.8 + p.bamboo * 0.25 + p.jungle * 0.3 + p.forest * 0.12 + (p.river < 2.5 ? 0.5 : 0);
    if (R() < Math.min(0.9, open) * keep) {
      const tone = p.meadow + p.glade * 0.4;
      grass.push({ x, y: p.h - 0.05, z, rot: R() * 6.283, s: 0.8 + R() * 0.6, sy: 0.55 + R() * 0.55 + tone * 0.2, tone, jungle: p.jungle });
    }
    // Bounded riparian enrichment, outside glades and the wetted bank.
    if(p.river>1.2&&p.river<3.2&&p.glade<.03&&p.coast< -3&&p.slope<.16&&detailR()<.22*keep){
      grass.push({x,y:p.h-.04,z,rot:detailR()*6.283,s:.72+detailR()*.25,sy:.75+detailR()*.3,tone:p.meadow,jungle:p.jungle});
    }
    const fl = (p.meadow * 0.38 + p.glade * 0.3 + (p.river < 3 ? 0.15 : 0)) * S.smoothstep(1.4, 2.4, p.h);
    if (R() < fl) flowers.push({ x: x + (R() - 0.5) * 0.6, y: p.h - 0.03, z: z + (R() - 0.5) * 0.6, rot: R() * 6.283, s: 0.7 + R() * 0.5, c: Math.floor(R() * FLOWER_COLORS.length) });
  });
  S.grid(2.0, (x, z) => {
    const p = S.at(x, z);
    if (p.h < 1.4 || p.slope > 0.5 || p.river < 0.3 || p.h > 19) return;
    const fp = (p.forest * 0.35 + p.jungle * 0.45 + p.bamboo * 0.25 + (p.river < 2.5 ? 0.45 : 0)) * (1 - p.glade * 0.7);
    if (R() < fp && hash.free(x, z, 0.5)) {
      hash.add(x, z, 0.5);
      ferns.push({ x, y: p.h - 0.05, z, rot: R() * 6.283, s: 0.8 + R() * 0.7 });
    }
    const bp = p.jungle * 0.32 * (1 - p.glade);
    if (R() < bp && hash.free(x, z, 0.8)) {
      hash.add(x, z, 0.8);
      bigleaf.push({ x, y: p.h - 0.05, z, rot: R() * 6.283, s: 0.9 + R() * 0.6 });
    }
  });

  // grass
  const gMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
  applyWind(gMat, { amp: 0.09, heightScale: 1, stiff: 1.6 });
  applyDistanceFade(gMat, 70, 150);
  const gGeos = [tuft(1), tuft(2), tuft(3)];
  const gl = [[], [], []];
  grass.forEach((t) => gl[Math.floor(R() * 3)].push(t));
  gl.forEach((list, i) => {
    if (!list.length) return;
    const m = instanced(gGeos[i], gMat, list, R, (t, c, r) => {
      const v = 0.75 + r() * 0.35;
      const mead = Math.min(1, t.tone);
      c.setRGB((0.18 + 0.16 * mead - 0.08 * t.jungle) * v, (0.30 + 0.06 * mead) * v, (0.07 - 0.02 * mead) * v);
    });
    m.name='grass-'+i;m.receiveShadow=true;
    group.add(m);
  });

  // flowers
  const fMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7, metalness: 0 });
  applyWind(fMat, { amp: 0.07, heightScale: 1, stiff: 1.5 });
  applyDistanceFade(fMat, 90, 180);
  const fGeos = [flower(5,'daisy'),flower(6,'bell'),flower(7,'cluster')];
  const fl = [[], [], []];
  flowers.forEach((t) => fl[Math.floor(R() * 3)].push(t));
  fl.forEach((list, i) => {
    if (!list.length) return;
    const m = instanced(fGeos[i],fMat,list,R,(t,c)=>c.setRGB(.88+.02*t.c,.88+.02*t.c,.88+.02*t.c));
    m.name='flowers-'+fGeos[i].userData.species;
    m.receiveShadow = true;
    group.add(m);
  });

  // ferns
  const fernWind = { amp: 0.06, flutter: 0.01, heightScale: 1, stiff: 1.3 };
  const fernMat = leafMaterial(fernTexture(), new THREE.Color(0.75, 0.9, 0.6), { wind: fernWind, translucency: 0.4, alphaTest: 0.4 });
  applyDistanceFade(fernMat, 110, 200);
  const fernGeo = cardPlant(3, 8, 1.4, 0.55, 0.7, 0.55);
  if (ferns.length) {
    const m = instanced(fernGeo, fernMat, ferns, R, (t, c, r) => { const v = 0.75 + r() * 0.35; c.setRGB(v * 0.9, v, v * 0.85); });
    m.name='ferns';m.receiveShadow=true;
    group.add(m);
  }

  // big jungle leaves
  const blWind = { amp: 0.08, flutter: 0.015, heightScale: 1.5, stiff: 1.3 };
  const blMat = leafMaterial(bigLeafTexture(), new THREE.Color(0.85, 1.0, 0.8), { wind: blWind, translucency: 0.5, alphaTest: 0.4 });
  applyDistanceFade(blMat,80,150);
  const blGeo = cardPlant(9, 6, 1.7, 0.9, 0.45, 0.75);
  if (bigleaf.length) {
    const m = instanced(blGeo, blMat, bigleaf, R, (t, c, r) => { const v = 0.8 + r() * 0.3; c.setRGB(v * 0.9, v, v * 0.8); });
    m.castShadow = true;
    m.receiveShadow = true;
    m.customDepthMaterial=applyDistanceFade(depthMaterialFor(blMat,blWind),80,150);
    m.name='jungle-leaves';
    m.onBeforeShadow=(renderer,object,camera)=>camera.getWorldPosition(detailViewer.value);
    group.add(m);
  }

  group.add(buildForestFloor(hf,solidHash,{quality,applyFade:applyDistanceFade}));
  group.userData.detail={bladesPerTuft:16,flowerSpecies:['daisy','bell','cluster'],collisionRecordsAdded:0,grassTrianglesPerInstance:96,placements:{grass,flowers,ferns,bigleaf}};
  group.userData.stats = { grass: grass.length, flowers: flowers.length, ferns: ferns.length, bigleaf: bigleaf.length };
  return group;
}

export { U };
