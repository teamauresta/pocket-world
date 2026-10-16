# Owner model LODs — 2026-10-15

Private owner-preview derivatives only; no licence grant or public publication. Original archive files were read only: SHA-256 and mtime nanoseconds verified unchanged.

## Deliverables

All eight GLBs: `public/owner-models/derived/{shark,dolphin,tiger,alligator}-{near,far}.glb` (paths relative to repo). Individual `*-manifest.json` and combined `manifest.json` record source hashes, output hashes, clips, reference bounds, bones, materials and loader requirements.

| Asset | Original indexed triangles | Near submitted | Far submitted | Bones | Clips |
|---|---:|---:|---:|---:|---:|
| Shark | 423800 | 18774 | 4722 | 45 | 2 |
| Dolphin | 231248 | 18717 | 4723 | 26 | 1 |
| Tiger | 33142 | 18715 | 4728 | 121 | 1 |
| Alligator | 31049 | 18740 | 4726 | 187 | 2 |

These are actual index counts, also verified by renderer.info.render.triangles; not estimates or invisible-part tricks. No eyes, jaws or tooth parts were deleted. Shark body importer chunks become one primitive; dolphin body chunks become one primitive. All anatomical parts remain.

## Integration contract

- Use native GLTFLoader for shark/dolphin/tiger. Alligator **requires existing createImportedMaterialLoader() / ImportedSpecGlossExtension** from src/creatures/imported-materials.js. Its original KHR_materials_pbrSpecularGlossiness materials, factors, image bytes and texture bindings are unchanged. Unsupported plain-loader white rendering is NOT qualification.
- Evaluate reference clip at t=0 **before** measuring exact skinned vertex bounds. Normalize only an external wrapper, never force all meshes into a made-up envelope. Reference names and extents are in manifests.
- Shark: reference `Shark Rig|swimming_skeletal.3`, 24 seconds; circling 31.958333969 seconds. All native tracks retained. Native circling has genuine large displacement/orientation. Disable stale skinned-mesh frustum culling (or update exact bounds); the qualification exposed disappearances with stale bounding spheres. The proof camera follows actual deformed center without changing asset size or mesh visibility. Carrier/root-motion compensation is integration work, not baked into these GLBs.
- Dolphin: `Swim Cycle`; real swimming retained. Tiger: native `Idle` ONLY, not a fabricated walking clip. Alligator: Idle and Trot_F retained.
- Do not interpret geometry budget compliance as scene FPS acceptance. No integrated app or native-hardware FPS qualification was performed here.

## Shark defect diagnosis and correction

Original source renders a tiny intact body plus giant detached eyes and stretched teeth. Sampling the reference clip does **not** fix it: original bind bounds ~43.49 × 9.40 × 67.79, same at swimming t=0. This is not merely the Manta-style 100x animated-bind case.

Source retained separate authored body/part object matrices in nodes 13/18/21/23/25 while all mesh primitives share a body-coordinate inverse-bind palette. Raw body position extent is ~1.71 × 1.40 × 4.62; eye coordinates span x ±11.84 and z -35.1, incompatible with the common palette. Bone-world × IBM products are ~1.8363 scale with the expected native pose, not a missing global 100x scale.

Corrected only eye/teeth **geometry coordinates**, using the actual retained matrices:

    correctedPosition = inverse(bodyBind) * inverse(partBind) * bodyBind * position

Normals use the corresponding inverse transpose. No guessed per-eye center/size fitting, no hidden/deleted components, no bone/IBM/animation changes. Four alternative matrix-order diagnostics were rendered and retained; the conjugated inverse recovers the body coordinate basis. Result all-part reference bounds ~3.13 × 2.55 × 8.39 and intact front/side/quarter/circling renders. Body-native scale and animation remain unchanged. Source broken images and diagnostic matrices remain under review/owner-model-lod-first and review/owner-model-lod-evidence.

**Limit:** This is an evidence-based coordinate repair from retained authored transforms, not comparison with an unavailable author DCC scene. Small dark source-part details remain visible near the dorsal region; do not claim author-perfect cosmetic restoration.

## Reduction and preservation

CPU Blender 5.2.1 LTS at blender, no installation/GPU render/mode change. scripts/owner-model-lods/build.py constructs topology directly, collapses before skin evaluation and repacks into the source glTF graph. It does not round-trip the rig through Blender export.

- All bone names, joint arrays, inverse-bind matrices, clip names/channels/interpolation/time/value bytes retained exactly. Validation in preservation.json.
- Embedded image bytes, material JSON, textures and samplers exact; no rebaking or material replacement.
- Original smooth normals explicitly interpolated and normalized, not flat polygon normals. UVs and vertex colors are interpolated corner attributes. Dolphin/shark importer-split body chunks are consolidated and coincident seam vertices welded before collapse; per-corner UV seams retained. Initial independent-chunk far decimation visibly cracked; failed evidence preserved and final unified result corrected.
- Skin weights interpolated with Blender vertex groups, four strongest influences repacked and renormalized. This is **not byte-exact skin weights after topology reduction**. Maximum discarded total weight (near/far): shark .13443/.11945; dolphin .01890/.04341; tiger .08069/.14753; alligator .04133/.07632. Full-clip sampled render/bounds evidence is supplied; small deformation differences are expected.
- Tiger source tangent attribute is omitted after topology change; renderer derives tangent basis from retained normals/UVs for its normal map. TEXCOORD_0..3 retained. This contributes to visible fine-shading differences; not a claim of pixel identity.
- No source morph targets on these four assets (verified). No morph animation was silently removed.
- Original texture size retained, so near/far files are still texture-heavy. Geometry reduction is not texture compression.

## Proof and limitations

review/owner-model-lod-evidence/: preservation.json; per-asset build/render JSON; fidelity.json; front/side/quarter images and *-views.jpg; *-clipN-AB.gif.

Sandboxed Snap Chromium + SwiftShader only. Each clip sampled at 25 evenly-spaced times including both ends with real skinning/material rendering; all derived clips produced changing pixels and GL error 0. Near/far geometry under limits at every sample. GIFs summarize five of those samples, not a real-time-speed playback. Front/side/quarter and selected animation frames visually inspected: all four recognizable and intact, dolphin/shark seams repaired, alligator textures correctly rendered, tiger native white appearance retained. Near/far are not pixel-identical; far tiger loses the most fine detail.

Source/near/far comparisons for dolphin/tiger/alligator; shark near/far comparison plus retained broken original diagnostic (not a false equivalence to broken source). Numeric max full-clip bounds error as fraction of source length: dolphin near .000084/far .000300, tiger .00574/.01855, alligator .000151/.001254. These are bounds metrics, not maximum surface-distance guarantees. Quarter image IoU and MAE are diagnostic only (UI labels/background threshold included); no inflated visual pass threshold.

No main JS, shared loader, package, deployment, commits or live routes changed by this work. Files are integration-ready derivatives, not integrated scene acceptance.
