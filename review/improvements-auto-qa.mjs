import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const page=await(await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
try{
// Sparse scenery isolates governor behavior; controlled 100ms frame pacing
// exercises sustained slow frames without making a hardware FPS claim.
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await send('Page.addScriptToEvaluateOnNewDocument',{source:`const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => raf(t => setTimeout(() => callback(t), 100));`});
await send('Page.navigate',{url:'http://127.0.0.1:5183/?proceduralModels=1&lite=1'});
const deadline=Date.now()+240000;
let result;
while(Date.now()<deadline){result=await evaluate("window.__isle?.ready && ({description:document.getElementById('qualityDescription').textContent,shadows:window.__isle.renderer.shadowMap.enabled,pixelRatio:window.__isle.renderer.getPixelRatio(),frames:window.__isle.frames()})");if(result){await evaluate('window.__isle.setPlaying(false)');if(result.description.startsWith('Automatic:'))break;}await new Promise(r=>setTimeout(r,1000));}
assert(result?.description.startsWith('Automatic:'));
assert.equal(result.shadows,false);assert(result.pixelRatio<=.75);
await evaluate('window.__isle.pause()');
await fs.writeFile('review/improvements-auto-report.json',JSON.stringify({method:'Sparse scene and controlled 100ms frame pacing; no hardware FPS claim',...result},null,2));console.log(JSON.stringify(result));
}finally{ws.close();}
