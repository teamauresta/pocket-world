import * as THREE from 'three';

// Exact all-vertex LBS guard, not a sampled envelope or bone/bind-box proxy.
// Three's getVertexPosition rebuilds boneWorld * inverseBind for every influence
// of every vertex. Rebuild those matrices once per mesh per call instead.
// No Float32 skeleton texture rounding, pose throttling or geometry reduction.
export function createBirdBoundsGuard() {
  const cache = new WeakMap(), v = new THREE.Vector3(), post = new THREE.Matrix4();
  const affine = m => m.elements.every(Number.isFinite) && m.elements[3]===0 && m.elements[7]===0 && m.elements[11]===0 && m.elements[15]===1;
  return (root, inverseCarrier, target = new THREE.Box3()) => {
    target.makeEmpty(); let valid = true;
    root.traverse(o => {
      if (!o.isMesh || !valid) return;
      const g=o.geometry, p=g.attributes.position, si=g.attributes.skinIndex, sw=g.attributes.skinWeight;
      // Unsupported morph/custom paths keep Three's exact reference computation.
      const fast=o.isSkinnedMesh && si && sw && !Object.keys(g.morphAttributes).length && affine(o.bindMatrix) && affine(o.bindMatrixInverse) && affine(o.matrixWorld) && affine(inverseCarrier);
      if (!fast) {
        for(let j=0;j<p.count;j++) {
          o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld).applyMatrix4(inverseCarrier);
          if(!v.toArray().every(Number.isFinite)){valid=false;break;}
          target.expandByPoint(v);
        }
        return;
      }
      const s=o.skeleton;
      let matrices=cache.get(o);
      if(!matrices || matrices.length!==s.bones.length){matrices=s.bones.map(()=>new THREE.Matrix4());cache.set(o,matrices);}
      for(let b=0;b<matrices.length;b++) {
        matrices[b].multiplyMatrices(s.bones[b].matrixWorld,s.boneInverses[b]);
        if(!affine(matrices[b])) { valid=false;return; }
      }
      post.multiplyMatrices(inverseCarrier,o.matrixWorld).multiply(o.bindMatrixInverse);
      const a=o.bindMatrix.elements, c=post.elements;
      const raw=!p.isInterleavedBufferAttribute && !si.isInterleavedBufferAttribute && !sw.isInterleavedBufferAttribute && !p.normalized && !si.normalized && !sw.normalized && p.itemSize===3 && si.itemSize===4 && sw.itemSize===4;
      const pa=p.array,ia=si.array,wa=sw.array;
      for(let j=0;j<p.count;j++) {
        const px=raw?pa[j*3]:p.getX(j),py=raw?pa[j*3+1]:p.getY(j),pz=raw?pa[j*3+2]:p.getZ(j);
        const x=a[0]*px+a[4]*py+a[8]*pz+a[12], y=a[1]*px+a[5]*py+a[9]*pz+a[13], z=a[2]*px+a[6]*py+a[10]*pz+a[14];
        let sx=0,sy=0,sz=0;
        for(let k=0;k<4;k++) {
          const w=raw?wa[j*4+k]:sw.getComponent(j,k); if(w===0)continue;
          const b=raw?ia[j*4+k]:si.getComponent(j,k),m=matrices[b]?.elements;
          if(!Number.isFinite(w)||!m){valid=false;return;}
          sx+=(m[0]*x+m[4]*y+m[8]*z+m[12])*w;
          sy+=(m[1]*x+m[5]*y+m[9]*z+m[13])*w;
          sz+=(m[2]*x+m[6]*y+m[10]*z+m[14])*w;
        }
        v.set(c[0]*sx+c[4]*sy+c[8]*sz+c[12],c[1]*sx+c[5]*sy+c[9]*sz+c[13],c[2]*sx+c[6]*sy+c[10]*sz+c[14]);
        if(!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.z)){valid=false;return;}
        target.expandByPoint(v);
      }
    });
    // Fail closed for invalid poses; outward rounding is far below the existing
    // 1e-5 envelope tolerance and protects against regrouped affine arithmetic.
    if(!valid) return null;
    return target.expandByScalar(1e-9);
  };
}
