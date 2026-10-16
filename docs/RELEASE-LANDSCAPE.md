# Release landscape — opt-in candidate, not deployed

## Integration API (all defaults preserve baseline)

```js
import { buildLandscapeDetail } from "./world/landscape-detail.js";
import { buildRiver, configureRiverMist } from "./world/river.js";
const landscape = { releasePolish: true, quality };
scene.add(buildTerrain(hf, textures, landscape));
scene.add(buildLandscapeDetail(hf, landscape));
const reef = buildReef(hf, landscape);
const river = buildRiver(hf, tex.waterN, landscape);
const mist = configureRiverMist(buildMist(hf), hf, landscape);
```

Use existing placement, not duplicate terrain/reef/river. All releasePolish defaults false. quality defaults high for reef/detail; river/terrain/mist ignore quality to retain geography. Existing screenMats spread of river.userData.materials includes new impact shader automatically. Source water has its own transparent shader but deliberately shares the downstream uniform object, so the existing screen refresh updates both. Mist keeps existing screen uniforms. No update call: water and mist share U.uTime; paused simulation freezes them. configureRiverMist is idempotent, call before first render. It changes only the passed existing mist; no atmosphere file edits.

## Art direction

Quiet limestone/olive/terracotta reef gardens leave broad sand lanes, with low neutral rock retained outside gardens. Sparse mauve replaces fluorescent pink; no uniformly scaled-down coral. Every coral class and all eight SeaLife anemone homes remain. Low quality thins exact high-quality instances deterministically, never reseeds gardens. Terrain reef pigmentation uses matching muted sediment colours.

Peak uses aligned shallow broken laminae plus restrained strata seams, softer broad procedural bump and reduced dark fissure contrast. No terrain or skyline deformation. River water now covers the *existing carved upstream reach* (previously missing), visibly feeding the fall; this is a mountain seep/channel, not a newly invented summit lake. Width tracks the same noise used when carving. Directional threads and localized slope whitewater travel along increasing downstream arc. Broken, translucent fall strands and expanding low-energy impact rings replace a uniformly bright curtain. Existing mist is reduced in height/size/opacity and deterministically placed at impact instead of hiding the entire lower fall.

## Physical boundaries

No heightfield, river centerline, sea-floor function, tree/rock collider or navigation code edits. New geometry is non-solid surface relief, maximum vertex elevation 0.045 above the sampled heightfield (test tolerance 0.086); 109 patches / 654 triangles / one batched draw at high quality. River pebbles are submerged inside the channel, not on alligator banks. Peak details are laminae, not walkable ledges or new obstacle-sized rocks. Navigation topology remains the parent’s existing 319 solids by construction; final actual-world hash check belongs to parent integration.

## Component counts

Baseline reef: 971 instances / 382,982 triangles. Candidate high: 377 / 134,077. Candidate low: 224 / 83,835. Tall bright types (staghorn+sponge+fan): 519 -> 176, 66% fewer; larger reduction than the approximate half target, justified by composed sand corridors rather than a blanket instance cut. Rock retains 73/89, anemones 8/8. All nine categories remain. The full-scene 2.5M/260 acceptance gate is NOT inferred from component counts. New river adds one source ribbon and one impact draw; batched relief adds one opaque draw.

## Evidence and remaining acceptance

- src/world/landscape-detail.test.js: geometry/topology/heightfield invariance, source arc and levels, tiny non-solid relief, all habitat homes, high/low exact-instance subsets, material shader assembly.
- review/release-landscape-unit.log and release-landscape-world-tests.log: seven new / nineteen world tests passed.
- review/release-landscape-render.mjs: full original source application with all native animals, no lite/custom fixture; request-time opt-in without main edits. Matched five cameras and frozen time/noon/clear/calm; software WebGL, standard high-quality 4x MSAA pipeline. Output report records actual cameras/models/errors.
- Final compiled application, parent camera-matrix strict A/B, native renderer timing, final wildlife foreground framing and complete scene colour-pass budget remain parent qualification. No deployment, default activation, asset changes, dependencies or commits.

Initial review retained in release-landscape-render/ is **not a matched native-model acceptance pass**: workers were editing wildlife concurrently; baseline land and seaPack reported partial readiness, while after reported ready. Initial peak laminae were too large/flat, source water too specular and old mist hid impact; corrected geometry/specularity and configureRiverMist must be used. Final review uses release-landscape-final/. Frozen compiled parent replay is still required.

Additional physical correction: the old fall ended at +0.9 downstream, where actual bed height is 10.190 > pool level 9.747 (inside rock). Opt-in arc now starts exactly at existing source endpoint and ends at existing pool center +2.4, whose bed is 9.239. The heightfield is not changed. Impact foam/mist share that actual pool center; regression asserts endpoint over water.

Default-off SHA-256 geometry/index/instance-buffer comparisons against source 014aaa5 pass for reef, river and terrain (release-landscape-default-invariance.json). Material defaults remain the original shader paths; added object names/stats are diagnostic only.

River detail overhead is exactly 30 triangles / 2 draws (28-triangle source ribbon + 2-triangle impact quad), plus 654 triangles / 1 opaque relief draw. Existing fall stays 480 triangles. Combined geometric overhead 684 triangles / 3 draws; reef saves 248,905 triangles at high quality. Existing mist particle count unchanged.

Review limitation: total renderer.info includes shadow/postprocessing passes and is not the 2.5M/260 colour budget. Do not promote based on that total or call software render timing native GPU performance. Harness now separately records opaque/water render deltas for the next parent replay.

Second full A/B (release-landscape-final/report.json) has all native model parts READY on both sides, including nine sea actors; retained two harmless suppressed-Vite-client MIME console errors, not shader errors. It revealed too-specular source water and cliff-facing flat relief. Final source now makes upstream water transparent/edge-feathered with reduced sky reflectance, restricts relief to actual gentle ledges, and breaks fall opacity with downward temporal noise. Last source review is release-landscape-qualified/ (after only; before files remain in final/). Do not describe the earlier iterations as final acceptance.

Low-quality detail: 59 patches / 354 triangles, same peak ledges and exact subset of submerged pebbles. The baseline-invariance script also compares assembled shader text byte-exact against 014aaa5 for default-off reef/river/terrain: all three pass.

Budget instrumentation caveat: the first qualified after run’s colorPass field uses slice(-2); an owner lens render reuses the opaque scene, so this selects the tiny lens subrender, NOT full opaque geometry. Disregard this field for acceptance. Harness changed to retain twelve raw entries; parent must choose actual main opaque pass and exclude shadow calls (final strict budget still outstanding).

Final reviewed images in qualified/: full app all native parts READY, zero browser/shader errors; reef eye-height clearly shows whale, manta, coral fish against quiet sand/rock. Native shark is loaded but not in this particular camera framing, so whale+shark joint-frame proof remains parent work. River corrected camera reveals channel/flow but foreground bamboo still occludes part; no plants removed. Peak stratigraphy is intentionally subtle, not a replacement mountainous mesh. Fall is visibly translucent with impact-scale mist rather than a white blob; remaining rectangular upstream lip addressed by final 0.42-unit alpha taper and less uniform strand mask (lip-final/ capture).

Temporal frames at t=8,8.25,8.5 retain exact frozen noon/clear/calm weather/camera and show water-strand changes. This is rendered temporal evidence, not a simulated fluid solver. Source/current ripples and impact rings are deterministic shader animation; pausing U.uTime stops them.

Last-source lip-final capture completed successfully: all native parts READY, zero console/page/shader errors, t=8/8.25/8.5 images present and visually inspected; source SHA-256 matches. Raw waterfall opaque render delta 2,988,977 triangles / 263 calls **includes shadow submissions**; lens delta 4,736/2, water 82,886/6. This is not a strict colour-budget PASS. Final acceptance must use parent shadow-excluded counter. No background work remains.
