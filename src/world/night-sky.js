import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { U } from '../render/shared.js';
export const wrapHour = h => ((h % 24) + 24) % 24;
// Continuous periodic orbit, preserving the baseline sunrise/sunset azimuth and 64 degree peak.
export function sunDirection(hour, out = new THREE.Vector3()) {
  const h = wrapHour(hour), day = (h - 6) / 12.6;
  const el = h >= 6 && h <= 18.6 ? Math.PI * 64 / 180 * Math.sin(Math.PI * day) : -Math.PI * 64 / 180 * Math.sin(Math.PI * (wrapHour(h - 18.6) / 11.4));
  const az = h >= 6 && h <= 18.6 ? (-70 + 190 * day) * Math.PI / 180 : (120 + 170 * wrapHour(h - 18.6) / 11.4) * Math.PI / 180;
  return out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
}
export function moonDirection(hour, phase, out = new THREE.Vector3()) {
  sunDirection(hour - phase * 24, out);
  const el = Math.asin(out.y) * 55 / 64, az = Math.atan2(out.z, out.x);
  return out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
}
export class NightSky {
  constructor(scene, quality) {
    const rng = mulberry32(921), n = quality === 'low' ? 1200 : 2500;
    const pos = [], col = [], mag = [];
    for (let i = 0; i < n; i++) {
      const y = rng() * 1.17 - .17, a = rng() * Math.PI * 2, r = Math.sqrt(1 - y * y);
      pos.push(r * Math.cos(a) * 1400, y * 1400, r * Math.sin(a) * 1400);
      const t = rng(); col.push(...(t < .15 ? [1, .72, .45] : t > .85 ? [.65, .8, 1] : [.9, .95, 1]));
      mag.push(Math.pow(10, -.4 * (i < 40 ? rng() * 2 : 3 + rng() * 3)), rng());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aMag', new THREE.Float32BufferAttribute(mag, 2));
    const mat = new THREE.ShaderMaterial({ uniforms: { ...U, uRotation: { value: new THREE.Matrix3() } }, transparent: false, depthTest: false, depthWrite: false,
      vertexShader: `attribute vec2 aMag; attribute vec3 color; uniform mat3 uRotation; uniform float uTime; uniform float uReduced; varying vec3 vColor; varying float vAlpha;
      void main(){ vec3 p = uRotation * position; vColor = color; vAlpha = (.25 + aMag.x * 2.0) * smoothstep(-.05, .2, p.y / 1400.0) * (1.0 - .25 * (1.0-uReduced) * sin(uTime * (2.0+aMag.y*5.0)+aMag.y*40.0)); gl_Position = projectionMatrix * viewMatrix * vec4(p + cameraPosition,1.0); gl_Position.z = gl_Position.w; gl_PointSize = 1.0 + 2.0 * sqrt(aMag.x); }`,
      fragmentShader: `uniform float uNight; uniform float uCloud; varying vec3 vColor; varying float vAlpha; void main(){ float a = (1.0-smoothstep(.1,.5,length(gl_PointCoord-.5))) * vAlpha * smoothstep(.35,.9,uNight) * (1.0-smoothstep(.05,.6,uCloud)); if(a<.005) discard; gl_FragColor=vec4(vColor*a,1.0); }`,
    });
    this.stars = new THREE.Points(g, mat); this.stars.renderOrder = -9; this.stars.frustumCulled = false; this.stars.name = 'stars'; scene.add(this.stars);
    // One additive ribbon; deterministic 20–50 second schedule, suppressed in wet/cloudy sky.
    const mg = new THREE.PlaneGeometry(1, 1);
    this.meteor = new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: { ...U, uAge: { value: 2 }, uRotation: mat.uniforms.uRotation }, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `uniform float uAge; uniform mat3 uRotation; varying vec2 vUv; void main(){vUv=uv; vec3 d=normalize(vec3(-.6+uAge*.55+(uv.x-.5)*.22,.55+(uv.y-.5)*.0015,.8)); gl_Position=projectionMatrix*viewMatrix*vec4(cameraPosition+uRotation*d*1300.0,1.0);gl_Position.z=gl_Position.w;}`,
      fragmentShader: `varying vec2 vUv; uniform float uAge; void main(){float a=pow(vUv.x,3.0)*sin(clamp(uAge,0.0,1.0)*3.14159); if(a<.001)discard;gl_FragColor=vec4(vec3(2.0,2.3,2.8)*a,1.0);}`,
    }));
    this.meteor.renderOrder = -8; this.meteor.frustumCulled = false; this.meteor.name = 'shooting-star'; scene.add(this.meteor);
    this.nextMeteor = 25; this.meteorStart = -10; this.rng = rng;
  }
  update(camera, hour, now, weather) {
    const rot = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(.3,.85,.43).normalize(), hour / 24 * Math.PI * 2);
    this.stars.material.uniforms.uRotation.value.setFromMatrix4(rot);
    if(now >= this.nextMeteor) { this.meteorStart = now; this.nextMeteor = now + 20 + this.rng()*30; }
    const age = now - this.meteorStart;
    this.meteor.material.uniforms.uAge.value = age / .8;
    this.meteor.visible = !weather.reducedMotion && weather.rain < .01 && weather.cloud < .2 && U.uNight.value > .9 && age < .8;
    this.stars.position.copy(camera.position);
  }
}
