import * as THREE from 'three';
import { buildAnimal } from '../creatures/land.js';
import { createAnimalMaterial, attachAnimalDetail } from '../creatures/animal-surface.js';
import { ANIMAL_DETAIL_BUDGET } from '../creatures/detail-contract.js';
import { makeSkeleton } from '../creatures/rig.js';
import { pose } from '../creatures/gait.js';
import { LandMotion, MOTION_STEP, wrapAngle } from '../creatures/motion.js';
import { clearSegment, landRoute, coverRecords, shelterCandidates, reachableEscape } from './land-navigation.js';
import { GLADES, fromDE } from '../world/config.js';
import { mulberry32 } from '../core/noise.js';
const clamp = THREE.MathUtils.clamp;
const deer = a => ['stag', 'doe', 'fawn'].includes(a.r.key);
const ROSTER = [
  { key: 'tiger', home: 'jungle', n: 2, speed: 1.25, scale: 1.8, roam: 1.6, acts: [['lie', 0.35], ['idle', 0.25], ['walk', 0.4]], name: 'Bengal tiger' },
  { key: 'stag', home: 'meadow', n: 1, speed: 1.15, scale: 1.75, roam: 1.0, acts: [['graze', 0.45], ['idle', 0.2], ['walk', 0.35]], name: 'Sika deer (stag)' },
  { key: 'doe', home: 'meadow', n: 2, speed: 1.15, scale: 1.6, roam: 1.0, acts: [['graze', 0.5], ['idle', 0.15], ['walk', 0.35]], name: 'Sika deer (doe)' },
  { key: 'fawn', home: 'meadow', n: 2, speed: 1.1, scale: 1.05, roam: 0.9, acts: [['graze', 0.35], ['idle', 0.25], ['walk', 0.4]], name: 'Sika deer (fawn)' },
  { key: 'bear', home: 'riverside', n: 2, speed: 1.0, scale: 1.7, roam: 1.5, acts: [['graze', 0.4], ['idle', 0.2], ['walk', 0.4]], name: 'Brown bear' },
  { key: 'panda', home: 'bamboo', n: 3, speed: 0.7, scale: 1.6, roam: 1.25, acts: [['sit', 0.6], ['lie', 0.1], ['walk', 0.3]], name: 'Giant panda' },
];


export function normalizeFurBudget(value) {
  if(value===null||value===undefined)return null;
  if(typeof value!=='object'||Array.isArray(value))throw new TypeError('furBudget needs an explicit object');
  const {maxShells,maxTriangles,hysteresis=.2,fadeTravel=1.5}=value;
  if(!Number.isInteger(maxShells)||maxShells<0||!Number.isFinite(maxTriangles)||maxTriangles<0||!Number.isFinite(hysteresis)||hysteresis<0||hysteresis>1||!Number.isFinite(fadeTravel)||fadeTravel<=0)throw new RangeError('Invalid furBudget');
  return Object.freeze({maxShells,maxTriangles,hysteresis,fadeTravel});
}

export class Fauna {
  constructor(hf, hash, { coverHash = hash, quality = 'high', furBudget = null, excludeSpecies = [] } = {}) {
    if(!Array.isArray(excludeSpecies)||excludeSpecies.some(key=>!ROSTER.some(r=>r.key===key)))throw new TypeError('Unknown excluded land species');
    const excluded=new Set(excludeSpecies);
    this.hf = hf; this.hash = hash; this.cover = coverRecords(coverHash);
    this.group = new THREE.Group(); this.group.name = 'fauna';
    this.agents = []; this.rng = mulberry32(4711); this.time = 0; this.accumulator = 0;
    this.env = { rain: 0, wind: 0, night: 0, wet: 0, windDirection: [1, 0] };
    this.quality = quality;
    // Opt-in WORLD policy; lab/default Fauna retains qualified full 12/6 shells.
    this.furBudget = normalizeFurBudget(furBudget);
    this.furAllocation = new Map(); this.furView = null;
    this.mat = createAnimalMaterial('tiger');
    this.detailMaterials = { tiger: this.mat }; this.detailGeometry = {};
    const cache = this.detailGeometry;
    for (const r of ROSTER) {
      if(excluded.has(r.key))continue;
      const g = GLADES.find(q => q.name === r.home), [hx, hz] = fromDE(g.d, g.e);
      const variants = cache[r.key] ||= { near: buildAnimal(r.key, { lod: 'near' }), far: null };
      const data = variants.near;
      const material = this.detailMaterials[r.key] ||= createAnimalMaterial(r.key);
      for (let i = 0; i < r.n; i++) {
        const rig = makeSkeleton(data.joints), mesh = new THREE.SkinnedMesh(data.geo, material);
        mesh.add(rig.root); mesh.bind(new THREE.Skeleton(rig.bones));
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
        mesh.scale.setScalar(r.scale * (.95 + this.rng() * .1)); mesh.userData.label = r.name; this.group.add(mesh);
        const a = { id: this.agents.length, r, mesh, rig, home: new THREE.Vector2(hx, hz), radius: g.r * r.roam,
          clearance: Math.max(.45, mesh.scale.x * .43), pos: new THREE.Vector2(hx, hz), heading: this.rng() * Math.PI * 2,
          motion: new LandMotion(rig, mesh, data.feet), detailData: data, detailLod: 'near', detailDistance: 1e6 };
        a.detailAppearance = attachAnimalDetail(mesh, rig, data, { quality, seed: 8401 + a.id * 101 });
        this.placeInHome(a);
        a.initial = { pos: a.pos.clone(), heading: a.heading, phase: this.rng(), timer: 1 + this.rng() * 4 };
        this.agents.push(a);
      }
    }
    this.resetForTest();
  }
  ground(x, z) { return this.hf.heightAt(x, z); }
  okSpot(x, z, r = .8) {
    if (!Number.isFinite(x + z) || Math.abs(x) > 49 - r || Math.abs(z) > 49 - r) return false;
    const h = this.ground(x, z), n = this.hf.normalAt(x, z), rv = this.hf.riverInfo(x, z);
    if (!(Number.isFinite(h) && h >= .9 && n[1] >= .82 && rv.dist >= rv.width + r && this.hash.free(x, z, r))) return false;
    // Validate a body footprint, not only its centre: no paws over a river lip
    // or abrupt height step even where the centre happens to be walkable.
    for (const [dx, dz] of [[r*1.5,0],[-r*1.5,0],[0,r*1.5],[0,-r*1.5]]) {
      const sample = this.ground(x+dx,z+dz), river = this.hf.riverInfo(x+dx,z+dz);
      if (!Number.isFinite(sample) || sample < .9 || Math.abs(sample-h) > r*.8 || river.dist < river.width+.1) return false;
    }
    return true;
  }
  // Spawn and routes share a turning disk containing the longitudinal torso
  // samples. Runtime still checks the oriented body and interpolated turns.
  navigationClear(a, x, z) {
    if (!this.okSpot(x, z, a.clearance)) return false;
    const extent = a.mesh.scale.x * .62, r = a.clearance * .65;
    if (!this.hash.free(x, z, extent + r)) return false;
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI / 24;
      if (!this.okSpot(x + Math.cos(angle) * extent, z + Math.sin(angle) * extent, r)) return false;
    }
    return true;
  }
  placeInHome(a) {
    // Search the open home first, not an isolated random coast/river bank.
    const candidates = [];
    for (let x = -a.radius; x <= a.radius; x += .9) for (let z = -a.radius; z <= a.radius; z += .9) {
      if (Math.hypot(x,z) > a.radius) continue;
      const p = a.home.clone().add(new THREE.Vector2(x,z));
      if (!this.navigationClear(a,p.x,p.y)) continue;
      if (this.agents.some(o => p.distanceTo(o.pos) < a.clearance + o.clearance + .8)) continue;
      candidates.push(p);
    }
    candidates.sort((p,q) => p.distanceToSquared(a.home)-q.distanceToSquared(a.home));
    for (const p of candidates) {
      const exits = [];
      for(let k=0;k<8;k++) {
        const h=k*Math.PI/4, q=p.clone().add(new THREE.Vector2(Math.cos(h),Math.sin(h)).multiplyScalar(2.5));
        if(clearSegment((x,z)=>this.navigationClear(a,x,z),p,q)) exits.push(h);
      }
      if(exits.length<2) continue;
      a.pos.copy(p); a.heading=exits[Math.floor(this.rng()*exits.length)]; return;
    }
    throw new Error('No connected safe home for '+a.r.key);
  }
  pickSpot(a) {
    const R = this.rng;
    for (let i = 0; i < 36; i++) {
      // Sample reachable local walks before exploring the broader home.
      const anchor = i < 28 ? a.pos : a.home;
      const ang = R() * Math.PI * 2, rr = i < 28 ? 2 + R()*5 : Math.sqrt(R())*a.radius;
      const p = anchor.clone().add(new THREE.Vector2(Math.cos(ang)*rr,Math.sin(ang)*rr));
      if(p.distanceTo(a.home)>a.radius || p.distanceTo(a.pos)<1.2 || !this.navigationClear(a,p.x,p.y)) continue;
      if(this.agents.some(o=>o!==a&&p.distanceTo(o.pos)<a.clearance+o.clearance+.3))continue;
      if(this.route(a,p)) return p;
    }
    // Narrow glades need a systematic local fallback, not repeated lucky
    // samples in mostly blocked forest. Rotate the search with the current
    // heading; retain genuine idle/walk probabilities above this planner.
    for (const distance of [2.5, 1.8, 3.5, 1.3]) for (let k=0;k<24;k++) {
      const angle=a.heading+k*Math.PI/12;
      const p=a.pos.clone().add(new THREE.Vector2(Math.cos(angle),Math.sin(angle)).multiplyScalar(distance));
      if(p.distanceTo(a.home)>a.radius || !this.navigationClear(a,p.x,p.y)) continue;
      if(this.agents.some(o=>o!==a&&p.distanceTo(o.pos)<a.clearance+o.clearance+.3))continue;
      if(this.route(a,p,true)) return p;
    }
    return null;
  }
  nearest(a, key) {
    let best = null, distance = Infinity;
    for (const o of this.agents) if (o !== a && o.r.key === key) {
      const d = a.pos.distanceTo(o.pos); if (d < distance) { best = o; distance = d; }
    }
    return [best, distance];
  }
  route(a, target, avoidCrowd = false) {
    const ok = (x,z) => this.navigationClear(a,x,z) && (!avoidCrowd || !this.agents.some(o => o!==a &&
      Math.hypot(x-o.pos.x,z-o.pos.y)<(a.clearance+o.clearance)*.8 && Math.hypot(x-o.pos.x,z-o.pos.y)<a.pos.distanceTo(o.pos)-1e-9));
    const route = landRoute(ok, a.pos, target, { step: .65, limit: 900 });
    return route || (avoidCrowd ? landRoute(ok,a.pos,target,{step:.35,limit:2500}) : null);
  }
  bodyClear(a, p, heading) {
    // Two additional longitudinal samples protect the long torso during turns;
    // the existing centre clearance alone would let a tiger's nose cross rocks.
    const extent = a.mesh.scale.x * .62;
    for (const side of [-1, 1]) if (!this.okSpot(p.x + Math.cos(heading) * extent * side,
      p.y + Math.sin(heading) * extent * side, a.clearance * .65)) return false;
    return true;
  }
  travel(a, target, route = null) {
    const path = route || this.route(a, target);
    if (!path) { a.blocked = 'no-land-route'; return false; }
    a.target = target.clone(); a.path = path.map(p => p.clone()); a.state = 'walk'; a.timer = 45;
    a.turnDelay = .3; a.blocked = null; a.arrived = false; return true;
  }
  stop(a, action = 'idle') { a.path = []; a.target = null; a.state = action; a.action = action; }
  pickShelter(a) {
    let anchor = a.pos;
    if (a.r.key === 'fawn') { const [doe] = this.nearest(a, 'doe'); anchor = doe?.shelter?.p || doe?.pos || a.pos; }
    else if (deer(a)) anchor = a.home;
    const candidates = shelterCandidates(this.cover, a.home, a.radius, a.mesh.scale.x * .62 + a.clearance * .65, (x, z) => this.navigationClear(a, x, z));
    candidates.sort((u, v) => (u.p.distanceTo(anchor) + u.p.distanceTo(a.pos) * .2) - (v.p.distanceTo(anchor) + v.p.distanceTo(a.pos) * .2));
    for (const c of candidates) {
      if (this.agents.some(o => o !== a && o.shelter && o.shelter.p.distanceTo(c.p) < (a.clearance + o.clearance) * 1.1)) continue;
      const path = this.route(a, c.p, true); if (path) return { ...c, path };
    }
    return null;
  }
  flee(a, source) {
    a.escape = null;
    const away = a.pos.clone().sub(source); if (away.lengthSq() < 1e-6) away.set(Math.cos(a.heading), Math.sin(a.heading));
    const angle = Math.atan2(away.y, away.x);
    for (const offset of [0, .3, -.3, .6, -.6, .85, -.85]) {
      const d = 10 + this.rng() * 5, goal = a.pos.clone().add(new THREE.Vector2(Math.cos(angle + offset), Math.sin(angle + offset)).multiplyScalar(d));
      if (this.travel(a, goal)) return true;
    }
    // A requested 10–15 unit bolt may end in forest/river despite a useful
    // nearer escape. Search shorter destinations without crossing those
    // obstacles, preferring the greatest positive distance from the strike.
    for (const distance of [8,6,4,2.5]) for (const offset of [0,.3,-.3,.6,-.6,.9,-.9,1.2,-1.2]) {
      const goal=a.pos.clone().add(new THREE.Vector2(Math.cos(angle+offset),Math.sin(angle+offset)).multiplyScalar(distance));
      const path=this.route(a,goal,true);
      if(path && this.travel(a,goal,path))return true;
    }
    const local = reachableEscape((x,z)=>this.navigationClear(a,x,z),a.pos,source);
    if (local) {
      a.escape = { gain: local.gain, exhausted: local.exhausted, visited: local.visited,
        range: local.range, step: local.step, constrained: local.exhausted && local.gain < 2 };
      if (local.gain > .15 && local.path.length && this.travel(a,local.target,local.path)) {
        a.turnDelay = .1; return true;
      }
    }
    this.stop(a, 'alert'); a.blocked = 'no-safe-escape'; return false;
  }
  chooseAction(a) {
    a.stalk = false;
    // Per-animal decisions are not perturbed by path-search/look RNG draws.
    if (a.r.key === 'fawn') {
      const [doe, distance] = this.nearest(a, 'doe');
      if (doe && distance > 3) {
        const p = doe.pos.clone().add(a.pos.clone().sub(doe.pos).normalize().multiplyScalar(1.8));
        if (this.travel(a, p)) return;
      }
    }
    if (a.r.key === 'tiger' && a.choiceRng() < (this.env.night > .55 ? .75 : .25)) {
      const [prey] = this.nearest(a, 'doe');
      if (prey) {
        const p = prey.pos.clone().add(a.pos.clone().sub(prey.pos).normalize().multiplyScalar(7));
        if (this.travel(a, p)) { a.stalk = true; return; }
      }
    }
    let roll = a.choiceRng(), action = 'idle';
    if (a.r.key === 'tiger' && this.env.night > .55) action = 'walk';
    else for (const [name, chance] of a.r.acts) { if (roll < chance) { action = name; break; } roll -= chance; }
    if (action === 'walk') {
      const target = this.pickSpot(a); if (target && this.travel(a, target)) return;
      action = 'idle';
    }
    this.stop(a, action); a.timer = (action === 'lie' || action === 'sit' ? 14 : 6) + a.choiceRng() * 8;
  }
  onStrike(event) {
    const p = event?.position;
    const xyz = Array.isArray(p) ? p : [p?.x, p?.y, p?.z];
    if (xyz.length !== 3 || !xyz.every(Number.isFinite) || (event.time !== undefined && !Number.isFinite(event.time)) || (event.seed !== undefined && !Number.isFinite(event.seed))) throw new RangeError('Invalid land strike');
    const source = new THREE.Vector2(xyz[0], xyz[2]); let affected = 0;
    for (const a of this.agents) if (a.pos.distanceTo(source) <= 40) {
      const delay = this.rng() * .2;
      a.strike = { source: source.clone(), delay, elapsed: 0, duration: deer(a) ? 6 : a.r.key === 'bear' ? 1.3 : 2.4, launched: false };
      a.motion.reset('strike'); affected++;
    }
    return affected;
  }
  reasonFor(a) {
    if (a.strike && a.strike.delay <= 0 && a.strike.elapsed < a.strike.duration) return 'startle';
    if (a.fleeing > 0) return 'tigerflee';
    if (this.env.rain > .4 && a.r.key !== 'bear') return 'shelter';
    if (this.env.wind > .68 && a.r.key !== 'bear') return 'wind';
    if (this.env.night > .6 && a.r.key !== 'tiger') return 'night';
    return 'normal';
  }
  enterReason(a, reason) {
    a.reason = reason; a.reasonAge = 0; a.coverRetry = 5; a.recovery = null; a.shelter = null; a.escape = null;
    a.motion.reset('reaction-' + reason);
    if (reason === 'startle') this.stop(a, deer(a) ? 'crouch' : a.r.key === 'bear' ? 'rear' : a.r.key === 'panda' ? 'roll' : 'crouch');
    else if (reason === 'tigerflee') { const [t] = this.nearest(a, 'tiger'); if (t) this.flee(a, t.pos); }
    else if (reason === 'shelter') {
      a.shelter = this.pickShelter(a);
      if (a.shelter) this.travel(a, a.shelter.p, a.shelter.path);
      else { this.stop(a, 'crouch'); a.blocked = 'no-reachable-cover'; }
    } else if (reason === 'wind') this.stop(a, a.r.key === 'panda' ? 'sit' : a.r.key === 'tiger' ? 'lie' : 'crouch');
    else if (reason === 'night') {
      const sentinel = a.r.key === 'stag';
      if (deer(a) && !sentinel) {
        const [doe] = a.r.key === 'fawn' ? this.nearest(a, 'doe') : [null];
        const anchor = doe?.target || doe?.pos || a.home;
        const goal = anchor.clone().add(new THREE.Vector2(Math.cos(a.id*2.4),Math.sin(a.id*2.4)).multiplyScalar(a.r.key==='fawn'?1.6:2.3));
        if (a.pos.distanceTo(goal) > 1 && this.travel(a, goal)) return;
      }
      this.stop(a, sentinel ? 'alert' : 'sleep');
    } else { a.timer = 0; this.chooseAction(a); }
  }
  step(dt) {
    this.time += dt;
    for (const a of this.agents) {
      a.timer -= dt; a.reasonAge += dt; a.fleeing = Math.max(0, a.fleeing - dt); a.threatCooldown = Math.max(0, a.threatCooldown - dt);
      if (this.env.rain > .15 || (a.reason !== 'normal' && this.env.wet > .4)) a.wasWet = true;
      if (a.strike) {
        if (a.strike.delay > 0) a.strike.delay -= dt;
        else a.strike.elapsed += dt;
        if (a.strike.elapsed >= a.strike.duration) a.strike = null;
      }
      if (deer(a) && !a.strike && a.threatCooldown <= 0) {
        const [t, d] = this.nearest(a, 'tiger'); if (t && d < 11) { a.fleeing = 5; a.threatCooldown = 12; }
      }
      const wanted = this.reasonFor(a);
      if (wanted !== a.reason) {
        if (wanted !== 'normal') this.enterReason(a, wanted);
        else if (!a.recovery) { a.recovery = { wait: 2 + this.rng() * 4, shake: 0 }; this.stop(a, 'alert'); a.reason = 'settle'; }
      }
      // Bears are deliberately unaffected by rain choices but still dry off.
      if (wanted === 'normal' && a.wasWet && this.env.rain <= .15 && a.reason === 'normal' && !a.recovery) {
        a.recovery = { wait: 2 + this.rng() * 4, shake: 0 }; a.reason = 'settle'; this.stop(a, 'idle');
      }
      if (a.recovery && wanted === 'normal') {
        if (a.recovery.wait > 0) a.recovery.wait -= dt;
        else if (a.wasWet && a.recovery.shake < 1) { a.recovery.shake += dt; this.stop(a, 'shake'); }
        else { a.wasWet = false; this.enterReason(a, 'normal'); }
      } else if (a.reason === 'startle') {
        if (deer(a) && a.strike.elapsed > .25 && !a.strike.launched) { a.strike.launched = true; this.flee(a, a.strike.source); }
        if (a.r.key === 'tiger' && a.strike.elapsed > 2) { this.stop(a, 'alert'); a.lookTarget = clamp(-wrapAngle(Math.atan2(a.strike.source.y - a.pos.y, a.strike.source.x - a.pos.x) - a.heading), -.9, .9); }
      } else if (a.reason === 'normal' && a.timer <= 0) this.chooseAction(a);
      if (a.reason === 'shelter' && a.state !== 'walk' && a.shelter && a.pos.distanceTo(a.shelter.p) > .6 && a.reasonAge > a.coverRetry) {
        a.coverRetry = a.reasonAge + 5;
        const replacement = this.pickShelter(a);
        if (replacement) { a.shelter = replacement; this.travel(a, replacement.p, replacement.path); }
      }
      if (a.reason === 'wind') {
        const [x, z] = this.env.windDirection, delta = wrapAngle(Math.atan2(z, x) - a.heading);
        const heading = a.heading + clamp(delta, -.6 * dt, .6 * dt);
        if(this.bodyClear(a,a.pos,heading)) a.heading=heading;
      }
      this.move(a, dt);
      a.lookT -= dt;
      if (a.lookT <= 0) {
        const other = this.agents[(a.id + 1) % this.agents.length];
        a.lookTarget = other && other.pos.distanceTo(a.pos) < 8 ? clamp(-wrapAngle(Math.atan2(other.pos.y - a.pos.y, other.pos.x - a.pos.x) - a.heading), -.8, .8) : (this.rng() - .5) * 1.4;
        a.lookT = 2 + this.rng() * 4;
      }
      this.renderAgent(a, dt);
    }
  }
  arrive(a) {
    a.arrived = !a.target || a.pos.distanceTo(a.target) < .6;
    if (a.reason === 'shelter') {
      const covered = a.shelter && a.pos.distanceTo(a.shelter.p) < .6;
      this.stop(a, covered ? (deer(a) ? 'idle' : a.r.key === 'panda' ? 'sleep' : 'lie') : 'crouch');
      if (!covered) a.blocked = 'cover-route-blocked';
    }
    else if (a.reason === 'night') this.stop(a, a.r.key === 'stag' ? 'alert' : 'sleep');
    else { this.stop(a, a.reason === 'normal' ? 'idle' : 'alert'); a.timer = 2 + this.rng() * 4; }
  }
  move(a, dt) {
    let desired = 0, delta = 0;
    if (a.state === 'walk' && a.path.length) {
      let next = a.path[0], distance = a.pos.distanceTo(next);
      if (distance < .09) { a.path.shift(); if (!a.path.length) this.arrive(a); next = a.path[0]; distance = next ? a.pos.distanceTo(next) : 0; }
      if (next) {
        delta = wrapAngle(Math.atan2(next.y - a.pos.y, next.x - a.pos.x) - a.heading);
        a.lookTarget = clamp(-delta, -.95, .95);
        a.turnDelay = Math.max(0, a.turnDelay - dt);
        const urgent = deer(a) && ['startle','tigerflee'].includes(a.reason);
        const turnLimit = (urgent ? 4 : 1.8) / (1 + a.speed * .2);
        const turn = a.turnDelay > 0 ? 0 : clamp(delta * (urgent ? 4 : 2.8), -turnLimit, turnLimit);
        a.turnRate += (turn - a.turnRate) * (1 - Math.exp(-dt * 7));
        const nextHeading = a.heading + a.turnRate * dt;
        if (this.bodyClear(a, a.pos, nextHeading)) a.heading = nextHeading;
        else {
          a.turnRate = 0; a.blocked='turn-clearance'; a.blockedTime+=dt;
          // Never freeze forever with a walking flag and zero speed if a
          // sampled terrain boundary blocks the continuous heading sweep.
          if(a.blockedTime>.65) { this.arrive(a); a.timer=Math.min(a.timer,2); a.blockedTime=0; }
        }
        const fleeing = deer(a) && (a.reason === 'startle' || a.reason === 'tigerflee');
        desired = a.r.speed * (fleeing ? 2.6 : a.stalk ? .8 : 1) * clamp(1 - Math.abs(delta) * 2, 0, 1);
        desired = Math.min(desired, Math.min(distance * 2.5, Math.sqrt(2 * 1.8 * distance)));
        if (a.turnDelay > 0 || a.state !== 'walk') desired = 0;
      }
    } else a.turnRate *= Math.exp(-dt * 7);
    const burst = deer(a) && ['startle','tigerflee'].includes(a.reason);
    a.speed += clamp(desired - a.speed, -2.4 * dt, (burst ? 3.5 : 1.2) * dt);
    if (a.speed > .001) {
      const p = a.pos.clone().add(new THREE.Vector2(Math.cos(a.heading), Math.sin(a.heading)).multiplyScalar(a.speed * dt));
      const clear = clearSegment((x, z) => this.navigationClear(a, x, z), a.pos, p, .2) && this.bodyClear(a, p, a.heading);
      const crowd = this.agents.some(o => o !== a && p.distanceTo(o.pos) < (a.clearance + o.clearance) * .65 && p.distanceTo(o.pos) < a.pos.distanceTo(o.pos));
      if (clear && !crowd) { a.pos.copy(p); a.blockedTime = 0; a.blocked = null; }
      else { a.speed = 0; a.blockedTime += dt; a.blocked = clear ? 'animal-clearance' : 'obstacle';
        if (a.blockedTime > .65) {
          const path = a.target && this.route(a,a.target,true);
          if(path) { a.path=path; a.turnDelay=.2; }
          else {
            if(crowd && a.escape) { a.escape.obstruction='crowd'; a.escape.crowdReplanFailed=true; }
            this.arrive(a); a.timer=Math.min(a.timer,2);
          }
          a.blockedTime=0;
        }
      }
    }
    a.stride += clamp((a.speed > .03 ? 1 : 0) - a.stride, -dt * 3, dt * 3);
    if (a.speed > .03) a.phase = (a.phase + dt * Math.max(.8, a.speed / (a.mesh.scale.x * .42))) % 1;
    a.blend += clamp((a.state === 'walk' ? 0 : 1) - a.blend, -dt * 2.5, dt * 2.5);
  }
  renderAgent(a, dt) {
    const s = a.mesh.scale.x, fx = Math.cos(a.heading), fz = Math.sin(a.heading);
    const h = this.ground(a.pos.x, a.pos.y), front = this.ground(a.pos.x + fx * .7 * s, a.pos.y + fz * .7 * s), back = this.ground(a.pos.x - fx * .7 * s, a.pos.y - fz * .7 * s);
    const left = this.ground(a.pos.x - fz * .3 * s, a.pos.y + fx * .3 * s), right = this.ground(a.pos.x + fz * .3 * s, a.pos.y - fx * .3 * s);
    const pitch = clamp(Math.atan2(front - back, 1.4 * s), -.4, .4), roll = clamp(-Math.atan2(left - right, .6 * s), -.4, .4);
    if (dt > 0) { a.pitch += (pitch - a.pitch) * (1 - Math.exp(-dt * 5)); a.roll += (roll - a.roll) * (1 - Math.exp(-dt * 5)); }
    a.mesh.position.set(a.pos.x, Math.min(h, (front + back + left + right) / 4) - .045 * s, a.pos.y); a.mesh.rotation.set(a.roll, -a.heading, a.pitch, 'YZX');
    const action = a.state === 'walk' ? 'idle' : a.state;
    const t = this.time + a.id * 1.71;
    pose(a.rig, { phase: a.phase, gait: a.speed / a.r.speed, stride: a.stride, t, action, blend: a.blend, look: a.lookTarget,
      reactionProgress: a.state === 'shake' ? a.recovery?.shake : a.strike ? a.strike.elapsed / a.strike.duration : 0, species: a.r.key });
    // Weight transfer is small enough to remain inside the true limb reach.
    if (a.state === 'walk' || a.state === 'idle' || a.state === 'alert') {
      const heavy = a.r.key === 'bear' || a.r.key === 'panda';
      a.rig.root.position.z += Math.sin(a.phase * Math.PI * 2) * (heavy ? .035 : .015) * a.stride + Math.sin(t * .63) * .008;
      const frontLoad = a.motion.legs.slice(0,2).filter(l=>l.mode==='stance').length / 2;
      const rearLoad = a.motion.legs.slice(2).filter(l=>l.mode==='stance').length / 2;
      a.rig.root.position.y -= .012 * a.stride * rearLoad;
      a.rig.byName.chest.rotation.z -= .012 * a.stride * frontLoad;
      a.rig.root.position.y -= .012 * a.stride * Math.abs(Math.sin(a.phase * Math.PI * 4));
    }
    a.motion.secondary(dt, a.lookTarget, a.turnRate, t, a.r.key);
    if (action === 'shake') { const shake = Math.sin(t * Math.PI * 16) * .15 * Math.sin(Math.PI * clamp(a.recovery?.shake || 0, 0, 1)); a.rig.byName.neck.rotation.y -= shake; a.rig.byName.head.rotation.y += shake; }
    a.motion.update({ phase: a.phase, speed: a.speed, baseSpeed: a.r.speed, fleeing: deer(a) && ['startle', 'tigerflee'].includes(a.reason), ground: (x, z) => this.ground(x, z), walking: a.state === 'walk' && a.blend < .08, dt });
    a.detailAppearance.update({ time: this.time, dt, distance: a.detailDistance, night: this.env.night, wet: this.env.wet });
    a.action = action;
    // Optional owner visual follows every authoritative fixed-step pose/contact solve.
    // It must never replace or advance the navigation/LandMotion controller.
    a.ownerVisual?.update(dt);
  }
  updateDetailView(camera, { forceLod = null } = {}) {
    if (!camera?.isCamera) throw new TypeError('Detail view needs a camera');
    if (forceLod !== null && !['near','far'].includes(forceLod)) throw new RangeError('Invalid animal LOD');
    camera.updateWorldMatrix(true,false);
    const eye = camera.getWorldPosition(new THREE.Vector3()), world = new THREE.Vector3();
    for (const a of this.agents) {
      a.mesh.updateWorldMatrix(true,false); // Camera spherical reconstruction may drift by one double-precision ULP
      // while paused. Quantize only nanounit view distance, not pose or clocks.
      a.detailDistance = Math.round(a.mesh.getWorldPosition(world).distanceTo(eye)*1e9)/1e9;
      const lod = forceLod || (a.detailLod === 'near'
        ? (a.detailDistance > ANIMAL_DETAIL_BUDGET.farDistance ? 'far' : 'near')
        : (a.detailDistance < ANIMAL_DETAIL_BUDGET.nearDistance ? 'near' : 'far'));
      if (lod !== a.detailLod) {
        const variants = this.detailGeometry[a.r.key];
        variants[lod] ||= buildAnimal(a.r.key, { lod });
        a.mesh.geometry = variants[lod].geo; a.detailLod = lod;
      }
    }
    this.allocateFur(camera);
    for (const a of this.agents) {
      const lod = a.detailLod;
      a.detailAppearance.update({ time:this.time,dt:0,distance:lod==='far'?Math.max(a.detailDistance,ANIMAL_DETAIL_BUDGET.furFadeDistance+1):a.detailDistance,night:this.env.night,wet:this.env.wet });
    }
  }
  allocateFur(camera) {
    const budget = this.furBudget;
    if (!budget) return;
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const direction = camera.getWorldDirection(new THREE.Vector3());
    // Fade uses view/simulation travel, never wall time or render frame count.
    // Repeated paused renders remain exact; camera inspection still works.
    const previous = this.furView;
    const travel = previous ? eye.distanceTo(previous.eye) + direction.distanceTo(previous.direction)*8 + Math.abs(this.time-previous.time)*4 : Infinity;
    this.furView = { eye:eye.clone(),direction:direction.clone(),time:this.time };
    const delta = travel < 1e-9 ? 0 : Math.min(1, travel / budget.fadeTravel);
    const candidates = [];
    for (const a of this.agents) {
      const count = a.detailAppearance.snapshot().fur.shellCount;
      const vector = a.mesh.getWorldPosition(new THREE.Vector3()).sub(eye);
      const depth = vector.dot(direction), distance = a.detailDistance;
      const radius = a.mesh.scale.x*1.5;
      const along = Math.max(0,depth), lateral = Math.sqrt(Math.max(0,vector.lengthSq()-depth*depth));
      const halfFov = camera.isPerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*Math.max(1,camera.aspect) : 1;
      const relevance = depth > -radius ? 1-THREE.MathUtils.smoothstep(lateral,along*halfFov+radius,along*halfFov+radius*2) : 0;
      const distanceFade = a.detailLod==='near' ? 1-THREE.MathUtils.smoothstep(distance,18,ANIMAL_DETAIL_BUDGET.furFadeDistance) : 0;
      const score = relevance*distanceFade*radius/Math.max(1,distance);
      const triangles = a.detailData.geo.index.count/3;
      for(let layer=0;layer<count;layer++) {
        // Outer first preserves the silhouette; diminishing returns spread the
        // available layers among relevant actors, not all 12 on every actor.
        const index=count-1-layer, key=a.id+':'+index;
        const old=this.furAllocation.get(key);
        candidates.push({a,index,key,triangles,score:score/(1+layer*.55)*(old?.target?1+budget.hysteresis:1),weight:old?.weight??0,target:false});
      }
    }
    candidates.sort((a,b)=>b.score-a.score||a.a.id-b.a.id||b.index-a.index);
    let targetCalls=0,targetTriangles=0;
    for(const c of candidates) if(c.score>0 && targetCalls<budget.maxShells && targetTriangles+c.triangles<=budget.maxTriangles) {
      c.target=true;targetCalls++;targetTriangles+=c.triangles;
    }
    // A departing shell releases its slot only at zero. Fade in arrivals
    // afterwards: no temporary double-cost cross-fade through the hard cap.
    let calls=0,triangles=0;
    for(const c of candidates) if(c.weight>0) {
      c.weight=c.target?c.weight:Math.max(0,c.weight-delta);
      if(c.weight>0) {calls++;triangles+=c.triangles;}
    }
    for(const c of candidates) if(c.target) {
      if(c.weight>0) c.weight=Math.min(1,c.weight+delta);
      else if(calls<budget.maxShells&&triangles+c.triangles<=budget.maxTriangles) {c.weight=delta;if(c.weight>0){calls++;triangles+=c.triangles;}}
    }
    this.furAllocation=new Map(candidates.map(c=>[c.key,{weight:c.weight,target:c.target}]));
    for(const a of this.agents) {
      const count=a.detailAppearance.snapshot().fur.shellCount,weights=Array(count).fill(0);
      for(const c of candidates) if(c.a===a) weights[c.index]=c.weight;
      a.detailAppearance.setFurBudget(weights);
    }
  }
  update(dt, t = this.time, env = {}) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 3600 || !Number.isFinite(t)) throw new RangeError('Invalid fauna time');
    if (!env || typeof env !== 'object') throw new RangeError('Invalid fauna environment');
    const next = {};
    for (const key of ['rain', 'wind', 'night', 'wet']) {
      const v = env[key] ?? 0; if (!Number.isFinite(v)) throw new RangeError('Invalid fauna environment'); next[key] = clamp(v, 0, 1);
    }
    const d = env.windDirection ?? [1, 0], dir = Array.isArray(d) ? d : [d.x, d.z ?? d.y];
    if (dir.length !== 2 || !dir.every(Number.isFinite)) throw new RangeError('Invalid wind direction');
    const l = Math.hypot(...dir); next.windDirection = l > 1e-8 ? dir.map(v => v / l) : [1, 0]; this.env = next;
    // Pose/IK are stateful: re-solving a paused frame can change load transfer.
    // Matrices already retain the last rendered pose; only reset explicitly poses.
    if (dt === 0) return;
    // Process all accepted elapsed time; no clipped/discarded delta. At most 1/60
    // per simulation/spring/IK step, shared accumulator guarantees FPS invariance.
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= MOTION_STEP) { this.step(MOTION_STEP); this.accumulator -= MOTION_STEP; }
    if (Math.abs(this.accumulator) < 1e-10) this.accumulator = 0;
  }
  resetForTest({ seed = 4711 } = {}) {
    if (!Number.isInteger(seed)) throw new RangeError('Invalid reset seed');
    this.rng = mulberry32(seed); this.time = 0; this.accumulator = 0;
    this.env = { rain: 0, wind: 0, night: 0, wet: 0, windDirection: [1, 0] };
    for (const a of this.agents) {
      a.pos.copy(a.initial.pos); a.heading = a.initial.heading; a.choiceRng = mulberry32(seed + a.id * 101);
      Object.assign(a, { state: 'idle', action: 'idle', reason: 'normal', reasonAge: 0, timer: a.initial.timer, phase: a.initial.phase,
        path: [], target: null, speed: 0, stride: 0, blend: 1, lookTarget: 0, lookT: a.id * .3 + 1,
        pitch: 0, roll: 0, turnRate: 0, turnDelay: 0, fleeing: 0, threatCooldown: 0, blockedTime: 0,
        wasWet: false, recovery: null, strike: null, shelter: null, escape: null, blocked: null, stalk: false, arrived: false, coverRetry: 5 });
      a.motion.springs = {}; a.motion.reset('test-reset'); this.renderAgent(a, 0);
    }
    return this.snapshot();
  }
  snapshot() {
    return { furBudget:this.furBudget?{...this.furBudget}:null, time: this.time, pendingTime: this.accumulator, coverCount: this.cover.length, agents: this.agents.map(a => ({
      id: a.id, species: a.r.key, state: a.state, reason: a.reason, reasonAge: a.reasonAge,
      detail: { lod:a.detailLod,distance:Number.isFinite(a.detailDistance)?a.detailDistance:null,triangles:a.mesh.geometry.index.count/3,appearance:a.detailAppearance.snapshot() },
      position: [a.pos.x, this.ground(a.pos.x, a.pos.y), a.pos.y], heading: a.heading, speed: a.speed, phase: a.phase,
      target: a.target?.toArray() || null, path: a.path.map(p => p.toArray()), blocked: a.blocked,
      shelter: a.shelter ? { position: a.shelter.p.toArray(), vegetation: { ...a.shelter.tree }, reached: a.pos.distanceTo(a.shelter.p) < .6 } : null,
      recovery: a.recovery && { ...a.recovery }, wet: a.wasWet, contacts: a.motion.snapshot(),
      escape: a.escape ? { ...a.escape } : null,
      contactReset: a.motion.resetReason, strike: a.strike && { elapsed: a.strike.elapsed, duration: a.strike.duration, source: a.strike.source.toArray() }
    })) };
  }
}
