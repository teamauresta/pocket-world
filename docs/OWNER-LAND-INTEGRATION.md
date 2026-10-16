# Owner land-model visual integration

Implementation: `src/creatures/imported-land.js` + `imported-land-ik.js`. Original GLBs untouched. Main scene wiring belongs to parent; no deployment or shared-controller edits here.

## Root causes repaired

- **Left/right were reversed.** Source +Z forward is rotated +PI/2 to controller +X; source R becomes positive controller Z (controller L). Prior adapter pulled each leg across the body. Correct mapping is explicit, including weighted IK/FF hoof roots.
- Those IK roots genuinely deform the hooves but are disconnected from lower-leg hierarchy. Moving only IK roots gives perfect sole metrics with detached shins. Every frame now closes the actual deform chain onto its corresponding weighted hoof root.
- Hind legs have three real links; the old two-link reach sphere discarded the proximal segment and lowered the entire animal, causing the crouch. Front scapular link also matters. Full-chain length-preserving FABRIK, seeded with measured Idle axes, replaces incomplete two-link closure. No limb translations/scales are written.
- Actual authored ankle offset is sampled **before** post-mixer IK every frame. Cached pure authored poses are restored before mixer evaluation; corrected poses never leak into mixer next-frame caches. Rotation-only correction preserves source animation of body/head/tail and actual Walk timing.
- Scale overwrite was checked, **not** the cause: loader normalization is on orientation child, root starts at identity. Root span ratio is multiplied nevertheless. Measured scale and full transformed node evidence: review/owner-land-integration-diagnose.json.
- Only small full-chain reach settlement is permitted (maximum 0.105 controller-local units), not the old 0.22 whole-body crouch. Stag has zero settlement in current 13s fixtures.

## Parent API / exact wiring


default asset loader supports these two source files; no legacy-material repair needed:

	const stagAsset = await loadImportedAsset({url: STAG_URL});
	const deerAsset = await loadImportedAsset({url: DEER_URL});
	const backends = fauna.agents
	  .filter(a => ['stag','doe','fawn'].includes(a.r.key))
	  .map(agent => attachImportedDeer({asset: agent.r.key === 'stag' ? stagAsset : deerAsset,
	    agent, parent: agent.mesh.parent, hf}));

Call backend.update(dt) after authoritative Fauna pose + LandMotion updates, not instead of them. Parent now coalesces visual-only calls once per rendered update with summed elapsed dt; Fauna/LandMotion still run every 1/60 step. Walk action phase is synchronized to the final authoritative phase before mixer evaluation. On a zero-delta refresh call update(0); repeated unchanged update(0) is frozen. Pass hf.heightAt for nonwalking grounding. Adapter mirrors authoritative mesh transform, hides procedural mesh for supported states, leaves physics/navigation/contacts intact. Same-rig reaction overlays are applied only after pure authored pose caching. Do not hide/remove the controller object permanently. Backend exposes root, instance, feet (true sole vertex/control/chain metadata), ratio, lengths, snapshot(), dispose(). Dispose restores prior procedural visibility and releases only owned skeleton/materials; dispose cached assets after all instances.

Current runtime source URLs for QA only: /review/owner-model-evidence/assets/Stag.glb and Deer.glb. Parent must choose packaged URLs and reconcile license before distribution.

## Capability boundary

- stag: supplied Stag; doe: supplied antlerless Deer. Fawn uses **smaller same Deer**, not a distinct juvenile/proportions/spot-pattern source.
- Walk: real authored Walk body/head/tail pose, controller-phase synchronized; measured actual chain and sole correction to LandMotion stance/swing contacts. No sliding-group-only walk and no wrong 17-bone retarget.
- Idle, graze/Eating, alert/Idle_2: authored clips with terrain sole correction.
- **Gallop remains unqualified. Escape now retains the imported rig using honest rapid Walk**, phase-synchronized to authoritative accelerated locomotion and corrected to its actual contacts. `motion: rapid-walk` explicitly distinguishes this from authored Gallop. Urgency comes from controller reason startle/tigerflee as well as constrained escape metadata (ordinary successful flee does NOT set agent.escape). Authored Gallop remains unchanged in the asset.
- Crouch/startle/wind/no-cover shelter: smooth same-rig shallow brace (0.035 local root lowering + 0.12 rad neck overlay), full hoof closure. Shake: smooth same-rig ±0.12 rad head shake, no material or backend swap. These are deliberately modest procedural overlays, not claimed authored clips. Sleep/lie/sit/roll/rear retain an explicitly reported standing-rest substitute, NOT a claimed lying/rolling/rearing performance. Unknown future actions report unsupported-hold. Imported appearance is continuous; parent can inspect `motion` / `unsupported` in snapshot.
- Material maps/colors preserved. Per-actor material clones own wet shader treatment, shared source materials never mutated. Near/far both use original geometry: stag 3,670 / Deer 2,098 triangles, already under strict 20k/5k. No invented LOD.

## Evidence and remaining gates

Reproduce using existing Vite 4174 and existing sandboxed Snap Chromium/Playwright:

	node --test src/creatures/imported-land.test.js
	node review/owner-land-integration-qualify.mjs review/owner-land-integration-replay
	node review/owner-land-integration-actions.mjs review/owner-land-integration-actions-replay

Independent browser harness reads real getVertexPosition plus matrices and actual lower-leg ankle closure; not merely status.error. 780 fixed steps per species/terrain (flat and 0.18 slope), starts/stops and ~PI turn, repeated pause, side/front/quarter renders. Existing thresholds are retained: sole slip <.035, sole/ground/closure <.01, segment delta <.001, zero IK translation. Body root attachment may move as authored, but actual anatomical limb-segment lengths remain fixed within export floating-point drift.

Pre-reaction walking acceptance: **PASS** for all six species/terrain fixtures, 4,680 fixed steps; 18 rendered side/front/quarter images. Nine numerical regression tests PASS. At that checkpoint, authored Idle/Eating/Idle_2 + escape/crouch fallback, material ownership and disposal checks PASS; fallback policy is superseded below. Earlier failures/HMR interruptions and each source checkpoint remain under review/owner-land-integration-*; not deleted or represented as passed.

No full-island obstacle/animated-envelope clearance qualification, native hardware frame-time, licensing grant, distinct juvenile model, or imported authored-Gallop performance claimed. Same-rig reaction continuity is covered by the follow-up below. Parent must run integrated weather/navigation acceptance after wiring; this visual-only adapter does not weaken existing physics tests.


### Final measured results

- Reports: review/owner-land-integration-acceptance/report.json and review/owner-land-integration-actions-qualified/report.json.
- Worst independently skinned stance slip 6.75e-9; sole target error 4.40e-8; ground error 1.08e-8 world units.
- Worst actual ankle closure: stance 1.02e-5; swing 5.50e-4 (fawn slope), both below unchanged .01 gate.
- Maximum anatomical segment length drift 3.93e-7; IK translation delta exactly zero; all repeated dt=0 pauses identical; all fixtures turn ~3.16 radians.
- Stag and fawn maximum visual settlement zero; doe peak .1761 world units (bounded .105 local) during transition, not permanent crouch.
- Final rendered proof in review/owner-land-integration-acceptance/{stag,doe,fawn}-{flat,slope}-{side,front,quarter}.png. Inspected close side/front/quarter renders: upright silhouette, coherent knees/hocks, attached hooves; earlier folded-hind-leg/crouch iterations rejected. Source low-poly faceting and same-Deer fawn limitation remain visible.
- Browser render is software WebGL, not native hardware performance. High-frequency shadow-map stipple in some lit lab frames is not source recoloring.


## Reaction-continuity follow-up (22:50 request)

Prior 4,680-step / 18-frame walking acceptance remains preserved and was not replayed. New focused harness: review/owner-land-integration-reactions.mjs. It injects the existing strike state, then runs actual Fauna/LandMotion startle/accelerated flee/return; no-cover shelter and shake are explicit visual-state fixtures, not a claim of new canopy route qualification. No physics module edits. Same .01 ankle/sole/ground, .035 slip, .001 length gates; each frame also checks imported visibility and procedural invisibility. Frozen snapshots remain identical. Initial exploratory reports retained, including the rapid-walk-label failure that exposed agent.escape not representing ordinary flee.


### Deterministic reset API

Call adapter.resetForTest() (alias reset()) AFTER fauna.resetForTest(). It stops/rewinds all mixer actions, zeros mixer time, restores the original pure authored reference transforms/cache, clears pause key, overlay clocks and urgency, then evaluates the already-reset authoritative agent with update(0). Prior renderAgent(a,0) callbacks do not contaminate reset. Targeted review/owner-land-integration-reset.mjs compares every bone world matrix, actual skinned sole, status and mixer clock across three resets after Eating/Shake/fade contamination for each species: nine identical repeats, mixer time zero, PASS. No broad walking replay required.


Focused reaction acceptance **PASS**: review/owner-land-integration-reactions-v2/report.json, 1,848 total frames/18 stage renders, all three species; 300 rapid-walk escape frames each, zero backend visibility swaps. Worst actual closure .0006882 (<.01), sole error 4.60e-8, slip 1.61e-8, segment drift 8.18e-7, IK translation zero. Repeated pause exact. Reaction-only reach settlement may extend from normal .105 to .190 local units during accelerated motion and decay on return (doe peak .319 world); this is needed for its existing urgent swing targets, with genuine segment lengths preserved. Normal walk/idle/graze path and thresholds unchanged. Final close escape/return frames inspected: coherent upright limbs and same source appearance; deeper crouch, full-body shake, authored Gallop and lying-sleep performance remain intentionally unclaimed. Unit suite now 12 PASS. Old pre-continuity actions test expects procedural fallback and is retained as historical evidence, not the current capability contract.


## Actual-island ankle closure follow-up (14 October, late review)

The independent df464 review correctly found a **new ordinary-walk** failure, not the accepted historic escape limitation. Exact source replay reproduced fawn index 5 / wristL swing at t=4.45, controller root [13.471836153535799,4.000657849843856,-15.06932533766652], closure **.04886454377**. Measured chain reach .97544965 versus hip-to-weighted-ankle distance 1.02431419 proves a genuinely unreachable target: FABRIK was reporting the correct residual, not failing to converge. Signed axes, sampled authored ankle offset, and limb lengths were correct. The .105 local settlement cap truncated the needed root correction; ordinary terrain-grounded free contacts were also wrongly excluded from settlement.

**Change:** only imported-land.js: include terrain-grounded free contacts and allow bounded deficit-driven normal settlement up to .170 local units, with unchanged .190 urgent maximum. No permanent drop is added. Existing per-frame reach calculation still selects zero when already reachable. No bone translations/scales, target movement, controller changes, rig swap, or model/material edits. Solver unchanged. The numeric .01 gates remain unchanged. This supersedes earlier .105 normal-settlement bound text above; prior evidence/versions are preserved, not relabelled.

**Focused source qualification:** review/owner-fawn-world-fix-qualified/report.json: original 6-second actual-island reproduction, plus real rendered-update chunk paths at 60/30/10 Hz (authoritative physics still 60 Hz), plus 3 seconds of actual startle/rapid-walk with all five deer. 15,000 independently measured hoof samples, 2,900 stance samples. All closure/skin/ground/slip/length/zero-translation/pause gates PASS. Max actual ankle closure .00113064; skin-to-target 4.345e-8; stance terrain .00567029; fixed-target stance slip 3.152e-8; anatomical segment drift 8.299e-7; IK translation exactly zero. Original 459 stance samples/terrain max .00229806 unchanged. Index-4 doe stays idle in normal fixture (zero stance, explicitly not counted as walking); startle fixture supplies its 28 stance samples and 28 rapid-walk frames.

Exact former failure now closure **.00000971789**, same controller root and sole to ~2e-9. Visual root drop .17925896 world (.170 local), versus .11071877 old: additional .06854019 world, no resize. In normal 60-Hz replay, each actor returns to zero settlement on 321–360 of 360 samples; not a permanent crouch. Heading ranges include fawn 2.59 rad and startle 3.04 rad. Peak correction changes are recorded, not hidden: fawn max per-60-Hz drop delta .12867 world; thus this proves bounded pose safety, not imperceptible temporal smoothness. General arbitrary terrain/obstacle envelopes remain unqualified.

14 land unit tests PASS, including two new exact-coordinate regressions proving original unreachable residual and root-only closure without stretching. Commands:

    node --test src/creatures/imported-land.test.js src/creatures/imported-land-world.test.js
    node review/owner-fawn-world-fix-probe.mjs <new-output-directory>
    node review/owner-fawn-world-fix-qualify.mjs <new-output-directory>

Original source snapshot/hashes: review/owner-fawn-world-fix-original/. Baseline failure: owner-fawn-world-fix-baseline-v2/report.json. Initial baseline harness mismatch with parent's new ownerVisual hook is retained separately (baseline/report.json); corrected harness uses I.ownerLand. Previous broad flat/slope/reaction suites not replayed. No deployment/commit/build/server/profile/GPU changes.


Final actual-world visual inspection: **owner-fawn-world-fix-close-v3/exact-hoof.png** and **next-hoof.png** visibly show continuous tan lower-leg/ankle into the dark hoof in the exact former failure and +.1s ordinary walking pose; distinct changing poses, no detached floating hoof. Foliage remains present, no animal was relocated/hidden. The low-poly ankle bends sharply with this source's separate weighted hoof, but the surfaces meet. **close-v2/exact-opposite.png** shows upright full-body context (not a permanent crouch), with some flower/grass occlusion. Camera-only minDistance .1 and near .03 avoid inherited scene camera clamping/clipping; source camera unchanged. The alternate close-v3 front angle is obstructed by another animal and is NOT visual proof. Earlier obstructed shots retained. Close-only reports say CAPTURED, not numeric PASS; close/report.json inherited a vacuous PASS and is explicitly disqualified in close-classification.md. Actual qualification is qualified/report.json.

Performance note for parent: unreachable FABRIK cases take its direct straight-line branch, **not** the 120-iteration loop. The exact rejected fawn case was unreachable by .0488645. This repair adds reach allowance and therefore cannot honestly be claimed a measured solver/performance optimization. Native performance remains parent-owned; no new performance claim.
