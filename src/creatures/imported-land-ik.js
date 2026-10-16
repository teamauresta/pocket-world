import * as THREE from 'three';
const V=THREE.Vector3,Q=THREE.Quaternion;
/** FABRIK world positions with immutable segment lengths and authored pose seed.
 * Only joint rotations are written; the exported weighted hoof root is separate. */
export function solveImportedChain(chain,offset,target,{iterations=80,tolerance=1e-5}={}){
 chain[0].updateWorldMatrix(true,true);
 const points=chain.map(b=>b.getWorldPosition(new V()));points.push(chain.at(-1).localToWorld(offset.clone()));
 const lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),origin=points[0].clone(),reach=lengths.reduce((a,b)=>a+b,0);
 if(origin.distanceTo(target)>=reach){const direction=target.clone().sub(origin).normalize();for(let i=1;i<points.length;i++)points[i].copy(points[i-1]).addScaledVector(direction,lengths[i-1]);}
 else for(let n=0;n<iterations;n++){
  points.at(-1).copy(target);
  for(let i=points.length-2;i>=0;i--)points[i].sub(points[i+1]).normalize().multiplyScalar(lengths[i]).add(points[i+1]);
  points[0].copy(origin);
  for(let i=1;i<points.length;i++)points[i].sub(points[i-1]).normalize().multiplyScalar(lengths[i-1]).add(points[i-1]);
  if(points.at(-1).distanceTo(target)<tolerance)break;
 }
 for(let i=0;i<chain.length;i++){const joint=chain[i],o=joint.getWorldPosition(new V()),end=i+1<chain.length?chain[i+1].getWorldPosition(new V()):joint.localToWorld(offset.clone());const delta=new Q().setFromUnitVectors(end.sub(o).normalize(),points[i+1].clone().sub(o).normalize());joint.quaternion.copy(joint.parent.getWorldQuaternion(new Q()).invert().multiply(delta).multiply(joint.getWorldQuaternion(new Q()))).normalize();joint.updateWorldMatrix(false,true);}
 return chain.at(-1).localToWorld(offset.clone()).distanceTo(target);
}
