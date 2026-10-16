// Uniforms shared by every custom shader, and GLSL helpers.
import * as THREE from 'three';

export const U = {
  uCloud: { value: .05 }, uRain: { value: 0 }, uWet: { value: 0 }, uFog: { value: 0 },
  uFlash: { value: 0 }, uWindStrength: { value: .2 }, uWindGust: { value: 0 }, uWaves: { value: .2 },
  uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonPhase: { value: .35 }, uMoonIntensity: { value: 0 },
  uCelestialSun: { value: new THREE.Vector3(0, 1, 0) }, uReduced: { value: 0 },
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) }, // includes intensity
  uSkyZenith: { value: new THREE.Color(0.3, 0.5, 0.8) },
  uSkyHorizon: { value: new THREE.Color(0.7, 0.8, 0.9) },
  uAmbient: { value: new THREE.Color(0.4, 0.45, 0.5) },
  uNight: { value: 0 }, // 0 day .. 1 night
  uWind: { value: new THREE.Vector2(0.8, 0.5) },
  uWaterAbsorb: { value: new THREE.Vector3(0.085, 0.024, 0.017) },
  uDebug: { value: new THREE.Vector4(0, 0, 0, 0) },
};

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1, 0, 0)), n010 = hash13(i + vec3(0, 1, 0)), n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1)), n101 = hash13(i + vec3(1, 0, 1)), n011 = hash13(i + vec3(0, 1, 1)), n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }
  return s / 0.9375;
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise3(p); p = p * 2.02 + vec3(7.1, 3.3, 11.7); a *= 0.5; }
  return s / 0.9375;
}
// Voronoi edge distance, animated: small values on cell borders
float vorEdge(vec2 p, float t) {
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash22(ip + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    vec2 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
float causticsAt(vec2 p, float t) {
  float a = vorEdge(p, t * 0.9);
  float b = vorEdge(p * 1.37 + vec2(5.2, 1.3), t * 1.15 + 2.0);
  float e = min(a, b);
  return pow(1.0 - smoothstep(0.0, 0.2, e), 3.5);
}
`;

// Adds underwater light falloff and moving caustics to a MeshStandardMaterial-derived shader.
// Requires vWorldPos varying (added here) and U uniforms.
export function patchUnderwater(shader, { caustics = 1.0 } = {}) {
  shader.uniforms.uTime = U.uTime;
  shader.uniforms.uSunDir = U.uSunDir;
  shader.uniforms.uWaterAbsorb = U.uWaterAbsorb;
  shader.uniforms.uNight = U.uNight;
  shader.uniforms.uDebug = U.uDebug;
  if (!shader.vertexShader.includes('varying vec3 vWorldPos;')) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        {
          vec4 wp4 = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp4 = instanceMatrix * wp4;
          #endif
          vWorldPos = (modelMatrix * wp4).xyz;
        }`);
  }
  if (!shader.fragmentShader.includes('varying vec3 vWorldPos;')) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;');
  }
  if (!shader.fragmentShader.includes('float hash12(')) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_NOISE);
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uTime; uniform vec3 uSunDir; uniform vec3 uWaterAbsorb; uniform float uNight; uniform vec4 uDebug;`)
    .replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      {
        float uwDepth = max(0.0, -vWorldPos.y);
        float uw = smoothstep(0.0, 0.25, uwDepth);
        if (uw > 0.0) {
          vec2 cp = vWorldPos.xz - vWorldPos.y * uSunDir.xz / max(uSunDir.y, 0.25);
          float c = causticsAt(cp * 0.6, uTime * 1.1) * ${caustics.toFixed(3)} * (1.0 - uDebug.y);
          float fade = exp(-uwDepth * 0.13) * (1.0 - uNight * 0.85);
          reflectedLight.directDiffuse *= 1.0 + uw * c * 0.9 * fade;
          vec3 down = exp(-uWaterAbsorb * uwDepth * 0.6);
          reflectedLight.directDiffuse *= mix(vec3(1.0), down, uw);
          reflectedLight.directSpecular *= mix(vec3(1.0), down * 0.5, uw);
          reflectedLight.indirectDiffuse *= mix(vec3(1.0), sqrt(down), uw);
        }
      }`);
}

// Shared rain-ring normal perturbation. Low quality uses wider cells.
export const GLSL_RAIN = /* glsl */ `
uniform float uRain; uniform float uWet; uniform float uWaves; uniform float uWindStrength;
uniform float uFog; uniform float uFlash; uniform vec3 uMoonDir; uniform float uMoonIntensity;
uniform float uRippleScale;
vec2 rainNormal(vec2 p, float t) {
  p *= uRippleScale;
  vec2 cell = floor(p), q = fract(p) - .5;
  float seed = hash12(cell);
  float age = fract(t * .8 + seed * 7.0);
  vec2 off = (hash22(cell) - .5) * .3;
  float r = length(q - off);
  float ring = sin(32.0 * (r - age * .8)) * exp(-5.0 * age) * (1.0 - smoothstep(.35, .5, r));
  return normalize(q - off + .0001) * ring * .13 * uRain;
}
`;
export function publishWeather(w) {
  for (const [key, field] of Object.entries({ uCloud: 'cloud', uRain: 'rain', uWet: 'wet', uFog: 'fog', uFlash: 'flash', uWindStrength: 'wind', uWindGust: 'gust', uWaves: 'waves' })) U[key].value = w[field];
  U.uWind.value.fromArray(w.windDirection); U.uReduced.value = w.reducedMotion ? 1 : 0;
}
export function applyWet(material, leaf = false) {
  if (!material.isMeshStandardMaterial || material.userData.weatherWet) return;
  material.userData.weatherWet = true;
  const prev = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.uSurfaceWet = U.uWet;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSurfaceWet;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - uSurfaceWet * ' + (leaf ? '.12' : '.3') + ';')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(.12, roughnessFactor - uSurfaceWet * ' + (leaf ? '.25' : '.4') + ');');
  };
  material.customProgramCacheKey = () => key + 'weather-wet-' + leaf;
}
