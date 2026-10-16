import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Picker } from './picker.js';

function setup(occluders = []) {
  const handlers = {}, hits = [];
  const dom = { addEventListener: (type, fn) => handlers[type] = fn, getBoundingClientRect: () => ({ left:0, top:0, width:200, height:200 }) };
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  camera.position.z = 10; camera.updateMatrixWorld();
  const animal = { radius: .5, get: () => new THREE.Vector3() };
  const picker = new Picker(camera, dom, () => [animal], hit => hits.push(hit), () => occluders);
  const event = (id, x=100, y=100) => ({pointerId:id, button:0, clientX:x, clientY:y});
  return {handlers, hits, animal, picker, event};
}
test('visible animal selectable; opaque terrain between camera and animal blocks selection', () => {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshBasicMaterial());
  wall.position.z = 5; wall.updateMatrixWorld();
  const s = setup([wall]);
  assert.equal(s.picker.pick(100,100), null);
  wall.position.z = -5; wall.updateMatrixWorld();
  assert.equal(s.picker.pick(100,100), s.animal);
});
test('pinches, cancelled pointers, right clicks and drags that return to origin do not select', () => {
  const {handlers:h, hits, event:e} = setup();
  h.pointerdown(e(1)); h.pointerdown(e(2)); h.pointerup(e(2)); h.pointerup(e(1));
  h.pointerdown(e(1)); h.pointercancel(e(1)); h.pointerup(e(1));
  h.pointerdown(e(1)); h.pointermove(e(1,120)); h.pointerup(e(1));
  h.pointerdown({...e(1),button:2}); h.pointerup(e(1));
  assert.equal(hits.length,0);
  h.pointerdown(e(1)); h.pointerup(e(1));
  assert.equal(hits.length,1);
});
