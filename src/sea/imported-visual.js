/** Optional imported manta visual backend; original SeaLife steering/safety unchanged. */
import * as THREE from 'three';
import { patchUnderwater } from '../render/shared.js';
export const MANTA_CLIP='manta_ray_armature|ArmatureAction';
/** Positive normalized skin weights are convex combinations. The union of
 * transformed per-bone vertex boxes conservatively bounds the complete skin,
 * including between sampled clip times, without CPU-skinning every vertex. */
export function makeSkinnedEnvelope(root,{morph=false}={}){
  const records=[];root.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,targets=g.morphAttributes.position||[],p=g.attributes.position;
    if(targets.length&&!morph)throw new Error('Unqualified morph targets');
    if(targets.some(t=>t.count!==p.count))throw new Error('Invalid morph topology');
    const delta=(i,t)=>{const v=new THREE.Vector3().fromBufferAttribute(targets[t],i);if(!g.morphTargetsRelative)v.sub(new THREE.Vector3().fromBufferAttribute(p,i));return v;};
    if(!mesh.isSkinnedMesh){g.computeBoundingBox();const deltas=targets.map((_,t)=>{const box=new THREE.Box3().makeEmpty();for(let i=0;i<p.count;i++)box.expandByPoint(delta(i,t));return box;});records.push({mesh,staticBox:g.boundingBox.clone(),deltas});return;}
    const j=g.attributes.skinIndex,w=g.attributes.skinWeight,boxes=mesh.skeleton.bones.map(()=>new THREE.Box3().makeEmpty()),deltas=targets.map(()=>boxes.map(()=>new THREE.Box3().makeEmpty()));
    const transforms=mesh.skeleton.boneInverses.map(m=>m.clone().multiply(mesh.bindMatrix)),linear=transforms.map(m=>new THREE.Matrix3().setFromMatrix4(m));
    for(let i=0;i<p.count;i++){let sum=0;for(let k=0;k<4;k++){const weight=w.getComponent(i,k);if(weight<0||!Number.isFinite(weight))throw new Error('Invalid skin weights');sum+=weight;if(weight>0){const bi=j.getComponent(i,k);boxes[bi].expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(transforms[bi]));targets.forEach((_,t)=>deltas[t][bi].expandByPoint(delta(i,t).applyMatrix3(linear[bi])));}}if(Math.abs(sum-1)>1e-4)throw new Error('Non-normalized skin weights');}
    records.push({mesh,boxes,deltas});
  });
  const expand=(base,deltas,weights)=>{const box=base.clone();deltas.forEach((d,t)=>{const w=weights?.[t]??0;if(!Number.isFinite(w))throw new Error('Invalid morph weight');if(!w||d.isEmpty())return;for(const axis of ['x','y','z']){box.min[axis]+=Math.min(w*d.min[axis],w*d.max[axis]);box.max[axis]+=Math.max(w*d.min[axis],w*d.max[axis]);}});return box;};
  return (space=new THREE.Matrix4())=>{root.updateWorldMatrix(true,true);const result=new THREE.Box3().makeEmpty();
    for(const {mesh,boxes,staticBox,deltas} of records){const weights=mesh.morphTargetInfluences;if(staticBox){result.union(expand(staticBox,deltas,weights).applyMatrix4(space.clone().multiply(mesh.matrixWorld)));continue;}
      const post=space.clone().multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
      boxes.forEach((box,i)=>{if(!box.isEmpty())result.union(expand(box,deltas.map(d=>d[i]),weights).applyMatrix4(post.clone().multiply(mesh.skeleton.bones[i].matrixWorld)));});
    }return result;
  };
}
export async function attachImportedManta({asset,entry,samples=1920}={}) {
  if(!asset||entry?.kind!=='manta'||entry.agents.length!==1||!asset.clips.some(c=>c.name===MANTA_CLIP))throw new Error('Explicit qualified single-manta controller and authored clip required');
  const instance=asset.instantiate({size:2.8,align:'center',rotation:[0,Math.PI/2,0],referenceClip:MANTA_CLIP});
  let hull;try{hull=makeSkinnedEnvelope(instance.model,{morph:true});}catch(e){instance.dispose();throw e;}
  const action=instance.play(MANTA_CLIP,{fade:0}),envelope=new THREE.Box3().makeEmpty();
  for(let i=0;i<=samples;i++){action.time=i/samples*action.getClip().duration;instance.update(0);envelope.union(hull());if(i>0&&i%64===0&&typeof requestAnimationFrame==='function')await new Promise(requestAnimationFrame);}
  action.time=0;instance.update(0);
  const old=entry.mesh.geometry.boundingBox?.clone()||(()=>{entry.mesh.geometry.computeBoundingBox();return entry.mesh.geometry.boundingBox.clone();})();
  // Existing measureSwimmer includes the original .75 wing displacement.
  // Use its conservative local vertical support, never change physics metrics.
  const extent=entry.metrics.extent;
  if(!extent?.isVector3){instance.dispose();throw new Error('Actual controller support extent required');}
  const support=new THREE.Box3(extent.clone().multiplyScalar(-1),extent.clone());
  const size=support.getSize(new THREE.Vector3()),incoming=envelope.getSize(new THREE.Vector3());
  const ratio=Math.min(size.x/incoming.x,size.y/incoming.y,size.z/incoming.z)*.97;
  if(!Number.isFinite(ratio)||ratio<=0){instance.dispose();throw new Error('Invalid animated manta support');}
  instance.root.scale.multiplyScalar(ratio);const targetCenter=support.getCenter(new THREE.Vector3()),sourceCenter=envelope.getCenter(new THREE.Vector3()).multiplyScalar(ratio);instance.root.position.copy(targetCenter.sub(sourceCenter));
  const materials=new Map();instance.model.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;o.userData.label='Manta ray · owner model';o.material=[o.material].flat().map(m=>{if(!materials.has(m)){const own=m.clone(),previous=own.onBeforeCompile,key=own.customProgramCacheKey();own.onBeforeCompile=(s,r)=>{previous.call(own,s,r);patchUnderwater(s,{caustics:.8});};own.customProgramCacheKey=()=>key+'-owner-manta-underwater-v1';materials.set(m,own);}return materials.get(m);});if(o.material.length===1)o.material=o.material[0];});
  const actor=new THREE.Group();actor.name='owner-manta';actor.matrixAutoUpdate=false;actor.add(instance.root);actor.traverse(o=>o.layers.mask=entry.mesh.layers.mask);entry.mesh.parent.add(actor);const previousVisible=entry.mesh.visible;entry.mesh.visible=false;
  const matrix=new THREE.Matrix4();let disposed=false,fallback=null;const sync=()=>{entry.mesh.getMatrixAt(0,matrix);actor.matrix.copy(entry.mesh.matrix).multiply(matrix);actor.matrixWorldNeedsUpdate=true;actor.visible=!entry.agents[0].unavailable;actor.updateWorldMatrix(true,true);};
  const adapter={actor,instance,envelope:envelope.clone(),support,ratio,
    update(dt){if(disposed)throw new Error('Imported manta disposed');if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid swimming delta');instance.play(MANTA_CLIP,{fade:0,timeScale:Math.max(.25,entry.mesh.geometry.getAttribute('aSwim').array[1])});instance.update(dt);sync();const actual=hull(actor.matrixWorld.clone().invert());
      fallback=support.containsBox(actual)?null:'animated-support-exceeded';
      actor.visible=!fallback&&!entry.agents[0].unavailable;entry.mesh.visible=fallback?previousVisible:false;
    },
    reset(){instance.stop();instance.mixer.setTime(0);instance.play(MANTA_CLIP,{fade:0});adapter.update(0);},
    bounds(){sync();return instance.bounds();},
    snapshot(){return {backend:'owner-manta',clip:instance.activeClip,time:instance.mixer.time,ratio,sourceEnvelope:[envelope.min.toArray(),envelope.max.toArray()],controllerSupport:[support.min.toArray(),support.max.toArray()],fallback};},
    dispose(){if(disposed)return;disposed=true;entry.mesh.visible=previousVisible;instance.dispose();actor.removeFromParent();for(const m of materials.values())m.dispose();},
  };adapter.update(0);return adapter;
}
