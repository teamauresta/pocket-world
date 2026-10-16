import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Birds } from '../fauna/birds.js';
import { birdPerchAnchor } from '../fauna/bird-reactions.js';
import { SeaLife } from './life.js';
import { Heightfield } from '../world/heightfield.js';
import { U } from '../render/shared.js';
const hf=new Heightfield();
const perches=Array.from({length:14},(_,i)=>({x:-30+i*2.8,y:17+i%3,z:-23+i*2.7,species:'test-real-anchor',localHeight:6,instBase:[-30+i*2.8,-23+i*2.7],windAmp:.16,windStiff:2.2}));
const birds=new Birds(hf,perches),sea=new SeaLife(hf,[],{quality:'low'});
const tickBird=(seconds,env={},fps=60)=>{for(let i=0;i<seconds*fps;i++)birds.update(1/fps,(i+1)/fps,env);};
const tickSea=(seconds,env={},fps=60)=>{for(let i=0;i<seconds*fps;i++)sea.update(1/fps,env);};
function matrices(system){for(const e of system.flocks||[...system.species,...system.big]){const m=new THREE.Matrix4();for(let i=0;i<e.agents.length;i++){e.mesh.getMatrixAt(i,m);assert(m.elements.every(Number.isFinite));const p=system.flocks?e.pos[i]:e.agents[i].p;assert(Math.abs(m.elements[12]-p.x)<1e-4);assert(Math.abs(m.elements[13]-p.y)<1e-4);assert(Math.abs(m.elements[14]-p.z)<1e-4);}}}
function bounds(){for(const a of sea.snapshot().agents){assert(!a.unavailable,a.boundError);const [x,y,z]=a.position,[rx,ry,rz]=a.bounds.extent;assert(Math.abs(x)+rx<50.00001);assert(Math.abs(z)+rz<50.00001);assert(y>=a.bounds.bottom-1e-7);assert(y<=a.bounds.top+1e-7);if(a.breathMode!=='ascend'&&a.breathMode!=='hold'&&a.breathMode!=='descend')assert(y+ry<.00001);}}
test('birds finite continuous landing, real fold, matching depth, night beach and recovery',()=>{
 birds.resetForTest();let old=birds.snapshot().agents.map(a=>a.position);
 for(let n=0;n<600;n++){birds.update(1/60,(n+1)/60,{rain:1,wind:.6,gust:.5});const now=birds.snapshot().agents;now.forEach((a,i)=>assert(new THREE.Vector3(...a.position).distanceTo(new THREE.Vector3(...old[i]))<.6));old=now.map(a=>a.position);}
 const s=birds.snapshot();assert(s.agents.filter(a=>a.species!=='gull').every(a=>a.mode==='perched'&&a.wingFold>.99&&a.perchError<1e-7));assert(s.agents.filter(a=>a.species==='gull').every(a=>a.mode==='flight'));
 for(const f of birds.flocks){const sh=()=>({uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'});const a=sh(),b=sh();f.mesh.material.onBeforeCompile(a);f.mesh.customDepthMaterial.onBeforeCompile(b);assert.equal(a.vertexShader,b.vertexShader);assert(a.vertexShader.includes('sin(fold * 1.35)'));}
 tickBird(10,{night:1});assert(birds.snapshot().agents.every(a=>a.mode==='perched'));for(const a of birds.snapshot().agents.filter(a=>a.species==='gull'))assert.equal(a.perch.y,hf.heightAt(a.perch.x,a.perch.z));
 tickBird(20,{});assert(birds.snapshot().agents.every(a=>a.mode==='flight'&&a.wingFold<.01));matrices(birds);
});
test('bird strike priority, stagger, deterministic fps, pause clock',()=>{
 const runs=[];for(const fps of [45,60,144]){birds.resetForTest();tickBird(8,{rain:1},fps);const a=birds.flocks[0].agents[0];birds.onStrike({position:{x:a.p.x,y:0,z:a.p.z},seed:22});tickBird(1,{rain:1,night:1},fps);assert(birds.flocks[0].agents[0].reason==='lightning');tickBird(14,{},fps);runs.push(birds.snapshot().agents.map(a=>[a.mode,...a.position]));}
 for(let j=1;j<runs.length;j++)for(let i=0;i<runs[0].length;i++){assert.equal(runs[j][i][0],runs[0][i][0]);for(let k=1;k<4;k++)assert(Math.abs(runs[j][i][k]-runs[0][i][k])<1e-7);}
 const time=birds.time,u=U.uTime.value;for(const dt of [0,-1,NaN,Infinity,1e-12])birds.update(dt,77,{});assert.equal(birds.time,time);assert.equal(U.uTime.value,u);matrices(birds);
});
test('wind anchor shader correspondence and hover phase speed',()=>{
 const p={position:new THREE.Vector3(1,2,3),x:1,z:3,localHeight:6,instBase:[1,3],windAmp:.16,windStiff:2.2};const a=birdPerchAnchor(p,2,{wind:1,windDirection:{x:1,z:0},gust:0});assert.equal(a.z,3);assert.equal(a.y,2);assert.notEqual(a.x,1);
 birds.resetForTest();tickBird(10,{wind:1});const windy=birds.flocks[2].agents[0].phase;birds.resetForTest();tickBird(10,{wind:0});assert(windy<birds.flocks[2].agents[0].phase*.3);
});
test('sea frame independent normal swimming, storm no fraction drift and matrix bounds',()=>{
 const runs=[];for(const fps of [45,60,144]){sea.resetForTest();tickSea(4,{},fps);tickSea(6,{rain:1,wind:1,waves:1},fps);bounds();matrices(sea);runs.push(sea.snapshot().agents.map(a=>a.position));}
 for(let j=1;j<runs.length;j++)for(let i=0;i<runs[0].length;i++)for(let k=0;k<3;k++)assert(Math.abs(runs[j][i][k]-runs[0][i][k])<1e-7);
 const f=sea.sharks.agents[0].yFrac.slice();tickSea(4,{rain:1,waves:1});assert.deepEqual(sea.sharks.agents[0].yFrac,f);tickSea(1,{});assert.deepEqual(sea.sharks.agents[0].yFrac,sea.sharks.agents[0].baseYFrac);
 const before=sea.time,u=U.uTime.value,snap=sea.snapshot();for(const dt of [0,-1,NaN,Infinity,1e-12])sea.update(dt,{});assert.equal(sea.time,before);assert.equal(U.uTime.value,u);assert.deepEqual(sea.snapshot(),snap);
});
test('fish lightning only within 15xz, down and away, recovery and zero agents',()=>{
 sea.resetForTest();const a=sea.species[0].agents[0],p={x:a.p.x,z:a.p.z,y:0};const prior=sea.snapshot().agents;sea.onStrike({position:p,seed:3});for(const sp of sea.species)for(const f of sp.agents){const near=Math.hypot(f.p.x-p.x,f.p.z-p.z)<=15;assert.equal(f.dartUntil>0,near);if(near)assert(f.dart.y<0);}
 tickSea(3,{});assert(sea.species.every(sp=>sp.agents.every(a=>a.reason==='normal')));bounds();assert(sea.species.find(s=>s.key==='clown').agents.length===0);assert(prior.length>100);
});
test('turtles reach actual head waterline for three seconds then dive, bounded storm/night',()=>{
 sea.resetForTest();assert(sea.turtles.agents.every(a=>a.breathDue>=40&&a.breathDue<=70));
 for(const a of sea.turtles.agents)a.breathDue=0;
 const held=[0,0],maxHead=[-Infinity,-Infinity];
 for(let i=0;i<3000;i++){sea.update(1/60,{rain:1,wind:1,waves:1,night:1});sea.turtles.agents.forEach((a,j)=>{if(a.breathMode==='hold'&&a.breathCount===1){held[j]++;maxHead[j]=Math.max(maxHead[j],a.headWorld.y);assert(Math.abs(a.headWorld.y)<.05);}});if(i%60===0)bounds();}
 assert(held.every(n=>n>=179&&n<=181),held);assert(maxHead.every(y=>y>0));assert(sea.turtles.agents.every(a=>a.breathCount>=1));matrices(sea);
});
test('near vertical orientation, shallow fallback and impossible habitat is explicit',()=>{
 sea.resetForTest();const a=sea.sharks.agents[0];a.v.set(.0000001,1,0);sea.render(true);matrices(sea);bounds();
 const old=sea.sea.hf;sea.sea.hf={heightAt:(x,z)=>x>20&&z>20?-18:-.2,normalAt:(x,z,out)=>{out[0]=0;out[1]=1;out[2]=0;}};for(const e of [...sea.species,...sea.big])for(const a of e.agents){a.p.set(-10,-8,-10);a.safePosition=null;}sea.render(true);bounds();
 sea.sea.hf={heightAt:()=>-.2,normalAt:()=>{}};sea.render(true);assert(sea.snapshot().agents.every(a=>a.unavailable&&a.boundError));sea.sea.hf=old;sea.resetForTest();
});

test('actual geometry vertices remain inside glass and above terrain during storm run',()=>{
 sea.resetForTest();const m=new THREE.Matrix4(),v=new THREE.Vector3();
 for(let tick=0;tick<10;tick++){
  tickSea(1,{rain:1,wind:1,waves:1});
  for(const e of [...sea.species,...sea.big]){
   const pos=e.mesh.geometry.attributes.position;
   for(let i=0;i<e.agents.length;i++){
    e.mesh.getMatrixAt(i,m);
    // Sample all vertices of every big model and one per fish species; remaining
    // fish instances have the same geometry envelope verified by bounds().
    if(e.key&&i>0)continue;
    for(let j=0;j<pos.count;j++){
     v.fromBufferAttribute(pos,j).applyMatrix4(m);
     assert(Math.abs(v.x)<50&&Math.abs(v.z)<50,'glass');
     assert(v.y>=hf.heightAt(v.x,v.z)-1e-6,'terrain vertex '+(e.key||e.kind));
    }
   }
  }
 }
});

test('normal school keeps moving and reef homes attract at night',()=>{
 sea.resetForTest();const start=sea.species[0].agents.map(a=>a.p.clone());tickSea(10,{});
 assert(sea.species[0].agents.reduce((sum,a,i)=>sum+a.p.distanceTo(start[i]),0)/start.length>3);
 const reef=sea.species.filter(s=>s.mode==='reef');const distance=()=>reef.flatMap(s=>s.agents).reduce((n,a)=>n+a.p.distanceTo(a.home),0);
 const day=distance();tickSea(20,{night:1});assert(distance()<day);bounds();
});
