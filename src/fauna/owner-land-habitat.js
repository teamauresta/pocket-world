/** Native-footprint-qualified habitat loops. Terrain/obstacles are never modified.
 * Ellipse curvature limits speed before tight bends; authored gait time follows
 * actual carrier distance. Optional profiles only: tiger's separate controller is untouched.
 */
export const OWNER_LAND_HABITATS=Object.freeze({
 rhino:{x:-1,z:-10.25,major:1.8,minor:.65,angle:0,pace:.62,walkSeconds:16,restSeconds:1.8},
 bear:{x:-17.5,z:13.5,major:.7,minor:.4,angle:Math.PI/3,pace:.36,walkSeconds:13,restSeconds:2.5},
 wolf:{x:-4.5,z:6,major:2,minor:.4,angle:Math.PI/2,pace:.45,walkSeconds:15,restSeconds:2.2},
 alligator:{x:-1.5,z:-5.5,major:.7,minor:.4,angle:Math.PI/6,pace:.22,walkSeconds:10,restSeconds:4,riverbank:true}
});
export function habitatPoint(route,t){const c=Math.cos(route.angle),s=Math.sin(route.angle),x=route.major*Math.cos(t),z=route.minor*Math.sin(t),dx=-route.major*Math.sin(t),dz=route.minor*Math.cos(t);return {x:route.x+x*c-z*s,z:route.z+x*s+z*c,yaw:Math.atan2(dx*c-dz*s,dx*s+dz*c),derivative:Math.hypot(dx,dz),curvature:route.major*route.minor/Math.pow(Math.hypot(dx,dz),3)};}
const TAU=Math.PI*2,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),positive=a=>(a%TAU+TAU)%TAU;
export function createHabitatPatrol(route,safe,hf,{cover={samples:[],report:{available:false,reason:'no-measured-leaf-envelopes'}}}={}){
 const admissible=(x,z)=>{if(!safe(x,z))return false;if(!route.riverbank)return true;const q=hf.riverInfo?.(x,z);return !!q&&q.reach===1&&q.dist-q.width>=1.6&&q.dist-q.width<=3.4&&hf.heightAt(x,z)>q.level+.1;};
 // Every reaction remains on the originally admitted loop. No connector detours.
 for(let i=0;i<512;i++){const p=habitatPoint(route,i/512*TAU);if(!admissible(p.x,p.z))throw Error('Unsafe native habitat loop '+JSON.stringify({route,sample:i,p}));}
 let angle=0,clock=0,travel=0,blocked=false,direction=1,yaw=habitatPoint(route,0).yaw,coverTarget=null,wasWet=false,reaction=null,lastStrike=null;
 const point=()=>({...habitatPoint(route,angle),yaw});
 const distance=(p,s)=>Math.hypot(p.x-s.x,p.z-s.z);
 function strike(x,z){
  if(!Number.isFinite(x+z))return false;
  const start=point(),source={x,z},initialDistance=distance(start,source);
  if(initialDistance>18)return false;
  let best=null;
  for(const dir of [direction,-direction]){
   let t=angle,prev=start,walked=0,prior=initialDistance;
   // At most 1.25m arclength; every sampled phase must increase source distance.
   for(let i=0;i<160;i++){
    const next=t+dir*.01/habitatPoint(route,t).derivative,p=habitatPoint(route,next),d=distance(p,source),delta=distance(p,prev);
    if(walked+delta>1.25||d<=prior+1e-9||!admissible(p.x,p.z)||!admissible((p.x+prev.x)/2,(p.z+prev.z)/2))break;
    walked+=delta;t=next;prev=p;prior=d;
    const gain=d-initialDistance;
    if(gain>.015&&(!best||gain>best.gain+.001))best={target:t,direction:dir,gain,arc:walked};
   }
  }
  lastStrike={source,initialDistance,plannedGain:best?.gain??0,plannedArc:best?.arc??0,reason:best?'bounded-monotonic-on-loop-retreat':'no-increasing-safe-on-loop-arc'};
  reaction={...best,source,left:18,settle:0,unavailable:!best};coverTarget=null;clock=0;
  return true;
 }
 return {coverReport:cover.report,strike,
 reset(){angle=clock=travel=0;blocked=false;direction=1;yaw=habitatPoint(route,0).yaw;coverTarget=null;wasWet=false;reaction=lastStrike=null;},
 step(dt,baseSpeed,wet=false){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(baseSpeed)||baseSpeed<0)throw Error('Invalid habitat step');
  const before=point();let target=null,urgent=false,state,hold=false;
  if(reaction){
   reaction.left-=dt;
   const done=reaction.unavailable||Math.abs(angle-reaction.target)<1e-8||reaction.left<=0;
   if(done){reaction.settle+=dt;hold=true;state=reaction.unavailable?'startled-no-safe-loop-retreat':'strike-hold-after-retreat';if(reaction.settle>=1){reaction=null;clock=0;}}
   else{direction=reaction.direction;target=reaction.target;urgent=true;state='strike-retreat-on-loop';}
  }else if(wet){
   if(!coverTarget&&cover.samples.length){
    // Follow current heading; no pivot is needed to seek canopy, at most one lap.
    let delta=Infinity;
    for(const sample of cover.samples){const d=positive(direction*(sample.angle-angle));if(d<delta){delta=d;coverTarget={...sample,target:angle+direction*d};}}
   }
   if(!coverTarget){hold=true;state='weather-hold-no-qualified-loop-cover';}
   else if(Math.abs(angle-coverTarget.target)<1e-8){hold=true;state='sheltered-under-canopy-envelope';}
   else{target=coverTarget.target;urgent=true;state='seek-canopy-on-loop';}
  }else{if(wasWet)clock=0;coverTarget=null;}
  wasWet=wet;
  if(blocked)return {...before,speed:0,state:'habitat-blocked'};
  const desired=wrap(habitatPoint(route,angle).yaw+(direction<0?Math.PI:0)),error=wrap(desired-yaw);
  if(Math.abs(error)>.00001){yaw=wrap(yaw+Math.sign(error)*Math.min(Math.abs(error),.65*dt));clock+=dt;return {...point(),speed:0,state:reaction?'strike-turn-on-loop':'habitat-align'};}
  const cycle=route.walkSeconds+route.restSeconds,phase=clock%cycle,walking=!hold&&(urgent||phase<route.walkSeconds);
  const ramp=walking?(urgent?Math.min(1,clock/.7):Math.min(1,phase/.7,(route.walkSeconds-phase)/.7)):0;
  const speed=walking?Math.min(baseSpeed*route.pace,.65/Math.max(.01,before.curvature)) * Math.max(0,ramp):0;
  const delta=speed*dt/before.derivative;
  const next=target===null?angle+direction*delta:angle+direction*Math.min(delta,Math.abs(target-angle)),p=habitatPoint(route,next);
  if(!admissible(p.x,p.z)||!admissible((p.x+before.x)/2,(p.z+before.z)/2)){blocked=true;return {...before,speed:0,state:'habitat-blocked'};}
  // Runtime guard also disallows a retreat's discrete chord getting closer.
  if(reaction&&!hold&&distance(p,reaction.source)<distance(before,reaction.source)-1e-9){reaction.target=angle;return {...before,speed:0,state:'strike-hold-after-retreat'};}
  const actual=Math.hypot(p.x-before.x,p.z-before.z)/dt;angle=next;yaw=wrap(p.yaw+(direction<0?Math.PI:0));clock+=dt;travel+=actual*dt;
  return {...p,yaw,speed:actual,state:state||(walking?'walk':'rest')};
 },snapshot:()=>({angle,clock,travel,blocked,direction,yaw,coverTarget:coverTarget?{...coverTarget}:null,reaction:reaction?{...reaction}:null,lastStrike:lastStrike?{...lastStrike}:null})};
}
