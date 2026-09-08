# Portfolio workspace contract

The workspace is a local operating index. It is not the public adoption directory and should usually remain outside site repositories because `checkout` may contain machine-specific paths.

## Site fields

- `id`: stable local identifier used by `--site` filtering.
- `checkout`: absolute path or a path relative to the workspace file.
- `canonicalUrl`: optional public HTTPS root used only by `fleet-live`.
- `profilePath`: optional local ARWP profile relative to the checkout.
- `publicProfilePath`: public path relative to the canonical URL; defaults to `ai/site-profile.json`.
- `discoveryFiles`: local relative paths whose presence matters to this site.
- `checks`: reviewed commands for `fleet-verify`. Each check has an `id`, an `argv` array, optional relative `cwd`, and timeout.

Do not put shell operators, environment setup or secrets in `argv`. Write an explicit repository script when a check needs several steps, then call that script by argument array.

## Inspection states

- `ready`: checkout, Git, declared files, and profile checks are healthy and the worktree is clean.
- `dirty-preserved`: evidence was collected, but verification and mutation should avoid the checkout.
- `profile-attention`: declared local profile is missing, invalid, or has a different canonical URL.
- `discovery-attention`: at least one configured discovery file is missing.
- `not-git` or `missing-checkout`: local setup needs attention before repository work.

These states prioritize investigation. They are not scores and do not establish public release or search performance.

## Useful commands

```bash
arwp-portfolio fleet-init existing-inventory.json --output=portfolio-workspace.json
arwp-portfolio fleet-check portfolio-workspace.json
arwp-portfolio fleet-inspect portfolio-workspace.json --output=inspection.json --json
arwp-portfolio fleet-inspect portfolio-workspace.json --site=site-a,site-b --json
arwp-portfolio fleet-verify portfolio-workspace.json --site=site-a --output=verification.json --json
arwp-portfolio fleet-live portfolio-workspace.json --output=live.json --json
```

Keep timestamped receipts. Do not overwrite the only previous observation when comparing changes.
