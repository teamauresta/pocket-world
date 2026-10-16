/** Generated additive articulation on the supplied whale's native spine, not a new
 * authored clip. Bone lengths/scales and source geometry remain unchanged. */
import * as THREE from 'three';
export const WHALE_LIFE = Object.freeze({period:3.6,maxPitch:.22,maxBank:.10,cycle:48});
export function createWhaleArticulation(instance){
 const names=['spine_2_02','spine_3_03','spine_4_04','spine_5_05'];
 const bones=names.map(n=>instance.model.getObjectByName(n));
 if(bones.some(b=>!b?.isBone))throw new Error('Whale native spine not found; cannot substitute generic deformation');
 const axis=new THREE.Vector3(1,0,0),q=new THREE.Quaternion();
 let previous=[];
 const amplitudes=[.018,.055,.10,.14],lags=[0,.35,.7,1.0];
 return {kind:'authored-swim + generated-native-spine-propulsion',bones,
  restore(){for(let i=0;i<previous.length;i++)bones[i].quaternion.copy(previous[i]);previous=[];},
  // Call immediately AFTER the mixer evaluates the authored pose, never cumulatively.
  apply(phase){previous=bones.map(b=>b.quaternion.clone());for(let i=0;i<bones.length;i++)bones[i].quaternion.multiply(q.setFromAxisAngle(axis,amplitudes[i]*Math.sin(phase-lags[i])));instance.root.updateMatrixWorld(true);},
 };
}
/** Smooth, continuously swimming rise / near-surface pass / dive. No claim of
 * breathing: the supplied mesh has no qualified blowhole air-contact landmark. */
export function whaleDepthCycle(time,deep,shallow){
 const t=((time%WHALE_LIFE.cycle)+WHALE_LIFE.cycle)%WHALE_LIFE.cycle;
 const ease=x=>.5-.5*Math.cos(Math.PI*x);
 if(t<10)return {y:deep,mode:'cruise'};
 if(t<20)return {y:THREE.MathUtils.lerp(deep,shallow,ease((t-10)/10)),mode:'ascend'};
 if(t<25)return {y:shallow,mode:'surface-pass'};
 if(t<37)return {y:THREE.MathUtils.lerp(shallow,deep,ease((t-25)/12)),mode:'descend'};
 return {y:deep,mode:'cruise'};
}
/** Qualified closed oval. Swept support includes all headings AND articulation,
 * so the route cannot nose into a shelf then freeze while turning. */
export function qualifyWhaleRoute(hf,radius,vertical,floorMaximum,half){
 let best=null;
 for(const r of [9,8,7,6])for(let x=22;x<=36;x+=2)for(let z=24;z<=38;z+=2){
  const rx=r*1.25,rz=r*.72;
  if(Math.max(x+rx+radius,z+rz+radius)>=half-.2)continue;
  // Swept circle: every angular interval is covered by an expanded sample
  // rectangle (arc travel <= max(rx,rz)*dTheta/2). Interior land is irrelevant.
  const pad=Math.max(rx,rz)*Math.PI/96;let floor=-Infinity;
  for(let k=0;k<96;k++){const t=k*Math.PI*2/96,cx=x+rx*Math.cos(t),cz=z+rz*Math.sin(t),r=radius+pad;
   floor=Math.max(floor,floorMaximum(hf,cx-r,cx+r,cz-r,cz+r));
  }
  const room=-2*vertical-floor-.66;
  if(room>1.8&&(!best||room>best.room))best={x,z,rx,rz,floor,room};
 }
 if(best)return best;
 throw new Error('No qualified full-envelope whale circuit: '+JSON.stringify({radius,vertical}));
}
