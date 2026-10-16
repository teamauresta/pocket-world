// Creature lab: renders sculpted creatures on a neutral stage for quick iteration.
import * as THREE from 'three';
import { fishGeometry, sharkGeometry, mantaGeometry, turtleGeometry } from './creatures/sea.js';
import { buildAnimal } from './creatures/land.js';
import { createAnimalMaterial, attachAnimalDetail } from './creatures/animal-surface.js';
import { makeSkeleton } from './creatures/rig.js';
import { pose } from './creatures/gait.js';
import { Fauna } from './fauna/animals.js';
import { SpatialHash } from './veg/scatter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa2b2);
scene.add(new THREE.HemisphereLight(0xdde8f0, 0x504840, 1.1));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.4);
sun.position.set(4, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x6f8a55, roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = .6; controls.maxDistance = 65;
const grid = new THREE.GridHelper(60, 60, 0x496b4b, 0x688668); scene.add(grid);
let live = null, liveTime = 0, running = false, lastFrame = null;
let inspectView = 'body', inspectLod = 'auto', staticDetails = [];
const inspectTarget = () => {
  if(!live)return controls.target.clone();const a=live.agent;a.mesh.updateWorldMatrix(true,true);
  if(inspectView==='face')return a.rig.byName.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.1*a.mesh.scale.y,0));
  if(inspectView==='feet')return a.rig.byName.wristL.getWorldPosition(new THREE.Vector3());
  return a.mesh.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.8*a.mesh.scale.y,0));
};
const updateDetailView = () => {if(live)live.fauna.updateDetailView(camera,{forceLod:inspectLod==='auto'?null:inspectLod});};
const followLiveCamera = () => {
  if(!live)return;const target=inspectTarget(),delta=target.clone().sub(controls.target);
  camera.position.add(delta);controls.target.copy(target);controls.update();updateDetailView();
};
const disposeStatic = () => {for(const d of staticDetails)d.dispose();staticDetails=[];};
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const setRunning = on => { running = !!on; controls.enableDamping=running; const b = document.getElementById('labPlay'); if(b){ b.textContent=running?'Pause':'Play'; b.setAttribute('aria-pressed',String(running)); } };
motionPreference.addEventListener('change', e => { if(e.matches) setRunning(false); });
const disposeLive = () => { if(!live)return;for(const a of live.fauna.agents)a.detailAppearance.dispose();const geos=new Set(),mats=new Set();live.fauna.group.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);o.skeleton?.dispose();});for(const g of geos)g.dispose();for(const m of mats)m.dispose();live=null; };
const liveStep = seconds => {
  if(!Number.isFinite(seconds)||seconds<0||seconds>120)throw new RangeError('Lab seconds must be 0..120');
  for(let k=0,n=Math.ceil(seconds*60);k<n;k++){
    const dt=Math.min(1/60,seconds-k/60);liveTime+=dt;
    if(!live)break;const a=live.agent;
    if(a.state!=='walk'&&a.speed<.03){if(!live.waiting){live.waiting=true;live.hold=.65;}live.hold-=dt;if(live.hold<=0){live.direction*=-1;live.fauna.travel(a,new THREE.Vector2(live.direction*3.5,0));live.waiting=false;}}
    live.fauna.update(dt,liveTime,{});
  }
  if(live)live.fauna.update(0,liveTime,{});
};
const sea = {
  shark: sharkGeometry, manta: mantaGeometry, turtle: turtleGeometry,
  clown: () => fishGeometry('clown'), bluetang: () => fishGeometry('bluetang'), yellowtang: () => fishGeometry('yellowtang'),
  angel: () => fishGeometry('angel'), idol: () => fishGeometry('idol'), silver: () => fishGeometry('silver'),
};
const group = new THREE.Group();
scene.add(group);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
const cache = {};
window.__lab = {
  live({species='tiger',terrain='flat',speed=1}={}) {
    if(!['tiger','stag','doe','fawn','bear','panda'].includes(species)||!['flat','slope'].includes(terrain)||!Number.isFinite(speed)||speed<.25||speed>2)throw new RangeError('Invalid live lab spec');
    disposeLive();disposeStatic();group.clear();liveTime=0;controls.enableDamping=true;
    for (const [id,value] of [['labSpecies',species],['labTerrain',terrain],['labSpeed',String(speed)]]) {
      const input=document.getElementById(id);if(input){if(![...input.options].some(o=>o.value===value))input.add(new Option(value+'×',value));input.value=value;}
    }
    const slope=terrain==='slope'?.18:0;
    const hf={heightAt:x=>8+slope*x,normalAt:()=>[-slope,1,0].map(v=>v/Math.hypot(slope,1)),riverInfo:()=>({dist:100,width:0}),river:{down:[]}};
    const fauna=new Fauna(hf,new SpatialHash(),{coverHash:null});const agent=fauna.agents.find(a=>a.r.key===species);
    fauna.agents=fauna.agents.filter(a=>a===agent);for(const m of [...fauna.group.children])if(m!==agent.mesh)fauna.group.remove(m);
    agent.r={...agent.r,acts:[['walk',1]]};agent.home.set(0,0);agent.radius=9;agent.pos.set(-3.5,0);agent.heading=0;agent.motion.reset('lab-placement');agent.speed=0;agent.timer=1000;
    fauna.travel(agent,new THREE.Vector2(3.5,0));group.add(fauna.group);live={fauna,agent,hf,direction:1,waiting:false,hold:0,playback:speed};
    floor.visible=true;grid.visible=true;floor.position.y=8;grid.position.y=8.008;
    const normal=new THREE.Vector3(-slope,1,0).normalize();floor.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);grid.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    const target=agent.mesh.position.clone().set(-3.5,hf.heightAt(-3.5)+.8,0);camera.position.copy(target).add(new THREE.Vector3(7,3.5,9));controls.target.copy(target);controls.update();fauna.renderAgent(agent,0);updateDetailView();setRunning(!motionPreference.matches);
    return {species,terrain,measured:'Actual Fauna locomotion on a controlled terrain fixture, not a phase-only animation.'};
  },
  step(seconds,{render=true}={}){liveStep(seconds);followLiveCamera();if(render)renderer.render(scene,camera);return live?.fauna.snapshot()??null;},
  pause(){setRunning(false);}, resume(){setRunning(true);},
  get liveState(){return live?{time:liveTime,snapshot:live.fauna.snapshot(),mesh:live.agent.mesh,hf:live.hf,agent:live.agent}:null;},
  renderer, scene, camera, controls,
  setInspectView({view='body',lod='near',species=live?.agent.r.key||'tiger',time}={}) {
    if(!['body','face','feet'].includes(view)||!['auto','near','far'].includes(lod))throw new RangeError('Invalid inspector view');
    if(!live||live.agent.r.key!==species)window.__lab.live({species,terrain:document.querySelector('#labTerrain').value,speed:Number(document.querySelector('#labSpeed').value)});
    if(time!==undefined){if(!Number.isFinite(time)||time<0||time>120)throw new RangeError('Invalid inspection time');if(time>=liveTime)liveStep(time-liveTime);else{liveTime=time;live.fauna.resetForTest();live.agent.pos.set(-3.5,0);live.agent.heading=0;live.fauna.renderAgent(live.agent,0);}}
    inspectView=view;inspectLod=lod;controls.enableDamping=false;document.querySelector('#labView').value=view;document.querySelector('#labLod').value=lod;
    const target=inspectTarget(),scale=live.agent.mesh.scale.x,d=view==='body'?6.5*scale:view==='face'?2.3*scale:1.9*scale;
    const direction=new THREE.Vector3(.9,.22,1).normalize().multiplyScalar(d);camera.position.copy(target).add(direction);controls.target.copy(target);controls.update();camera.lookAt(target);updateDetailView();renderer.render(scene,camera);
    return {view,lod,species,time:liveTime};
  },
  detailDiagnostics(){const eyes=[],lids=[],fur=[];live?.agent.mesh.traverse(o=>{if(!o.isMesh)return;if(/fur|shell/i.test(o.name))fur.push(o);else if(/lid|blink/i.test(o.name))lids.push(o);else if(/sclera|iris|pupil|eye(?!lid)/i.test(o.name))eyes.push(o);});return {eyes,lids,fur};},
  async capture({ items = ['shark'], yaw = 0.6, pitch = 0.25, dist = 12, target = [0, 0, 0], spacing = 0, floorOn = false }) {
    setRunning(false);disposeLive();disposeStatic();group.clear();
    floor.position.y=0;floor.rotation.set(-Math.PI/2,0,0);grid.visible=false;
    floor.visible = floorOn;
    const t0 = performance.now();
    let x = 0;
    const info = [];
    for (const item of items) {
      const [name, action = 'idle', ph = '0'] = item.split(':');
      let m;
      if (sea[name]) {
        m = new THREE.Mesh(sea[name](), mat);
        info.push(`${name}:${m.geometry.index.count / 3}tris`);
      } else {
        cache[name] = cache[name] || buildAnimal(name);
        const a = cache[name];
        const rig = makeSkeleton(a.joints);
        m = new THREE.SkinnedMesh(a.geo, createAnimalMaterial(name));
        m.add(rig.root);
        m.bind(new THREE.Skeleton(rig.bones));
        const detail=attachAnimalDetail(m,rig,a,{quality:'high',seed:8401});staticDetails.push(detail);
        detail.update({time:1,dt:1,distance:dist,night:0,wet:0});
        const walk = action === 'walk' || action === 'trot';
        pose(rig, { phase: +ph, gait: action === 'trot' ? 1 : 0, stride: walk ? 1 : 0, t: 1.0, action, blend: walk ? 0 : 1, species: name });
        info.push(`${name}:${a.geo.index.count / 3}tris`);
      }
      m.castShadow = true;
      m.position.x = x; x += spacing;
      group.add(m);
    }
    const ms = performance.now() - t0;
    const tg = new THREE.Vector3(...target);
    camera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist).add(tg);
    const requested = camera.position.clone();
    controls.enableDamping=false;controls.target.copy(tg);controls.update();
    camera.position.copy(requested);controls.target.copy(tg);controls.update();camera.lookAt(tg);
    scene.updateMatrixWorld(true);renderer.render(scene, camera);
    return { ms: Math.round(ms), info };
  },
  ready: true,
};
const startLive = () => {
  const result=window.__lab.live({species:document.getElementById('labSpecies')?.value||'tiger',terrain:document.getElementById('labTerrain')?.value||'flat',speed:Number(document.getElementById('labSpeed')?.value||1)});
  window.__lab.setInspectView({view:document.querySelector('#labView').value,lod:document.querySelector('#labLod').value});
  return result;
};
for(const id of ['labSpecies','labTerrain','labSpeed'])document.getElementById(id)?.addEventListener('change',startLive);
document.getElementById('labPlay')?.addEventListener('click',()=>setRunning(!running));
for(const id of ['labView','labLod'])document.getElementById(id)?.addEventListener('change',()=>window.__lab.setInspectView({view:document.querySelector('#labView').value,lod:document.querySelector('#labLod').value}));
const fitLab = () => {renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(15))*Math.max(1,(4/3)/camera.aspect)));camera.updateProjectionMatrix();};
addEventListener('resize',fitLab);fitLab();
startLive();
const tick=now=>{const dt=lastFrame===null?0:Math.max(0,Math.min((now-lastFrame)/1000,.05));lastFrame=now;if(live){if(running)liveStep(dt*live.playback);followLiveCamera();}controls.update();renderer.render(scene,camera);requestAnimationFrame(tick);};
requestAnimationFrame(tick);
