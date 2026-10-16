# Owner-approved source release and LAN publication — 15 October 2026

Owner approved the latest appearance at 11:37 AEDT and requested commit, push and publication. The existing configured publication target is the personal, non-commercial K3s LAN site; there is no configured Internet website or GitHub Pages deployment. The parent explicitly announced LAN-default promotion and code-only GitHub publication before acting. This does not silently authorise a new public model-download endpoint.

## Release

- Approved immutable runtime: `r-20261015-approved-a5d17b73cc8c`.
- Default site: `http://127.0.0.1:30893/`.
- Equivalent direct entry: `http://127.0.0.1:30893/models/`.
- Previous default: `http://127.0.0.1:30893/v6/`.
- Existing lab and `/v1/`–`/v5/` comparisons preserved.
- Historical publication instructions are superseded by the fresh Pocket World repository; no earlier Git branches or commits are imported.

All 57 files of the owner-approved model world are copied **byte for byte** to the default root. The same 57 files remain at `/models/`. The preceding root's 29 files are copied unchanged to `/v6/`; 82 existing lab/older-comparison files are unchanged. Total immutable payload: 225 files. No model, camera, motion controller, material, scenery or simulation code changes are needed for this route promotion.

The previous deployment is `/site/releases/r-20261015-release-polish-ed37dfde25a5`; rollback switches only this deployment's `SITE_ROOT` back to that existing directory. Publication patches use a current-value JSON test before changing the pointer. The pinned server image, serving code, resource limits, security settings, service, PVC, unrelated apps and Gateway remain unchanged. No DNS/tunnel/GPU/Windows-policy changes.

## Validation and evidence

The publication replay ran all **228 source tests** with zero failures and both production builds. There is no configured JS linter: all 184 tracked JavaScript/MJS files were syntax-checked with `node --check`, plus Git whitespace checks. Third-party Vite licence text was retained while removing trailing whitespace flagged by the pre-push check.

The prior 29 combined technical/strict A/B checks, 8 final finder checks and 6 live checks remain evidence for the exact approved runtime. This publication additionally verifies all 225 mounted and served hashes, the root's actual model-ready/finder/movement/credits/GL checks, and unchanged comparison paths. Runtime evidence, guarded rollback and the eventual exact source commit are retained locally in `review/approved-default-*`; do not mistake preparation for successful publication without the completed receipt.

## Repository and asset boundary

Only source, notices and documentation are pushed. Supplied/derived GLB binaries remain private and are explicitly ignored; this public Git history contains no GLBs. No untracked research/evidence directory is swept into the commit. A fresh clone without private models can use `?proceduralModels=1`; full private-model qualification needs the legitimately acquired GLBs and historical fixtures described in the handoffs.

The [asset review](ASSET-LICENCE-REVIEW-20261015.md) documents the earlier personal-use scope and remaining provenance/redistribution constraints. Source publication does not grant asset rights. In particular, whale/fish Free Standard terms are not cleared for public raw-GLB web delivery; several assets also require provenance and attribution follow-up. No Internet model publication, paid acquisition, creator contact or replacement campaign is performed here. Native low-end performance remains limited; the Balanced option is not a smoothness guarantee.
