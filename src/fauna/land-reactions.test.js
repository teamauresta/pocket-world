import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Heightfield } from '../world/heightfield.js';
import { Fauna } from './animals.js';
import { SpatialHash } from '../veg/scatter.js';
import { clearSegment, landRoute, coverRecords, shelterCandidates, annotateCoverCanopies } from './land-navigation.js';
const hf = { heightAt: () => 3, normalAt: () => [0,1,0], riverInfo: () => ({ dist: 100, width: 1 }), river: { down: [] } };
const hash = new SpatialHash();
// One real production geometry build; all cases reset the live rig, not toy agents.
const fauna = new Fauna(hf, hash, { coverHash: null });
const reset = () => { fauna.hf = hf; fauna.hash = hash; fauna.cover = []; fauna.resetForTest(); return fauna; };
const storm = { rain: 1, wind: 1, night: 1, wet: 1 };
const quiet = f => { for (const a of f.agents) if(a.r.key==='tiger') { a.pos.set(-40,-40); a.timer=1000; } };

test('frame-size invariant live rigs at 30/60/144fps and large deltas, no lost time', () => {
  const f = reset(); f.update(12,12,{}); const expected = f.snapshot();
  for (const fps of [30,60,144]) { f.resetForTest(); for(let i=0;i<12*fps;i++) f.update(1/fps,(i+1)/fps,{}); assert.deepEqual(f.snapshot(),expected); }
  assert.ok(Math.abs(expected.time-12)<1e-9);
});
test('paused update refreshes poses without advancing choices, timers, contacts or springs', () => {
  const f=reset(); f.update(8,8); const before=f.snapshot(), springs=f.agents.map(a=>structuredClone(a.motion.springs));
  f.update(0,500,storm); assert.deepEqual(f.snapshot(),before); assert.deepEqual(f.agents.map(a=>a.motion.springs),springs);
});
test('priority startle > tiger flee > shelter > wind > night > normal and bear rain exception', () => {
  const f=reset(), doe=f.agents.find(a=>a.r.key==='doe'), tiger=f.agents[0];
  tiger.pos.copy(doe.pos).add(new T.Vector2(3,0)); f.update(.1,.1,storm); assert.equal(doe.reason,'tigerflee');
  f.onStrike({position:[doe.pos.x,3,doe.pos.y],time:.1,seed:5}); f.update(.3,.4,storm); assert.equal(doe.reason,'startle');
  quiet(f); doe.fleeing=0; doe.threatCooldown=1000; f.update(7,7.4,storm); assert.equal(doe.reason,'shelter');
  f.update(.1,7.5,{wind:1,night:1}); assert.equal(doe.reason,'wind');
  f.update(.1,7.6,{night:1}); assert.equal(doe.reason,'night');
  f.update(8,15.6,{}); assert.equal(doe.reason,'normal');
  reset(); f.update(1,1,{rain:1}); assert.ok(f.agents.filter(a=>a.r.key==='bear').every(a=>a.reason==='normal'));
});
test('null cover is observable safe fallback, wet shake follows 2–6s settle and resumes', () => {
  const f=reset(); quiet(f); f.update(1,1,{rain:1});
  const panda=f.agents.find(a=>a.r.key==='panda'); assert.equal(panda.shelter,null); assert.equal(panda.blocked,'no-reachable-cover'); assert.equal(panda.state,'crouch');
  f.update(1/60,1,{}); assert.equal(panda.reason,'settle'); assert.ok(panda.recovery.wait>=2-1/60&&panda.recovery.wait<=6);
  let shook=false; for(let i=0;i<480;i++){f.update(1/60,1+i/60,{});if(panda.state==='shake')shook=true;}
  assert.equal(shook,true); assert.equal(panda.reason,'normal'); assert.equal(panda.wasWet,false);
});
test('strike radius/species timing and deer target points away, invalid events are atomic', () => {
  const f=reset(); quiet(f); const doe=f.agents.find(a=>a.r.key==='doe'); const p=doe.pos.clone(), source=p.clone().add(new T.Vector2(-2,0));
  const affected=f.onStrike({position:[source.x,3,source.y],time:0,seed:7}); assert.ok(affected>0&&affected<12);
  assert.equal(f.agents[0].strike,null); f.update(.6,.6,{});
  assert.ok(doe.target); assert.ok(doe.target.clone().sub(p).dot(p.clone().sub(source))>0); assert.ok(doe.target.distanceTo(p)>=9.9&&doe.target.distanceTo(p)<=15.1);
  assert.equal(f.agents.find(a=>a.r.key==='bear').state,'rear');
  f.update(8,8.6,{}); assert.ok(f.agents.every(a=>a.reason!=='startle'));
  const before=f.snapshot(); for(const event of [null,{}, {position:[0,NaN,1]}, {position:[0,0,0],seed:Infinity}]) assert.throws(()=>f.onStrike(event),RangeError); assert.deepEqual(f.snapshot(),before);
});
test('real vegetation shelter records, routes, bounds and occupied positions', () => {
  const f=reset(), a=f.agents.find(a=>a.r.key==='panda'), trees=new SpatialHash();
  trees.add(a.home.x+4,a.home.y,1.1); trees.add(a.home.x-3,a.home.y, .5); f.cover=coverRecords(trees); f.hash=trees;
  assert.equal(f.cover.length,1); const shelter=f.pickShelter(a); assert.ok(shelter);
  assert.ok(f.okSpot(shelter.p.x,shelter.p.y,a.clearance)); assert.ok(shelter.p.distanceTo(a.home)<=a.radius+5);
  let p=a.pos; for(const q of shelter.path){assert.ok(clearSegment((x,z)=>f.okSpot(x,z,a.clearance),p,q));p=q;}
  assert.ok(shelter.p.distanceTo(new T.Vector2(shelter.tree.x,shelter.tree.z))-shelter.tree.r<=2);
  f.cover=[]; assert.equal(f.pickShelter(a),null); assert.deepEqual(shelterCandidates([],a.home,10,.8,()=>true),[]);
});
test('routing detours around rocks and rejects impassable river instead of crossing', () => {
  const start=new T.Vector2(-5,0),goal=new T.Vector2(5,0),ok=(x,z)=>Math.hypot(x,z)>2&&Math.abs(x)<10&&Math.abs(z)<10;
  const path=landRoute(ok,start,goal); assert.ok(path&&path.length>1); let p=start;for(const q of path){assert.ok(clearSegment(ok,p,q));p=q;}
  const river=(x,z)=>Math.abs(x)>.8&&Math.abs(z)<8&&Math.abs(x)<10; assert.equal(landRoute(river,start,goal,{limit:600}),null);
});
test('night herd sentinel and tiger activity; acceleration/head lead and clearance remain bounded', () => {
  const f=reset(); quiet(f); f.update(1,1,{night:1}); assert.equal(f.agents.find(a=>a.r.key==='stag').state,'alert'); assert.equal(f.agents.find(a=>a.r.key==='bear').state,'sleep');
  const tiger=f.agents[0]; tiger.pos.copy(tiger.home); f.chooseAction(tiger); assert.equal(tiger.state,'walk'); assert.equal(tiger.reason,'normal');
  reset(); const a=f.agents[0]; f.agents.slice(1).forEach((o,i)=>o.pos.set(40,30+i)); a.pos.set(0,0); a.heading=0;
  assert.equal(f.travel(a,new T.Vector2(0,10)),true); f.update(.2,.2); assert.equal(a.heading,0); assert.ok(Math.abs(a.motion.springs.head.x)>.01);
  let last=a.speed; for(let i=0;i<240;i++){f.update(1/60,i/60);assert.ok(a.speed-last<=1.2/60+1e-9);assert.ok(a.speed<=a.r.speed*2.6);assert.ok(f.okSpot(a.pos.x,a.pos.y,a.clearance));last=a.speed;}
});
test('invalid inputs rejected before mutation and deterministic reset reuses geometry', () => {
  const f=reset(), geometries=f.agents.map(a=>a.mesh.geometry), before=f.snapshot();
  for(const dt of [-1,NaN,Infinity,3601,'1'])assert.throws(()=>f.update(dt,0),RangeError);
  for(const env of [null,{rain:NaN},{windDirection:[1]},{night:Infinity}])assert.throws(()=>f.update(1,0,env),RangeError);
  assert.deepEqual(f.snapshot(),before); f.update(3,3);f.resetForTest();assert.deepEqual(f.snapshot(),before);assert.deepEqual(f.agents.map(a=>a.mesh.geometry),geometries);
});

test('actual skinned sole vertices have bounded residual drift, not falsely perfect geometry locks', () => {
  const f=reset();
  for(const key of ['tiger','stag','doe','fawn','bear','panda']) {
    f.resetForTest(); const a=f.agents.find(a=>a.r.key===key);
    f.agents.filter(o=>o!==a).forEach((o,i)=>{o.pos.set(40,30+i);o.timer=1000;});
    a.pos.set(0,0);a.heading=0;f.travel(a,new T.Vector2(20,0));
    const positions=a.mesh.geometry.attributes.position;
    const samples=a.motion.legs.map(l=>{let best=Infinity,index=0;for(let i=0;i<positions.count;i++){
      const d=new T.Vector3().fromBufferAttribute(positions,i).distanceTo(l.restSole);if(d<best){best=d;index=i;}
    }return index;});
    let previous=[],maxFrame=0,maxStance=0,checks=0;
    for(let i=0;i<360;i++){
      f.update(1/60,i/60);a.mesh.updateMatrixWorld(true);a.mesh.skeleton.update();
      previous=a.motion.legs.map((l,k)=>{
        const actual=new T.Vector3().fromBufferAttribute(positions,samples[k]);a.mesh.applyBoneTransform(samples[k],actual);actual.applyMatrix4(a.mesh.matrixWorld);
        let first=actual.clone();const old=previous[k];
        if(l.mode==='stance'&&old?.mode==='stance'&&l.target.distanceTo(old.target)<1e-10){
          checks++;first=old.first;maxFrame=Math.max(maxFrame,actual.distanceTo(old.actual));maxStance=Math.max(maxStance,actual.distanceTo(first));
        }
        return {actual,first,target:l.target.clone(),mode:l.mode};
      });
    }
    assert.ok(checks>500);assert.ok(maxFrame<.008,key+' per-frame skin drift');assert.ok(maxStance<.055,key+' stance-span skin drift');
    // Existing blended skin weights make the surface deform even though the
    // bone-attached sole landmark is exact. Do not claim zero mesh drift.
    assert.ok(maxStance>0);
  }
});
test('real island heightfield: footprint clearance and bounded honest reach diagnostics', () => {
  const f=reset();f.hf=new Heightfield();
  // Re-seat test fixtures onto valid terrain without rebuilding geometry.
  for(const a of f.agents){f.placeInHome(a);a.motion.reset('terrain-test');}
  let planted=0,clamped=0,maxError=0;
  for(let i=0;i<1800;i++){
    f.update(1/60,i/60);
    for(const a of f.agents){assert.ok(f.okSpot(a.pos.x,a.pos.y,a.clearance));
      for(const c of a.motion.snapshot()){
        if(c.mode==='stance'){planted++;assert.ok(c.error<1e-8);assert.equal(c.reach.clamped,false);}
        if(c.reach?.clamped){clamped++;maxError=Math.max(maxError,c.error);assert.notEqual(c.mode,'stance');}
      }
    }
  }
  assert.ok(planted>1000);assert.ok(maxError<.25,'terrain swing reach residual is bounded');
  assert.ok(clamped<1500,'early releases are exceptional, not the entire gait');
});

test('tigers and pandas actually reach real cover before resting; deer gather by does', () => {
  const f=reset(), trees=new SpatialHash();trees.add(-5,8,1.1);trees.add(-16,15,1.6);trees.add(16,-10,1.6);
  f.hash=trees;f.cover=coverRecords(trees);
  for(const a of f.agents)if(!f.navigationClear(a,a.pos.x,a.pos.y))f.placeInHome(a);
  f.update(40,40,{rain:1});
  for(const a of f.agents.filter(a=>['tiger','panda'].includes(a.r.key))){
    assert.ok(a.shelter);assert.ok(a.pos.distanceTo(a.shelter.p)<.6);assert.ok(['lie','sleep'].includes(a.state));assert.ok(f.okSpot(a.pos.x,a.pos.y,a.clearance));
  }
  for(const a of f.agents.filter(a=>a.r.key==='fawn')) {
    const [doe]=f.nearest(a,'doe');assert.ok(a.shelter&&doe.shelter);
    assert.ok(a.shelter.p.distanceTo(doe.shelter.p)<5,'fawn uses doe cover cluster');
  }
});

test('measured canopy envelope excludes points outside actual leaf instance bounds', () => {
  const h=new SpatialHash();h.add(0,0,1.6);h.add(20,0,1.6);
  const group=new T.Group(), leaves=new T.InstancedMesh(new T.BoxGeometry(8,2,6),new T.MeshBasicMaterial({alphaTest:.3}),1);
  leaves.setMatrixAt(0,new T.Matrix4().makeTranslation(0,5,0));group.add(leaves);
  annotateCoverCanopies(h,[group]);const records=coverRecords(h);assert.equal(records.length,1);
  assert.equal(records[0].envelope.source,'leaf-instance-bounds');
  const points=shelterCandidates(records,new T.Vector2(),10,1.2,()=>true);assert.ok(points.length>0);
  assert.ok(points.every(c=>Math.abs(c.p.x)<=4&&Math.abs(c.p.y)<=3));
  leaves.geometry.dispose();leaves.material.dispose();
});

test('spawning rejects isolated centre-only pockets and validates every initial heading', () => {
  const f=reset(), obstacles=new SpatialHash();
  // A ring has a free centre but no executable exit for a long torso.
  const a=f.agents[0];for(let k=0;k<12;k++)obstacles.add(a.home.x+Math.cos(k*Math.PI/6)*2.4,a.home.y+Math.sin(k*Math.PI/6)*2.4,.35);
  f.hash=obstacles;f.placeInHome(a);
  assert.ok(f.navigationClear(a,a.pos.x,a.pos.y));assert.ok(a.pos.distanceTo(a.home)>2);
  for(let h=0;h<Math.PI*2;h+=.03)assert.ok(f.bodyClear(a,a.pos,h));
  const target=f.pickSpot(a);assert.ok(target);let p=a.pos;for(const q of f.route(a,target)){
    assert.ok(clearSegment((x,z)=>f.navigationClear(a,x,z),p,q));p=q;
  }
});
test('crowd route detours without disabling obstacle clearance or moving blockers', () => {
  const f=reset(),a=f.agents[0],other=f.agents[1];
  f.agents.slice(2).forEach((o,i)=>{o.pos.set(40,20+i);o.timer=1000;});
  a.pos.set(-5,0);a.heading=0;other.pos.set(0,0);other.timer=1000;
  const route=f.route(a,new T.Vector2(5,0),true);assert.ok(route&&route.length>1);
  let p=a.pos;for(const q of route){assert.ok(clearSegment((x,z)=>f.navigationClear(a,x,z)&&Math.hypot(x,z)>=(a.clearance+other.clearance)*.8,p,q));p=q;}
  f.travel(a,new T.Vector2(5,0),route);f.update(18,18);assert.ok(a.pos.x>4);assert.deepEqual(other.pos.toArray(),[0,0]);
});
test('invalid route start is not silently escaped through obstacles',()=>{
  assert.equal(landRoute((x,z)=>Math.hypot(x,z)>1,new T.Vector2(),new T.Vector2(5,0)),null);
});
