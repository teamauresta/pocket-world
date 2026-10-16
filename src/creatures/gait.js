// Procedural poses for the quadruped rig: walk cycle, idle breathing, grazing/drinking, sitting and lying down.
// All angles are in radians; rotation about z swings a limb forward (+) or back (-).
import * as THREE from 'three';

const E = new THREE.Euler();
const Q = new THREE.Quaternion();
function rot(b, x, y, z, w = 1) {
  if (!b) return;
  E.set(x, y, z, 'XYZ');
  Q.setFromEuler(E);
  if (w >= 1) b.quaternion.copy(Q);
  else b.quaternion.slerp(Q, w);
}

const LEGS = [
  { s: 'shoulderL', m: 'elbowL', e: 'wristL', front: true, off: 0.5 },
  { s: 'shoulderR', m: 'elbowR', e: 'wristR', front: true, off: 0.0 },
  { s: 'hipL', m: 'kneeL', e: 'hockL', front: false, off: 0.75 },
  { s: 'hipR', m: 'kneeR', e: 'hockR', front: false, off: 0.25 },
];

// st: { phase, gait (0 walk .. 1 trot), stride (0..1), t, action: 'walk'|'idle'|'graze'|'sit'|'lie',
//       blend (0..1 toward action pose), look (head yaw), species }
export function pose(rig, st) {
  const B = rig.byName;
  const t = st.t;
  const stride = st.stride ?? 1;
  const sp = st.species;
  const bulky = sp === 'bear' || sp === 'panda';
  const amp = (bulky ? 0.3 : 0.4) * stride;

  // ---- legs from the walk cycle
  const legAngles = {};
  for (const L of LEGS) {
    const off = st.gait > 0.5 ? (L.front ? (L.off === 0 ? 0 : 0.5) : (L.off === 0.25 ? 0 : 0.5)) : L.off;
    const p = Math.PI * 2 * (st.phase + off);
    const swing = Math.sin(p) * amp;
    const lift = Math.max(0, Math.cos(p)) * stride;
    if (L.front) legAngles[L.s] = [swing, -lift * 0.85, -lift * 0.7];
    else legAngles[L.s] = [swing * 0.9, -lift * 0.75, lift * 0.85];
  }
  const bob = Math.sin(Math.PI * 4 * st.phase) * 0.025 * stride;

  // ---- base body (walking or standing)
  const root = B.pelvis;
  root.position.copy(root.userData.rest);
  root.position.y += bob;
  rot(root, Math.sin(Math.PI * 2 * st.phase) * 0.03 * stride, Math.sin(Math.PI * 2 * st.phase) * 0.04 * stride, 0);
  rot(B.spine, 0, -Math.sin(Math.PI * 2 * st.phase) * 0.03 * stride, 0);
  rot(B.chest, 0, -Math.sin(Math.PI * 2 * st.phase) * 0.03 * stride, 0);
  const breathe = Math.sin(t * 1.6) * 0.012;
  // Breathing must not scale the shoulder chain / change IK bone lengths.
  B.chest.scale.setScalar(1);
  B.chest.rotation.z += breathe * .25;
  const look = st.look ?? 0;
  rot(B.neck, 0, look * 0.4, (sp === 'stag' || sp === 'doe' || sp === 'fawn' ? 0 : -0.05) - bob * 2);
  rot(B.head, 0, look * 0.6, bob * 2 + Math.sin(t * 0.7) * 0.02);
  for (const L of LEGS) {
    const a = legAngles[L.s];
    rot(B[L.s], 0, 0, a[0]);
    rot(B[L.m], 0, 0, a[1]);
    rot(B[L.e], 0, 0, a[2]);
  }
  // tail: droops, sways, curls at the tip
  for (let i = 1; i <= 4; i++) {
    const b = B[`tail${i}`];
    if (!b) continue;
    const sway = Math.sin(t * 1.3 - i * 0.6) * (sp === 'tiger' ? 0.22 : 0.1);
    rot(b, 0, sway, (i === 1 ? -0.25 : 0.08) + (sp === 'tiger' && i === 4 ? 0.35 : 0));
  }

  // ---- action overlays
  const w = st.blend ?? 0;
  if (w <= 0) return;
  if (st.action === 'graze') {
    // neck right down to the ground, a little chewing nod
    const deer = sp === 'stag' || sp === 'doe' || sp === 'fawn';
    rot(B.neck, 0, look * 0.2, deer ? -1.25 : -0.6, w);
    rot(B.head, 0, 0, (deer ? -0.35 : -0.35) + Math.sin(t * 5) * 0.05, w);
    for (const n of ['shoulderL', 'shoulderR']) rot(B[n], 0, 0, deer ? 0.08 : 0.15, w);
    if (!deer) {
      for (const n of ['elbowL', 'elbowR']) rot(B[n], 0, 0, -0.35, w);
      for (const n of ['wristL', 'wristR']) rot(B[n], 0, 0, 0.3, w);
      root.position.y -= 0.08 * w;
    }
  } else if (st.action === 'sit') {
    // haunches down, chest up; front paws bring bamboo to the mouth
    const up = 0.95;
    root.position.y -= 0.38 * w;
    root.position.x += 0.12 * w;
    rot(root, 0, 0, up, w);
    rot(B.spine, 0, 0, 0.12, w);
    rot(B.chest, 0, 0, 0.1, w);
    rot(B.neck, 0, look * 0.3, -0.65, w);
    rot(B.head, 0, 0, -0.35 + Math.sin(t * 4) * 0.04, w);
    for (const s of ['L', 'R']) {
      rot(B[`hip${s}`], 0, 0, 0.55 - up + 1.1, w);
      rot(B[`knee${s}`], 0, 0, -0.2, w);
      rot(B[`hock${s}`], 0, 0, 0.5, w);
      const chew = Math.sin(t * 2.2 + (s === 'L' ? 0 : 0.6)) * 0.12;
      rot(B[`shoulder${s}`], 0, 0, -up + 0.85 + chew, w);
      rot(B[`elbow${s}`], s === 'L' ? -0.2 : 0.2, 0, -1.3, w);
      rot(B[`wrist${s}`], 0, 0, -0.4, w);
    }
  } else if (st.action === 'lie' || st.action === 'sleep' || st.action === 'roll') {
    root.position.y -= (bulky ? 0.5 : 0.55) * w;
    rot(root, 0, 0, 0.02, w);
    rot(B.neck, 0, look * 0.6, 0.12, w);
    rot(B.head, 0, look * 0.4, -0.15, w);
    for (const s of ['L', 'R']) {
      rot(B[`shoulder${s}`], 0, 0, 1.25, w);
      rot(B[`elbow${s}`], 0, 0, -0.35, w);
      rot(B[`wrist${s}`], 0, 0, 0.25, w);
      rot(B[`hip${s}`], s === 'L' ? 0.25 : -0.25, 0, 1.05, w);
      rot(B[`knee${s}`], 0, 0, -1.6, w);
      rot(B[`hock${s}`], 0, 0, 1.5, w);
    }
    if (st.action === 'sleep') {
      rot(B.neck, 0, look * .15, -.4, w);
      rot(B.head, 0, 0, -.45, w);
    }
    if (st.action === 'roll') rot(root, Math.sin(Math.PI * (st.reactionProgress ?? 0)) * 1.45, 0, .05, w);
  } else if (st.action === 'crouch') {
    root.position.y -= .16 * w;
    rot(B.neck, 0, look * .4, -.22, w);
    for (const side of ['L', 'R']) {
      rot(B['shoulder' + side], 0, 0, .3, w);
      rot(B['elbow' + side], 0, 0, -.65, w);
      rot(B['hip' + side], 0, 0, -.32, w);
      rot(B['knee' + side], 0, 0, .65, w);
    }
  } else if (st.action === 'rear' && sp === 'bear') {
    root.position.y -= .12 * w;
    rot(root, 0, 0, 1.1, w);
    rot(B.neck, 0, look * .3, -.7, w);
    for (const side of ['L', 'R']) {
      rot(B['hip' + side], 0, 0, -1.1, w);
      rot(B['shoulder' + side], 0, 0, -.65, w);
      rot(B['elbow' + side], 0, 0, -.7, w);
    }
  } else if (st.action === 'shake') {
    const envelope = Math.sin(Math.PI * Math.min(1, st.reactionProgress ?? .5));
    const shake = Math.sin(t * Math.PI * 16) * .15 * envelope * w;
    rot(root, shake * .5, 0, 0);
    rot(B.spine, 0, shake, 0);
    rot(B.neck, 0, -shake * 1.3, -.1);
    rot(B.head, 0, shake * .8, 0);
  } else if (st.action === 'alert') {
    rot(B.neck, 0, look * 0.6, 0.3, w);
    rot(B.head, 0, look * 0.5, -0.1, w);
  }
}
