# Owner White Tiger — native rig locomotion adaptation

## Asset truth
- Owner-selected White Tiger (RIGGED ANIMATED), CGJAY1111, CC-BY-4.0.
- Source: https://sketchfab.com/3d-models/white-tiger-rigged-animated-9dd099d283e54f99b7cbd40b531b1a29
- Read-only original: /path/to/private-assets/pocket-world/2026-10-14-3d-models/tiger.glb.
- 121 native bones, 33,142 original triangles. **Only source clip: Idle, 39.041667938 s.**
- Saved original playback already established genuine Idle movement: 19,751 changed pixels, 281 changed sampled skin components, maximum skin delta .0269164 at size 2.8. That is NOT locomotion.
- This module adds **generated runtime locomotion**, not source Walk/Run clips. No deer, substitute skeleton, mesh edits, texture edits, or source-file changes.

## API / route integration

	x = createOwnerTigerMotion(importedAsset, {size: 2.8});
	scene.add(x.root);
	// Caller moves root along a continuous route FIRST. +X is forward.
	x.root.position.set(worldX, groundHeightAtRoot, worldZ);
	x.root.rotation.y = heading; // positive heading turns toward -Z
	x.update(dt, {speed: actualWorldSpeed, state: 'Walk', ground: (x,z) => height});
	// state Run / running / bolt selects generated diagonal quick gait.
	x.update(0, ...); // exact no-op
	x.update(dt, {paused: true}); // exact no-op
	x.reset(); // exact initial model/root/phase/sole state
	x.snapshot(); x.dispose();

Input is the existing createImportedAsset/loadImportedAsset API. The returned native instance owns its skeleton/mixer; the asset retains shared-resource ownership. Do not double-normalize or reorient the inner native model. Route translation is EXTERNAL; no baked or guessed source root motion. Parent can wrap this factory as an optional motionFactory. Original and current derived/tiger-near.glb both tested; bones are matched by semantic native name prefix and paw samples are remeasured from each geometry, not hard-coded vertex indices. Instances must be constructed at root origin and then placed before first positive update; first update seeds contact anchors at actual placement.

## Native anatomy and gait
- Front: femurRibbonFront_00 -> four intermediate femur ribbon bones -> tibiaRibbonFront_00 -> four tibia ribbon bones -> footFront_00 -> ballFront_00 -> toes/toe children.
- Rear: equivalent native femurRibbon/tibiaRibbon/foot/ball chains. No shortened 17-bone proxy.
- IK rotates three anatomical pivots, preserving every intermediate bone's source translation/scale. Skin uses the original complete weighted hierarchy. Other bone rotations continue the genuine Idle mixer, retaining head/face/tail/torso character.
- Sole sets: actual skin vertices with >65% combined ball-and-descendant weight and within .006*size of the lowest weighted paw. Each frame the true deformed sole centroid is measured; IK corrects that, not merely an ankle marker.
- +Z source forward is normalized to +X via +90-degree Y rotation.
- Walk stride .14*size; quick gait .20*size. Frequency = actual world speed / stride. Walk stance duty .66; quick gait .53. Walk quarter-cycle offsets become diagonal pairing in quick gait. Swing uses smoothstep fore/aft and smooth raised sole trajectory, not fake group-sine legs.
- Stance anchors remain world-fixed, including during turns; touchdown looks ahead by swing distance plus half stance distance.
- Whole-model stance settling is limited to 2% total length (0.056 at size 2.8), smoothly introduced, with intact-model pitch from terrain tangent. No limb stretching or large pelvis lowering.
- Low-speed lift is blended to zero. On stop an airborne paw settles; freeze is separate from stop and exact.

## Proof and scope
- Source regression: node --test src/creatures/owner-tiger-motion.test.js.
- Rendered fixture: http://127.0.0.1:4174/review/owner-tiger-motion-evidence/ . Add ?asset=/owner-models/derived/tiger-near.glb for derived.
- Browser proof: review/owner-tiger-motion-proof.mjs. Five cases each: flat, 8% slope, quick gait, acceleration/deceleration, turning. 240 frames each, actual deformed skin samples, front/side/quarter A/B PNGs. Source and derived evidence directories retain complete per-frame traces.
- 4 real-GLB regression tests passed (including translated/turned first-idle placement): source and derived foot motion/stance/segment preservation/exact pause/reset; invalid input and deterministic replay. Source flat maximum centroid target error .0021061, stance movement .0006444/frame after settling, actual swing lift .10110 (size 2.8); derived .0020923/.0006311/.10105.
- Final browser campaigns: 2 assets × 5 scenarios × 240 frames = 2,400 frames, 60 unobstructed PNGs, zero browser exceptions, exact zero-delta pause, zero bone-segment length error. Worst deformed sole centroid target errors: source .0058100 / derived .0058104 (quick gait); post-settle stance movement per frame <= .0016473 across cases. Minimum sampled sole clearance -0.0053192 at size 2.8; finite slight penetration is explicitly not zero. Summaries: review/owner-tiger-motion-{evidence,derived}/summary.json.
- Automated report/image verification: 134 checks PASS (review/owner-tiger-motion-verification.json). Native module Node CPU microprobe: 600 updates in 2202 ms (~3.67 ms/update on this host); not a whole-world or Windows result.
- Initial less accurate test report retained as initial-report.json; not counted as final evidence.

## Honest limitations / integration gate
- GeneratedRun is a faster diagonal gait, **not an authored tiger gallop or a biologically validated sprint**. No source Walk/Run claim. Full gallop spine compression/flight is not supplied.
- Tested controlled continuous routes at 60 Hz: walk .55 and quick gait 1.1 at size 2.8; 8% slope; gentle turn .14 rad/s. Cliffs, sharp pivots, teleports, abrupt large speed/state changes, very coarse dt and arbitrary parent transforms are not qualified. Caller must substep route+motion together and use reset/reseeding rather than teleport an active instance.
- Skin contact is finite numerical tolerance, not exact mathematical zero. Individual paw curvature can be slightly below the plane; report measured error rather than claiming no penetration whatsoever.
- Run/walk transitions interpolate gait phase offsets directly; abrupt state switches are not yet artistically qualified. Preserve route acceleration and avoid switching gait labels every frame.
- CPU solvers and weighted sole measurements are real work; software WebGL proof is **not native hardware FPS proof**. No production performance acceptance implied.
- Preserving original texture/material/rig does not establish owner artistic acceptance. Images show native smooth tiger and distinct lifted/planted paw poses without a replacement model; parent/owner review remains required.
- No main/fauna/shared loader/other species/package/deployment/publication/commit edits here.

### World integration corridor follow-up (module itself unchanged)
The adapter now has an explicit measured real-world corridor near [35,-32.5], not a jungle-only search. 600frame 10sec generated native gait with smoothly changing heading/startstop on actual Heightfield: max sole-centroid target error.0005584, post-settle stance delta.0002370/frame, measured minimum sampled sole clearance-.0011117, native segment error0. Original2,400frame proof remains intact.
This evidence qualifies that finite1.8-unit route, **not** arbitrary terrain or a repeating patrol. Tested actual world larger loops and turnaround failed target error, even where clearance remained within.01; retained failures must not be advertised PASS. Wrapper stops at corridor end, retains real Idle, and restarts only on explicit reset. No native motion module, original or derived GLB edits.
Final obstacle-qualified corridor supersedes the earlier terrain-only coordinates: **[34.5,-40.5] → approximately[34.5,-38.7]** (gently curved). Read tiger-clear.json first case; worst sole target error.00219191, stance delta.00093679/frame, min clearance-.00200460, segments0. Earlier [35,-32.5] was blocked by actual rock geometry and is not enabled. No silent expansion beyond this measured finite route.

## Closed native patrol follow-up — 2026-10-15

The finite corridor limitation above is superseded **only for the measured closed route**, not arbitrary roaming. No GLB, mesh, texture, native bone offset/scale, generic land controller, calibration, main integration, LOD or other species was edited.

### Diagnosis and changes
- Old zero-speed turnaround froze gait phase while rotating the body away from permanent paw anchors: prior max target error .79327. Old small circles used root translation alone for cadence, and forward-only touchdowns ignored each paw's rotational velocity; prior .75-radius loop error .14623. Backward shuttle also kept forward-only touchdown planning (.25053 error).
- Added optional signed **angularSpeed** (radians/sec around THREE world Y) to native update. Omitted/zero preserves old behavior exactly. Cadence now accounts for speed + abs(angularSpeed)*furthestNativePawRadius; curved strides shorten smoothly. Swing endpoints predict constant-twist root travel and rotated native paw offsets. Stance anchors remain fixed—no reset/reanchor during stance.
- Actual terrain/asymmetric native forepaw reach still exceeded .01 after twist planning (.02368), and shortening alone still gave .01592. Extra CCD iterations did not fix reach. Cross-slope roll experiment was worse and was discarded. A smoothly eased **additional maximum .018*size** whole-model settling during turns supplies reach margin; combined maximum is .038*size=.1064 at size2.8, versus original .056. No bone lengths/positions/scales changed. Largest measured carrier movement .008312/frame including initial settling; no pelvis pop/teleport.
- New snapshot foot field **groundClearance** measures minimum actual deformed sole vertex y minus Heightfield at that vertex's own x/z (stricter than minY minus terrain at centroid).

### Route and wiring
- New src/fauna/owner-tiger-patrol.js: closed center **[34.5,-39.5]**, radius **.75**, spawn **[35.25,-39.5]**, root extent **x33.75–35.25,z-40.25–-38.75**. At full pace .09 units/sec, angular speed -.12 rad/sec, ~52.36sec/cycle and 4.712 units/cycle; smooth 2sec start ramp. This is a tight slow turning patrol, **not broad island roaming**.
- owner-land-tiger.js uses this helper and passes actual angularSpeed to native update. Same external factory signature. Motion exposes patrol.snapshot().cycles. No implicit restart; blockage holds at current location. Existing pack fixed60Hz substeps route and pose together.
- Profile retains **qualifiedSegment:true** deliberately as generic-pack strike/detour guard; adds **qualifiedPatrol:true** and **routeCapability:'closed-qualified-native-patrol'**. Parent should prefer routeCapability in capability reporting; generic pack's old qualifiedSegment ternary otherwise still labels this finite. No generic-pack edit made here.
- maxSlope .10/maxRoughness .09/full native radius1.53405 unchanged. Actual circle maxima .097453/.075851. Actual world319 obstacle records: full footprint minimum margin .54109, sampled paw .12-envelope minimum1.57586. No shrunken collision proxy or tree deletion.

### Proof
- review/owner-tiger-patrol-evidence/qualified.json: **9,642 frames,160.7sec,3.050 complete cycles**, all frames measured; every10th full native/sole trace retained. Native error .00886265<.01; stance movement .00588219/frame<.035; actual per-vertex ground clearance minimum **-.009830273**; max absolute stance ground clearance .009830273<.01; exact segment error0; no unsafe frames; 9,634 generated-walk frames; exact pause. Ground margin is narrow (~.00017), so no broader terrain claim.
- rendered.json: actual adapter + current generic pack + same real Heightfield/hash, **9,900 frames/165sec/3.132 cycles**,22 unobstructed side/quarter PNGs across all3cycles. Pause/reset/.1sec vs6fixedsteps exact; no hidden body, GL errors or page exceptions. Snap Chromium ANGLE SwiftShader only, **not native GPU FPS**. Frames preserve native proportions, texture and articulated lifted/planted paws. Owner artistic acceptance remains separate; tight circular pacing may look repetitive.
- unit-tests.log:7 tests PASS (original4 retained plus turning integrity and2route tests). All121bone local positions and scales compared unchanged in turning test.
- compatibility.json: old flat/slope/run/startstop/turn,5x240frames, original snapshot exactly equal with angularSpeed omitted (new diagnostic field excluded). Existing2,400frame original/source reports remain untouched.
- hashes-obstacles.json records exact source/derived asset hashes and current code. Original and derived files unchanged. Earlier failed experiments retained with descriptive filenames, not counted as PASS.
- Frozen finite fallback preserved at review/owner-tiger-patrol-evidence/baseline-motion.js (88fa7ebd...) and baseline-land-tiger.js (95426122...). Do not mix new closed adapter with baseline motion; they are a matched pair.

### Remaining limits
Only this bounded slow closed patrol is qualified. No arbitrary sharp pivot, dynamic detour, reverse walking, gallop, weather shelter/strike retreat or larger terrain loop promise. Route blockage is a safe explicit hold, not a successful continuing patrol. Far LOD has unchanged asset bytes but this new patrol campaign measures near geometry only. No production deployment/commit performed.
