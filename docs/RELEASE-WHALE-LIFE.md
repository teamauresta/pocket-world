# Whale life correction — source candidate, not promoted

## Decision
The owner-supplied whale can work. No replacement model needed for convincing swimming. Its genuine rig is correctly oriented (+X forward, horizontal flukes), not a sideways fish animation. No GLB, geometry, source material, bone length or scale was changed.

## Why it looked dead
Source clip: **4.958333 seconds**. On the normalized 10-unit whale, tail-tip peak-to-peak vertical displacement is only **0.319**, of which root bob already contributes **0.162**. Actual skinned rear-surface centroid moves **0.304**, versus head **0.181**. Subtracting head movement, the source rear-surface stroke is only **0.141 units**; adapted it is **2.033**. Most apparent source motion is whole-body bob, not readable propulsion. Spine rotations are tiny (spine 2 quaternion-X span .00523; spine 4 .01258). Previous carrier translated at fixed speed, changed depth while level, then slowed to 15% for a three-second surface hold. Advancing clip time was not lifelike-swimming proof. Original daylight images: review/release-whale-before/source-*.png.

## Changes
- Authored swim preserved and phase-locked to a 3.6-second stroke.
- Clearly labelled **generated additive native-spine propulsion**: rotations only on existing spine 2–5 with posterior phase delay; vertical rather than lateral. No body proportion changes.
- Actual skinned tail-centroid stroke now **2.150 units**; head remains **0.181**. Tail-tip vertical range **2.381**, lateral **0.00945**.
- Forward-only qualified oval, continuous turns and surface passes; stroke-linked speed; velocity-derived pitch; curvature-derived roll. Maximum pitch .20 radians and bank .10.
- 48-second dive/rise/near-surface-pass cycle; night cruise, strike/storm deepening. **No verified blowhole air-contact landmark: this is NOT claimed as breathing.** No spout/fake contact.
- 1/30-second substeps, exact pause/reset, strike retained. Other species retain previous controllers and Euler order.
- Full animated support remeasured. Horizontal support increased to conservative 3D extent radius; vertical includes pitched nose/tail. Entire swept support qualified with interval padding against actual terrain, not a shrunken proxy.
- Turtle layer-30 cornea, SG defines, underwater callbacks and full compositor untouched.

## Verification
- node --test src/sea/*.test.js: **31/31 passed**, including two new actual-whale regressions.
- Actual whale 48s/1440-step regression: 65.15 units travelled, 1.94 depth variation, minimum conservative floor clearance 6.31. Every sample visible/clear; all-vertex checks every 2 seconds. Exact pause/reset, coarse-step equivalence, night/storm/lightning, single-tier far-view visibility. The normalized body-forward vector stays aligned with actual displacement (dot > .995), ruling out sideways carrier drag.
- review/release-whale-vertex-motion.json: 120 source/adapted actual skinned-surface measurements; release-whale-rig.json: native joints.
- review/release-whale-sequence.mjs: **PASS, 97 actual rendered frames across 48 simulated seconds**, fixed-camera full-world compositor, clear noon, .5s intervals; all nine actors clear at every capture, zero browser errors/GL errors, turtle eye layer 30 and zero transmission verified. Software WebGL, **not native FPS proof**. No direct renderer bypass. Viewer: review/release-whale-life/index.html; movie: whale-fixed-camera-48s.mp4.

## Scope
Only sea pack, new whale helper/test, this document and release-whale evidence. Parent owns API/build/promotion and owner review. Source/adapted close comparison stays stationary to reveal articulation; principal sequence is real moving controller with a fixed, non-following camera.

## Concurrent integration caveat
An initial attempt encountered concurrent land initialization error "Unsafe native habitat loop". The successful principal 97-frame capture subsequently reported all components ready (land 4, tiger 1, sea 9, birds 5, manta 1, tuna 2). No land files were changed by this task. Parent should still rerun readiness on its exact integrated/promotion candidate.

Original share and working GLB SHA-256 both remain df65c1e168c500f6696aa4edcc6b8a3153e359b57c2a08d7af447da369bdcdcf.

The principal browser sequence predates final telemetry clarifications and explicit pre-mixer restoration of additive bones. Changing-time locomotion and envelope are unchanged; restoration prevents same-time mixer caching from leaving additive offsets in a source-only comparison. The close comparison was rerun against final source, and the regression suite additionally verifies repeated same-time reset does not accumulate rotations.
