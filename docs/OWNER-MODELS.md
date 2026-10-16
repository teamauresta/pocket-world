# Owner wildlife models — inspection, not integrated replacements

2026-10-14. Scope: 23 owner-supplied GLBs from /path/to/private-assets/pocket-world/2026-10-14-3d-models. Originals read-only. Copies are only in review/owner-model-evidence/assets; no main-scene, lab, material, service, dependency, GPU-mode, deployment or publication changes.

## Open and reproduce

Existing Vite: http://127.0.0.1:4174/review/owner-model-evidence/ . This is workstation-local inspection, not a new owner-accessible deployment. Model dropdown, explicit clip dropdown, Play/pause, reset and orbit controls. Preview opts into **diagnostic unsupported-material rendering** with an explicit warning; production loader fails closed instead.

- Loader/catalog: src/creatures/imported-assets.js
- Unit checks: node --test src/creatures/imported-assets.test.js
- Browser replay: node review/owner-model-evidence/qualify.mjs (uses existing sandboxed Snap Chromium and installed Playwright; no install). Do not edit Vite-served files during replay; HMR can interrupt it.
- Raw metadata, source SHA256, exact authored node index/parent/skin-joint mapping, material definitions and embedded author/license/source clues: review/owner-model-evidence/metadata.json.
- Actual Three node names (dots are sanitized), world bone matrices, material-map presence, exact clip names/durations, two-pose pixel/skin/bone deltas and bounds: playback.json.
- Every file has A/B PNGs; contact-sheet.png is a visual overview. Earlier bind-pose normalization failure and interrupted HMR run retained separately, not final qualification.

## Important findings

1. **Panda is not a walking/idle animated model.** It is rigged (55 imported bones), but Take 001 contains only three constant TRS channels on nurbsCircle31. Actual playback gives zero changed pixels, zero changed bones, zero skin change. Keep it as a useful rigged static asset; author/retarget real clips separately. Do not animate its group along a route and call it walking.
2. **Tiger is a WHITE tiger, only Idle**, 33,142 triangles (over both budgets). Idle does deform/render; no walking/running clip. Retain white authored texture rather than silently recoloring it into a different model. Locomotion and LOD work remain.
3. **Bear** genuinely has Bear|BlackBear_Idle and Bear|WalkFast_F, 13,640 triangles and 297 bones. Embedded title says BEAR, clip says BlackBear; brown-bear suitability is not established. Its required KHR_materials_pbrSpecularGlossiness is unsupported by installed Three GLTFLoader: default fallback renders white and loses diffuse texture. Loader rejects by default. Need qualified legacy-material support/conversion, not acceptance of the white fallback. Same blocker affects **elk, wolf, alligator, school_of_fish**.
4. **Stag + Deer**: distinct visually inspected antlered/antlerless low-poly models, 3,670/2,098 triangles and 38/46 bones; both have 13 genuine animated clips including Idle, Walk, Gallop, Eating and hit reactions. Deer is not author-labelled Doe in the file. Best first integration candidates technically, subject to provenance/license reconciliation and a real feet/controller adapter. Files themselves contain no author/license; unknown is recorded, not replaced with an unverified CC0 claim. Parent may match hashes against earlier documented legitimate Quaternius acquisition.
5. **dove_bird_rigged**: Take 001 visibly flaps wings (75 bones, 2,462 triangles). Appearance is a dark-headed, orange-breasted bird, NOT visually a white dove. Filename/title do not prove species. No dedicated perch, land, takeoff or fold clips. Useful generic flight asset with species/landing limitations.
6. **Whale**: one real swimming deformation clip, 21 bones, 10,068 triangles. Embedded license is SKETCHFAB Standard, not CC-BY/CC0; separate-use/redistribution terms must be checked before packaged/public distribution.
7. **Manta**: one real fin-flapping/swimming clip, 95 bones, 17,164 triangles. Initial animation transforms make bind-only normalization ~100x wrong. Explicit referenceClip normalization at authored t=0 fixes viewing size without modifying source/clip. CC-BY-NC metadata; no commercial/public license clearance claimed. Not a universal scale-fix certification.
8. **Eagle and sea turtle are STATIC**, zero authored clips, zero imported bones; 10,828/16,218 triangles. Static flying/swimming poses are not flight/swim animation. Coral fish, fish, both crabs are also static. Do not replace dynamic actors without additional rigs/motion work.
9. **Elk** looks like an antlered elk, not a wolf despite Food_Eating_01_Wolf and other inherited names. 53 clips; every clip actually sampled. Food_Eating_01_Wolf has essentially no motion; DeathPose clips are static/nearly static. Walk/turn/trot/run clips do deform. Metadata names alone are not eligibility.
10. **Shark** is 423,800 triangles and its imported asset includes multiple separated body/eye/teeth meshes. The preview shows a tiny body plus detached dark eye-like pieces, not an acceptable integrated shark. Preserve file; geometry/rig cleanup and LOD required. Dolphin 231,248 and blue crab 421,182 are similarly over budget even though dolphin swimming deforms correctly. No automatic decimation undertaken.

## Rendering / playback scope

All 23 files structurally inspected, all self-contained (no external buffer/image URIs). Browser qualification loads each with actual GLTFLoader + SkeletonUtils clones, renders two screenshots and samples every authored clip at 13%/43% duration. Pixel deltas use fixed camera/lights; CPU skin samples use actual getVertexPosition, not just actor transforms. Includes zero-motion clips honestly. This proves sampled rendering/deformation, not full-loop artifact-free playback, cyclic continuity, sole contact, artistic acceptance or native hardware FPS. Software ANGLE SwiftShader only; no hardware GPU mode/work used. Required-material failures are explicitly diagnostic rather than qualified renders.

### Loader contract

Explicit URL injection, no auto fetch/catalog publication. Source materials, textures and geometry are shared unchanged/read-only, not recolored/replaced. Independent SkeletonUtils bone hierarchy/skeleton and AnimationMixer per instance. Wrapper rotation/scale/center or ground alignment does not overwrite authored animated root transforms. size = longest precise skinned-bounds dimension, **not species body height**. Optional explicit referenceClip evaluates t=0 before normalization for authored bind/animation scale differences. It remains active until selected/stopped. Choose a measured reference deliberately; never normalize from arbitrary first clip in production.

play requires an exact named clip; missing clips throw. Crossfade retires previous actions, update(0) freezes, negative/nonfinite deltas rejected. No fake walk/fly generation. dispose(instance) releases only its skeleton/mixer; asset.dispose closes creation and waits for remaining instances before releasing shared GPU resources once. Callers must not dispose/mutate shared materials; add a separate owned-material mode if per-actor weather material changes are required. Runtime materials remain under GLTFLoader ownership. Browser ImageBitmap CPU close is not attempted because images can be shared across textures; texture.dispose releases GPU allocation, browser GC handles remaining image references.

### Scale / orientation / ground

GLTFLoader honors glTF Y-up and embedded export transforms. Measured head-vs-body positions establish +Z forward for Stag, Deer, bear, tiger, bird and whale. Main procedural land models use +X forward; apply wrapper yaw +PI/2 for these, then verify actual direction against route velocity. Panda is visually +Z but its anonymous joints need manual mapping. Rhino is sideways along X; other models require their own measured axes, not a global rotation guess. Manta is +Z head/forward in the inspected pose.

Normalization initially aligns the reference-pose overall minimum to y=0. It is NOT stance-aware grounding. At size 2.8, deer/stag Walk skin minima were about -0.014/-0.011 in sampled phases (bind-normalized first pass); bear WalkFast about -0.052, tiger Idle about -0.006. Different clip/rest bounds, wing tips, antlers and tails must not become a dynamic global ground constraint. Explicit full bounds/scale in playback.json, with no claimed meters. Manta/whale should use center/depth anchoring for sea integration rather than a ground plane. School fish contains multiple actors with authored translations and cannot be treated as one fish route actor.

## Behavior-controller integration design (not implemented)

Keep existing navigation, terrain/coast/collision clearances, spring steering, speed, weather priorities, shelter route/arrival, thunder bolt, sea depth/surface/breath cycle, bird landing/perch/wind semantics. Replace only the visual backend behind an explicit capability interface, not the actor/controller.

1. Actor world transform owns position/yaw; normalized wrapper owns fixed asset basis/size. Mixer owns authored rig pose. Choose in-place motion or explicit root-motion extraction once; never add authored trajectory displacement on top of the existing route. Calibrate stride length/timeScale against real controller speed; foot sliding checks mandatory.
2. Each model adapter specifies exact node map, measured limb rest axes/lengths, sole offsets and contact phases. Existing procedural quadruped bone/IK indices are **not** compatible with these rigs. Use named hierarchy plus original glTF node index to avoid sanitized-name collisions. Preserve full helper/control bones until proved unnecessary.
3. Stag/Deer mapping candidates: Body/Back → root/pelvis, Torso→spine, Torso3→chest, Neck1..3→neck, Head→head; FrontShoulder.L → FrontUpperLeg.L → FrontLowerLeg.L, and BackShoulder.L → BackLeg.L → BackUpperLeg.L → BackLowerLeg.L, mirrored R. FF.L/FFB.L and IKFrontLeg.L/IKBackLeg.L are authored rig targets/helpers, NOT automatically physical sole bones. Three names drop dots (e.g. FrontUpperLegL). Measure four rendered hoof sole offsets/weights before selecting deform chains.
4. Bear: Pelvis_05, Spine1_06, Chest_08, Neck1_09, Head_011; front LegFL1_0179/LegFL2_0180/LegFL3_0181/LegFLAnkle_0182 and FR equivalents; hind LegBL1_0244/LegBL2_0245/LegBLAnkle_0246 and BR equivalents. Many facial/end helper chains; 297 bones costs differ from triangles. Confirm true ankle/sole frame; do not feed these into existing 17-bone indices.
5. Bird: Root_M_02, Head_M_043, bd_Shoulder_R_037 → Elbow_R_038 → Wrist_R_039, L equivalents; Hip_R_03→Knee_R_04→Ankle_R_05 and L. Existing procedural wing fold and perch feet cannot be blindly applied. Need explicit authored/procedural adapter with visually checked fold/landing transition; Take 001 alone is flight only.
6. Whale spine_1_01..spine_5_05, flipper and tail bones; manta spine/pectoral chains: map scene depth/heading at wrapper only and drive real clip speed from swimming state. Weather depth and surface avoidance remain in existing controller; fins need no land IK.
7. Panda anonymous joint names require visual/weight mapping and authored/retargeted Idle/Walk. Tiger ribbon joints require a proper retarget/IK design and missing locomotion, not straight copying existing leg rotations. Leave current procedural actors active until these capabilities exist.
8. State capability table must explicitly return unsupported rather than silently map walk/run/perch to idle. Crossfade only approved states. Missing reaction may retain existing visual backend; do not switch rigs mid-step without continuity plan.
9. Acceptance gate: same current locomotion/weather tests, world skin/sole stance metrics on flat+slope+turn+start/stop, no stretched bones, real bolt/shelter arrival, bird fold/perch wind, sea depth/breath tests, freeze with dt=0, actual near/far geometry and draw-call/texture/bone/mixer budgets. Derive collision footprint from full animated envelope, keep physics unchanged until measured replacement clearance is safe.

## License/provenance boundary

Embedded metadata is a clue, not independently verified current author ownership or public-use permission. No web source claims were invented and no public publication performed. CC-BY requires attribution; NC excludes commercial-use clearance; Standard needs exact license review. Stag/Deer unknown inside these bytes. Owner provision authorizes inspection, not automatic relicensing. metadata.json preserves exact author/title/source/license strings and SHA256 for reconciliation.


## Measured complete inventory

Near <20,000 / far <5,000 triangles (strict). Raw geometry budgets, NOT frame-time acceptance; no LODs created. Every clip in metadata/playback JSON sampled, including constant clips.

| File | Triangles | Near/Far | Imported bones | Clips | Motion probes >1e-5 skin delta | Embedded license clue |
|---|---:|---|---:|---:|---:|---|
| Deer.glb | 2098 | yes/yes | 46 | 13 | 13 | unknown |
| Stag.glb | 3670 | yes/yes | 38 | 13 | 13 | unknown |
| alligator_-_realistic_3d_model_demo_free.glb | 31049 | no/no | 187 | 2 | 2 | CC-BY-NC-4.0 |
| bear.glb | 13640 | yes/no | 297 | 2 | 2 | CC-BY-NC-4.0 |
| blue_crab.glb | 421182 | no/no | 0 | 0 | 0 | CC-BY-4.0 |
| coral_fish.glb | 2672 | yes/yes | 0 | 0 | 0 | CC-BY-4.0 |
| crab_3d_model_free.glb | 19179 | yes/no | 0 | 0 | 0 | CC-BY-4.0 |
| dove_bird_rigged.glb | 2462 | yes/yes | 75 | 1 | 1 | CC-BY-4.0 |
| eagle.glb | 10828 | yes/no | 0 | 0 | 0 | CC-BY-4.0 |
| elephant.glb | 1958 | yes/yes | 54 | 28 | 27 | CC-BY-4.0 |
| elk.glb | 7886 | yes/no | 38 | 53 | 51 | CC-BY-4.0 |
| fish.glb | 3926 | yes/yes | 0 | 0 | 0 | SKETCHFAB Standard |
| model_101a_-_adult_common_dolphin.glb | 231248 | no/no | 26 | 1 | 1 | CC-BY-NC-4.0 |
| model_84b_-_manta_ray_swimming.glb | 17164 | yes/no | 95 | 1 | 1 | CC-BY-NC-4.0 |
| panda.glb | 1810 | yes/yes | 55 | 1 | 0 | CC-BY-4.0 |
| realistic_shark.glb | 423800 | no/no | 45 | 2 | 2 | CC-BY-4.0 |
| rhino.glb | 4846 | yes/yes | 43 | 1 | 1 | CC-BY-4.0 |
| rigged_whale.glb | 10068 | yes/no | 21 | 1 | 1 | SKETCHFAB Standard |
| school_of_fish.glb | 8932 | yes/no | 148 | 1 | 1 | CC-BY-4.0 |
| sea_turtle_low_poly.glb | 16218 | yes/no | 0 | 0 | 0 | CC-BY-4.0 |
| tiger.glb | 33142 | no/no | 121 | 1 | 1 | CC-BY-4.0 |
| tuna_fish.glb | 5989 | yes/no | 47 | 2 | 2 | CC-BY-4.0 |
| wolf.glb | 16262 | yes/no | 123 | 2 | 2 | CC-BY-NC-4.0 |