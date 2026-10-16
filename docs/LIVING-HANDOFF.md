# Pocket World — living movement & reactions

## Activated private preview — accepted limits
Owner accepted the constrained escape policy on2026-10-14 at14:11AEDT. The living release **r-20261014-living-0df0a0b7e395** now serves the private preview; the prior approved sky/weather version remains at /v1/ and in its original immutable release directory.

Original strict suite: **137 PASS / 6 FAIL**, all six being the three crowded-shore deer distance checks across desktop/portrait. Owner acceptance does not turn those failures into passes. Source51, weather/controls68 and controlled motion-lab13 checks pass. No universal10–15-unit bolt, all-green or full-guide completion claim.

Live URLs:
- Main island: **http://127.0.0.1:30893/** (same LAN).
- Motion lab: **http://127.0.0.1:30893/lab/lab.html** — six species, flat/slope ground, quarter-speed playback, drag/zoom and pause. This is actual Fauna locomotion on an isolated terrain fixture, not a phase-only animation.
- Approved sky/weather version: **http://127.0.0.1:30893/v1/** — byte-identical copy for comparison.

On the island choose Rain and allow time for the weather transition and shelter travel. Clear lets animals settle and shake off rain. Storm affects roosting, water and deeper swimmers; only animals near a strike react. Night gathers/rests the herd with a stag sentinel and more active tigers. Sound still starts off; reduced-motion starts paused.

## What changed
World-space paw-sole contacts, analytic two-bone IK, walk/trot/flee blends, eased acceleration/turning, head lead, fixed-step secondary head/tail motion and slope/weight transfer. Valid connected home placement, swept terrain/river/obstacle routes, crowd replanning and measured foliage-envelope cover. Species-specific shelter, startle, recovery and night behavior; real folded bird wings and finite landing/takeoff; storm-depth navigation, fish darts and turtle surface/hold/dive.

Original terrain, island configuration, diorama, procedural models, populations, textures and four postprocessing passes retained. Geometry changes are metadata only, not animal/tree/sea remodeling. Facial/ear/blink/fur/detail improvements from guide9–11 are not included.

## Important limits — not an all-green claim
Collision rules take priority over a dramatic bolt. In the crowded-shore lightning fixture, a doe has ~0.49 units of forward room in the bounded conservative navigation grid, one fawn stops behind its mother, and another takes a curved ~2-unit route. They visibly react/hop/brace without crossing water, trunks or other animals. **The original universal >2-units-away-by4-seconds gates remain unmet and are retained as failures**, not silently weakened. A 10–15-unit escape for every deer is not certified.

Bone-attached soles stay locked in declared stance; blended SDF skin still deforms slightly. Canopy bounds are not alpha-tested rain occlusion. Original birds have no legs/talons, so roost support is stylized belly contact. Turtle breathing uses mean sea level, not each wave crest. Chromium SwiftShader rendering is software WebGL, not laptop/phone FPS, Safari/iOS or speaker-quality certification.

## Portable/source copy
Shared folder: **AI-Share/pocket-world/2026-10-14-living-reactions/**. Start with OPEN-FIRST.html; site/source/evidence and source ZIP are included. With Python3, `python3 START-PREVIEW.py` serves site/ on loopback and opens a browser. Do not double-click site/index.html.

Source: `npm ci`, `npm test`, `npm run dev`; development lab at /lab.html. Production: `npm run build` then `npm run build:lab`. The V1 comparison is staged separately from the retained first release; do not accidentally overwrite it. Browser QA drivers reference this machine's existing Playwright/Chromium and require adapter paths elsewhere; Node source tests/fixtures are portable.

## Retained release
Existing private namespace pocket-world-preview and PVC assets reused. Only the existing web container SITE_ROOT changed to the accepted immutable living release; serving environment merged without replacing other deployment settings. Immutable versioned static directories and non-root/read-only serving. No public DNS, tunnel, GitHub push, new dependencies, paid assets or GPU-mode changes. Approved release retained for rollback: set the web container SITE_ROOT back to /site/releases/r-20261014-1ad72373347f and wait for rollout. Source checkpoints remain local on feature/living-reactions.

Exact final source/browser counts, release hashes and source commit are recorded in the delivered evidence/ and DELIVERY-RECEIPT.json. Detailed corrections and measurement limits: LIVING-MILESTONE-REVIEW.md. Owner visual/native-device feedback remains the next decision, not demonstrated performance.
