// Decorative litter, fungi and fallen wood. Never writes to the solid hash.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { makeSampler } from './scatter.js';

function paint(g,rgb){if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));g.deleteAttribute('uv');const c=new Float32Array(g.attributes.position.count*3);for(let i=0;i<c.length;i+=3)c.set(rgb,i);g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;}
export function floorGeometry(kind){
  const parts=[];
  if(kind==='mushrooms'){
    for(let i=0;i<3;i++){
      const x=(i-1)*.14,z=(i%2)*.13,h=.15+i*.04;
      const stem=new THREE.CylinderGeometry(.018,.024,h,5);stem.translate(x,h/2,z);parts.push(paint(stem,[.48,.4,.25]));
      const cap=new THREE.SphereGeometry(.09+i*.014,8,4,0,Math.PI*2,0,Math.PI/2);cap.scale(1,.6,1);cap.translate(x,h,z);parts.push(paint(cap,[.35,.16,.055]));
    }
  }else if(kind==='logs'){
    const wood=new THREE.CylinderGeometry(.105,.13,.85,7);wood.rotateZ(Math.PI/2);wood.translate(0,.10,0);parts.push(paint(wood,[.14,.085,.037]));
    // Moss is small irregular cushions on wood only, never a terrain tint.
    for(let i=0;i<7;i++){const g=new THREE.IcosahedronGeometry(.075,0);g.scale(1.1,.35,.65);g.translate(-.3+i*.095,.207,Math.sin(i*2)*.04);parts.push(paint(g,[.09,.16,.033]));}
  }else{
    const rng=mulberry32(kind==='needles'?814:813);
    for(let i=0;i<12;i++){
      const a=rng()*Math.PI*2,r=Math.sqrt(rng())*.42,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const g=new THREE.BufferGeometry(),needle=kind==='needles',w=needle?.007:.045,L=needle?.15:.10;
      g.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,0,0,.014,L,w,0,0,0,.004,-L],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();g.rotateY(rng()*6.283);g.translate(x,.014,z);parts.push(paint(g,needle?[.22,.15,.06]:[.3+rng()*.12,.16,.055]));
    }
  }
  const g=mergeGeometries(parts);g.userData={kind,pieces:kind==='mushrooms'?3:kind==='logs'?1:12};return g;
}

export function buildForestFloor(hf,hash,{quality='high',applyFade,anchors}={}){
  const group=new THREE.Group();group.name='forest-floor';
  const S=makeSampler(hf,93821),R=S.rng,records=anchors ?? [...hash.map.values()].flat();
  const lists={leaves:[],needles:[],mushrooms:[],logs:[]};
  const eligible=(x,z)=>{const p=S.at(x,z);return p.h>1.5&&p.h<19&&p.coast< -3&&p.river>1.5&&p.slope<.13&&p.glade<.025&&(p.forest+p.jungle)>.48?p:null;};
  records.forEach(([x,z,r],index)=>{
    // Only tree-sized colliders. No floor under meadow, glades, river or coast.
    if(r<1.25||!eligible(x,z))return;
    for(let i=0;i<5;i++){
      const a=R()*6.283,rr=.35+R()*Math.min(1.7,r),px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr,p=eligible(px,pz);
      if(!p)continue;
      // Check the entire litter patch footprint, not merely its centre.
      if([[.65,0],[-.65,0],[0,.65],[0,-.65]].some(([dx,dz])=>!eligible(px+dx,pz+dz)))continue;
      const item={x:px,y:p.h+.008,z:pz,rot:R()*6.283,s:.8+R()*.35,anchor:[x,z,r]};
      if(quality!=='high'&&i%2)continue;
      lists[p.forest>p.jungle?'needles':'leaves'].push(item);
      if(i===0&&index%3===0)lists.mushrooms.push({...item,s:.8});
    }
    if(index%5===0){
      // Entire .85m log footprint lies INSIDE an existing solid exclusion.
      const a=R()*6.283,px=x+Math.cos(a)*r*.42,pz=z+Math.sin(a)*r*.42,p=eligible(px,pz);
      if(p&&r*.42+.48<r)lists.logs.push({x:px,y:p.h-.025,z:pz,rot:a,s:1,anchor:[x,z,r]});
    }
  });
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,side:THREE.DoubleSide});
  if(applyFade)applyFade(mat,45,105);
  for(const [kind,list]of Object.entries(lists)){
    if(!list.length)continue;
    const mesh=new THREE.InstancedMesh(floorGeometry(kind),mat,list.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),normal=[0,1,0];
    list.forEach((t,i)=>{hf.normalAt(t.x,t.z,normal);q.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...normal));q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),t.rot));m.compose(new THREE.Vector3(t.x,t.y,t.z),q,new THREE.Vector3(t.s,t.s,t.s));mesh.setMatrixAt(i,m);});
    if(kind==='leaves'||kind==='needles') {
      // Terrain-conforming batch; instance translations are baked, but retained
      // as per-vertex origins so distance fade still shrinks each patch locally.
      const patches=[];
      for(let row=0;row<list.length;row++) {
        mesh.getMatrixAt(row,m);const g=mesh.geometry.clone();g.applyMatrix4(m);
        const p=g.attributes.position,origins=new Float32Array(p.count*3),t=list[row];
        for(let i=0;i<p.count;i++){p.setY(i,hf.heightAt(p.getX(i),p.getZ(i))+.018);origins.set([t.x,t.y,t.z],i*3);}
        g.setAttribute('aFloorOrigin',new THREE.BufferAttribute(origins,3));g.computeVertexNormals();patches.push(g);
      }
      const geo=mergeGeometries(patches),litterMat=mat.clone();
      litterMat.onBeforeRender=mat.onBeforeRender;litterMat.customProgramCacheKey=()=>mat.customProgramCacheKey()+'terrain-litter-v2';
      litterMat.onBeforeCompile=shader=>{
        if(!applyFade)return;
        // Non-instanced ground-conforming batch uses the same camera uniform.
        const probe={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:''};mat.onBeforeCompile(probe);
        shader.uniforms.uDetailViewer=probe.uniforms.uDetailViewer;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uDetailViewer; attribute vec3 aFloorOrigin;');
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          float floorFade=1.0-smoothstep(45.0,105.0,distance((modelMatrix*vec4(aFloorOrigin,1.0)).xyz,uDetailViewer));
          transformed=aFloorOrigin+(transformed-aFloorOrigin)*floorFade;`);
      };
      const batch=new THREE.Mesh(geo,litterMat);batch.name='floor-'+kind;batch.receiveShadow=true;batch.userData.patches=list.length;group.add(batch);
      mesh.geometry.dispose();for(const g of patches)g.dispose();continue;
    }
    mesh.name='floor-'+kind;mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();group.add(mesh);
  }
  group.userData.detail={counts:Object.fromEntries(Object.entries(lists).map(([k,v])=>[k,v.length])),placements:lists,collisionRecordsAdded:0};return group;
}
