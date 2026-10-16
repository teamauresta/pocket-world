// Spray rising from the waterfall's plunge pool. Drawn after the water, depth-tested against the opaque scene.
import * as THREE from 'three';
import { U } from '../render/shared.js';

export function buildMist(hf) {
  const f = hf.river.fall;
  const n = 110;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.4;
    const along = 0.6 + Math.random() * 1.6;
    pos[i * 3] = f.x + f.dir[0] * along + Math.cos(a) * r;
    pos[i * 3 + 1] = f.bottom + 0.1;
    pos[i * 3 + 2] = f.z + f.dir[1] * along + Math.sin(a) * r;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tDepth: { value: null }, uResolution: { value: new THREE.Vector2(1, 1) },
      uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() },
      uRain: U.uRain, uScale: { value: 400 }, uTime: U.uTime, uSunColor: U.uSunColor, uAmbient: U.uAmbient,
      uFallH: { value: f.top - f.bottom },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uRain; uniform float uScale; uniform float uFallH;
      varying float vA; varying float vDist;
      void main() {
        float life = fract(uTime * (1.0+uRain*2.0) * (0.16 + aSeed * 0.12) + aSeed * 7.0);
        vec3 p = position;
        p.y += life * uFallH * 0.55;
        p.x += sin(uTime * 0.7 + aSeed * 20.0) * 0.6 * life;
        p.z += cos(uTime * 0.6 + aSeed * 13.0) * 0.6 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.9 + life * 2.6) * uScale / -mv.z;
        vA = (1.0+uRain*.8)*smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life));
        vDist = length(mv.xyz);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDepth; uniform vec2 uResolution; uniform mat4 uProjInv; uniform mat4 uViewInv;
      uniform vec3 uSunColor; uniform vec3 uAmbient;
      varying float vA; varying float vDist;
      void main() {
        vec2 suv = gl_FragCoord.xy / uResolution;
        float d = texture2D(tDepth, suv).x;
        vec4 ndc = vec4(suv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        vec4 v = uProjInv * ndc; v /= v.w;
        float sceneDist = d >= 0.99999 ? 1e5 : length(v.xyz);
        float soft = smoothstep(0.0, 1.2, sceneDist - vDist);
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c)) * vA * soft * 0.28;
        if (a < 0.003) discard;
        gl_FragColor = vec4((uSunColor * 0.6 + uAmbient * 1.4), a);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  pts.name = 'mist';
  return pts;
}
