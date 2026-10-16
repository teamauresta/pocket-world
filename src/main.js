import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Heightfield } from './world/heightfield.js';
import { buildTerrain, buildDataTextures } from './world/terrain.js';
import { buildEarthWalls, buildPlinth, buildFloorShadow } from './world/diorama.js';
import { buildWater } from './world/water.js';
import { buildRiver, configureRiverMist } from './world/river.js';
import { buildLandscapeDetail } from './world/landscape-detail.js';
import { buildMist } from './world/mist.js';
import { buildFireflies } from './world/fireflies.js';
import { buildTrees } from './veg/trees.js';
import { prepareVegetationDefaults, prepareLeafAtlasUV, depthMaterialFor, distanceMaterialFor } from './veg/materials.js';
import { SpatialHash } from './veg/scatter.js';
import { buildBamboo } from './veg/bamboo.js';
import { buildPalms } from './veg/palms.js';
import { buildRocks } from './veg/rocks.js';
import { buildGroundcover } from './veg/groundcover.js';
import { softenWildlifeCover } from './veg/wildlife-readability.js';
import { OWNER_LAND_HABITATS } from './fauna/owner-land-habitat.js';
import { buildReef } from './sea/reef.js';
import { SeaLife } from './sea/life.js';
import { loadImportedAsset } from './creatures/imported-assets.js';
import { createImportedMaterialLoader } from './creatures/imported-materials.js';
import { attachImportedManta } from './sea/imported-visual.js';
import { createOwnerVisualBatch } from './creatures/owner-visual-batch.js';
import { createImportedBirds } from './creatures/imported-birds.js';
import { createOwnerEagles } from './creatures/owner-eagle.js';
import { attachImportedSwimmers } from './sea/imported-swimmers.js';
import { Fauna } from './fauna/animals.js';
import { createOwnerLandPack, loadOwnerLandAssets, OWNER_LAND_PROFILES } from './fauna/owner-land-pack.js';
import { OWNER_ELEPHANT_PROFILE } from './fauna/owner-land-optional.js';
import { OWNER_LAND_VIEWS } from './fauna/owner-land-views.js';
import { OWNER_LAND_TIGER_PROFILE, createOwnerLandTigerFactory } from './fauna/owner-land-tiger.js';
import { createOwnerSeaPack, loadOwnerSeaAssets } from './sea/owner-sea-pack.js';
import { annotateCoverCanopies } from './fauna/land-navigation.js';
import { Birds } from './fauna/birds.js';
import { Atmosphere } from './world/atmosphere.js';
import { Pipeline } from './render/pipeline.js';
import { OwnerLens } from './render/owner-lens.js';
import { Weather, loadWeatherPreference, saveWeatherPreference } from './world/weather.js';
import { Rain } from './world/rain.js';
import { U, publishWeather, applyWet } from './render/shared.js';
import { HALF, GLADES, fromDE, PEAK } from './world/config.js';
import { Hud } from './ui/hud.js';
import { animalChoices } from './ui/animal-finder.js';
import { chooseAnimalCamera } from './ui/animal-camera.js';
import { Picker } from './ui/picker.js';
import { Ambience } from './audio/ambience.js';

const $ = (id) => document.getElementById(id);
const status = (msg, frac) => {
  $('status').textContent = msg;
  if (frac !== undefined) $('bar').style.width = `${Math.round(frac * 100)}%`;
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let REDUCED = motionQuery.matches;

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600;
const requestedQuality=params.get('quality');
const performanceMode = requestedQuality === 'performance';
const quality = performanceMode ? 'low' : requestedQuality==='high'?'high':requestedQuality==='low'?'low':isMobile?'low':'high';
const DAY_SECONDS = 480; // one full day in eight minutes

async function loadTextures() {
  const loader = new THREE.TextureLoader();
  const load = (name, srgb) => new Promise((resolve) => {
    loader.load(`tex/${name}`, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      resolve(t);
    }, undefined, () => {
      // fall back to a flat texture so the world still renders
      const d = new THREE.DataTexture(new Uint8Array(srgb ? [128, 128, 128, 255] : [128, 128, 255, 255]), 1, 1);
      d.needsUpdate = true;
      resolve(d);
    });
  });
  const [grass, dirt, waterN, lAsh, lAspen, lOak, lPine, bOak, bPine, bBirch, bOakN, bPineN] = await Promise.all([
    load('grass.jpg', true), load('dirt.jpg', true), load('water_n.jpg', false),
    load('leaf_ash.webp', true), load('leaf_aspen.webp', true), load('leaf_oak.webp', true), load('leaf_pine.webp', true),
    load('bark_oak.jpg', true), load('bark_pine.jpg', true), load('bark_birch.jpg', true), load('bark_oak_n.jpg', false), load('bark_pine_n.jpg', false),
  ]);
  const leaf={ash:lAsh,aspen:lAspen,oak:lOak,pine:lPine};
  for(const [species,original] of Object.entries(leaf)){
    const size=quality==='low'?512:1024;
    const atlas=await load(`leaf-detail/${species}-${size}-color.png`,true);
    atlas.wrapS=atlas.wrapT=THREE.ClampToEdgeWrapping;atlas.name='leaf_'+species+'_'+size+'_atlas';
    atlas.userData.leafAtlas={size,variants:3,sourceSize:512,provenance:'Derived1024/512 output from unchanged existing512 EZ-Tree source; not new native photographic detail.'};
    if(quality!=='low'){atlas.leafAtlasNormal=await load(`leaf-detail/${species}-${size}-normal.png`,false);atlas.leafAtlasNormal.wrapS=atlas.leafAtlasNormal.wrapT=THREE.ClampToEdgeWrapping;}
    atlas.originalLeafSource=original;leaf[species]=atlas;
  }
  return {
    grass, dirt, waterN,
    leaf,
    bark: { oak: bOak, pine: bPine, birch: bBirch },
    barkN: { oak: bOakN, pine: bPineN },
  };
}

async function main() {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) throw Object.assign(new Error('no webgl2'), { webgl: true });

  const app = $('app');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: TEST });
  renderer.setPixelRatio(Math.min(devicePixelRatio, performanceMode ? 1 : quality === 'high' ? 2 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = !performanceMode;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x9fb0bf, 1);
  app.appendChild(renderer.domElement);

  const weather = new Weather({ reducedMotion: REDUCED, quality });
  const saved = TEST ? null : loadWeatherPreference();
  if(saved) { weather.setMode(REDUCED && saved.weather === 'auto' ? 'clear' : saved.weather); weather.setWind(saved.wind); }
  publishWeather(weather);
  const scene = new THREE.Scene();
  const seaScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 2, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.6;
  controls.minDistance = 8;
  controls.maxDistance = 460;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(94);
  controls.autoRotateSpeed = 0.35;
  controls.target.set(0, 1, 0);

  status('Loading textures…', 0.1);
  const tex = await loadTextures();
  await nextFrame();

  status('Raising the island…', 0.2);
  await nextFrame();
  const hf = new Heightfield();
  const data = buildDataTextures(hf);
  weather.strikePosition=[PEAK.x,hf.heightAt(PEAK.x,PEAK.z)+.3,PEAK.z];

  status('Shaping the shore…', 0.3);
  await nextFrame();
  scene.add(buildTerrain(hf, { grass: tex.grass, dirt: tex.dirt, riverMask: data.riverMask },{quality,releasePolish:params.get('releasePolish')!=='0'}));
  scene.add(buildLandscapeDetail(hf,{quality,releasePolish:params.get('releasePolish')!=='0'}));
  scene.add(buildEarthWalls(hf));
  scene.add(buildPlinth());
  scene.add(buildFloorShadow());

  status('Growing the forest…', 0.4);
  await nextFrame();
  const hash = new SpatialHash(2);
  scene.add(buildBamboo(hf, hash));
  const trees = buildTrees(hf, tex, hash, { quality });
  scene.add(trees);
  scene.add(buildPalms(hf, hash));
  const canopy = new SpatialHash(2);
  for(const list of hash.map.values()) for(const [x,z,r] of list) canopy.add(x,z,r);
  annotateCoverCanopies(canopy, [scene.getObjectByName('bamboo'), trees, scene.getObjectByName('palms')]);
  status('Placing stones and wildflowers…', 0.5);
  await nextFrame();
  scene.add(buildRocks(hf, hash));
  // Solid geometry drives navigation at both quality tiers. The decoration
  // scatter hash also contains soft ferns/flowers; their LOD-dependent placement
  // must not turn an otherwise open glade into an impassable wall on a phone.
  const animalObstacles = new SpatialHash(2);
  for (const list of hash.map.values()) for (const [x,z,r] of list) animalObstacles.add(x,z,r);
  const groundcover=buildGroundcover(hf,hash,{quality, density: performanceMode ? .25 : undefined});
  if(params.get('releasePolish')!=='0')softenWildlifeCover(groundcover,[...Object.values(OWNER_LAND_HABITATS),OWNER_ELEPHANT_PROFILE.habitat,{x:34.5,z:-39.5,major:.75,minor:.75}]);
  scene.add(groundcover);
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (const material of [o.material].flat()) {
      prepareVegetationDefaults(o.geometry, material);
      prepareLeafAtlasUV(o.geometry,material);
      if (material.userData.vegetationWind && !Array.isArray(o.material)) {
        o.customDepthMaterial ||= depthMaterialFor(material);
        o.customDistanceMaterial ||= distanceMaterialFor(material);
      }
    }
  });
  scene.add(buildFireflies(hf, quality === 'high' ? 260 : 140));

  status('Growing the reef…', 0.58);
  await nextFrame();
  const reef = buildReef(hf, { quality, releasePolish: params.get('releasePolish')!=='0' });
  scene.add(reef);
  status('Releasing the fish…', 0.66);
  await nextFrame();
  const life = new SeaLife(hf, reef.userData.anemones, { quality, ...(params.has('proceduralModels')?{}:{silverCount:2,disabledBig:['shark','turtle']}) });
  scene.add(life.group);
  status('Waking the animals…', 0.74);
  await nextFrame();
  if (params.has('test')) window.__isleBuild = { hf, hash: animalObstacles, decorationHash: hash, canopy, quality }; // Startup diagnostics, including failed placement.
  const fauna = new Fauna(hf, animalObstacles, { coverHash: canopy, quality, furBudget: { maxShells: 6, maxTriangles: 120000 }, excludeSpecies:['stag','doe','fawn'] });
  scene.add(fauna.group);
  const birds = new Birds(hf, trees.userData.perches);
  scene.add(birds.group);

  status('Pouring the sea…', 0.84);
  await nextFrame();
  const sea = buildWater(hf, { normalTex: tex.waterN, heightTex: data.height, quality });
  seaScene.add(sea);
  const river = buildRiver(hf, tex.waterN, { quality, releasePolish:params.get('releasePolish')!=='0' });
  seaScene.add(river);
  const mist = configureRiverMist(buildMist(hf),hf,{quality,releasePolish:params.get('releasePolish')!=='0'});
  seaScene.add(mist);
  const rain = new Rain(hf, data.height, canopy, { quality, lite: params.has('lite'), leafTexture: tex.leaf.oak });
  seaScene.add(rain.group);
  scene.traverse(o => {
    if (!o.material || ['terrain', 'plinth', 'floor-shadow'].includes(o.name)) return;
    let a=o; while(a) { if(a===life.group || a===reef) return; a=a.parent; }
    for(const mat of Array.isArray(o.material)?o.material:[o.material]) {
      // Eyes own their subtle wet clearcoat; global wetness's .12 roughness
      // floor would erase the intended glossy .05 optical surface.
      if(!/^animal-(sclera|iris|pupil)$/.test(mat.name))applyWet(mat, !!mat.alphaTest);
    }
  });
  const fireflies = scene.getObjectByName('fireflies');
  const screenMats = [sea.material, ...river.userData.materials, mist.material, fireflies.material, ...rain.materials];

  // test switch: render only a handful of each instanced thing so software rendering stays quick
  if (params.has('lite')) {
    scene.traverse((o) => { if (o.isInstancedMesh) o.count = Math.min(o.count, 3); });
    renderer.shadowMap.enabled = false;
  }

  status('Lighting the scene…', 0.92);
  await nextFrame();
  const atmo = new Atmosphere(renderer, scene, { shadowSize: quality === 'high' ? 4096 : 2048, quality });
  const ownerLens=new OwnerLens(scene);
  const pipeline = new Pipeline(renderer, scene, seaScene, camera, { samples: performanceMode ? 0 : quality === 'high' ? 4 : 2, bloom: !performanceMode, ownerLens });

  pipeline.dof.enabled = !performanceMode;

  // ---------------------------------------------------------------- framing and viewpoints
  const fitFov = () => {
    const aspect = innerWidth / innerHeight;
    camera.fov = aspect < 1 ? THREE.MathUtils.lerp(30, 46, THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1)) : 30;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };
  const overview = () => {
    fitFov();
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const th = tv * camera.aspect;
    const portrait = camera.aspect < 1;
    const dist = Math.max(68 / tv, 87 / th) * 1.08;
    const az = THREE.MathUtils.degToRad(45), pol = THREE.MathUtils.degToRad(portrait ? 54 : 58);
    // on tall screens lift the diorama above the controls
    const target = new THREE.Vector3(0, portrait ? -16 : -9, 0);
    return { target, pos: new THREE.Vector3(Math.sin(pol) * Math.cos(az), Math.cos(pol), Math.sin(pol) * Math.sin(az)).multiplyScalar(dist).add(target) };
  };
  const glade = (name) => { const g = GLADES.find((q) => q.name === name); const [x, z] = fromDE(g.d, g.e); return new THREE.Vector3(x, hf.heightAt(x, z) + 1.5, z); };
  const packCandidates=()=>[...[nativeLand,nativeTiger].filter(Boolean).flatMap(pack=>pack.getCandidates().map(c=>({key:'native_'+c.species,domain:'Land',radius:c.radius,get:()=>c.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,Math.min(2,c.radius*.55),0))}))),...(nativeSea?.getCandidates()??[]).map(c=>({key:'native_'+c.kind,domain:'Sea',radius:c.radius,get:()=>c.object.getWorldPosition(new THREE.Vector3())}))];
  const modelCycle={modelsLand:0,modelsSea:0,modelsBirds:0};let lastModelView=null;
  const selectedNative=(name,keys)=>{const candidates=packCandidates(),options=keys.map(key=>candidates.find(c=>c.key===key)).filter(Boolean);return options.length?options[modelCycle[name]%options.length]:null;};
  const modelTargets={
    modelsLand:()=>selectedNative('modelsLand',['native_tiger','native_bear','native_wolf','native_rhino','native_alligator','native_elephant'])??(()=>{const a=fauna.agents.find(a=>a.r.key==='bear')??fauna.agents[0];return {key:a.r.key,radius:1.5*a.mesh.scale.x,get:()=>a.mesh.position.clone().add(new THREE.Vector3(0,a.mesh.scale.x,0))};})(),
    modelsBirds:()=>{const choices=[...(importedEagles?[{flock:'eagle',key:'ownerEagle'}]:[]),{flock:'macaw',key:importedBirds?'ownerBird':'macaw'}],choice=choices[modelCycle.modelsBirds%choices.length],f=birds.flocks.find(f=>f.key===choice.flock),i=Math.max(0,f.agents.findIndex(a=>a.mode==='flight'));return {key:choice.key,domain:'Birds',radius:2.5*f.scale,get:()=>f.pos[i].clone()};},
    modelsSea:()=>selectedNative('modelsSea',['native_whale','native_shark','native_dolphin','native_turtle','native_school','native_fish','native_coralFish'])??(()=>{const e=life.species.find(e=>e.key==='silver'),i=Math.max(Math.abs(e.agents[0].p.x),Math.abs(e.agents[0].p.z))>Math.max(Math.abs(e.agents[1].p.x),Math.abs(e.agents[1].p.z))?0:1;return {key:'ownerTuna',radius:.9,get:()=>e.agents[i].p.clone()};})(),
  };
  const animalView=(candidate,domain)=>{const target=candidate.get();let pos;
    const known=domain==='Land'?OWNER_LAND_VIEWS[candidate.key.replace(/^native_/,'')]:null;
    if(known){camera.fov=known.fov;camera.updateProjectionMatrix();const offset=new THREE.Vector3(...known.pos).sub(new THREE.Vector3(...known.target));const pos=candidate.key==='native_wolf'?chooseAnimalCamera(target,offset,{canopies:canopy.canopies,heightAt:(x,z)=>hf.heightAt(x,z),radius:candidate.radius}).position:target.clone().add(offset);return {target,pos};}
    if(domain==='Sea'){pos=target.clone();pos.y+=1.5;const d=Math.max(0,Math.sqrt(Math.max(0,(candidate.radius*5)**2-1.5**2)));if(Math.abs(target.x)>Math.abs(target.z))pos.x=(Math.sign(target.x)||1)*Math.max(HALF+4,Math.abs(target.x)+d);else pos.z=(Math.sign(target.z)||1)*Math.max(HALF+4,Math.abs(target.z)+d);}
    else {const dir=new THREE.Vector3(...(domain==='Birds'?[4,2.5,5]:[8,3.5,7])).normalize();pos=target.clone().addScaledVector(dir,Math.max(domain==='Birds'?7:11,candidate.radius*(domain==='Birds'?2.4:4.5)));}
    return {target,pos};};
  const modelView=name=>animalView(modelTargets[name](),name==='modelsSea'?'Sea':name==='modelsBirds'?'Birds':'Land');
  const views = {
    overview,
    modelsLand:()=>modelView('modelsLand'), modelsBirds:()=>modelView('modelsBirds'), modelsSea:()=>modelView('modelsSea'),
    reef: () => ({ pos: new THREE.Vector3(34, -9, 84), target: new THREE.Vector3(28, -11, 20) }),
    meadow: () => { const t = glade('meadow'); return { target: t, pos: t.clone().add(new THREE.Vector3(26, 17, 18)) }; },
    jungle: () => { const t = glade('jungle'); return { target: t, pos: t.clone().add(new THREE.Vector3(18, 16, 26)) }; },
    bamboo: () => { const t = glade('bamboo'); return { target: t, pos: t.clone().add(new THREE.Vector3(17, 13, 12)) }; },
    peak: () => ({ target: new THREE.Vector3(PEAK.x + 4, 18, PEAK.z + 4), pos: new THREE.Vector3(PEAK.x + 30, 34, PEAK.z + 34) }),
    waterfall: () => {const f=hf.river.fall,target=new THREE.Vector3(f.x,(f.top+f.bottom)*.5,f.z);return {target,pos:target.clone().add(new THREE.Vector3(f.dir[0]*22+6,7,f.dir[1]*22-6))};},
    stream: () => {const p=hf.river.down[Math.floor(hf.river.down.length*.58)],target=new THREE.Vector3(p.x,p.level+.5,p.z);return {target,pos:target.clone().add(new THREE.Vector3(11,9,13))};},
    sky: () => {
      const dir = U.uCelestialSun.value.y > .02 ? U.uCelestialSun.value : U.uMoonDir.value.y > .02 ? U.uMoonDir.value : new THREE.Vector3(0, .5, -1).normalize();
      const pos = new THREE.Vector3(0, 15, 95);
      return { pos, target: pos.clone().addScaledVector(dir, 300) };
    },
  };
  let flight = null; // camera move in progress
  const flyTo = (pos, target, dur = 1.8, portraitScale = true) => {
    if (camera.aspect < 1 && portraitScale) pos = target.clone().add(pos.clone().sub(target).multiplyScalar(1.45));
    flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, k: 0, dur: REDUCED ? 0.01 : dur };
  };
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    fitFov();
    pipeline.setSize(w, h, renderer.getPixelRatio());
  };
  resize();
  { const v = overview(); camera.position.copy(v.pos); controls.target.copy(v.target); controls.update(); }
  addEventListener('resize', resize);

  // keep the camera out of the water block
  const clampCamera = () => {
    const p = camera.position;
    if (Math.abs(p.x) < HALF + 0.5 && Math.abs(p.z) < HALF + 0.5 && p.y < 1.2) p.y = 1.2;
  };

  // ---------------------------------------------------------------- day, sound, selection
  let hour = location.hash === '#night' ? 22.5 : 16.0, playing = !REDUCED, dayCount = 0;
  if(['#rain','#storm'].includes(location.hash)) weather.setMode(location.hash.slice(1),{snap:true});
  atmo.setTime(hour, true);
  const ambience = new Ambience();
  weather.on('strike', event => {
    rain.strike(event); ambience.strike(event, weather.time, camera.position.toArray());
    if(nativeLand)nativeLand.onStrike(event);else fauna.onStrike?.(event);
    nativeTiger?.onStrike(event);nativeSea?.onStrike(event);birds.onStrike?.(event);life.onStrike?.(event);
  });
  let following = null, lastFollow = new THREE.Vector3();

  const hud = new Hud({
    onWeather: mode => { weather.setMode(mode); saveWeatherPreference(weather); hud.setWeather(weather); },
    onWind: mode => { weather.setWind(mode); saveWeatherPreference(weather); hud.setWeather(weather); },
    onTime: (h) => { hour = h; atmo.setTime(h); },
    onPlay: (on) => { playing = on; hud.setPlaying(on); },
    onSound: async (on) => {
      hud.setSound(on);
      try { if (on) await ambience.start(); else ambience.stop(); } catch (e) { hud.setSound(false); }
    },
    onView: (name) => {
      if(name==='modelsLand'||name==='modelsSea'||name==='modelsBirds'){if(lastModelView===name)modelCycle[name]++;lastModelView=name;}else lastModelView=null;
      captureFocus = null; following = null; hud.hideInfo(); hud.setView(name);fitFov();
      if(name==='modelsSea'&&!nativeSea){camera.fov=12;camera.updateProjectionMatrix();}
      controls.maxPolarAngle = name === 'sky' ? Math.PI : THREE.MathUtils.degToRad(94);
      const v = views[name]();
      if(modelTargets[name]){selected=modelTargets[name]();following=selected;lastFollow.copy(selected.get());hud.showInfo(selected.key);hud.setFollowing(true);}
      flyTo(v.pos, v.target, 1.8, name !== 'overview');
    },
    onQuality: (value) => {const url=new URL(location.href);if(value==='auto')url.searchParams.delete('quality');else if(['high','low','performance'].includes(value))url.searchParams.set('quality',value);else return;location.assign(url.href);},
    onFind: (key) => {
      const candidate=candidates().find(c=>c.key===key);if(!candidate)return;
      const domain=animalChoices([candidate])[0]?.label;if(!domain)return;
      captureFocus=null;following=null;hud.hideInfo();fitFov();controls.maxPolarAngle=THREE.MathUtils.degToRad(94);
      hud.setView('animal');selected=candidate;following=candidate;lastFollow.copy(candidate.get());hud.showInfo(key);hud.setFollowing(true);
      const v=animalView(candidate,domain);flyTo(v.pos,v.target,1.8);
    },
    onCloseInfo: () => { following = null; hud.hideInfo(); },
    onFollow: (on) => {
      if (!selected) return;
      following = on ? selected : null;
      hud.setFollowing(on);
      if (on) {
        const p = selected.get();
        lastFollow.copy(p);
        const dir = camera.position.clone().sub(controls.target).normalize();
        flyTo(p.clone().addScaledVector(dir, selected.radius * 9 + 8).add(new THREE.Vector3(0, selected.radius * 2, 0)), p.clone(), 1.4);
      }
    },
  });
  hud.setPlaying(playing);
  hud.setQuality(requestedQuality,performanceMode ? 'performance' : quality);
  hud.setTime(hour); hud.setWeather(weather);
  motionQuery.addEventListener('change', event => {
    REDUCED=event.matches; weather.setReducedMotion(REDUCED);
    if(REDUCED) { playing=false; controls.autoRotate=false; flight=null; hud.setPlaying(false); }
    hud.setWeather(weather);
  });

  // everything that can be tapped
  let selected = null;
  const candidates = () => {
    const out = [];
    out.push(...packCandidates());
    if(!nativeLand)for (const a of fauna.agents) out.push({ key: a.ownerVisual ? ({stag:'ownerStag',doe:'ownerDeer',fawn:'ownerFawn'}[a.r.key]??a.r.key) : a.r.key, radius: 1.5 * a.mesh.scale.x, get: () => a.mesh.position.clone().add(new THREE.Vector3(0, a.mesh.scale.x, 0)) });
    for (const sp of life.species) for (const [i,a] of sp.agents.entries()) out.push({ key: importedSwimmers && sp.key==='silver' && i<2 ? 'ownerTuna' : sp.key, radius: 0.9, get: () => a.p });
    for (const a of life.sharks.agents) out.push({ key: 'shark', radius: 4, get: () => a.p });
    for (const a of life.mantas.agents) out.push({ key: 'manta', radius: 3.5, get: () => a.p });
    for (const a of life.turtles.agents) out.push({ key: 'turtle', radius: 2.2, get: () => a.p });
    for (const f of birds.flocks) f.pos.forEach((p) => out.push({ key: importedEagles&&f.key==='eagle'?'ownerEagle':importedBirds&&f.key==='macaw'?'ownerBird':f.key, radius: 2.5 * f.scale, get: () => p }));
    return out;
  };
  const refreshAnimalFinder=()=>{const present=candidates();hud.setAnimals(animalChoices(present));if(following&&!present.some(c=>c.key===following.key)){following=null;selected=null;hud.hideInfo();}};
  new Picker(camera, renderer.domElement, candidates, (hit) => {
    if (!hit) return;
    selected = hit;
    following = null;
    hud.showInfo(hit.key);
  }, () => [scene.getObjectByName('terrain')]);

  // pause the slow turntable whenever someone touches the diorama
  let idle = 0;
  const wake = () => { captureFocus = null; idle = 0; controls.autoRotate = false; flight = null; };
  renderer.domElement.addEventListener('pointerdown', wake);
  renderer.domElement.addEventListener('wheel', wake, { passive: true });

  const timer = new THREE.Timer();
  timer.connect(document);
  let paused = false;
  let simTime = 0;
  let uiClock = 0;
  let importedManta=null, importedBirds=null, importedSwimmers=null, importedEagles=null;
  let nativeLand=null,nativeTiger=null,nativeSea=null;
  const importedLand=[], ownerLandBatch=createOwnerVisualBatch();
  const disabledOwners=params.has('proceduralModels');
  const ownerModelState={status:disabledOwners?'disabled':'loading',file:'model_84b_-_manta_ray_swimming.glb',licence:'CC-BY-NC-4.0; private non-commercial preview',
    parts:Object.fromEntries(['land','tiger','seaPack','birds','eagles','manta','tuna'].map(key=>[key,{status:disabledOwners?'disabled':'loading',count:0}]))};
  const ownerPart=(key,status,count,error)=>{ownerModelState.parts[key]={status,count,...(error?{error}:{} )};const states=Object.values(ownerModelState.parts);ownerModelState.status=states.some(s=>s.status==='loading')?'loading':states.every(s=>['ready','disabled'].includes(s.status))?'ready':'partial';refreshAnimalFinder();hud.setModelStatus(ownerModelState);};
  refreshAnimalFinder();
  hud.setModelStatus(ownerModelState);
  const behaviorEnvironment = () => ({ weatherState:weather.state, rain: weather.rain, wind: weather.wind, wet: weather.wet, waves: weather.waves,
    gust: weather.gust, windDirection: [...weather.windDirection], night: U.uNight.value, reducedMotion: REDUCED });
  const updateBehavior = (dt) => {
    const env = behaviorEnvironment();
    importedBirds?.beforeRender();importedEagles?.beforeRender();
    life.update(dt, env); importedManta?.update(dt); importedSwimmers?.update(dt);
    nativeTiger?.update(dt,env);
    if(nativeLand){nativeLand.update(dt,env);}else{ownerLandBatch.begin();try{fauna.update(dt,simTime,env);}finally{ownerLandBatch.end();}}
    nativeSea?.update(dt,env);
    if(dt===0)for(const adapter of importedLand)adapter.update(0);
    birds.update(dt, simTime, env); importedBirds?.afterRender(dt);importedEagles?.afterRender(dt);
  };
  const behaviorState = () => ({land:nativeLand?{native:nativeLand.snapshot(),tiger:nativeTiger?.snapshot()??null}:fauna.snapshot(),birds:birds.snapshot(),sea:{existing:life.snapshot(),native:nativeSea?.snapshot()??null}});
  const resetBehavior = () => { importedBirds?.beforeRender();importedEagles?.beforeRender();fauna.resetForTest?.();for(const adapter of importedLand)adapter.resetForTest?.();birds.resetForTest?.();importedBirds?.resetForTest();importedEagles?.resetForTest();life.resetForTest?.();importedManta?.reset();importedSwimmers?.reset();nativeLand?.reset();nativeTiger?.reset();nativeSea?.reset();simTime=0;U.uTime.value=0;updateBehavior(0); };
  const advanceSimulation = (seconds, { freezeWeather = false, render = true } = {}) => {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 120) throw new RangeError('advance seconds must be 0..120');
    const steps = Math.ceil(seconds * 60);
    for (let k = 0; k < steps; k++) {
      const dt = Math.min(1 / 60, seconds - k / 60);
      if (!freezeWeather) weather.update(dt);
      simTime += dt; U.uTime.value = simTime; publishWeather(weather); atmo.setTime(hour);
      updateBehavior(dt);
    }
    if (render) renderFrame();
    return behaviorState();
  };

  // focus a little behind the orbit target so the island stays crisp and the near glass softens
  const focusPoint = new THREE.Vector3();
  let captureFocus = null;
  const islandHeart = new THREE.Vector3(-8, 6, -8);
  const renderFrame = () => {
    if (captureFocus) focusPoint.copy(captureFocus);
    else focusPoint.copy(controls.target).lerp(islandHeart,following?0:.35*THREE.MathUtils.smoothstep(camera.position.distanceTo(controls.target),40,100));
    if(!nativeLand)fauna.updateDetailView(camera);
    nativeSea?.updateDetailView(camera,{quality});importedEagles?.updateDetailView(camera);
    // Explicit user inspection shows the genuine supplied near mesh even when
    // the glass keeps the camera outside its normal distance threshold.
    importedSwimmers?.updateDetailView(following?.key==='ownerTuna'?null:camera,{quality});
    renderer.info.reset();
    publishWeather(weather); atmo.setTime(hour); rain.update(weather);
    renderer.toneMappingExposure = .9 + .5 * U.uNight.value + .2 * weather.flash;
    atmo.update(camera, weather);
    for (const m of screenMats) pipeline.updateSea(m);
    pipeline.render(camera.position.distanceTo(focusPoint));
  };

  // keep the frame rate smooth by trading resolution for speed
  const maxPR = Math.min(devicePixelRatio, performanceMode ? 1 : quality === 'high' ? 2 : 1.5);
  let pr = renderer.getPixelRatio();
  let avg = 16, since = 0, settled = 0;
  let adaptiveEffectsReduced = false;
  const automaticQuality = !['high', 'low', 'performance'].includes(requestedQuality);
  const govern = (dt) => {
    avg = avg * 0.92 + dt * 1000 * 0.08;
    since += dt;
    if (since < 1.5) return;
    since = 0;
    let next = pr;
    if (avg > 24 && pr > 0.75) next = Math.max(0.75, pr - 0.25);
    else if (avg < 13 && pr < maxPR && settled > 3) next = Math.min(maxPR, pr + 0.25);
    settled++;
    // Resolution alone cannot reduce draw calls or shadow-pass work. If an
    // automatic session remains slow at its resolution floor, simplify effects
    // and decorative instances once. Never change wildlife or navigation.
    if (automaticQuality && !adaptiveEffectsReduced && pr <= .75 && avg > 32 && settled >= 3) {
      adaptiveEffectsReduced = true;
      renderer.shadowMap.enabled = false;
      pipeline.dof.enabled = false;
      if (pipeline.bloom) pipeline.bloom.enabled = false;
      groundcover.traverse(o => { if (o.isInstancedMesh) o.count = Math.ceil(o.count * .5); });
      $('qualityDescription').textContent = 'Automatic: reduced plants and effects to improve responsiveness.';
    }
    if (next !== pr) {
      pr = next;
      renderer.setPixelRatio(pr);
      resize();
      settled = 0;
    }
  };

  const fallPos = new THREE.Vector3(hf.river.fall.x, hf.river.fall.bottom + 3, hf.river.fall.z);
  let frameCount = 0;
  const tick = () => {
    frameCount++;
    if (!paused) {
      timer.update();
      const elapsed = Math.max(0, timer.getDelta());
      const dt = Math.min(elapsed, 0.1);
      if (!TEST) govern(elapsed);
      const simDt = playing ? dt : 0;
      simTime += simDt;
      weather.update(simDt);
      publishWeather(weather);
      U.uTime.value = simTime;

      if (playing) {
        const nextHour=hour + dt * 24 / DAY_SECONDS;
        if(nextHour >= 24) { dayCount++; atmo.phase=(.35+dayCount/29.5)%1; }
        hour = nextHour % 24;
        atmo.setTime(hour);
      }
      const night = U.uNight.value;
      renderer.toneMappingExposure = 0.9 + 0.5 * night;
      uiClock += dt;
      if (uiClock > 0.25) { uiClock = 0; hud.setTime(hour); hud.setWeather(weather); }

      if (simDt > 0) updateBehavior(simDt);

      if (flight) {
        flight.k = Math.min(1, flight.k + dt / flight.dur);
        const e = ease(flight.k);
        camera.position.lerpVectors(flight.p0, flight.p1, e);
        controls.target.lerpVectors(flight.t0, flight.t1, e);
        if (flight.k >= 1) flight = null;
      }
      if (following) {
        const p = following.get();
        const d = p.clone().sub(lastFollow);
        lastFollow.copy(p);
        if (!flight) { camera.position.add(d); controls.target.add(d); }
        else { flight.p1.add(d); flight.t1.add(d); }
      }
      idle += dt;
      controls.autoRotate = playing && !REDUCED && !following && !flight && idle > 20;
      controls.update();
      clampCamera();

      const camDist = camera.position.distanceTo(controls.target);
      ambience.update({
        night, rain: weather.rain, wind: weather.wind, paused: !playing,
        zoom: THREE.MathUtils.clamp(1 - (camDist - 30) / 200, 0, 1),
        fall: THREE.MathUtils.clamp(1 - camera.position.distanceTo(fallPos) / 60, 0, 1),
        underwater: camera.position.y < 0 ? 1 : 0,
      }, weather.time);
      renderFrame();
    }
    requestAnimationFrame(tick);
  };

  status('Ready', 1);
  renderFrame();
  await nextFrame();
  $('loader').classList.add('done');
  setTimeout(() => { $('hint').style.opacity = '0'; }, 10000);
  tick();

  // test hooks for the screenshot harness
  const presets = {
    hero: null,
    glass: { pos: [78, -6, 30], target: [20, -10, 30] },
    glassR: { pos: [32, -8, 82], target: [26, -12, 20] },
    top: { pos: [0.01, 260, 0.01], target: [0, 0, 0] },
    back: { pos: [-140, 90, -140], target: [0, 0, 0] },
    river: { pos: [40, 30, 40], target: [-8, 6, -8] },
    low: { pos: [150, 25, 150], target: [0, 0, 0] },
  };
  window.__isle = {
    ready: true,
    frames: () => frameCount,
    hf, scene, seaScene, camera, renderer, atmo, controls, weather, rain, ambience, U, fauna, birds, life, ownerModelState,
    get ownerManta(){return importedManta;},
    get ownerLand(){return importedLand;},
    get nativeLand(){return nativeLand;},get nativeTiger(){return nativeTiger;},get nativeSea(){return nativeSea;},
    get ownerBirds(){return importedBirds;},get ownerEagles(){return importedEagles;},
    releasePolish:params.get('releasePolish')!=='0',quality,
    get ownerSwimmers(){return importedSwimmers;},
    ownerSnapshots:()=>({land:nativeLand?.snapshot()??[],tiger:nativeTiger?.snapshot()??null,marine:nativeSea?.snapshot()??null,birds:importedBirds?.snapshot()??[],eagles:importedEagles?.snapshot()??[],sea:importedSwimmers?.snapshot()??null,manta:importedManta?.snapshot()??null}),
    behaviorState, resetBehavior, advance: advanceSimulation,
    advanceFrame(dt,{render=true}={}){if(!Number.isFinite(dt)||dt<0||dt>.1)throw new RangeError('Frame delta must be 0..0.1');weather.update(dt);simTime+=dt;U.uTime.value=simTime;publishWeather(weather);atmo.setTime(hour);updateBehavior(dt);if(render)renderFrame();return behaviorState();},
    setTime(h) { if (!Number.isFinite(h)) throw new RangeError('Invalid hour'); hour = ((h % 24) + 24) % 24; atmo.setTime(hour); hud.setTime(hour); updateBehavior(0); renderFrame(); },
    state: () => ({ hour, dayCount, moonPhase: atmo.phase, playing, paused, reducedMotion: REDUCED, simTime, weather: weather.snapshot(), audio: { enabled: ambience.on, context: ambience.ctx?.state ?? null, pendingThunder: ambience.pendingThunder.length }, particles: { rain: rain.drops.geometry.instanceCount, bolt: rain.bolt.visible }, light: { direction: atmo.sun.position.clone().normalize().toArray(), intensity: atmo.sun.intensity }, passes: pipeline.composer.passes.length }),
    pause() { paused=true; },
    resume() { captureFocus=null; paused=false; controls.enableDamping=true; timer.update(); },
    setPlaying(on) { playing=!!on; hud.setPlaying(playing); },
    setWeather(mode, snap=false) { weather.setMode(mode,{snap}); hud.setWeather(weather); renderFrame(); },
    setWind(mode, snap=false) { weather.setWind(mode,{snap}); hud.setWeather(weather); renderFrame(); },
    step(dt) { weather.update(dt); simTime+=dt; U.uTime.value=simTime; renderFrame(); return weather.snapshot(); },
    triggerStrike(options={}) { const event=weather.strike(options); renderFrame(); return event; },
    async capture(spec = {}) {
      for(const key of ['time','t','sim','frames','behaviorSeconds']) if(spec[key] !== undefined && (!Number.isFinite(spec[key]) || spec[key] < 0)) throw new RangeError('Invalid capture '+key);
      for(const key of ['pos','target','focus']) if(spec[key] !== undefined && (!Array.isArray(spec[key]) || spec[key].length!==3 || !spec[key].every(Number.isFinite))) throw new RangeError('Invalid camera vector');
      if(spec.pos && !spec.target) throw new RangeError('capture pos requires target');
      paused = true; captureFocus = spec.focus ? new THREE.Vector3(...spec.focus) : null;
      if (spec.resetBehavior) resetBehavior();
      flight=null; following=null; controls.autoRotate=false; controls.enableDamping=false;
      if(spec.weather !== undefined) weather.setMode(spec.weather,{snap:true});
      else weather.snap();
      weather.setWind(spec.wind ?? 'auto',{snap:true});
      if(spec.moonPhase === undefined) atmo.phase=(.35+dayCount/29.5)%1;
      if(spec.moonPhase !== undefined) { if(!Number.isFinite(spec.moonPhase)||spec.moonPhase<0||spec.moonPhase>1) throw new RangeError('moonPhase must be 0..1'); atmo.phase=spec.moonPhase; }
      if(spec.flash !== undefined) { if(!Number.isFinite(spec.flash)||spec.flash<0||spec.flash>1) throw new RangeError('flash must be 0..1'); if(spec.flash>0) { const e=weather.strike({bolt:true,seed:711,position:[PEAK.x,hf.heightAt(PEAK.x,PEAK.z),PEAK.z]}); rain.strike(e); } weather.flash=spec.flash*(REDUCED ? .3 : 1); }
      publishWeather(weather); hud.setWeather(weather);
      $('loader').hidden = true;
      $('hint').hidden = !spec.hint;
      $('dock').hidden = spec.ui === false; $('aboutBtn').hidden = spec.ui === false; $('weatherPanel').hidden=true;
      const finder=document.querySelector('.animal-finder');if(finder)finder.hidden=spec.ui===false;
      const p = spec.pos ? spec : presets[spec.name];
      if (p) {
        fitFov();
        camera.position.set(...p.pos);
        controls.target.set(...p.target);
      } else {
        const v = (views[spec.name] || overview)();
        camera.position.copy(v.pos);
        controls.target.copy(v.target);
      }
      camera.lookAt(controls.target);
      if (spec.fov) { camera.fov = spec.fov; camera.updateProjectionMatrix(); }
      if (spec.time !== undefined) { hour = spec.time; atmo.setTime(spec.time, true); hud.setTime(spec.time); }
      renderer.toneMappingExposure = 0.9 + 0.5 * U.uNight.value;
      U.uDebug.value.fromArray(spec.debug || [0, 0, 0, 0]);
      simTime = spec.t ?? 12.0; U.uTime.value = simTime;
      weather.windDirection = [Math.cos(.56+Math.sin(simTime/95)*Math.PI/9), Math.sin(.56+Math.sin(simTime/95)*Math.PI/9)];
      atmo.nightSky.meteorStart=-10; atmo.nightSky.nextMeteor=simTime+30;
      const behaviorSeconds = spec.behaviorSeconds ?? Math.min(1200, spec.sim ?? 0) * .05;
      if (behaviorSeconds > 0) advanceSimulation(behaviorSeconds, { freezeWeather: true, render: false });
      updateBehavior(0);
      if (spec.info) hud.showInfo(spec.info);
      // Snapshot cameras must honor their requested pose, not silently clamp sky-facing views.
      const polarLimit = controls.maxPolarAngle;
      const distanceLimit = controls.maxDistance;
      if (spec.pos || spec.name === 'sky') { controls.maxPolarAngle = Math.PI; controls.maxDistance = Infinity; }
      controls.update();
      controls.maxPolarAngle = polarLimit; controls.maxDistance = distanceLimit;
      const frames = Math.min(8, spec.frames ?? 2);
      for (let i = 0; i < frames; i++) renderFrame();
      renderer.getContext().finish();
      await nextFrame();
      const info = renderer.info.render;
      return { calls: info.calls, tris: info.triangles, weather: weather.snapshot(), moonPhase: atmo.phase };
    },
  };
  const modelJobs = new Map();
  $('retryModels').addEventListener('click', () => {
    for (const [key, run] of modelJobs) if (ownerModelState.parts[key].status === 'failed') void run();
  });
  if(!params.has('proceduralModels')){
    const registerJob = (key, job) => {
      const run = async () => { ownerPart(key, 'loading', 0); await job(); };
      modelJobs.set(key, run);
      return run();
    };
    const loadPart=(key,files,attach,rollback=()=>{})=>registerJob(key,async()=>{
      const assets=[];
      try{for(const file of files)assets.push(await loadImportedAsset({url:import.meta.env.BASE_URL+'owner-models/'+file}));
        const count=await attach(...assets);ownerPart(key,'ready',count);
      }catch(e){rollback();for(const asset of assets)asset.dispose();ownerPart(key,'failed',0,String(e.message||e));console.warn('Owner '+key+' unavailable; procedural visual retained:',String(e.message||e));}
    });
    const startNative=(key,prepare)=>registerJob(key,async()=>{try{const count=await prepare();ownerPart(key,'ready',count);}catch(e){ownerPart(key,'failed',0,String(e.message||e));console.warn('Selected native '+key+' not ready:',String(e.message||e));}});
    const base=import.meta.env.BASE_URL+'owner-models/';
    void startNative('land',async()=>{const assets=await loadOwnerLandAssets({bear:base+'native/bear.glb',wolf:base+'native/wolf.glb',rhino:base+'native/rhino.glb',alligator:base+'derived/alligator-near.glb'});try{assets.elephant=await loadImportedAsset({url:base+'native/elephant.glb',loader:createImportedMaterialLoader()});nativeLand=createOwnerLandPack({hf,hash:animalObstacles,coverHash:canopy,assets,profiles:[...Object.values(OWNER_LAND_PROFILES),OWNER_ELEPHANT_PROFILE]});scene.add(nativeLand.group);fauna.group.visible=false;return nativeLand.agents.length;}catch(e){Object.values(assets).forEach(a=>a.dispose());throw e;}});
    void startNative('tiger',async()=>{const asset=await loadImportedAsset({url:base+'derived/tiger-near.glb'});try{nativeTiger=createOwnerLandPack({hf,hash:animalObstacles,coverHash:canopy,assets:{tiger:asset},profiles:[OWNER_LAND_TIGER_PROFILE],motionFactories:{tiger:createOwnerLandTigerFactory(hf)}});scene.add(nativeTiger.group);return nativeTiger.agents.length;}catch(e){asset.dispose();throw e;}});
    void startNative('seaPack',async()=>{const assets=await loadOwnerSeaAssets({whale:base+'native/whale.glb',school:base+'native/school.glb',fish:base+'native/fish.glb',coralFish:base+'native/coralFish.glb',turtle:base+'native/turtle.glb',shark:{near:base+'derived/shark-near.glb',far:base+'derived/shark-far.glb'},dolphin:{near:base+'derived/dolphin-near.glb',far:base+'derived/dolphin-far.glb'}});try{nativeSea=await createOwnerSeaPack({hf,assets,quality});scene.add(nativeSea.group);ownerLens.register(nativeSea.group);return nativeSea.getCandidates().length;}catch(e){for(const a of Object.values(assets)){a.near.dispose();a.far?.dispose();}throw e;}});
    void loadPart('eagles',['native/eagle.glb','derived/eagle-far.glb'],(asset,farAsset)=>{importedEagles=createOwnerEagles({birds,asset,farAsset,camera});return importedEagles.entries.length;},()=>{importedEagles?.dispose();importedEagles=null;});
    void loadPart('birds',['bird.glb'],asset=>{importedBirds=createImportedBirds({birds,asset});return importedBirds.entries.length;},()=>{importedBirds?.dispose();importedBirds=null;});
    void loadPart('manta',['manta.glb'],async asset=>{importedManta=await attachImportedManta({asset,entry:life.mantas});importedManta.reset();return 1;},()=>{importedManta?.dispose();importedManta=null;});
    void loadPart('tuna',['tuna.glb'],async asset=>{importedSwimmers=await attachImportedSwimmers({asset,entry:life.species.find(e=>e.key==='silver'),kind:'tuna',indices:[0,1]});return importedSwimmers.instances.length;},()=>{importedSwimmers?.dispose();importedSwimmers=null;});
  }
}

main().catch((e) => {
  console.error(e);
  const s = $('status');
  s.textContent = e && e.webgl
    ? 'This diorama needs WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari.'
    : 'Something went wrong while building the diorama. Reloading the page usually fixes it.';
  s.classList.add('err');
});
