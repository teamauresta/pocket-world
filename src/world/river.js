// River surface ribbons and the waterfall curtain. Both read the opaque scene's depth like the sea does.
import * as THREE from 'three';
import { U, GLSL_NOISE, GLSL_RAIN } from '../render/shared.js';

const SCREEN = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tDepth;
uniform vec2 uResolution; uniform mat4 uProjInv; uniform mat4 uViewInv;
vec3 worldFromDepth(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * ndc; v /= v.w;
  return (uViewInv * v).xyz;
}
float sceneDist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return d >= 0.99999 ? 1e5 : length(worldFromDepth(uv, d) - cameraPosition);
}`;

const riverVert = /* glsl */ `
attribute float aSlope; attribute float aArc; attribute float aEdge;
varying vec3 vWorld; varying vec2 vFlow; varying float vSlope; varying float vEdge;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz; vFlow = vec2(uv.x, aArc); vSlope = aSlope; vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const riverFrag = /* glsl */ `
${SCREEN}
uniform sampler2D tNormal; uniform float uTime; uniform float uNight;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon; uniform vec3 uAmbient;
varying vec3 vWorld; varying vec2 vFlow; varying float vSlope; varying float vEdge;
${GLSL_NOISE}
${GLSL_RAIN}
void main() {
  vec3 V = vWorld - cameraPosition;
  float distSurf = length(V);
  vec3 rd = V / distSurf;
  vec2 suv = gl_FragCoord.xy / uResolution;
  float dScene = sceneDist(suv);
  if (dScene < distSurf - 0.25) discard;
  float contact = smoothstep(-0.25, 0.3, dScene - distSurf);
  vec3 base = texture2D(tScene, suv).rgb;
  float speed = (.5 + min(vSlope,.6)*9.0)*(1.0+.6*uRain);
  vec2 f1 = vec2(vFlow.x * 0.7, vFlow.y * 0.22 - uTime * speed * 0.22);
  vec2 f2 = vec2(vFlow.x * 1.3 + 0.37, vFlow.y * 0.41 - uTime * speed * 0.37);
  vec3 a = texture2D(tNormal, f1).rgb * 2.0 - 1.0;
  vec3 b = texture2D(tNormal, f2).rgb * 2.0 - 1.0;
  vec3 n = normalize(vec3((a.x + b.x) * 0.28, 1.0, (a.y + b.y) * 0.28));
  n = normalize(n + vec3(rainNormal(vWorld.xz,uTime).x,0.0,rainNormal(vWorld.xz,uTime).y));
  vec2 off = n.xz * 0.02 * (40.0 / max(distSurf, 40.0));
  vec2 ruv = suv + off;
  float d1 = sceneDist(ruv);
  if (d1 < distSurf) { ruv = suv; d1 = dScene; }
  float thick = clamp(d1 - distSurf, 0.0, 30.0);
  vec3 sceneCol = texture2D(tScene, ruv).rgb;
  float sunUp = clamp(uSunDir.y * 1.6, 0.0, 1.0);
  vec3 lightIn = uSunColor * (0.2 + 0.8 * sunUp) * 0.5 + uAmbient;
  vec3 col = sceneCol * exp(-vec3(0.45, 0.16, 0.14) * thick) + vec3(0.03, 0.22, 0.20) * lightIn * (1.0 - exp(-0.35 * thick));
  col = mix(col,col*vec3(1.15,1.02,.8),uRain*.4);
  float cosT = clamp(dot(-rd, n), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(rd, n);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.6, R.y));
  float sd = max(dot(R, uSunDir), 0.0);
  col = mix(col, sky, F) + uSunColor * (pow(sd, 700.0) * 10.0 + pow(sd, 90.0) * 0.4) * (1.0 - uNight);
  // whitewater on rapids and along the banks
  float streak = vnoise(vec2(vFlow.x * 6.0, vFlow.y * 1.4 - uTime * speed * 1.2)) * 0.65 + vnoise(vec2(vFlow.x * 15.0, vFlow.y * 3.5 - uTime * speed * 2.0)) * 0.35;
  float rapids = smoothstep(0.3, 0.7, vSlope);
  float bank = smoothstep(0.32, 0.5, abs(vFlow.x - 0.5));
  float foam = smoothstep(0.62, 0.9, streak + rapids * 0.3 + bank * 0.15) * (0.2 + 0.8 * max(rapids, bank * 0.35));
  foam += smoothstep(0.6, 0.9, streak) * smoothstep(0.0, -2.0, -vEdge) * 0.0;
  col = mix(col, uSunColor * sunUp * 0.6 + uAmbient * 1.4, clamp(foam, 0.0, 1.0) * 0.85);
  col = mix(base, col, contact);
  gl_FragColor = vec4(col, 1.0);
}`;

const fallVert = /* glsl */ `
varying vec3 vWorld; varying vec2 vUv;
uniform float uTime;
void main() {
  vUv = uv;
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const fallFrag = /* glsl */ `
${SCREEN}
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uAmbient; uniform vec3 uSunDir; uniform float uNight;
varying vec3 vWorld; varying vec2 vUv;
${GLSL_NOISE}
void main() {
  float distSurf = length(vWorld - cameraPosition);
  vec2 suv = gl_FragCoord.xy / uResolution;
  if (sceneDist(suv) < distSurf - 0.2) discard;
  float x = vUv.x, y = vUv.y; // y: 0 top -> 1 bottom
  float s1 = vnoise(vec2(x * 22.0, y * 2.5 - uTime * 2.6));
  float s2 = vnoise(vec2(x * 48.0 + 3.0, y * 5.0 - uTime * 4.2));
  float streaks = s1 * 0.6 + s2 * 0.4;
  float edge = smoothstep(0.0, 0.16, x) * smoothstep(1.0, 0.84, x);
  float alpha = edge * smoothstep(0.25, 0.75, streaks * 0.8 + 0.25 + y * 0.25) * smoothstep(0.0, 0.06, y);
  float white = smoothstep(0.45, 0.95, streaks + y * 0.35);
  float sunUp = clamp(uSunDir.y * 1.6, 0.0, 1.0);
  vec3 light = uSunColor * (0.35 + 0.65 * sunUp) * 0.7 + uAmbient * 1.3;
  vec3 col = mix(vec3(0.16, 0.38, 0.42), vec3(0.95), white) * light;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.96));
}`;

function screenUniforms(normalTex) {
  return {
    ...U, uRippleScale: { value: 1.25 },
    tScene: { value: null }, tDepth: { value: null }, tNormal: { value: normalTex },
    uResolution: { value: new THREE.Vector2(1, 1) }, uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() },
    uTime: U.uTime, uNight: U.uNight, uSunDir: U.uSunDir, uSunColor: U.uSunColor,
    uSkyZenith: U.uSkyZenith, uSkyHorizon: U.uSkyHorizon, uAmbient: U.uAmbient,
  };
}

function ribbon(points, w0, w1, stopAtSea, hf = null) {
  const pos = [], uv = [], slope = [], arc = [], edge = [], idx = [];
  let acc = 0;
  let count = 0;
  for (let k = 0; k < points.length; k++) {
    const p = points[k];
    const a = points[Math.max(0, k - 1)], b = points[Math.min(points.length - 1, k + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    const t = k / (points.length - 1);
    const nominal = w0 + (w1 - w0) * t;
    const w = hf ? nominal * (1 + .15*hf.noise.noise2(p.x*.3,p.z*.3)) + .18 : nominal + .35;
    if (k > 0) acc += Math.hypot(p.x - points[k - 1].x, p.z - points[k - 1].z);
    const y = Math.max(p.level, 0.0) + 0.04;
    const s = Math.max(0, (a.level - b.level) / Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z)));
    pos.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
    uv.push(0, 0, 1, 0);
    slope.push(s, s);
    arc.push(acc, acc);
    edge.push(p.level, p.level);
    if (count > 0) {
      const i = (count - 1) * 2;
      idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
    count++;
    if (stopAtSea && p.level < -0.02) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSlope', new THREE.Float32BufferAttribute(slope, 1));
  g.setAttribute('aArc', new THREE.Float32BufferAttribute(arc, 1));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildRiver(hf, normalTex, { releasePolish = false } = {}) {
  const r = hf.river;
  const group = new THREE.Group();
  group.name = 'river';
  const mat = new THREE.ShaderMaterial({
    uniforms: screenUniforms(normalTex), vertexShader: riverVert, fragmentShader: releasePolish ? detailedRiverFrag : riverFrag,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  const down = new THREE.Mesh(ribbon(r.down, ...r.downWidth, true, releasePolish ? hf : null), mat);
  down.frustumCulled = false;
  down.renderOrder = 1;
  down.name = 'river-downstream';
  group.add(down);
  if (releasePolish) {
    // The carved upstream channel already exists. Previously it had no water!
    const sourceMat=mat.clone();sourceMat.uniforms=mat.uniforms;
    sourceMat.fragmentShader=sourceRiverFrag;sourceMat.transparent=true;
    sourceMat.uniforms.uSourceLength={value:r.up.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-r.up[i-1].x,p.z-r.up[i-1].z):0,0)};
    const up = new THREE.Mesh(ribbon(r.up,...r.upWidth,false,hf),sourceMat);
    up.name='river-source-reach';up.renderOrder=1;up.frustumCulled=false;group.add(up);
  }

  // waterfall curtain arcing from the ledge into the pool
  const fallMat = new THREE.ShaderMaterial({
    uniforms: screenUniforms(normalTex), vertexShader: fallVert, fragmentShader: releasePolish ? detailedFallFrag : fallFrag,
    depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  });
  const cols = 10, rows = 24, width = 1.7;
  const f = r.fall;
  const dir = new THREE.Vector2(f.dir[0], f.dir[1]);
  const side = new THREE.Vector2(-dir.y, dir.x);
  const pos = [], uv = [], idx = [];
  const startBack = releasePolish ? 0 : -0.6;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const y = f.top + 0.05 - (f.top - f.bottom + 0.15) * t;
    const out = startBack + (releasePolish ? 1.8*t+.6*t*t : .9*t+.6*t*t);
    for (let i = 0; i <= cols; i++) {
      const s = i / cols - 0.5;
      const ww = width * (1 + 0.55 * t) * (releasePolish ? 1 + .065*Math.sin(t*13) : 1);
      const x = f.x + dir.x * out + side.x * s * ww;
      const z = f.z + dir.y * out + side.y * s * ww;
      pos.push(x, y, z);
      uv.push(i / cols, t);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fg.setIndex(idx);
  const fall = new THREE.Mesh(fg, fallMat);
  fall.frustumCulled = false;
  fall.renderOrder = 2;
  fall.name='waterfall';group.add(fall);
  if (releasePolish) {
    const g = new THREE.PlaneGeometry(4.2,4.2,1,1); g.rotateX(-Math.PI/2);
    g.translate(r.pool.x,f.bottom+.055,r.pool.z);
    const impactMat=new THREE.ShaderMaterial({uniforms:screenUniforms(normalTex),vertexShader:fallVert,fragmentShader:impactFrag,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const impact=new THREE.Mesh(g,impactMat);impact.name='fall-impact';impact.renderOrder=2;impact.frustumCulled=false;group.add(impact);
    group.userData.impactMaterial=impactMat;
  }

  group.userData.materials = [mat, fallMat, ...(releasePolish ? [group.userData.impactMaterial] : [])];
  return group;
}

// Features advect toward increasing path arc (downstream), with spatially
// localized rapids. No repeating transverse white ladder or bank foam wall.
const detailedRiverFrag = riverFrag
  .replace('pow(sd, 700.0) * 10.0', 'pow(sd, 700.0) * 1.25')
  .replace('float rapids = smoothstep(0.3, 0.7, vSlope);',
    'float rapids = smoothstep(.025,.24,vSlope)*(0.30+0.70*smoothstep(.40,.75,vnoise(vec2(vFlow.y*.32,2.7))));')
  .replace('float foam = smoothstep(0.62, 0.9, streak + rapids * 0.3 + bank * 0.15) * (0.2 + 0.8 * max(rapids, bank * 0.35));',
    'float flowThread = pow(max(0.0,sin(vFlow.x*39.0+vnoise(vec2(vFlow.y*.16,2.0))*3.0)),10.0)*smoothstep(.55,.83,vnoise(vec2(vFlow.x*7.0,vFlow.y*.8-uTime*speed*.8))); float foam = smoothstep(.60,.88,streak+rapids*.22)*(.08+.48*rapids+bank*.07)+flowThread*(.035+.14*rapids);');

const sourceRiverFrag = detailedRiverFrag
  .replace('uniform sampler2D tNormal;', 'uniform float uSourceLength; uniform sampler2D tNormal;')
  .replace('col = mix(col, sky, F)', 'col = mix(col, sky, F*.23)')
  .replace('gl_FragColor = vec4(col, 1.0);', 'float lipFade=1.0-smoothstep(uSourceLength-.42,uSourceLength,vFlow.y); gl_FragColor = vec4(col, bankFade*.80*lipFade);')
  .replace('float contact = smoothstep(-0.25, 0.3, dScene - distSurf);',
    'float bankFade = smoothstep(.0,.17,vFlow.x)*(1.0-smoothstep(.83,1.0,vFlow.x)); float contact = smoothstep(-.25,.3,dScene-distSurf)*bankFade;')
  .replace('(.08+.48*rapids+bank*.07)+flowThread*(.035+.14*rapids)',
    '(.04+.17*rapids+bank*.03)+flowThread*(.025+.05*rapids)');

const detailedFallFrag = fallFrag
  .replace('float x = vUv.x, y = vUv.y;', 'float x = vUv.x + sin(vUv.y*12.0+uTime*1.7)*.014*vUv.y, y = vUv.y;')
  .replace('float edge = smoothstep(0.0, 0.16, x) * smoothstep(1.0, 0.84, x);',
    'float edge = smoothstep(.01,.18,x)*(1.0-smoothstep(.82,.99,x)); float strands = .30+.70*smoothstep(.23,.63,vnoise(vec2(x*21.0, y*.65))); edge *= strands*(.60+.40*smoothstep(.2,.65,vnoise(vec2(x*33.0,1.7))));')
  .replace('vec3(0.95)', 'vec3(.66,.73,.71)')
  .replace('clamp(alpha, 0.0, 0.96)', 'clamp(alpha*.62, 0.0, .67)')
  .replace('float alpha = edge *', 'float breakup = .58+.42*smoothstep(.27,.66,vnoise(vec2(x*33.0,y*7.0-uTime*3.5))); float alpha = edge * breakup *')
  .replace('vec3(0.16, 0.38, 0.42)', 'vec3(.10,.22,.23)');

const impactFrag = /* glsl */ `
${SCREEN}
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uAmbient;
varying vec3 vWorld; varying vec2 vUv;
${GLSL_NOISE}
void main(){
  float d=length(vWorld-cameraPosition);vec2 suv=gl_FragCoord.xy/uResolution;
  if(sceneDist(suv)<d-.12) discard;
  vec2 p=(vUv-.5)*2.0;float r=length(p);
  float n=vnoise(p*8.0-vec2(uTime*.7,uTime*.4));
  float ring=pow(max(0.0,sin(r*27.0-uTime*5.0+n*2.0)),5.0);
  float mask=(1.0-smoothstep(.38,1.0,r))*smoothstep(.08,.25,r);
  float foam=(.07+.25*ring)*mask*smoothstep(.25,.62,n);
  gl_FragColor=vec4(vec3(.62,.70,.65)*(uSunColor*.55+uAmbient),foam);
}`;

/** Opt-in tuning of the existing mist, never a duplicate particle emitter.
 * Call once after buildMist(hf), before the first render. Keeps shared time,
 * screen-depth uniforms and 110 particles; deterministic placement fixes A/B.
 */
export function configureRiverMist(mist,hf,{releasePolish=false}={}) {
  if(!releasePolish || mist.userData.releaseLandscape) return mist;
  const f=hf.river.fall,p=mist.geometry.attributes.position,seed=mist.geometry.attributes.aSeed;
  for(let i=0;i<p.count;i++) {
    const a=i*2.39996323,r=Math.sqrt((i+.5)/p.count)*.95;
    p.setXYZ(i,hf.river.pool.x+Math.cos(a)*r,f.bottom+.10,hf.river.pool.z+Math.sin(a)*r);
    seed.setX(i,((i*73)%p.count)/p.count);
  }
  p.needsUpdate=true;seed.needsUpdate=true;
  mist.material.vertexShader=mist.material.vertexShader
    .replace('life * uFallH * 0.55','life * min(uFallH * .14, 1.25)')
    .replace('(0.9 + life * 2.6)','(0.30 + life * .95)');
  mist.material.fragmentShader=mist.material.fragmentShader.replace('soft * 0.28','soft * 0.075');
  mist.material.needsUpdate=true;mist.userData.releaseLandscape=true;
  return mist;
}
