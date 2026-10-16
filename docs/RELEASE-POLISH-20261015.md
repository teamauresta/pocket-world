# Owner release-polish review — private candidate

This is a private-preview refinement, **not public-release clearance**. Keep the approved111 default files byte-identical. Owner feedback09:53 overrides the earlier implication that loaded actors/advancing clips alone proved convincing life.

## Requested improvements

1. **Whale:** current model is usable. Original relative tail stroke was only0.141 units and the old carrier held level near the surface. Explicitly generated additive native-spine propulsion gives2.033-unit relative vertical stroke, coherent speed/pitch/turn banking and continuous surface passes. Source rig/shape/material/clip retained. No verified blowhole air contact or spout. Actual fixed-camera48s sequence retained in release-whale-life/.
2. **Rhino:** sustained habitat walking with short rests,24.127m/60simulatedseconds. No repeated phase.18 rewinds. Normal rain does not freeze it; true storms hold the reached pose. It still lacks a separate authored idle; native contact sliding/clip seams are not falsely called foot-lock perfection.
3. **Alligator:** measured dry bank beside actual downstream river, not merely a glade named riverside. Center remains1.6–3.4 beyond water edge; sampled native feet at least.461 above water. This is bank locomotion, not swimming.
4. **Bear/wolf/discovery:** distinct qualified habitats, a direct grouped Find an animal selector, measured camera alternatives and locally shorter/quieter SOFT groundcover beside patrols. No tree deletion, terrain editing, navigation changes or arbitrary moving animals for screenshots. Elephant native walk/idle also qualified and integrated. Panda's supplied tracks are constant; elk's168-source-unit/cycle root travel needs separate extraction qualification—neither is advertised as an active animal. Removed Stag/Deer stay removed.
5. **Eagle:** supplied body/head/feet/feathers retained, original static source explicitly labelled; generated separate-wing hinge/flap/glide. Original10828-triangle near and4798-triangle far preserve materials, eyes and beak. Eagle-only controller policy clears terrain along recovery routes. Flight-only policy retains native identity through rain/night; folded native roost was unconvincing and rejected, not silently replaced by a procedural bird. Pause-time camera LOD changes do not advance animation/physics.
6. **Peak/waterways:** restrained strata/ledge relief, existing upstream seep/channel now visibly feeding fall, directional river threads, broken translucent fall strands, actual-pool impact foam and localized mist. Dedicated Waterfall/Stream views. No skyline/heightfield/solid-topology change. Shader cues, not fluid simulation.
7. **Reef:** composed quiet gardens, muted palette and sand lanes.971→377 high-detail instances;382982→134077 reef triangles; every category and all8 anemone homes retained. Balanced has deterministic subset positions. Source-detail overhead684triangles/3draws. Strict same-code/actor/camera/time/weather A/B verifies319 identical solid records and byte-equal terrain arrays.
8. **Release usability:** explicit paused-island notice and resume action; direct animal navigation; close-up focus; real High/Balanced/Automatic selector. Balanced changes vegetation/shadow/MSAA detail, retains all animals, and explicitly reloads. It is not labelled a guarantee of smoothness.

## Evidence and visual rejection

225 combined source tests passed, then3 new camera-only tests. First immutable candidate r-20261015-release-polish-5468214fdf60 passed29 compiled technical gates and strict A/B, but parent **rejected its actual Wolf finder screenshot as foliage-obscured**. It was never activated. An overhead-only search in d44467f5b74c was also rejected. Actual geometry diagnosis found a low bamboo leaf envelope. The low-angle Wolf correction worked, but applying the search to Bear worsened its verified framing. Final camera-only successor r-20261015-release-polish-ed37dfde25a5 limits that search to Wolf and restores the previously verified other species cameras. It retains the same simulation/render components. Separate focused actual finder images and final served receipt own its acceptance; do not misstate the predecessor's29 checks as a full pixel-visibility certificate.

Full colour compositor, shadows excluded only for accounting: forest1866470tri/184calls; jungle1860382/200; overview2063317/233; palm1616698/188; GL0. Native shadow cost remains present in actual screenshots. Full-colour triangle/call compliance is **not a frame-rate certificate**.

Workers' completed source/temporal/weather/eagle/physics tests and failures remain retained. Bear seeks actually measured canopy along its loop. Wolf/rhino/alligator/elephant have explicit no-qualified-cover fallbacks; limited on-loop lightning retreat never decreases distance. No off-route teleport or fake cover claim.

## Performance: release gate, not solved

Actual Windows Chrome headless/new Intel UHD630 ANGLE/D3D11,1000×750 DPR1,4s warmup+10s/view; one limited before/after campaign, no causal percentage or Mac/interactive-FPS claim:

| View | Prior high | Candidate high | Candidate Balanced |
|---|---:|---:|---:|
| Overview |4.03|3.84|4.66|
| Forest |3.29|2.87|4.58|
| Jungle |2.85|2.73|3.92|

Balanced helps this measurement but remains slow. High did not demonstrate improvement. Do not promote as smooth or universal-device-ready. Raw reports: review/release-polish-native-{before,after}-result.json. They measure the first frozen candidate; successor changes only user-selected animal-camera code, not these fixed-camera render/simulation paths. Separate native profiling is flagged, not silently started as an unbounded optimisation project. User's Mac remains unmeasured.

## Rights and publication

Embedded metadata includes CC-BY-NC assets (bear,wolf,alligator,manta,dolphin) and Sketchfab Standard assets (whale/fish). Public/commercial use and downloadable WebGL distribution need licence review/clearance; possession/code licence are not permission. Eagle/elephant credits are in About/native ATTRIBUTION. Original files remain untouched and private binaries are not committed/pushed. Licence review and native-performance investigation are separate recorded follow-up suggestions. No new cloud upload, purchase, GPU-mode change, Windows policy/profile change or public deployment is authorized by this polish delivery.
