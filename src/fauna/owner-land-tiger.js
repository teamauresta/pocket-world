import * as T from 'three';
import {createOwnerTigerPatrol} from './owner-tiger-patrol.js';
import {createOwnerTigerMotion} from '../creatures/owner-tiger-motion.js';
/** Adapter only. The original assets and 121-bone hierarchy are unchanged.
 * This explicit real-Heightfield closed patrol replaces the finite corridor.
 * Qualification: review/owner-tiger-patrol-evidence/qualified.json.
 * Broader arbitrary terrain/turnaround is NOT implied by these route-only bounds.
 */
export const OWNER_LAND_TIGER_PROFILE=Object.freeze({key:'tiger',size:2.8,home:'meadow',yaw:0,walk:'GeneratedWalk',rest:'Idle',restMode:'authored-idle-plus-native-stance',motionLabel:'generated-native-ribbon-IK-not-authored',pace:1,turnRate:.14,maxSlope:.10,maxRoughness:.09,spawn:[35.25,-39.5],initialYaw:0,qualifiedSegment:true,qualifiedPatrol:true,routeCapability:'closed-qualified-native-patrol',feet:[]});
export function createOwnerLandTigerFactory(hf){return(asset,profile)=>{
 const tiger=createOwnerTigerMotion(asset,{size:profile.size}),instance=tiger.native;let triangles=0;
 instance.model.traverse(m=>{if(m.geometry)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
 // Full actual native bounds, no artificially reduced obstacle footprint.
 const b=new T.Box3().setFromObject(tiger.root,true),radius=Math.max(Math.hypot(b.min.x,b.min.z),Math.hypot(b.max.x,b.max.z))+.1;
 const patrol=createOwnerTigerPatrol();let angularSpeed=0;
 return {instance,calibration:{radius,triangles,clips:{GeneratedWalk:{speed:.25,groundLift:0},Idle:{speed:0,groundLift:0}}},walk(){},rest(){},
  routeStep(dt,a,safe){if(!profile.qualifiedSegment)return false;
   const p=patrol.step(dt,safe);a.p.set(p.x,p.z);a.yaw=p.yaw;a.speed=p.speed;angularSpeed=p.angularSpeed;
   a.state=p.blocked?'rest-patrol-blocked':'walk-qualified-patrol';return true;
  },
  place(root,yaw){root.rotation.set(0,yaw-Math.PI/2,0);},
  update(dt,{speed}){tiger.update(dt,{speed,angularSpeed,state:'Walk',ground:(x,z)=>hf.heightAt(x,z)});},
  reset(){patrol.reset();angularSpeed=0;tiger.reset();},dispose(){tiger.dispose();},tiger,patrol};
};}
