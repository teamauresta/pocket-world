/** Flight-only owner model backend. Never advances or edits the bird controller.
 * Parent must call beforeRender(), Birds.update()/render(), afterRender(dt), in that order.
 * Render-only calls use dt=0; resetForTest follows controller.resetForTest().
 */
import * as THREE from 'three';
import { BIRDS } from './birds.js';
import {createBirdFallbackGeometry,createBirdFallbackDepth,ownBirdShadowDissolve} from './imported-bird-fallback.js';

export const OWNER_BIRD = Object.freeze({
  file: 'dove_bird_rigged.glb', clip: 'Take 001',
  label: 'Owner-supplied orange-breasted bird (flight only)',
  forwardYaw: Math.PI / 2, // measured Chest_M_035 -> Head_M_043 is authored +Z
});
const smooth = x => { x = THREE.MathUtils.clamp(x, 0, 1); return x*x*(3-2*x); };

/** Every vertex of every mesh, not a sparse bone or bind-box proxy. */
export function preciseBirdBounds(root, target = new THREE.Box3()) {
  root.updateMatrixWorld(true); target.makeEmpty(); const v = new THREE.Vector3();
  root.traverse(o => { if (o.isMesh) {
    for (let i=0; i<o.geometry.attributes.position.count; i++) {
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); target.expandByPoint(v);
    }
  }});
  return target;
}

/** Dense full-loop sample + 5% padding; not an analytic continuous-motion proof.
 * Runtime exact containment below fails closed if an unsampled extremum escapes.
 */
export function measureBirdEnvelope(asset, samples = 240) {
  if (!Number.isInteger(samples) || samples < 60) throw new Error('At least 60 envelope samples required');
  const clip = asset.clips.find(c => c.name === OWNER_BIRD.clip);
  if (!clip || !(clip.duration > 0)) throw new Error('Qualified Take 001 flight clip required');
  const instance = asset.instantiate({size:1, align:'center', rotation:[0,OWNER_BIRD.forwardYaw,0], referenceClip:OWNER_BIRD.clip});
  const box = new THREE.Box3();
  try {
    instance.play(OWNER_BIRD.clip,{fade:0});
    for(let i=0;i<=samples;i++) { instance.mixer.setTime(clip.duration*i/samples); box.union(preciseBirdBounds(instance.root)); }
    const center=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3());
    if (!size.toArray().every(x=>Number.isFinite(x)&&x>0)) throw new Error('Invalid animated envelope');
    return {samples, duration:clip.duration, center:center.toArray(), size:size.toArray(), min:box.min.toArray(), max:box.max.toArray(), padding:1.05};
  } finally { instance.dispose(); }
}

/** Existing procedural shader's conservative local-space envelope, all flap phases.
 * Only flight (fold=0) is replaced; fold/perch visuals are the untouched backend.
 */
export function controllerBirdEnvelope(flock) {
  const config=BIRDS[flock.key]; if(!config) throw new Error('Unknown bird flock');
  const geo=flock.mesh.geometry; geo.computeBoundingBox(); const box=geo.boundingBox.clone();
  box.min.y-=config.span*.55; box.max.y+=config.span*.55+config.span*.08;
  return box;
}

function cloneOwnedMaterials(instance) {
  const map=new Map();
  instance.model.traverse(o=>{ if(o.isMesh) {
    const clone=m=>{if(!map.has(m)){const owned=m.clone();owned.userData.ownerBirdBaseOpacity=m.opacity;map.set(m,owned);}return map.get(m);};
    o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
    o.frustumCulled=false; o.castShadow=true;
  }});
  return [...map.values()]; // maps/textures stay shared and read-only
}

/** Stable landing/takeoff fade keyed to controller progress, not wall-clock guessing.
 * Imported flight ends by 40% landing, before flare/fold at 60/65%; comes back only
 * after 70% takeoff and fold fully reopens. Perch is procedural belly support, no talon claim.
 */
export function flightVisualWeight(agent) {
  if(agent.fold>0.001 || agent.mode==='perched') return 0;
  const p=agent.transition?agent.transition.elapsed/agent.transition.duration:1;
  if(agent.mode==='landing') return 1-smooth(p/.4);
  if(agent.mode==='takeoff') return smooth((p-.7)/.3);
  if(agent.mode==='flight'||agent.mode==='scatter') return 1;
  return 0;
}

/** Default replaces five existing jungle flight slots; no new controller agents.
 * Asset is caller-owned; dispose adapter BEFORE asset. Explicit selection may replace one.
 */
export function createImportedBirds({birds, asset, selections=[{key:'macaw',indices:[0,1,2,3,4]}], envelope=measureBirdEnvelope(asset)}={}) {
  if(!birds?.group || !asset)throw new Error('Bird controller and loaded owner asset required');
  const group=new THREE.Group();group.name='owner-flight-bird-visuals';birds.group.add(group);
  const entries=[], seen=new Set(), inverse=new THREE.Matrix4(), hide=new THREE.Matrix4().makeScale(0,0,0);
  let disposed=false;
  try { for(const selection of selections) {
    const f=birds.flocks.find(f=>f.key===selection.key); if(!f)throw new Error('Unknown flock selection');
    for(const i of selection.indices) {
      const key=f.key+':'+i;if(!Number.isInteger(i)||i<0||i>=f.n||seen.has(key))throw new Error('Invalid or duplicate bird slot');seen.add(key);
      const instance=asset.instantiate({size:1,align:'center',rotation:[0,OWNER_BIRD.forwardYaw,0],referenceClip:OWNER_BIRD.clip});
      const materials=cloneOwnedMaterials(instance), target=controllerBirdEnvelope(f), targetSize=target.getSize(new THREE.Vector3()), targetCenter=target.getCenter(new THREE.Vector3());
      const scale=Math.min(...targetSize.toArray().map((x,k)=>x/(envelope.size[k]*envelope.padding)));
      const carrier=new THREE.Group(), fit=new THREE.Group();carrier.matrixAutoUpdate=false;fit.scale.setScalar(scale);
      fit.position.copy(targetCenter).addScaledVector(new THREE.Vector3(...envelope.center),-scale);
      fit.add(instance.root);carrier.add(fit);group.add(carrier);carrier.userData.label=OWNER_BIRD.label;
      instance.model.traverse(o=>{if(o.isMesh)o.userData.label=OWNER_BIRD.label;});
      const action=instance.play(OWNER_BIRD.clip,{fade:0});action.time=(i*.173)%envelope.duration;instance.update(0);
      // A per-slot proxy retains exact procedural shader fold/flap and source material,
      // but a cloned material permits a complementary opacity fade without touching flockmates.
      const fallback=new THREE.InstancedMesh(createBirdFallbackGeometry(f),f.mesh.material.clone(),f.n);
      fallback.material.onBeforeCompile=f.mesh.material.onBeforeCompile;
      fallback.material.customProgramCacheKey=f.mesh.material.customProgramCacheKey;
      fallback.material.userData.ownerBirdBaseOpacity=f.mesh.material.opacity;
      fallback.customDepthMaterial=ownBirdShadowDissolve(createBirdFallbackDepth(f.mesh.customDepthMaterial));fallback.frustumCulled=false;fallback.castShadow=true;
      for(let j=0;j<f.n;j++)fallback.setMatrixAt(j,hide);
      fallback.userData.label=OWNER_BIRD.label+' / palette-matched procedural roost proxy';group.add(fallback);
      const shadowMaterials=[];instance.model.traverse(o=>{if(o.isMesh){const d=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:o.material.side});o.customDepthMaterial=ownBirdShadowDissolve(d);shadowMaterials.push(d);}});
      entries.push({f,i,instance,materials,shadowMaterials,carrier,fit,fallback,target,scale,action,phase:action.time,matrix:new THREE.Matrix4(),hidden:false,weight:0,fault:null});
    }
  }} catch(error) { for(const e of entries){e.instance.dispose();e.materials.forEach(m=>m.dispose());e.fallback.material.dispose();e.fallback.geometry.dispose();e.fallback.customDepthMaterial.dispose();e.shadowMaterials.forEach(m=>m.dispose());e.fallback.dispose();}group.removeFromParent();throw error; }
  const restore=()=>{ for(const e of entries)if(e.hidden){const current=new THREE.Matrix4();e.f.mesh.getMatrixAt(e.i,current);
    // Do not overwrite a fresh controller render. Restore ONLY our own zero matrix.
    if(current.equals(hide)){e.f.mesh.setMatrixAt(e.i,e.matrix);e.f.mesh.instanceMatrix.needsUpdate=true;}e.hidden=false;
  }};
  // Depth-writing screen-door dissolve avoids two translucent ghost birds.
  const opacity=(m,value)=>{const hashed=value>0&&value<1;
    if(m.alphaHash!==hashed){m.alphaHash=hashed;m.needsUpdate=true;}
    m.opacity=(m.userData.ownerBirdBaseOpacity??1)*value;
    if(m.userData.ownerBirdShadowFade)m.userData.ownerBirdShadowFade.value=value;
  };
  const api={group,entries,envelope,
    beforeRender(){if(disposed)throw new Error('Adapter disposed');restore();},
    afterRender(dt=0){
      if(disposed)throw new Error('Adapter disposed');if(!Number.isFinite(dt)||dt<0)throw new Error('Delta must be finite and nonnegative');
      restore(); group.updateWorldMatrix(true,false);
      for(const e of entries) {
        e.f.mesh.getMatrixAt(e.i,e.matrix);e.carrier.matrix.copy(e.matrix);e.carrier.matrixWorldNeedsUpdate=true;
        const a=e.f.agents[e.i];
        // Genuine wing clip runs at its native rate; no sine flap invented. When controller
        // asks for glide, hold current rig pose rather than continuing to flap.
        if(dt>0&&a.flap>0.001&&a.mode!=='perched') e.instance.update(dt*THREE.MathUtils.clamp(a.flap,0,1));
        let weight=flightVisualWeight(a);
        // Check the REAL deformed skin against the original controller-local envelope.
        // Invalid arbitrary dt/clip extrema latch procedural fallback until explicit reset.
        e.carrier.updateWorldMatrix(true,false); e.carrier.updateMatrixWorld(true); inverse.copy(e.carrier.matrixWorld).invert();
        const local=new THREE.Box3(),v=new THREE.Vector3();e.instance.model.traverse(o=>{if(o.isMesh)for(let j=0;j<o.geometry.attributes.position.count;j++){o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);local.expandByPoint(v);}});
        if(!e.target.clone().expandByScalar(1e-5).containsBox(local))e.fault='skin-outside-controller-envelope';
        if(e.fault)weight=0;e.weight=weight;e.carrier.visible=weight>0;e.materials.forEach(m=>opacity(m,weight));e.shadowMaterials.forEach(m=>opacity(m,weight));
        e.fallback.visible=weight<1;opacity(e.fallback.material,1-weight);opacity(e.fallback.customDepthMaterial,1-weight);
        e.fallback.setMatrixAt(e.i,e.matrix);e.fallback.instanceMatrix.needsUpdate=true;
        e.f.mesh.setMatrixAt(e.i,hide);e.f.mesh.instanceMatrix.needsUpdate=true;e.hidden=true;
      }
    },
    resetForTest(){restore();for(const e of entries){e.fault=null;e.instance.stop();e.action=e.instance.play(OWNER_BIRD.clip,{fade:0});e.action.time=e.phase;e.instance.update(0);}api.afterRender(0);},
    snapshot(){return entries.map(e=>({flock:e.f.key,index:e.i,label:OWNER_BIRD.label,mode:e.f.agents[e.i].mode,weight:e.weight,clip:OWNER_BIRD.clip,time:e.action.time,scale:e.scale,fault:e.fault}));},
    dispose(){if(disposed)return;restore();disposed=true;for(const e of entries){e.instance.dispose();e.materials.forEach(m=>m.dispose());e.fallback.material.dispose();e.fallback.geometry.dispose();e.fallback.customDepthMaterial.dispose();e.shadowMaterials.forEach(m=>m.dispose());e.fallback.dispose();}group.removeFromParent();},
  };
  api.afterRender(0);return api;
}
