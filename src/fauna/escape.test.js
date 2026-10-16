import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {Vector2} from 'three';
import {Fauna} from './animals.js';import {Heightfield} from '../world/heightfield.js';import {SpatialHash} from '../veg/scatter.js';import {reachableEscape,clearSegment} from './land-navigation.js';

test('connected escape search finds a safe bend which radial endpoints miss',()=>{
 const ok=(x,z)=>Math.abs(x)<8&&Math.abs(z)<8&&!(x>1&&x<3&&Math.abs(z)<2);
 const start=new Vector2(),source=new Vector2(-3,0),result=reachableEscape(ok,start,source,{range:6});
 assert(result&&result.gain>4);let p=start;for(const q of result.path){assert(clearSegment(ok,p,q,.17));p=q;}
});

test('real sheltered deer use safe hops/curved routes and never force a blocked portal',()=>{
 const w=JSON.parse(fs.readFileSync(new URL('./fixtures/escape-world.json',import.meta.url))),hash=new SpatialHash();w.hash.forEach(x=>hash.add(...x));
 const hf=new Heightfield(),f=new Fauna(hf,hash,{coverHash:null});f.cover=w.cover;f.update(45,45,{rain:1,wind:.5,wet:1});
 assert(f.agents.filter(a=>a.r.key!=='bear').every(a=>a.shelter&&a.pos.distanceTo(a.shelter.p)<.6));
 const stag=f.agents[2],source=[stag.pos.x-3,hf.heightAt(stag.pos.x-3,stag.pos.y),stag.pos.y],before=f.agents.map(a=>a.pos.clone());f.onStrike({position:source,time:45,seed:719});
 const safety=[];for(let k=0;k<360;k++){f.update(1/60,45+(k+1)/60,{rain:1,wind:.5,wet:1});for(const a of f.agents)safety.push(f.navigationClear(a,a.pos.x,a.pos.y)&&f.bodyClear(a,a.pos,a.heading));}
 assert(safety.every(Boolean));
 const gain=id=>{const direction=before[id].clone().sub(new Vector2(source[0],source[2])).normalize();return f.agents[id].pos.clone().sub(before[id]).dot(direction);};
 assert(gain(2)>2&&gain(4)>2,'open escape paths must actually move');
 for(const id of [3,5,6])assert(gain(id)>.3,'constrained deer still visibly react/move');
 const doe=f.agents[3];assert(doe.escape.exhausted&&doe.escape.constrained&&doe.escape.gain<1,'limited local forward room is explicit');
 const fawn=f.agents[5];assert(fawn.escape.obstruction==='crowd'&&fawn.escape.crowdReplanFailed,'live occupancy failure is explicit, not a claimed successful full bolt');
 assert(f.agents[6].escape.gain>1.9,'curved fallback preserves the available escape');
 f.update(10,61,{rain:0,wind:0,wet:0});assert(f.agents.every(a=>a.reason!=='startle'));
});
