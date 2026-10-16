# Pocket World — personal home-lab asset licence review

Reviewed: 15 October 2026 (AEDT). This is a practical permission/evidence review, not a legal opinion or a warranty of title.

## Decision and authorised scope

**Owner confirms personal interest, non-commercial home-lab work only (10:26 AEDT). No public release is intended or authorised.** A public non-commercial release is therefore a future scenario, not this task's deliverable. There is no reason to buy commercial licences or replace all NC models simply for this stated use.

Recommendation: keep the current private preview and originals intact, retain the licence evidence, and record the provenance/credit issues below. This is **not blanket clearance**: personal possession, private LAN hosting, an owner-approved import and the application's ISC source licence do not independently establish asset rights. In particular, Free Standard assets and uncertain provenance remain qualified rather than fully cleared.

No models, runtime code, existing credits, deployment, visibility, originals or temporal QA were changed by this review. No creator contact, purchase, original upload, model swap, Git push or worktree creation was performed. This documentation-only work uses the current dirty folder without staging the concurrent implementation.

## Evidence baseline

Read the requested delivery document, native attribution JSON, complete approved-wildlife catalogue, latest candidate receipt and last activated receipt. Independent current evidence: **17 immediate model records** from Sketchfab's public model API, plus the shark's two declared upstream records. The immediate records show 10 CC-BY 4.0, 5 CC-BY-NC 4.0 and 2 **Free Standard** grants. This verifies what the current listings offer, not every uploader's ownership or the historic acquisition agreement.

- Active private release: **r-20261015-native-final-824d609be6c3**, receipt `review/native-selected-release.json` (qualified/served verified in that receipt). A fresh GET of the live models index matched its recorded SHA-256, 3e74e341070142a7a1351994547e8329d5f767560c314ac352844d06a80b5047.
- Latest candidate at review: **r-20261015-release-polish-5468214fdf60**, `review/release-polish-candidate.json`, **qualified:false**; do not confuse it with activated delivery. It adds elephant/eagle. This review gives it no artistic, behavioural or release acceptance.
- Actually clicked About and expanded “Selected wildlife sources and licences” on the live LAN page using the existing Playwright installation. Saved visible DOM text, link targets and accessibility tree; this was not a visual/animation/performance test.
- Direct read-only probes returned HTTP 200 and GLB magic for whale, fish and derived shark. Whale and fish response sizes were 6,837,504 and 2,885,084 bytes. No authentication was required from this LAN client. This confirms standalone client delivery, **not** Internet exposure or availability to every LAN user. No external visibility change or public-exposure scan was made.
- Evidence: `review/licence-review-20261015/` (API responses with fetch timestamps, complete linked Standard terms, CC terms, baseline hashes and live checks). No GLBs are copied into this report package.

## Per-asset decision/actions

“Compatible” below means the verified licence type supports the stated non-commercial purpose, subject to authentic source rights and compliance; it is not an unconditional title guarantee. **No replacement is authorised or performed.** Each row has its source URL, original hash and evidence references in `asset-register.json`.

| Asset | Current listing / attribution | Personal home-lab action | If a public non-commercial release is later requested |
|---|---|---|---|
| Bear | WildMesh 3D; CC-BY-NC 4.0 | Compatible; retain source/creator/licence notices. “DEMO FREE” does not override NC. | Licence permits NC sharing; complete credits/change notices first. No commercial permission implied. |
| Wolf | WildMesh 3D; CC-BY-NC 4.0 | Same; no purchase indicated for this purpose. | Same NC/attribution gate. |
| Alligator | WildMesh 3D; CC-BY-NC 4.0 | Compatible; retain originals and identify reduced near/far geometry. | NC sharing allowed with accurate derivative notices/credits. |
| Manta | DigitalLife3D; CC-BY-NC 4.0 | Compatible; existing separate credit includes source/licence and runtime adaptations. | Retain DigitalLife3D and supplied project/contributor attribution; NC purpose must remain genuine. |
| Dolphin | DigitalLife3D; CC-BY-NC 4.0 | Compatible; record source collaborators and reduced geometry/adapted runtime. | NC sharing allowed with complete credits/change notices. |
| Whale | assetfactory; **Free Standard**, not CC | Private single-owner use is compatible in principle, but establish legitimate acquisition and applicable terms; no purchase requirement inferred from the word Standard. No raw-file sharing to other users. | **Not cleared for this raw-GLB web delivery.** Obtain suitable explicit redistribution permission or propose a suitably licensed replacement, only with owner approval. |
| Fish | assetfactory; **Free Standard**, not CC | Same acquisition/access qualification as whale; generated fin/tail work does not remove source restrictions. | Same raw-GLB redistribution blocker. |
| Tiger | Embedded CGJAY1111; current listing MotionStreamStudios; CC-BY 4.0 | **Provenance open.** Same model ID, different current account name; preserve both observations, do not silently rewrite author. Listing links an “original” whose API returned 404. Keep current private research unchanged; do not claim fully established chain. | Resolve upstream rights and attribution/history, or owner-approved replacement if evidence cannot be obtained. |
| Rhino | GremorySaiyan; CC-BY 4.0 | Compatible; retain model/source/licence and native-motion adaptation notices. | Conditional clearance after complete credits; BY permits commercial use too, subject to source rights. |
| Shark | MotionStreamStudios says BY; declared chain via Sealife Fan 3 reaches **DigitalLife3D CC-BY-NC 4.0** | NC purpose fits the upstream condition, but **not clean BY-only clearance**. Record the whole chain and contributor credits; don't treat reupload BY as permission to remove original NC. No infringement finding or mesh-identity proof is asserted. | Treat as non-commercial at minimum; resolve the declared rights chain and complete upstream credits before distribution, or owner-approved replacement. Commercial use needs adequate permission from relevant rightsholders. |
| School | Titanas YT; CC-BY 4.0 | **Provenance open:** listing says “I found fish in 3D viewer”; no original author/source identified. An uploader's BY label alone does not resolve that. Preserve existing private research; request acquisition/source evidence only if further clearance is wanted. | Hold clearance pending original-source rights, or propose an owner-approved replacement. |
| Turtle | C.J..Goldman; CC-BY 4.0 | Compatible; preserve original optics, identify generated flipper animation and rendering adaptations. | Complete credits/change notice; no model replacement indicated by licence. |
| Coral fish | polyplant3d; CC-BY 4.0 | Compatible, but **missing from native ATTRIBUTION.json and live About credits** despite embedded credit. Record proposed fix; do not change implementation here. | Add title/author/source/licence and generated-motion notice before sharing. |
| Bird | FourthGreen; CC-BY 4.0 | Compatible; separate text/About credit already present; supplied model is not a verified white dove. | Retain credit and runtime flight/roost adaptation notice. |
| Tuna | GoldenZtuff; CC-BY 4.0 | Compatible; separate text/About credit already present. | Retain credit and animation/shading/fallback adaptation notice. |
| Elephant | Rukh3D; CC-BY 4.0 | Candidate-only addition at review; compatible. Candidate metadata/UI credit present, not part of activated live About. | Verify exact packaged credits/change notice if candidate ever ships. |
| Eagle | victorberdugo1; CC-BY 4.0 | Candidate-only addition; compatible. Identify generated articulation and near/far reduction, not an authored source clip. | Verify exact packaged credits/change notice if candidate ever ships. |

**Excluded/unknown:** Stag and deer have no embedded author/licence, remain removed from the reviewed release and have no clearance finding. Preserve originals; absence of a licence is not permission. Other supplied, unintegrated animals and non-wildlife textures/dependencies are outside this bounded review; this is not whole-product legal clearance.

## Verified terms and downloadable-file restrictions

### CC-BY / CC-BY-NC 4.0

Official legal texts: [BY](https://creativecommons.org/licenses/by/4.0/legalcode.en) and [BY-NC](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en), sections 1, 2 and 3.

Both permit reproduction/adaptation/sharing within their conditions; **NC does not mean “private only.”** A genuinely non-commercial public work can qualify, but the owner has not requested publication. NC means not primarily intended for or directed toward commercial advantage or monetary compensation. This owner's personal home-lab purpose fits the stated intent; a free business-promotional demo would need reassessment. No monetisation is assumed here.

When sharing, retain supplied creator/designated contributor identification, copyright and warranty notices, source links, licence identification/link, and modification history. Avoid endorsement implications. Preserve source-file metadata even when reasonable UI credits are also used. Public recipients receive licence rights directly: do not impose a blanket “no extraction/reuse” term or restrictive DRM on CC-licensed components. BY/NC are not ShareAlike requirements for unrelated application code, but code licensing cannot remove their conditions from assets.

Suggested credit format: **Title — creator; source URL; licence + URL; changes made (including inherited changes); supplied notices/contributors retained.** The register holds captured descriptions/contributors so project credits can be retained rather than guessed.

### Free Standard (whale/fish)

Both current API records explicitly say **Free Standard** and point to [Sketchfab licences](https://sketchfab.com/licenses). Do not mislabel them as paid purchases or as Creative Commons. The linked general agreement includes purchase/invoice boilerplate; the exact free-download acquisition terms/version for these supplied files have not been independently established. Retain acquisition evidence if available; absence of an invoice is not itself proof a free download was unlawful.

The linked restrictions are nevertheless material: section **2.2(b)/(h)** prohibits making standalone files available for others to download/extract/access; **2.7** requires appropriate website terms against standalone reuse, and **12** addresses embedded notices, safeguarding access and backup/copy limits. Apply the actual acquisition agreement rather than inventing a blanket “free for anything” grant. These qualifications also matter to existing private handoff copies and any additional users; “private” is not an unlimited redistribution licence. No existing copies were deleted or moved.

A browser fetches a usable GLB. No Download button, minification, decimation, obfuscation, a hidden URL or app source licence cures an absent redistribution right. The currently probed raw whale/fish URLs are not a basis for public clearance. This does **not** declare a single owner's own local rendering prohibited; the issue is entitlement, recipients and standalone access. Public non-commercial status alone would not cure Standard restrictions. Any future change of delivery architecture needs separate evaluation; no DRM workaround is certified.

## Attribution findings and proposed follow-up (not implemented)

1. **Add coral fish** to the credits/register used for a future build. Its GLB says polyplant3d; the immediate online record agrees. Current live About and native JSON omit it.
2. **Correct shark clearance assumptions**, not embedded originals: disclose the declared DigitalLife3D → Sealife Fan 3 → MotionStreamStudios chain and NC source; retain Johnson Martin/project contributors and inherited modifications where supplied. No BY-only commercial clearance.
3. **Reconcile tiger author history/upstream evidence**; retain embedded CGJAY1111 and current account observation without guessing that a rename proves authorship.
4. **Resolve school provenance** before public sharing. “Found in 3D viewer” is not an original-rights statement.
5. Use **Free Standard** accurately for whale/fish; establish legitimate acquisition and recipient/copy scope, without assuming paid licences are needed for personal work.
6. Centralise per-asset modification notices: the live About has a useful general derivative notice and tiger/static-motion caveats, but “original bytes retained” is not by itself an adequate description of every served derivative. Preserve notices on source assets; document reduction, shark coordinate repair, generated locomotion/deformation/articulation and material/runtime changes. Candidate eagle/elephant credits must be evaluated with their candidate, not claimed already live.

**Nothing here authorises implementation edits.** If the owner later wants these credit improvements, they can be a separate, narrowly tested patch. Creator contact, purchases, uploads/publication, visibility changes and model substitutions all require explicit owner approval. Proposed replacements should come with authentic CC0/CC-BY or specifically redistribution-permitting rights, original/source hashes and a new licence receipt; then repeat relevant appearance, rig/clip, contact/habitat, temporal movement, pause/reset, LOD, optics and performance QA against preserved baselines. Do not weaken existing temporal checks to make a replacement pass.

## Closure

Delivered: documented personal-use decisions, online grant evidence, rights-chain exceptions, actual live credit/download checks and a per-asset register. Outcome: **review complete; blanket asset clearance not established**. Public/commercial launch is neither requested nor approved. The next decision belongs to the owner if/when sharing beyond the personal home lab, asking for a credit-only patch, or supplying acquisition/source evidence. No paid work or replacement campaign is needed to satisfy this review.
