# Owner legacy materials — repaired local rendering, not integrated actors

The supplied bear, elk, wolf, alligator and school-of-fish GLBs require `KHR_materials_pbrSpecularGlossiness`, unsupported by the installed stock GLTFLoader. The original inspection correctly rejected that unsupported production path and retained explicitly white diagnostic images.

`src/creatures/imported-materials.js` adds an injectable GLTFLoader extension. It binds the actual author-provided diffuse image/factor/alpha; uses author specular RGB as linear F0 and glossiness (including optional packed-map alpha) in the current Three physical BRDF. It is not a metallic-roughness rebake or a source-file rewrite. Core normal/AO/emissive, double-sided and alpha settings remain parser-owned. Source files are unchanged. The default imported-assets loader still fails closed for unsupported extensions; callers must explicitly supply `createImportedMaterialLoader()`.

```js
const asset = await loadImportedAsset({ url, loader: createImportedMaterialLoader() });
```

## Verified

- Four CPU tests passed: texture/factor bindings and immutable JSON, current BRDF/wet-hook composition, independent clone color/scalars with shared immutable texture ownership, unrelated-extension rejection.
- Five real software-WebGL texture/animation comparisons passed. Changed authored-color pixels versus the original white diagnostic: bear 45,024; elk 23,546; wolf 37,675; alligator 10,896; school 9,101. All five also had positive changing-animation pixels, actual linked shaders, real texture bindings and zero GL errors. Original file hashes unchanged.
- The first run's final console gate failed once on the fixture's missing default favicon (404). `review/owner-material-evidence/report.json` and `run.log` retain that failure, rather than presenting the original suite as all-green. An inline fixture favicon was added; only the failed clean console/network gate was rerun for the five repaired loads. `error-gate.json` passed with zero page/console/HTTP errors and zero warnings. Original successful comparisons were not rerun or overwritten.
- Parent inspected corrected bear and elk PNGs. Bear now has its real dark fur texture instead of white fallback. Elk's pictured lying pose is its selected authored idle clip, not a walking/contact demonstration.

Evidence: `review/owner-material-evidence/`. Local fixture: `http://127.0.0.1:4174/review/owner-material-evidence/`.

Limits: sampled correct material/skin rendering is not integrated locomotion, sole contact, complete animation-loop continuity, artistic identity with an original author renderer, mobile performance or native hardware FPS. No original source conversion or public/live publication. Existing licence/NC/Standard limitations remain; support does not relicense supplied assets. Rendering passes do not satisfy near/far geometry or bone/texture budgets by themselves.
