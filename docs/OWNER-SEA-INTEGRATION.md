# Owner sea integration — bounded tuna backend

## Scope and truthful eligibility

New source: src/sea/imported-swimmers.js, tests alongside. Original manta adapter, SeaLife, sea reactions, materials, main and owner GLBs untouched by this task.

**Important roster correction:** current SeaLife has silver/bluetang/yellowtang/angel/idol/clown, three sharks (kind fish), one manta, two turtles. There is NO whale controller/body. rigged_whale.glb has a real 4.958333s clip, 10,068 triangles and suitable +Z forward, but replacing a shark with a whale silently changes species and would not supply whale breathing. A new whale controller is outside this visual-only assignment. Explicit kind whale therefore rejects; do not wire it to life.sharks or life.turtles. No whale shipping claim.

Tuna uses existing silver-school slots, explicitly labelled tuna visually; these retain school-fish behavior, not a claimed adult-tuna ecological simulation. Default two imported members, maximum eight enforced. Other silver members remain procedural. No broad 170-clone rollout. school_of_fish is nine authored fish distributed across one rig/clip rather than one route actor and is not accepted as a tiny cluster inside one controller. Heavy shark/dolphin and static turtle remain excluded.

## API and exact parent wiring


auto-fetch is deliberately absent. Parent supplies its private published URL and attribution:

~~~js
import {loadImportedAsset} from './creatures/imported-assets.js';
import {attachImportedSwimmers} from './sea/imported-swimmers.js';
const tunaAsset = await loadImportedAsset({url: import.meta.env.BASE_URL+'owner-models/tuna.glb'});
const importedSwimmers = await attachImportedSwimmers({
  asset:tunaAsset, entry:life.species.find(e=>e.key==='silver'),
  kind:'tuna', indices:[0,1],
  onTrace: event => { /* store observable exceptional support transitions */ },
});
// Immediately after life.update(dt, env), also after the existing manta update:
importedSwimmers.update(dt);
// Immediately after life.resetForTest():
importedSwimmers.reset();
// On teardown/failure, instance adapter FIRST, then shared asset:
importedSwimmers.dispose(); tunaAsset.dispose();
~~~

Keep loading error handling and parent status explicit. No main hooks or public model copies were added here. The published URL above is a parent wiring example, not a claim that that file exists. Keep reset hook after controller reset (which replaces agents). Return snapshot() in the owner debug state.

API: async attachImportedSwimmers({asset,entry,kind,indices=[0,1],samples=720,onTrace}); returns update(dt), reset(), snapshot(), dispose(), actors[], instances[], support, sourceEnvelope, ratio, fallbackMesh. Only tuna profile is supported. Exact authored clip Armature|ArmatureAction (3.458333s), +PI/2 yaw converts measured +Z head to controller +X. Center anchoring only, no foot/ground offset. Measured uniform ratio 0.528297 from a normalized unit asset, fitted conservative length 0.6053 against controller support length 0.8882 (68%, not a tiny hidden model). School fish retain their existing normal/night behavior; no new storm-depth or breathing behavior is claimed. Both original tuna clips were measured; selected one is in-place genuine skin motion.

The immutable source envelope is fitted uniformly with 4% margin to ORIGINAL controller support. Reject if fitted length is below 50% of controller support length; no tiny fallback. Runtime complete per-bone convex envelope is checked every pose; a failed pose restores only that selected procedural member with an explicit transition trace. No ordinary swimming trace spam. Unavailable water is a controller state, not a false bounds failure. Per-instance independent SkeletonUtils skeleton and AnimationMixer. Source material/texture/geometry unchanged; owned material clones compose underwater shading. A private procedural InstancedMesh copies original matrices then hides selected slots; original matrix buffer and all controller state stay read-only. No dt=0 clip advance. Original visible state restored on disposal.

## Assets / attribution / license

Source remains READ ONLY /path/to/private-assets/pocket-world/2026-10-14-3d-models/tuna_fish.glb. Existing review copy used by qualification: review/owner-model-evidence/assets/tuna_fish.glb. SHA256 6d0d719d5196c744b7813a6079c6fe245126f1c6963d91a5285d62cf5ede28c0.

Tuna Fish — GoldenZtuff (https://sketchfab.com/dhjwdwd). https://sketchfab.com/3d-models/tuna-fish-c5fad940863f47f784d792ca95e16b42 . Embedded CC-BY-4.0 http://creativecommons.org/licenses/by/4.0/ . Runtime orientation/scale, animation and underwater shader adapted; original bytes unchanged. Parent must preserve credit/source/license in About and attribution payload. This task authorizes no public package/publication.

Whale assetfactory; SKETCHFAB Standard https://sketchfab.com/licenses; source https://sketchfab.com/3d-models/rigged-whale-96ea18a2857443d485a12082418071ea; SHA256 df65c1e168c500f6696aa4edcc6b8a3153e359b57c2a08d7af447da369bdcdcf. Inspected only, no redistribution/public license clearance. Existing manta CC-BY-NC attribution/adapter untouched.

## Evidence and remaining qualification

- review/owner-sea-integration-probe.json: measured authored full-cycle coarse support, axes and actual roster.
- node --test src/sea/imported-swimmers.test.js: explicit rejection, independent instances, pause/reset, source/controller invariance, forced fallback restoration, no repeated trace, unavailable/reset-agent handling.
- node review/owner-sea-integration-qualify.mjs: real GLB; six clear/cloud/rain/storm/night/night-storm controller scenarios with lightning; baseline equality and read-only matrices; full cycle all-vertex off-grid support; independent actual rigs; linked shaders, pixel motion, close front/side frames. PASS in review/owner-sea-integration-evidence/report.json: 3,600 adapted controller steps, six exact baseline comparisons, 242 off-grid all-vertex poses, zero fallback/outside points, 0.008059 minimum local support margin, 0.227986 actual skin motion, 18,866 changed pixels, GL error 0, all programs linked. Close front/side frames visually reviewed: original silver/blue texture, intact eyes/fins/tail.
- review/owner-sea-integration-world-evidence/report.json PASS: 48 actual rendered off-grid poses across full authored cycle, all rendered vertices above seabed/below water, zero local support fallback, exact controller placement, GL0/linked programs. World close PNG visually confirms a readable textured tuna among existing fish. Its renderer counters are cumulative (autoReset disabled) and NOT per-frame budget evidence. Manta was still loading during this synchronous follow-up, so this does NOT certify combined manta/tuna budget or readiness; parent final integrated run required. One HMR-interrupted attempt retained as interrupted-hmr.json.
- First CPU run exposed stale attached-skinned bind inverse immediately after actor placement. Fixed by updating actual actor matrixWorld/skin bind matrices before envelope checks; original failure retained as owner-sea-integration-unit.log, passing follow-up owner-sea-integration-unit-fixed.log.

No LOD generated: tuna 5,989 exceeds strict 5,000 far target, while below 20,000 near target. Parent must check whole-scene <=2.5M triangles /260 calls across actual cameras with other new assets, and decide distance policy. No hardware FPS, mobile, public license, deployment or final main integration claim. Two clones add 11,978 authored triangles (transparent double-pass can increase renderer counts), measured four draw calls / 6,561 rendered triangles per clone in the isolated view; original procedural batch still submits hidden zero-matrix slots. Do not describe that as removed GPU work.


## Far-detail follow-up (supersedes earlier open far-LOD gap)

Parent renderFrame hook, **after controller/adapter update and before every render/capture**:

~~~js
importedSwimmers?.updateDetailView(camera,{quality:'high'}); // 'high' or 'low'
~~~

Without this hook the previous all-near behavior is unchanged. updateDetailView(null) explicitly restores that old behavior. High uses distance 8..14 world units; low uses 5..9. These are per-actor camera distances, not one whole-school toggle. A smoothstep distance weight drives complementary stable screen-door fragment discard. Both meshes render only inside the transition range; at the far endpoint the authored actor is actually invisible to render traversal and submits **zero** GLB triangles. No opacity/material transparency rewrite; authored texture/alpha semantics retained. Each near instance has owned material clones; each far instance owns geometry with one aSwim attribute, material and matching custom depth material. Source materials, geometries, animation and controller buffers are never changed. Original silver/shadow-disabled policy preserved; no new shadow casters.

Far backend is explicitly the existing qualified **procedural silver fish**, not a decimated tuna or a claimed original-model LOD. Its fixed scale matches the near reference length (never expands original support); same position/heading/controller and original shader tail beat are retained. It is a low-detail fish silhouette, not species-identical texture/anatomy. Budget: source far geometry 680 triangles; one draw per visible far actor. The existing procedural remainder still submits a hidden zero-matrix slot costing another 680 triangles per selected actor. Therefore conservatively attributable far cost is **1,360 submitted triangles/actor**, below 5,000; not merely hidden high-poly triangles. Transition temporarily renders both near and far and must be included in parent's combined-scene gate.

View selection is deterministic and has no clock: camera movement updates LOD even while paused, but never advances animation. Reset preserves active camera/quality and recomputes visibility; no one-frame near flash. Unsupported-water/support-failure handling remains separate from LOD and does not produce normal distance-change trace chatter. snapshot().instances reports detailWeight, detailBackend, farVisible. Detail changes leave authored mixers running normally offscreen, avoiding a phase jump when returning near. No hardware performance improvement beyond draw/triangle reduction is claimed.

Delta tests only: node --test --test-name-pattern='LOD' src/sea/imported-swimmers.test.js (2 new tests); review/owner-sea-integration-lod.mjs (real renderer near/mid/far matched-distance A/B, 25-step screen-door sweep, source invariance, pause/reset and actual draw submission). Previous 12 tests /3,600 weather steps /242 skin poses /48 world renders retained rather than replayed.
