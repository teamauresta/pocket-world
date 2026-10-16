# Animal detail — private release

Owner ordered animal detail then vegetation; publication is the existing private LAN preview, not a GitHub/public push.

## Try it
- Island: http://127.0.0.1:30893/
- Animal inspection/motion lab: http://127.0.0.1:30893/lab/lab.html — species, flat/slope, quarter speed, body/face/feet, near/far mesh, pause, orbit/zoom.
- Previous qualified living version: http://127.0.0.1:30893/v2/
- Original approved sky/weather version: http://127.0.0.1:30893/v1/

Release r-20261014-animal-62ac950d8b56. Previous immutable living release retained for rollback: /site/releases/r-20261014-living-0df0a0b7e395. Only this app's SITE_ROOT changed; no public DNS/tunnel, push, paid assets, dependency installs or GPU-mode changes.

## Delivered
Six species have finer species anatomy, brows/ear cups/lip/nostril detail, separated toes/bear claws/deer hooves, actual glossy eyes and geometric irregular blinks, analytic rest-space markings, genuine distance-limited 12/6 skinned fur shells, and near/far meshes (19,500/4,900 triangles). Same qualified skeletons and four true sole anchors. Parent repaired detached eye rims, coarse fur/false-colour part interpolation, panda GLSL identifier, cavity winding/seams, deer ear bases and antler sampling. Inspection selectors persist across species changes; explicit simulation steps synchronize the camera before rendering.

## Verified evidence
- Integrated source72PASS/0FAIL; six species×two LOD independent CPU102measurements pass; main/lab builds pass.
- Full production animal suite:244PASS/6FAIL, retained unmodified. All six failures were paused diagnostic view-distance changes (not moving bones/feet/lids); synchronous camera following fixed the frame lag, and nanounit-only distance quantization removed one-double-ULP orbit reconstruction noise. Same six strict complete-object equality assertions rerun on final immutable release:6PASS plus error gatePASS. Prior failed reports remain, not rewritten.
- Physical rendered-skin/sole flat+slope tests:13PASS. Planted actual skin slip ~1e-14; no inferred success solely from target flags.
- Retained desktop/mobile weather/control suite:68PASS/0FAIL,30screenshots,0warnings/errors.
- Actual six-species GL shader/link, rest-coat pixel perturbation, eye/lid/skin/fur bind/fade, quarter-walk and asynchronous actor checks; body/face/feet/profile and walking frames inspected. Overview color pass measured149calls/1,022,372triangles (shadows temporarily disabled for isolated counts then restored). Software submission time is not native FPS.
- All46served payload hashes/cache/security headers and route404/403 guards verified; V1/V2 bytes unchanged. Current runtime/browser receipt: review/animal-live-http.json and review/animal-live-evidence/.

## Honest limits
Stylized procedural sculpts remain faceted in extreme closeups, not artist-quality or photoreal models. Facial holes were corrected without DoubleSide masking, and cavity rays retain hollow ears/nostrils/lips; non-face boundary edges remain, so not globally watertight-certified. Native laptop/phone FPS and new owner aesthetic outcome remain unmeasured. Inherited owner-accepted constrained escape policy and original strict137PASS/6FAIL remain documented; not universal10–15-unit fleeing or full-guide completion. Sea creature remodeling is not part of this sequence.

## Next
Vegetation follows this qualified animal publication. Keep immutable animal/living/original releases and source/evidence for comparison and rollback. Vegetation must preserve navigation, shelters, perches, terrain, motion and weather contracts.
