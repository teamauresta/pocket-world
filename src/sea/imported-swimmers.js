/** Authored sea visuals only. Never changes SeaLife agents, matrices, safety or reactions. */
import * as THREE from 'three';
import {makeSkinnedEnvelope} from './imported-visual.js';
import {patchUnderwater} from '../render/shared.js';
import {patchSwimmerScreenDoor,swimmerDetailWeight,SWIMMER_DETAIL} from './swimmer-detail.js';

export const SWIMMER_PROFILES=Object.freeze({
  tuna:Object.freeze({kind:'tuna',file:'tuna_fish.glb',clip:'Armature|ArmatureAction',rotation:Object.freeze([0,Math.PI/2,0]),triangles:5989,maxInstances:8,controllerKey:'silver',controllerMode:'school',minLengthFraction:.5,capabilities:Object.freeze(['swim','school','lightning','controller-weather-preservation'])}),
});
const occupied=new WeakSet();
/** Explicit profile plus selected existing silver-school indices, at most eight.
 * Original instanced matrix buffer remains read-only. A private copy hides selected
 * procedural instances, and follows ALL others, preserving controllers/reset identity.
 * Complete per-pose skin support is checked before showing an imported visual.
 */
export async function attachImportedSwimmers({asset,entry,kind,indices=[0,1],samples=720,onTrace=()=>{}}={}){
  const profile=SWIMMER_PROFILES[kind];
  if(!profile)throw new Error('Unsupported sea visual kind: '+kind);
  if(!asset?.clips?.some(c=>c.name===profile.clip))throw new Error('Required authored swimming clip absent');
  if(entry?.key!==profile.controllerKey||entry.mode!==profile.controllerMode||!entry.mesh?.isInstancedMesh||!entry.mesh.parent||!entry.metrics?.extent?.isVector3)throw new Error('Qualified silver school controller required');
  if(!Array.isArray(indices)||!indices.length||indices.length>profile.maxInstances||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=entry.agents.length))throw new Error('Invalid bounded swimmer indices');
  if(!Number.isInteger(samples)||samples<120||samples>4096||typeof onTrace!=='function')throw new Error('Invalid qualification options');
  if(occupied.has(entry))throw new Error('Controller already has imported swimmers');
  occupied.add(entry);
  const support=new THREE.Box3(entry.metrics.extent.clone().negate(),entry.metrics.extent.clone()),instances=[],actors=[],hulls=[],ownedMaterials=new Set(),farActors=[],detail=indices.map(()=>({value:1})),sourceEnvelope=new THREE.Box3();
  let fallbackMesh=null,disposed=false,ratio=0,previousVisible=entry.mesh.visible,attached=false;
  const cleanup=()=>{for(const instance of instances)instance.dispose();for(const actor of actors)actor.removeFromParent();fallbackMesh?.removeFromParent();for(const m of ownedMaterials)m.dispose();for(const f of farActors){f.removeFromParent();f.geometry.dispose();f.dispose();}if(attached)entry.mesh.visible=previousVisible;occupied.delete(entry);};
  try{
    const first=asset.instantiate({size:1,align:'center',rotation:profile.rotation,referenceClip:profile.clip});instances.push(first);const firstHull=makeSkinnedEnvelope(first.model);hulls.push(firstHull);const action=first.play(profile.clip,{fade:0}),duration=action.getClip().duration;
    if(!Number.isFinite(duration)||duration<=0)throw new Error('Empty authored swimming cycle');
    for(let i=0;i<=samples;i++){action.time=i/samples*duration;first.update(0);sourceEnvelope.union(firstHull());if(i&&i%96===0&&typeof requestAnimationFrame==='function')await new Promise(requestAnimationFrame);}
    const size=sourceEnvelope.getSize(new THREE.Vector3()),space=support.getSize(new THREE.Vector3());ratio=.96*Math.min(space.x/size.x,space.y/size.y,space.z/size.z);
    if(!Number.isFinite(ratio)||ratio<=0||size.x*ratio<space.x*profile.minLengthFraction)throw new Error('Animated support would make swimmer too small');
    const center=sourceEnvelope.getCenter(new THREE.Vector3());
    for(let j=0;j<indices.length;j++){
      const instance=j?asset.instantiate({size:1,align:'center',rotation:profile.rotation,referenceClip:profile.clip}):first;if(j){instances.push(instance);hulls.push(makeSkinnedEnvelope(instance.model));}
      instance.root.scale.setScalar(ratio);instance.root.position.copy(center).multiplyScalar(-ratio);
      const materialMap=new Map();
      instance.model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=false;o.receiveShadow=false;o.userData.label='Tuna · owner model';const list=[o.material].flat().map(m=>{if(!materialMap.has(m)){const own=m.clone(),prior=m.onBeforeCompile,key=m.customProgramCacheKey();own.onBeforeCompile=function(s,r){prior.call(this,s,r);patchUnderwater(s,{caustics:.8});};own.customProgramCacheKey=()=>key+'-owner-swimmer-underwater-v1';patchSwimmerScreenDoor(own,detail[j],true);materialMap.set(m,own);ownedMaterials.add(own);}return materialMap.get(m);});o.material=Array.isArray(o.material)?list:list[0];});
      const actor=new THREE.Group();actor.name='owner-'+kind+'-'+indices[j];actor.matrixAutoUpdate=false;actor.add(instance.root);actor.traverse(o=>o.layers.mask=entry.mesh.layers.mask);actors.push(actor);
      const geometry=entry.mesh.geometry.clone();geometry.setAttribute('aSwim',new THREE.InstancedBufferAttribute(new Float32Array(2),2));
      geometry.computeBoundingBox();const farScale=Math.min(1,ratio/geometry.boundingBox.getSize(new THREE.Vector3()).x);
      const triangles=geometry.index?geometry.index.count/3:geometry.attributes.position.count/3;
      if(triangles>=5000){geometry.dispose();throw new Error('Procedural far swimmer exceeds budget');}
      const farMaterial=entry.mesh.material.clone();farMaterial.onBeforeCompile=entry.mesh.material.onBeforeCompile;farMaterial.customProgramCacheKey=entry.mesh.material.customProgramCacheKey;patchSwimmerScreenDoor(farMaterial,detail[j],false);ownedMaterials.add(farMaterial);
      const far=new THREE.InstancedMesh(geometry,farMaterial,1);far.matrixAutoUpdate=false;far.frustumCulled=false;far.layers.mask=entry.mesh.layers.mask;far.castShadow=entry.mesh.castShadow;far.receiveShadow=entry.mesh.receiveShadow;far.name='owner-tuna-procedural-far-'+indices[j];
      if(entry.mesh.customDepthMaterial){const depth=entry.mesh.customDepthMaterial.clone();depth.onBeforeCompile=entry.mesh.customDepthMaterial.onBeforeCompile;depth.customProgramCacheKey=entry.mesh.customDepthMaterial.customProgramCacheKey;patchSwimmerScreenDoor(depth,detail[j],false);far.customDepthMaterial=depth;ownedMaterials.add(depth);}
      far.userData.detailScale=farScale;far.visible=false;farActors.push(far);
    }
    // Sharing immutable original geometry/materials is safe; this mesh owns only its matrix buffer.
    fallbackMesh=new THREE.InstancedMesh(entry.mesh.geometry,entry.mesh.material,entry.mesh.count);fallbackMesh.name='owner-swimmer-procedural-remainder';fallbackMesh.customDepthMaterial=entry.mesh.customDepthMaterial;fallbackMesh.frustumCulled=false;fallbackMesh.castShadow=entry.mesh.castShadow;fallbackMesh.receiveShadow=entry.mesh.receiveShadow;fallbackMesh.layers.mask=entry.mesh.layers.mask;fallbackMesh.matrixAutoUpdate=false;
    entry.mesh.parent.add(fallbackMesh,...actors,...farActors);entry.mesh.visible=false;attached=true;
    const actions=instances.map(i=>i.play(profile.clip,{fade:0}));
    const failures=indices.map(()=>null),trace=[],matrix=new THREE.Matrix4(),zero=new THREE.Matrix4().makeScale(0,0,0);
    const setFailure=(j,reason)=>{if(failures[j]===reason)return;failures[j]=reason;const event={kind,index:indices[j],reason:reason||'support-restored',time:instances[j].mixer.time};trace.push(event);if(trace.length>32)trace.shift();onTrace({...event});};
    let detailCamera=null,detailQuality='high';const cameraPosition=new THREE.Vector3(),actorPosition=new THREE.Vector3();
    const applyDetail=()=>{if(detailCamera)detailCamera.getWorldPosition(cameraPosition);for(let j=0;j<indices.length;j++){
      const actor=actors[j],far=farActors[j],unavailable=!!entry.agents[indices[j]].unavailable||Math.abs(actor.matrixWorld.determinant())<1e-14;
      detail[j].value=failures[j]?0:detailCamera?swimmerDetailWeight(cameraPosition.distanceTo(actor.getWorldPosition(actorPosition)),detailQuality):1;
      actor.visible=previousVisible&&!unavailable&&!failures[j]&&detail[j].value>0;
      far.visible=previousVisible&&!unavailable&&!failures[j]&&detail[j].value<1;
    }};
    const adapter={kind,profile,instances,actors,farActors,support,sourceEnvelope,ratio,fallbackMesh,
      updateDetailView(camera,{quality='high'}={}){if(disposed)throw new Error('Imported swimmers disposed');if(camera!==null&&!camera?.isCamera)throw new Error('Camera or null required');if(!SWIMMER_DETAIL[quality])throw new Error('Unknown swimmer detail quality');detailCamera=camera;detailQuality=quality;applyDetail();},
      update(dt){if(disposed)throw new Error('Imported swimmers disposed');if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid swimming delta');
        fallbackMesh.matrix.copy(entry.mesh.matrix);fallbackMesh.matrixWorldNeedsUpdate=true;fallbackMesh.instanceMatrix.array.set(entry.mesh.instanceMatrix.array);fallbackMesh.visible=previousVisible;
        for(let j=0;j<indices.length;j++){const i=indices[j],a=entry.agents[i],instance=instances[j],actor=actors[j];const speed=entry.mesh.geometry.getAttribute('aSwim')?.array[i*2+1]??1;instance.play(profile.clip,{fade:0,timeScale:Math.max(.25,Math.min(3,speed))});instance.update(dt);entry.mesh.getMatrixAt(i,matrix);
          const far=farActors[j];far.matrix.copy(entry.mesh.matrix);far.matrixWorldNeedsUpdate=true;far.setMatrixAt(0,matrix.clone().scale(new THREE.Vector3().setScalar(far.userData.detailScale)));far.instanceMatrix.needsUpdate=true;const swim=entry.mesh.geometry.getAttribute('aSwim'),farSwim=far.geometry.getAttribute('aSwim');farSwim.array[0]=swim?.array[i*2]??0;farSwim.array[1]=speed;farSwim.needsUpdate=true;actor.matrix.copy(entry.mesh.matrix).multiply(matrix);actor.matrixWorldNeedsUpdate=true;actor.updateWorldMatrix(true,true);actor.updateMatrixWorld(true);
          // A zero controller matrix denotes unavailable water, not a support failure.
          const unavailable=!!a.unavailable||Math.abs(actor.matrixWorld.determinant())<1e-14;const actual=unavailable?null:hulls[j](actor.matrixWorld.clone().invert());setFailure(j,actual&&!support.containsBox(actual)?'animated-support-exceeded':null);actor.visible=previousVisible&&!unavailable&&!failures[j];if(!failures[j])fallbackMesh.setMatrixAt(i,zero);
        }fallbackMesh.instanceMatrix.needsUpdate=true;applyDetail();
      },
      reset(){for(let j=0;j<instances.length;j++){const i=instances[j];i.stop();i.mixer.setTime(0);const a=i.play(profile.clip,{fade:0});a.time=(indices[j]*.38196601125%1)*duration;i.update(0);}adapter.update(0);},
      snapshot(){return {backend:'owner-swimmers',kind,clip:profile.clip,indices:indices.slice(),ratio,sourceEnvelope:[sourceEnvelope.min.toArray(),sourceEnvelope.max.toArray()],support:[support.min.toArray(),support.max.toArray()],instances:instances.map((i,j)=>({index:indices[j],time:i.mixer.time,clipTime:actions[j].time,fallback:failures[j],visible:actors[j].visible,detailWeight:detail[j].value,detailBackend:failures[j]?'support-fallback':detail[j].value===0?'procedural-far':detail[j].value===1?'authored-near':'screen-door-transition',farVisible:farActors[j].visible})),trace:trace.map(x=>({...x}))};},
      dispose(){if(disposed)return;disposed=true;cleanup();fallbackMesh.dispose();},
    };adapter.reset();return adapter;
  }catch(error){cleanup();fallbackMesh?.dispose();throw error;}
}
