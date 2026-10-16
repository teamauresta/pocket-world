/** White Tiger / CGJAY1111 runtime adaptation. Source contains Idle ONLY.
 * Generated locomotion: world-locked skin soles, native ribbon-bone IK; no substitute rig.
 * Root +X forward. Caller owns route/root translation; speed is actual world units/sec.
 */
import * as T from 'three';
const V=()=>new T.Vector3(), Q=()=>new T.Quaternion();
const clamp=T.MathUtils.clamp, mix=T.MathUtils.lerp;
export const OWNER_TIGER_PROFILE=Object.freeze({sourceClip:'Idle',generated:['GeneratedWalk','GeneratedRun'],nativeForward:'+Z',forward:'+X',rotation:[0,Math.PI/2,0],rootMotion:'external route; world-locked stance',boneCount:121});
export function createOwnerTigerMotion(asset,{size=2.8}={}){
 const native=asset.instantiate({size,referenceClip:'Idle',rotation:OWNER_TIGER_PROFILE.rotation});
 const {root,model}=native, bones=[]; model.traverse(o=>{if(o.isBone)bones.push(o);});
 const find=s=>{const b=bones.find(b=>b.name.startsWith(s));if(!b)throw Error('Tiger native bone missing: '+s);return b;};
 if(bones.length!==121){native.dispose();throw Error('Expected native 121-bone tiger rig');}
 const rest=new Map(bones.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const world=b=>b.getWorldPosition(V());
 const sync=()=>{root.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();};
 sync();
 const limbs=[['LF','l_',true,0],['RF','r_',true,.5],['LH','l_',false,.75],['RH','r_',false,.25]].map(([id,side,front,offset])=>{
  const f=front?'Front':'',hip=find(side+'femurRibbon'+f+'_00_'), knee=find(side+'tibiaRibbon'+f+'_00_'), ankle=find(side+'foot'+f+'_00_'), ball=find(side+'ball'+f+'_00_');
  const descendants=new Set();ball.traverse(b=>{if(b.isBone)descendants.add(b);});
  const points=[];
  for(const mesh of meshes){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++)if(descendants.has(mesh.skeleton.bones[si.getComponent(i,k)]))w+=sw.getComponent(i,k);if(w>.65)points.push({mesh,i,p:mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld)});}}
  if(points.length<4)throw Error('Tiger paw has insufficient weighted vertices: '+id);
  const min=Math.min(...points.map(p=>p.p.y));const sole=points.filter(p=>p.p.y<min+size*.006);const center=sole.reduce((v,p)=>v.add(p.p),V()).multiplyScalar(1/sole.length);
  const chain=[];for(let b=ball.parent;b&&b!==hip.parent;b=b.parent)chain.unshift(b);
  return {id,front,offset,hip,knee,ankle,ball,chain,sole:sole.map(({mesh,i})=>({mesh,i})),restCenter:root.worldToLocal(center.clone()),ballOffset:center.clone().sub(world(ball)),soleHeight:center.y-min,ballQ:ball.getWorldQuaternion(Q()),anchor:center.clone(),target:center.clone(),phase:offset,stance:true,wasStance:true,swingStart:center.clone(),swingEnd:center.clone(),error:0};
 });
 const measure=l=>{sync();let min=Infinity,minGround=Infinity;const center=V();for(const {mesh,i} of l.sole){const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);center.add(p);min=Math.min(min,p.y);minGround=Math.min(minGround,p.y-ground(p.x,p.z));}center.multiplyScalar(1/l.sole.length);return {center,min,minGround};};
 function rotateToward(b,end,target){const p=world(b),a=world(end).sub(p).normalize(),d=target.clone().sub(p).normalize();if(!a.lengthSq()||!d.lengthSq())return;const delta=Q().setFromUnitVectors(a,d),w=b.getWorldQuaternion(Q()).premultiply(delta),parent=b.parent.getWorldQuaternion(Q()).invert();b.quaternion.copy(parent.multiply(w));root.updateMatrixWorld(true);}
 function solve(l,target){
  // Three anatomical joints move; all intermediary native ribbon segments remain in hierarchy.
  // Iterative rotations keeps original segment lengths and continuous skin weights.
  for(let n=0;n<32;n++){
   for(const b of [l.ankle,l.knee,l.hip])rotateToward(b,l.ball,target);
   if(world(l.ball).distanceTo(target)<size*.00003)break;
  }
 }
 let elapsed=0,distance=0,phase=.3,speed=0,blend=0,turnSettle=0,disposed=false,lastState='Idle',groundFn=()=>0;
 const baseCarrierY=model.parent.position.y;
 const baseRoot=root.position.clone(),baseQ=root.quaternion.clone(),baseScale=root.scale.clone();
 let initialized=false;
 const initial=limbs.map(l=>({anchor:l.anchor.clone()}));
 function ground(x,z){const v=groundFn(x,z);return typeof v==='number'?v:(v?.height??v?.y??0);}
 function place(l,soleTarget){
  const desiredQ=root.getWorldQuaternion(Q()).multiply(l.ballQ);
  const offset=l.ballOffset.clone().applyQuaternion(root.getWorldQuaternion(Q()));
  const target=soleTarget.clone().sub(offset);
  for(let k=0;k<3;k++){
   solve(l,target);l.ball.quaternion.copy(l.ball.parent.getWorldQuaternion(Q()).invert().multiply(desiredQ));sync();
   const actual=measure(l).center;target.add(soleTarget.clone().sub(actual));
  }
  const m=measure(l);l.error=m.center.distanceTo(soleTarget);l.actual=m.center;l.min=m.min;
 }
 function pose(dt,input){
  native.update(dt);
  // Authored Idle includes bone translations/scales. Preserve exact native segment lengths,
  // while keeping its rotation animation throughout torso/head/tail/face.
  for(const b of bones){b.position.copy(rest.get(b).p);b.scale.copy(rest.get(b).s);}
  for(const l of limbs)for(const b of l.chain)b.quaternion.copy(rest.get(b).q);
  // Original 2% settling plus bounded 1.8% turn reach margin, smoothly eased.
  turnSettle=mix(turnSettle,.018*Math.min(1,Math.abs(input.angularSpeed??0)/.12),1-Math.exp(-dt*8));
  const carrier=model.parent;carrier.position.y=baseCarrierY-size*(.02+turnSettle)*(1-Math.exp(-elapsed*12));
  // Pitch the intact native model to a sampled ground tangent; no bone-length changes.
  const heading=root.getWorldQuaternion(Q()),fwd=new T.Vector3(1,0,0).applyQuaternion(heading),c=root.getWorldPosition(V()),span=size*.3;
  const grade=(ground(c.x+fwd.x*span,c.z+fwd.z*span)-ground(c.x-fwd.x*span,c.z-fwd.z*span))/(2*span);
  carrier.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),Math.atan(clamp(grade,-.18,.18))).multiply(Q().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2));
  sync();
  const running=input.state==='Run'||input.state==='running'||input.state==='bolt';
  const runWeight=running?1:clamp((speed-size*.30)/(size*.30),0,1);
  const duty=mix(.66,.53,runWeight), stride=size*mix(.14,.20,runWeight);
  // speed/stride means planted soles move backward exactly as fast as the route moves forward.
  const angularSpeed=input.angularSpeed??0;
  // Turning moves each paw even when the root does not translate. Bound stance
  // travel using the furthest native paw, rather than leaving old anchors locked
  // through a pivot. Zero angular input preserves the qualified straight gait.
  const pawRadius=Math.max(...limbs.map(l=>Math.hypot(l.restCenter.x,l.restCenter.z)));
  const steppingSpeed=speed+Math.abs(angularSpeed)*pawRadius;
  const turnStride=stride/(1+Math.abs(angularSpeed)*pawRadius/Math.max(steppingSpeed,1e-8));
  const frequency=steppingSpeed/turnStride;phase+=frequency*dt;distance+=speed*dt;
  blend=clamp(steppingSpeed/(size*.08),0,1);lastState=blend<.01?'Idle':runWeight>.5?'GeneratedRun':'GeneratedWalk';
  const forward=new T.Vector3(1,0,0).applyQuaternion(root.getWorldQuaternion(Q()));
  for(const l of limbs){
   const offset=mix(l.offset,l.id==='LF'||l.id==='RH'?0:.5,runWeight),p=(phase+offset)%1;
   const stance=p<duty;
   const nominal=root.localToWorld(l.restCenter.clone());
   if(!stance&&l.wasStance){
    l.swingStart.copy(l.anchor);
    const ahead=(1-duty+duty*.5)/Math.max(frequency,1e-8),turn=angularSpeed*ahead;
    const futureQ=root.getWorldQuaternion(Q()).premultiply(Q().setFromAxisAngle(new T.Vector3(0,1,0),turn));
    const center=root.getWorldPosition(V());
    // Exact constant-twist prediction: the native paw offset rotates with the
    // future body, including the sideways displacement during a curved step.
    const travel=forward.clone().applyAxisAngle(new T.Vector3(0,1,0),turn*.5)
      .multiplyScalar(speed*ahead*(Math.abs(turn)<1e-6?1:Math.sin(turn*.5)/(turn*.5)));
    if(angularSpeed===0)l.swingEnd.copy(nominal).addScaledVector(forward,stride*(1-duty+duty*.5));
    else l.swingEnd.copy(l.restCenter).applyQuaternion(futureQ).add(center).add(travel);
    l.swingEnd.y=ground(l.swingEnd.x,l.swingEnd.z)+l.soleHeight;
   }
   if(stance&&!l.wasStance){l.anchor.copy(l.swingEnd);l.anchor.y=ground(l.anchor.x,l.anchor.z)+l.soleHeight;}
   if(!initialized){l.anchor.copy(nominal);l.anchor.y=ground(nominal.x,nominal.z)+l.soleHeight;l.swingStart.copy(l.anchor);l.swingEnd.copy(l.anchor);l.target.copy(l.anchor);}
   let target=l.anchor.clone();
   if(!stance){const u=(p-duty)/(1-duty),s=u*u*(3-2*u);target.lerpVectors(l.swingStart,l.swingEnd,s);target.y=mix(ground(l.swingStart.x,l.swingStart.z),ground(l.swingEnd.x,l.swingEnd.z),s)+l.soleHeight+blend*size*mix(.035,.055,runWeight)*Math.sin(Math.PI*u)**2;}
   // Quiet feet remain planted while native breathing/tail/head continue.
   if(steppingSpeed<1e-5&&!stance){target.copy(l.target);target.y=mix(target.y,ground(target.x,target.z)+l.soleHeight,1-Math.exp(-dt*16));}
   l.target.copy(target);l.phase=p;l.stance=stance||(steppingSpeed<1e-5&&Math.abs(target.y-ground(target.x,target.z)-l.soleHeight)<size*.001);l.wasStance=stance;place(l,target);
  }
  initialized=true;sync();
 }
 const api={root,model,native,profile:OWNER_TIGER_PROFILE,
  update(dt,input={}){if(disposed)throw Error('Tiger disposed');if(!Number.isFinite(dt)||dt<0)throw Error('Invalid delta');if(dt===0||input.paused)return;const v=input.speed??0;if(!Number.isFinite(v)||v<0)throw Error('Tiger speed must be finite/nonnegative');if(!Number.isFinite(input.angularSpeed??0))throw Error('Tiger angularSpeed must be finite');groundFn=typeof input.ground==='function'?input.ground:()=>0;speed=v;elapsed+=dt;pose(dt,input);},
  reset(){if(disposed)throw Error('Tiger disposed');native.stop();native.play('Idle',{fade:0});native.mixer.setTime(0);root.position.copy(baseRoot);root.quaternion.copy(baseQ);root.scale.copy(baseScale);for(const b of bones){const r=rest.get(b);b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}model.parent.position.y=baseCarrierY;model.parent.rotation.set(0,Math.PI/2,0);initialized=false;elapsed=distance=speed=blend=turnSettle=0;phase=.3;lastState='Idle';groundFn=()=>0;limbs.forEach((l,i)=>{l.anchor.copy(initial[i].anchor);l.target.copy(l.anchor);l.swingStart.copy(l.anchor);l.swingEnd.copy(l.anchor);l.wasStance=l.stance=true;l.phase=l.offset;l.error=0;});sync();},
  snapshot(){return {state:lastState,elapsed,distance,phase,speed,blend,sourceClip:'Idle',generated:true,boneCount:bones.length,root:root.position.toArray(),feet:limbs.map(l=>{const m=measure(l);return {id:l.id,phase:l.phase,stance:l.stance,target:l.target.toArray(),sole:m.center.toArray(),minY:m.min,groundClearance:m.minGround,error:m.center.distanceTo(l.target),sampleCount:l.sole.length,chain:l.chain.map(b=>b.name)};}),segmentError:Math.max(...bones.map(b=>Math.abs(b.position.length()-rest.get(b).p.length())))};},
  dispose(){if(disposed)return;disposed=true;native.dispose();}
 };return api;
}
