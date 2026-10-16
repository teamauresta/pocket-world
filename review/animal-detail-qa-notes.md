# Animal detail — independent QA author handoff

## Scope and status

Owned only this file, animal-detail-qa.mjs and animal-detail-author-evidence/. Baseline 8a7f52e; feature/animal-detail. No app/source/package/deploy/service/GPU edits, installs, commits, pushes or server start. Animal milestone only; vegetation untouched.

Executed: Node syntax/help, all six actual source builders in both LODs, independent all-vertex attributes/skin/triangle checks, sampled neutral skin bind, and adversarial NaN skin-weight/rest-coordinate perturbations. Final CPU receipt: **102 measurements PASS**, six species × two LODs. This is **not visual acceptance**. CPU code loaded implementation modules while workers were authoring; final release must rerun after integration. Initial receipt retained: our incorrect minimum 20 bones falsely rejected valid inherited 18/19-bone rigs; corrected after inspecting quadJoints (five torso + twelve leg + species-tail bones). No threshold changed to hide a geometry failure.

Bounded sandboxed live browser smoke reached __lab.ready on the preserved private baseline, then correctly FAILED on missing setInspectView({view,lod,species,time}); no feature visual gates ran. Browser launched and closed normally. See browser-smoke-report.json. All six CPU meshes measured exactly19,500 near /4,900 far triangles; vertex counts also differ. Parent owns final integrated browser run and server. No native 60 FPS claim; SwiftShader only.

## Run

From <project-root>:

~~~sh
node review/animal-detail-qa.mjs --cpu --out review/animal-detail-final-cpu-evidence
node review/animal-detail-qa.mjs   --url http://PARENT-HOST/lab/lab.html   --overview-url 'http://PARENT-HOST/?test=1&lite=1'   --out review/animal-detail-final-evidence
~~~

--species tiger is diagnostic, not full acceptance. Use fresh evidence directories. Browser is the existing finishschedule-audit-lab Playwright, /snap/bin/chromium, chromiumSandbox:true, ANGLE SwiftShader. No sandbox-disabled fallback. No downloads/install. Failure emits JSON and nonzero exit. Missing required coverage, adapter or WebGL context is FAIL, never a successful skip. Best result is MEASUREMENTS_PASS_REQUIRES_VISUAL_REVIEW; visualStatus remains NOT_CERTIFIED.

## Small integration surface needed

Existing __lab.live({species,terrain,speed}), pause(), step(seconds), capture(), ready and liveState.mesh/agent are used. Proposed/agreed additions, not claims that they existed on baseline:

- __lab.renderer, scene, camera: actual Three.js references, no extra testing renderer.
- setInspectView({view:'body'|'face'|'feet',lod:'near'|'far',species,time}): expose actual current Fauna mesh, real requested topology, deterministic pose/close framing. Preserve current terrain and .25 playback when already selected. Pause is called separately. Camera framing must persist through RAF (do not retarget away from face/feet in paused inspector).
- liveState.agent.detailAppearance.update({time,dt,distance,night,wet}) and snapshot(), as contract facade; no snapshot count trusted for geometry/visibility.
- Optional only when semantic mesh names are unavailable: __lab.detailDiagnostics() -> {eyes:Mesh[],lids:Mesh[],fur:SkinnedMesh[]}, referencing actual rendered objects. Existing names sclera/iris/pupil, lid/blink and fur/shell are discovered automatically. Eye groups alone are not mesh refs.
- Overview __isle.ready, renderer/scene/camera, pause(), fauna.agents[].r.key/mesh/detailAppearance, at least two actual tiger actors. Already existing island diagnostic pattern is reused, not a new synthetic actor API.

### Adapter caveats

The original source lab had neither setInspectView nor renderer/scene/camera exposed. Snapshot-only hooks cannot independently certify skin, shader or eye attachment. Do not invent successful evidence to bridge absence. Do not alter production behavior solely to pass tests.

## What measurements establish

- Geometry: actual index/position triangle counts <=20,000 near /5,000 far; truly different LOD topology; every position/rest/part/skin entry checked; finite, normalized weights; valid indices; actual posed skinned vertices finite; positive vertex population for head/muzzle/nose/ear and foot parts. CPU measures neutral applyBoneTransform error below 1e-5. Actual part bounds retained. Part labels alone do NOT establish anatomical beauty or four readable toes.
- Render: readPixels immediately after actual renderer.render; animal-visible versus hidden pixel delta, context/error checks; screenshots retained with SHA256. A black/empty/stage-only frame cannot pass this positive control. These are modest nonempty thresholds, not perceptual quality scores.
- Coat: original versus plain solid material pixel delta; perturb only aRestPosition.x by .137 while geometry/pose/camera stay fixed and require actual image change; restore attributes. Retrieve real compiled shader source and linkage/compile status. Rest-attribute text presence is explicitly only necessary, not proof of correct flow. Parent must inspect that fragment markings use the rest varying, not world or posed position, and inspect coat attachment in profile/walk frames.
- Eye: finite separate glossy mesh geometry under the actual head bone; positive light and actual face-light A/B pixel response. Parent reviews close face catchlights: whole-face changes alone do not prove each pupil has a catchlight. No fake highlight decal counts as physical light proof.
- Blink: hold gait phase fixed and sample actual eyelid local matrices AND vertex arrays for 40 simulation seconds at30Hz. Current authored eyelids sweep vertices, so requiring matrix changes alone would incorrectly fail real geometric blinks. Detect separated movement bouts and varying intervals. Overview compares movement timing of two actual same-species actors for asynchronous behavior, not merely differing seeded snapshot strings.
- Fur: actual near visibility and shell-on/off pixel contribution; at distance45, zero visible shell objects and zero shell-on/off difference. Transform reconstruction tests two roots [47,11,-29] and [-38,4,61], with different yaw/pitch/roll and scale, requiring shell/body skin base-point agreement <.001. This specifically catches parent/child bind-transform double application. It requires corresponding shell/body vertex topology; alternate valid shell topology needs independent rest-point correspondence, not weakening the error. Shader inflation/comb offset itself still needs visual review; CPU base transform is not GPU transform-feedback.
- Pause: sampled actual world skin vertices, all bones, eye/lid/fur matrices, lid vertices and appearance state unchanged across350ms browser time after positive simulation advancement. Positive walk sequences separately require actual bone change.
- Overview: actual renderer.info for one isolated color pass with shadows temporarily disabled, then restored; <=2.5m triangles /260 calls. Submit milliseconds retained only as CPU software submission, not GPU or native frame time.

## Captures and manual acceptance (mandatory)

For each of six species, each LOD: body, face, feet, and side profile; five sequential stills each on flat and slope. Adjacent walking stills advance .0625 simulation seconds: view at .25 seconds/frame for quarter-speed playback. This is a short walking sequence, not a full gait cycle or replacement for existing foot tests. Profile camera is set directly after body framing; verify controls do not overwrite it. Inspect framing and recapture if ears/feet clipped, face too small, or profile not genuinely side-on.

Reject visibly muddy tiger stripes, disconnected deer spots, panda masks floating off the face, eye protrusion, absent iris/pupil/catchlight, blind/misaligned lids, toe fusion, floating hooves, fur double transforms, fuzzy face concealment, LOD silhouette pops or slide/penetration regressions. Compare to preserved baseline and guide/concept, not merely these low nonempty pixel thresholds. A sharp-looking frame can still fail geometry and vice versa.

Parent must run retained independent living-foot/lab regression, controls/reduced-motion/pause and weather tests separately, plus static capture path verification and actual camera-distance LOD transition. This harness requests near/far topology explicitly; it does not certify automatic hysteresis switching. CPU budget does not imply combined fur/eye scene performance. Do not claim complete Feature9 acceptance or final visual success from author receipts.
