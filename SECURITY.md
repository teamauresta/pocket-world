# Security

Do not commit credentials, private keys, `.env` files, kubeconfigs, or private
model binaries. Use environment variables or ignored local configuration.
GitHub Actions scans history and checked-out files with Gitleaks on pushes,
pull requests, manual runs, and weekly. Review findings before merging.

## Local review tools

Install optional browser review dependencies with
`npm install --no-save --package-lock=false playwright ws`.
Review scripts resolve these packages locally. Set `POCKET_WORLD_PREVIEW_ORIGIN`
to your preview origin (scheme, host, and port, without a trailing slash).
Otherwise scripts use loopback defaults. Published URLs and archived receipts
use neutral examples; they are not evidence of a currently reachable service.

For native Windows benchmarks, set `POCKET_WORLD_SSH_HOST` to your SSH target
and optionally `POCKET_WORLD_SSH_KEY` to the local key path. Set `remoteTempDir`
in the ignored benchmark JSON configuration to a writable Windows temporary
directory. Keep that configuration local. SSH host-key checks remain enabled.

Set `POCKET_WORLD_MODEL_SOURCE` to the private source-model directory for model
processing. Release staging scripts take `POCKET_WORLD_PREVIOUS_SITE` as the
previous release directory. Neither directory should be committed.

## Preview access

The preview server has no authentication. The example service uses ClusterIP and does not open a NodePort.
Any externally exposed deployment requires operator-supplied network access controls. A label saying `private`
does not enforce access restrictions. Keep any externally exposed service behind trusted-network
firewall rules and check both IPv4 and IPv6, router port forwarding, tunnels,
and ingress configuration. Do not expose it to the Internet without an
authenticated TLS proxy. No firewall or cluster settings are changed by this
repository cleanup.

## Repository history

This repository starts from a sanitized source snapshot with fresh Git history.
It does not import prior commits, author metadata, or archived machine reports.
Local private models and unfinished plans are excluded from publication.

Report vulnerabilities using GitHub private vulnerability reporting when
available. Never put credentials or exploit details in a public issue.
