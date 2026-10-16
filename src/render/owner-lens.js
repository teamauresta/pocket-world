// Reuse the island's resolved colour instead of Three's second opaque pass.
// Deliberately restricted to the owner's zero-thickness single-material cornea.
import * as THREE from 'three';

export class OwnerLens {
  constructor(scene, { layer = 30 } = {}) {
    if (!scene?.isScene || !Number.isInteger(layer) || layer < 1 || layer > 31) throw new TypeError('OwnerLens requires Scene and reserved layer 1..31');
    this.scene = scene;
    this.layer = layer;
    this.entries = [];
    this.disposed = false;
    this.uniforms = {
      ownerOpaque: { value: null }, ownerDepth: { value: null },
      ownerSize: { value: new THREE.Vector2(1, 1) },
    };
  }

  register(root) {
    if (this.disposed) throw new Error('OwnerLens disposed');
    const matches = [];
    this.scene.traverse(o => {
      if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.layers.isEnabled(this.layer) && !this.entries.some(e => e.mesh === o)) {
        throw new Error('OwnerLens reserved layer collision');
      }
    });
    root.traverse(o => {
      if (!o.isMesh || Array.isArray(o.material) || o.material?.name !== 'Outer_eye') return;
      if (this.entries.some(e => e.mesh === o)) return;
      const m = o.material;
      if (!m.isMeshPhysicalMaterial || m.transmission <= 0 || m.thickness !== 0 || m.transmissionMap || m.thicknessMap || m.dispersion > 0) {
        throw new Error('OwnerLens accepts only zero-thickness Outer_eye without volume maps/dispersion');
      }
      matches.push(o);
    });
    for (const mesh of matches) {
      const source = mesh.material, material = source.clone();
      // Render-list classification only. The shader STILL evaluates the original
      // physical transmission, IOR, specular and clearcoat equations.
      material.transmission = 0;
      material.defines = { ...material.defines, USE_TRANSMISSION: '' };
      material.onBeforeCompile = (shader, renderer) => {
        source.onBeforeCompile.call(material, shader, renderer);
        Object.assign(shader.uniforms, this.uniforms, {
          transmissionSamplerSize: this.uniforms.ownerSize,
          transmission: { value: source.transmission }, thickness: { value: source.thickness },
          attenuationDistance: { value: source.attenuationDistance },
          attenuationColor: { value: source.attenuationColor.clone() },
        });
        const pars = THREE.ShaderChunk.transmission_pars_fragment.replace(
          'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );',
          'return textureBicubic( ownerOpaque, fragCoord.xy, lod );'
        );
        shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>',
          'uniform sampler2D ownerOpaque; uniform sampler2D ownerDepth; uniform vec2 ownerSize;\n' + pars);
        // Composer does not inherit the opaque target's depth. Compare resolved
        // scene depth explicitly; never sample the currently written attachment.
        shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nif (gl_FragCoord.z > texture2D(ownerDepth, gl_FragCoord.xy / ownerSize).r + 0.0000002) discard;');
      };
      material.customProgramCacheKey = () => 'owner-thin-lens-v1:' + source.customProgramCacheKey();
      this.entries.push({ mesh, source, material, mask: mesh.layers.mask });
      // Keep the real object, parent, skeleton, morphs and world matrix. No proxy
      // reparenting, no duplicate geometry, no mutation of the shared original.
      mesh.material = material;
      mesh.layers.set(this.layer);
    }
    return matches.length;
  }

  render(renderer, camera, opaqueTarget) {
    if (this.disposed || !this.entries.length) return;
    if (renderer.getRenderTarget() === opaqueTarget) throw new Error('OwnerLens feedback: destination must differ from opaque target');
    if (camera.layers.isEnabled(this.layer)) throw new Error('OwnerLens normal camera must exclude reserved layer');
    if (!opaqueTarget.depthTexture) throw new Error('OwnerLens requires resolved opaque depth');
    const mask = camera.layers.mask, background = this.scene.background;
    const autoClear = renderer.autoClear, shadowUpdate = renderer.shadowMap.autoUpdate;
    const lights = [];
    // Retain the SAME scene lights, light targets and already rendered shadows.
    this.scene.traverse(o => { if (o.isLight && o.layers.test(camera.layers)) { lights.push([o, o.layers.mask]); o.layers.enable(this.layer); } });
    this.uniforms.ownerOpaque.value = opaqueTarget.texture;
    this.uniforms.ownerDepth.value = opaqueTarget.depthTexture;
    this.uniforms.ownerSize.value.set(opaqueTarget.width, opaqueTarget.height);
    try {
      camera.layers.set(this.layer);
      this.scene.background = null;
      renderer.autoClear = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.render(this.scene, camera);
    } finally {
      camera.layers.mask = mask;
      this.scene.background = background;
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      for (const [light, old] of lights) light.layers.mask = old;
    }
  }

  dispose() {
    if (this.disposed) return;
    for (const e of this.entries) {
      if (e.mesh.material === e.material) e.mesh.material = e.source;
      e.mesh.layers.mask = e.mask;
      e.material.dispose();
    }
    this.entries.length = 0;
    this.disposed = true;
  }
}
