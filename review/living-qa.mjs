#!/usr/bin/env node
// Independent observable-geometry gates. No source imports, installs, server or source edits.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const args=process.argv.slice(2), option=(key,fallback)=>{const n=args.indexOf(key);return n<0?fallback:args[n+1];};
if(args.includes('--help')){console.log('node review/living-qa.mjs --url http://127.0.0.1:4174/?test=1&lite=1 --out review/living-final-evidence [--only desktop|portrait]');process.exit(0);}
if(option('--only')&&!['desktop','portrait'].includes(option('--only')))throw Error('--only must be desktop or portrait');
const url=new URL(option('--url','http://127.0.0.1:4174/?test=1&lite=1')).href;
const out=path.resolve(option('--out','review/living-final-evidence'));
const review=path.resolve(path.dirname(new URL(import.meta.url).pathname));
if(path.dirname(out)!==review||!/^living-.*evidence$/.test(path.basename(out)))throw Error('Output must be review/living-*evidence; use a fresh directory.');
await fs.mkdir(out,{recursive:true});
const report={started:new Date().toISOString(),url,rendering:'Sandboxed Chromium SwiftShader software WebGL. No hardware FPS or native-phone claim.',checks:[],captures:[],errors:[],limits:['Paw patches are bottom-cap bind-space vertices with real skin weights, not ideal IK targets. Bone-sole and skin metrics are separate.','Sea geometry reconstructs current vertex shaders on CPU; GPU raster/frame captures supplement, not a hardware transform-feedback proof.','Full 68-check weather regression is a separate parent-owned run.','No automatic visual-quality verdict from screenshot existence.']};
function check(name,ok,detail={}){report.checks.push({name,pass:!!ok,detail});console.log(ok?'PASS':'FAIL',name);}
const artifact=async(name,value)=>fs.writeFile(path.join(out,name),JSON.stringify(value,null,2));
let browser;
// Serialized into the actual app page. Vector/Matrix classes come from live objects,
// not another Three.js copy or the implementation's target/sole helper.
function installProbe(){
 const I=window.__isle,V=I.camera.position.constructor,M=I.camera.matrixWorld.constructor;
 const need=(yes,s)=>{if(!yes)throw Error('Missing required QA contract: '+s);};
 for(const name of ['advance','resetBehavior','behaviorState','setTime','pause','resume','setPlaying','setWeather','triggerStrike','capture'])need(typeof I[name]==='function',name);
 need(I.fauna?.agents?.length&&I.birds?.flocks?.length&&I.life?.big?.length&&I.hf?.heightAt,'live fauna/birds/life/hf');
 const state=I.behaviorState();need(state.land&&state.birds&&state.sea,'all three non-null snapshots');
 const defs={tiger:{F:[.08,-.01,.15,.12],H:[.1,-.005,.14,.11]},stag:{F:[.02,0,.05,.045],H:[.03,0,.05,.045]},doe:{F:[.02,0,.05,.045],H:[.03,0,.05,.045]},fawn:{F:[.02,0,.05,.045],H:[.03,0,.05,.045]},bear:{F:[.08,-.01,.18,.15],H:[.1,-.01,.19,.14]},panda:{F:[.06,-.01,.15,.13],H:[.08,-.005,.15,.12]}};
 const feet=new Map();
 for(const a of I.fauna.agents){
  const mesh=a.mesh,g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  need(mesh.isSkinnedMesh&&si&&sw&&typeof mesh.applyBoneTransform==='function','SkinnedMesh weights/applyBoneTransform');
  const entries=[];
  for(const boneName of ['wristL','wristR','hockL','hockR']){
   const bi=mesh.skeleton.bones.findIndex(b=>b.name===boneName);need(bi>=0,boneName);
   const bind=new V().setFromMatrixPosition(mesh.skeleton.boneInverses[bi].clone().invert());
   const d=defs[a.r.key][boneName.startsWith('wrist')?'F':'H'];
   const sole=new V(bind.x+d[0],d[1],bind.z),offset=sole.clone().sub(bind),candidates=[];
   for(let k=0;k<p.count;k++){
    const dx=(p.getX(k)-sole.x)/d[2],dz=(p.getZ(k)-sole.z)/d[3];
    if(dx*dx+dz*dz>.55||p.getY(k)>sole.y+.09||p.getY(k)<sole.y-.15)continue;
    let weight=0,sum=0;for(let c=0;c<4;c++){const w=sw.array[k*4+c];sum+=w;if(si.array[k*4+c]===bi)weight+=w;}
    candidates.push({index:k,y:p.getY(k),weight,sum});
   }
   candidates.sort((a,b)=>a.y-b.y);
   // Fixed bind-space patch. Do not reselect the lowest vertex each frame.
   const patch=candidates.filter(v=>v.y<=candidates[0]?.y+.022).slice(0,24);
   need(patch.length>=2,a.r.key+' '+boneName+' actual sole patch >=2 vertices');
   need(patch.every(p=>Math.abs(p.sum-1)<1e-4&&p.weight>.1),a.r.key+' '+boneName+' normalized weights and meaningful paw influence');
   entries.push({boneName,bi,offset,sole,patch});
  }
  feet.set(a,entries);
 }
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const records=()=>I.scene.children.filter(o=>Array.isArray(o.userData?.perches)).flatMap(o=>o.userData.perches);
 function land(){
  I.scene.updateMatrixWorld(true);
  return I.fauna.agents.map(a=>{
   a.mesh.skeleton.update();const contacts=a.motion?.snapshot?.()??I.fauna.snapshot().agents.find(s=>s.id===a.id)?.contacts;
   need(Array.isArray(contacts),'land contacts array');
   return {id:a.id,species:a.r.key,state:a.state,reason:a.reason,position:a.mesh.position.toArray(),heading:a.heading,speed:a.speed,scale:a.mesh.scale.x,slope:1-I.hf.normalAt(a.pos.x,a.pos.y)[1],ground:I.hf.heightAt(a.pos.x,a.pos.y),blocked:a.blocked,escape:a.escape?{...a.escape}:null,
    shelter:a.shelter?{p:a.shelter.p.toArray(),tree:a.shelter.tree}:null,
    feet:feet.get(a).map(f=>{
     const bone=a.mesh.skeleton.bones[f.bi],sole=f.offset.clone().applyMatrix4(bone.matrixWorld),contact=contacts.find(c=>c.bone===f.boneName);need(contact,'contact '+f.boneName);
     const points=f.patch.map(k=>a.mesh.applyBoneTransform(k.index,new V().fromBufferAttribute(a.mesh.geometry.attributes.position,k.index)).applyMatrix4(a.mesh.matrixWorld));
     const centroid=points.reduce((s,p)=>s.add(p),new V()).multiplyScalar(1/points.length);
     return {bone:f.boneName,mode:contact.mode,lock:contact.target,sole:sole.toArray(),groundError:sole.y-I.hf.heightAt(sole.x,sole.z),skin:centroid.toArray(),skinPoints:points.map(p=>p.toArray()),skinGround:points.map(p=>p.y-I.hf.heightAt(p.x,p.z)),lockError:contact.target?dist(sole.toArray(),contact.target):null};
    })};
  });
 }
 // Independent tree-tip derivation from retained branch geometry + instance matrices.
 const branchTips=[];for(const group of I.scene.children.filter(o=>Array.isArray(o.userData?.perches)))for(const mesh of group.children){
  if(!mesh.isInstancedMesh||mesh.material?.alphaTest>0)continue;
  const p=mesh.geometry.attributes.position;let highest=0;for(let k=1;k<p.count;k++)if(p.getY(k)>p.getY(highest))highest=k;
  for(let k=0;k<mesh.count;k++){const m=new M();mesh.getMatrixAt(k,m);branchTips.push(new V().fromBufferAttribute(p,highest).applyMatrix4(m).applyMatrix4(group.matrixWorld));}
 }
 function birds(){
  I.birds.group.updateWorldMatrix(true,true);return I.birds.flocks.flatMap(f=>f.agents.map((a,k)=>{
   const mat=new M();f.mesh.getMatrixAt(k,mat);mat.premultiply(f.mesh.matrixWorld);
   const g=f.mesh.geometry,p=g.attributes.position,fold=g.attributes.aFold?.getX(k),flap=g.attributes.aFlap.getY(k),beat=Math.sin(I.U.uTime.value*g.attributes.aFlap.getZ(k)+g.attributes.aFlap.getX(k));
   // Fold is reconstructed on actual wing vertices, separately from the mode flag.
   let rawWidth=0,foldWidth=0;for(let j=0;j<p.count;j++){const span=Math.abs(g.attributes.aSpan.getX(j));if(span<.7)continue;rawWidth=Math.max(rawWidth,Math.abs(p.getZ(j)));const u=Math.max(0,Math.min(1,span/.35)),amount=fold*u*u*(3-2*u);foldWidth=Math.max(foldWidth,Math.abs(p.getZ(j)*(1-Math.abs(beat)*flap*.12*span)*Math.cos(amount*1.35)));}
   const center=new V().setFromMatrixPosition(mat),perch=a.perch,treeRecord=perch?records().find(p=>Math.hypot(p.x-perch.x,p.y-perch.y,p.z-perch.z)<1e-5):null;
   const tipError=perch&&branchTips.length?Math.min(...branchTips.map(p=>Math.hypot(p.x-perch.x,p.y-perch.y,p.z-perch.z))):null;
   g.computeBoundingBox();const base=new V(0,g.boundingBox.min.y,0).applyMatrix4(mat);
   return {species:f.key,index:k,position:center.toArray(),matrix:mat.toArray(),fold,flap,mode:a.mode,wingWidthRatio:foldWidth/rawWidth,perch:perch?{x:perch.x,y:perch.y,z:perch.z,instBase:perch.instBase}:null,treeRecord:!!treeRecord,tipError,perchHeightError:perch?base.y-perch.y:null,perchHorizontalError:perch?Math.hypot(center.x-perch.x,center.z-perch.z):null};
  }));
 }

 function sea(){
  I.life.group.updateWorldMatrix(true,true);
  const time=I.U.uTime.value,all=[...I.life.species.map(e=>({e,key:e.key,kind:'fish',amp:e.L*.07,freq:e.key==='silver'?11:7,waves:.8})),{e:I.life.sharks,key:'shark',kind:'fish',amp:.32,freq:3.2,waves:.75},{e:I.life.mantas,key:'manta',kind:'manta',amp:.75,freq:1.5,waves:1},{e:I.life.turtles,key:'turtle',kind:'turtle',amp:1,freq:1.9,waves:1}];
  return all.flatMap(({e,key,kind,amp,freq,waves})=>e.agents.map((a,k)=>{
   const g=e.mesh.geometry,p=g.attributes.position,swim=g.attributes.aSwim,mat=new M();e.mesh.getMatrixAt(k,mat);mat.premultiply(e.mesh.matrixWorld);
   const t=time*freq*swim.getY(k),phase=swim.getX(k);let ground=Infinity,edge=Infinity,top=-Infinity,head=-Infinity,minY=Infinity;const v=new V();
   // All vertices for large swimmers; bounded regular subsample for small schools.
   const stride=kind==='fish'&&key!=='shark'?Math.max(1,Math.floor(p.count/72)):1;
   for(let j=0;j<p.count;j+=stride){v.fromBufferAttribute(p,j);const headVertex=kind==='turtle'&&v.x>1.7&&Math.abs(v.z)<.2;
    if(kind==='fish'){const s=g.attributes.aBody.getX(j);v.z+=Math.sin(s*waves*6.2832-t+phase)*amp*(.12+s*s*1.2);}
    else if(kind==='manta'){const s=g.attributes.aSpan.getX(j),w=Math.pow(s,1.35),beat=Math.sin(t+phase-s*1.9);v.y+=beat*amp*w;v.x-=Math.abs(beat)*.12*w;}
    else {const flip=g.attributes.aFlip.getX(j),w=Math.abs(flip);if(w>.001){const sg=Math.sign(flip),ang=(Math.sin(t+phase)*.7+.15)*w*sg,c=Math.cos(ang),s=Math.sin(ang),x=v.x-.6,y=v.y+.05,z=v.z-sg*.95,yy=y*c-z*s,zz=y*s+z*c,sw=Math.cos(t+phase)*.35*w;v.set(.6+x*Math.cos(sw)-zz*Math.sin(sw)*sg,-.05+yy,sg*.95+x*Math.sin(sw)*sg+zz*Math.cos(sw));}}
    v.applyMatrix4(mat);ground=Math.min(ground,v.y-I.hf.heightAt(v.x,v.z));edge=Math.min(edge,50-Math.abs(v.x),50-Math.abs(v.z));top=Math.max(top,v.y);minY=Math.min(minY,v.y);if(headVertex)head=Math.max(head,v.y);
   }
   const center=new V().setFromMatrixPosition(mat),floor=I.hf.heightAt(center.x,center.z);
   return {key,index:k,position:center.toArray(),ground,edge,top,minY,head:Number.isFinite(head)?head:null,depthFraction:(center.y-floor)/(0-floor),breathMode:a.breathMode??null,reason:a.reason??null,vertices:p.count,stride};
  }));
 }
 function freeze(){const rainTime=I.rain.drops.material.uniforms.uTime.value,seed=I.rain.drops.geometry.attributes.aSeed,wind=I.U.uWind.value,strength=I.U.uWindStrength.value;const drops=[];for(let k=0;k<12;k++){const fall=(rainTime*38+seed.getZ(k)*75)%75;drops.push([((seed.getX(k)*100+wind.x*strength*.35*fall)%100+100)%100-50,45-fall,((seed.getY(k)*100+wind.y*strength*.35*fall)%100+100)%100-50]);}return {dropWorldCenters:drops,land:land().map(a=>({id:a.id,p:a.position,feet:a.feet.map(f=>f.skinPoints),bones:I.fauna.agents.find(x=>x.id===a.id).rig.bones.map(b=>b.matrixWorld.toArray())})),birds:birds(),sea:I.life.big.map(e=>Array.from(e.mesh.instanceMatrix.array)),time:I.U.uTime.value,particles:I.rain.materials.map(m=>({t:m.uniforms?.uTime?.value,wind:m.uniforms?.uWindStrength?.value})),rainSeeds:Array.from(I.rain.drops.geometry.attributes.aSeed.array.slice(0,36)),rainCount:I.rain.drops.geometry.instanceCount};}
 window.__livingProbe={land,birds,sea,freeze,feet:()=>[...feet].map(([a,f])=>({id:a.id,species:a.r.key,feet:f.map(x=>({bone:x.boneName,sole:x.sole.toArray(),offset:x.offset.toArray(),patch:x.patch}))})),records};
 return {pawPatches:window.__livingProbe.feet(),perches:records().length};
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const max=a=>a.length?a.reduce((m,v)=>Math.max(m,v),-Infinity):null;
const min=a=>a.length?a.reduce((m,v)=>Math.min(m,v),Infinity):null;
const quantile=(a,q)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.floor((b.length-1)*q)];};
async function scenario(page,label,fn){try{return await fn();}catch(e){check(label,false,{error:e.stack});return null;}}
async function snap(page,label,spec={}){
 const receipt=await page.evaluate(async s=>window.__isle.capture({...s,t:window.__isle.state().simTime,frames:2}),spec);
 const file=label+'.png';await page.screenshot({path:path.join(out,file),timeout:180000});const bytes=await fs.readFile(path.join(out,file));report.captures.push({label,file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),receipt});
}
async function reset(page,weather='clear',hour=12){await page.evaluate(({weather,hour})=>{const i=window.__isle;i.pause();i.setWeather(weather,true);i.setTime(hour);i.resetBehavior();}, {weather,hour});}
async function sample(page,seconds,step=.1,includeSea=false){
 const frames=[];for(let start=0;start<seconds-1e-8;start+=2){const chunk=Math.min(2,seconds-start);
  const batch=await page.evaluate(({chunk,step,includeSea,start})=>{const i=window.__isle,p=window.__livingProbe,out=[];for(let t=0;t<chunk-1e-8;t+=step){const dt=Math.min(step,chunk-t);i.advance(dt,{freezeWeather:true,render:false});out.push({t:start+t+dt,...(includeSea?{sea:p.sea()}:{land:p.land(),birds:p.birds()})});}return out;},{chunk,step,includeSea,start});frames.push(...batch);
 }return frames;
}
function footChecks(label,frames){
 const stats={},violations=[],safe=[];
 for(let k=0;k<frames.length;k++)for(const a of frames[k].land){
  const s=stats[a.species]??={stance:0,pairs:0,walking:0,flat:0,slope:0,turns:0,soleGround:[],skinGround:[],soleSlip:[],skinSlip:[],lock:[],speed:[],start:0,stop:0};
  const prev=frames[k-1]?.land.find(p=>p.id===a.id);s.speed.push(a.speed);
  if(Math.abs(a.position[0])>49||Math.abs(a.position[2])>49||a.ground<.8)safe.push({t:frames[k].t,id:a.id,position:a.position,ground:a.ground});
  if(a.speed>.2){s.walking++;if(a.slope<.005)s.flat++;if(a.slope>.015)s.slope++;if(prev&&Math.abs(Math.atan2(Math.sin(a.heading-prev.heading),Math.cos(a.heading-prev.heading)))>.005)s.turns++;}
  if(prev?.speed<=.03&&a.speed>.03)s.start++;if(prev?.speed>.03&&a.speed<=.03)s.stop++;
  for(const f of a.feet)if(f.mode==='stance'){
   s.stance++;s.soleGround.push(Math.abs(f.groundError));s.skinGround.push(...f.skinGround);s.lock.push(f.lockError);
   const old=prev?.feet.find(p=>p.bone===f.bone);
   if(old?.mode==='stance'&&distance(f.lock,old.lock)<1e-6){s.pairs++;s.soleSlip.push(distance(f.sole,old.sole));s.skinSlip.push(max(f.skinPoints.map((p,j)=>distance(p,old.skinPoints[j]))));}
   if(Math.abs(f.groundError)>.07||Math.min(...f.skinGround)<-.08)if(violations.length<30)violations.push({t:frames[k].t,id:a.id,bone:f.bone,ground:f.groundError,skinMin:Math.min(...f.skinGround)});
  }
 }
 const summary={};
 for(const [species,s] of Object.entries(stats)){
  summary[species]={...s,soleGround:{max:max(s.soleGround),p95:quantile(s.soleGround,.95)},skinGround:{min:s.skinGround.length?min(s.skinGround):null,max:max(s.skinGround)},soleSlip:{max:max(s.soleSlip),p95:quantile(s.soleSlip,.95)},skinSlip:{max:max(s.skinSlip),p95:quantile(s.skinSlip,.95)},lock:{max:max(s.lock)},speed:{max:max(s.speed)}};
  check(label+' '+species+' actual stance coverage',s.stance>=20&&s.pairs>=10,{stance:s.stance,pairs:s.pairs,walking:s.walking});
  check(label+' '+species+' independent sole lock',s.pairs>0&&max(s.soleSlip)<.035&&max(s.soleGround)<.07&&max(s.lock)<.07,summary[species]);
  check(label+' '+species+' skinned sole patch',s.pairs>0&&max(s.skinSlip)<.07&&min(s.skinGround)>-.08&&quantile(s.skinGround,.95)<.16,{skinSlip:summary[species].skinSlip,skinGround:summary[species].skinGround});
 }
 check(label+' land ground and glass',safe.length===0,{violations:safe.slice(0,20)});
 return {summary,violations};
}
try{
 browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,chromiumSandbox:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 for(const label of ['desktop','portrait'].filter(x=>!option('--only')||x===option('--only'))){
  const context=await browser.newContext({viewport:label==='desktop'?{width:1100,height:800}:{width:390,height:844},deviceScaleFactor:1,isMobile:label==='portrait',hasTouch:label==='portrait',reducedMotion:'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push({label,type:'page',message:String(e)}));page.on('console',m=>{if(m.type()==='error')report.errors.push({label,type:'console',message:m.text()});});
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(url).origin)report.errors.push({label,type:'asset',status:r.status(),url:r.url()});});
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__isle?.ready&&window.__isle.frames()>1,null,{timeout:240000});
  const contract=await scenario(page,label+' required contracts',()=>page.evaluate(installProbe));
  if(!contract){await context.close();continue;}
  await artifact(label+'-paw-patches.json',contract);check(label+' live contracts',true,{perches:contract.perches});
  const renderer=await page.evaluate(()=>{const gl=window.__isle.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};});check(label+' real WebGL buffer',renderer.width>0&&renderer.height>0,renderer);
  await scenario(page,label+' gait observations',async()=>{
   await reset(page);const frames=await sample(page,45,.1);await artifact(label+'-gait.json',frames);const metrics=footChecks(label+' natural walk',frames);await artifact(label+'-gait-metrics.json',metrics);
   for(const species of ['tiger','stag','doe','fawn','bear','panda']){const s=metrics.summary[species];check(label+' '+species+' meaningful walking/turns/startstop',s&&s.walking>10&&s.turns>2&&s.start>0&&s.stop>0,s??{});}
   check(label+' naturally sampled flat and slope',Object.values(metrics.summary).some(s=>s.flat>10)&&Object.values(metrics.summary).some(s=>s.slope>10),Object.fromEntries(Object.entries(metrics.summary).map(([k,s])=>[k,{flat:s.flat,slope:s.slope}])));
   await snap(page,label+'-clear-overview',{weather:'clear',time:12});
   for(const species of ['tiger','stag','bear','panda']){
    const camera=await page.evaluate(species=>{const a=window.__isle.fauna.agents.find(a=>a.r.key===species),p=a.mesh.position;return {pos:[p.x+6,p.y+2.4,p.z+7],target:[p.x,p.y+.8,p.z],focus:[p.x,p.y+.8,p.z],fov:38};},species);
    for(let n=0;n<3;n++){await page.evaluate(()=>window.__isle.advance(.25,{freezeWeather:true,render:false}));await snap(page,label+'-'+species+'-close-'+n,{...camera,weather:'clear',time:12});}
   }
  });
  await scenario(page,label+' rain and lightning',async()=>{
   await reset(page,'rain');const frames=await sample(page,45,.25);await artifact(label+'-rain.json',frames);const final=frames.at(-1);
   for(const species of ['tiger','stag','doe','fawn','panda']){
    const agents=final.land.filter(a=>a.species===species),result=await page.evaluate(species=>window.__isle.fauna.agents.filter(a=>a.r.key===species).map(a=>{const f=window.__isle.fauna,h=window.__isle.hf,p=a.shelter?.p,tree=a.shelter?.tree;return {id:a.id,hasCover:!!p&&!!tree,coverRecord:!!tree&&f.cover.some(t=>Math.hypot(t.x-tree.x,t.z-tree.z,t.r-tree.r)<1e-5),distance:p?a.pos.distanceTo(p):null,edgeDistance:p?Math.hypot(p.x-tree.x,p.y-tree.z)-tree.r:null,ground:p?h.heightAt(p.x,p.y):null,normal:p?h.normalAt(p.x,p.y)[1]:null,river:p?h.riverInfo(p.x,p.y):null};}),species);
    check(label+' '+species+' reaches real valid cover',result.length>0&&result.every(a=>a.hasCover&&a.coverRecord&&a.distance<1.2&&a.edgeDistance>=0&&a.edgeDistance<=2&&a.ground>=.9&&a.normal>=.82&&a.river.dist>=a.river.width),{agents,result});
   }
   const bearTravel=final.land.filter(a=>a.species==='bear').map(a=>({id:a.id,distance:distance(a.position,frames[0].land.find(b=>b.id===a.id).position),states:[...new Set(frames.map(f=>f.land.find(b=>b.id===a.id).state))],reasons:[...new Set(frames.map(f=>f.land.find(b=>b.id===a.id).reason))]}));check(label+' bears remain active in rain',bearTravel.every(a=>!a.reasons.includes('shelter'))&&bearTravel.some(a=>a.distance>.5),bearTravel);
   const birds=final.birds.filter(a=>a.species!=='gull');check(label+' birds landed matrix and fold attributes',birds.every(a=>a.mode==='perched'&&a.fold>.95&&a.flap<.05&&a.wingWidthRatio<.35&&a.treeRecord&&a.tipError<.01&&Math.abs(a.perchHeightError)<.2&&a.perchHorizontalError<2),birds);
   let maxJump=0;for(let n=1;n<frames.length;n++)for(let j=0;j<frames[n].birds.length;j++)maxJump=Math.max(maxJump,distance(frames[n].birds[j].position,frames[n-1].birds[j].position));check(label+' bird transitions continuous',maxJump<4,{sampleSeconds:.25,maxJump});
   await snap(page,label+'-rain-overview',{weather:'rain',time:12});
   const before=await page.evaluate(()=>window.__livingProbe.land());const event=await page.evaluate(()=>{const i=window.__isle,a=i.fauna.agents.find(a=>a.r.key==='stag');return i.triggerStrike({position:[a.pos.x-3,i.hf.heightAt(a.pos.x-3,a.pos.y),a.pos.y],seed:719,bolt:true});});
   await snap(page,label+'-strike-flash',{weather:'rain',time:12});
   const strikeFrames=await sample(page,8,1/30);await artifact(label+'-strike.json',{event,before,frames:strikeFrames});
   const source=Array.isArray(event.position)?event.position:[event.position.x,event.position.y,event.position.z];
   const near=before.filter(a=>Math.hypot(a.position[0]-source[0],a.position[2]-source[2])<=40),onsets=near.map(a=>({id:a.id,t:strikeFrames.find(f=>f.land.find(b=>b.id===a.id).reason==='startle')?.t}));
   check(label+' nearby strike overrides shelter',onsets.every(a=>a.t!==undefined&&a.t<=.25),onsets);check(label+' strike staggering observed',new Set(onsets.map(a=>a.t)).size>1,onsets);
   for(const a of near.filter(a=>['stag','doe','fawn'].includes(a.species))){const b=strikeFrames.find(f=>f.t>=4).land.find(b=>b.id===a.id),dx=a.position[0]-source[0],dz=a.position[2]-source[2],away=((b.position[0]-a.position[0])*dx+(b.position[2]-a.position[2])*dz)/Math.hypot(dx,dz);check(label+' deer '+a.id+' physically bolts away',away>2,{away,start:a.position,after:b.position,blocked:b.blocked});}
   for(const a of near.filter(a=>!['stag','doe','fawn'].includes(a.species))){const b=strikeFrames.find(f=>f.t>=.5).land.find(b=>b.id===a.id),movement=max(b.feet.map((f,k)=>distance(f.skin,a.feet[k].skin)));check(label+' '+a.species+' '+a.id+' actual strike pose changes',movement>.025,{skinCentroidMotion:movement});}
   const birdBefore=frames.at(-1).birds,nearBird=birdBefore.filter(a=>Math.hypot(a.position[0]-source[0],a.position[2]-source[2])<=45);check(label+' nearby birds scatter actual instances',nearBird.length>0&&nearBird.every(a=>{const b=strikeFrames.find(f=>f.t>=2).birds.find(b=>b.species===a.species&&b.index===a.index);return distance(a.position,b.position)>1;}),{count:nearBird.length});
   const fast=strikeFrames.flatMap(f=>f.land.filter(a=>['stag','doe','fawn'].includes(a.species)).map(a=>a.speed));check(label+' flee speed above walk',max(fast)>1.5,{maxSpeed:max(fast)});
   await artifact(label+'-flee-metrics.json',footChecks(label+' strike gait',strikeFrames.map(f=>({...f,land:f.land.filter(a=>['stag','doe','fawn'].includes(a.species))}))));
   await snap(page,label+'-strike-aftermath',{weather:'rain',time:12});
   await page.evaluate(()=>window.__isle.setWeather('clear',true));const recovery=await sample(page,59,.5);await artifact(label+'-recovery.json',recovery);
   const recovered=recovery.at(-1);check(label+' land recovery within minute',recovered.land.every(a=>!['shelter','startle','settle'].includes(a.reason)),recovered.land.map(a=>({id:a.id,reason:a.reason})));check(label+' birds recover to actual flight',recovered.birds.every(a=>a.mode==='flight'&&a.fold<.05),recovered.birds);
   await snap(page,label+'-recovery-overview',{weather:'clear',time:12});await page.evaluate(()=>window.__isle.setTime(23));await page.evaluate(()=>window.__isle.advance(20,{freezeWeather:true,render:false}));await snap(page,label+'-night-overview',{weather:'clear',time:23});
  });
  await scenario(page,label+' sea storm and breathing',async()=>{
   await reset(page);const clear=await sample(page,18,1,true);await reset(page,'storm');const storm=await sample(page,18,1,true);await artifact(label+'-sea-storm.json',{clear,storm});
   for(const key of ['shark','manta']){const values=fs=>fs.slice(-8).flatMap(f=>f.sea.filter(a=>a.key===key).map(a=>a.depthFraction)),a=values(clear),b=values(storm),mean=v=>v.reduce((s,x)=>s+x,0)/v.length;check(label+' '+key+' actual storm depth',mean(b)<mean(a)-.025,{clearMean:mean(a),stormMean:mean(b)});}
   await reset(page);const breath=await sample(page,120,.25,true);await artifact(label+'-sea-breath.json',breath);
   for(let id=0;id<2;id++){const track=breath.map(f=>({t:f.t,...f.sea.find(a=>a.key==='turtle'&&a.index===id)})),firstHold=track.findIndex(a=>a.breathMode==='hold'),holds=firstHold<0?[]:track.slice(firstHold).slice(0,track.slice(firstHold).findIndex(a=>a.breathMode!=='hold')<0?undefined:track.slice(firstHold).findIndex(a=>a.breathMode!=='hold')),first=holds[0],last=holds.at(-1),after=first?track.filter(a=>a.t>last.t):[];check(label+' turtle '+id+' actual surface hold and dive',holds.length>=10&&holds.every(a=>a.head>=-.15&&a.head<=.3)&&last.t-first.t>=2.5&&last.t-first.t<=3.5&&after.some(a=>a.position[1]<first.position[1]-.7),{holdSamples:holds.length,first,last,lowestAfter:after.length?Math.min(...after.map(a=>a.position[1])):null});}
   const all=[...clear,...storm,...breath].flatMap(f=>f.sea.map(a=>({t:f.t,...a}))),bad=all.filter(a=>a.ground<-.035||a.edge<-.015||a.minY< -27||(!['ascend','hold','descend'].includes(a.breathMode)&&a.top>.15));check(label+' sea real animated vertices clear floor/glass',bad.length===0,{samples:all.length,worstGround:min(all.map(a=>a.ground)),worstEdge:min(all.map(a=>a.edge)),violations:bad.slice(0,30)});
   await snap(page,label+'-sea-overview',{weather:'clear',time:12,name:'reef'});
  });
  await scenario(page,label+' pause and reduced motion',async()=>{
   await reset(page,'rain');await page.evaluate(()=>{window.__isle.setPlaying(true);window.__isle.resume();});
   const first=await page.evaluate(()=>({frame:window.__isle.frames(),probe:window.__livingProbe.freeze()}));await page.waitForFunction(n=>window.__isle.frames()>n+5,first.frame);const second=await page.evaluate(()=>window.__livingProbe.freeze());check(label+' playing changes actual joints and shader clocks',JSON.stringify(first.probe.land)!==JSON.stringify(second.land)&&first.probe.time!==second.time);
   for(const mode of ['playing-off','pause-hook','reduced-motion']){
    if(mode==='reduced-motion')await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(mode=>{const i=window.__isle;if(mode==='playing-off'){i.setPlaying(false);i.resume();}if(mode==='pause-hook'){i.setPlaying(true);i.pause();}if(mode==='reduced-motion')i.resume();},mode);
    await page.waitForFunction(()=>window.__isle.frames()>2);
    await page.screenshot({path:path.join(out,label+'-'+mode+'-before.png'),timeout:180000});
    const a=await page.evaluate(()=>({frame:window.__isle.frames(),probe:window.__livingProbe.freeze()}));await page.waitForFunction(n=>window.__isle.frames()>n+5,a.frame);const b=await page.evaluate(()=>window.__livingProbe.freeze());check(label+' '+mode+' freezes real joints instances particles',JSON.stringify(a.probe)===JSON.stringify(b),{from:a.probe.time,to:b.time,frames:await page.evaluate(()=>window.__isle.frames())-a.frame});
    await artifact(label+'-'+mode+'-freeze.json',{before:a.probe,after:b});await page.screenshot({path:path.join(out,label+'-'+mode+'-after.png'),timeout:180000});
   }
   await page.emulateMedia({reducedMotion:'no-preference'});
  });
  await context.close();
 }
 check('no page/console/asset errors',report.errors.length===0,report.errors);
}catch(e){report.errors.push({type:'harness',message:e.stack});check('harness execution',false,{error:e.stack});}
finally{await browser?.close();report.finished=new Date().toISOString();report.status=report.checks.some(c=>!c.pass)||report.errors.length?'FAIL':'PASS';report.counts={pass:report.checks.filter(c=>c.pass).length,fail:report.checks.filter(c=>!c.pass).length};await artifact('report.json',report);console.log(report.status,report.counts,'report:',path.join(out,'report.json'));if(report.status!=='PASS')process.exitCode=1;}
