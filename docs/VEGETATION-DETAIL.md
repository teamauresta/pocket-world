# Vegetation detail — bounded preview qualification

This release improves the existing procedural island; it is **not full Guide Feature 10 acceptance, photographic vegetation, or native-FPS certification**. Owner-model replacements are separate unfinished work and are not included.

## Changes

- Eight generated tree forms/species, five genuinely distinct source variants each; actual occupied variants remain pine5/oak5/ash1/birch5/bush5/broadleaf5/fig4/flowering4. No empty instances fabricated to claim five occupied variants.
- Measured crown support-envelope darkening, per-card atlas selection/color, rigid-card wind, backlit undersides, original alpha silhouettes. Procedural1024-per-cell high-detail color/normal atlases (512 low/no sampled normals), not photographic replacements.
- Actual flared bases, three–five root tubes on non-bush trees, broadleaf/fig buttresses and aerial fig roots; seven elevated branch-attached lianas, three broken-branch snag accents, six short floor logs, moss/litter, grass dry tips, flowers, inward-return fern tips, bamboo sheaths, ragged/dead palm fronds and coconuts.
- Explicit missing-attribute buffers for legacy plants prevent context-global WebGL attribute constants from leaking across cached VAOs/draw orders. Authored attributes, topology, placement RNG, instances and navigation are preserved.
- World-only fur-shell budget6/120,000; lab retains its qualified full12/6 shells. Stable relevance/fade/hysteresis; no geometry/skin/physics substitutions or test-only shell disabling.
- All94 casting wind meshes have linked matching color/depth/distance deformation. Previously missing legacy-plant point-shadow adapters were filled after the original review. Existing liana custom shadow hooks preserved.

## Preserved qualification evidence

The first independent candidate failed: `review/vegetation-review.md` and its evidence remain untouched. The second independent review completed its measurements but stopped on a provider error before writing a verdict. Parent recovered the actual files, inspected saved unobstructed views and same-camera comparisons, and closed only the missing shadow adapter gap. No completed implementation, weather/foot tests or baseline captures were restarted.

- Earlier integrated source101PASS; main/lab builds passed. The final shadow-only integration was directly tested in real WebGL, then main rebuilt; the unchanged qualified lab was copied byte-identically, not rebuilt.
- All seven actual color-pass views under2.5m/260; maximum2,372,086 triangles, maximum166calls. Point-shadow follow-up overview2,318,010/166. Software WebGL only, not hardware FPS.
- Existing weather/control/audio/touch/reduced-motion regression68PASS/0FAIL/30frames/0warnings; real laboratory sole/skin13PASS/0errors retained unchanged.
-319 exact solid records and terrain/coast hashes match accepted animal baseline. All12 independently swept shelter paths have zero bad samples.92 exact branch-vertex perch references;84 real bird wind-anchor samples, maximum error2.292e-6. Exact paused behavior/appearance snapshots.
-370 rendered root tubes/35 aerial roots, source/served position hashes match. Added root/buttress/aerial parts have zero measured animal-height envelope/coastal-water violations; measured base radius gain1.8. Original whole-branch envelope predicate also fails on baseline branches: new-root range attribution is explicit, not a hidden waived collision gate.
- Seven liana endpoint wind laws agree with actual branch refs across0–60s, including strong storm samples; real color/depth/distance shaders linked and deformation chunks agree. Actual tube minimum ground clearance5.457; rest endpoint error1.174e-6. This is CPU evaluation of compiled laws and positive GPU motion, not GPU vertex transform-feedback endpoint readback.
- Eight fern ribbons have two negative radial tip steps, finite normals and unchanged topology. Saved near silhouettes inspected, including roots, palm crowns, ferns and floor logs.
- Actual uploaded atlas uniforms and positive texture-perturbation pixels; low linked programs have no active normal sampler/upload. Source alpha silhouette retained. Three's native shadow renderer approximates alpha-to-coverage with alphaTest0.5; it is not claimed to be an identical multisample silhouette.
- Real point-light shadow map previously measured1,237 nonwhite/53 changing pixels; follow-up compiles all94 casting wind distance programs and verifies wind chunks, GLerror0 and exact pause. No merely allocated/unexercised shadow-material claim.
- Same-camera overview and post-camera/shadow-probe sequence remain green, without the previous new near-black canopy mass. Close-up surfaces remain stylized; owner artistic acceptance is separate.

Evidence: `review/vegetation-final-review-evidence/`, `review/vegetation-shadow-followup-evidence/`, `review/vegetation-final-weather-evidence/`, `review/vegetation-final-motion-evidence/`, `review/vegetation-liana-repair-evidence/`, `review/vegetation-budget-evidence/`.

## Explicit remaining scope

Full dead-canopy tree replacement was not implemented (three side-branch snag accents are not full dead trees). Procedural leaf overlays are not photographic1024 leaf replacements; procedural bark AO/roughness/moss is not externally supplied bark-PBR data. Five generated source variants do not imply five placed variants. Full-loop/mobile hardware performance, exact GPU endpoint readback, original strict escape-policy failures and full-guide acceptance remain unclaimed. Existing owner-accepted constrained escape policy is retained; this release does not fix or silently reclassify it.

Imported-model loader/material repair and deer prototypes remain separate local work. No imported model may replace the live controller until actual skin/hoof contact, complete reaction/fallback continuity and rendering budgets qualify. Original owner model files remain read-only, and their licence limitations remain.

## 2026-10-14 albedo/snags follow-up (source, pending fresh artifact qualification)

The earlier photographic/full-dead-canopy gap wording was overstrict. The actual owner Guide10 asks for1024leaftextures+normal/2–3variants anddead snags; it does not require acquisition of new native photographs or removal of live shelter canopies. Source now includes three1024-per-cell native albedo variants and matching image-derived normal atlases from unchanged512EZ-Tree originals; low512/no native normals. Output reconstruction/colour processing is explicit provenance, not new photographic detail. Original procedural microdetail overlays remain. Native UVs select all3cells consistently incolour/depth/distance; original positions/topology/navigation/perches untouched. Floweringtexture1024/512. Three independent baredead trunks/forks4.82m replace side-stem accents within existing occupied footprints, not newunqualifiedcollision sites.

New3unit tests and targetedrealhigh/lowWebGL+exactbaselineinvariants+9budgetviewsPASS(max2,379,664tris). Isolatednon-MSAA budget screenshots are unsuitableforart; fullcompositor baseline/candidateforest/jungle/overviewframes retain appearance with no white edgehalo. Completed earlier suites were not restarted. Source remains local until freshbuild/byte/browserqualified. Manta is now qualified andlive as described inOWNER-MANTA; old opening wording refers to the earlier vegetation-only milestone. Fullhardwareframe-rate/ownerartisticacceptance remains unverified; no claimofnativeFPS.

Follow-upfreshcompiledartifact: high/low31atlasmeshes, uploaded/active highnormalMaps, low512/no samplednormals,3dead-snags,exact319solid/canopy/terrain/92perch invariants and9targetedbudgetviewsPASS. Correctfullcompositor A/B reviewed; isolatedbudget-pass imagesretainedbutnotartacceptance. OnlyhardwareFPS/ownerartisticdonecriterionremainsunverified; fullGuideaccepted=false. No completedbaseline/weather/foot/model suites restarted.
