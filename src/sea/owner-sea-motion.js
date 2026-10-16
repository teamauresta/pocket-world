/** Generated, model-specific CPU deformation. NOT an authored clip or imported rig.
 * Works in normalized +X-forward coordinates; source attributes/materials stay immutable.
 * Transforms source normals with the deformation Jacobian, preserving authored smoothing/UVs.
 */
import * as THREE from 'three';
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function deformSeaPoint(point,kind,length,phase,amplitude=1){
  const p=point.clone();if(amplitude===0)return p;const x=p.x/length,y=p.y/length,z=p.z/length;
  if(kind==='turtle'){
    // Shell occupies medial 42% of span. Only lateral flippers and rear paddles flex.
    const lateral=smooth(.16,.36,Math.abs(z)),front=smooth(-.18,.12,x);
    const w=lateral*(.65+.35*front),sg=Math.sign(z),pivot=.16*length*sg;
    const angle=Math.sin(phase+(front>.5?0:1.2))* .52*w*sg*amplitude;
    const qz=p.z-pivot,qy=p.y+length*.09,c=Math.cos(angle),s=Math.sin(angle);
    p.y=qy*c-qz*s-length*.09;p.z=qy*s+qz*c+pivot;
    p.x+=Math.sin(phase+Math.PI/2)*length*.025*w*amplitude;
  }else{
    const tail=smooth(-.02,-.46,x),fin=smooth(.13,.32,Math.abs(y));
    p.z+=length*amplitude*(.075*tail*tail*Math.sin(phase+tail*1.9)+.012*fin*Math.sin(phase*1.4+x*6));
  }
  return p;
}
export function createOwnerSeaMotion(instance,kind,length){
  if(!['fish','coralFish','turtle'].includes(kind))throw new Error('No generated motion for '+kind);
  instance.root.updateMatrixWorld(true);
  const rootInverse=instance.root.matrixWorld.clone().invert(),records=[];
  instance.model.traverse(mesh=>{
    if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)throw new Error('Static deformation requires unrigged mesh');
    const original=mesh.geometry,geometry=original.clone();mesh.geometry=geometry;
    const matrix=rootInverse.clone().multiply(mesh.matrixWorld),inverse=matrix.clone().invert();
    const normal=new THREE.Matrix3().getNormalMatrix(matrix),normalInverse=new THREE.Matrix3().getNormalMatrix(inverse);
    const positions=original.attributes.position,normals=original.attributes.normal;
    const points=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix));
    const baseNormals=normals?Array.from({length:normals.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normal)):[];
    records.push({mesh,original,geometry,matrix,inverse,normal,normalInverse,positions,normals,points,baseNormals});
  });
  const eps=length*1e-5,axes=[new THREE.Vector3(eps,0,0),new THREE.Vector3(0,eps,0),new THREE.Vector3(0,0,eps)];
  const api={kind:'generated-'+kind+'-fin-motion',records,
    apply(phase,amplitude=1){
      if(!Number.isFinite(phase)||!Number.isFinite(amplitude))throw new Error('Invalid deformation');
      for(const r of records){const p=r.geometry.attributes.position,n=r.geometry.attributes.normal;
        for(let i=0;i<p.count;i++){
          if(amplitude===0){p.setXYZ(i,r.positions.getX(i),r.positions.getY(i),r.positions.getZ(i));if(n)n.setXYZ(i,r.normals.getX(i),r.normals.getY(i),r.normals.getZ(i));continue;}
          const v=r.points[i],q=deformSeaPoint(v,kind,length,phase,amplitude);
          const local=q.clone().applyMatrix4(r.inverse);p.setXYZ(i,local.x,local.y,local.z);
          if(n){const cols=axes.map(a=>deformSeaPoint(v.clone().add(a),kind,length,phase,amplitude).sub(q).divideScalar(eps));
            const jacobian=new THREE.Matrix3().set(cols[0].x,cols[1].x,cols[2].x,cols[0].y,cols[1].y,cols[2].y,cols[0].z,cols[1].z,cols[2].z).invert().transpose();
            const nv=r.baseNormals[i].clone().applyMatrix3(jacobian).applyMatrix3(r.normalInverse).normalize();n.setXYZ(i,nv.x,nv.y,nv.z);}
        }p.needsUpdate=true;if(n)n.needsUpdate=true;r.geometry.computeBoundingBox();r.geometry.computeBoundingSphere();
      }instance.root.updateMatrixWorld(true);
    },
    dispose(){for(const r of records){r.mesh.geometry=r.original;r.geometry.dispose();}}
  };return api;
}
