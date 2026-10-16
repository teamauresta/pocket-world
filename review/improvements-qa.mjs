import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let serial=0, blockLand=true;
const pending=new Map(), errors=[], checks=[];
function send(method,params={}) { const id=++serial;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));}); }
ws.addEventListener('message', async e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error')errors.push(m.params.args);
  if(m.method==='Fetch.requestPaused')await send(blockLand?'Fetch.failRequest':'Fetch.continueRequest',{requestId:m.params.requestId,...(blockLand?{errorReason:'Failed'}:{})});
});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function wait(expression){const deadline=Date.now()+240000;while(Date.now()<deadline){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,500));}throw Error('Timeout: '+expression);}
async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile('review/'+name+'.png',Buffer.from(r.data,'base64'));}
try{
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Fetch.enable',{patterns:[{urlPattern:'*owner-models/native/elephant.glb',requestStage:'Request'}]});
await send('Page.navigate',{url:'http://127.0.0.1:5183/?test=1&quality=performance'});
await wait('window.__isle?.ready');
await evaluate('window.__isle.pause()');
await wait("window.__isle.ownerModelState.status !== 'loading'");
assert.equal(await evaluate("window.__isle.ownerModelState.parts.land.status"),'failed');
assert.equal(await evaluate("window.__isle.ownerModelState.parts.tiger.status"),'ready');
const motion=await evaluate('(()=>{const I=window.__isle;const before=I.nativeTiger.snapshot().time;I.advance(1,{render:false,freezeWeather:true});return I.nativeTiger.snapshot().time-before})()');
assert(motion>.99);checks.push('Tiger advances with the independent land pack failed');
assert.equal(await evaluate("document.getElementById('modelStatus').hidden"),false);
assert.equal(await evaluate("document.getElementById('retryModels').disabled"),false);
checks.push('Partial loading failure is visible and retry is enabled');
assert.equal(await evaluate('window.__isle.renderer.shadowMap.enabled'),false);
assert(await evaluate('window.__isle.renderer.getPixelRatio() <= 1'));
checks.push('Performance mode disables shadows and caps resolution');
blockLand=false;
await evaluate("document.getElementById('retryModels').click()");
await wait("window.__isle.ownerModelState.status === 'ready'");
checks.push('Retry successfully recovers failed land group');
await evaluate("document.getElementById('aboutBtn').focus();document.getElementById('aboutBtn').click()");
assert.equal(await evaluate('document.activeElement.id'),'aboutClose');
await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
assert.equal(await evaluate('document.activeElement.id'),'aboutBtn');
await evaluate("document.getElementById('detailBtn').focus();document.getElementById('detailBtn').click()");
assert.equal(await evaluate('document.activeElement.id'),'qualitySelect');
await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
assert.equal(await evaluate('document.activeElement.id'),'detailBtn');
await evaluate("document.getElementById('animalSelect').focus();document.getElementById('animalSelect').value='native_wolf';document.getElementById('animalSelect').dispatchEvent(new Event('change',{bubbles:true}))");
assert.equal(await evaluate('document.activeElement.id'),'infoClose');
await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
assert.equal(await evaluate('document.activeElement.id'),'animalSelect');
checks.push('About, settings and animal panel keyboard focus and Escape work');
await evaluate('window.__isle.capture({time:12})');await shot('improvements-desktop');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await evaluate('window.__isle.capture({time:12})');
const bounds=await evaluate("(()=>{const r=document.getElementById('dock').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}})()");
assert(bounds.left>=0 && bounds.right<=bounds.width && bounds.bottom<=bounds.height && !bounds.overflow);
checks.push('Portrait dock stays within viewport without page overflow');
await shot('improvements-mobile');assert.equal(errors.length,0);
console.log(JSON.stringify({checks,errors,bounds},null,2));
await fs.writeFile('review/improvements-report.json',JSON.stringify({checks,errors,bounds},null,2));
}finally{ws.close();}
