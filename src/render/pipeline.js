// Render pipeline: opaque scene (MSAA, depth texture) -> sea composite -> depth of field -> bloom -> tone mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const copyMat = () => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }',
  depthTest: false, depthWrite: false,
});

class IslandPass extends Pass {
  constructor(scene, seaScene, camera, samples, ownerLens = null) {
    super();
    this.scene = scene;
    this.ownerLens = ownerLens;
    this.lensRT = null;
    this.seaScene = seaScene;
    this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.rt.texture.name = 'opaque';
    this.copy = new FullScreenQuad(copyMat());
    this.needsSwap = true;
    this.clear = true;
  }
  setSize(w, h) { this.rt.setSize(w, h); this.lensRT?.setSize(w, h); }
  render(renderer, writeBuffer) {
    if (this.ownerLens?.entries.length && !this.rt.texture.generateMipmaps) {
      this.rt.texture.generateMipmaps = true;
      this.rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
      this.rt.dispose(); // Reallocate immutable texture storage with mip levels.
    }
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    // Optional lens pass: separate MSAA destination, never read/write feedback.
    // Copy back only AFTER resolving, so water samples the lens-inclusive image.
    if (this.ownerLens?.entries.length) {
      if (!this.lensRT) this.lensRT = new THREE.WebGLRenderTarget(this.rt.width, this.rt.height, { type: THREE.HalfFloatType, samples: this.rt.samples });
      renderer.setRenderTarget(this.lensRT);
      renderer.clear();
      this.copy.material.uniforms.tDiffuse.value = this.rt.texture;
      this.copy.render(renderer);
      this.ownerLens.render(renderer, this.camera, this.rt);
      renderer.setRenderTarget(this.rt);
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      try {
        this.copy.material.uniforms.tDiffuse.value = this.lensRT.texture;
        this.copy.render(renderer);
      } finally { renderer.autoClear = ac; }
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.copy.material.uniforms.tDiffuse.value = this.rt.texture;
    this.copy.render(renderer);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.seaScene, this.camera);
    renderer.autoClear = ac;
  }
  dispose() { this.rt.dispose(); this.lensRT?.dispose(); this.copy.material.dispose(); this.copy.dispose(); }
}

const DofShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 1 },
    uFar: { value: 1000 },
    uFocus: { value: 150 },
    uScale: { value: 6 },
    uMaxBlur: { value: 7 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uTexel;
    uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uScale; uniform float uMaxBlur;
    varying vec2 vUv;
    float lin(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(d, uNear, uFar);
    }
    float blurSize(float z) {
      float c = abs(1.0 / uFocus - 1.0 / z) * uScale * uFocus;
      return clamp(c * c * 0.5 + c * 0.5, 0.0, uMaxBlur);
    }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float z0 = lin(vUv);
      float s0 = blurSize(z0);
      float tot = 1.0;
      float radius = 0.7;
      float ang = 0.0;
      for (int i = 0; i < 64; i++) {
        if (radius >= uMaxBlur) break;
        vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
        vec3 sc = texture2D(tDiffuse, tc).rgb;
        float z = lin(tc);
        float ss = blurSize(z);
        if (z > z0) ss = clamp(ss, 0.0, s0 * 2.0);
        float m = smoothstep(radius - 0.5, radius + 0.5, ss);
        col += mix(col / tot, sc, m);
        tot += 1.0;
        radius += 0.85 / radius;
        ang += 2.39996323;
      }
      gl_FragColor = vec4(col / tot, 1.0);
    }`,
};

export class Pipeline {
  constructor(renderer, scene, seaScene, camera, { samples = 4, bloom = true, ownerLens = null } = {}) {
    this.renderer = renderer;
    this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, rt);
    this.island = new IslandPass(scene, seaScene, camera, samples, ownerLens);
    this.composer.addPass(this.island);
    this.dof = new ShaderPass(DofShader);
    this.dof.uniforms.tDepth.value = this.island.rt.depthTexture;
    this.composer.addPass(this.dof);
    if (bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 1.15);
      this.composer.addPass(this.bloom);
    }
    this.output = new OutputPass();
    this.composer.addPass(this.output);
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.dof.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.width = W; this.height = H;
  }

  updateSea(seaMat) {
    const u = seaMat.uniforms;
    if (u.tScene) u.tScene.value = this.island.rt.texture;
    if (u.tDepth) u.tDepth.value = this.island.rt.depthTexture;
    if (u.uResolution) u.uResolution.value.set(this.width, this.height);
    if (u.uProjInv) u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    if (u.uViewInv) u.uViewInv.value.copy(this.camera.matrixWorld);
    if (u.uScale) u.uScale.value = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }

  render(focusDist) {
    const d = this.dof.uniforms;
    d.uNear.value = this.camera.near;
    d.uFar.value = this.camera.far;
    d.uFocus.value = focusDist;
    // blur scales with output resolution so the look is the same on every screen
    d.uMaxBlur.value = Math.max(3, Math.round(this.height / 150));
    d.uScale.value = this.height / 300;
    this.composer.render();
  }
}
