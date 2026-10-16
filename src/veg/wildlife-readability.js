import * as THREE from 'three';

/** Shorter, quieter SOFT groundcover beside native patrols. No trunks, terrain,
 * material/geometry buffers or navigation records are removed or modified. */
export function softenWildlifeCover(group,zones=[]) {
 if(group.userData.wildlifeReadability)return group.userData.wildlifeReadability;
 const report={instancesAdjusted:0,meshes:0,zones:zones.length},m=new THREE.Matrix4(),p=new THREE.Vector3(),c=new THREE.Color();
 for(const mesh of group.children){
  if(!mesh.isInstancedMesh||!(/^(grass-|flowers-)/.test(mesh.name)||['ferns','jungle-leaves'].includes(mesh.name)))continue;
  let changed=0;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m);let influence=0;
   for(const z of zones){const ca=Math.cos(z.angle||0),sa=Math.sin(z.angle||0),dx=p.x-z.x,dz=p.z-z.z,rx=z.major+1.8,rz=z.minor+1.8,q=Math.hypot((dx*ca+dz*sa)/rx,(-dx*sa+dz*ca)/rz);influence=Math.max(influence,1-THREE.MathUtils.smoothstep(q,1,1.55));}
   if(influence<=0)continue;
   const leafy=['ferns','jungle-leaves'].includes(mesh.name),height=1-influence*(leafy?.48:.60),width=1-influence*(leafy?.22:0);
   m.scale(new THREE.Vector3(width,height,width));mesh.setMatrixAt(i,m);
   if(mesh.instanceColor&&mesh.name.startsWith('flowers-')){mesh.getColorAt(i,c);c.multiplyScalar(1-.20*influence);mesh.setColorAt(i,c);}
   changed++;
  }
  if(changed){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();report.meshes++;report.instancesAdjusted+=changed;}
 }
 group.userData.wildlifeReadability=report;return report;
}
