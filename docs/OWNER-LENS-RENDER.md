# Owner turtle cornea: opaque-buffer reuse

Private owner asset only. Original GLB, geometry, UVs, normals, flipper motion and body materials are unchanged.

## Parent integration



Construct `const ownerLens = new OwnerLens(scene)` before Pipeline and pass `{ samples: 4, ownerLens }` in its options. After the native sea pack has been added to the MAIN scene, call `ownerLens.register(nativeSea.group)`. Registration is idempotent and returns the count of newly registered Outer_eye meshes. Alternatively set `pipeline.island.ownerLens = ownerLens` after constructing the pipeline. Reserve camera/object layer 30 exclusively for this helper; normal camera layers must exclude 30.

No independent animation/frame update is necessary. IslandPass invokes `ownerLens.render(renderer, camera, opaqueTarget)` after the opaque image resolves. The actual eye mesh stays in its original hierarchy and therefore follows all actual matrixWorld/skeleton/morph updates, visibility and ancestor culling. Only its material clone and layer mask change; dispose restores both. Call `ownerLens.dispose()` before disposing the source pack. IslandPass owns/disposes its extra render target, not the helper or original materials.

## Render path

1. Normal opaque MSAA colour/depth render, excluding only registered corneas from the normal camera layer.
2. Copy resolved opaque colour into a different MSAA target; render ONLY corneas, with actual scene lights enabled temporarily on the reserved layer and existing shadow maps retained. No second shadow-map update.
3. Cornea shader uses Three's unchanged physical transmission/IOR/specular/clearcoat equations and original transmission uniform = 1. Material.transmission = 0 is render-list classification only; USE_TRANSMISSION remains enabled in BOTH shader stages. The original underwater shader callback is preserved.
4. Explicit screen-space comparison against the original resolved opaque depth prevents drawing through foreground geometry. The distinct destination never samples its own colour/depth attachments.
5. Copy lens-inclusive colour back to original opaque target without clearing/writing its depth. Water/river/rain, DOF, bloom and output then run normally, including underwater lens colour in their source. Default Pipeline without helper remains unchanged.

## Bounded approximation, not bit-identical optics

Supported only: zero-thickness Outer_eye with no transmission/thickness maps or dispersion. IMPORTANT source correction: original GLB omits base roughness (glTF default **1**), has metallicFactor **0.9781838514**, alphaMode BLEND / opacity **0.25**, and doubleSided **true**. Only clearcoat roughness is zero. Initial smooth/FrontSide guard deliberately rejected the real material; that failure is retained. No original material factors are “corrected”. The helper retains native double-sided alpha rendering, roughness, metalness, and Three’s full bicubic mip filtering using a mip chain generated from the existing opaque colour. Thickness zero means zero volumetric ray displacement. Existing transparent MAIN-scene contributors are already present in the reused image whereas Three’s private buffer contains only opaque contributors; original double-sided transmission may also include a back-face contribution in its private buffer. No general-purpose glass or bit-identical equivalence claim.

Colour is linear HDR throughout; postprocessing remains exactly downstream. Depth uses resolved per-pixel comparison (2e-7 normalized tolerance), not per-sample opaque MSAA depth. Extremely fine intersecting silhouettes can differ. DOF/water depth remains the opaque depth behind the thin lens, not a new solid cornea depth.

## Proof

Focused unit tests: `node --test src/render/owner-lens.test.js`. Browser scripts bundle the helper and current Pipeline in memory, inject into the frozen candidate without touching its server/files, and render its actual scene using the full MSAA compositor. All screenshots are complete compositor captures, not direct renderer/non-MSAA captures. This is SwiftShader GL correctness/pixel evidence, not native FPS qualification. Existing 32 integration checks are intentionally not replayed.

### Whole-world actual draw accounting (1000×750, frozen 7651a313735b)

Full colour compositor INCLUDING water, postprocessing and lens (not just opaque): forest **2,093,231 triangles / 169 calls**; jungle **2,105,851 / 187**; overview **2,299,984 / 215**; palm **1,854,233 / 172**. All below 2.5M / 260, GL0, zero browser errors. Cornea contributes **4,736 submitted triangles / 2 calls** (native double-sided rendering, geometry unchanged). Forest main colour drops from 3,993,724 / 281 to 2,005,621 / 145 plus cornea.

Shadow-enabled full compositor totals are retained separately (forest 3,441,138 / 295, overview 3,647,891 / 341); these exceed the colour-only contract because they include real shadow submissions. Shadows were restored for every delivered screenshot; their cost is not hidden or waived. The old 32 controller checks remain retained, not recounted.

Evidence: `review/owner-lens-proof/report.json` and paired PNGs. Forest and jungle full frames are pixel-identical in the initial measured pairs (eye outside these views); close-eye evidence is required separately, not inferred from these zero differences.

### Close-eye A/B and no-op witness

Six complete MSAA+water+DOF+bloom+output views: front, side, quarter, storm/wet, lower underwater, opaque occluder. All actual GL0, no shader/browser errors. The original source itself produces a pale blue metallic/rough cornea (see original images); that appearance was not replaced with an invented transparent black eye.

For visible views, lens-effect ROI is defined by reuse versus a separate **test-only omitted-lens witness** (>2/255 difference), not by the whole frame. ROI size 7,659–13,514 pixels. Mean original-versus-reuse RGB error in that ROI: front **0.342/255**, side **0.658/255**, quarter **0.366/255**, wet **0.263/255**, underwater **0.375/255**. Witness changes thousands of pixels, so the shader is demonstrably not a transmission=0 no-op.

**Not pixel identical:** 297–415 full-frame pixels exceed 2/255, with isolated maxima **73–140/255** at silhouette/intersection boundaries. Enlarged front crops show slightly different edge coverage while cornea interior/iris/highlight remain close. This is the documented resolved-depth/per-sample-coverage limitation, not a claim that every pixel matches. The fully opaque foreground witness produces **zero differences**, no eye leaking through. World forest/jungle pairs identical; overview differs at 17 pixels (max5), palm 45 pixels (max1).

Evidence: `review/owner-lens-close/{front,side,quarter,wet,underwater,occluded}-{original,reuse,no-lens}.png`, `review/owner-lens-pixels.json`. Seven unit tests PASS; 31 focused evidence assertions PASS in `review/owner-lens-verification.json` with source hashes. These are new lens checks, not the existing 32 native controller checks. No native FPS, final parent-build integration, or owner artistic acceptance claim.

No deployment, server, package, GLB, animation, asset loader, main.js, sea or land source changes by this task. Parent owns final wiring/build/freeze. Earlier aborted startup runs and the actual-source guard rejection are not counted as passes.
