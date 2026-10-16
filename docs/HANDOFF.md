# Pocket World — Sky & Weather milestone

## Open the interactive preview
On the same LAN: **http://127.0.0.1:30893/**.
This is a private K3s preview, not a public deployment. It is separate from the original Claude artifact and the public repository.

- Click the weather icon next to Sound: Auto / Clear / Cloudy / Rain / Storm, with independent wind presets.
- Weather changes ease in; wait a few seconds after choosing a state.
- Move the time slider to dusk/night. Choose **Sky** to inspect the sun, moon and stars; **Overview** returns to the island.
- Drag to orbit, scroll/pinch to zoom, tap animals as before.
- Sound is off until explicitly enabled. Pause freezes the day, weather and animal animation.
- Reduced-motion preference turns Auto off, softens flashes, disables bolts and starts paused.

## Portable copy
The shared folder contains `site/` (prebuilt browser app), `source/` (editable project), screenshots and QA receipts.
Do not double-click `site/index.html`: ES modules/WebGL assets require HTTP.
For a local copy, with Python 3 available, run `python3 START-PREVIEW.py` from the package folder; it serves only `site/` on loopback and opens a browser. Stop with Ctrl+C.
For source development: `cd source`, `npm ci`, `npm run dev`. Test: `npm test`. Build: `npm run build`. The separately named `build:artifact` creates Claude-style packaging; stale pre-improvement packaging is excluded from delivery.

## Verified
- Twelve deterministic tests passed, including twenty seeded twenty-minute Auto simulations.
- Parent check: five independently exercised two-hour Auto simulations; bounded values, cooldown, storm cap, pause and frame-rate independence passed.
- Corrected final production browser suite: **68 PASS, 0 FAIL**, desktop/390×844 portrait; every weather/wind control, keyboard/outside-close, mouse orbit/wheel, emulated touch orbit/pinch, real audio output gating, Sky/Overview camera transforms and runtime reduced-motion behavior.
- Twelve full-density production captures: clear/sunset/night/cloud/rain/storm/reef, sun, half/full moon and portrait. Parent visually inspected corrected moon discs, readable bolt, intact framing and weather treatments. Four existing postprocessing passes remain; weather effects cast no shadows.
- Original heightfield, island config and diorama geometry bytes are unchanged. Normal animal behavior/models, tree generation and sea-life models were not replaced.

## Review corrections
Parent review corrected overexposed flash, custom capture cameras silently clamped away from the moon, negative-delta clamping and meteor additive blending. Added Sky inspection viewpoint. Screenshots and browser results are actual WebGL rendering, not generated images.

## Limits and next milestone
Rendering tests used sandboxed Chromium **SwiftShader (software WebGL)**. They do not certify laptop/phone FPS, GPU milliseconds, native Safari/iOS or audible thunder quality. Sky details are stylized shaders, rain/splashes are particles, not fluid simulation.
Animal sheltering/startles, planted-foot IK, fur/detail, tree and sea-creature upgrades are **not part of this first milestone**. Optional glass droplets/chime were omitted. Owner visual/device review is the next decision; no GitHub push or public release was performed.

## Retained preview
Namespace `pocket-world-preview`; Deployment/Service `web`; NodePort `30893`; pinned Python image; versioned static files on PVC `assets` (`local-path`, RWO, 1 GiB), mounted read-only by a non-root server. Release receipt in `evidence/release.json` identifies served bytes.
Pause preview without deleting assets: `kubectl scale -n pocket-world-preview deployment/web --replicas=0`.
Resume: same command with `--replicas=1`. No existing application or GPU mode was altered.
