# Supplied eagle — safe native flight adapter + faithful far LOD

## Current result
Native source eagle identity is retained through clear/rain/night/lightning/recovery. Terrain penetration is fixed by an **opt-in controller envelope**, not a visual offset, shrink, camera trick or clearance waiver. Other birds/default physics are unchanged. Native full folded roost is **not** claimed: the explicit policy is **bounded-flight-only**, pending parent/owner acceptance of that limited behavior.

## Parent integration (main/UI remain parent-owned)

default factory name: `createOwnerEagles` from `src/creatures/owner-eagle.js`.

```js
const eagleAsset = await loadImportedAsset({url:'./owner-models/native/eagle.glb'});
const eagleFarAsset = await loadImportedAsset({url:'./owner-models/derived/eagle-far.glb'});
const ownerEagles = createOwnerEagles({
  birds:I.birds, asset:eagleAsset, farAsset:eagleFarAsset,
  camera, flightPolicy:'bounded-flight-only', // explicitly disclose no folded roost
});
// Keep the independent dove hooks unchanged. Eagle owns only eagle indices 0/1.
ownerEagles.beforeRender();
I.birds.update(dt,time,env); // OR existing render(); exactly once, no extra physics
ownerEagles.afterRender(dt); // dt=0 for render-only/paused frames
// after existing controller reset:
ownerEagles.resetForTest();
// teardown, in order:
ownerEagles.dispose(); eagleFarAsset.dispose(); eagleAsset.dispose();
```

Install before controller starts landing/perched/takeoff; factory rejects late roost installation instead of teleporting it. Factory installs its per-slot native policy automatically; no extra main safety call required. It removes owned policy on disposal. Near/far both use native generated wing poses with identical phase. Camera distance threshold 45 world units, hysteresis 43/47. Set another camera through `setCamera(camera)`. With no farAsset, near only; with no camera, near only. LOD only switches geometry, never physics or identity.

Exposes `group, entries, beforeRender, afterRender, resetForTest, setCamera, snapshot, clearanceRequirements, dispose`. Entry has f/i, carrier, fit, motion (near), far, scale, target, weight, fault, lod. Snapshot includes generated/static labels and actual renderTriangles. Root transform is authoritative existing Birds matrix. UI should say **Owner eagle — generated flight; flight-only weather policy**, never authored flight/perch. Source flock counts are eagle=2/macaw=5/gull=4; retain existing five dove/macaw slots, not replace all gulls.

## Geometry and materials
- Original `public/owner-models/native/eagle.glb` is byte-exact SHA256 `d185ca682ac8f938dd9ab69237cfae6c1619fd20a3e46c59ce6762e5da666d7a`.
- 10,828 triangles, seven source primitives, six original materials, original base-color/specular maps. **No source rig or clips.** Native rest pose: wings spread, talons extended; model forward -Z mapped by rigid yaw -PI/2 to controller +X.
- Only separate wing primitive Mesh_0041 deforms. Head/body/feet/tail rest positions are unchanged. Uniform fit preserves proportions; world rest span 3.350744. Rest bake rounding max 2.0744e-8; rest returns bit-exact cloned positions/normals. Generated 1.05 Hz mirrored shoulder crease + lagged distal wrist, mild glide dihedral. No old 17-bone bird hijack or eye recoloring.
- Optional `derived/eagle-far.glb` is **4,798 triangles**. All seven parts remain; both eye and beak primitives unchanged. Materials/textures/nodes unchanged; UV/source normals interpolated by already-installed Blender CPU simplifier. Original GLB untouched. Independent `individual-eagle-manifest.json`; global manifest unchanged. Same-camera close inspection at glide/up/down remains recognisable and texture-faithful. Close views use original near mesh, not simplified substitute.

## Terrain correction / invariants
Only expanded-authorized `src/fauna/bird-reactions.js` changed outside the new eagle helper. `f.nativeFlightPolicies` Map activates selected slots only. Conservative world radius ~2.57072 encloses all native geometry across wing poses/banks (near+far union). Actual Heightfield is bilinear: sample every grid-line intersection and footprint rectangle endpoints for a complete terrain maximum over sphere projection, then add sphere radius + .2 clearance. Predictive climb looks .5/1/1.5 seconds along current horizontal heading. Current full-footprint floor constrains actual controller position on **every fixed 1/60 step**, including recovery/scatter. No per-frame vertex-world/inverse skin guard or second physics integrator.

- **4,200 consecutive 60Hz frames / 70s** clear/rain/night/lightning/recovery: all native vertices checked every frame; minimum terrain clearance **3.537765**, maximum center step **.158803**. Both native weights stay 1, zero envelope faults. This is conservative clearance, not a claim of exact terrain-following flight.
- Exact pause/reset and 120 fine steps versus one 2-second update controller equality pass.
- Unaffected macaw/gull agents and matrices remain exactly equal during native policy.
- Separate baseline-source comparison: **all 11 default agents bit-exact for 4,200 steps** with policy absent, including weather/strike/recovery. Existing dove/skin tests **11/11 pass**.
- Native source/ownership/clearance/LOD tests **11/11 pass**. No source models or existing non-eagle controller policies changed.

## Folded-roost feasibility and explicit limitation
A rendered weighted shoulder sweep/down-fold trial preserves body/head/talons but leaves feathers fanned as trailing paddles, not a compact layered folded wing. It has no articulated feather overlap/elbow fold or authored gripping pose. Trial image `rejected-fold-trial.png` retained; trial deformation exists **only in review fixture**, not runtime. Do not force-fold it, call extended claws a grip, or switch to a procedural eagle at landing.

**Proposed/implemented bounded policy:** native eagle continues safe circling flight in rain/night; lightning keeps the original scatter/recovery mechanism with native terrain containment. No landed/roost behavior is advertised. State reason explicitly says native-flight-only-rain/night. This is a deliberate behavior limitation, not a complete biological replacement. Parent should disclose/accept this policy when enabling it; a credible native folded perch remains future model-specific rig/feather work.

## Rendered/compiled proof
`review/release-eagle-compiled/` is a Vite-compiled native fixture, not the full parent app. Real Atmosphere/environment + MSAA4 Pipeline; actual Heightfield, seven native materials, DOF disabled only for inspection, sea pass empty.

- Compiled 32s weather cycle / 640 updates / 1,280 native-visible samples: min clearance **4.413126**, zero faults, unrelated flocks exact, pause exact, GL0/no context loss/no browser errors.
- Fixed-camera peak views at t29/30/31 plus weather and lightning/recovery captures; t30 former failing eagle now positive clearance. Same-camera original/far wing-up/down/glide comparison retains native appearance.
- Fixture near eagle+atmosphere: 13,053 triangles /25 calls; far:7,023 /25. Actual terrain fixture ~110k/37. **These are not the full-island <2.5M/260 release result.** Parent owns combined compiled integration/budget/UI publication gate.
- Software ANGLE/SwiftShader only. No native GPU/Windows FPS claim. Isolated CPU timing is diagnostic, not FPS qualification; prior WILDLIFE-PERFORMANCE limitations retained.

Evidence under `review/release-eagle-evidence/`: safe-flight-unit.log, existing-bird-tests.log, default-invariants.json, compiled-safe-qualification.json, far-render.json, safe-source-hashes.txt, source/rest/temporal/far/peak images. Original failed terrain report and initial endpoint/compile-target/screenshot-timeout logs retained and not relabelled PASS. Direct composed-canvas captures replaced stalled browser screenshot calls; actual WebGL pixels, not synthetic images.

## Attribution / limits
Embedded original metadata: **Eagle**, victorberdugo1; https://sketchfab.com/3d-models/eagle-c6f0f69f366f478cb9c2c19527f27420 ; CC-BY-4.0 http://creativecommons.org/licenses/by/4.0/ . Changes: generated runtime wing articulation and separate topology-reduced far derivative; original GLB unchanged. Metadata read from supplied file, not a newly verified online license page.

No main/index/UI/catalog/ATTRIBUTION/global-derived-manifest edits; no old bird geometry edits, world/sea/land/loader/pipeline edits, package install, deploy, commit, Windows/GPU/config changes. Parent app freeze/deployment and explicit flight-only behavior acceptance remain parent-owned.
