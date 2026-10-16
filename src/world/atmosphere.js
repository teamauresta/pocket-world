// Sun, moon, sky-based environment light and the studio backdrop, all driven by the time of day.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunDirection, moonDirection, NightSky } from './night-sky.js';
import { U, GLSL_NOISE } from '../render/shared.js';
import { HALF } from './config.js';

const tmpC = new THREE.Color();
const lerpC = (a, b, t, out = new THREE.Color()) => out.copy(a).lerp(b, t);
// smoothstep that also works for falling ranges (a > b)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const backVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const backFrag = /* glsl */ `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uFloor; uniform vec3 uGlowDir; uniform vec3 uGlow; uniform float uStars;
uniform vec3 uCelestialSun; uniform vec3 uMoonDir; uniform float uMoonPhase; uniform float uCloud; uniform float uFlash; uniform float uTime; uniform mat3 uStarRotation;
${GLSL_NOISE}
varying vec3 vDir;
float h(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = mix(uMid, uTop, smoothstep(0.0, 0.75, y));
  c = mix(uFloor, c, smoothstep(-0.32, 0.06, y));
  float g = pow(max(dot(d, uGlowDir), 0.0), 3.0);
  c += uGlow * g;
  float visibility = 1.0 - smoothstep(.05, .9, uCloud);
  float sd = dot(d, uCelestialSun);
  float sun = smoothstep(cos(.036), cos(.033), sd) * smoothstep(-.012, .012, d.y) * step(0.0,uCelestialSun.y);
  vec3 sunTint = mix(vec3(1.0,.32,.08), vec3(1.0,.92,.72), smoothstep(0.0,.5,uCelestialSun.y));
  c += sunTint * (sun * 9.0 + pow(max(sd,0.0),24.0)*.6 + pow(max(sd,0.0),4.0)*.12) * visibility * smoothstep(-.04,.06,uCelestialSun.y);
  vec3 right = normalize(cross(vec3(0,1,0),uMoonDir)); vec3 up = cross(uMoonDir,right);
  vec2 q = vec2(dot(d,right),dot(d,up)) / .03; float r2 = dot(q,q);
  if(r2 < 1.0 && dot(d,uMoonDir) > .99 && uMoonDir.y > 0.0 && d.y > 0.0) {
    vec3 n = vec3(q,sqrt(1.0-r2));
    vec3 phaseLight = vec3(sin(uMoonPhase*6.283185),0.0,-cos(uMoonPhase*6.283185));
    float lit = smoothstep(-.05,.05,dot(n,phaseLight));
    float maria = .7 + .3 * fbm2(q*5.0+17.0);
    c += vec3(.65,.78,1.0) * (lit*2.4+.025) * maria * (1.0-smoothstep(.96,1.0,r2)) * visibility;
  }
  c += vec3(.08,.12,.2) * pow(max(dot(d,uMoonDir),0.0),160.0) * visibility * step(0.0,uMoonDir.y) * (1.0-cos(uMoonPhase*6.283185))*.5;
  vec3 starD = transpose(uStarRotation) * d;
  float band = exp(-pow(dot(starD,normalize(vec3(.866,.5,0.0)))/.18,2.0));
  float dust = fbm3(starD*12.0), clumps = fbm3(starD*35.0);
  c += mix(vec3(.055,.07,.11),vec3(.09,.075,.06),clumps) * band * smoothstep(.25,.75,dust) * uStars * (1.0-smoothstep(.05,.6,uCloud)) * smoothstep(0.0,.2,d.y);
  float clouds = fbm3(d*5.0+vec3(uTime*.003,0,0));
  vec3 slate = mix(vec3(.035,.045,.065), vec3(.24,.28,.32), 1.0-uStars) * (.7+.5*clouds);
  c = mix(c,slate,uCloud*.82);
  c += vec3(.6,.75,1.0)*uFlash*.18;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Atmosphere {
  constructor(renderer, scene, { shadowSize = 4096, quality = 'high' } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.hour = 16.5; this.phase = .35;
    this.nightSky = new NightSky(scene, quality);
    scene.fog = new THREE.FogExp2(0x657482, 0);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(shadowSize, shadowSize);
    const r = HALF * 1.5;
    s.camera.left = -r; s.camera.right = r; s.camera.top = r; s.camera.bottom = -r;
    s.camera.near = 10; s.camera.far = 420;
    s.bias = -0.00025;
    s.normalBias = 0.035;
    s.radius = 2.5;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd2e8, 0x5a5040, 0.35);
    scene.add(this.hemi);

    // backdrop
    this.backMat = new THREE.ShaderMaterial({
      uniforms: {
        ...U, uStarRotation: this.nightSky.stars.material.uniforms.uRotation,
        uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uFloor: { value: new THREE.Color() },
        uGlowDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() }, uGlow: { value: new THREE.Color() }, uStars: { value: 0 },
      },
      vertexShader: backVert, fragmentShader: backFrag, side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    this.backdrop = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.backMat);
    this.backdrop.scale.setScalar(1500);
    this.backdrop.renderOrder = -10;
    this.backdrop.frustumCulled = false;
    this.backdrop.name = 'backdrop';
    scene.add(this.backdrop);

    // sky for image-based lighting
    this.sky = new Sky();
    this.sky.scale.setScalar(1000);
    const su = this.sky.material.uniforms;
    su.turbidity.value = 3.2;
    su.rayleigh.value = 1.4;
    su.mieCoefficient.value = 0.004;
    su.mieDirectionalG.value = 0.8;
    if (su.showSunDisc) su.showSunDisc.value = 0;
    this.skyScene = new THREE.Scene();
    this.skyScene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.lastEnvSun = new THREE.Vector3(9, 9, 9);

    this.sunDir = new THREE.Vector3();
    this.setTime(this.hour, true);
  }

  // hour in [0, 24)
  sunDirection(hour, out = new THREE.Vector3()) {
    return sunDirection(hour, out);
  }

  moonDirection(hour, phase, out) { return moonDirection(hour, phase, out); }

  setTime(hour, force = false) {
    this.hour = ((hour % 24) + 24) % 24;
    const d = this.sunDirection(this.hour, this.sunDir);
    const el = Math.asin(d.y);
    const elDeg = THREE.MathUtils.radToDeg(el);
    const day = smooth(-6, 10, elDeg); // 0 night .. 1 day
    const golden = 1 - smooth(4, 26, elDeg);
    const night = smooth(2, -10, elDeg);

    // sun by day, moon by night; the swap happens in deep twilight when both are faint
    const sunWarm = new THREE.Color(1.0, 0.6, 0.34);
    const sunNoon = new THREE.Color(1.0, 0.96, 0.9);
    const sunCol = lerpC(sunNoon, sunWarm, golden);
    const moonDir = this.moonDirection(this.hour, this.phase);
    const illuminated = .5 * (1 - Math.cos(this.phase * Math.PI * 2));
    const moonAbove = smooth(0, .08, moonDir.y);
    const sunW = smooth(-5, 2, elDeg), moonW = smooth(-4, -12, elDeg);
    const useSun = sunW >= moonW;
    const lightDir = useSun ? d.clone() : moonDir;
    const sunI = 1.5 + 1.1 * smooth(0, 30, elDeg);
    const moonIntensity = 1.45 * moonW * (.25 + .75 * illuminated) * moonAbove;
    const intensity = (useSun ? sunI * sunW * smooth(0,.015,d.y) : moonIntensity) * (1 - .7 * U.uCloud.value);
    const lightCol = useSun ? sunCol : new THREE.Color(0.55, 0.68, 1.0);
    lightCol.lerp(new THREE.Color(.65,.7,.78), U.uCloud.value * .6);
    this.sun.color.copy(lightCol);
    this.sun.intensity = intensity + U.uFlash.value * 2.5;
    this.sun.shadow.intensity = 1 - .75 * U.uCloud.value;
    this.sun.position.copy(lightDir).multiplyScalar(200);
    this.sun.target.position.set(0, 0, 0);

    // hemisphere fill: cool sky by day, rosy in twilight, blue moonlight at night
    const twilight = Math.max(0, 1 - Math.abs(elDeg + 2) / 10);
    this.hemi.intensity = 0.22 + 0.08 * day + 0.32 * twilight + 0.2 * night + .1 * night * (1-moonAbove) + .08 * U.uCloud.value + 1.0 * U.uFlash.value;
    const skyDay = new THREE.Color(0xc4d8ec), skyTw = new THREE.Color(0xd8a0a0), skyNight = new THREE.Color(0x5a7cc4);
    this.hemi.color.copy(lerpC(lerpC(skyNight, skyDay, day), skyTw, twilight * 0.7));
    this.hemi.groundColor.copy(lerpC(new THREE.Color(0x1a2230), new THREE.Color(0x6a5d48), day));

    // shared uniforms
    U.uCelestialSun.value.copy(d); U.uMoonDir.value.copy(moonDir); U.uMoonPhase.value = this.phase;
    U.uMoonIntensity.value = moonIntensity * (1-.7*U.uCloud.value);
    U.uSunDir.value.copy(lightDir);
    U.uSunColor.value.copy(lightCol).multiplyScalar((intensity + U.uFlash.value * 2.5) / 3.0);
    U.uNight.value = night;
    U.uSkyZenith.value.copy(lerpC(new THREE.Color(0.03, 0.05, 0.11), lerpC(new THREE.Color(0.18, 0.36, 0.72), new THREE.Color(0.30, 0.30, 0.48), golden), day));
    U.uSkyHorizon.value.copy(lerpC(new THREE.Color(0.05, 0.07, 0.13), lerpC(new THREE.Color(0.62, 0.74, 0.86), new THREE.Color(0.95, 0.62, 0.42), golden * 0.9), day));
    U.uAmbient.value.copy(lerpC(new THREE.Color(0.06, 0.09, 0.17), new THREE.Color(0.30, 0.36, 0.42), day));

    // studio backdrop
    const bu = this.backMat.uniforms;
    bu.uTop.value.copy(lerpC(new THREE.Color(0.018, 0.028, 0.06), lerpC(new THREE.Color(0.34, 0.43, 0.52), new THREE.Color(0.40, 0.33, 0.36), golden), day));
    bu.uMid.value.copy(lerpC(new THREE.Color(0.03, 0.045, 0.085), lerpC(new THREE.Color(0.46, 0.53, 0.60), new THREE.Color(0.55, 0.42, 0.38), golden), day));
    bu.uFloor.value.copy(lerpC(new THREE.Color(0.01, 0.014, 0.025), lerpC(new THREE.Color(0.30, 0.33, 0.37), new THREE.Color(0.30, 0.25, 0.24), golden), day));
    bu.uGlowDir.value.copy(d);
    bu.uGlow.value.copy(lerpC(new THREE.Color(0.02, 0.03, 0.05), lerpC(new THREE.Color(0.10, 0.10, 0.09), new THREE.Color(0.35, 0.18, 0.08), golden), day));
    bu.uStars.value = smooth(0.4, 1.0, night);

    // environment map from the sky, regenerated only when the sun moved noticeably
    if (force || this.lastEnvSun.distanceTo(d) > 0.035) {
      this.updateEnvironment(d, day);
      this.lastEnvSun.copy(d);
    }
    this.scene.environmentIntensity = (.12 + .21 * day) * (1-.7*U.uCloud.value);
    this.scene.fog.density = .004 * U.uFog.value;
    for (const key of ['uSkyZenith', 'uSkyHorizon', 'uAmbient']) U[key].value.lerp(new THREE.Color(.07,.09,.12), U.uCloud.value * .65).addScalar(U.uFlash.value*.12);
  }

  updateEnvironment(d, day) {
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(d.y > -0.08 ? d : new THREE.Vector3(d.x, -0.08, d.z)).multiplyScalar(450000);
    su.rayleigh.value = 1.0 + 1.6 * (1 - day);
    const rt = this.pmrem.fromScene(this.skyScene, 0, 0.1, 2000, { size: 128 });
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  update(camera, weather = { reducedMotion: false, rain: 0, cloud: 0 }) {
    this.backdrop.position.copy(camera.position);
    this.nightSky.update(camera, this.hour, U.uTime.value, weather);
  }

  backdropColors() {
    return { top: this.backMat.uniforms.uTop.value, bottom: this.backMat.uniforms.uFloor.value };
  }
}
