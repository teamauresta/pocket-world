// Everything that swims: schools of silver fish, reef fish around their coral homes, clownfish in anemones,
// reef sharks on patrol, a manta ray and two sea turtles. Simple steering behaviours on the CPU,
// body undulation and flipper strokes in the vertex shader.
import * as THREE from 'three';
import { fishGeometry, sharkGeometry, mantaGeometry, turtleGeometry, FISH } from '../creatures/sea.js';
import { patchUnderwater, U } from '../render/shared.js';
import { mulberry32 } from '../core/noise.js';
import { measureSwimmer, safeSwimmer, setupSeaReactions, strikeSea, prepareBig, deepStormTarget } from './sea-reactions.js';
import { HALF } from '../world/config.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

// --- vertex animation chunks ----------------------------------------------------------------------------
function swimChunk(kind) {
  if (kind === 'fish') return /* glsl */ `
    {
      float s = aBody;
      float amp = uAmp * (0.12 + s * s * 1.2);
      transformed.z += sin(s * uWaves * 6.2832 - uTime * uFreq * aSwim.y + aSwim.x) * amp;
    }`;
  if (kind === 'manta') return /* glsl */ `
    {
      float w = pow(aSpan, 1.35);
      transformed.y += sin(uTime * uFreq * aSwim.y + aSwim.x - aSpan * 1.9) * uAmp * w;
      transformed.x -= abs(sin(uTime * uFreq * aSwim.y + aSwim.x - aSpan * 1.9)) * 0.12 * w;
    }`;
  return /* glsl */ `
    {
      float w = abs(aFlip);
      if (w > 0.001) {
        float sg = sign(aFlip);
        vec3 piv = vec3(0.6, -0.05, sg * 0.95);
        vec3 q = transformed - piv;
        float ph = uTime * uFreq * aSwim.y + aSwim.x;
        float ang = (sin(ph) * 0.7 + 0.15) * w * sg;
        float c = cos(ang), sn = sin(ang);
        q = vec3(q.x, q.y * c - q.z * sn, q.y * sn + q.z * c);
        float sw = cos(ph) * 0.35 * w;
        float c2 = cos(sw), s2 = sin(sw);
        q = vec3(q.x * c2 - q.z * s2 * sg, q.y, q.x * s2 * sg + q.z * c2);
        transformed = piv + q;
      }
    }`;
}

function animate(material, kind, { amp, freq, waves = 1.0 }) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uAmp = { value: amp };
    shader.uniforms.uFreq = { value: freq };
    shader.uniforms.uWaves = { value: waves };
    const attrs = kind === 'fish' ? 'attribute float aBody;' : kind === 'manta' ? 'attribute float aSpan;' : 'attribute float aFlip;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uWaves;
        ${attrs}
        #ifdef USE_INSTANCING
          attribute vec2 aSwim;
        #else
          const vec2 aSwim = vec2(0.0, 1.0);
        #endif`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + swimChunk(kind));
  };
  const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => prevKey + `anim-${kind}-${amp}-${freq}-${waves}`;
  return material;
}

function creatureMaterials(kind, opts, { rough = 0.45, metal = 0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
  mat.onBeforeCompile = (shader) => patchUnderwater(shader, { caustics: 0.8 });
  mat.customProgramCacheKey = () => 'creature-uw';
  animate(mat, kind, opts);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  animate(depth, kind, opts);
  return { mat, depth };
}

// --- environment queries ----------------------------------------------------------------------------------
class Sea {
  constructor(hf) { this.hf = hf; this.nrm = [0, 1, 0]; }
  floor(x, z) { return this.hf.heightAt(x, z); }
  // steering that keeps a swimmer inside the water and off the bottom
  contain(p, v, clearance, out) {
    const lim = HALF - 2.2;
    out.set(0, 0, 0);
    if (p.x > lim) out.x -= (p.x - lim) * 2; if (p.x < -lim) out.x += (-lim - p.x) * 2;
    if (p.z > lim) out.z -= (p.z - lim) * 2; if (p.z < -lim) out.z += (-lim - p.z) * 2;
    if (p.y > -1.1) out.y -= (p.y + 1.1) * 3;
    // look ahead along the velocity for rising ground
    const ax = p.x + v.x * 1.2, az = p.z + v.z * 1.2;
    const f = Math.max(this.floor(p.x, p.z), this.floor(ax, az));
    const gap = p.y - (f + clearance);
    if (gap < 0) {
      out.y += -gap * 3;
      this.hf.normalAt(ax, az, this.nrm);
      out.x += this.nrm[0] * -gap * 2.5;
      out.z += this.nrm[2] * -gap * 2.5;
    }
    return out;
  }
  // a random point in open water at least `minDepth` deep
  randomWater(rng, minDepth, yFrac = [0.3, 0.8], region = null) {
    for (let i = 0; i < 200; i++) {
      const x = (rng() * 2 - 1) * (HALF - 5), z = (rng() * 2 - 1) * (HALF - 5);
      if (region && !region(x, z)) continue;
      const f = this.floor(x, z);
      if (f > -minDepth) continue;
      const y = f + (-1.5 - f) * (yFrac[0] + rng() * (yFrac[1] - yFrac[0]));
      return new THREE.Vector3(x, y, z);
    }
    let best=null,depth=Infinity;
    for(let x=-HALF+6;x<HALF-6;x+=3)for(let z=-HALF+6;z<HALF-6;z+=3){const f=this.floor(x,z);if(f<depth){depth=f;best=new THREE.Vector3(x,f+(-1.5-f)*.5,z);}}
    return best||new THREE.Vector3(0,-1.5,0);
  }
}

function orient(m4, pos, vel, bank, scale) {
  const f = tmp.copy(vel).normalize();
  if (!Number.isFinite(f.x) || f.lengthSq() < 0.5) f.set(1, 0, 0);
  const z = tmp2.crossVectors(f, UP);
  if (z.lengthSq() < 1e-4) z.crossVectors(f, new THREE.Vector3(1,0,0));
  z.normalize();
  const y = new THREE.Vector3().crossVectors(z, f).normalize();
  if (bank) {
    const c = Math.cos(bank), s = Math.sin(bank);
    const y2 = y.clone().multiplyScalar(c).addScaledVector(z, s);
    const z2 = z.clone().multiplyScalar(c).addScaledVector(y, -s);
    y.copy(y2); z.copy(z2);
  }
  m4.makeBasis(f.clone().multiplyScalar(scale), y.multiplyScalar(scale), z.multiplyScalar(scale));
  m4.setPosition(pos);
}

// --- the system -------------------------------------------------------------------------------------------
export class SeaLife {
  constructor(hf, anemones = [], { quality = 'high', silverCount = null, disabledBig = [] } = {}) {
    if(silverCount!==null&&(!Number.isInteger(silverCount)||silverCount<2||silverCount>170))throw new RangeError('Invalid explicit silver population');
    if(!Array.isArray(disabledBig)||disabledBig.some(k=>!['shark','turtle'].includes(k)))throw new RangeError('Invalid replaced marine type');
    this.sea = new Sea(hf);
    this.group = new THREE.Group();
    this.group.name = 'sealife';
    this.rng = mulberry32(2024);
    this.m4 = new THREE.Matrix4();
    this.steer = new THREE.Vector3();
    this.species = [];
    this.big = [];
    const R = this.rng;

    // fish species and how many of each
    const plan = [
      { key: 'silver', count: silverCount ?? (quality === 'high' ? 170 : 110), mode: 'school' },
      { key: 'bluetang', count: 14, mode: 'reef' },
      { key: 'yellowtang', count: 16, mode: 'reef' },
      { key: 'angel', count: 6, mode: 'reef' },
      { key: 'idol', count: 8, mode: 'reef' },
      { key: 'clown', count: Math.min(anemones.length * 2, 16), mode: 'anemone' },
    ];
    for (const sp of plan) {
      const geo = fishGeometry(sp.key);
      const L = FISH[sp.key].L;
      const { mat, depth } = creatureMaterials('fish', { amp: L * 0.07, freq: sp.key === 'silver' ? 11 : 7, waves: 0.8 }, sp.key === 'silver' ? { rough: 0.28, metal: 0.4 } : { rough: 0.45 });
      const mesh = new THREE.InstancedMesh(geo, mat, sp.count);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      const swim = new Float32Array(sp.count * 2);
      const agents = [];
      // homes for reef groups
      const homes = [];
      for (let g = 0; g < Math.max(1, Math.round(sp.count / 6)); g++) homes.push(this.reefHome());
      for (let i = 0; i < sp.count; i++) {
        let home;
        if (sp.mode === 'anemone') home = anemones[Math.floor(i / 2) % anemones.length].clone();
        else if (sp.mode === 'reef') home = homes[i % homes.length];
        else home = null;
        const p = home ? home.clone().add(new THREE.Vector3((R() - 0.5) * 3, (R() - 0.5) * 1.5, (R() - 0.5) * 3)) : this.sea.randomWater(R, 9, [0.35, 0.7], (x, z) => x + z > 30);
        const ang = R() * Math.PI * 2;
        agents.push({ p, v: new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), home, speed: 1, bank: 0, scale: 0.85 + R() * 0.3 });
        swim[i * 2] = R() * 6.28;
        swim[i * 2 + 1] = 0.85 + R() * 0.3;
      }
      const attr = new THREE.InstancedBufferAttribute(swim, 2);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aSwim', attr);
      this.group.add(mesh);
      this.species.push({ ...sp, mesh, agents, swim: attr, L, metrics: measureSwimmer(geo,"fish",L*.07) });
    }

    // sharks
    this.sharks = this.makeBig(sharkGeometry(), 'fish', { amp: 0.32, freq: 3.2, waves: 0.75 }, 3, { rough: 0.5 }, (R) => ({
      p: this.sea.randomWater(R, 12, [0.3, 0.6]), speed: 2.3, turn: 0.9, clearance: 2.2, minDepth: 11, yFrac: [0.25, 0.65],
    }));
    // manta
    this.mantas = this.makeBig(mantaGeometry(), 'manta', { amp: 0.75, freq: 1.5 }, 1, { rough: 0.55 }, (R) => ({
      p: this.sea.randomWater(R, 12, [0.4, 0.7]), speed: 1.7, turn: 0.55, clearance: 2.6, minDepth: 11, yFrac: [0.35, 0.75],
    }));
    // turtles
    this.turtles = this.makeBig(turtleGeometry(), 'turtle', { amp: 1, freq: 1.9 }, 2, { rough: 0.6 }, (R) => ({
      p: this.sea.randomWater(R, 6, [0.4, 0.8]), speed: 1.1, turn: 0.6, clearance: 1.6, minDepth: 4, yFrac: [0.2, 0.9],
    }));
    // Replaced populations have no hidden/ghost simulation. Keep the named
    // entries/immutable metrics for API compatibility and preserve default setup.
    for(const key of disabledBig){const e=key==='shark'?this.sharks:this.turtles;e.agents.length=0;e.mesh.count=0;}
    const clone=a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v?.isVector3?v.clone():Array.isArray(v)?v.slice():v]));
    for(const e of [...this.species,...this.big])e.initial=e.agents.map(clone);
    this.resetForTest();
  }

  resetForTest() {
    const clone=a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v?.isVector3?v.clone():Array.isArray(v)?v.slice():v]));
    for(const e of [...this.species,...this.big])e.agents=e.initial.map(clone);
    this.rng=mulberry32(60421);this.schoolTarget=null;this.schoolCentre=null;setupSeaReactions(this);this.render(true);
  }
  onStrike(event) { strikeSea(this,event); }
  renderAgent(e,a,i, constrain = true) {
    // Keep breathing turtles level so the measured head crest, not the body origin,
    // reaches the waterline. Heading survives near-vertical ascent and descent.
    let direction=a.v;
    if(e.kind==='turtle'&&a.breathMode!=='swim') {
      a.heading ||= new THREE.Vector3(1,0,0);
      direction=a.heading;
    } else if(e.kind==='turtle'&&Math.hypot(a.v.x,a.v.z)>.01) a.heading=new THREE.Vector3(a.v.x,0,a.v.z).normalize();
    orient(this.m4,a.p,direction,e.kind==='turtle'&&a.breathMode!=='swim'?0:a.bank||0,a.scale);
    const breathing=e.kind==='turtle'&&a.breathMode!=='swim';
    const top=breathing?-a.head.y*a.scale+.03:-1.1;
    const valid=constrain?safeSwimmer(this,a,this.m4,top):!a.unavailable;
    this.m4.setPosition(a.p);
    if(!valid)this.m4.scale(new THREE.Vector3(0,0,0));
    e.mesh.setMatrixAt(i,this.m4);
    if(e.kind==='turtle')a.headWorld=a.head.clone().applyMatrix4(this.m4);
  }
  render(constrain = false) {
    for(const e of [...this.species,...this.big]){
      e.agents.forEach((a,i)=>this.renderAgent(e,a,i,constrain));e.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  snapshot() {
    return {time:this.time,agents:[...this.species,...this.big].flatMap(e=>e.agents.map((a,i)=>({species:e===this.sharks?"shark":e.key||e.kind,index:i,position:a.p.toArray(),velocity:a.v.toArray(),reason:a.reason,target:a.target?.toArray()||null,home:a.home?.toArray()||null,yFrac:a.yFrac?.slice()||null,breathMode:a.breathMode||null,breathDue:a.breathDue??null,breathHold:a.breathHold??null,breathCount:a.breathCount??null,breathTarget:a.breathTarget?.toArray()||null,headPosition:a.headWorld?.toArray()||null,bounds:a.bounds||null,boundError:a.boundError||null,unavailable:!!a.unavailable})))};
  }

  reefHome() {
    const R = this.rng;
    for (let i = 0; i < 300; i++) {
      const x = (R() * 2 - 1) * (HALF - 6), z = (R() * 2 - 1) * (HALF - 6);
      const f = this.sea.floor(x, z);
      // prefer the slope in front of the island and the reef behind the front glass
      if (f > -3.5 || f < -17) continue;
      if (x + z < 10 && R() < 0.7) continue;
      return new THREE.Vector3(x, f + 1.6 + R() * 2.2, z);
    }
    return new THREE.Vector3(30, -8, 30);
  }

  makeBig(geo, kind, anim, count, matOpts, init) {
    const { mat, depth } = creatureMaterials(kind, anim, matOpts);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.customDepthMaterial = depth;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const swim = new Float32Array(count * 2);
    const agents = [];
    for (let i = 0; i < count; i++) {
      const a = init(this.rng);
      a.v = new THREE.Vector3(this.rng() - 0.5, 0, this.rng() - 0.5).normalize().multiplyScalar(a.speed);
      a.target = this.sea.randomWater(this.rng, a.minDepth, a.yFrac);
      a.bank = 0;
      a.scale = 0.92 + this.rng() * 0.16;
      agents.push(a);
      swim[i * 2] = this.rng() * 6.28;
      swim[i * 2 + 1] = 0.9 + this.rng() * 0.2;
    }
    geo.setAttribute('aSwim', new THREE.InstancedBufferAttribute(swim, 2));
    this.group.add(mesh);
    const entry = { mesh, agents, kind, metrics: measureSwimmer(geo,kind,anim.amp) };
    this.big.push(entry);
    return entry;
  }

  // ------------------------------------------------------------------ per-frame update
  update(dt, env = {}) {
    if (Number.isFinite(dt) && dt > 120) throw new RangeError('Sea update exceeds bounded 120-second window');
    this.env=env;
    if(Number.isFinite(dt)&&dt>0)this.accumulator+=dt;
    while(this.accumulator+1e-10>=1/60){
      this.time+=1/60;
      for(const sp of this.species)this.updateFish(sp,1/60,this.sharks.agents);
      for(const e of this.big)this.updateBig(e,1/60);
      this.accumulator-=1/60;
    }
    this.render();
  }

  updateFish(sp, dt, sharks) {
    const A = sp.agents;
    const n = A.length;
    if(!n)return;
    const school = sp.mode === 'school';
    const maxSpeed = school ? 3.2 : sp.mode === 'anemone' ? 0.7 : 1.4;
    const cruise = school ? 2.1 : sp.mode === 'anemone' ? 0.35 : 0.75;
    const sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3(), acc = new THREE.Vector3(), d = new THREE.Vector3();
    // the school's wandering centre
    if (school) {
      if (!this.schoolTarget || this.schoolTarget.distanceTo(this.schoolCentre || this.schoolTarget) < 6 || this.rng() < 0.002) {
        this.schoolTarget = this.sea.randomWater(this.rng, 10, [0.3, 0.7]);
      }
      this.schoolCentre = this.schoolCentre || new THREE.Vector3();
      this.schoolCentre.set(0, 0, 0);
      for (const a of A) this.schoolCentre.add(a.p);
      this.schoolCentre.multiplyScalar(1 / n);
    }
    for (let i = 0; i < n; i++) {
      const a = A[i];
      acc.set(0, 0, 0);
      if (school) {
        sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0);
        let cnt = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const b = A[j];
          d.subVectors(a.p, b.p);
          const d2 = d.lengthSq();
          if (d2 > 9) continue;
          if (d2 < 0.5) sep.addScaledVector(d, 1 / Math.max(d2, 0.05));
          ali.add(b.v); coh.add(b.p); cnt++;
        }
        if (cnt) {
          ali.multiplyScalar(1 / cnt).sub(a.v).multiplyScalar(0.9);
          coh.multiplyScalar(1 / cnt).sub(a.p).multiplyScalar(0.6);
          acc.add(ali).add(coh);
        }
        acc.addScaledVector(sep, 1.2);
        d.subVectors(this.schoolTarget, a.p);
        acc.addScaledVector(d.normalize(), 0.9);
      } else {
        // drift around home with a gentle random walk
        d.subVectors(a.home, a.p);
        const dist = d.length();
        const radius = (this.env.night||0)>.55 ? .35 : sp.mode === 'anemone' ? .6 : 3.2;
        acc.addScaledVector(d, dist > radius ? ((this.env.night||0)>.55 ? 2.4 : .5) : .08);
        a.wander = a.wander || new THREE.Vector3();
        a.wander.x += (this.rng() - 0.5) * 2.5 * dt; a.wander.y += (this.rng() - 0.5) * 1.2 * dt; a.wander.z += (this.rng() - 0.5) * 2.5 * dt;
        a.wander.clampLength(0, 1);
        acc.addScaledVector(a.wander, (this.env.night||0)>.55 ? .06 : .6);
      }
      a.reason=this.time<a.dartUntil?"lightning":!school&&(this.env.night||0)>.55?"night-home":"normal";
      if(this.time<a.dartUntil)acc.add(a.dart);
      // scatter from sharks
      for (const s of sharks) {
        d.subVectors(a.p, s.p);
        const d2 = d.lengthSq();
        if (d2 < 49) acc.addScaledVector(d.normalize(), (49 - d2) / 49 * 9);
      }
      acc.add(this.sea.contain(a.p, a.v, sp.mode === 'anemone' ? 0.25 : 0.8, this.steer).multiplyScalar(2));
      a.v.addScaledVector(acc, dt);
      // speed regulation
      let sp2 = a.v.length();
      const target = Math.max(!school&&(this.env.night||0)>.55?.08:cruise, Math.min(maxSpeed, sp2));
      if (sp2 > 1e-4) a.v.multiplyScalar(THREE.MathUtils.lerp(sp2, target, 0.05) / sp2);
      a.v.y *= this.time<a.dartUntil?1:0.97;
      sp2 = a.v.length();
      if (sp2 > maxSpeed) a.v.multiplyScalar(maxSpeed / sp2);
      a.p.addScaledVector(a.v, dt);
      // swim speed drives the tail beat
      sp.swim.array[i * 2 + 1] = 0.55 + a.v.length() / maxSpeed * 0.9;
      this.renderAgent(sp,a,i);
    }
    sp.mesh.instanceMatrix.needsUpdate = true;
    sp.swim.needsUpdate = true;
  }

  updateBig(e, dt) {
    const A=e.agents;
    for(let i=0;i<A.length;i++){
      const a=A[i];prepareBig(this,e,a,dt);
      if(a.unavailable)continue;
      const breathing=e.kind==='turtle'&&a.breathMode!=='swim';
      const speed=a.speed*(this.time<a.burstUntil?1.85:1);
      const d=new THREE.Vector3().subVectors(a.target,a.p);
      if(!breathing&&a.reason!=='night-rest'&&d.length()<4){a.target=(a.storm?deepStormTarget(this,a):null)||this.sea.randomWater(this.rng,a.minDepth,a.yFrac);d.subVectors(a.target,a.p);}
      const desired=d.clone().normalize().multiplyScalar(breathing?Math.min(speed*1.5,d.length()*2):a.reason==='night-rest'?Math.min(speed,d.length()):speed);
      if(a.storm && e.kind!=='turtle'){
        const floor=this.sea.floor(a.p.x,a.p.z),fraction=(a.yFrac[0]+a.yFrac[1])*.5;
        const depth=floor+(-1.5-floor)*fraction;
        desired.y=Math.min(desired.y,THREE.MathUtils.clamp((depth-a.p.y)*.7,-speed*.4,speed*.4));
      }
      if(a.breathMode==='hold')desired.set(0,0,0);
      const steer=desired.sub(a.v).multiplyScalar(breathing?4:a.turn);
      if(!breathing)steer.add(this.sea.contain(a.p,a.v,a.clearance,this.steer).multiplyScalar(1.5));
      if(!breathing)for(const o of A){if(o===a)continue;const dd=new THREE.Vector3().subVectors(a.p,o.p),l2=dd.lengthSq();if(l2<36)steer.addScaledVector(dd.normalize(),(36-l2)/36*2);}
      const prevYaw=Math.atan2(a.v.z,a.v.x);
      a.v.addScaledVector(steer,dt);
      if(!breathing){a.v.y=THREE.MathUtils.clamp(a.v.y,-speed*.4,speed*.4);const l=a.v.length();if(l>0&&a.reason!=='night-rest')a.v.multiplyScalar(THREE.MathUtils.lerp(l,speed,.05)/l);}
      a.p.addScaledVector(a.v,dt);
      let dyaw=Math.atan2(a.v.z,a.v.x)-prevYaw;if(dyaw>Math.PI)dyaw-=Math.PI*2;if(dyaw<-Math.PI)dyaw+=Math.PI*2;
      a.bank=THREE.MathUtils.lerp(a.bank,THREE.MathUtils.clamp(-dyaw/dt*.35,-.5,.5),.05);
      this.renderAgent(e,a,i);
    }
    e.mesh.instanceMatrix.needsUpdate=true;
  }
}
