# Sky & weather milestone — acceptance scope

Original source: `1e5f6b9ac60fee1cd526ae91428649a18322f71b`. Work is local `feature/sky-weather`; no publication approved. Scope is guide features 1–6 and associated controls/capture support. Features 7–11, including sheltering animals, foot IK, fur, trees and sea-creature redesigns, are explicitly not acceptance requirements for this milestone.

## Delivery gates
1. Locked dependencies and production build succeed; deterministic weather regression tests pass.
2. Original heightfield/config/diorama files remain byte-identical (geometry preservation).
3. Actual browser render, desktop and portrait, with complete initial square base framing. Lite mode is only a smoke test (sparse original instances, no shadows).
4. Weather and wind buttons select actual targets; continuous values ease rather than snap during interactive selection. Accessible panel, Escape/outside close, guarded persistence.
5. Celestial discs/phases, matching light directions, clear-night/cloud suppression, rain, wetness, wind and storm effects inspected in actual frames. No new postprocessing passes; effects cast no shadows.
6. Pointer orbit/wheel plus emulated touch orbit/pinch preserve interaction. No uncaught errors, shader compilation errors, missing local resources.
7. Sound is enabled only by explicit sound click; mute closes real output gain. Visual proof does not establish audible timbre.
8. Runtime reduced-motion preference disables Auto, caps flashes, removes bolts; preference handling verified, not merely source-reviewed.
9. Independent final-source review and parent rerun of tests/render QA.
10. Executable package and opening instructions delivered in verified accessible shared folder; original remains intact, public repository unchanged.

## Baseline observations (not new-release acceptance)
- Parent independently verified sandboxed Chromium with WebGL2/SwiftShader. Standalone cached Chromium failed its sandbox launch; sandbox was not disabled.
- Baseline lite suite: 21 PASS / 1 FAIL, failure is favicon.ico 404 console noise. Desktop/mobile camera interaction and audio output-gate assertions passed. Eight actual screenshots retained in review/baseline-lite/.
- Portrait initial/reset framing crops left/right square-base corners despite no DOM horizontal overflow. Final release must inspect geometric framing independently from DOM layout.
- Original screenshot test scripts described in guide were absent; added independent browser harness is new work.

## Limits that cannot be inferred from software rendering
Real laptop/phone frame-rate targets, GPU milliseconds, native Safari/iOS gestures and audible thunder quality require physical-device review. Do not translate software-rendering measurements into hardware FPS claims. Guide assertions such as cheap shell fur and precise performance costs are hypotheses, not observed outcomes.

## Final results
Verified first milestone:12source tests, parent5×2hour Auto checks,68final production desktop/portrait browser assertions,12full-density captures and7liveLAN checks passed. Source/render review corrections and exact limits are recorded in PARENT-REVIEW.md; HANDOFF.md identifies delivery and private preview. All14served payload hashes match the selected release; geometry/model scope preserved. Physical-device/user aesthetic feedback remains unmeasured, not unfinished implementation. Public repository unchanged; private review preview only.
