import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBirdBoundsGuard} from './imported-bird-bounds.js';
function fixture(){
 const root=new THREE.Group(),g=new THREE.BoxGeometry(2,1,3),n=g.attributes.position.count;
 const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);for(let j=0;j<n;j++)for(let k=0;k<4;k++){indices[j*4+k]=k;weights[j*4+k]=[.1,.2,.3,.4][k];}
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const mesh=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial()),bones=Array.from({length:4},()=>new THREE.Bone());bones.forEach(b=>mesh.add(b));mesh.bind(new THREE.Skeleton(bones));root.add(mesh);root.position.set(20,5,-14);root.rotation.set(.3,.7,.1);root.scale.set(.5,1.3,.8);root.updateMatrixWorld(true);return {root,mesh,bones};
}
function reference(root,inv){const box=new THREE.Box3(),v=new THREE.Vector3();root.traverse(o=>{if(o.isMesh)for(let j=0;j<o.geometry.attributes.position.count;j++)box.expandByPoint(o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld).applyMatrix4(inv));});return box;}
function same(root,inv,guard){const a=guard(root,inv),b=reference(root,inv);assert.ok(a.containsBox(b));for(const key of ['min','max'])for(const axis of ['x','y','z'])assert.ok(Math.abs(a[key][axis]-b[key][axis])<1.1e-9);}
test('all vertices/four fractional influences, current matrices and nonuniform transforms match Three',()=>{
 const {root,bones}=fixture(),guard=createBirdBoundsGuard(),inv=new THREE.Matrix4();for(let n=0;n<100;n++){bones.forEach((b,k)=>{b.rotation.set(n*.03,k*.3,n*.1);b.position.set(k*.1,Math.sin(n+k),k*.3);});root.updateMatrixWorld(true);inv.copy(root.matrixWorld).invert();same(root,inv,guard);}
});
test('live positions, weights, bind matrices and replacement geometry are not stale-cached',()=>{
 const {root,mesh}=fixture(),guard=createBirdBoundsGuard(),inv=new THREE.Matrix4();same(root,inv,guard);mesh.geometry.attributes.position.setXYZ(0,30,4,2);mesh.geometry.attributes.skinWeight.setXYZW(0,.7,.2,.1,0);mesh.bindMatrix.makeTranslation(3,1,4);mesh.bindMatrixInverse.copy(mesh.bindMatrix).invert();same(root,inv,guard);mesh.geometry=mesh.geometry.clone();mesh.geometry.attributes.position.setXYZ(1,-40,2,3);same(root,inv,guard);
});
test('morph and static meshes retain full exact reference path',()=>{
 const {root,mesh}=fixture(),guard=createBirdBoundsGuard(),inv=new THREE.Matrix4();mesh.geometry.morphAttributes.position=[mesh.geometry.attributes.position.clone()];mesh.geometry.morphAttributes.position[0].setXYZ(0,7,4,2);mesh.updateMorphTargets();mesh.morphTargetInfluences[0]=.4;root.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));root.updateMatrixWorld(true);same(root,inv,guard);
});
test('nonfinite position or bone matrix fails closed instead of allowing empty/NaN box',()=>{
 const {root,mesh,bones}=fixture(),guard=createBirdBoundsGuard(),inv=new THREE.Matrix4();mesh.geometry.attributes.position.setX(0,NaN);assert.equal(guard(root,inv),null);mesh.geometry.attributes.position.setX(0,0);bones[0].matrixWorld.elements[0]=NaN;assert.equal(guard(root,inv),null);
});

test('normalized weights and interleaved positions use exact accessor fallback',()=>{
 const {root,mesh}=fixture(),guard=createBirdBoundsGuard(),inv=new THREE.Matrix4(),p=mesh.geometry.attributes.position,n=p.count,data=new Float32Array(n*5),weights=new Uint8Array(n*4);
 for(let j=0;j<n;j++){data[j*5+1]=p.getX(j);data[j*5+2]=p.getY(j);data[j*5+3]=p.getZ(j);weights.set([26,51,76,102],j*4);}
 mesh.geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(data,5),3,1));mesh.geometry.setAttribute('skinWeight',new THREE.Uint8BufferAttribute(weights,4,true));same(root,inv,guard);
});
