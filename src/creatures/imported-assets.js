/** Owner model staging API. Deliberately not imported by the main scene.
 * No inferred locomotion, retargeting, URL, license grant, or procedural fallback.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export const MODEL_BUDGETS = Object.freeze({ near: 20000, far: 5000 });
export function triangleBudget(triangles) {
  if (!Number.isFinite(triangles) || triangles < 0) throw new Error('Invalid triangle count');
  return { triangles, near: triangles < MODEL_BUDGETS.near, far: triangles < MODEL_BUDGETS.far };
}

/** Catalog clones measured input metadata; never infers behavior from filenames. */
export function createModelCatalog(records) {
  const catalog = new Map();
  for (const record of records) {
    if (!record.file || catalog.has(record.file)) throw new Error('Missing or duplicate model file');
    const row = structuredClone(record);
    row.budget = triangleBudget(row.triangles);
    row.animationStatus = row.clips?.length ? 'authored-clips-require-behavior-review' : 'static';
    row.license = row.asset?.extras?.license || 'unknown';
    catalog.set(row.file, row);
  }
  return catalog;
}

function resources(root) {
  const geometry = new Set(), material = new Set(), texture = new Set(), skeleton = new Set();
  root.traverse(o => {
    if (o.geometry) geometry.add(o.geometry);
    if (o.skeleton) skeleton.add(o.skeleton);
    for (const m of [o.material].flat().filter(Boolean)) {
      material.add(m);
      for (const t of Object.values(m)) if (t?.isTexture) texture.add(t);
    }
  });
  return { geometry, material, texture, skeleton };
}
function disposeResources(root) {
  const r = resources(root);
  for (const group of Object.values(r)) for (const item of group) item.dispose();
}

/** Reject unsupported required material extension rather than silently bleaching the asset.
 * Caller may supply a GLTFLoader with a qualified extension plugin. No approximations here.
 */
export async function loadImportedAsset({ url, loader = new GLTFLoader(), allowUnsupported = false } = {}) {
  if (typeof url !== 'string' || !url) throw new Error('Explicit model URL required');
  const gltf = await loader.loadAsync(url);
  const required = gltf.parser?.json?.extensionsRequired || [];
  const unsupported = required.filter(name => !gltf.parser.extensions?.[name] && !gltf.parser.plugins?.[name]);
  if (unsupported.length && !allowUnsupported) {
    disposeResources(gltf.scene);
    throw new Error('Unsupported required glTF extensions: ' + unsupported.join(', '));
  }
  return createImportedAsset(gltf, { url, unsupported });
}

/** Asset owns shared geometry/materials/textures; instances own cloned skeletons/mixers.
 * Disposing an asset closes it to new instances and defers shared cleanup until all live
 * instances are disposed. Instances must not mutate/dispose shared authored materials.
 */
export function createImportedAsset(gltf, provenance = {}) {
  if (!gltf?.scene) throw new Error('A loaded glTF scene is required');
  const clips = gltf.animations || [], names = new Set();
  for (const clip of clips) {
    if (!clip.name || names.has(clip.name)) throw new Error('Clips require unique explicit names');
    names.add(clip.name);
  }
  let closed = false, released = false;
  const instances = new Set();
  const release = () => { if (closed && !instances.size && !released) { released = true; disposeResources(gltf.scene); } };
  return {
    provenance, clips: clips.map(c => ({ name: c.name, duration: c.duration })),
    instantiate({ size = 2, align = 'ground', rotation = [0, 0, 0], referenceClip = null } = {}) {
      if (closed) throw new Error('Asset disposed');
      if (!Number.isFinite(size) || size <= 0 || !['ground', 'center'].includes(align) || rotation.length !== 3 || !rotation.every(Number.isFinite)) throw new Error('Invalid normalization options');
      const model = cloneSkeleton(gltf.scene), orientation = new THREE.Group(), root = new THREE.Group();
      orientation.rotation.set(...rotation); orientation.add(model); root.add(orientation);
      const mixer = new THREE.AnimationMixer(model);
      let referenceAction = null;
      if (referenceClip !== null) {
        const clip = clips.find(c => c.name === referenceClip);
        if (!clip) throw new Error('Unknown reference clip: ' + referenceClip);
        referenceAction = mixer.clipAction(clip).play(); mixer.update(0);
      }
      root.updateMatrixWorld(true);
      const originalBounds = new THREE.Box3().setFromObject(root, true);
      const extent = originalBounds.getSize(new THREE.Vector3()), max = Math.max(...extent.toArray());
      if (!Number.isFinite(max) || max <= 0) throw new Error('Empty or invalid model bounds');
      const scale = size / max; orientation.scale.setScalar(scale); root.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(root, true), center = scaledBounds.getCenter(new THREE.Vector3());
      orientation.position.set(-center.x, align === 'ground' ? -scaledBounds.min.y : -center.y, -center.z);
      root.updateMatrixWorld(true);
      const actions = new Map(), retired = new Map();
      if (referenceAction) actions.set(referenceClip, referenceAction);
      let disposed = false, active = referenceAction;
      const alive = () => { if (disposed) throw new Error('Instance disposed'); };
      const instance = {
        root, model, mixer, clips: clips.map(c => ({ name: c.name, duration: c.duration })),
        normalization: { scale, align, referenceClip, rotation: [...rotation], sourceMin: originalBounds.min.toArray(), sourceMax: originalBounds.max.toArray() },
        get activeClip() { return active?.getClip().name || null; },
        play(name, { fade = 0.25, loop = true, timeScale = 1 } = {}) {
          alive();
          const clip = clips.find(c => c.name === name);
          if (!clip) throw new Error('Unknown authored clip: ' + name);
          if (!Number.isFinite(fade) || fade < 0 || !Number.isFinite(timeScale) || timeScale <= 0) throw new Error('Invalid playback options');
          let next = actions.get(name);
          if (!next) { next = mixer.clipAction(clip); actions.set(name, next); }
          if (next === active) { next.setEffectiveTimeScale(timeScale); next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); next.clampWhenFinished = !loop; return next; }
          retired.delete(next); next.stopFading(); next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1);
          next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); next.clampWhenFinished = !loop; next.play();
          if (active) {
            active.stopFading();
            if (fade > 0) { next.crossFadeFrom(active, fade, false); retired.set(active, mixer.time + fade); }
            else active.stop();
          }
          active = next; return next;
        },
        update(dt) {
          alive(); if (!Number.isFinite(dt) || dt < 0) throw new Error('Delta must be finite and nonnegative');
          mixer.update(dt);
          for (const [action, until] of retired) if (mixer.time >= until) { action.stop(); retired.delete(action); }
          root.updateMatrixWorld(true);
        },
        stop() { alive(); mixer.stopAllAction(); active = null; retired.clear(); },
        bounds() { alive(); root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root, true); },
        dispose() {
          if (disposed) return;
          disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(model); root.removeFromParent();
          for (const s of resources(model).skeleton) s.dispose();
          instances.delete(instance); release();
        },
      };
      instances.add(instance); return instance;
    },
    dispose() { closed = true; release(); },
    get instanceCount() { return instances.size; },
  };
}
