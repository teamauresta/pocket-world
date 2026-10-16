# Independent Feature 10 QA — author handoff

## Scope / actual execution
- Authored only review/vegetation-detail-qa.mjs, this note, and review/vegetation-author-evidence. No application edits, servers, installs, GPU switches, deploys, commits or pushes.
- Read Feature 10 in docs/OWNER-BUILD-GUIDE.md and src/veg/detail-contract.js. Local HEAD at inspection: d9df78a4275dcd755076bad4035b30a44b7e201a. Workers were actively editing; transient partial files were not treated as release failures.
- Ran existing immutable animal server http://127.0.0.1:30893/ in sandboxed Chromium/SwiftShader. First run used test=1&lite=1 **for adapter smoke only**. It produced 9 real WebGL PNGs (7 high + 2 mobile), actual linked shader source, buffer attributes/topology, swept shelter checks, solid and terrain inventories.
- report.json intentionally remains FAIL: no Feature 10 acceptance is manufactured from the old animal stage. New workers have not been tested in an integrated served build by this author.

## Verified baseline receipts
- Both tiers: **319** finite positive solid records, exactly identical sorted x/z/r records.
- SHA256(JSON.stringify(sorted records)): **92b7cc6a6ce5cbd855164da278683c7c4fd0502cb231ea7cf2a478c9dcc677df**.
- baseline.json contains complete high/low solids, decoration and canopy records, height/coast/zone arrays and actor starts. Height/coast/zone arrays equal across quality tiers.
- 12 actual actors per tier: independent brute-force solid clearance plus terrain/river/body footprint checks passed at starts and along all returned shelter paths sampled at <=0.15 world units. This checks reachability, not storm arrival, foot planting or deer bolt behaviour.
- Actual shaders linked/compiled; no page/console/network errors; low 390x844 had no sideways overflow or WebGL context loss.
- Initial perch failure traced to **lite** capping each InstancedMesh.count at 3 while retaining 92 full perches. Only 30 perches were rendered. Not a new vegetation regression. Updated harness measures full instanceMatrix capacity and marks rendered status; feature mode strips lite and requires rendered matches. See perch-capacity-recheck.json for corrected proof.
- Initial placement test flags old woody geometry outside nav-radius envelopes (including bushes); no below-water coastal vertices were observed in the lite subset. These broad conservative envelope flags require per-part classification; do not claim baseline collisions from them alone. They are not waived for new geometry.
- Initial lite bamboo close view already exceeded the hard triangle bound: **2,509,244 triangles / 195 calls**. Other recorded cameras passed <=2.5m /260. Full production and new vegetation budgets remain unqualified.
- Software wall-time is not hardware FPS. Initial lite captures are not final full-density beauty comparisons.

## Run after parent integrates workers

a. Preserve this evidence directory. Harness rejects nonempty output directories.

b. Run against a parent-owned new integration server:

    node review/vegetation-detail-qa.mjs --url http://HOST/ --out review/vegetation-final-evidence --baseline review/vegetation-author-evidence/baseline.json

Feature mode removes lite; desktop high and mobile low are real independently loaded scenes. Full-density software render may be expensive. No server is started by the harness.

c. Parent must pair final views with the immutable animal baseline PNGs at the **same explicit camera spec**. Camera files are exported; scene-selected targets can move with new species. The author smoke images only demonstrate adapters. Forest/detail images visibly contain foliage, but automated target selection can put cameras inside cards; a reviewer must select useful externally framed views and inspect actual roots/bark/understory, not infer visibility from filenames.

## Implemented independent gates
- Actual BufferGeometry vertex/index attributes: finite ranges, actual counts, connected components, position digests; card-constant scalar depth and 0..2 integer leaf variants. Depth remeasured from documented 26 support planes using real positions, not metadata.
- Distinct position buffers for five variants for each named species. Species labels attribute buffers; labels alone never pass. Worker names / userData.detail.species supported.
- 15–20 connected grass blade components; three named flower shapes with distinct geometry digests and component topologies. Dry tips and stem bending still require attribution.
- Actual texture dimensions and three independent atlas-cell digests through renderer material uniforms (not allocated-map declarations). Legacy bamboo/palm fallback texture tier excluded from tree-species resolution gate.
- Actual GL shader link/compile/source receipts; necessary crown consumer checks are explicitly not a wind/shadow equivalence proof.
- Restored crown-depth-zero A/B rendered pixel delta at frozen camera/time/light: requires positive changed pixels and brighter unshaded result, not a beauty score. Directional-light reversal pixel response also measured; not specific proof of translucency/backlighting.
- Exact baseline 319 record and terrain array hashes, nonempty high/low scene coverage, full actor navigation independent checks, actual branch-vertex perch proximity, every rendered plant vertex coastal/low-wood envelope probes.
- Actual one-colour-pass renderer counters per view; shadows temporarily disabled for counter isolation and restored. Console/network errors and mobile overflow fail.
- Negative controls in negative-controls.json intentionally corrupt depth and per-card variants; measurement must reject both.

## Mandatory open gates — currently fail, not skipped PASS
The harness deliberately reports REQUIRED_REVIEW_NOT_AUTOMATICALLY_PROVEN for the following. Parent must extend measurements or attach an independent review receipt; do not simply flip booleans.
1. Root tube count 3–5, trunk flare, buttress/aerial roots: need mesh object + actual vertex/index ranges identifying parts. Verify ranges against component counts, spatial distributions and original stem envelope; scalar metadata is insufficient.
2. Lianas: verify actual stem/card mesh endpoints match tree branch vertex refs, sampled clearance and occupied nav envelopes. Snags/fallen logs were explicitly omitted in current trees source to preserve old navigation; this is a Feature 10 scope gap, not a pass.
3. Fern curl, dead/ragged palm fronds, coconut clusters, bamboo nodes/sheaths and dry grass tips: real named meshes/ranges and measured geometry/colour required. New code metadata can guide but cannot certify.
4. Actual colour/depth shader wind equivalence and bird-perch matching. Compare linked shaders' deformation functions/constants for each material and its customDepthMaterial, then positive motion samples at shared uniforms; source token presence alone fails this gate.
5. Atlas texture binding in linked programs: allocation plus correct dimensions does not prove the sampler participates. Verify active uniform locations and use, plus positive texture perturbation pixels. Full-resolution detail modulation over a retained 512 silhouette is not a newly authored 1024 silhouette; provenance must stay clear.
6. Human baseline/final visual non-regression, close forest/jungle layers, root/shore and bamboo clipping, observable high/low detail reduction.

Minimal proposed adapter additions only if needed: semantic part refs/ranges and compiled material/program association, exposed read-only in test mode. Existing __isle / __isleBuild hooks were inspected and used without adding hooks. No production API rewrite is needed.

Parent retains all 72 animal-source, 13 foot, 68 weather and final six strict pause checks plus accepted regression policy. No vegetation gate redefines a previously qualified deer bolt constraint as green. No native-FPS or full artistic claim.
