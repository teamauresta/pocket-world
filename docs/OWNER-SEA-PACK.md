# Native owner sea pack — qualification in progress

New files only; no main, SeaLife, old manta/tuna/birds/land, loaders, packages, originals or deployment edits.

## Parent API
Import loadOwnerSeaAssets, createOwnerSeaPack, OWNER_SEA_PROFILES from src/sea/owner-sea-pack.js. Explicit keys: **whale, school, fish, coralFish, turtle, shark, dolphin**.
Loader accepts {key: URL} or {key:{near:URL,far:URL}}. Returned factory assets: {key:{near:importedAsset,far?:importedAsset}}; bare importedAsset also accepted.
Factory: await createOwnerSeaPack({hf,assets,quality:'high'}). Returns group, update(dt,env), onStrike(event), reset(), snapshot(), getCandidates(), updateDetailView(camera,{quality}), dispose(). Parent adds group to MAIN scene. Caller owns loaded assets, disposes after pack. Owned cloned materials include patchUnderwater. No heavy-original fallback; strict actual <20k near/<5k far triangle gates.

| Profile | Reference size | Motion | Count |
|---|---:|---|---:|
| whale | 10 | native whale_1_armature clip | 1 |
| school | 6 (full animated formation ~12.5 wide) | native swimming, nine authored members | 1 school |
| fish | 1.4 | generated tail/dorsal fin | 2 |
| coralFish | 1.25 | generated tail/dorsal fin | 2 |
| turtle | 3.4 | generated lateral flipper strokes | 1 |
| shark | 6 | native swimming_skeletal.3; derived near/far | 1 |
| dolphin | 5.2 | native Swim Cycle; derived near/far | 1 |

Reference size is longest t=0 dimension. Individuals normalized +X forward: whale/fish/dolphin +Z source, turtle -Z source, coralFish -X source. School members retain authored orientations/trajectories; controller steers formation centre, not individual fish slots. Complete school loop envelope is centred, not squeezed into an old fish support.

Generated static motion clones geometry per actor, deforms fins/tail/flippers in normalized anatomical coordinates and transforms authored normals by Jacobian inverse-transpose. UV/material appearance preserved. amplitude=0 restores exact source positions/normals. NOT authored clips, talonRig or imported skins.

Containment: complete-cycle envelopes, current-pose full skin bounds, every bilinear grid point and edge intersection in footprint, map edges/floor/surface/bank allowance. Storm depth, night slowing/deeper rest, lightning burst. Air-breathers surface approach/hold/descent; **actual blowhole/nostril air contact NOT certified**. Snapshot explicitly states approach-only capability.

Parent can disable old sharks/turtles after replacement loads; keep two silver controllers used by genuine tuna adapter when removing old 170-fish school. Manta/tuna remain unchanged.

## Licensing
Private owner preview only. Whale/fish SKETCHFAB Standard does not establish redistribution/public clearance. Dolphin NC; other selected marine assets embedded CC-BY metadata. Preserve original source/author/license records in OWNER-MODELS metadata. No publication/relicensing.

## Evidence
Focused harness node review/owner-sea-pack-probe.mjs; sandboxed Snap Chromium SwiftShader. Unit node --test src/sea/owner-sea-pack.test.js.
Initial school size=9 could not fit full rotated envelope; corrected to readable 6 with animation-centre anchoring, not unrelated proxy shrinking. First static world-AABB inverse/reapplication inflated bounds near bank; corrected by direct all-vertex local bound. First failures retained. Final qualification results below when complete.

## Root motion decision
Raw translation-accessor endpoint/range evidence: review/owner-sea-pack-root-motion.json. Whale master_00 has zero cycle displacement and bounded 0.19121 source-unit bob; retained. School member trajectories are cyclic (first head has zero endpoint displacement), and remain native inside the measured full school envelope; no synthetic nine-agent repacking. Shark swimming has NO shark_root translation channel; the separate circling clip has a large root path and is deliberately NOT selected by this controller. Dolphin Swim Cycle has no MAIN/root translation channel. Native fin/jaw/spine tracks are retained. There is no additive extracted-root trajectory double counting.

## Corrected material integration defect
Actual world rendering exposed white mirror-like fish despite a coloured isolated image. Three MeshStandardMaterial.copy drops subclass defines: ImportedSpecGlossMaterial.clone retained the map but lost OWNER_SPEC_GLOSS_MAP. This pack now explicitly preserves source defines on owned clones and reasserts the map define. Shared loader remains untouched. Actual-world corrected school shows coloured clown/tang/butterfly fish. A dedicated regression test covers this; initial glare screenshot retained. Parent should consider the same clone guard for other separately-owned legacy-material adapters, without assuming this sea-only correction changes them.

## Final focused qualification — 01:57 AEDT
- 6 new source tests PASS: rest/source immutability, model-specific deformation, exact terrain footprint, explicit profiles, owned mapped-material defines, freeze/reset/coarse dt/budget rejection.
- All seven profiles loaded; 9 native controller actors (one school represents nine authored fish). Heavy derived near/far integrated: shark 18774/4722, dolphin 18717/4723. No raw heavy model loads.
- 60 simulated seconds: clear → lightning → storm → night, 600 observations / 5400 actor observations, zero clearance faults; pause/reset exact. Whale two surface approaches, turtle/dolphin one each; these remain APPROACHES, not verified breaths.
- 83 off-grid clip/phase poses × 7 species: every rendered vertex tested, zero outside full-loop envelopes. Skin/deformation maximum movement: whale .324, school 7.795, fish .204, coralFish .182, turtle .598, shark 1.361, dolphin 1.035 world units. Independent mixers and static instance geometry. Four forced map-edge/above-water/below-floor/land-centre cases, all 9 actors recover with zero faults.
- All seven fixed-camera pixel comparisons genuinely change (6751–85476 pixels), GL=0. Near/far selection both heavy species passes. Actual main-world front/side pictures all seven types, final unobstructed inspection staged at (30,-7,30) with other native actors temporarily hidden ONLY in harness. Geometry/world scenery not removed. Earlier free-roam views with occlusion retained through prior evidence and not counted as unobstructed.
- Software-only pack CPU sample 5.72ms/frame for 30×1/60s updates; concurrent qualification load, NOT native hardware FPS acceptance. Static CPU deformations and exact terrain scans add real cost.
- Runtime far LOD exists for shark/dolphin only. Whale/school/turtle remain original near geometry at distance: far <5k gate NOT satisfied for those three. Do not claim complete all-species LOD acceptance.
- Remaining fixable gaps: anatomical air-contact breathing/spout; whale/school/turtle far LODs; integrated parent all-population QA/native FPS. Current controllers are functional and bounded, not a claim that these gates are waived.
- Evidence: review/owner-sea-pack-evidence/report.json, review/owner-sea-pack-world/report.json, corresponding 14 isolated and 14 real-world PNGs, source tests, root-motion JSON, retained failed runs.
