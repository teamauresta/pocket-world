# Preview deployment example

These manifests are examples for a separate `pocket-world-preview` namespace.
They are not connected to an existing deployment. Review storage, release paths,
and namespace settings before applying them.

The web service defaults to ClusterIP. For temporary local access, after a
reviewed deployment, run:

```bash
kubectl -n pocket-world-preview port-forward --address 127.0.0.1 service/web 8080:8080
```

Open `http://127.0.0.1:8080/`. The static server has no authentication. Keep it
behind trusted-network controls; add an authenticated TLS proxy before any
Internet exposure. A `private` label does not enforce access restrictions.

`storage.json` includes a temporary upload pod and a persistent volume claim.
Do not blindly reapply staging resources or delete persistent storage. Populate
a new immutable release directory and review `SITE_ROOT` before activating it.
The deployment uses a non-root user, read-only mounts and root filesystem,
dropped capabilities, and no mounted service-account token.
