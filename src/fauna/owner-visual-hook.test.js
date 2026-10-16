import test from 'node:test';import assert from 'node:assert/strict';import {Fauna} from './animals.js';import {SpatialHash} from '../veg/scatter.js';import {MOTION_STEP} from '../creatures/motion.js';
const flat={heightAt:()=>8,normalAt:()=>[0,1,0],riverInfo:()=>({dist:100,width:0})};
test('owner visual receives every final fixed-step pose without changing controller state',()=>{
 const control=new Fauna(flat,new SpatialHash(),{coverHash:null,quality:'low'}),candidate=new Fauna(flat,new SpatialHash(),{coverHash:null,quality:'low'}),a=candidate.agents.find(a=>a.r.key==='stag'),calls=[];
 a.ownerVisual={update(dt){calls.push({dt,time:candidate.time,action:a.action,contacts:a.motion.snapshot()});assert.ok(a.mesh.position.toArray().every(Number.isFinite));assert.equal(a.action,a.state==='walk'?'idle':a.state);}};
 for(let i=0;i<10;i++){control.update(MOTION_STEP*3,control.time+MOTION_STEP*3,{rain:.7,wet:.8});candidate.update(MOTION_STEP*3,candidate.time+MOTION_STEP*3,{rain:.7,wet:.8});}
 assert.equal(calls.length,30);assert.ok(calls.every(c=>Math.abs(c.dt-MOTION_STEP)<1e-12&&c.contacts.length===4));assert.deepEqual(candidate.snapshot(),control.snapshot());
 const before=structuredClone(candidate.snapshot()),count=calls.length;candidate.update(0,candidate.time,{rain:.7,wet:.8});assert.equal(calls.length,count);assert.deepEqual(candidate.snapshot(),before);
 candidate.resetForTest();control.resetForTest();assert.equal(calls.length,count+1);assert.equal(calls.at(-1).dt,0);assert.deepEqual(candidate.snapshot(),control.snapshot());
 for(const f of [control,candidate])for(const agent of f.agents)agent.detailAppearance.dispose();
});
