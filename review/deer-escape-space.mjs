import fs from 'node:fs';import * as THREE from 'three';
import {Fauna} from '../src/fauna/animals.js';import {Heightfield} from '../src/world/heightfield.js';import {SpatialHash} from '../src/veg/scatter.js';import {clearSegment} from '../src/fauna/land-navigation.js';
const world=JSON.parse(fs.readFileSync('review/land-fix-evidence/world.json')),strike=JSON.parse(fs.readFileSync('review/land-fix-evidence/strike.json'));
const hash=new SpatialHash();for(const [x,z,r]of world.hash)hash.add(x,z,r);const f=new Fauna(new Heightfield(),hash,{coverHash:null});f.cover=world.cover;
for(const a of f.agents){const s=strike.before.agents[a.id];a.pos.set(s.position[0],s.position[2]);a.heading=s.heading;}
const source=new THREE.Vector2(strike.source[0],strike.source[2]),result=[];
for(const id of [3,5,6]){const a=f.agents[id],start=a.pos.clone(),away=start.clone().sub(source).normalize(),step=.35,queue=[{x:0,z:0,p:start}],seen=new Set(['0,0']),cached=new Map();let best={score:0,p:start},visits=0;
 const ok=(x,z)=>f.navigationClear(a,x,z);
 while(queue.length&&visits<8000){const n=queue.shift();visits++;const score=n.p.clone().sub(start).dot(away);if(score>best.score)best={score,p:n.p};for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;const x=n.x+dx,z=n.z+dz;if(Math.abs(x*step)>15||Math.abs(z*step)>15)continue;const k=x+','+z;if(seen.has(k))continue;const p=start.clone().add(new THREE.Vector2(x*step,z*step));let valid=cached.get(k);if(valid===undefined){valid=ok(p.x,p.y);cached.set(k,valid);}if(!valid){seen.add(k);continue;}if(!clearSegment(ok,n.p,p,.17))continue;seen.add(k);queue.push({x,z,p});}}
 const row={id,visits,exhausted:queue.length===0,maxAway:best.score,best:best.p.toArray(),start:start.toArray(),route:f.route(a,best.p)?.map(x=>x.toArray())||null};result.push(row);console.log(JSON.stringify(row));}
fs.writeFileSync('review/deer-escape-space.json',JSON.stringify(result,null,2));
