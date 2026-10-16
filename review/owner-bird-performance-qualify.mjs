import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out='review/owner-bird-performance', browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,chromiumSandbox:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const errors=[],report={scope:'Exact real-GLB CPU guard qualification; software browser, not native FPS',checks:[]};
try {
 const p=await browser.newPage({viewport:{width:1000,height:750}});p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:4190/'+out+'/proof.html');await p.waitForFunction(()=>window.proof);
 report.guard=await p.evaluate(async()=>{
 const {THREE,loadImportedAsset,createBirdBoundsGuard}=proof,asset=await loadImportedAsset({url:'/public/owner-models/bird.glb'}),a=asset.instantiate({size:1,align:'center',referenceClip:'Take 001'});
 a.play('Take 001',{fade:0});const guard=createBirdBoundsGuard(),inv=new THREE.Matrix4(),box=new THREE.Box3(),v=new THREE.Vector3(),ref=new THREE.Box3();let worst=0,contained=true,count=0;
 function reference(){ref.makeEmpty();a.model.traverse(o=>{if(o.isMesh)for(let j=0;j<o.geometry.attributes.position.count;j++){o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);ref.expandByPoint(v);}});return ref;}
 const duration=asset.clips[0].duration;
 for(let n=0;n<1200;n++){
 a.mixer.setTime(duration*(n*.61803398875%1));a.root.position.set(Math.sin(n)*25,5+Math.cos(n)*5,Math.cos(n)*20);a.root.rotation.set(Math.sin(n)*.4,n*.13,Math.cos(n)*.4);a.root.scale.set(1+(n%3)*.2,.7+(n%7)*.1,.6+(n%5)*.2);a.root.updateMatrixWorld(true);
 inv.copy(a.root.matrixWorld).invert();const fast=guard(a.model,inv,box),slow=reference();contained&&=!!fast&&fast.containsBox(slow);
 if(fast)for(const key of ['min','max'])for(const axis of ['x','y','z'])worst=Math.max(worst,Math.abs(fast[key][axis]-slow[key][axis]));count++;
 }
 const times=[];for(const mode of ['reference','cached','cached','reference']){const start=performance.now();for(let n=0;n<500;n++){a.mixer.setTime(duration*(n*.61803398875%1));a.root.updateMatrixWorld(true);if(mode==='reference')reference();else guard(a.model,inv,box);}times.push({mode,calls:500,ms:performance.now()-start});}
 let mesh;a.model.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});const original=mesh.geometry;mesh.geometry=original.clone();const positions=mesh.geometry.attributes.position,old=positions.getX(0);positions.setX(0,old+100);a.root.updateMatrixWorld(true);const changed=guard(a.model,inv,box),changedRef=reference();const mutationRead=changed.containsBox(changedRef);
 positions.setX(0,NaN);const invalidFailsClosed=guard(a.model,inv,box)===null;mesh.geometry.dispose();mesh.geometry=original;a.dispose();asset.dispose();return {poses:count,contained,worstBoundsDelta:worst,times,mutationRead,invalidFailsClosed};
 });
 report.checks.push({name:'1200 real flight poses, translated/rotated/nonuniform-scaled: full reference bounds contained',ok:report.guard.contained&&report.guard.worstBoundsDelta<1.1e-9});report.checks.push({name:'live geometry mutation read; nonfinite skin fails closed',ok:report.guard.mutationRead&&report.guard.invalidFailsClosed});
 await p.close();
 report.cpu=[];
 for(const [name,url] of [['before',(process.env.POCKET_WORLD_PREVIEW_ORIGIN || 'http://127.0.0.1:30893') + '/models/?test=1'],['candidate','http://127.0.0.1:4190/'+out+'/candidate/?test=1'],['candidate','http://127.0.0.1:4190/'+out+'/candidate/?test=1'],['before',(process.env.POCKET_WORLD_PREVIEW_ORIGIN || 'http://127.0.0.1:30893') + '/models/?test=1']]){
 const page=await browser.newPage({viewport:{width:1000,height:750}});await page.goto(url);await page.waitForFunction(()=>window.__isle?.ready&&window.__isle.ownerModelState.status==='ready',null,{timeout:240000});
 const r=await page.evaluate(()=>{const I=__isle;I.pause();I.resetBehavior();I.setWeather('clear',true);for(let i=0;i<15;i++)I.advanceFrame(.1,{render:false});let birdMs=0,birdCalls=0;const old=I.ownerBirds.afterRender;I.ownerBirds.afterRender=function(...a){const t=performance.now();try{return old.apply(this,a);}finally{birdMs+=performance.now()-t;birdCalls++;}};const t=performance.now();for(let i=0;i<120;i++)I.advanceFrame(.1,{render:false});I.ownerBirds.afterRender=old;return {frames:120,elapsedMs:performance.now()-t,birdMs,birdCalls,faults:I.ownerBirds.snapshot().filter(e=>e.fault),models:I.ownerModelState};});report.cpu.push({name,...r});await page.close();
 }
 report.checks.push({name:'full compiled world before/candidate CPU runs: five birds fault-free',ok:report.cpu.every(r=>r.faults.length===0&&r.models.parts.birds.count===5)});
 report.errors=errors;report.status=report.checks.every(c=>c.ok)&&!errors.length?'PASS':'FAIL';
}finally{await browser.close();await fs.writeFile(out+'/guard-and-cpu.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(report.status!=='PASS')process.exitCode=1;
