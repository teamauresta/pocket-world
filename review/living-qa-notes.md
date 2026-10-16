# Living milestone — independent QA harness

## Delivery status

Authored against feature/living-reactions, baseline 79d5e28, while implementers were changing their modules. Only review/living-qa.mjs, this file and review/living-author-evidence were written. No app/package/tests/deploy edits, server start, installs, service/config/GPU changes or push.

**Executed:** node syntax check; CLI help/import; independent probe extraction on real procedural Three.js skinned meshes: 6 species / 24 paws, each with >=2 actual bottom-cap vertices, normalized weights and meaningful terminal-bone influence (>0.1). CPU receipt: living-author-evidence/patch-qualification.json. This verifies extraction, not motion correctness.

**NOT EXECUTED:** final browser/behavior suite, screenshots, live production checks, weather regression. Parent owns final server, executing this harness, interpreting failures and recaptures. No waiting child or background operation remains.

## Run

From <project-root>, with parent-owned final build/server already running:

~~~sh
node review/living-qa.mjs --url 'http://127.0.0.1:4174/?test=1&lite=1' --out review/living-final-evidence
~~~

Optional --only desktop or --only portrait for diagnostic runs; final acceptance needs both. Use a fresh evidence directory each run. The harness rejects output paths outside review/living-*evidence. Existing Playwright is imported from finishschedule-audit-lab; /snap/bin/chromium launches with chromiumSandbox:true and SwiftShader. There is no sandbox/security-disabled fallback. Browser failure is a FAIL, not permission to relax sandbox settings.

Desktop 1100×800 and portrait 390×844, DPR1, independent contexts. Real __isle.ready and frames>1 are awaited. Screenshot captures use real rendered frames; CPU geometry is measured independently alongside them. No hardware FPS, native phone, universal visual-quality or whole-guide completion claim.

## Required adapter contract (absence FAILS)

- __isle: fauna, birds, life, hf, scene, camera, renderer, U, rain; advance(seconds,{freezeWeather:true,render:false}), resetBehavior(), behaviorState(), setTime(), pause/resume(), setPlaying(), setWeather(mode,true), triggerStrike(), capture(). All three behaviorState snapshots non-null.
- Land: fauna.agents[] entries id, r.key, mesh:SkinnedMesh, rig.bones, pos:Vector2(x,z), heading, speed, reason/state; a.motion.snapshot() or fauna.snapshot().agents[].contacts. Contacts are [{bone:'wristL'|'wristR'|'hockL'|'hockR',mode:'stance'|'swing'|'free',target:[x,y,z]}]. Target selects contact continuity only; no reported actual/error is trusted.
- Shelter: a.shelter.p (Vector2), tree:{x,z,r}; fauna.cover records. hf.heightAt, normalAt array, riverInfo {dist,width}. Shelter verification checks arrival, terrain and river, existing cover record and 0..2 units from collision-radius edge. It does **not** claim a hash radius is a measured canopy or the strict guide's <=2 units from trunk. Actual canopy occlusion needs parent visual review; sparse bamboo may expose a real gap.
- Birds: flocks[].agents, mesh, aFold/aFlap/aSpan attributes; agent perch coordinates/mode. scene tree group's userData.perches must be retained. Branch-tip geometry + real instance matrices independently cross-check perch records. Bird instance matrices and reconstructed outer-wing fold contraction are measured, not only mode flags. Anchor vertical error <0.2 and horizontal radius <2 allow bark sway; exact time-varying branch contact remains a visual/stronger wind-transform check.
- Sea: life.species[] {key,L,mesh,agents}; sharks/mantas/turtles {mesh,agents}; geometry aSwim and aBody/aSpan/aFlip. Turtle agents expose breathMode. Reset must truly restore positions/RNG/timers across clear/storm paired runs. CPU shader reconstruction copies the actual original fish/manta/turtle equations and constants from inspected life.js, not helper bounds or yFrac. If those shaders change, update the documented adapter, not test thresholds to hide failure.

No source imports are used in browser harness. The separate author CPU extraction test used real source model constructors only to qualify patch selection.

## Geometry gates and interpretation

### Paw soles (not wrists/hocks)

Bind-space joint origin is obtained by inverse bone-inverse matrix. Independently hard-coded original primitive forward offset / bottom:

- Tiger F +0.08 / -0.01; H +0.10 / -0.005.
- Deer F +0.02 / 0; H +0.03 / 0 (stag/doe/fawn).
- Bear F +0.08 / -0.01; H +0.10 / -0.01.
- Panda F +0.06 / -0.01; H +0.08 / -0.005.

Actual terminal-bone matrix transforms this independent offset. A fixed bind-space bottom patch (lowest +0.022, max24 vertices) is selected around the original paw footprint. Each actual geometry position is transformed through mesh.applyBoneTransform and mesh.matrixWorld. Skin weights are recorded once in paw-patches JSON and validated, so an ankle target claimed as a sole cannot pass by itself. Same fixed vertices are compared across frames; never reselect the lowest world vertex to manufacture a stable minimum.

Per species: >=20 stance samples and >=10 consecutive same-lock pairs; independent bone sole ground/lock error <0.07 world units; sole slip <0.035/sample; actual skinned-patch slip <0.07/sample; skin penetration >-0.08 and 95th-percentile skin height <0.16. These are practical coarse procedural-mesh gates, **not exact zero-sliding IK proof**. Raw per-vertex world positions, terrain distances, maxima/p95 and patch weights survive in JSON. SDF blending can visibly deform a multi-weight paw even when the ideal bone sole is perfect: report it separately; do not replace skin measurement with target error.

Natural 45s clear run requires walking, turns, start and stop for every species and both flat (normal.y>0.995) and slope (normal.y<0.985) coverage somewhere. Missing natural coverage is a FAIL requiring a longer/controlled valid-terrain fixture; not a successful skip. Flee gets the same contact checks for deer only. No guessed contact-state APIs or fabricated phase targets.

### Reactions / safety

- Rain 45s: every tiger/deer/panda physically reaches its valid cover within1.2; bears never enter shelter and at least one moves >0.5.
- Nearby seeded strike: onset <=0.25s, heterogeneous onset samples, actual non-deer paw-pose motion, actual deer displacement away >2 by4s and peak speed >1.5, nearby bird instance displacement >1. This is a minimum bolt-away gate; **full 10–15-unit guide distance is not certified**. Blocked paths remain visible, not waived.
- Bird landing: real fold>.95, flap<.05, reconstructed wing-width ratio<.35, record matches actual branch tip. Transition sample jump<4 per0.25s is a coarse teleport gate, not acceleration continuity proof.
- After clear59s: no shelter/startle/settle land reasons; actual birds in flight with unfolded wings. Night panorama after20s retained; detailed night grouping/sentinel/head-direction assertions remain parent review.
- Sea: paired clear/storm actual center depth fraction (terrain-to-surface normalized) mean falls >0.025 for sharks and manta. No yFrac-only pass. All big-creature vertices reconstructed; small fish regularly subsampled (~72 vertices each) with stride reported. Sampled floor clearance >=-0.035, glass extent>=-0.015, no base<-27 or non-breathing top>0.15. Not a continuous swept-mesh proof; unsampled small-fish vertices may still collide.
- Turtles:120s, first contiguous hold2.5–3.5s, >=10 quarter-second samples, actual head cap y[-0.15,0.30], then actual center dive >0.7. Later breath cycles retained, not merged into an artificial long hold.
- Freeze: positive control playing changes joints and shader time, then playing-off/pause/reduced-motion each preserve actual skinned patches, all land bone matrices, bird/big-sea instance matrices, particle time/seed/count and independently reconstructed first12 rain centers across >5 real frames. Before/after JSON+PNG saved. This is geometry/inputs freeze; camera damping or postprocess noise may prevent byte-identical whole screenshots.

## Captures / limits requiring parent follow-through

Automatic: clear/rain/strike-flash/strike-aftermath/recovery/night/reef panoramas; tiger/stag/bear/panda closeups3 frames separated0.25 simulation seconds; freeze before/after. PNG SHA256 and capture receipts are indexed (freeze PNGs adjacent to freeze JSON). Closeups follow the current agent position at sequence start, **not guaranteed to catch a walking phase**; choose a known walking timeframe and recapture if idle/obscured. Inspect all PNGs, especially foot contact, panda roll/bear rear, canopy coverage, bird foot/perch contact and turtle head at water. This suite does not automatically certify artistic readability, full body/land non-foot penetration, exact bent-wing GPU output, idle micro-behavior catalogue, species wind-facing, fawn/doe proximity, 60Hz spring invariance, fish dart/reformation or 10–15-unit deer flight distance.

Parent must run the existing **68-assertion weather regression unchanged** separately and retain its report. Combine it with this harness's actual result, source CPU tests and visual review; do not label a missing-hook failure or coverage failure PASS. Final build capture/real device performance remain separate evidence.
