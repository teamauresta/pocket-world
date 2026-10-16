import test from 'node:test';import assert from 'node:assert/strict';
import {createOwnerTigerPatrol} from './owner-tiger-patrol.js';
test('closed patrol advances continuously through three cycles, pause and reset',()=>{
 const p=createOwnerTigerPatrol(),initial=p.snapshot();let old=p.step(0),distance=0;
 for(let i=0;i<10000;i++){const next=p.step(1/60);const d=Math.hypot(next.x-old.x,next.z-old.z);assert.ok(d<=.001501);distance+=d;assert.ok(next.angularSpeed<=0&&next.angularSpeed>=-.12);old=next;}
 assert.ok(p.snapshot().cycles>3);assert.ok(distance>14);const frozen=p.snapshot();p.step(0);assert.deepEqual(p.snapshot(),frozen);p.reset();assert.deepEqual(p.snapshot(),initial);
});
test('obstruction holds without teleport, reverse, reseed, or hiding',()=>{const p=createOwnerTigerPatrol();for(let i=0;i<200;i++)p.step(1/60);const a=p.step(0);const b=p.step(1/60,()=>false);assert.equal(b.x,a.x);assert.equal(b.z,a.z);assert.equal(b.speed,0);assert.equal(b.angularSpeed,0);assert.ok(b.blocked);assert.equal(p.step(1).cycles,b.cycles);assert.throws(()=>p.step(-1));});
