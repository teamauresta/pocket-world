import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='review/lan-preview';await fs.mkdir(out,{recursive:true});
const report={url:(process.env.POCKET_WORLD_PREVIEW_ORIGIN || 'http://127.0.0.1:30893') + '/',checks:[],errors:[],consoleErrors:[],rendering:'Sandboxed software WebGL; recipient-side/device performance unverified.'};
const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,chromiumSandbox:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:800}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.goto(report.url+'?test=1');await page.waitForFunction(()=>window.__isle?.ready);
 await page.locator('#weather').click();await page.locator('[data-weather="storm"]').click();assert.equal(await page.locator('[data-weather="storm"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');
 report.checks.push({name:'LAN scene and accessible Storm control',status:'PASS'});
 await page.locator('#sound').click();await page.waitForFunction(()=>window.__isle.ambience.on);
 const schedule=await page.evaluate(()=>{const i=window.__isle,a=i.ambience,orig=a.noiseBurst;a.qaBursts=[];a.noiseBurst=function(...args){this.qaBursts.push({args,time:i.weather.time});return orig.apply(this,args);};i.triggerStrike({position:[-27.5,25,-27.5],distance:120,bolt:true});return {now:i.weather.time,pending:a.pendingThunder.map(x=>({...x}))};});
 assert(schedule.pending.length>0);for(const p of schedule.pending)assert(p.due-schedule.now>=.299&&p.due-schedule.now<=3.001);
 await page.evaluate(()=>window.__isle.step(3.1));await page.waitForFunction(()=>window.__isle.ambience.qaBursts.some(b=>b.args[4]===true));
 const thunder=await page.evaluate(()=>window.__isle.ambience.qaBursts.filter(b=>b.args[4]===true));report.checks.push({name:'Delayed thunder is actually scheduled and synthesised after strike',status:'PASS',schedule,thunder});
 await page.locator('#sound').click();const muted=await page.evaluate(()=>{const a=window.__isle.ambience;return {on:a.on,pending:a.pendingThunder.length,transients:a.transients.size,gain:a.master.gain.value};});assert.deepEqual(muted,{on:false,pending:0,transients:0,gain:0});report.checks.push({name:'Mute cancels queued thunder/transient sources and closes gain',status:'PASS',muted});
 for(const [name,time,phase,source] of [['sunset-disc',18.3,.35,'sun'],['moon-half',18,.25,'moon'],['moon-full',22.5,.5,'moon']]){
  await page.evaluate(s=>window.__isle.capture(s),{time,moonPhase:phase,weather:'clear'});
  const vectors=await page.evaluate(source=>{const i=window.__isle,d=source==='sun'?i.U.uCelestialSun.value:i.U.uMoonDir.value,pos=[0,15,95];return {pos,target:i.camera.position.clone().set(...pos).addScaledVector(d,300).toArray()};},source);
  await page.evaluate(s=>window.__isle.capture(s),{...vectors,time,moonPhase:phase,weather:'clear',fov:35,t:12});
  const alignment=await page.evaluate(source=>{const i=window.__isle,d=source==='sun'?i.U.uCelestialSun.value:i.U.uMoonDir.value;return {aim:i.camera.getWorldDirection(i.camera.position.clone()).dot(d),light:i.atmo.sun.position.clone().normalize().dot(d),intensity:i.atmo.sun.intensity,dir:d.toArray()};},source);
  assert(alignment.aim>.999);if(time>20||source==='sun')assert(alignment.light>.999,'visible disc and active light match');
  await page.screenshot({path:`${out}/${name}.png`});report.checks.push({name:'Visible '+name+' actual camera/light alignment',status:'PASS',alignment});
 }
 // Aim onto the rotated Galactic great-circle, avoiding the moon disc.
 const band=await page.evaluate(()=>{const i=window.__isle,n=i.U.uMoonDir.value.clone().set(.866,.5,0).normalize().applyMatrix3(i.atmo.nightSky.stars.material.uniforms.uRotation.value),d=n.clone().cross(n.clone().set(0,0,1)).normalize();if(d.y<0)d.negate();const pos=[0,15,95];return {pos,target:i.camera.position.clone().set(...pos).addScaledVector(d,300).toArray()};});
 await page.evaluate(s=>window.__isle.capture(s),{...band,time:22.5,moonPhase:0,weather:'clear',fov:60,t:12});await page.screenshot({path:`${out}/milky-way.png`});
 const meteor=await page.evaluate(()=>{const i=window.__isle,s=i.atmo.nightSky;i.setWeather('clear',true);s.meteorStart=i.U.uTime.value;s.nextMeteor=i.U.uTime.value+25;i.step(.2);return {visible:s.meteor.visible,transparent:s.meteor.material.transparent,age:s.meteor.material.uniforms.uAge.value,calls:i.renderer.info.render.calls};});assert(meteor.visible&&meteor.transparent&&meteor.age>0&&meteor.age<1);report.checks.push({name:'Forced meteor actually renders its additive shader',status:'PASS',meteor});
 assert.equal(report.errors.length,0);assert.equal(report.consoleErrors.length,0);report.status='PASS';
} catch(e){report.status='FAIL';report.failure=e.stack;throw e;} finally {await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(report.status,report.checks.length,'LAN verification checks');}
