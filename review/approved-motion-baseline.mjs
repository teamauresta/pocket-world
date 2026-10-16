import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,chromiumSandbox:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:760}});page.setDefaultTimeout(180000);
 await page.goto((process.env.POCKET_WORLD_PREVIEW_ORIGIN || 'http://127.0.0.1:30893') + '/?test=1');await page.waitForFunction(()=>window.__isle?.ready);
 const samples=await page.evaluate(async()=>{
  const i=window.__isle,meshes=i.scene.getObjectByName('fauna').children.filter(m=>m.isSkinnedMesh),vec=i.camera.position.clone();
  const tracked=meshes.map((m,idx)=>{const p=m.geometry.attributes.position,ind=m.geometry.attributes.skinIndex,w=m.geometry.attributes.skinWeight;const feet=['wristL','wristR','hockL','hockR'].map(name=>{const b=m.skeleton.bones.findIndex(b=>b.name===name);const eligible=[];for(let k=0;k<p.count;k++){let weight=0;for(let c=0;c<4;c++)if(ind.getComponent(k,c)===b)weight+=w.getComponent(k,c);if(weight>.55)eligible.push({k,y:p.getY(k)});}eligible.sort((a,b)=>a.y-b.y);return {name,vertices:eligible.slice(0,Math.min(12,Math.ceil(eligible.length*.08))).map(x=>x.k)};});return {m,idx,feet};});
  const out=[];
  for(let frame=0;frame<100;frame++){
   await new Promise(requestAnimationFrame);
   for(const {m,idx,feet} of tracked){m.updateWorldMatrix(true,true);m.skeleton.update();const fp=feet.map(f=>{const sum=vec.clone().set(0,0,0);for(const v of f.vertices){const p=vec.clone().fromBufferAttribute(m.geometry.attributes.position,v);m.applyBoneTransform(v,p);sum.add(p.applyMatrix4(m.matrixWorld));}if(f.vertices.length)sum.multiplyScalar(1/f.vertices.length);return {name:f.name,vertices:f.vertices.length,pos:sum.toArray(),ground:i.hf.heightAt(sum.x,sum.z)};});out.push({frame,idx,label:m.userData.label,time:i.U.uTime.value,body:m.position.toArray(),feet:fp});}
  }
  return out;
 });
 const nearGround=[];let previous=new Map();for(const s of samples){const p=previous.get(s.idx);if(p){const body=Math.hypot(...s.body.map((v,k)=>v-p.body[k]));if(body>.005)for(let k=0;k<s.feet.length;k++){const f=s.feet[k],old=p.feet[k],height=f.pos[1]-f.ground;if(f.vertices&&height>-.25&&height<.18)nearGround.push({species:s.label,bodyMovement:body,footMovement:Math.hypot(...f.pos.map((v,j)=>v-old.pos[j])),height});}}previous.set(s.idx,s);}
 const median=a=>{a.sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};const report={baselineCommit:'79d5e28',sourceURL:(process.env.POCKET_WORLD_PREVIEW_ORIGIN || 'http://127.0.0.1:30893') + '/',rendering:'Software WebGL',samples,summary:{frames:100,meshSamples:samples.length,nearGroundMovingFootPairs:nearGround.length,medianFootWorldDisplacement:median(nearGround.map(x=>x.footMovement)),medianBodyWorldDisplacement:median(nearGround.map(x=>x.bodyMovement))},limitations:'Independent actual skinned-vertex centroid measurement. Near-ground proxy is not a declared stance phase; body movement and centroid vertex selection can include toe roll, changing contact geometry and slopes. Do not claim universal slide-free feet from this baseline.'};
 await fs.mkdir('review/approved-motion-baseline',{recursive:true});await fs.writeFile('review/approved-motion-baseline/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
} finally {await browser.close();}
