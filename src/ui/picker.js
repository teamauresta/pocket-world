// Use generous screen-space targets, with terrain occlusion checked on taps only.
import * as THREE from 'three';

const v = new THREE.Vector3();

export class Picker {
  constructor(camera, dom, getCandidates, onPick, getOccluders = () => []) {
    this.camera = camera;
    this.dom = dom;
    this.getCandidates = getCandidates;
    this.getOccluders = getOccluders;
    this.raycaster = new THREE.Raycaster();
    const pointers = new Set();
    let down = null;
    dom.addEventListener('pointerdown', e => {
      pointers.add(e.pointerId);
      down = pointers.size === 1 && (e.button === 0 || e.button === undefined)
        ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
    });
    dom.addEventListener('pointermove', e => {
      if (down?.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down = null;
    });
    const cancel = e => { pointers.delete(e.pointerId); down = null; };
    dom.addEventListener('pointercancel', cancel);
    dom.addEventListener('lostpointercapture', cancel);
    dom.addEventListener('pointerleave', cancel);
    dom.addEventListener('pointerup', e => {
      pointers.delete(e.pointerId);
      if (!down || down.id !== e.pointerId) return;
      const tap = down;
      down = null;
      if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 6 || performance.now() - tap.t > 450) return;
      onPick(this.pick(e.clientX, e.clientY));
    });
  }

  pick(px, py) {
    const rect = this.dom.getBoundingClientRect();
    const cam = this.camera;
    const focal = rect.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const occluders = this.getOccluders().filter(Boolean);
    let best = null, bestScore = Infinity;
    for (const c of this.getCandidates()) {
      const p = c.get();
      v.copy(p).project(cam);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * rect.width + rect.left;
      const sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
      const dist = cam.position.distanceTo(p);
      const r = Math.max(16, (c.radius * focal) / dist);
      const d = Math.hypot(sx - px, sy - py);
      if (d > r) continue;
      this.raycaster.set(cam.position, v.copy(p).sub(cam.position).normalize());
      this.raycaster.far = Math.max(0, dist - c.radius);
      if (this.raycaster.intersectObjects(occluders, true).length) continue;
      const score = d / r + dist * 0.0015;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }
}
