// Birds on the wing: eagles circling the peak, a flock of macaws looping over the jungle, gulls along the shore.
import * as THREE from 'three';
import { birdGeometry, BIRDS } from '../creatures/birds.js';
import { resetBirds, stepBirds, strikeBirds, birdPerchAnchor } from './bird-reactions.js';
import { mulberry32 } from '../core/noise.js';
import { U } from '../render/shared.js';
import { PEAK, fromDE } from '../world/config.js';

function flapMaterial(L, span) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  const inject = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; attribute float aSpan; attribute float aFold;
        #ifdef USE_INSTANCING
          attribute vec3 aFlap;
        #else
          const vec3 aFlap = vec3(0.0, 1.0, 1.0);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float f = abs(aSpan);
          float beat = sin(uTime * aFlap.z + aFlap.x);
          float lift = beat * aFlap.y * ${(span * 0.55).toFixed(3)} * pow(f, 1.3);
          // gliding wings keep a gentle dihedral
          transformed.y += lift + f * ${(span * 0.08).toFixed(3)} * (1.0 - aFlap.y);
          transformed.z *= 1.0 - abs(beat) * aFlap.y * 0.12 * f;
          float fold = aFold * smoothstep(0.0, 0.35, f);
          transformed.x -= abs(transformed.z) * sin(fold * 1.35) * 0.75;
          transformed.z *= cos(fold * 1.35);
          transformed.y = mix(transformed.y, ${(-L * .025).toFixed(4)}, fold * .8);
        }`);
  };
  m.onBeforeCompile = inject;
  m.customProgramCacheKey = () => 'bird-fold-v1-' + span;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = inject;
  depth.customProgramCacheKey = () => 'birddepth-fold-v1-' + span;
  return { m, depth };
}

const UP = new THREE.Vector3(0, 1, 0);
function orientTo(m4, pos, vel, bank) {
  const f = vel.clone().normalize();
  if(f.lengthSq()<.5) f.set(1,0,0);
  const z = new THREE.Vector3().crossVectors(f, UP);
  if(z.lengthSq()<1e-6)z.set(0,0,1);
  z.normalize();
  const y = new THREE.Vector3().crossVectors(z, f).normalize();
  const c = Math.cos(bank), s = Math.sin(bank);
  const y2 = y.clone().multiplyScalar(c).addScaledVector(z, s);
  const z2 = z.clone().multiplyScalar(c).addScaledVector(y, -s);
  m4.makeBasis(f, y2, z2);
  m4.setPosition(pos);
}

export class Birds {
  constructor(hf = null, perches = []) {
    this.hf=hf; this.perches=perches.filter(p=>[p.x,p.y,p.z].every(Number.isFinite));
    const rng=mulberry32(8721);
    this.group = new THREE.Group();
    this.group.name = 'birds';
    const [jx, jz] = fromDE(-6, -14);
    const [bx, bz] = fromDE(24, 0);
    this.flocks = [
      {
        key: 'eagle', n: 2, label: 'Bald eagle',
        path: (i, t) => {
          const a = t * 0.22 + i * Math.PI;
          const r = 15 + 4 * Math.sin(t * 0.07 + i * 2);
          return new THREE.Vector3(PEAK.x + 6 + Math.cos(a) * r, 28 + 3 * Math.sin(t * 0.13 + i), PEAK.z + 6 + Math.sin(a) * r);
        },
        flap: (i, t) => (Math.sin(t * 0.35 + i * 2.1) > 0.75 ? 1 : 0), freq: 6.5,
      },
      {
        key: 'macaw', n: 5, label: 'Scarlet macaw',
        path: (i, t) => {
          const tt = t * 0.16 - i * 0.05;
          const lx = Math.sin(tt) * 15, lz = Math.sin(tt * 2) * 7;
          return new THREE.Vector3(jx + lx * 0.7 - lz * 0.7 + Math.sin(i * 7.1) * 0.9, 16 + Math.sin(tt * 3 + i) * 1.5 + i * 0.25, jz + lx * 0.7 + lz * 0.7 + Math.cos(i * 5.3) * 0.9);
        },
        flap: () => 1, freq: 14,
      },
      {
        key: 'gull', n: 4, label: 'Herring gull',
        path: (i, t) => {
          const a = t * 0.13 + i * 1.6;
          return new THREE.Vector3(bx + Math.cos(a) * 17, 7 + Math.sin(t * 0.4 + i) * 1.2, bz + Math.sin(a) * 9 + Math.cos(a * 2) * 3);
        },
        flap: (i, t) => (Math.sin(t * 0.6 + i * 1.3) > 0.4 ? 1 : 0), freq: 8,
      },
    ];
    for (const f of this.flocks) {
      const geo = birdGeometry(f.key);
      const o = BIRDS[f.key];
      const { m, depth } = flapMaterial(o.L, o.span);
      const flap = new Float32Array(f.n * 3);
      for (let i = 0; i < f.n; i++) { flap[i * 3] = i * 1.7; flap[i * 3 + 1] = 1; flap[i * 3 + 2] = f.freq * (0.9 + 0.2 * rng()); }
      f.flapAttr = new THREE.InstancedBufferAttribute(flap, 3);
      f.flapAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFlap', f.flapAttr);
      f.foldAttr=new THREE.InstancedBufferAttribute(new Float32Array(f.n),1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFold',f.foldAttr);
      // Existing flight sculpt has no legs/talons: roost contact is its belly
      // support plane. Do not imply an articulated foot grip.
      geo.computeBoundingBox(); f.bottom=geo.boundingBox.min.y;
      f.mesh = new THREE.InstancedMesh(geo, m, f.n);
      f.scale = f.key === 'eagle' ? 2.1 : 1.6;
      f.mesh.customDepthMaterial = depth;
      f.mesh.castShadow = true;
      f.mesh.frustumCulled = false;
      f.mesh.userData.label = f.label;
      f.flapNow = new Float32Array(f.n);
      f.pos = Array.from({ length: f.n }, () => new THREE.Vector3());
      this.group.add(f.mesh);
    }
    this.m4 = new THREE.Matrix4();
    this.resetForTest();
  }

  resetForTest() { resetBirds(this); this.render(); }
  onStrike(event) { strikeBirds(this,event); }
  update(dt, t, env = {}) {
    if (Number.isFinite(dt) && dt > 120) throw new RangeError('Bird update exceeds bounded 120-second window');
    const elapsed = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.env=env;
    if(Number.isFinite(t))this.renderTime=t;else this.renderTime+=elapsed;
    this.clockOffset=this.renderTime-this.time-this.accumulator-elapsed;
    this.accumulator+=elapsed;
    while(this.accumulator+1e-10>=1/60){stepBirds(this,1/60,env);this.accumulator-=1/60;}
    this.render();
  }
  render() {
    for(const f of this.flocks){
      for(let i=0;i<f.n;i++){
        const a=f.agents[i];
        const p=a.mode==='perched'?birdPerchAnchor(a.perch,this.renderTime,this.env):a.p;
        f.pos[i].copy(p);orientTo(this.m4,p,a.v,a.bank);
        this.m4.scale(new THREE.Vector3(f.scale,f.scale,f.scale));f.mesh.setMatrixAt(i,this.m4);
        f.flapNow[i]=a.flap;f.flapAttr.array[i*3+1]=a.flap*(1-a.fold);f.foldAttr.array[i]=a.fold;
      }
      f.mesh.instanceMatrix.needsUpdate=true;f.flapAttr.needsUpdate=true;f.foldAttr.needsUpdate=true;
    }
  }
  snapshot() {
    return {time:this.time,agents:this.flocks.flatMap(f=>f.agents.map((a,i)=>({species:f.key,index:i,position:f.pos[i].toArray(),mode:a.mode,reason:a.reason,flightState:a.flightState,wingFold:a.fold,flap:a.flap,transitionProgress:a.transition?a.transition.elapsed/a.transition.duration:null,perch:a.perch?{x:a.perch.x,y:a.perch.y,z:a.perch.z,species:a.perch.species}:null,perchError:a.mode==='perched'?f.pos[i].distanceTo(birdPerchAnchor(a.perch,this.renderTime,this.env)):null})))};
  }
}
