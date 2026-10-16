import * as THREE from 'three';
import { HALF } from '../world/config.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export function measureSwimmer(geo,kind,amp=0) {
  geo.computeBoundingBox();
  const b=geo.boundingBox;
  const extent=V(Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),Math.max(Math.abs(b.min.y),Math.abs(b.max.y)),Math.max(Math.abs(b.min.z),Math.abs(b.max.z)));
  // Conservative animation envelope; turtle flippers rotate in two planes.
  if(kind==='turtle'){extent.x+=.7;extent.y+=1.5;extent.z+=.4;}else if(kind==='manta')extent.y+=amp;else extent.z+=amp*1.32;
  let head=V(2,.35,0);
  if(kind==='turtle') {
    const p=geo.attributes.position;let highest=-Infinity;
    for(let i=0;i<p.count;i++)if(p.getX(i)>1.7&&Math.abs(p.getZ(i))<.2&&p.getY(i)>highest){highest=p.getY(i);head.set(p.getX(i),highest,p.getZ(i));}
  }
  return {extent,head};
}
export function swimmerBounds(a, matrix) {
  const e=matrix.elements,h=a.extent;
  return V(Math.abs(e[0])*h.x+Math.abs(e[4])*h.y+Math.abs(e[8])*h.z,Math.abs(e[1])*h.x+Math.abs(e[5])*h.y+Math.abs(e[9])*h.z,Math.abs(e[2])*h.x+Math.abs(e[6])*h.y+Math.abs(e[10])*h.z);
}
export function floorUnder(sea,p,r) {
  let f=-Infinity;
  for(const dx of [-r.x,0,r.x])for(const dz of [-r.z,0,r.z])f=Math.max(f,sea.floor(p.x+dx,p.z+dz));
  return f;
}
export function safeSwimmer(system,a,matrix,top=-1.1) {
  const r=swimmerBounds(a,matrix);
  if(top===-1.1)top=Math.min(top,-r.y-.08);
  const limitX=HALF-r.x-.15,limitZ=HALF-r.z-.15;
  a.p.x=THREE.MathUtils.clamp(a.p.x,-limitX,limitX);a.p.z=THREE.MathUtils.clamp(a.p.z,-limitZ,limitZ);
  let floor=floorUnder(system.sea,a.p,r),bottom=floor+Math.max(a.clearance||.25,r.y+.12);
  if(bottom>top) {
    if(a.safePosition){a.p.copy(a.safePosition);a.p.x=THREE.MathUtils.clamp(a.p.x,-limitX,limitX);a.p.z=THREE.MathUtils.clamp(a.p.z,-limitZ,limitZ);floor=floorUnder(system.sea,a.p,r);bottom=floor+Math.max(a.clearance||.25,r.y+.12);}
    if(bottom>top) {
      // Deterministic nearest safe cell, never a hardcoded (30,-8,30) land fallback.
      let best=null,bestD=Infinity;
      for(let x=-limitX;x<=limitX;x+=3)for(let z=-limitZ;z<=limitZ;z+=3){
        const q=V(x,0,z),f=floorUnder(system.sea,q,r),lo=f+Math.max(a.clearance||.25,r.y+.12),d=(x-a.p.x)**2+(z-a.p.z)**2;
        if(lo<=top&&d<bestD){best=V(x,Math.max(lo,Math.min(top,a.p.y)),z);bestD=d;}
      }
      if(best){a.p.copy(best);floor=floorUnder(system.sea,a.p,r);bottom=floor+Math.max(a.clearance||.25,r.y+.12);}else{
        a.unavailable=true;a.boundError='no water deep enough for existing model';return false;
      }
    }
  }
  if(a.p.y<bottom){a.p.y=bottom;a.v.y=Math.max(0,a.v.y);}if(a.p.y>top){a.p.y=top;a.v.y=Math.min(0,a.v.y);}
  a.unavailable=false;a.boundError=null;a.safePosition=a.p.clone();a.bounds={floor,bottom,top,extent:r.toArray()};return true;
}
export function setupSeaReactions(system) {
  system.time=0;system.accumulator=0;system.env={};
  for(const sp of system.species)for(const a of sp.agents){a.extent=sp.metrics.extent;a.clearance=sp.mode==='anemone'?.25:.8;a.reason='normal';a.dartUntil=0;a.dart=V();}
  for(const e of system.big)for(const a of e.agents){
    a.extent=e.metrics.extent;a.head=e.metrics.head;a.baseYFrac=a.yFrac.slice();a.reason='normal';a.burstUntil=0;a.storm=false;a.breathMode='swim';a.breathDue=40+system.rng()*30;a.breathHold=0;a.breathCount=0;a.restHome=a.p.clone();a.returnTarget=null;
  }
}
export function strikeSea(system,event={}) {
  const p=Array.isArray(event.position)?{x:event.position[0],y:event.position[1],z:event.position[2]}:event.position;
  if(!p||![p.x,p.z].every(Number.isFinite))return;
  for(const sp of system.species)for(const a of sp.agents)if(Math.hypot(a.p.x-p.x,a.p.z-p.z)<=15){
    a.dart.set(a.p.x-p.x,-4,a.p.z-p.z).normalize().multiplyScalar(7);a.dart.y=-Math.max(3,Math.abs(a.dart.y));a.v.addScaledVector(a.dart,.45);a.dartUntil=system.time+1.4;a.reason='lightning';
  }
  for(const e of system.big)if(e.kind!=='turtle')for(const a of e.agents)if(Math.hypot(a.p.x-p.x,a.p.z-p.z)<=30)a.burstUntil=system.time+2.5;
}
// Select a physically roomy deep column, not just a low centre-height target
// whose long model would intersect the adjacent shallow bank.
export function deepStormTarget(system,a) {
  if (!a.stormSites || a.stormTerrain !== system.sea.hf) {
    const radius=Math.hypot(a.extent.x,a.extent.z)*a.scale;
    const yRadius=a.extent.y*a.scale,limit=HALF-radius-.3,sites=[];
    const fraction=(a.yFrac[0]+a.yFrac[1])*.5;
    for(let x=-limit;x<=limit;x+=3)for(let z=-limit;z<=limit;z+=3){
      const floor=system.sea.floor(x,z);if(floor>-a.minDepth)continue;
      const depth=floor+(-1.5-floor)*fraction;
      let highest=floor;
      for(let k=0;k<16;k++)highest=Math.max(highest,system.sea.floor(x+Math.cos(k*Math.PI/8)*radius,z+Math.sin(k*Math.PI/8)*radius));
      if(highest+Math.max(a.clearance,yRadius+.12)<=depth)sites.push(V(x,depth,z));
    }
    a.stormSites=sites;a.stormTerrain=system.sea.hf;
  }
  const ranked=a.stormSites.map(p=>({p,d:p.distanceTo(a.p)})).filter(x=>x.d>6).sort((x,y)=>x.d-y.d);
  const pool=ranked.slice(0,Math.min(12,ranked.length));
  return pool.length?pool[Math.floor(system.rng()*pool.length)].p.clone():a.stormSites[0]?.clone()||null;
}
export function prepareBig(system,e,a,dt) {
  const env=system.env,storm=(env.rain||0)>.65&&(env.waves??env.wind??0)>.65;
  if(e.kind!=='turtle') {
    a.reason=system.time<a.burstUntil?'lightning':storm?'storm-depth':'normal';
    if(a.storm!==storm){
      a.storm=storm;a.yFrac=a.baseYFrac.map(v=>Math.max(.05,v-(storm?.3:0)));
      if(storm){a.clearTarget=a.target.clone();const deep=deepStormTarget(system,a);if(deep)a.target=deep;}
      else if(a.clearTarget)a.target=a.clearTarget.clone();
    }
    return;
  }
  const night=(env.night||0)>.55;
  if(a.breathMode==='swim'&&system.time>=a.breathDue){
    a.returnTarget=a.p.clone();a.breathMode='ascend';a.breathTarget=a.p.clone();a.breathTarget.y=-a.head.y*a.scale+.03;
    a.target=a.breathTarget.clone();
  }
  if(a.breathMode==='ascend'&&a.p.distanceTo(a.breathTarget)<.025){a.breathMode='hold';a.breathHold=0;a.breathCount++;}
  if(a.breathMode==='hold'){
    a.breathHold+=dt;
    if(a.breathHold+1e-9>=3){a.breathMode='descend';a.target=a.returnTarget.clone();}
  }
  if(a.breathMode==='descend'&&a.p.distanceTo(a.returnTarget)<.3){a.breathMode='swim';a.breathDue=system.time+(40+system.rng()*30)*((env.rain||0)>.4?.72:1);a.target=system.sea.randomWater(system.rng,a.minDepth,a.yFrac);}
  a.reason=a.breathMode!=='swim'?'breathing':night?'night-rest':'normal';
  if(a.breathMode==='swim'&&night){a.target.copy(a.restHome);a.target.y=system.sea.floor(a.restHome.x,a.restHome.z)+a.clearance+.3;}
}
