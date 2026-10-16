/** Independent native sea population; never aliases whale to shark. */
import * as THREE from 'three';
import {loadImportedAsset} from '../creatures/imported-assets.js';
import {createImportedMaterialLoader} from '../creatures/imported-materials.js';
import {makeSkinnedEnvelope} from './imported-visual.js';
import {createOwnerSeaMotion} from './owner-sea-motion.js';
import {createWhaleArticulation,whaleDepthCycle,qualifyWhaleRoute,WHALE_LIFE} from './owner-whale-life.js';
import {HALF,CELL} from '../world/config.js';
import {patchUnderwater} from '../render/shared.js';
const profile=p=>Object.freeze({count:1,rotation:[0,Math.PI/2,0],rootMotion:'retain bounded native swim oscillation; carrier adds only route motion',...p});
export const OWNER_SEA_PROFILES=Object.freeze({
 whale:profile({file:'rigged_whale.glb',clip:'whale_1_armature|whale_1_armatureAction',size:10,speed:1.35,triangles:10068,breath:true,mode:'individual',rootMotion:'native cyclic bob retained; generated native-spine vertical propulsion; qualified forward circuit',license:'SKETCHFAB Standard — private owner preview only'}),
 school:profile({file:'school_of_fish.glb',clip:'swimming',size:6,speed:.45,triangles:8932,mode:'school-centre',rootMotion:'retain all nine authored cyclic member trajectories inside full formation envelope',members:9,rotation:[0,0,0],license:'CC-BY-4.0'}),
 fish:profile({file:'fish.glb',size:1.4,speed:.7,triangles:3926,count:2,generated:'fish',mode:'individual',license:'SKETCHFAB Standard — private owner preview only'}),
 coralFish:profile({file:'coral_fish.glb',size:1.25,speed:.5,triangles:2672,count:2,rotation:[0,Math.PI,0],generated:'coralFish',mode:'individual',license:'CC-BY-4.0'}),
 turtle:profile({file:'sea_turtle_low_poly.glb',size:3.4,speed:.55,triangles:16218,rotation:[0,-Math.PI/2,0],generated:'turtle',breath:true,mode:'individual',license:'CC-BY-4.0'}),
 shark:profile({file:'derived/shark-near.glb',farFile:'derived/shark-far.glb',clip:'Shark Rig|swimming_skeletal.3',size:6,speed:1.35,derivedRequired:true,mode:'individual',license:'CC-BY-4.0'}),
 dolphin:profile({file:'derived/dolphin-near.glb',farFile:'derived/dolphin-far.glb',clip:'Swim Cycle',size:5.2,speed:1.7,derivedRequired:true,breath:true,mode:'individual',license:'CC-BY-NC-4.0'}),
});
export async function loadOwnerSeaAssets(urls,{loader=createImportedMaterialLoader()}={}){
 const result={};try{for(const [kind,input] of Object.entries(urls)){
  if(!OWNER_SEA_PROFILES[kind])throw new Error('Unknown sea profile '+kind);
  const spec=typeof input==='string'?{near:input}:input;
  result[kind]={near:await loadImportedAsset({url:spec.near,loader})};
  if(spec.far)result[kind].far=await loadImportedAsset({url:spec.far,loader});
 }return result;}catch(e){for(const a of Object.values(result)){a.near.dispose();a.far?.dispose();}throw e;}
}
/** Exact bilinear-terrain maximum on rectangle, including edge intersections. */
export function seaFloorMaximum(hf,minX,maxX,minZ,maxZ){
 if(minX< -HALF||maxX>HALF||minZ< -HALF||maxZ>HALF)return Infinity;
 let floor=-Infinity;const xs=[minX,maxX],zs=[minZ,maxZ];
 for(let i=Math.ceil((minX+HALF)/CELL);i<=Math.floor((maxX+HALF)/CELL);i++)xs.push(-HALF+i*CELL);
 for(let j=Math.ceil((minZ+HALF)/CELL);j<=Math.floor((maxZ+HALF)/CELL);j++)zs.push(-HALF+j*CELL);
 for(const x of xs)for(const z of zs)floor=Math.max(floor,hf.heightAt(x,z));return floor;
}
const triangleCount=i=>{let n=0;i.model.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export async function createOwnerSeaPack({hf,assets,quality='high',samples=180}={}){
 if(typeof hf?.heightAt!=='function'||!assets)throw new Error('Explicit heightfield and assets required');
 if(!['high','low','medium'].includes(quality)||samples<60)throw new Error('Invalid sea quality/sampling');
 const group=new THREE.Group();group.name='owner-native-sea-pack';const actors=[],missing=Object.keys(OWNER_SEA_PROFILES).filter(k=>!assets[k]);let time=0,disposed=false,camera=null;
 function disposeActor(a){for(const v of a.visuals){v.motion?.dispose();for(const m of v.materials||[])m.dispose();v.instance.dispose();}a.root.removeFromParent();}
 try{for(const [kind,input] of Object.entries(assets)){
  const p=OWNER_SEA_PROFILES[kind];if(!p)throw new Error('Unknown sea species '+kind);const asset=input.near||input;
  for(let index=0;index<p.count;index++){
   const a={kind,index,profile:p,root:new THREE.Group(),visuals:[],p:new THREE.Vector3(),target:new THREE.Vector3(),yaw:0,bank:0,phase:0,breaths:0,burstUntil:0,reason:'normal',breathMode:'swim'};
   actors.push(a);group.add(a.root);a.root.name='owner-'+kind+'-'+index;
   const envelope=new THREE.Box3().makeEmpty();
   for(const [tier,source] of [['near',asset],['far',input.far]].filter(x=>x[1])){
    const instance=source.instantiate({size:p.size,align:'center',rotation:p.rotation,referenceClip:p.clip||null});
    const v={tier,instance,triangles:triangleCount(instance)};a.visuals.push(v);a.root.add(instance.root);
    if(v.triangles>=(tier==='far'?5000:20000))throw new Error(kind+' '+tier+' exceeds strict triangle budget');
    v.motion=p.generated?createOwnerSeaMotion(instance,p.generated,p.size):null;
    v.hull=v.motion?()=>instance.bounds():makeSkinnedEnvelope(instance.model,{morph:true});
    v.action=p.clip?instance.play(p.clip,{fade:0}):null;
    v.articulation=kind==='whale'?createWhaleArticulation(instance):null;
    for(let k=0;k<=samples;k++){
     if(v.action){v.articulation?.restore();v.action.time=k/samples*v.action.getClip().duration;instance.update(0);v.articulation?.apply(k/samples*Math.PI*2);}else v.motion.apply(k/samples*Math.PI*2);
     envelope.union(v.hull());
     if(k&&k%30===0&&typeof requestAnimationFrame==='function')await new Promise(requestAnimationFrame);
    }
    const materials=new Map();v.materials=[];instance.model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=false;o.userData.label=kind+' · owner native sea';const list=[o.material].flat().map(m=>{if(!materials.has(m)){const own=m.clone(),prior=m.onBeforeCompile,key=m.customProgramCacheKey();own.defines={...m.defines,...own.defines};if(own.specGlossMap)own.defines.OWNER_SPEC_GLOSS_MAP=1;own.onBeforeCompile=function(s,r){prior.call(this,s,r);patchUnderwater(s,{caustics:.8});};own.customProgramCacheKey=()=>key+'-owner-native-sea-v1';materials.set(m,own);v.materials.push(own);}return materials.get(m);});o.material=Array.isArray(o.material)?list:list[0];}});
   }
   if(p.mode==='school-centre'){const center=envelope.getCenter(new THREE.Vector3());for(const v of a.visuals)v.instance.root.position.sub(center);envelope.translate(center.negate());}
   a.envelope=envelope.clone().expandByScalar(.08);a.extent=new THREE.Vector3(Math.max(Math.abs(a.envelope.min.x),Math.abs(a.envelope.max.x)),Math.max(Math.abs(a.envelope.min.y),Math.abs(a.envelope.max.y)),Math.max(Math.abs(a.envelope.min.z),Math.abs(a.envelope.max.z)));
   // Include the long nose/tail under pitch, never shrink the support proxy.
   a.radius=kind==='whale'?a.extent.length():Math.hypot(a.extent.x,a.extent.z);a.vertical=a.extent.y+a.extent.z*Math.sin(.12)+(kind==='whale'?a.extent.x*Math.sin(WHALE_LIFE.maxPitch):0);
   if(kind==='whale')a.whaleRoute=qualifyWhaleRoute(hf,a.radius,a.vertical,seaFloorMaximum,HALF);
   a.sites=[];const limit=HALF-a.radius-.25;
   for(let x=-limit;x<=limit;x+=5)for(let z=-limit;z<=limit;z+=5){
    if(x+z<10)continue;
    const floor=seaFloorMaximum(hf,x-a.radius,x+a.radius,z-a.radius,z+a.radius);
    if(floor+a.vertical+.25< -a.vertical-.22)a.sites.push({x,z,floor});
   }
   if(!a.sites.length)throw new Error('No full-envelope water column for '+kind+' '+JSON.stringify({min:a.envelope.min.toArray(),max:a.envelope.max.toArray(),radius:a.radius,vertical:a.vertical}));
  }
 }}catch(e){actors.forEach(disposeActor);throw e;}
 function setPose(a){a.root.position.copy(a.p);a.root.rotation.set(a.bank,-a.yaw,a.pitch||0,a.kind==='whale'?'YZX':'YXZ');a.root.updateMatrixWorld(true);}
 function localBounds(a){const box=new THREE.Box3().makeEmpty();for(const v of a.visuals){v.instance.root.updateWorldMatrix(true,true);if(v.motion){const inv=a.root.matrixWorld.clone().invert(),point=new THREE.Vector3();v.instance.model.traverse(o=>{if(o.isMesh){const matrix=inv.clone().multiply(o.matrixWorld),pos=o.geometry.attributes.position;for(let j=0;j<pos.count;j++)box.expandByPoint(point.fromBufferAttribute(pos,j).applyMatrix4(matrix));}});}else box.union(v.hull(a.root.matrixWorld.clone().invert()));}return box;}
 function floorAt(a,x=a.p.x,z=a.p.z){return seaFloorMaximum(hf,x-a.radius,x+a.radius,z-a.radius,z+a.radius);}
 function choose(a){const seed=(a.route++*7+a.index*11+Object.keys(OWNER_SEA_PROFILES).indexOf(a.kind)*13)%a.sites.length;const s=a.sites[seed];a.target.set(s.x,s.floor*.52,s.z);}
 function fit(a){
  const limit=HALF-a.radius-.16;a.p.x=THREE.MathUtils.clamp(a.p.x,-limit,limit);a.p.z=THREE.MathUtils.clamp(a.p.z,-limit,limit);
  let floor=floorAt(a),low=floor+a.vertical+.16,top=-a.vertical-.12;
  if(low>top){if(a.safe)a.p.copy(a.safe);else{const s=a.sites[0];a.p.set(s.x,s.floor/2,s.z);}floor=floorAt(a);low=floor+a.vertical+.16;}
  a.p.y=THREE.MathUtils.clamp(a.p.y,low,top);setPose(a);
  const box=localBounds(a).applyMatrix4(a.root.matrixWorld),actualFloor=seaFloorMaximum(hf,box.min.x,box.max.x,box.min.z,box.max.z);
  a.error=box.min.x< -HALF||box.max.x>HALF||box.min.z< -HALF||box.max.z>HALF||box.min.y<actualFloor+.08||box.max.y>-.03?'pose-clearance':null;
  a.root.visible=!a.error;if(!a.error)a.safe=a.p.clone();a.bounds={min:box.min.toArray(),max:box.max.toArray(),floor:actualFloor};
 }
 function stepWhale(a,dt,env){
  const r=a.whaleRoute,night=(env.night||0)>.55,storm=(env.rain||0)>.65;
  const burst=time<a.burstUntil,pace=(night?.72:1)*(burst?1.4:1);
  // One authored cycle per additive stroke; phases cannot drift apart.
  a.phase+=dt*Math.PI*2/WHALE_LIFE.period*pace;
  const speed=a.profile.speed*pace*(1+.10*Math.sin(2*a.phase));
  const oldYaw=a.yaw,oldY=a.p.y;
  const tangent=Math.hypot(r.rx*Math.sin(a.routeAngle),r.rz*Math.cos(a.routeAngle));
  a.routeAngle+=dt*speed/tangent;
  a.p.x=r.x+r.rx*Math.cos(a.routeAngle);a.p.z=r.z+r.rz*Math.sin(a.routeAngle);
  a.yaw=Math.atan2(r.rz*Math.cos(a.routeAngle),-r.rx*Math.sin(a.routeAngle));
  a.bank=THREE.MathUtils.clamp(-wrap(a.yaw-oldYaw)/Math.max(dt,.0001)*.45,-WHALE_LIFE.maxBank,WHALE_LIFE.maxBank);
  const shallow=-a.vertical-.16,deep=Math.max(r.floor+a.vertical+.5,shallow-4);
  const cycle=whaleDepthCycle(time,deep,shallow);
  const nextMode=storm||burst?'cruise':cycle.mode;
  if(nextMode==='surface-pass'&&a.breathMode!=='surface-pass')a.breaths++;
  a.breathMode=nextMode;
  const targetY=storm||burst?deep:cycle.y;
  const vy=THREE.MathUtils.clamp((targetY-oldY)*1.8,-speed*Math.tan(.20),speed*Math.tan(.20));
  a.p.y+=vy*dt;a.pitch=Math.atan2(vy,speed);
  a.reason=burst?'lightning':storm?'storm-depth':night?'night-cruise':cycle.mode;
  a.target.set(r.x+r.rx*Math.cos(a.routeAngle+.12),targetY,r.z+r.rz*Math.sin(a.routeAngle+.12));
  for(const v of a.visuals){v.articulation.restore();v.action.time=(a.phase/(Math.PI*2)%1)*v.action.getClip().duration;v.instance.update(0);v.articulation.apply(a.phase);}
  fit(a);
 }
 function step(dt,env){time+=dt;const storm=(env.rain||0)>.65&&(env.waves??env.wind??0)>.65,night=(env.night||0)>.55;
  for(const a of actors){const p=a.profile;if(a.kind==='whale'){stepWhale(a,dt,env);continue;}
   if(p.breath&&a.breathMode==='swim'&&time>=a.breathDue){a.breathMode='ascend';a.hold=0;}
   if(a.breathMode==='ascend'&&a.p.y>=-a.vertical-.19){a.breathMode='hold';a.breaths++;}
   if(a.breathMode==='hold'){a.hold+=dt;if(a.hold>=3)a.breathMode='descend';}
   if(a.breathMode==='descend'&&a.p.y< -a.vertical-1){a.breathMode='swim';a.breathDue=time+35;}
   a.reason=a.breathMode!=='swim'?'surface-approach':time<a.burstUntil?'lightning':storm?'storm-depth':night?'night-rest':'normal';
   if(Math.hypot(a.target.x-a.p.x,a.target.z-a.p.z)<1.4||Math.abs(a.target.x)>HALF-a.radius-.25||Math.abs(a.target.z)>HALF-a.radius-.25)choose(a);
   const angle=Math.atan2(a.target.z-a.p.z,a.target.x-a.p.x),turn=THREE.MathUtils.clamp(wrap(angle-a.yaw),-.6*dt,.6*dt);a.yaw+=turn;
   a.bank+=(THREE.MathUtils.clamp(-turn/Math.max(dt,.0001)*.15,-.12,.12)-a.bank)*Math.min(1,dt*3);
   const speed=p.speed*(time<a.burstUntil?1.8:night?.45:1)*(a.breathMode==='hold'?.15:1),previous=a.p.clone();a.p.x+=Math.cos(a.yaw)*speed*dt;a.p.z+=Math.sin(a.yaw)*speed*dt;
   let floor=floorAt(a);if(floor+a.vertical+.2> -a.vertical-.12){a.p.copy(previous);choose(a);floor=floorAt(a);}
   const targetY=a.breathMode==='ascend'||a.breathMode==='hold'?-a.vertical-.12:floor*(storm?.78:night?.7:.5);
   a.p.y+=THREE.MathUtils.clamp(targetY-a.p.y,-.85*dt,.85*dt);a.phase+=dt*(p.generated==='turtle'?2.4:5)*(night?.6:1);
   for(const v of a.visuals){if(v.motion)v.motion.apply(a.phase);else v.instance.update(dt*(night?.6:1));}fit(a);
  }
 }
 function applyDetail(){for(const a of actors){const far=a.visuals.find(v=>v.tier==='far'),distance=camera?camera.position.distanceTo(a.p):0;for(const v of a.visuals)v.instance.root.visible=!far||((distance>(quality==='low'?18:30))===(v.tier==='far'));}}
 const api={group,actors,profiles:OWNER_SEA_PROFILES,
  update(dt,env={}){if(disposed)throw new Error('Sea pack disposed');if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid sea delta');if(!dt)return;let left=dt;while(left>1e-9){const h=Math.min(left,1/30);step(h,env);left-=h;}applyDetail();},
  updateDetailView(c,{quality:q=quality}={}){if(c!==null&&!c?.isCamera)throw new Error('Camera required');if(!['high','medium','low'].includes(q))throw new Error('Invalid quality');camera=c;quality=q;applyDetail();},
  onStrike(event={}){const p=Array.isArray(event.position)?new THREE.Vector3(...event.position):event.position;if(!p||![p.x,p.z].every(Number.isFinite))return;for(const a of actors)if(Math.hypot(a.p.x-p.x,a.p.z-p.z)<30){a.burstUntil=time+2.5;a.target.set(a.p.x+(a.p.x-p.x||1)*3,a.p.y-2,a.p.z+(a.p.z-p.z||1)*3);}},
  reset(){time=0;for(const a of actors){a.route=0;a.yaw=0;a.bank=0;a.pitch=0;a.routeAngle=-Math.PI/2;a.phase=a.index*1.7;a.breaths=0;a.burstUntil=0;a.breathMode='swim';a.breathDue=12+Object.keys(OWNER_SEA_PROFILES).indexOf(a.kind)*3;a.safe=null;a.reason='normal';choose(a);a.p.copy(a.target);choose(a);for(const v of a.visuals){if(v.motion)v.motion.apply(a.phase);else{v.articulation?.restore();v.instance.stop();v.instance.mixer.setTime(0);v.action=v.instance.play(a.profile.clip,{fade:0});v.action.time=a.index*.37;v.instance.update(0);v.articulation?.apply(a.phase);}}if(a.kind==='whale'){const r=a.whaleRoute;a.p.set(r.x,Math.max(r.floor+a.vertical+.5,-a.vertical-4.16),r.z-r.rz);a.yaw=0;stepWhale(a,0,{});}else fit(a);}applyDetail();},
  snapshot(){return {backend:'owner-native-sea',time,quality,missing,actors:actors.map(a=>({kind:a.kind,index:a.index,controller:a.profile.mode,rootMotion:a.profile.rootMotion,members:a.profile.members||1,position:a.p.toArray(),target:a.target.toArray(),yaw:a.yaw,bank:a.bank,pitch:a.pitch||0,strokePhase:a.kind==='whale'?a.phase:undefined,whaleRoute:a.whaleRoute,reason:a.reason,breathMode:a.breathMode,surfaceApproaches:a.breaths,breathingCapability:'approach-only; no verified blowhole/nostril air contact',visible:a.root.visible,error:a.error,bounds:a.bounds,envelope:[a.envelope.min.toArray(),a.envelope.max.toArray()],radius:a.radius,visuals:a.visuals.map(v=>({tier:v.tier,triangles:v.triangles,clip:v.instance.activeClip,motion:v.articulation?.kind||v.motion?.kind||'authored-swim',time:v.articulation?a.phase/(Math.PI*2)*WHALE_LIFE.period:v.instance.mixer.time,clipTime:v.action?.time,visible:v.instance.root.visible}))}))};},
  getCandidates(){return actors.map(a=>({kind:a.kind,index:a.index,object:a.root,position:a.p.clone(),radius:a.radius,mode:a.profile.mode}));},
  dispose(){if(disposed)return;disposed=true;actors.forEach(disposeActor);group.removeFromParent();}
 };api.reset();return api;
}
