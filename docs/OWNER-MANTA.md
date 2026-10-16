# Owner manta — single private model integration

Only `model_84b_-_manta_ray_swimming.glb` is selected for live replacement. Other23-file inventory entries are not automatically eligible. Deer prototypes remain local: two stance tests passed numerically but the retargeted posture is artistically wrong; doe ankle closures also failed. They are not included in this release.

## Provenance / licence

Supplied original is unchanged and rehashed before/after copy. Embedded author DigitalLife3D, title “Model84B — Manta Ray Swimming”, source https://sketchfab.com/3d-models/model-84b-manta-ray-swimming-73e539c7ac5940e5aad4c58257df9725 , embedded licence CC-BY-NC4.0 https://creativecommons.org/licenses/by-nc/4.0/ . Attribution is in the About UI and `public/owner-models/ATTRIBUTION.txt`. This is a private non-commercial owner preview; no commercial/public licence clearance or relicensing is claimed. Runtime normalization, skin/morph playback and underwater shading are adapted; original bytes/material textures/animation tracks are not rewritten.

## Backend

- Existing SeaLife manta steering, fixed steps, weather/night/depth/lightning safety, positions, velocities, scale and support metrics are unchanged. Only its visual mesh is hidden when the imported backend qualifies.
- Real authored `manta_ray_armature|ArmatureAction` (24seconds), independent SkeletonUtils instance/mixer; original materials/textures cloned before per-instance underwater shader composition.
- Explicit clip-reference normalization fixes the supplied bind/animation scale mismatch. Animated envelope is uniformly fitted inside the original controller's measured conservative support prism.
- Per-bone vertex boxes bound positive normalized skin-weight convex combinations. Explicit signed morph-delta Minkowski bounds include actual positive/negative morph weights. Unknown morphs still fail closed unless explicitly opted in. Actual pose hull is checked every update; any support violation displays the qualified original mesh rather than changing physics or hiding a failure.
-1920 cooperative envelope samples avoid blocking the running scene during initialization; previous procedural visual remains until ready. Renderer layer mask and current instance matrix copied; model loading failure restores original visual.
- Genuine swimming pace follows existing swimmer state. Pause dt0 and reset are deterministic. `?proceduralModels=1` is an explicit original-visual comparison/rollback switch, not a test-only shell/budget waiver.

## Qualification and retained failures

`src/sea/imported-visual.test.js`: original skin-envelope/morph-rejection checks passed; new signed-morph test passed separately. Default fail-closed behavior retained.

First real qualification correctly failed on previously unsupported morph targets: `review/owner-manta-evidence/`. Explicit morph support closed that gap. Next run passed exact controller invariance across1440 real updates, actual linked shaders/GLerror0 and exact paused snapshots, but8 support fallback frames failed acceptance: `review/owner-manta-morph-evidence/`. It was not presented as all-green. Denser fitting then passed2881 off-grid actual morph/skin poses with zero fallback, actual shaders/GLerror0: `review/owner-manta-bound-followup-evidence/`. Completed controller/pose/material checks were retained, not restarted.

Actual main integration: `review/owner-manta-world-evidence/` passes exact controller-state equality to original backend for clear/storm/night-rain, reset/pause, exactly one imported manta, original visual hidden, and real portrait About/credit interaction/no overflow. Its original named-view list included fallback names, so it is not evidence of seven distinct budget cameras. The compiled-artifact follow-up uses all seven explicit camera specifications from the independent vegetation reviewer and requires seven distinct observed camera positions; `review/owner-manta-artifact-evidence/` is authoritative for that coverage.

No native hardware FPS, sea-wide <5000 far-triangle LOD, whole original guide acceptance, unexamined model rig compatibility or expanded Guide11 physics claim. The source manta is17164triangles versus original procedural14524; exact all-world budget is checked with actual rendering. Original laboratory and prior v1–v4 releases are preserved byte-identically.
