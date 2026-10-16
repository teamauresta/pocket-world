# Pocket World independent browser QA

Scope: sky/weather/wind milestone only. No animal reactions, creature detail, or motion certification. The harness modifies no application source, dependencies, services or publication artifacts. Parent owns server startup and final full run.

## Final verified evidence (2026-10-14)

- Corrected production suite: **68 PASS / 0 FAIL**, 30 actual screenshots, zero warnings/page/console/local asset errors. `final-production-lite/report.json`; lite is interaction proof, not full density/shadow proof.
- Full-density production: 12 captures in `full-visual/`; actual desktop/portrait, distinct half/full moon and readable bolt inspected by parent after fixes. Four existing passes remain; no weather shadow casters.
- Live K3s LAN preview: `lan-preview/report.json`, **7 PASS**, actual Storm control, delayed thunder synthesis, mute cancellation, sunset/full moon camera/light alignment and forced additive meteor rendering. `lan-preview/milky-way.png` inspected for visible Galactic band.
- All 14 served payload files match `release.json`; routing/hash receipt `served-release.json`.
- Pure simulation: source12tests + independent five2hour seeded parent runs (`parent-weather-check.json`).
- Source and geometry preservation plus review corrections: `../docs/PARENT-REVIEW.md`. Handoff and exclusions: `../docs/HANDOFF.md`.
- Software WebGL is not real laptop/phone FPS. Original baseline/driver reports below are historical evidence, not final release state.

## Initial evidence

- Baseline source exported with git archive from **1e5f6b9ac60fee1cd526ae91428649a18322f71b** into review/baseline-source.
- Syntax check passed for scripts/browser-qa.mjs.
- **Actually run:** isolated browser/WebGL driver probe, 2026-10-14 09:39 Melbourne. Chromium **155.0.8059.39**, WebGL 2.0, **ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)**. One assertion passed; zero app screenshots taken. Receipt: driver-probe/report.json.
- Sandbox explicitly enabled using chromiumSandbox:true; no --no-sandbox, --disable-web-security, ignore-certificate-errors, or unsafe SwiftShader opt-in flag needed. No hardware GPU mode changed.
- **Not run yet:** application UI suite, baseline screenshots, final visual acceptance. Do not represent authored assertions as executed checks.

## Run

From <project-root> with a parent-managed server already listening:

    node scripts/browser-qa.mjs --url http://127.0.0.1:PORT/ --out review/current-full

Fast smoke (NOT visual acceptance; sparsifies original vegetation and disables shadows):

    node scripts/browser-qa.mjs --url http://127.0.0.1:PORT/ --out review/current-lite --lite

Baseline against a separately parent-served review/baseline-source:

    node scripts/browser-qa.mjs --url http://127.0.0.1:BASELINEPORT/ --out review/baseline --baseline

Driver-only proof without server:

    node scripts/browser-qa.mjs --probe --out review/driver-probe

Accepts --timeout (default 180000 ms), --chromium and --playwright absolute paths. Existing Playwright imported directly from finishschedule-audit-lab; no install. Adds ?test=1 to preserve the canvas. Writes report.json, summary.md and screenshots. Exit 1 means any failed assertion. External network issues remain logged separately from local asset failures; console errors still fail. Warnings are retained for inspection, not hidden. Node/Playwright dependency failure before launch is a CLI failure rather than an app receipt.

Waits are observed readiness/frame count/media-state/gain conditions, not timer sleeps. SwiftShader can be slow; use real process-tool status to collect long runs. Full captures may take minutes. Stills intentionally call capture before screenshot so WebGL really is rendered; this is not a DOM-only screenshot service.

## Adapter contract / integration follow-up

The implementation was in flight when harness was written. Adapt only harness selectors/state adapter as real hooks settle; do not weaken assertions to manufacture green results.

- Uses existing __isle.ready, frames(), camera, controls, renderer, capture(); new __isle.resume() required after capture.
- Weather state: numeric fields directly on weather, weather.current or weather.values. Expects **weather.target or weather.targets** with actual numeric target cloud/rain/wind/fog/waves/lightning. The newly observed Weather class (09:39) has direct fields, state, mode and windTarget(), but **does not yet expose numeric target/targets**. Parent/implementation must expose a read-only getter or adapt to actual documented snapshot targets. Do not substitute the harness expected preset table and call that observed evidence.
- Auto inferred from weather.auto, weather.autoMode or actual mode === 'auto'; physical weather state from weather.state before weather.mode.
- Uniforms from __isle.U or __isle.uniforms. Need uMoonPhase and uFlash, or actual numeric moonPhase/flash weather fields. Bolt visibility via weather.bolt, __isle.lightning.bolt, __isle.weatherFX.bolt, or actual named bolt object in scene/seaScene. A missing bolt hook does not count as no visible bolt.
- Trigger #weatherBtn/#weatherToggle or accessible weather button; requires real aria-controls + aria-expanded. Chooses [data-weather="clear"]/[data-wind="calm"] or accessible named Weather/Wind groups with real buttons and aria-pressed.
- Capture specs use weather names, wind names, moonPhase, flash, bolt:true, time, name, t, frames, ui. Preserve app semantics; record unsupported spec as failure. Forced flash should freeze a rendered strike, not merely set an unused field.

## Automated inspection matrix

| Area | Actual assertion/evidence |
|---|---|
| Desktop/mobile | 1440×1000 and 390×844 contexts, actual GL renderer, canvas dimensions, initial screenshots |
| Weather | Click Storm/Clear/Cloudy/Rain/Auto; all target values against guide; current values finite/in range; current movement toward targets over observed frames; manual modes turn Auto off |
| Wind | Auto then Calm .1 / Breezy .4 / Windy .75 / Auto; real target and easing; Auto restores current physical weather target |
| Accessibility | Real button, pressed state, controlled panel, Escape/outside close, Enter opens; clock says Rain; mobile and desktop overflow and visible panel bounds |
| Camera | Pointer drag changes camera position and quaternion; wheel changes orbit distance; native Chromium emulated touch drag and pinch change actual camera transforms |
| Audio | Wraps AudioContext/node construction for read-only graph observation; non-sound clicks cannot open output; explicit sound click creates/runs context and raises real destination gain; mute lowers gain below .001 (fade allowed) |
| Capture | Assert snap of cloud/rain/fog/waves, phase and forced flash; collect calls/tris and observed state with each still |
| Runtime reduced motion | Turn Auto on, emulate reduce without reload, assert Auto off, forced flash <= .3 and actual bolt not visible |
| Errors | Collect pageerrors, console errors/warnings, failed requests and HTTP >=400; fail uncaught, console error and local asset failure gates |

## Required manual visual inspection (do not mark pass based on file existence)

| Shot | Inspect |
|---|---|
| clear-noon / clear-sunset / clear-twilight | Disc above real horizon, soft halo, no glare filling whole sky; shadow direction consistent; recognizable intact glass island |
| night-phase-0 / .25 / .5 | New/half/full distinction; night actually dark but legible; no invisible below-horizon moon mistaken for failed shader; full-moon glitter and matching light direction |
| night-cloudy vs clear | Star/Milky Way suppression; no bright stars shining through opaque overcast |
| rain-overview / rain-meadow | Drops visibly slant with wind, clipped at terrain/sea, not flooding outside footprint; ripples; wet dark/glossy material; mist and cloud dimming |
| storm-flash vs storm-reef | Whole scene reacts to flash, readable jagged bolt when requested; dim moody inter-strike view; rough water/whitecaps seen from below; glass edge remains connected |
| windy meadow | Downwind lean, not merely a UI state; compare calm same camera/time if ambiguous |
| mobile weather panel | All labels reachable, no cropped buttons, no horizontal scroll; adequate touch targets and contrast |
| reduced storm | Soft flash, no bolt, static-camera behavior when reduced motion is active |

Additional real-device/live acceptance remains open: native Safari/iOS touch, 20-minute Auto transitions + storm cap, clear-to-storm-to-clear no pops, drying over about a minute, moving gusts/rain across frames, audible delayed thunder and mute, actual laptop/phone hardware FPS and GPU draw-call budget. This software run provides **no hardware FPS claim**. Lite mode cannot validate shadows, density, or full-scene cost.

## Verified baseline hazards (source inspection, not reproduced UI failures)

1. capture() permanently pauses the original tick loop and has no resume hook. Therefore baseline interactions must happen before captures; don't claim later controls were tested from a frozen still. frames() increments even when paused: it alone is not proof simulation advanced. The new harness also compares actual values/transforms.
2. capture({ui:false}) hides dock/About without restoring for later ui:true. Harness never requests ui:false; implementation should make this reversible.
3. REDUCED is read once at startup in baseline; runtime OS preference changes are ignored. New runtime media test intentionally fails unchanged behavior.
4. ?lite caps each original scene InstancedMesh to 3 and disables shadows. It is only a smoke aid, not equivalent visual quality. New sea-scene rain may remain dense even in lite mode.
5. Texture loader substitutes flat textures on request failure; a rendered ready island can still have missing assets. Network assertions are necessary.
6. Baseline audio stop fades master gain, but queued bird/cricket timers are not cleared. Output-gate check allows fade and does not claim all oscillator scheduling has stopped; inspect newly added thunder queue cancellation separately.
7. Google font stylesheet is external. Offline/font TLS failures must be classified; never disable security to make them disappear.
8. Baseline has no explicit global [hidden] !important rule, while .panel/.loader have display/layout CSS. Verify actual visibility (not merely hidden attr) on original hosting vs publish/test.html, whose wrapper adds [hidden]{display:none!important}.
9. **Do not run baseline npm run build**: package build invokes scripts/publish.mjs, which recursively deletes its publish output. Parent should use isolated Vite dev root or direct vite build only if needed; this harness starts neither.
10. Baseline capture presets are camera-specific and phases can put the moon below horizon. Guide's chosen hours do not guarantee every phase disc is in the overview frame; manual sky-facing follow-up may be needed without changing intended phase/orbit semantics.

Baseline source export is a review fixture, not a second canonical repo. Existing node_modules symlink may be added to that fixture only after parent installs dependencies. No production publish script was executed.

Security cleanup: archived receipts have machine identifiers replaced with neutral examples. They describe historical measurements, not current endpoints. See ../SECURITY.md for local review configuration.
