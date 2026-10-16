import * as THREE from 'three';

export function detailSeed(seed) {
  if(typeof seed==='number'&&Number.isFinite(seed)) return seed>>>0;
  let h=2166136261; for(const c of String(seed)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0;
}
const randomAt=(seed,index)=>{let h=(seed+Math.imul(index+1,0x9e3779b9))>>>0;h=Math.imul(h^(h>>>16),0x21f0aaad);h=Math.imul(h^(h>>>15),0x735a2d97);return ((h^(h>>>15))>>>0)/4294967296;};

// One irregular blink per seeded 4.2-second window. Direct evaluation makes
// seeking O(1), deterministic, and independent of frame rate / hidden tabs.
export function blinkAt(time,seed) {
  const t=Math.max(0,Number.isFinite(time)?time:0), window=4.2;
  const i=Math.floor(t/window), start=i*window+0.65+randomAt(seed,i)*2.7;
  const duration=0.17+randomAt(seed^0xa381,i)*0.12, u=(t-start)/duration;
  if(u<0||u>1)return 0;
  return u<0.37?Math.sin(u/0.37*Math.PI/2):Math.cos((u-0.37)/0.63*Math.PI/2);
}

// Local +Z looks out of the face. Every coloured layer is a curved cap, not
// another protruding sphere. White is just a narrow scleral rim, mostly hidden
// in its socket; physically lit clearcoat supplies catchlights (no decals).
function cap(radius,theta0,theta1) {
  const g=new THREE.SphereGeometry(radius,24,12,0,Math.PI*2,theta0,theta1-theta0);
  g.rotateX(Math.PI/2); return g;
}
function lidGeometry() {
  const g=new THREE.BufferGeometry(), cols=24, rows=8;
  g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((cols+1)*(rows+1)*3),3));
  const idx=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;idx.push(a,b,a+1,b,b+1,a+1);}
  g.setIndex(idx);g.userData={cols,rows};return g;
}
// Mesh vertices sweep over the cornea on closure. No alpha-only fake blink.
function wipeLid(g,closure) {
  const {cols,rows}=g.userData,p=g.attributes.position;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
    const u=x/cols*2-1;
    // The rendered scleral cap ends at sin(1.05)=.867. Its upper
    // semicircle sweeps to the matching lower edge, fully covering the iris.
    const xx=u*0.885, extent=Math.sqrt(Math.max(0,0.885*0.885-xx*xx));
    const top=Math.min(0.97,extent+0.045*(1-u*u));
    const edge=THREE.MathUtils.lerp(extent,-extent,closure);
    const yy=THREE.MathUtils.lerp(top,edge,y/rows);
    const zz=Math.sqrt(Math.max(0.015,1-xx*xx-yy*yy));
    p.setXYZ(y*(cols+1)+x,xx*1.035,yy*1.035,zz*1.035);
  }
  p.needsUpdate=true;g.computeVertexNormals();
}

export function createAnimalEyes(rig,data,{species='tiger',seed=1}={}) {
  const head=rig.head||rig.byName?.head;
  const rest=data.joints?.find(j=>j.name==='head')?.pos;
  const records=[], materials=[], geometries=[];
  const constraints=[];
  if(!head||!rest)constraints.push('Missing head rest metadata: eye placement disabled.');
  const root=new THREE.Group();root.name='animal-eyes';root.visible=false;
  if(head&&rest)head.add(root);
  const makeMat=(name,color,roughness=0.05)=>{const m=new THREE.MeshPhysicalMaterial({color,roughness,metalness:0,clearcoat:roughness<0.1?1:0,clearcoatRoughness:0.035,ior:1.38});m.name=name;materials.push(m);return m;};
  const sclera=makeMat('animal-sclera',0x74674e);
  const iris=makeMat('animal-iris',species==='tiger'?0x9b7429:species==='panda'?0x433126:0x704a28);
  const pupil=makeMat('animal-pupil',0x030303);
  const lid=makeMat('animal-lid',species==='tiger'?0x663a20:species==='panda'?0x171512:0x392417,0.76);lid.side=THREE.DoubleSide;
  const add=(parent,g,m,name)=>{geometries.push(g);const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=false;o.receiveShadow=true;parent.add(o);return o;};
  if(head&&rest)for(const e of (data.detail?.eyes||[])){
    if(!e.center?.every(Number.isFinite)||!e.radius?.every(v=>Number.isFinite(v)&&v>0))continue;
    const eye=new THREE.Group();eye.name='animal-eye-'+e.side;
    eye.position.set(...e.center).sub(new THREE.Vector3(...rest));
    // Head metadata is in unposed model coordinates; NEVER worldToLocal using
    // a currently animated head, which would cancel the pose on attachment.
    const outward=new THREE.Vector3(species==='tiger'?0.72:0.45,0.06,e.side<0?-0.90:0.90).normalize();
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),outward);
    eye.scale.set(e.radius[0]*0.94,e.radius[1]*0.83,Math.max(...e.radius)*0.68);
    eye.userData.restCenter=[...e.center];eye.userData.headLocalOffset=eye.position.toArray();
    root.add(eye);
    add(eye,cap(1,0,1.05),sclera,'sclera');
    add(eye,cap(1.006,0,0.87),iris,'iris');
    const dark=add(eye,cap(1.013,0,0.45),pupil,'pupil');
    // Deer have a horizontal pupil; tiger/bear/panda a round one.
    if(['stag','doe','fawn'].includes(species))dark.scale.set(1.12,0.48,1);
    const lg=lidGeometry();wipeLid(lg,0);const eyelid=add(eye,lg,lid,'blinking-lid');
    records.push({eye,eyelid,closure:0});
  }
  let disposed=false, closure=0;
  return {constraints,root,
    update(time,visible,wet,night){
      if(disposed)return;root.visible=!!visible;closure=blinkAt(time,seed);
      for(const r of records){if(Math.abs(r.closure-closure)>1e-5){wipeLid(r.eyelid.geometry,closure);r.closure=closure;}}
      // No emissive night-eye shortcut: reflections still need scene lighting.
      sclera.roughness=iris.roughness=pupil.roughness=0.05-THREE.MathUtils.clamp(wet||0,0,1)*0.018;
    },
    snapshot(){return {count:records.length,visible:root.visible,closure,seed,drawCallsUpperBound:root.visible?records.length*4:0,catchlight:'physical-clearcoat-lighting',offsets:records.map(r=>r.eye.userData.headLocalOffset),constraints:[...constraints]};},
    dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();},
  };
}
