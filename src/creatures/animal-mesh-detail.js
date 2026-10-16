// Animal-only mesh processing: no changes to shared sea-creature sculpting.
import * as THREE from 'three';

// Two Taubin iterations, each a positive Laplacian followed by its negative
// inflation step. Only positions change; semantic attributes are sampled later.
export function taubinSmooth(geo, iterations = 2) {
  const p = geo.attributes.position.array, adj = Array.from({length:p.length/3},()=>new Set());
  const ix = geo.index.array;
  for(let i=0;i<ix.length;i+=3) for(let j=0;j<3;j++) {
    const a=ix[i+j],b=ix[i+(j+1)%3];adj[a].add(b);adj[b].add(a);
  }
  const next=new Float32Array(p.length);
  for(let k=0;k<iterations;k++) for(const factor of [.5,-.53]) {
    for(let v=0;v<adj.length;v++) for(let axis=0;axis<3;axis++) {
      let avg=0;for(const n of adj[v])avg+=p[n*3+axis];
      next[v*3+axis]=adj[v].size ? p[v*3+axis]+factor*(avg/adj[v].size-p[v*3+axis]) : p[v*3+axis];
    }
    p.set(next);
  }
  geo.attributes.position.needsUpdate=true;
  return geo;
}

// Garland/Heckbert plane quadrics with edge-constrained minimisation, link
// condition and face-flip guards. Not Three's curvature-only SimplifyModifier.
// Run BEFORE painting/skinning: final semantic/rest/skin attributes are resampled
// on the retained surface, so no float interpolation ever corrupts bone/part ids.
export function quadricSimplify(geo, targetTriangles, {protect=()=>false}={}) {
  const src=geo.attributes.position.array, ids=geo.index.array;
  const verts=Array.from({length:src.length/3},(_,i)=>({p:Array.from(src.slice(i*3,i*3+3)),q:new Float64Array(10),faces:new Set(),alive:true,version:0}));
  const faces=[];
  const normal=(a,b,c)=>{const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  for(let i=0;i<ids.length;i+=3){
    const f=[ids[i],ids[i+1],ids[i+2]], fi=faces.length;faces.push(f);
    const n=normal(...f.map(v=>verts[v].p)),len=Math.hypot(...n);if(len<1e-12)continue;
    const a=n[0]/len,b=n[1]/len,c=n[2]/len,d=-dot([a,b,c],verts[f[0]].p);
    const q=[a*a,a*b,a*c,a*d,b*b,b*c,b*d,c*c,c*d,d*d];
    for(const v of f){verts[v].faces.add(fi);for(let k=0;k<10;k++)verts[v].q[k]+=q[k];}
  }
  let count=faces.length;
  const heap=[];
  function push(e){let i=heap.length;heap.push(e);while(i){const p=(i-1)>>1;if(heap[p].cost<=e.cost)break;heap[i]=heap[p];i=p;}heap[i]=e;}
  function pop(){const out=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=end.cost)break;heap[i]=heap[c];i=c;}heap[i]=end;}return out;}
  const evaluate=(q,p)=>q[0]*p[0]*p[0]+2*q[1]*p[0]*p[1]+2*q[2]*p[0]*p[2]+2*q[3]*p[0]+q[4]*p[1]*p[1]+2*q[5]*p[1]*p[2]+2*q[6]*p[1]+q[7]*p[2]*p[2]+2*q[8]*p[2]+q[9];
  function enqueue(ai,bi){
    if(ai===bi)return;const a=verts[ai],b=verts[bi];if(!a.alive||!b.alive)return;
    if(protect(a.p)||protect(b.p))return;
    const q=a.q.map((v,i)=>v+b.q[i]);
    // Exact minimum of the quadric restricted to this mesh edge (convex).
    const mid=a.p.map((x,i)=>(x+b.p[i])/2),e0=evaluate(q,a.p),e1=evaluate(q,b.p),em=evaluate(q,mid);
    const A=2*(e1+e0-2*em),B=e1-e0-A,t=A>1e-14?Math.max(0,Math.min(1,-B/(2*A))):e0<e1?0:1;
    const p=a.p.map((x,i)=>x+(b.p[i]-x)*t);
    push({a:ai,b:bi,va:a.version,vb:b.version,p,cost:Math.max(0,evaluate(q,p))});
  }
  const edges=new Set();for(const f of faces)for(let i=0;i<3;i++){const a=Math.min(f[i],f[(i+1)%3]),b=Math.max(f[i],f[(i+1)%3]),k=a+':'+b;if(!edges.has(k)){edges.add(k);enqueue(a,b);}}
  while(count>targetTriangles&&heap.length){
    const e=pop(),a=verts[e.a],b=verts[e.b];if(!a.alive||!b.alive||e.va!==a.version||e.vb!==b.version)continue;
    const shared=[...a.faces].filter(f=>b.faces.has(f)&&faces[f]);if(shared.length!==2)continue;
    // A 2-face interior edge may still join two boundary vertices. Collapsing
    // that edge pinches/shortens a remaining open loop despite the link test.
    const onBoundary=v=>{const counts=new Map();for(const fi of v.faces)for(const n of faces[fi]||[])if(verts[n]!==v)counts.set(n,(counts.get(n)||0)+1);return [...counts.values()].some(n=>n===1);};
    if(onBoundary(a)||onBoundary(b))continue;
    const na=new Set(),nb=new Set();for(const fi of a.faces)for(const v of faces[fi]||[])if(v!==e.a)na.add(v);for(const fi of b.faces)for(const v of faces[fi]||[])if(v!==e.b)nb.add(v);
    if([...na].filter(v=>nb.has(v)).length!==2)continue;
    const affected=new Set([...a.faces,...b.faces]);let safe=true;
    for(const fi of affected){const f=faces[fi];if(!f||shared.includes(fi))continue;const old=normal(...f.map(v=>verts[v].p)),now=normal(...f.map(v=>v===e.a||v===e.b?e.p:verts[v].p));if(dot(old,now)<=.15*Math.hypot(...old)*Math.hypot(...now)||Math.hypot(...now)<1e-10){safe=false;break;}}
    if(!safe)continue;
    a.p=e.p;for(let i=0;i<10;i++)a.q[i]+=b.q[i];a.version++;b.alive=false;b.version++;
    for(const fi of affected){const f=faces[fi];if(!f)continue;for(const v of f)verts[v].faces.delete(fi);if(shared.includes(fi)){faces[fi]=null;count--;continue;}faces[fi]=f.map(v=>v===e.b?e.a:v);for(const v of faces[fi])verts[v].faces.add(fi);}
    const neighbors=new Set();for(const fi of a.faces)for(const v of faces[fi])if(v!==e.a)neighbors.add(v);for(const v of neighbors)enqueue(e.a,v);
  }
  const map=new Map(),positions=[],indices=[];
  for(const f of faces)if(f)for(const v of f){if(!map.has(v)){map.set(v,positions.length/3);positions.push(...verts[v].p);}indices.push(map.get(v));}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));out.setIndex(indices);
  out.userData.simplification={method:'edge-constrained-plane-quadric',inputTriangles:ids.length/3,outputTriangles:indices.length/3,targetTriangles};
  return out;
}

// Surface nets can place two disjoint sheets in one cell, making a four-face
// edge at small toe/nostril gaps. Split disconnected triangle fans at each
// vertex; this changes connectivity only, never closes a deliberate opening.
export function splitSurfaceFans(geo) {
  const p=geo.attributes.position.array,ix=geo.index.array,faces=[];
  const incident=Array.from({length:p.length/3},()=>[]),edges=new Map();
  for(let i=0;i<ix.length;i+=3){const f=[ix[i],ix[i+1],ix[i+2]],fi=faces.length;faces.push(f);for(const v of f)incident[v].push(fi);for(let j=0;j<3;j++){const a=f[j],b=f[(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(fi);}}
  const original=faces.map(f=>[...f]);
  const pos=Array.from(p);let splits=0;
  for(let v=0;v<incident.length;v++){
    const remaining=new Set(incident[v]);let first=true;
    while(remaining.size){const seed=remaining.values().next().value,stack=[seed],fan=[];remaining.delete(seed);
      while(stack.length){const fi=stack.pop();fan.push(fi);for(const u of original[fi])if(u!==v){const es=edges.get(Math.min(u,v)+':'+Math.max(u,v));if(es?.length!==2)continue;for(const next of es)if(remaining.delete(next))stack.push(next);}}
      if(first){first=false;continue;}
      const nv=pos.length/3;pos.push(p[v*3],p[v*3+1],p[v*3+2]);splits++;
      for(const fi of fan){const f=faces[fi];f[f.indexOf(v)]=nv;}
    }
  }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(faces.flat());
  // Polygonizer attributes no longer match split vertex count and are rebuilt
  // after smoothing/decimation, so do not carry stale arrays through the pipeline.
  for(const name of Object.keys(geo.attributes))if(name!=='position')geo.deleteAttribute(name);
  geo.userData.surfaceFanSplits=splits;return geo;
}

// Thin subtractive walls can fool the polygonizer's per-face gradient test.
// Recover coherent winding from adjacency, keeping each sheet's majority sign.
export function orientSurfaceSheets(geo) {
  const ix=Array.from(geo.index.array),edges=new Map(),adj=Array.from({length:ix.length/3},()=>[]);
  for(let f=0;f<adj.length;f++)for(let j=0;j<3;j++){
    const a=ix[f*3+j],b=ix[f*3+(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
    if(!edges.has(key))edges.set(key,[]);edges.get(key).push({f,a,b});
  }
  for(const e of edges.values())if(e.length===2){const [a,b]=e,flip=a.a===b.a?1:0;adj[a.f].push([b.f,flip]);adj[b.f].push([a.f,flip]);}
  const parity=new Int8Array(adj.length).fill(-1);let flipped=0,conflicts=0;
  for(let seed=0;seed<adj.length;seed++)if(parity[seed]<0){
    const stack=[seed],sheet=[];parity[seed]=0;
    while(stack.length){const f=stack.pop();sheet.push(f);for(const [next,flip]of adj[f]){const want=parity[f]^flip;if(parity[next]<0){parity[next]=want;stack.push(next);}else if(parity[next]!==want)conflicts++;}}
    const invert=sheet.reduce((sum,f)=>sum+parity[f],0)>sheet.length/2?1:0;
    for(const f of sheet)if(parity[f]^invert){[ix[f*3+1],ix[f*3+2]]=[ix[f*3+2],ix[f*3+1]];flipped++;}
  }
  geo.setIndex(ix);geo.userData.surfaceOrientation={flippedTriangles:flipped,conflicts};return geo;
}

// Repair only small simple split-fan boundaries, not the opening of a cavity
// (a closed SDF cavity has a floor). New centres must lie inside the source SDF
// within a fraction of a cell. Existing eye/sole vertices are never moved.
// Unsupported loops remain in the receipt; this is not global watertightness.
export function closeSmallSurfaceLoops(geo,{field,cell,accept=()=>true}={}) {
  const p=Array.from(geo.attributes.position.array),ix=Array.from(geo.index.array),edges=new Map();
  const point=v=>p.slice(v*3,v*3+3),distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
  for(let i=0;i<ix.length;i+=3)for(let j=0;j<3;j++){
    const a=ix[i+j],b=ix[i+(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
    if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);
  }
  const boundary=[...edges.values()].filter(e=>e.length===1).map(e=>e[0]),adj=new Map();
  for(const [a,b]of boundary){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
  const remaining=new Set(adj.keys()),receipt={boundaryEdgesBefore:boundary.length,closedLoops:[],skippedLoops:[]};
  while(remaining.size){
    const seed=remaining.values().next().value,stack=[seed],component=[];remaining.delete(seed);
    while(stack.length){const v=stack.pop();component.push(v);for(const n of adj.get(v))if(remaining.delete(n))stack.push(n);}
    const center=[0,1,2].map(a=>component.reduce((s,v)=>s+p[v*3+a],0)/component.length);
    const radius=Math.max(...component.map(v=>distance(point(v),center)));
    const skip=reason=>receipt.skippedLoops.push({edges:component.length,center,radius,reason});
    if(component.length<3||component.length>12||component.some(v=>adj.get(v).length!==2)||radius>cell*1.25||!accept(center)){skip('outside bounded simple repair');continue;}
    const loop=[seed];let previous=-1,current=seed;
    do{const next=adj.get(current).find(v=>v!==previous);previous=current;current=next;if(current!==seed)loop.push(current);}while(current!==seed&&loop.length<=component.length);
    if(loop.length!==component.length){skip('non-simple boundary');continue;}
    let inset=null,best=Infinity;
    for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++)for(let z=-3;z<=3;z++){
      const q=center.map((v,i)=>v+[x,y,z][i]*cell*.12),sdf=field(...q),dist=distance(q,center);
      if(sdf<=-cell*.025&&dist<best){inset=q;best=dist;}
    }
    if(!inset){skip('no nearby source-field interior');continue;}
    const n=p.length/3,triangles=[];let valid=true;
    for(let j=0;j<loop.length;j++){
      const a=loop[j],b=loop[(j+1)%loop.length],e=edges.get(Math.min(a,b)+':'+Math.max(a,b))[0];
      const va=new THREE.Vector3(...point(e[0])),vb=new THREE.Vector3(...point(e[1])),vc=new THREE.Vector3(...inset);
      if(vb.sub(va).cross(vc.sub(va)).length()<1e-10){valid=false;break;}
      triangles.push(e[1],e[0],n);
    }
    if(loop.some((a,j)=>{const b=loop[(j+1)%loop.length],c=loop[(j+2)%loop.length];const e=edges.get(Math.min(a,b)+':'+Math.max(a,b))[0],f=edges.get(Math.min(b,c)+':'+Math.max(b,c))[0];return (e[0]===a)!==(f[0]===b);})){valid=false;}
    if(!valid){skip('degenerate or inconsistent boundary');continue;}
    p.push(...inset);ix.push(...triangles);receipt.closedLoops.push({edges:loop.length,center,inset,radius,sourceDistance:field(...inset)});
  }
  receipt.boundaryEdgesAfter=boundary.length-receipt.closedLoops.reduce((sum,l)=>sum+l.edges,0);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.userData.seamRepair=receipt;return geo;
}
