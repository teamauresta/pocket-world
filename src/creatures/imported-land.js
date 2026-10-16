/** Owner Stag/Deer visual backend. Navigation and LandMotion remain authoritative.
 * Exported left is controller right after +Z -> +X basis rotation.
 * Hoof IK/FF are separate weighted roots, NOT children of the lower legs.
 */
import * as THREE from 'three';
import {solveImportedChain} from './imported-land-ik.js';
import { applyWet } from '../render/shared.js';
const V=THREE.Vector3,Q=THREE.Quaternion;
const MAP={wristL:['FrontShoulderR','FrontUpperLegR','FrontLowerLegR'],wristR:['FrontShoulderL','FrontUpperLegL','FrontLowerLegL'],hockL:['BackLegR','BackUpperLegR','BackLowerLegR'],hockR:['BackLegL','BackUpperLegL','BackLowerLegL']};
export function solveImportedSole(chain,offset,target,{iterations=24,tolerance=.0002}={}) {
  if(!chain.length||!target.toArray().every(Number.isFinite))throw new Error('Invalid imported sole chain/target');
  const end=chain.at(-1),p=new V(),o=new V(),a=new V(),b=new V(),parentQ=new Q(),worldQ=new Q(),delta=new Q();
  let error=Infinity;
  for(let n=0;n<iterations;n++){
    for(let i=chain.length-1;i>=0;i--){
      const joint=chain[i];joint.updateWorldMatrix(true,true);end.localToWorld(p.copy(offset));joint.getWorldPosition(o);a.subVectors(p,o);b.subVectors(target,o);
      if(a.lengthSq()<1e-12||b.lengthSq()<1e-12)continue;
      delta.setFromUnitVectors(a.normalize(),b.normalize());joint.getWorldQuaternion(worldQ);joint.parent.getWorldQuaternion(parentQ);
      joint.quaternion.copy(parentQ.invert().multiply(delta).multiply(worldQ)).normalize();joint.updateWorldMatrix(false,true);
    }
    end.localToWorld(p.copy(offset));error=p.distanceTo(target);if(error<tolerance)break;
  }
  return error;
}
export function solveImportedTwoBone(hip,knee,offset,target) {
  hip.updateWorldMatrix(true,true);
  const h=hip.getWorldPosition(new V()),k=knee.getWorldPosition(new V()),end=knee.localToWorld(offset.clone());
  const l1=h.distanceTo(k),l2=k.distanceTo(end),d=target.clone().sub(h),actualDistance=d.length();
  if(l1<1e-8||l2<1e-8||actualDistance<1e-8)return end.distanceTo(target);
  d.multiplyScalar(1/actualDistance);
  const distance=THREE.MathUtils.clamp(actualDistance,Math.abs(l1-l2)+1e-7,l1+l2-1e-7);
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const pole=k.clone().sub(h).addScaledVector(d,-k.clone().sub(h).dot(d));
  if(pole.lengthSq()<1e-12){pole.set(1,0,0).addScaledVector(d,-d.x);if(pole.lengthSq()<1e-12)pole.set(0,0,1).addScaledVector(d,-d.z);}
  pole.normalize();const desiredKnee=h.clone().addScaledVector(d,along).addScaledVector(pole,height);
  const aim=(bone,from,to)=>{const origin=bone.getWorldPosition(new V()),a=from.clone().sub(origin).normalize(),b=to.clone().sub(origin).normalize(),delta=new Q().setFromUnitVectors(a,b),world=bone.getWorldQuaternion(new Q()),parent=bone.parent.getWorldQuaternion(new Q());bone.quaternion.copy(parent.invert().multiply(delta).multiply(world)).normalize();bone.updateWorldMatrix(false,true);};
  aim(hip,k,desiredKnee);aim(knee,knee.localToWorld(offset.clone()),target);
  return knee.localToWorld(offset.clone()).distanceTo(target);
}
function updateSkin(root){root.updateWorldMatrix(true,true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
function actualVertex(mesh,index){mesh.updateWorldMatrix(true,false);mesh.skeleton.update();return mesh.getVertexPosition(index,new V()).applyMatrix4(mesh.matrixWorld);}
function findSole(model,bone){
  const subtree=new Set();bone.traverse(b=>{if(b.isBone)subtree.add(b);});
  let best=null;model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<p.count;i++){let weight=0;for(let k=0;k<4;k++)if(subtree.has(mesh.skeleton.bones[j.getComponent(i,k)]))weight+=w.getComponent(i,k);if(weight<.9999)continue;const point=actualVertex(mesh,i);if(!best||point.y<best.point.y)best={mesh,index:i,point,weight};}
  });if(!best)throw new Error('No independently measurable actual hoof skin for '+bone.name);
  best.offset=bone.worldToLocal(best.point.clone());return best;
}
export function importedDeerState(state,escape=false){
  if(state==='walk')return {clip:'Walk',motion:escape?'rapid-walk':'walk'};
  if(state==='graze')return {clip:'Eating',motion:'graze'};
  if(state==='idle'||state==='alert')return {clip:state==='idle'?'Idle':'Idle_2',motion:state};
  if(['crouch','shake'].includes(state))return {clip:'Idle',motion:'procedural-'+state};
  if(['sleep','lie','sit','roll','rear'].includes(state))return {clip:'Idle',motion:'standing-rest-substitute',unsupported:state};
  return {clip:'Idle',motion:'unsupported-hold',unsupported:state};
}
export function attachImportedDeer({asset,agent,parent=agent?.mesh?.parent,hf=null}={}){
  if(!asset||!agent||!['stag','doe','fawn'].includes(agent.r.key)||!parent)throw new Error('Explicit supported deer controller and parent required');
  const instance=asset.instantiate({size:2.8,rotation:[0,Math.PI/2,0],referenceClip:'Idle'}),root=new THREE.Group();root.name='imported-'+agent.r.key;root.userData.label=agent.mesh.userData.label;root.add(instance.root);
  const names=new Map();instance.model.traverse(o=>{if(o.isBone)names.set(o.name,o);});updateSkin(instance.root);
  const feet=Object.entries(MAP).map(([name,list])=>{const chain=list.map(n=>names.get(n));if(chain.some(b=>!b))throw new Error('Missing measured deform-chain '+list.join('/'));const control=names.get((name.startsWith('wrist')?'IKFrontLeg':'IKBackLeg')+(name.endsWith('L')?'R':'L'));if(!control)throw new Error('Missing weighted foot control '+name);const sole=findSole(instance.model,control),ankleOffset=chain.at(-1).worldToLocal(control.getWorldPosition(new V()));const rest=[];control.traverse(b=>{if(b.isBone)rest.push({b,q:b.quaternion.clone()});});return {name,chain,control,sole,ankleOffset,rest,limbRest:chain.map(b=>({b,q:b.quaternion.clone()}))};});
  const old=agent.detailData.feet,front=feet.filter(f=>f.name.startsWith('wrist')),back=feet.filter(f=>f.name.startsWith('hock'));
  const average=(a,fn)=>a.reduce((s,x)=>s+fn(x),0)/a.length;
  const oldFront=average(old.filter(f=>f.bone.startsWith('wrist')),f=>f.sole[0]),oldBack=average(old.filter(f=>f.bone.startsWith('hock')),f=>f.sole[0]);
  const newFront=average(front,f=>f.sole.point.x),newBack=average(back,f=>f.sole.point.x),ratio=(oldFront-oldBack)/(newFront-newBack);
  if(!Number.isFinite(ratio)||ratio<=0)throw new Error('Measured deer forward axis/foot span invalid');
  instance.root.scale.multiplyScalar(ratio);instance.root.position.x=(oldFront+oldBack)/2-(newFront+newBack)/2*ratio;instance.root.position.y=.045;
  const originalVisible=agent.mesh.visible,materials=new Map();instance.model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.userData.label=agent.mesh.userData.label;o.material=[o.material].flat().map(m=>{if(!materials.has(m)){const own=m.clone();applyWet(own,true);materials.set(m,own);}return materials.get(m);});if(o.material.length===1)o.material=o.material[0];});
  parent.add(root);let reactionBlend=0,shakeBlend=0,visualTime=0,urgentBlend=0;let disposed=false,active=null,lastKey=null,bodyDrop=0,status={backend:'pending',contacts:[]};
  let triangles=0;instance.model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  const lengths=feet.map(f=>f.chain.map(b=>({bone:b.name,position:b.position.toArray(),scale:b.scale.toArray()})));
  // Mixer property bindings cache their last written values. IK must not become
  // the next frame's starting pose, especially on static/unkeyed rig helpers.
  const authored=[...names.values()].map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  const initialAuthored=authored.map(f=>({p:f.p.clone(),q:f.q.clone(),s:f.s.clone()}));
  const sync=()=>{root.position.copy(agent.mesh.position);root.position.y-=bodyDrop;root.quaternion.copy(agent.mesh.quaternion);root.scale.copy(agent.mesh.scale);root.updateWorldMatrix(true,true);};
  const adapter={root,instance,feet,ratio,lengths,
    update(dt){if(disposed)throw new Error('Imported deer disposed');if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid deer delta');sync();
      const key=JSON.stringify({state:agent.state,escape:!!agent.escape,reason:agent.reason,recovery:agent.recovery?.shake,phase:agent.phase,p:agent.mesh.position.toArray(),q:agent.mesh.quaternion.toArray(),s:agent.mesh.scale.toArray(),contacts:agent.motion.snapshot()});
      if(dt===0&&key===lastKey)return status;
      lastKey=key;
      const state=agent.state,capability=importedDeerState(state,!!agent.escape||['startle','tigerflee'].includes(agent.reason)),clip=capability.clip;
      root.visible=true;agent.mesh.visible=false;
      for(const f of authored){f.b.position.copy(f.p);f.b.quaternion.copy(f.q);f.b.scale.copy(f.s);}
      const action=instance.play(clip,{fade:active===null?0:.2});active=clip;
      if(state==='walk')action.time=agent.phase*action.getClip().duration-dt;
      instance.update(dt);
      for(const f of authored){f.p.copy(f.b.position);f.q.copy(f.b.quaternion);f.s.copy(f.b.scale);}
      // Small bounded same-rig overlays, smoothly entered/exited. No visibility
      // swap. Authored pose cache above remains pure; IK sees this frame only.
      if(dt>0){visualTime+=dt;const k=1-Math.exp(-dt*14);
        urgentBlend=capability.motion==='rapid-walk'?1:urgentBlend*Math.exp(-dt*2);
        reactionBlend+=((['crouch','sleep','lie','sit','roll'].includes(state)?1:0)-reactionBlend)*k;
        shakeBlend+=((state==='shake'?1:0)-shakeBlend)*k;
      }
      const neck=names.get('Neck1'),head=names.get('Head');
      if(neck)neck.rotateX(.12*reactionBlend);
      if(head)head.rotateY(Math.sin(visualTime*32)*.12*shakeBlend);
      bodyDrop=.035*reactionBlend*agent.mesh.scale.y;sync();updateSkin(root);
      const contacts=agent.motion.snapshot(),rows=[];
      for(const f of feet){
        f.ankleOffset.copy(f.chain.at(-1).worldToLocal(f.control.getWorldPosition(new V())));
      }
      let ikTranslationError=0;
      // Full-chain reach settlement, including terrain-grounded free contacts.
      // The old two-link sphere omitted a real segment and crouched all legs.
      // No limb translations/scales or physics contacts are changed.
      const overlayDrop=.035*reactionBlend*agent.mesh.scale.y;
      bodyDrop=overlayDrop;sync();updateSkin(root);
      let neededDrop=0;
      for(const f of feet){
        const c=contacts.find(c=>c.bone===f.name);const contactValid=['stance','swing'].includes(c.mode);if(!contactValid&&!hf)continue;
        if(c.mode==='stance')for(const r of f.rest)r.b.quaternion.copy(r.q);
        for(const r of f.limbRest)r.b.quaternion.copy(r.q);updateSkin(root);
        const point=actualVertex(f.sole.mesh,f.sole.index),reachTarget=contactValid?new V(...c.target):point.clone().setY(hf.heightAt(point.x,point.z)),ankle=f.control.getWorldPosition(new V()).add(reachTarget.sub(point));
        const joints=f.chain.map(b=>b.getWorldPosition(new V()));
        let reach=f.chain.at(-1).localToWorld(f.ankleOffset.clone()).distanceTo(joints.at(-1));
        for(let i=1;i<joints.length;i++)reach+=joints[i].distanceTo(joints[i-1]);
        const hip=joints[0],horizontal=(hip.x-ankle.x)**2+(hip.z-ankle.z)**2;
        neededDrop=Math.max(neededDrop,hip.y-ankle.y-Math.sqrt(Math.max(0,reach*reach-horizontal)));
      }
      // Island relief can require a little more than the flat-fixture .105:
      // the fawn wrist at t=4.45 needs .1595 local, not a longer shin.
      // Settle only the measured reach deficit; zero deficit stays upright.
      // Keep the existing urgent ceiling, with no scale/physics changes.
      bodyDrop=overlayDrop+THREE.MathUtils.clamp(neededDrop,0,(.17+.02*urgentBlend)*root.scale.y);sync();updateSkin(root);
      for(const f of feet){const c=contacts.find(c=>c.bone===f.name);if(!c)throw new Error('Missing authoritative contact '+f.name);
        const target=new V(...c.target),valid=c.mode==='stance'||c.mode==='swing';
        if(!valid&&hf){const point=actualVertex(f.sole.mesh,f.sole.index);target.copy(point);target.y=hf.heightAt(point.x,point.z);}
        const grounded=valid||!!hf;
        let error=null;
        if(grounded){
          if(c.mode==='stance')for(const r of f.rest)r.b.quaternion.copy(r.q);
          updateSkin(root);
          // Exported IK/FF nodes really deform these models' hoof vertices.
          // LowerLeg's lowest fully weighted vertex is SHIN, ~.25m above sole.
          const before=f.chain.map(b=>b.position.clone());
          const point=actualVertex(f.sole.mesh,f.sole.index),wanted=f.control.getWorldPosition(new V()).add(target.clone().sub(point));
          f.control.position.copy(f.control.parent.worldToLocal(wanted));updateSkin(root);
          for(const r of f.limbRest)r.b.quaternion.copy(r.q);updateSkin(root);
          // First orient the whole hind chain toward the target, retaining the
          // authored backward hock; finish with the distal two-link solve.
          if(f.name.startsWith('hock')){
            const hip=f.chain[0],origin=hip.getWorldPosition(new V()),end=f.chain.at(-1).localToWorld(f.ankleOffset.clone()),wanted=f.control.getWorldPosition(new V());
            const delta=new Q().setFromUnitVectors(end.sub(origin).normalize(),wanted.clone().sub(origin).normalize());
            hip.quaternion.copy(hip.parent.getWorldQuaternion(new Q()).invert().multiply(delta).multiply(hip.getWorldQuaternion(new Q())));updateSkin(root);
          }
          error=solveImportedChain(f.chain,f.ankleOffset,f.control.getWorldPosition(new V()),{iterations:120,tolerance:1e-5});updateSkin(root);
          f.chain.forEach((b,i)=>ikTranslationError=Math.max(ikTranslationError,b.position.distanceTo(before[i])));
        }
        const skin=actualVertex(f.sole.mesh,f.sole.index);rows.push({bone:f.name,footControl:f.control.name,mode:c.mode,target:target.toArray(),skin:skin.toArray(),error,skinError:grounded?skin.distanceTo(target):null});
      }
      status={backend:'imported-deer',clip,motion:capability.motion,unsupported:capability.unsupported||null,reactionBlend,shakeBlend,contacts:rows,ratio,triangles,ikTranslationError,bodyDrop};return status;
    },
    resetForTest(){
      if(disposed)throw new Error('Imported deer disposed');
      instance.stop();instance.mixer.time=0;active=null;lastKey=null;
      reactionBlend=0;shakeBlend=0;visualTime=0;urgentBlend=0;bodyDrop=0;
      authored.forEach((f,i)=>{const initial=initialAuthored[i];f.p.copy(initial.p);f.q.copy(initial.q);f.s.copy(initial.s);f.b.position.copy(f.p);f.b.quaternion.copy(f.q);f.b.scale.copy(f.s);});
      status={backend:'pending',contacts:[]};return adapter.update(0);
    },
    reset(){return adapter.resetForTest();},
    snapshot(){return structuredClone(status);},
    dispose(){if(disposed)return;disposed=true;agent.mesh.visible=originalVisible;instance.dispose();root.removeFromParent();for(const m of materials.values())m.dispose();},
  };adapter.update(0);return adapter;
}
