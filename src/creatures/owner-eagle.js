/** Owner Eagle: original STATIC mesh + explicitly generated wing articulation.
 * No authored animation/rig claim. Body/head/talons/tail never deformed.
 * Controller is authoritative: beforeRender -> Birds render/update -> afterRender.
 * No motion integration, no changes to dove or other flock slots.
 */
import * as T from 'three';
import {constrainNativeBird} from '../fauna/bird-reactions.js';
import {controllerBirdEnvelope} from './imported-birds.js';
export const OWNER_EAGLE = Object.freeze({file:'eagle.glb',label:'Owner eagle · generated flight (static source)',triangles:10828,clips:[],forwardYaw:-Math.PI/2,wingMesh:'Mesh_0041_Tex_0039_0dds_0',frequency:1.05,roost:'bounded flight-only policy; no native folded-roost claim'});
const clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
/** Canonical coordinates: +X forward, +Y up, Z across span, full rest span=1.
 * Only the isolated wing primitive enters this function. Shoulder crease fades
 * over .040-.085 halfspan; distal wrist has a lagged smaller hinge. Rodrigues
 * rotations preserve feather sections, not a sine-displaced rubber body.
 */
export function eagleWingPoint(x,y,z,angle=0,wrist=0,out=new T.Vector3()) {
  if(angle===0&&wrist===0)return out.set(x,y,z);
  const side=Math.sign(z),r=Math.abs(z),hinge=.047,crease=smooth((r-.04)/.045);
  const a=angle*crease,c=Math.cos(a),s=Math.sin(a),py=.029;
  // Mirrored local X rotation: both wings rise for positive angle.
  let yy=py+(y-py)*c+(r-hinge)*s,zz=hinge+(r-hinge)*c-(y-py)*s;
  // Wrist rotates about a shoulder-transformed pivot, with no body influence.
  const w=wrist*smooth((r-.26)/.15),wy=py+(.29-hinge)*s,wz=hinge+(.29-hinge)*c;
  const dy=yy-wy,dz=zz-wz; yy=wy+dy*Math.cos(w)+dz*Math.sin(w);zz=wz+dz*Math.cos(w)-dy*Math.sin(w);
  return out.set(x,yy,side*zz);
}
export function eagleFlightPose(time,flap=1) {
  const strength=clamp(flap,0,1),phase=time*2*Math.PI*OWNER_EAGLE.frequency;
  return {angle:.035+strength*(.56*Math.sin(phase)-.035),wrist:strength*.14*Math.sin(phase-.65)};
}
/** Owns only cloned geometry; all source materials/maps remain shared read-only.
 * Canonical baking is a rigid orientation + UNIFORM normalization, not reshaping.
 */
export function createOwnerEagleMotion(asset,{phase=0}={}) {
  if(!asset||asset.clips.length)throw new Error('Qualified static eagle asset required');
  const instance=asset.instantiate({size:1,align:'center',rotation:[0,OWNER_EAGLE.forwardYaw,0]});
  const root=new T.Group();root.name='native-owner-eagle';const meshes=[],v=new T.Vector3();
  instance.root.updateMatrixWorld(true);
  instance.model.traverse(o=>{if(o.isMesh){
    if(o.isSkinnedMesh)throw new Error('Static eagle must not be rigged');
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),mesh=new T.Mesh(geometry,o.material);
    mesh.name=o.name;mesh.castShadow=true;mesh.frustumCulled=false;mesh.userData.label=OWNER_EAGLE.label;
    root.add(mesh);meshes.push(mesh);
  }});
  const wing=meshes.find(m=>m.name===OWNER_EAGLE.wingMesh);
  const triangles=meshes.reduce((n,m)=>n+m.geometry.index.count/3,0);
  if(!wing||![10828,4798].includes(triangles)){meshes.forEach(m=>m.geometry.dispose());instance.dispose();throw new Error('Unqualified eagle mesh layout');}
  const rest=wing.geometry.attributes.position.array.slice(),restNormal=wing.geometry.attributes.normal.array.slice();
  let time=phase,disposed=false,last=null;
  const pose=(angle,wrist)=>{
    if(!Number.isFinite(angle)||!Number.isFinite(wrist)||Math.abs(angle)>.60||Math.abs(wrist)>.15)throw new RangeError('Eagle wing angle outside qualified envelope');
    const p=wing.geometry.attributes.position,n=wing.geometry.attributes.normal;
    if(angle===0&&wrist===0){p.array.set(rest);n.array.set(restNormal);}else{
      for(let i=0;i<p.count;i++){eagleWingPoint(rest[i*3],rest[i*3+1],rest[i*3+2],angle,wrist,v);p.setXYZ(i,v.x,v.y,v.z);}
      // Existing smooth source normals rotated by the local hinge rotation. The
      // small crease is weighted but source feather seams are not welded away.
      for(let i=0;i<n.count;i++){const z=rest[i*3+2],r=Math.abs(z),a=(angle*smooth((r-.04)/.045)+wrist*smooth((r-.26)/.15))*Math.sign(z),c=Math.cos(a),s=Math.sin(a),ny=restNormal[i*3+1],nz=restNormal[i*3+2];n.setXYZ(i,restNormal[i*3],ny*c+nz*s,nz*c-ny*s);}
    }
    p.needsUpdate=true;n.needsUpdate=true;wing.geometry.computeBoundingBox();wing.geometry.computeBoundingSphere();last={angle,wrist};
  };
  const bounds=(target=new T.Box3())=>{target.makeEmpty();for(const m of meshes){m.geometry.computeBoundingBox();target.union(m.geometry.boundingBox);}return target;};
  pose(0,0);const restBounds=bounds();
  // Dense extrema over independent shoulder/wrist limits PLUS runtime exact
  // all-deformed-vertex guard in adapter; never sample-only containment.
  const envelope=restBounds.clone();for(let k=0;k<=40;k++)for(const w of [-.15,0,.15]){pose((k-20)*.03,w);envelope.union(bounds());}envelope.expandByScalar(.015);pose(0,0);
  const api={root,model:root,meshes,wing,rest,restBounds,envelope,instance,
    pose(angle,wrist=0){if(disposed)throw new Error('Disposed eagle');pose(angle,wrist);},
    update(dt,{flap=0,paused=false}={}){if(disposed)throw new Error('Disposed eagle');if(!Number.isFinite(dt)||dt<0||!Number.isFinite(flap))throw new RangeError('Invalid eagle update');if(paused||dt===0)return;time+=dt;const p=eagleFlightPose(time,flap);pose(p.angle,p.wrist);},
    bounds,reset(){if(disposed)throw new Error('Disposed eagle');time=phase;pose(0,0);},
    snapshot(){return {time,...last,source:'static',motion:'generated',triangles};},
    dispose(){if(disposed)return;disposed=true;root.removeFromParent();meshes.forEach(m=>m.geometry.dispose());instance.dispose();}
  };return api;
}
/** Replaces the TWO eagle flight slots only, never gull/macaw/dove slots.
 * Uniform fit to the existing conservative local envelope keeps existing
 * local envelope. Opt-in controller sphere guards full native geometry on terrain.
 * Explicit bounded-flight-only policy: no native folded perch is claimed.
 */
export function createOwnerEagles({birds,asset,indices=[0,1],flightPolicy='bounded-flight-only',farAsset=null,camera=null,farDistance=45}={}) {
  const f=birds?.flocks?.find(f=>f.key==='eagle');if(!f||!asset)throw new Error('Eagle flock and native asset required');
  if(new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=f.n))throw new Error('Invalid eagle indices');
  if(!Number.isFinite(farDistance)||farDistance<=2)throw new RangeError('Invalid far distance');
  if(flightPolicy!=='bounded-flight-only')throw new Error('Native folded roost is not qualified; explicitly use bounded-flight-only');
  if(indices.some(i=>['landing','perched','takeoff'].includes(f.agents[i].mode)))throw new Error('Install native eagle before controller starts roost transition');
  const previousPolicies=f.nativeFlightPolicies;const policies=new Map(previousPolicies||[]);
  if(indices.some(i=>policies.has(i)))throw new Error('Eagle slot already has native flight ownership');
  const group=new T.Group();group.name='owner-eagle-visuals';birds.group.add(group);
  const hide=new T.Matrix4().makeScale(0,0,0),entries=[];let disposed=false;
  try{for(const i of indices){const motion=createOwnerEagleMotion(asset,{phase:i*.37});let far=null;try{far=farAsset?createOwnerEagleMotion(farAsset,{phase:i*.37}):null;}catch(error){motion.dispose();throw error;}if(motion.snapshot().triangles!==10828||(far&&far.snapshot().triangles!==4798)){motion.dispose();far?.dispose();throw new Error('Near/far eagle assets assigned incorrectly');} if(far)motion.envelope.union(far.envelope);const target=controllerBirdEnvelope(f),size=target.getSize(new T.Vector3()),source=motion.envelope.getSize(new T.Vector3()),scale=Math.min(size.x/source.x,size.y/source.y,size.z/source.z)*.98,carrier=new T.Group(),fit=new T.Group();
    carrier.matrixAutoUpdate=false;fit.scale.setScalar(scale);fit.position.copy(target.getCenter(new T.Vector3())).addScaledVector(motion.envelope.getCenter(new T.Vector3()),-scale);fit.add(motion.root);if(far){fit.add(far.root);far.root.visible=false;}carrier.add(fit);group.add(carrier);
    entries.push({f,i,motion,far,lod:'near',instance:motion,carrier,fit,target,scale,matrix:new T.Matrix4(),hidden:false,weight:0,fault:null});
  }}catch(e){entries.forEach(e=>{e.motion.dispose();e.far?.dispose();});group.removeFromParent();throw e;}
  for(const e of entries){const radius=(e.motion.envelope.getSize(new T.Vector3()).length()*.5*e.scale+e.target.getCenter(new T.Vector3()).length())*e.f.scale;policies.set(e.i,{radius,clearance:.2,flightOnly:true});}
  f.nativeFlightPolicies=policies;
  for(const e of entries){constrainNativeBird(birds,f,e.i,f.agents[e.i]);const m=new T.Matrix4();f.mesh.getMatrixAt(e.i,m);m.setPosition(f.agents[e.i].p);f.mesh.setMatrixAt(e.i,m);f.pos[e.i]?.copy(f.agents[e.i].p);}f.mesh.instanceMatrix.needsUpdate=true;
  const restore=()=>{for(const e of entries)if(e.hidden){const m=new T.Matrix4();f.mesh.getMatrixAt(e.i,m);if(m.equals(hide)){f.mesh.setMatrixAt(e.i,e.matrix);f.mesh.instanceMatrix.needsUpdate=true;}e.hidden=false;}};
  const updateLOD=e=>{if(!e.far)return;if(camera){e.carrier.updateWorldMatrix(true,false);const distance=camera.getWorldPosition(new T.Vector3()).distanceTo(e.carrier.getWorldPosition(new T.Vector3()));e.lod=distance>farDistance+2?'far':distance<farDistance-2?'near':e.lod;}const pose=e.motion.snapshot(),farPose=e.far.snapshot();if(pose.angle!==farPose.angle||pose.wrist!==farPose.wrist)e.far.pose(pose.angle,pose.wrist);e.motion.root.visible=e.lod==='near';e.far.root.visible=e.lod==='far';};
  const api={group,entries,setCamera(value){camera=value;},
    updateDetailView(value=camera){if(disposed)throw new Error('Disposed eagles');camera=value;for(const e of entries)updateLOD(e);},
    beforeRender(){if(disposed)throw new Error('Disposed eagles');restore();},
    afterRender(dt=0){if(disposed)throw new Error('Disposed eagles');if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid delta');restore();
      for(const e of entries){f.mesh.getMatrixAt(e.i,e.matrix);e.carrier.matrix.copy(e.matrix);e.carrier.matrixWorldNeedsUpdate=true;
        const a=f.agents[e.i];e.motion.update(dt,{flap:a.flap});
        updateLOD(e);
        // Exact CPU geometry bounds agree with rendered positions: no hidden GPU
        // wing displacement, no per-vertex world/inverse skin matrix rebuild.
        const nativeBounds=e.motion.bounds();if(e.far)nativeBounds.union(e.far.bounds());const local=nativeBounds.applyMatrix4(new T.Matrix4().compose(e.fit.position,e.fit.quaternion,e.fit.scale));
        if(!e.target.clone().expandByScalar(1e-5).containsBox(local))e.fault='native-eagle-outside-controller-envelope';
        // Explicit flight-only policy retains native identity during rain/night/
        // lightning. Never swap back to a procedural animal during normal states.
        e.weight=e.fault?0:1;e.carrier.visible=!!e.weight;
        if(e.weight){f.mesh.setMatrixAt(e.i,hide);f.mesh.instanceMatrix.needsUpdate=true;e.hidden=true;}
      }
    },
    resetForTest(){restore();for(const e of entries){e.fault=null;e.motion.reset();e.far?.reset();e.lod='near';}api.afterRender(0);},
    /** World-space radius is conservative for every qualified wing phase and bank.
     * Parent controller must also apply terrain clearance ALONG recovery routes,
     * not just at the future target; this adapter does not own that physics. */
    clearanceRequirements({exact=false}={}){return entries.map(e=>{let minClearance=null;if(exact&&e.weight&&birds.hf){minClearance=Infinity;e.carrier.updateWorldMatrix(true,true);const v=new T.Vector3();for(const o of (e.lod==='far'?e.far:e.motion).meshes){const p=o.geometry.attributes.position;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);minClearance=Math.min(minClearance,v.y-birds.hf.heightAt(v.x,v.z));}}}return {flock:'eagle',index:e.i,radius:(e.motion.envelope.getSize(new T.Vector3()).length()*.5*e.scale+e.target.getCenter(new T.Vector3()).length())*e.f.scale,minClearance,neededLift:minClearance===null?null:Math.max(0,.15-minClearance)};});},
    snapshot(){return entries.map(e=>({flock:'eagle',index:e.i,mode:f.agents[e.i].mode,weight:e.weight,fault:e.fault,scale:e.scale,...e.motion.snapshot(),lod:e.lod,renderTriangles:e.lod==='far'?4798:10828,roost:OWNER_EAGLE.roost}));},
    dispose(){if(disposed)return;restore();disposed=true;if(f.nativeFlightPolicies===policies){if(previousPolicies)f.nativeFlightPolicies=previousPolicies;else delete f.nativeFlightPolicies;}entries.forEach(e=>{e.motion.dispose();e.far?.dispose();});group.removeFromParent();}
  };api.afterRender(0);return api;
}
