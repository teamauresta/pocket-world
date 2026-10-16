import * as T from 'three';
const v=new T.Vector3();
export const median=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:0;};
/** Samples actual supplied clip/skin, never rewrites native bone transforms. */
export function calibrateOwnerLand(instance,profile,{samples=72}={}) {
 const footBones=profile.feet.map(name=>{const b=instance.model.getObjectByName(name);if(!b?.isBone)throw Error(profile.key+': missing native foot '+name);return b;});
 const footSets=footBones.map(b=>{const set=new Set();b.traverse(c=>{if(c.isBone)set.add(c);});return set;}); const meshes=[];instance.model.traverse(m=>{if(m.isMesh&&m.geometry?.attributes.position)meshes.push(m);});
 const clips={};let supportSamples=[];let radius=0,triangles=0,bodyAboveSole=0;for(const m of meshes)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
 for(const name of new Set([profile.walk,profile.rest].filter(Boolean))){const info=instance.clips.find(c=>c.name===name);if(!info)throw Error('Missing exact authored clip '+name);
  const action=instance.play(name,{fade:0});action.reset();instance.mixer.update(0);instance.root.updateMatrixWorld(true);
  const frames=[],soleIndices=footBones.map(()=>[]);
  for(const mesh of meshes){mesh.skeleton?.update();const groups=footBones.map(()=>[]);for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);let j=-1,bestWeight=.5;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;if(!mesh.skeleton||!si||!sw)continue;for(let k=0;k<footSets.length;k++){let weight=0;for(let c=0;c<4;c++)if(footSets[k].has(mesh.skeleton.bones[si.getComponent(i,c)]))weight+=sw.getComponent(i,c);if(weight>bestWeight){bestWeight=weight;j=k;}}if(j>=0)groups[j].push({i,y:v.y});}
   for(let k=0;k<groups.length;k++){groups[k].sort((a,b)=>a.y-b.y);soleIndices[k].push(...groups[k].filter(q=>q.y<=groups[k][0].y+profile.size*.018).map(q=>({mesh,index:q.i,bone:profile.feet[k]})));}}
  if(name===profile.walk)supportSamples=soleIndices.flat();
  for(let n=0;n<=samples;n++){if(n)instance.update(info.duration/samples);instance.root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton?.update();
   const feet=footBones.map(b=>b.getWorldPosition(new T.Vector3()).toArray()),sole=soleIndices.map((list,k)=>{if(!list.length)return feet[k][1];return Math.min(...list.map(q=>q.mesh.getVertexPosition(q.index,v).applyMatrix4(q.mesh.matrixWorld).y));});
   if(n%6===0)for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);radius=Math.max(radius,Math.hypot(v.x,v.z));bodyAboveSole=Math.max(bodyAboveSole,v.y-Math.min(...sole));}
   frames.push({feet,sole});
  }
  const velocities=[],perFoot=[];for(let k=0;k<footBones.length;k++){const ys=frames.map(f=>f.feet[k][1]),low=Math.min(...ys),high=Math.max(...ys),values=[];for(let n=1;n<samples;n++){const velocity=(frames[n].feet[k][2]-frames[n-1].feet[k][2])/(info.duration/samples);if(frames[n].feet[k][1]<low+Math.max(.025,(high-low)*.3)&&velocity<-.03)values.push(-velocity);}perFoot.push({bone:profile.feet[k],speed:median(values),samples:values.length,yRange:high-low});velocities.push(...values);}
  const minSole=frames.map(f=>Math.min(...f.sole));clips[name]={duration:info.duration,speed:median(velocities),perFoot,groundLift:-median(minSole),groundRange:Math.max(...minSole)-Math.min(...minSole),frames};
 }
 instance.stop();return {radius:radius+.08,bodyAboveSole:bodyAboveSole+.08,triangles,clips,footBones,supportSamples};
}
export function ownOwnerMaterials(instance){const map=new Map();instance.model.traverse(o=>{if(!o.material)return;const copy=m=>{if(!map.has(m)){const clone=m.clone();if(m.defines)clone.defines={...m.defines};map.set(m,clone);}return map.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);o.castShadow=true;o.receiveShadow=true;});return [...map.values()];}
