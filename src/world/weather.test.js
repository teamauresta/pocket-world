import test from 'node:test';
import assert from 'node:assert/strict';
import { Weather, PRESETS, loadWeatherPreference, saveWeatherPreference } from './weather.js';
import { sunDirection, moonDirection } from './night-sky.js';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e, ``+a+' != '+b);
test('preset snap, independent wind override, actual target getter',()=>{
  const w=new Weather();w.setWind('calm');w.setMode('storm',{snap:true});assert.equal(w.mode,'storm');assert.equal(w.wind,.1);assert.equal(w.wet,1);assert.deepEqual(w.target,{...PRESETS.storm,wind:.1});w.setWind('auto',{snap:true});assert.equal(w.wind,.9);
});
test('exponential cloud and rain transitions are continuous',()=>{
  const w=new Weather();w.setMode('storm');assert.equal(w.rain,0);w.update(1);near(w.rain,1-Math.exp(-1/5));near(w.cloud,1-.95*Math.exp(-1/8));assert.ok(w.wet<w.rain);
});
test('frame-rate independence includes random gusts and strikes',()=>{
  const a=new Weather({seed:88}),b=new Weather({seed:88});a.setMode('storm');b.setMode('storm');const ea=[],eb=[];a.on('strike',e=>ea.push(e));b.on('strike',e=>eb.push(e));
  for(let i=0;i<1800;i++)a.update(1/30);for(let i=0;i<8640;i++)b.update(1/144);
  assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(ea,eb);assert.ok(ea.length>=2);
});
test('pause stops clocks, event scheduling and wetness',()=>{const w=new Weather();w.setMode('storm',{snap:true});const before=w.snapshot();w.update(100,{paused:true});assert.deepEqual(w.snapshot(),before);});
test('wetness lingers after rainfall and dries with a sixty second constant',()=>{const w=new Weather();w.setMode('storm',{snap:true});w.setMode('clear');w.update(20);assert.ok(w.rain<.02);assert.ok(w.wet>.65);const before=w.wet;w.update(60);assert.ok(w.wet<before*.4&&w.wet>before*.35);});
test('invalid public inputs do not poison simulation',()=>{const w=new Weather();for(const v of [NaN,Infinity,-1,3601,'1'])assert.throws(()=>w.update(v),RangeError);for(const v of ['hail','__proto__',null])assert.throws(()=>w.setMode(v),RangeError);for(const v of [NaN,-.1,1.1,'gale'])assert.throws(()=>w.setWind(v),RangeError);assert.throws(()=>w.strike({position:[NaN,0,0]}),RangeError);assert.equal(w.time,0);});
test('strike listener unsubscribe and reduced-motion runtime envelope',()=>{const w=new Weather();let count=0;const off=w.on('strike',()=>count++);w.strike({bolt:true});assert.equal(w.flash,1);off();w.setReducedMotion(true);assert.equal(w.mode,'clear');w.strike();assert.equal(w.flash,.3);w.update(.15);assert.ok(w.flash<=.3);assert.equal(count,1);w.update(1);assert.equal(w.flash,0);});
test('auto storm cap applies within 120 seconds, manual storm remains chosen',()=>{const a=new Weather();a.setMode('storm',{snap:true});a.setMode('auto');a.update(120);assert.equal(a.state,'rain');const b=new Weather();b.setMode('storm');b.update(200);assert.equal(b.state,'storm');});
test('new rain spell needs three minutes of actual Clear; cloudy is not Clear',()=>{const w=new Weather();w.rng=()=>.5;w.changeState('cloudy');w.clearSeconds=179;w.autoStep();assert.equal(w.state,'clear');w.changeState('cloudy');w.clearSeconds=180;w.autoStep();assert.equal(w.state,'rain');assert.equal(w.clearSeconds,0);w.changeState('storm');w.rng=()=>.2;w.autoStep();assert.equal(w.state,'rain');});
test('twenty-minute auto runs remain bounded and reproducible across twenty seeds',()=>{let wet=0;for(let seed=0;seed<20;seed++){const w=new Weather({seed});for(let i=0;i<1200;i++){w.update(1);assert.ok(w.state!=='storm'||w.stateSeconds<120);for(const k of ['cloud','rain','wind','wet','fog','waves','lightning','flash','gust'])assert.ok(w[k]>=0&&w[k]<=1);if(w.rain>.5)wet++;}}assert.ok(wet>0);});
test('guarded persistence handles blocked storage and malformed values',()=>{const blocked=()=>{throw Error('blocked');};assert.equal(loadWeatherPreference(blocked),null);assert.doesNotThrow(()=>saveWeatherPreference(new Weather(),blocked));for(const raw of ['bad','null','{"weather":"toString","wind":"auto"}'])assert.equal(loadWeatherPreference(()=>({getItem:()=>raw})),null);const pref={weather:'rain',wind:'windy'};assert.deepEqual(loadWeatherPreference(()=>({getItem:()=>JSON.stringify(pref)})),pref);});
test('celestial arcs are periodic unit vectors with full moon opposite new moon timing',()=>{for(let h=0;h<24;h+=.1){near(sunDirection(h).length(),1);near(sunDirection(h).distanceTo(sunDirection(h+24)),0);}assert.ok(moonDirection(0,.5).y>.7);assert.ok(moonDirection(0,0).y<0);assert.ok(moonDirection(12,0).y>.7);assert.ok(moonDirection(12,.5).y<0);near(sunDirection(23.999999).distanceTo(sunDirection(0)),0,1e-5);});
