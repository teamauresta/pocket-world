import * as THREE from 'three';
import { HALF, CELL } from '../world/config.js';
import { mulberry32 } from '../core/noise.js';
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const smooth = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };

// Same world-space bark displacement as veg/materials.js (no leaf flutter).
export function birdPerchAnchor(p, time, env={}) {
  const out=p.position.clone();
  if(!Number.isFinite(p.localHeight)) return out;
  const dir=env.windDirection || UWindFallback;
  const dx=dir.x??dir[0]??0.8, dz=dir.z??dir.y??dir[1]??0.5;
  const wind=Number(env.wind)||0, base=p.instBase||[p.x,p.z];
  const bend=Math.pow(Math.max(0,Math.min(1.5,p.localHeight)),p.windStiff??2.2);
  const ph=base[0]*.131+base[1]*.173;
  const gust=smooth((Math.sin((base[0]*dx+base[1]*dz)*.08-time*.9*(.5+wind))-.6)/.4)*(env.gust||0);
  const s=Math.sin(time*1.25+ph)*.6+Math.sin(time*2.15+ph*1.7)*.3+Math.sin(time*3.7+ph*2.3)*.1;
  const shift=s*bend*(p.windAmp??.16)*(.4+2.2*wind)*(1+gust)+.6*wind*wind*bend;
  out.x+=dx*shift;out.z+=dz*shift;return out;
}
const UWindFallback={x:.8,y:.5};

export function pickBirdPerch(system,f,i) {
  const origin=f.path(i,0);
  let candidates=system.perches;
  if(f.key==='gull') {
    candidates=[];
    if(system.hf) for(let x=-HALF+4;x<=HALF-4;x+=1.5) for(let z=-HALF+4;z<=HALF-4;z+=1.5) {
      const y=system.hf.heightAt(x,z);
      if(y>=.12&&y<=1&&[[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dz])=>system.hf.heightAt(x+dx,z+dz)<0)) candidates.push({x,y,z,species:'beach'});
    }
  }
  const sorted=candidates.slice().sort((a,b)=>(a.x-origin.x)**2+(a.z-origin.z)**2-((b.x-origin.x)**2+(b.z-origin.z)**2));
  const used=system.usedPerches||new Set();
  const c=sorted.find(p=>!used.has(p)&&![...used].some(q=>Math.hypot(q.x-p.x,q.z-p.z)<(f.key==='eagle'?2:1)));
  if(c)used.add(c);
  return c?{...c,position:V(c.x,c.y-f.bottom*f.scale,c.z)}:null;
}

/** Optional native visual contract. Default birds never enter this branch.
 * Radius encloses ALL native geometry for every wing pose and body orientation.
 * Heightfield is bilinear: extrema of each intersecting grid cell occur at its
 * corners. Include the rectangle endpoints and every crossed grid line; this
 * conservatively covers the complete horizontal sphere projection, not vertices.
 */
export function nativeBirdTerrainFloor(system,policy,x,z) {
  if(!system.hf)return -Infinity;
  const r=policy.radius, xs=[x-r,x+r],zs=[z-r,z+r];
  for(let k=Math.ceil((x-r+HALF)/CELL);k*CELL-HALF<x+r;k++)xs.push(k*CELL-HALF);
  for(let k=Math.ceil((z-r+HALF)/CELL);k*CELL-HALF<z+r;k++)zs.push(k*CELL-HALF);
  let h=-Infinity;for(const xx of xs)for(const zz of zs)h=Math.max(h,system.hf.heightAt(xx,zz));
  return h+r+(policy.clearance??.2);
}
export function constrainNativeBird(system,f,i,a,dt=0) {
  const policy=f.nativeFlightPolicies?.get(i);if(!policy)return;
  const floor=nativeBirdTerrainFloor(system,policy,a.p.x,a.p.z);
  if(dt>0){
    // Anticipatory climb on the actual route heading, then exact current-footprint
    // constraint. Existing route solver limits motion; no visual root translation.
    let ahead=floor;for(const t of [.5,1,1.5])ahead=Math.max(ahead,nativeBirdTerrainFloor(system,policy,a.p.x+a.v.x*t,a.p.z+a.v.z*t));
    a.p.y=Math.max(a.p.y,Math.min(ahead,a.p.y+3*dt),floor);
  }else a.p.y=Math.max(a.p.y,floor);
}
export function resetBirds(system) {
  system.usedPerches=new Set();system.time=0;system.accumulator=0;system.renderTime=0;system.clockOffset=0;system.env={};
  for(const f of system.flocks) f.agents=Array.from({length:f.n},(_,i)=>({p:f.path(i,0),v:f.path(i,.05).sub(f.path(i,0)).multiplyScalar(20),phase:0,mode:'flight',reason:'normal',flightState:'glide',fold:0,flap:0,bank:0,perch:pickBirdPerch(system,f,i),transition:null,clearAt:null,scatterAt:Infinity,scatterUntil:0,settleUntil:0,seed:i+system.flocks.indexOf(f)*17}));
  for(const f of system.flocks)for(let i=0;i<f.n;i++)constrainNativeBird(system,f,i,f.agents[i]);
}

function flightPoint(system,f,i,phase,env) {
  const p=f.path(i,phase);
  if(f.key==='gull') {
    const wind=env.wind||0;
    p.x+=Math.sin(phase*.23+i)*wind*1.8;p.z+=Math.cos(phase*.19+i)*wind*1.8;
    if((env.rain||0)>.4&&system.hf) {
      if(system.hf.heightAt(p.x,p.z)>-1) for(let r=2;r<55;r+=2) {
        let found=false;
        for(let k=0;k<16;k++) {
          const x=p.x+Math.cos(k*Math.PI/8)*r,z=p.z+Math.sin(k*Math.PI/8)*r;
          if(Math.abs(x)<HALF-3&&Math.abs(z)<HALF-3&&system.hf.heightAt(x,z)<-1) {p.x=x;p.z=z;found=true;break;}
        }
        if(found)break;
      }
      p.y=2.7+.45*Math.sin(phase*.4+i);
    }
  }
  if(system.hf)p.y=Math.max(p.y,system.hf.heightAt(p.x,p.z)+1.5);
  return p;
}
function transition(a,mode,target,duration) {
  const start=a.p.clone(),end=target.clone(),high=Math.max(start.y,end.y)+(mode==='landing'?3:5);
  a.transition={start,end,c1:start.clone().add(V(0,high-start.y,0)),c2:end.clone().add(V(0,high-end.y,0)),elapsed:0,duration};a.mode=mode;
}
export function strikeBirds(system,event={}) {
  const p=Array.isArray(event.position)?{x:event.position[0],y:event.position[1],z:event.position[2]}:event.position;
  if(!p||![p.x,p.z].every(Number.isFinite))return;
  const rng=mulberry32((Number(event.seed)||0)+417);
  for(const f of system.flocks)for(const a of f.agents) {
    const delay=rng()*.2;if(Math.hypot(a.p.x-p.x,a.p.z-p.z)>45)continue;
    a.scatterAt=system.time+delay;a.strike=V(p.x,Number.isFinite(p.y)?p.y:0,p.z);
  }
}
export function stepBirds(system,dt,env) {
  system.time+=dt;
  for(const f of system.flocks)for(let i=0;i<f.n;i++) {
    const a=f.agents[i],old=a.p.clone(),wind=THREE.MathUtils.clamp(Number(env.wind)||0,0,1);
    a.phase+=dt*(f.key==='gull'?1-.82*Math.max(0,(wind-.5)/.5):1);
    const night=(env.night||0)>.55,rain=(env.rain||0)>.4;
    if(system.time>=a.scatterAt) {
      const away=a.p.clone().sub(a.strike);away.y=0;if(away.lengthSq()<.01)away.set(Math.cos(a.seed),0,Math.sin(a.seed));
      const end=a.p.clone().addScaledVector(away.normalize(),8);end.y+=5;
      transition(a,'scatter',end,2.6+(a.seed%5)*.1);a.scatterAt=Infinity;a.scatterUntil=system.time+3.3;a.settleUntil=system.time+9;a.clearAt=null;
    }
    const nativePolicy=f.nativeFlightPolicies?.get(i);
    const startled=system.time<a.scatterUntil,wantPerch=!nativePolicy?.flightOnly&&(night||(rain&&f.key!=='gull')||system.time<a.settleUntil);
    a.reason=startled?'lightning':rain&&f.key!=='gull'?'rain':night?'night':system.time<a.settleUntil?'lightning-settle':f.key==='gull'&&wind>.7?'wind':rain?'rain-low-flight':'normal';
    const anchor=a.perch?birdPerchAnchor(a.perch,system.time+system.clockOffset,env):null;
    if(!startled&&wantPerch&&anchor&&!['landing','perched'].includes(a.mode)) {transition(a,'landing',anchor,5+(a.seed%4)*.4);a.clearAt=null;}
    if(!startled&&!wantPerch&&['perched','landing'].includes(a.mode)) {
      a.clearAt??=system.time+2+(a.seed%5);
      if(system.time>=a.clearAt) {transition(a,'takeoff',flightPoint(system,f,i,a.phase+5,env),5);a.clearAt=null;}
    }else if(wantPerch)a.clearAt=null;
    if(a.transition) {
      const tr=a.transition;tr.elapsed=Math.min(tr.duration,tr.elapsed+dt);
      if(a.mode==='landing'&&anchor){const d=anchor.clone().sub(tr.end);tr.end.copy(anchor);tr.c2.add(d);}
      const raw=tr.elapsed/tr.duration,u=smooth(raw),v=1-u;
      a.p.copy(tr.start).multiplyScalar(v*v*v).addScaledVector(tr.c1,3*v*v*u).addScaledVector(tr.c2,3*v*u*u).addScaledVector(tr.end,u*u*u);
      a.flightState=a.mode==='landing'?(raw>.6?'flare':'bank'):'climb';
      if(a.mode==='landing'){a.v.y*=Math.exp(-dt*8*Math.max(0,(raw-.65)/.35));a.bank*=Math.exp(-dt*8*Math.max(0,(raw-.65)/.35));}
      if(raw>=1){a.mode=a.mode==='landing'?'perched':'flight';a.transition=null;}
    }else if(a.mode==='perched'){a.p.copy(anchor);a.flightState='perched';}
    else {
      const d=flightPoint(system,f,i,a.phase,env).sub(a.p),speed=f.key==='gull'&&wind>.7?1:f.key==='macaw'?4.8:5.5;
      a.p.addScaledVector(d,Math.min(1,dt*speed/Math.max(d.length(),.001)));
      a.flightState=a.v.y>.15?'climb':f.flap(i,a.phase)>.5?'flap':'glide';
    }
    constrainNativeBird(system,f,i,a,dt);
    if(nativePolicy?.flightOnly&&(night||rain)&&!startled)a.reason=night?'native-flight-only-night':'native-flight-only-rain';
    const velocity=a.p.clone().sub(old).multiplyScalar(1/dt);
    if(velocity.lengthSq()>1e-5&&a.mode!=='perched') {
      const turn=Math.atan2(a.v.x*velocity.z-a.v.z*velocity.x,a.v.x*velocity.x+a.v.z*velocity.z)/dt;
      a.bank+=(THREE.MathUtils.clamp(-turn*.6,-.7,.7)-a.bank)*(1-Math.exp(-dt*4));a.v.lerp(velocity,1-Math.exp(-dt*8));
      if(a.mode==='landing'&&a.transition){const level=smooth((a.transition.elapsed/a.transition.duration-.65)/.35);a.v.y*=1-level;a.bank*=1-level;}
    }
    if(a.mode==='perched'){a.v.y=0;a.bank*=Math.exp(-dt*8);}
    const progress=a.transition?a.transition.elapsed/a.transition.duration:1,fold=a.mode==='perched'?1:a.mode==='landing'?Math.max(0,(progress-.65)/.35):0;
    a.fold+=(fold-a.fold)*(1-Math.exp(-dt*10));
    const flap=a.mode==='perched'?0:a.flightState==='climb'?1:a.flightState==='flare'?.45:f.flap(i,a.phase);
    a.flap+=(flap-a.flap)*(1-Math.exp(-dt*3));
  }
}
