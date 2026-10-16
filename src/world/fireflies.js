// Fireflies that drift over the meadow, the riverbanks and the jungle clearing after dusk.
import * as THREE from 'three';
import { U } from '../render/shared.js';
import { GLADES, fromDE } from './config.js';
import { mulberry32 } from '../core/noise.js';

export function buildFireflies(hf, count = 260) {
  const rng = mulberry32(99);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  let n = 0;
  for (let tries = 0; n < count && tries < count * 40; tries++) {
    const g = GLADES[Math.floor(rng() * GLADES.length)];
    const [gx, gz] = fromDE(g.d, g.e);
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * g.r * 1.6;
    const x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r;
    const h = hf.heightAt(x, z);
    if (h < 0.8) continue;
    pos[n * 3] = x; pos[n * 3 + 1] = h + 0.6 + rng() * 2.6; pos[n * 3 + 2] = z;
    seed[n] = rng();
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, n * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed.slice(0, n), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNight: U.uNight, uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uScale; uniform float uNight;
      varying float vGlow;
      void main() {
        vec3 p = position;
        float t = uTime * (0.25 + aSeed * 0.2) + aSeed * 40.0;
        p += vec3(sin(t * 1.3) * 1.2, sin(t * 0.9 + 1.0) * 0.5, cos(t * 1.1) * 1.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = smoothstep(0.55, 1.0, sin(uTime * (1.4 + aSeed * 1.7) + aSeed * 30.0));
        vGlow = blink * smoothstep(0.35, 0.9, uNight);
        gl_PointSize = max(1.5, 0.32 * uScale / -mv.z) * (0.6 + 0.4 * blink);
      }`,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        if (vGlow * a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.6, 2.2, 0.5) * vGlow * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.name = 'fireflies';
  return pts;
}
