import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { animalFootRig, ANIMAL_KEYS } from './land.js';
import { makeSkeleton } from './rig.js';
import { pose } from './gait.js';
import { LandMotion, solveLeg, soleWorld, gaitProfile } from './motion.js';
function fixture(key) {
  const data = animalFootRig(key), rig = makeSkeleton(data.joints), mesh = new T.Group(); mesh.add(rig.root); mesh.scale.setScalar(1.7);
  return { data, rig, mesh, motion: new LandMotion(rig, mesh, data.feet) };
}
for (const key of ANIMAL_KEYS) test(key + ': actual paw soles, rest bend planes, lengths and world stance on flat/slope/turns', () => {
  let checks = 0, maxError = 0, maxDrift = 0;
  for (const slope of [0, .17]) {
    const { rig, mesh, motion } = fixture(key), ground = (x, z) => x * slope + z * .025;
    let previous = {};
    for (let i = 0; i < 360; i++) {
      const t = i / 60, phase = (t * 1.5) % 1;
      mesh.position.set(t, ground(t, .2 * Math.sin(t)) - .075, .2 * Math.sin(t));
      mesh.rotation.set(-.025, -.15 * Math.sin(t), Math.atan(slope), 'YZX');
      pose(rig, { phase, stride: 1, t, species: key, blend: 0 });
      motion.update({ phase, speed: 1, ground, walking: true });
      for (const l of motion.legs) {
        assert.ok(l.mid.position.distanceTo(l.u) < 1e-12); assert.ok(l.end.position.distanceTo(l.v) < 1e-12);
        assert.ok(Math.abs(l.start.getWorldPosition(new T.Vector3()).distanceTo(l.mid.getWorldPosition(new T.Vector3())) - l.l1 * 1.7) < 1e-10);
        assert.ok(Math.abs(l.mid.getWorldPosition(new T.Vector3()).distanceTo(l.end.getWorldPosition(new T.Vector3())) - l.l2 * 1.7) < 1e-10);
        const actual = soleWorld(l), old = previous[l.name];
        assert.ok(actual.toArray().every(Number.isFinite));
        if (l.mode === 'stance') {
          checks++; maxError = Math.max(maxError, actual.distanceTo(l.target)); assert.equal(l.reach.clamped, false);
          if (old?.mode === 'stance' && old.target.distanceTo(l.target) < 1e-10) maxDrift = Math.max(maxDrift, old.actual.distanceTo(actual));
        }
        previous[l.name] = { actual, target: l.target.clone(), mode: l.mode };
      }
    }
  }
  assert.ok(checks > 1000, 'non-vacuous stance coverage');
  assert.ok(maxError < 1e-9, 'actual sole reaches world lock'); assert.ok(maxDrift < 1e-9, 'actual transformed sole stays planted');
});
test('rear hock is not a sole; solver rotates offset and keeps skin bind contract', () => {
  const { motion, mesh, rig } = fixture('doe'); mesh.position.set(4, 2, 3); mesh.rotation.set(.07, .6, .15); mesh.updateMatrixWorld(true);
  const l = motion.legs[2], target = soleWorld(l), q = mesh.getWorldQuaternion(new T.Quaternion());
  assert.ok(target.distanceTo(l.end.getWorldPosition(new T.Vector3())) > .5);
  const restPositions = rig.bones.map(b => b.position.clone());
  mesh.position.x += .04; solveLeg(l, target, q);
  assert.ok(soleWorld(l).distanceTo(target) < 1e-9);
  rig.bones.forEach((b, i) => assert.ok(b.position.distanceTo(restPositions[i]) < 1e-12));
  solveLeg(l, new T.Vector3(100, 0, 0), q); assert.equal(l.reach.clamped, true); assert.ok(l.error > 90);
});
test('teleport, nonwalking and reaction reset clear stale world contacts', () => {
  const { motion, mesh } = fixture('tiger'); mesh.position.y = -.07;
  const args = { phase: .1, speed: 1, walking: true, ground: () => 0 };
  motion.update(args); mesh.position.x = 20; motion.update(args); assert.equal(motion.resetReason, 'teleport');
  motion.update({ ...args, walking: false }); assert.ok(motion.legs.every(l => l.mode === 'free'));
  motion.reset('strike'); assert.equal(motion.resetReason, 'strike');
});
test('gait blending and fixed spring integration are finite and bounded', () => {
  const a = fixture('tiger').motion, b = fixture('tiger').motion;
  for (let i = 0; i < 600; i++) a.secondary(1/60, .8, .7, i/60, 'tiger');
  for (let frame = 0; frame < 300; frame++) for (let j = 0; j < 2; j++) b.secondary(1/60, .8, .7, (frame*2+j)/60, 'tiger');
  assert.deepEqual(a.springs, b.springs); assert.ok(Math.abs(a.springs.head.x - .8) < 1e-8);
  assert.equal(gaitProfile(0).duty, .6); assert.equal(gaitProfile(3, true).duty, .36);
  for(let i=0;i<300;i++) assert.ok(gaitProfile(i/100,true).offsets.every(Number.isFinite));
});
