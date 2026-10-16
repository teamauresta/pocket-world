import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='review/full-visual'; await fs.mkdir(out,{recursive:true});
const report={started:new Date().toISOString(),rendering:'Sandboxed SwiftShader software WebGL; no hardware FPS claim.',captures:[],errors:[],consoleErrors:[],assetErrors:[]};
const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,chromiumSandbox:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try {
for(const mobile of [false,true]) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1100,height:800},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:4174/'))report.assetErrors.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:4174/?test=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__isle?.ready,null,{timeout:180000});
 const label=mobile?'mobile':'desktop';
 const specs=mobile?[['initial',{time:16,weather:'clear'}],['storm',{time:16,weather:'storm',flash:0}]]:[['clear',{time:16,weather:'clear'}],['sunset',{time:17.5,weather:'clear'}],['full-moon',{time:22.5,weather:'clear',moonPhase:.5}],['night-cloudy',{time:22.5,weather:'cloudy',moonPhase:.5}],['rain',{time:16,weather:'rain',wind:'windy'}],['storm-flash',{time:16,weather:'storm',flash:1,bolt:true}],['storm-reef',{time:16,weather:'storm',name:'reef',flash:0}]];
 for(const [name,spec] of specs){
  const receipt=await page.evaluate(async s=>{const i=window.__isle;const r=await i.capture({...s,frames:2,ui:true,t:12});const gl=i.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');const shadows=[];i.rain.group.traverse(o=>{if(o.castShadow)shadows.push(o.name);});return {capture:r,state:i.state(),renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),effectShadowCasters:shadows,baseNDC:[[-53,-20,-53],[-53,-20,53],[53,-20,-53],[53,-20,53]].map(p=>i.camera.position.clone().set(...p).project(i.camera).toArray())};},spec);
  assert.equal(receipt.state.passes,4);assert.equal(receipt.effectShadowCasters.length,0);
  if(!spec.name)for(const p of receipt.baseNDC){assert(Math.abs(p[0])<.96,'base horizontal framing');assert(Math.abs(p[1])<.96,'base vertical framing');}
  await page.screenshot({path:`${out}/${label}-${name}.png`,timeout:180000});report.captures.push({label,name,spec,receipt});console.log('CAPTURE',label,name);
 }
 if(!mobile){
  for(const [name,spec,source] of [['sun-disc',{time:17.5,weather:'clear'},'sun'],['moon-half',{time:18,weather:'clear',moonPhase:.25},'moon'],['moon-full',{time:22.5,weather:'clear',moonPhase:.5},'moon']]){
   await page.evaluate(s=>window.__isle.capture(s),spec);
   const vectors=await page.evaluate(source=>{const i=window.__isle,dir=source==='sun'?i.U.uCelestialSun.value:i.U.uMoonDir.value;const pos=[0,15,95],target=dir.clone().multiplyScalar(500).add(i.camera.position.clone().set(...pos)).toArray();return {pos,target,dir:dir.toArray(),light:i.state().light};},source);
   const receipt=await page.evaluate(s=>window.__isle.capture({...s,frames:2,fov:35,t:12}),{...spec,pos:vectors.pos,target:vectors.target});
   const aim=await page.evaluate(source=>{const i=window.__isle;const dir=source==='sun'?i.U.uCelestialSun.value:i.U.uMoonDir.value;return {alignment:i.camera.getWorldDirection(i.camera.position.clone()).dot(dir),elevation:dir.y};},source);
   assert(aim.alignment>.999,'requested celestial camera must match actual direction');assert(aim.elevation>0,'requested disc above horizon');
   await page.screenshot({path:`${out}/desktop-${name}.png`,timeout:180000});report.captures.push({label,name,spec,vectors,receipt,aim});console.log('CAPTURE',label,name);
  }
 }
 await context.close();
}
assert.equal(report.errors.length,0);assert.equal(report.consoleErrors.length,0);assert.equal(report.assetErrors.length,0);report.status='PASS';
} catch(e){report.status='FAIL';report.failure=e.stack;throw e;} finally {await browser.close();report.finished=new Date().toISOString();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
