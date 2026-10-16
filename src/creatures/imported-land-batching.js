/** Lossless draw batching for the two supplied opaque, untextured land palettes.
 * Original GLB bytes, triangle indices, vertex positions/normals/skin weights,
 * skeleton and clips are retained. Only equal-BRDF material colours become linear
 * vertex colours. Incompatible assets are rejected, never silently simplified. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const signature=m=>JSON.stringify({roughness:m.roughness,metalness:m.metalness,emissive:m.emissive.toArray(),emissiveIntensity:m.emissiveIntensity,side:m.side,shadowSide:m.shadowSide,flatShading:m.flatShading,depthTest:m.depthTest,depthWrite:m.depthWrite,depthFunc:m.depthFunc,blending:m.blending,premultipliedAlpha:m.premultipliedAlpha,toneMapped:m.toneMapped,envMapIntensity:m.envMapIntensity,polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits});
export function batchOwnerLandPalette(gltf){
 if(!gltf?.scene)throw new Error('Explicit loaded land scene required');
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 if(meshes.length<2||meshes.some(m=>!m.isSkinnedMesh||m.children.length||Array.isArray(m.material)))throw new Error('Only sibling skinned palette primitives supported');
 const first=meshes[0],mat=first.material,base=signature(mat);
 for(const m of meshes){
  if(m.parent!==first.parent||m.skeleton!==first.skeleton||!m.matrix.equals(first.matrix)||!m.bindMatrix.equals(first.bindMatrix)||m.bindMode!==first.bindMode||Object.keys(m.geometry.morphAttributes).length)throw new Error('Distinct transforms, rigs or morphs cannot be palette batched');
  const a=m.material;if(!a.isMeshStandardMaterial||a.transparent||a.opacity!==1||a.alphaTest||a.alphaHash||a.wireframe||Object.values(a).some(v=>v?.isTexture)||signature(a)!==base)throw new Error('Different material response or texture is not losslessly batchable');
  if(gltf.animations?.some(c=>c.tracks.some(t=>t.name.startsWith(m.name+'.'))))throw new Error('Animated mesh primitive cannot be replaced');
 }
 const pieces=meshes.map(m=>{const g=m.geometry.clone(),p=g.attributes.position,old=g.attributes.color,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){c[i*3]=(old?old.getX(i):1)*m.material.color.r;c[i*3+1]=(old?old.getY(i):1)*m.material.color.g;c[i*3+2]=(old?old.getZ(i):1)*m.material.color.b;}g.setAttribute('color',new THREE.BufferAttribute(c,3));g.clearGroups();return g;});
 const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!geometry)throw new Error('Incompatible palette vertex layouts');
 const material=mat.clone();material.name='Owner original linear palette · batched';material.color.setRGB(1,1,1);material.vertexColors=true;
 const combined=new THREE.SkinnedMesh(geometry,material);combined.name=first.name;combined.position.copy(first.position);combined.quaternion.copy(first.quaternion);combined.scale.copy(first.scale);combined.matrix.copy(first.matrix);combined.matrixAutoUpdate=first.matrixAutoUpdate;combined.layers.mask=first.layers.mask;combined.castShadow=first.castShadow;combined.receiveShadow=first.receiveShadow;combined.bindMode=first.bindMode;combined.bind(first.skeleton,first.bindMatrix);
 const info={sourcePrimitives:meshes.length,resultPrimitives:1,triangles:meshes.reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),palette:meshes.map(m=>({name:m.material.name,linear:m.material.color.toArray(),vertices:m.geometry.attributes.position.count})),originalBytesModified:false};combined.userData.ownerPaletteBatch=info;
 const parent=first.parent,order=parent.children.indexOf(first);for(const m of meshes)parent.remove(m);parent.add(combined);parent.children.splice(parent.children.indexOf(combined),1);parent.children.splice(order,0,combined);gltf.scene.updateMatrixWorld(true);
 const remainingGeometry=new Set(),remainingMaterial=new Set();gltf.scene.traverse(o=>{if(o.isMesh){remainingGeometry.add(o.geometry);for(const m of [o.material].flat())remainingMaterial.add(m);}});
 for(const g of new Set(meshes.map(m=>m.geometry)))if(!remainingGeometry.has(g))g.dispose();for(const m of new Set(meshes.map(m=>m.material)))if(!remainingMaterial.has(m))m.dispose();
 gltf.userData={...gltf.userData,ownerPaletteBatch:info};return info;
}
export function createPaletteBatchedLandLoader(){const loader=new GLTFLoader();loader.register(()=>({name:'OWNER_LAND_LINEAR_PALETTE_BATCH',afterRoot:gltf=>batchOwnerLandPalette(gltf)}));return loader;}
