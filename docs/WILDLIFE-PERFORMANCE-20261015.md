# Wildlife performance investigation — 2026-10-15

**Recommendation: keep models opt-in. Candidate is NOT promoted.**

At measurement close, approved root http://127.0.0.1:30893/ and the then-current model route http://127.0.0.1:30893/models/ matched all146 original receipt hashes. A subsequent concurrent deer-withdrawal update replaced the model preview. These measurements apply ONLY to the archived five-deer model build, not the current deer-free preview; root index/app bytes were checked again unchanged. This is a completed bounded investigation, not native parity/default acceptance.

## Intervention

Tested exact current-pose, all-deformed-vertex containment with per-bone matrix reuse and eligible raw typed-array reads. No sampled-only guard, vertex skipping, pose throttling, clip substitution, source GLB changes, or land grounding/closure change. Exact reference fallback and invalid-pose latch remain. The candidate survives 1,200 transformed/scaled real-GLB poses with full reference bounds contained, maximum difference 1.000014238083935e-9 (the outward 1e-9 rounding pad);11 unit tests and49 affected bird integration checks pass.

## CPU result — software-browser host, not Windows FPS

Full-world five-bird visual work: 410.0 → 327.0 ms per120 frames (observed 20.2% less in this single A/B). Whole CPU advance: 2081.6 → 1877.0 ms.

**Counter-evidence retained:** the isolated transformed/nonuniform guard microbenchmark regressed: 215.4 / 214.4 ms reference versus 312.7 / 307.1 ms candidate, each500 calls. No blanket CPU speedup claim. The first candidate also had a microbenchmark regression and mixed native results; its complete reports remain available.

## Actual native Windows FPS

Real Windows Intel UHD630 ANGLE/D3D11 Chrome over existing SSH; temporary owned profiles/CDP; desktop high quality;1000x750/DPR1;4s warmup+10s sample/view;ABBA model/candidate followed by approved root. Frame-loop/headless observations, not universal interactive-device FPS or certified causal percentage.

| View | Existing models A1 / A2 | Candidate B1 / B2 | Approved control at end |
|---|---:|---:|---:|
| overview | 4.13 / 3.72 | 4.40 / 4.39 | 5.38 |
| forest | 3.99 / 4.03 | 3.73 / 4.11 | 4.78 |
| jungle | 4.62 / 4.86 | 4.09 / 4.69 | 4.55 |

These are same-session observations, not a certified causal percentage. FPS response is mixed by view/order; visible timing tails remain in the raw p95 data. Neither reliable improvement nor parity/smoothness is signed off. A temporary-CDP-port occupied preflight was retained as a failure and did not produce a sample; the retry used a fresh owned port without touching the occupied one. The first campaign used a dev-served bundle with identical executable prefix plus a debug sourcemap; this final campaign served the frozen candidate byte-exactly.

## Retained implementation and evidence

All completed25 original integration checks and the original fixture/closure/route/land/material/sea/vegetation/physics proofs and original failures remain retained; they were not rerun as a new implementation project or reclassified.11 new/affected unit checks +49 affected bird checks +3 new guard/CPU checks are separate. Source GLBs unchanged. Approved111 default/root/lab/v1–v5 files and all35 current models route files were verified byte-exact against the existing release receipt after measurement (146/146PASS). No deployment/default/root modification, public Git push, DNS/tunnel, cloud upload, Windows policy/profile/global-GPU changes, or new packages.

The runtime adapter in the working tree was restored byte-exactly to886811d rather than promoting a mixed-result performance change. The standalone helper/tests, exact candidate source snapshot, reversible candidate-v2.patch, frozen candidate build, and first/final measurements are retained. Apply the adapter patch only for an explicitly selected experiment; the existing helper is available in src/creatures. Re-running the source integration fixture requires that patch; the frozen candidate is standalone and does not depend on the current source adapter.

## Owner decision

1. **Keep approved default + updated preview opt-in (recommended).**
2. Authorize further bounded native profiling; remaining rendering/driver versus CPU cause is not conclusively identified by this experiment.
3. Defer default activation until the new deer-free/replacement preview has its own targeted performance evidence and explicit owner acceptance. Do not revive the rejected five-deer build. Candidate deployment is not recommended on these mixed results.

## Private review and reproduction

Private/non-commercial only: manta CC-BY-NC, bird/tuna credits retained, land licensing unverified; no new redistribution grant. Native scripts use only the existing SSH identity and local dependencies; do not read the private key or alter Windows settings. Candidate app SHA256: b4f68dba6dac571861cff629945db268fa44e94f2917ae4176ec7544bd475d73.

Shared delivery contains REPORT.html, this report, raw JSON/proofs/logs, the candidate site and source patch/snapshot. This archived candidate still contains the subsequently rejected deer; use it only to reproduce historical measurements, never as the current/default preview. To preview that archived candidate from the delivery folder: run python3 -m http.server 8765 --bind 127.0.0.1 --directory candidate, then open http://127.0.0.1:8765/?test=1. Stop with Ctrl+C. Do not use file:// or replace the live root.
