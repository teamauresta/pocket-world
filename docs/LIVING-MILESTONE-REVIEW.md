# Living motion/reactions — milestone QA record (in progress)

Approved starting version:79d5e28, private release r-20261014-1ad72373347f. Owner liked it and requested continuation. Scope: movement foundations and weather-driven land/bird/sea behavior, not fur/facial/species/vegetation remodeling.

## Independent review findings and repairs
- Bird/sea helpers initially accepted object positions only; actual Weather events carry arrays. Parent found silent rejection, normalized both forms and added a real-emitter integration regression.
- Bird/sea accepted large delta updates initially discarded time beyond1s. Parent retained bounded accepted elapsed time through fixed steps and added a2s-clock regression.
- Lower target fractions alone made sharks shallower in actual paired Storm runs because their model envelopes approached shallow banks. Parent added physically roomy deep-column selection plus vertical steering; actual high/low18s checks decrease depth fractions by~0.236/~0.192 while retaining model/floor/glass safety. Final rendered verification remains required.
- First full island living run:119PASS/28FAIL. Actual contacts/skin mostly good where animals moved, but seed-placement/route/torso-clearance traps prevented tiger/stag/bear locomotion, cover arrival and deer escape. Connected home placement, shared swept-footprint routes, reachable local targets, crowd replanning, independent decision RNG and true paused-pose preservation repaired locomotion/cover; source tests confirm it.
- Parent retained the strict escape gates. Added bounded connected-space escape search and genuine short-hop/brace/crowd diagnostics rather than forcing blocked routes. The retained crowded-boundary fixture does not certify universal >2-by4s or10–15-unit fleeing. Its limited reactions and geometry protection are separately tested.
- Final portrait regression found startup failure despite desktop placement passing. Decoration LOD changes fern/flower scatter records, making a scatter exclusion hash unsuitable as the physics topology. Parent separated the pre-groundcover solid-obstacle snapshot from decoration scatter; no plants were deleted or regenerated. Phone probe now boots with319solid records and zero errors; full final suites rerunning.
- Old close-ups were unfocused/obscured by surroundings. Added explicit diagnostic focus support and a separate actual-Fauna motion lab with flat/slope fixtures and quarter-speed playback; useful inspection is not equivalent to natural island coverage.

## Verified evidence so far
51integrated source tests passed. Final packaged controlled motion lab:13checks pass (six species×flat/slope plus portrait), real bone soles and skin vertices measured, labels synchronized. Earlier68weather/control assertions passed; a later portrait startup failure is retained in living-final-weather-regression and was repaired. Current final reports: review/living-solid-world-evidence and review/living-solid-weather-regression. Earlier failed runs remain preserved; no all-green claim until those reports are collected.

## Accepted measurement limits
Bone soles and blended skinned paw surfaces are different. SDF skin blending produces residual deformation; never claim zero whole-paw sliding from a stationary IK target. Canopy annotation uses actual foliage instance bounds, not alpha-tested rainfall occlusion; branch perch contact is stylized belly support because original birds lack legs/talons. Turtle breathing follows mean water level, not instant wave crests. No hardware FPS/native-phone certification.

## Remaining delivery gates
Collect final solid-topology desktop/portrait suites; inspect actual moving close-ups/roosts/breathing; preserve strict escape failures if any; retain approved release and accessible V1 comparison; hash-verify private serving release and shared deliverable. Final receipts/counts will be appended when observed. Native-device FPS and new owner aesthetic feedback remain unmeasured.

## Final candidate observations (2026-10-14)
- Source:51PASS/0FAIL. Main/lab production builds and diff check pass.
- Final desktop/portrait sky/weather controls:68PASS/0FAIL;30screenshots;zero warnings/page/console/local-asset errors.
- Controlled actual-Fauna lab:13PASS; actual sole/skin contact on six species×flat/slope plus portrait; inspected screenshots and synchronized labels.
- Full-density desktop/portrait original independent suite:137PASS/6FAIL; zero page/console/asset errors. All gait/stance/skin, turning/startstop, actual measured canopy arrival, bird instance folding/landing/recovery, deeper sea targets, turtle breathing, bounds and freezes pass. Three deer in the crowded-shore strike fixture fail >2units-away-by4s, on each viewport. These failures remain failures.
- Candidate r-20261014-living-0df0a0b7e395:30staged payload files hash-verified on the persistent volume, including14byte-identical approvedV1 files. Approved serving pointer has NOT changed.

## Owner decision resolved — 2026-10-14 14:11AEDT
Owner accepted the limits and authorized moving forward. Preserve the actual137PASS/6FAIL result; acceptance changes the prototype delivery policy, not the tests or geometry safeguards.

## Activated release verification — 14:19AEDT
The existing private web deployment now serves r-20261014-living-0df0a0b7e395. Only SITE_ROOT changed; original release retained. All30served payload hashes and no-cache/nosniff headers verified, plus404missing/403directory/403dotpath guards. Actual LAN browser probes pass on desktop and mobile (12agents/319solids/nooverflow/advancing simulation), motion-lab selectors/actualbear rig/slope/quarterplayback, and originalV1 renderer/old API contract. Fourlivechecks,0errors. Actual screenshots inspected.

The first live lab probe failed a string-format assertion (.25versus0.25); numeric-equivalence assertion corrected and only remaininglab/V1cases rerun. Failedreceipt retained; no application change or falsified pass.

Delivery is activated with owner-accepted constrained escape behavior. Universal10–15-unit bolt/full-guide completion/native FPS are still unclaimed. New owner aesthetic/native-device outcome not yet measured. Activation driver and evidence retained; staged/shared handoff reconciled to live status.
