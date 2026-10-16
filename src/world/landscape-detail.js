// Non-solid surface relief only. Never edits Heightfield or the navigation hash.
import * as THREE from 'three';
import { PEAK } from './config.js';
import { patchUnderwater } from '../render/shared.js';

export function buildLandscapeDetail(hf, { releasePolish = false, quality = 'high' } = {}) {
  const group = new THREE.Group(); group.name = 'landscape-detail';
  group.userData = { nonSolid: true, stats: { count: 0, tris: 0, draws: 0 }, maxRelief: .05 };
  if (!releasePolish) return group;
  const pos = [], colors = [], indices = [];
  // A conforming shallow lamina, never an obstacle-sized decorative boulder.
  function lamina(x,z,rx,rz,angle,relief,color) {
    const base = pos.length/3, c = new THREE.Color(color), ca=Math.cos(angle),sa=Math.sin(angle);
    const footprint=[[0,0],[-.88,-.42],[-.35,-.96],[.72,-.65],[1,.20],[.40,.91],[-.69,.65]];
    footprint.forEach(([u,v],i)=>{
      const px=x+ca*u*rx-sa*v*rz,pz=z+sa*u*rx+ca*v*rz;
      pos.push(px,hf.heightAt(px,pz)+(i===0?relief:.009),pz);
      const shade=i===0?1:.84;
      colors.push(c.r*shade,c.g*shade,c.b*shade);
    });
    for(let i=1;i<=6;i++) indices.push(base,base+(i%6)+1,base+i);
    group.userData.stats.count++;
  }
  // Broken, aligned geological shelves: broad gestures, not gravel noise.
  for(let band=0;band<5;band++) {
    const radius=3.4+band*1.8;
    for(let k=0;k<11;k++) {
      if((k+band*2)%5===0) continue;
      const a=k/11*Math.PI*2+band*.17;
      const x=PEAK.x+Math.cos(a)*radius,z=PEAK.z+Math.sin(a)*radius;
      if(hf.normalAt(x,z)[1]<.55) continue; // Relief only on actual ledges, never stickers on cliff faces.
      if(hf.riverInfo(x,z).dist<3.4) continue;
      lamina(x,z,.28+((k*7)%5)*.035,.11+band*.008,a+Math.PI/2,.035,
        [0x77766b,0x7c796f,0x6c7066][(k+band)%3]);
    }
  }
  // Existing channel bed gravel, submerged and tiny, never the animal banks.
  const path=hf.river.down;
  for(let k=5;k<path.length-4;k+=3) {
    const p=path[k],a=path[k-1],b=path[k+1]; if(p.level<.4) continue;
    const len=Math.hypot(b.x-a.x,b.z-a.z),nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;
    const width=hf.river.downWidth[0]+(hf.river.downWidth[1]-hf.river.downWidth[0])*k/(path.length-1);
    for(let side=-1;side<=1;side+=2) {
      const off=width*(.45+.16*Math.sin(k*1.7));
      const x=p.x+side*nx*off,z=p.z+side*nz*off;
      if(hf.heightAt(x,z)+.085>=p.level-.08) continue;
      if(quality!=='high' && k%2===0) continue;
      lamina(x,z,.10+.055*(1+Math.sin(k)),.08, k*1.3,.045,[0x716b58,0x85806c,0x595b51][k%3]);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.onBeforeCompile=shader=>patchUnderwater(shader);
  material.customProgramCacheKey=()=> 'landscape-lamina-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='landscape-laminae';mesh.receiveShadow=true;
  mesh.userData.nonSolid=true;group.add(mesh);
  group.userData.stats.tris=indices.length/3;group.userData.stats.draws=1;
  return group;
}
