# Owner bird visual adapter — local qualification, not deployed

2026-10-14. New files only; no bird physics, main, shared loader, land, sea, package, deployment, or owner-original edits. Parent owns main-scene wiring and acceptance.

## Implemented

- `src/creatures/imported-birds.js` replaces **five existing jungle bird flight slots** by default. Total controller population stays **11** (2 eagle + 5 jungle + 4 gull), not 12. Optional explicit single-slot selection is tested; never hides a whole flock.
- Owner `dove_bird_rigged.glb`: 2,462 triangles, 75 bones, actual `Take 001`, duration 0.7666666508 seconds. Appearance is orange-breasted/dark-headed; generic truthful label, no recoloring or claim it is a white dove, scarlet macaw, or gull. Static eagle is deliberately NOT included; no pretend flap.
- Independent SkeletonUtils rig/mixer via existing loader, plus **owned material clones per actor**. Original texture/geometry remain shared, unchanged. Base authored opacity retained. Source clip is not rewritten.
- Exact `f.mesh.getMatrixAt(i)` drives placement/bank/heading/scale. Authored +Z → controller +X yaw +PI/2, established by Chest_M_035 → Head_M_043 and rechecked against actual carrier forward. No navigation/velocity/weather/perch edits.
- Full clip all-vertex envelope: 241 poses including endpoints, normalized basis size [1.1768149514, 0.7688522001, 1.2454323654], 5% margin. Fit is the minimum axis ratio into the **existing procedural flight envelope**, derived from geometry bounds plus actual shader's .55-span flap and .08-span dihedral. Current jungle fit is 0.9015314217 before controller's existing 1.6 scale. Not arbitrary size inflation.
- Runtime exact all-vertex local containment runs each apply, including arbitrary banks. Any envelope escape latches the existing procedural visual until explicit reset; no controller movement. Dense sampling is not an analytic proof between samples; runtime guard covers unsampled poses.

## Honest flight-only capability / coherent fallback

There are no authored fold/perch/landing clips. Do NOT advertise rigged talon grasp or a newly authored fold. The supplied clip runs at native rate scaled by controller flap intensity; zero flap holds the current genuine rig pose.

Landing switches **visually, not physically** through a progress-driven, depth-writing alpha-hash dissolve over first 40% of landing; supplied model is gone before flare (60%) and fold (65%). Procedural shader continues exact original fold/perch/wind on an owned palette-matched proxy. Takeoff fades back only over last 30%, and only after fold reopens. Perched is always procedural belly-support geometry, with no talons. Lightning/scatter follows the same unchanged controller and routes. The rejected red-macaw fallback is now repaired: an owned proxy has orange breast, charcoal head/beak, grey back and dark grey-green wings/tail, with elongated tail compressed to 48%. Both endpoints retain the same visible palette; no scarlet/blue macaw color change. This remains a dithered change between detailed imported and low-poly procedural silhouettes, NOT anatomically continuous rig morphing or an imported roost clip.

The fallback uses a separately material-owned InstancedMesh proxy with only the selected slot nonzero, and an independently owned geometry clone (shortened tail/matched vertex palette) plus the original live fold/flap attributes. Other slots remain untouched. The actor's original instance is zero-sized only after controller rendering. Restore is idempotent and only restores a matrix still equal to the adapter's zero mask, so a new controller render cannot be overwritten by a stale adapter matrix.

## Parent integration contract

Do not alter controller API or call an unqualified fake clip. Load explicitly using existing asset API:

```js
import {loadImportedAsset} from './creatures/imported-assets.js';
import {createImportedBirds} from './creatures/imported-birds.js';
const ownerBirdAsset = await loadImportedAsset({url: OWNER_APPROVED_MODEL_URL});
const ownerBirds = createImportedBirds({birds, asset: ownerBirdAsset});
// Optional one-slot trial: selections: [{key:'macaw',indices:[0]}]

// EVERY controller update/render path, including test/inspection hooks:
ownerBirds.beforeRender();
birds.update(simulationDt, simulationTime, env); // existing statement unchanged
ownerBirds.afterRender(simulationDt);             // render-only/paused => 0
// Then render the scene. Shared U.uTime remains the existing simulation clock.

// Reset:
ownerBirds.beforeRender();
birds.resetForTest();
ownerBirds.resetForTest();

// Teardown (asset remains caller-owned):
ownerBirds.dispose();
ownerBirdAsset.dispose();
```

Do not attach another copies-of-birds group outside this adapter. Parent may expose `ownerBirds.snapshot()` for tests/debug. Runtime controller keys remain `macaw` for compatibility; **UI population/inspection text must call selected slots owner-supplied flight birds / procedural roost fallback**, not scarlet macaws. Imported meshes and fallback proxy already carry truthful userData labels; existing UI inventories based solely on flock key require parent adjustment. Explicit public asset path/copy/licensing is parent's responsibility; harness reuses read-only review copy. No original or public asset file created here.

## Reproduction / evidence

- `node --test src/creatures/imported-birds.test.js`: 5 tests (slot isolation, restore, fresh render precedence, skeleton/material/mixer separation, exact pause/reset, controller nonmutation, progress transitions, dense envelope, fail-closed reset).
- Existing Vite: `http://127.0.0.1:4174/review/owner-bird-integration-evidence/`. Actual Birds + dual baseline controller, renderer, fixed sample branches. No new server.
- `node review/owner-bird-integration-qualify.mjs`: browser assertions, exact all-state controller comparisons, 24 arbitrary direction/bank probes, dt0/reset, two actual rendered deformations, 960 independent full-loop pose probes, wind/perch anchor checks, strike/recovery, actual Heightfield all-vertex clearance. Report and close frames in `review/owner-bird-integration-evidence/`.
- `flight-a.png` / `flight-b.png` show actual supplied skins with distinct genuine wing poses; `landing-transition.png` honestly shows fallback dissolve; `perched-fallback.png` shows existing folded sculpt at branch support datum.
- `first-failed-report.json` retained. Initial skin guard used updateWorldMatrix which does not refresh SkinnedMesh.bindMatrixInverse; corrected to updateMatrixWorld before CPU skin containment, then reran. No failed first-pass result counted as accepted.

## Final verified result

5/5 Node tests; 49/49 browser assertions, zero page/console errors, WebGL error 0 and context retained. Two rendered poses changed 28,969 pixels and maximum skin coordinate 1.11646 world units. Actual Heightfield replay: 600 updates / 1,370 visible imported-actor samples, minimum all-vertex terrain clearance 8.27575 units, zero envelope faults, byte-exact controller snapshots against baseline. Five-instance adapter CPU apply averaged 2.381 ms (max 4.2 ms) in this software-browser run; not hardware FPS. Flight scene including original eagle/gull flocks and branch datums: 15 draw calls / 59,264 reported triangles. Full island crowd/foliage occlusion remains parent integration QA.

## Remaining limitations / acceptance gate

No main-island visual deployment or full-density hardware FPS qualification; this is sandboxed Snap Chromium / ANGLE SwiftShader rendering, plus real Heightfield replay. Dense per-frame CPU skin checks have measurable cost; one-slot selection is available. No new LOD needed for 2,462 triangles per imported bird, but bones/mixers/draw calls are extra. Each five-slot fallback proxy carries five zero/nonzero instance slots to preserve attribute-index semantics (bounded overhead), not five live actors. Directional-shadow dissolve is now qualified with owned depth materials and explicit shader fade uniforms; both intermediate silhouettes fade instead of casting an opaque union. Point-light custom-distance shadow fading is not implemented/claimed. No analytic every-time terrain clearance guarantee, no talon IK, no texture-identical or anatomically identical fallback, no claim static eagle became animated. Embedded CC-BY-4.0 is a provenance clue: parent retains supplied metadata attribution and confirms redistribution terms before publication.


## Appearance continuity repair — 22:46 parent correction

Completed the bounded proxy route rather than inventing an unqualified fold/talon pose on the imported rig. New helper: src/creatures/imported-bird-fallback.js. Parent API and controller unchanged. Source GLB textures/materials untouched; original procedural position/color buffers verified identical against a fresh controller. Only proxy-owned geometry/colors change; live fold/flap channels remain shared read-only references. Exact source belly support minimum -0.09640111774206161 preserved. 143 full vertex shader fold/beat combinations remain within the original backend's corresponding envelope.

Actual near flight, half landing dissolve, late landing proxy, branch-supported perch, half takeoff dissolve, and three directional-shadow views inspected. Palette approximated from the visible supplied bird, not a claim of sampled texture identity: breast #e58f67, head #292d2b, wings #42483f, back #b8bdb7, tail #343c36, beak #343633. Proxy remains low-poly, belly-supported and without talons. Its shape/texture detail is simpler, but no red/blue macaw patches remain and landing/takeoff retain continuous controller-driven opacity.

Shadow repair caught a real Three contract: RGBADepthPacking does not apply material.opacity to diffuseColor.a. Setting alphaHash/opacity alone did not fade the silhouette. Owned depth onBeforeCompile now chains the original flap/fold hook and adds an explicit uniform + stochastic depth-fragment discard. No shared customDepthMaterial mutation. Real shadow-only pixel proof (no visible material/camera change): half versus none 10,159 changed pixels; half versus opaque union 11,362; opaque union versus none 11,692. Half shadow is visibly stippled/faded, not an opaque double silhouette.

Verification delta: **6/6 unit contracts, 12/12 targeted browser continuity checks, zero browser errors**, WebGL error 0 in all three shadow captures. Original report.json 49/49 and unit-tests.log 5/5 preserved, not overwritten or wholesale rerun. New continuity-report.json, continuity-unit-tests.log, continuity.log and eight continuity-*.png frames retain repair proof. Reproduce only changed cases with node review/owner-bird-integration-continuity.mjs. Existing actual Heightfield/flight envelope evidence remains unchanged because imported normalization/controller matrices are unchanged; proxy support/envelope newly verified above. No publication/main/controller/otherworker changes.
