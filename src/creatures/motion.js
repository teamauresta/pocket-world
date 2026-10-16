import * as THREE from 'three';
const V = (a) => new THREE.Vector3(...a);
const clamp = THREE.MathUtils.clamp;
export const MOTION_STEP = 1 / 60;
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// All rest vectors are from the actual skeleton, including its lateral offsets.
// No bone translations/scales or bind matrices are changed by IK.
export function createLeg(rig, foot) {
  const end = rig.byName[foot.bone], mid = end.parent, start = mid.parent;
  const u = mid.userData.rest.clone(), v = end.userData.rest.clone();
  const axis = u.clone().add(v).normalize();
  const bend = u.clone().addScaledVector(axis, -u.dot(axis)).normalize();
  return { name: foot.bone, start, mid, end, u, v, bend,
    l1: u.length(), l2: v.length(), offset: V(foot.offset), restSole: V(foot.sole),
    swingU: 0, mode: 'free', target: new THREE.Vector3(), actual: new THREE.Vector3(),
    from: new THREE.Vector3(), landing: new THREE.Vector3(), previousPhase: null,
    released: false, reach: null, error: 0 };
}

export function soleWorld(leg, out = new THREE.Vector3()) {
  leg.end.updateWorldMatrix(true, false);
  return out.copy(leg.offset).applyMatrix4(leg.end.matrixWorld);
}

// Solve in start-parent coordinates, then orient the wrist/hock to the mesh's
// ground frame. This subtracts the ROTATED sole offset before solving the chain.
export function solveLeg(leg, worldTarget, footWorldQuaternion) {
  const { start, mid, end, u, v, l1, l2 } = leg;
  start.parent.updateWorldMatrix(true, false);
  const parentQ = start.parent.getWorldQuaternion(new THREE.Quaternion());
  const scale = end.getWorldScale(new THREE.Vector3());
  const ankle = worldTarget.clone().sub(leg.offset.clone().multiply(scale).applyQuaternion(footWorldQuaternion));
  const local = start.parent.worldToLocal(ankle).sub(start.position);
  const requested = local.length(), min = Math.abs(l1 - l2) + 1e-5, max = l1 + l2 - 1e-5;
  const distance = clamp(requested, min, max);
  const axis = local.normalize();
  if (axis.lengthSq() < .5) axis.set(0, -1, 0);
  // A rest-rig bend plane, not an arbitrary species angle or global +z pole.
  const bend = leg.bend.clone().addScaledVector(axis, -leg.bend.dot(axis)).normalize();
  if (bend.lengthSq() < .5) bend.set(1, 0, 0).addScaledVector(axis, -axis.x).normalize();
  const along = (l1 * l1 + distance * distance - l2 * l2) / (2 * distance);
  const knee = axis.clone().multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  start.quaternion.setFromUnitVectors(u.clone().normalize(), knee.clone().normalize());
  const lower = axis.clone().multiplyScalar(distance).sub(knee).applyQuaternion(start.quaternion.clone().invert());
  mid.quaternion.setFromUnitVectors(v.clone().normalize(), lower.normalize());
  const midWorld = parentQ.multiply(start.quaternion).multiply(mid.quaternion);
  end.quaternion.copy(midWorld.invert().multiply(footWorldQuaternion));
  start.updateWorldMatrix(false, true);
  soleWorld(leg, leg.actual);
  leg.error = leg.actual.distanceTo(worldTarget);
  leg.reach = { requested, min, max, clamped: requested < min || requested > max };
  return leg.error;
}

export function gaitProfile(speedRatio = 0, fleeing = false) {
  const trot = clamp((speedRatio - .75) / .65, 0, 1);
  const gallop = fleeing ? clamp((speedRatio - 1.5) / .8, 0, 1) : 0;
  const walk = [0.5, 0, .75, .25], run = [.5, 0, 0, .5], gall = [.04, 0, .52, .56];
  return { trot, gallop, duty: THREE.MathUtils.lerp(THREE.MathUtils.lerp(.6, .45, trot), .36, gallop),
    offsets: walk.map((p, i) => THREE.MathUtils.lerp(THREE.MathUtils.lerp(p, run[i], trot), gall[i], gallop)) };
}

export class LandMotion {
  constructor(rig, mesh, feet) {
    this.rig = rig; this.mesh = mesh;
    // Metadata primitive order is frontL, hindL, frontR, hindR.
    this.legs = ['wristL', 'wristR', 'hockL', 'hockR'].map(n => createLeg(rig, feet.find(f => f.bone === n)));
    this.springs = {}; this.lastPosition = null; this.resets = 0; this.resetReason = 'initial';
  }
  reset(reason = 'reset') {
    this.resets++; this.resetReason = reason; this.lastPosition = null;
    for (const l of this.legs) { l.mode = 'free'; l.previousPhase = null; l.released = false; l.reach = null; l.target.set(0, 0, 0); l.from.set(0, 0, 0); l.landing.set(0, 0, 0); l.recoveryU = 0; l.swingU = 0; l.error = 0; }
  }
  secondary(dt, look, turnRate, t, species) {
    // Called ONLY from the fixed simulation step; dt=0 refresh reads, never integrates.
    const apply = (name, target, k = 38, damping = 11) => {
      const s = this.springs[name] ||= { x: 0, v: 0 };
      if (dt > 0) { s.v += ((target - s.x) * k - s.v * damping) * dt; s.x += s.v * dt; }
      return s.x;
    };
    const head = apply('head', look);
    this.rig.byName.neck.rotation.y = head * .4;
    this.rig.byName.head.rotation.y = head * .6;
    for (let i = 1; i <= 4; i++) {
      const b = this.rig.byName['tail' + i]; if (!b) continue;
      const target = Math.sin(t * 1.3 - i * .65) * (species === 'tiger' ? .22 : .1) - turnRate * .12 * i;
      b.rotation.y = apply('tail' + i, clamp(target, -.65, .65), 24 - i * 2, 8);
    }
  }
  update({ phase, speed, fleeing = false, baseSpeed = 1, ground, walking, dt = MOTION_STEP }) {
    const mesh = this.mesh, scale = mesh.scale.x;
    mesh.updateWorldMatrix(true, true);
    if (!walking) {
      if (this.legs.some(l => l.mode !== 'free')) this.reset('non-walk');
      for (const l of this.legs) { soleWorld(l, l.actual); l.error = 0; }
      return;
    }
    const pos = mesh.getWorldPosition(new THREE.Vector3());
    if (this.lastPosition && pos.distanceTo(this.lastPosition) > Math.max(.5, speed * dt * 3)) this.reset('teleport');
    this.lastPosition = pos.clone();
    if (dt === 0) {
      const q = mesh.getWorldQuaternion(new THREE.Quaternion());
      for (const l of this.legs) if (l.mode !== 'free') solveLeg(l, l.target, q);
      return;
    }
    const profile = gaitProfile(speed / baseSpeed, fleeing);
    const q = mesh.getWorldQuaternion(new THREE.Quaternion());
    const cadence = Math.max(.8, speed / (scale * .42));
    const lead = Math.min(.17 * scale, speed * profile.duty / cadence * .48);
    for (let i = 0; i < this.legs.length; i++) {
      const l = this.legs[i], p = ((phase + profile.offsets[i]) % 1 + 1) % 1;
      const ideal = l.restSole.clone().applyMatrix4(mesh.matrixWorld);
      const forward = new THREE.Vector3(lead, 0, 0).applyQuaternion(q);
      ideal.add(forward); ideal.y = ground(ideal.x, ideal.z);
      const stance = p < profile.duty;
      if (!stance || (l.previousPhase !== null && p < l.previousPhase)) l.released = false;
      if (l.mode === 'free') {
        l.target.copy(ideal); l.from.copy(ideal); l.landing.copy(ideal);
        l.mode = stance ? 'stance' : 'swing'; l.swingU = stance ? 0 : clamp((p - profile.duty) / (1 - profile.duty), 0, 1);
      } else if (stance && l.mode === 'swing' && !l.released) {
        l.target.copy(l.landing); l.mode = 'stance'; l.released = false;
      } else if (!stance && l.mode === 'stance') {
        l.from.copy(l.actual); l.landing.copy(ideal); l.mode = 'swing'; l.swingU = 0;
      }
      if (l.mode === 'swing') {
        // Fixed landing for this swing, smooth zero-end-velocity interpolation.
        // Retarget during swing as the body curves; a swing is NOT a lock.
        l.landing.lerp(ideal, Math.min(1, dt * 12));
        l.swingU = Math.min(1, l.swingU + dt * cadence / (l.released ? .22 : 1 - profile.duty));
        const u = l.swingU, ease = u * u * (3 - 2 * u);
        l.target.copy(l.from).lerp(l.landing, ease);
        l.target.y += Math.sin(Math.PI * u) * .12 * (l.l1 + l.l2) * scale;
      }
      solveLeg(l, l.target, q);
      if (l.mode === 'stance' && l.reach.clamped) {
        // Never report an unreachable target as a planted foot. Early liftoff
        // retains the actual position and schedules a short recovery swing.
        l.mode = 'swing'; l.released = true; l.recoveryU = 0; l.swingU = 0; l.from.copy(l.actual); l.landing.copy(ideal);
      }
      l.previousPhase = p;
    }
  }
  snapshot() {
    return this.legs.map(l => ({ bone: l.name, mode: l.mode, target: l.target.toArray(),
      actual: soleWorld(l).toArray(), error: l.error, reach: l.reach && { ...l.reach }, released: l.released,
      lengths: [l.l1, l.l2], soleOffset: l.offset.toArray() }));
  }
}
