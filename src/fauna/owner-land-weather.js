import {habitatPoint} from './owner-land-habitat.js';
// Rain alone is not proof of a storm (manual calm wind is supported).
// Parent should supply weatherState or storm from the actual Weather.state.
export function landStorm(env={}) {
 return env.storm===true||env.weatherState==='storm'||env.state==='storm'||(env.lightning??0)>.1||(env.wind??0)>.8||((env.rain??0)>.9&&(env.wind??0)>.65);
}
export function habitatNeedsCover(key,env={}) {return landStorm(env)||(key!=='rhino'&&(env.rain??0)>.6);}
const finiteBox=c=>c?.source==='leaf-instance-bounds'&&['minX','maxX','minZ','maxZ','minY','maxY'].every(k=>Number.isFinite(c[k]));
/** Full native circular footprint beneath actual leaf-instance AABB, NOT rain occlusion.
 * No collision-radius proxy, remote connector, or newly invented canopy is accepted.
 * Vertical allowance includes measured native body above sole + local slope and
 * twice the admitted roughness. Runtime skin top is checked independently in QA.
 */
export function qualifyHabitatCover(route,records,{radius,bodyAboveSole,maxRoughness=.26},hf) {
 const boxes=records.map(r=>r.envelope).filter(finiteBox),samples=[];
 let bestHorizontalMargin=-Infinity,bestOverheadMargin=-Infinity,horizontalSamples=0;
 for(let i=0;i<1024;i++){
  const angle=i/1024*Math.PI*2,p=habitatPoint(route,angle),y=hf.heightAt(p.x,p.z),e=.5;
  const slope=Math.hypot((hf.heightAt(p.x+e,p.z)-hf.heightAt(p.x-e,p.z))/(2*e),(hf.heightAt(p.x,p.z+e)-hf.heightAt(p.x,p.z-e))/(2*e));
  const top=y+bodyAboveSole+2*radius*slope+2*maxRoughness+.1;
  for(const box of boxes){
   const margin=Math.min(p.x-box.minX,box.maxX-p.x,p.z-box.minZ,box.maxZ-p.z)-radius;
   bestHorizontalMargin=Math.max(bestHorizontalMargin,margin);
   if(margin<.05)continue;horizontalSamples++;
   const overhead=box.minY-top;bestOverheadMargin=Math.max(bestOverheadMargin,overhead);
   if(Number.isFinite(overhead)&&overhead>=.05)samples.push({angle,x:p.x,z:p.z,margin,overhead,top,envelope:{...box}});
  }
 }
 const reason=samples.length?'qualified-full-footprint-under-leaf-envelope':!boxes.length?'no-measured-leaf-envelopes':!horizontalSamples?'no-full-native-footprint-on-loop-under-canopy':'on-loop-canopy-has-insufficient-qualified-headroom';
 return {samples,report:{available:!!samples.length,reason,leafEnvelopes:boxes.length,qualifiedSamples:samples.length,horizontalSamples,bestHorizontalMargin:Number.isFinite(bestHorizontalMargin)?bestHorizontalMargin:null,bestOverheadMargin:Number.isFinite(bestOverheadMargin)?bestOverheadMargin:null,bodyAboveSole,footprintRadius:radius,scope:'1024-on-loop-phases; leaf-envelope-not-rain-occlusion'}};
}
