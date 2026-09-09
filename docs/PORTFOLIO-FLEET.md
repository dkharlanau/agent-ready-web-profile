# Goose portfolio fleet

The fleet workflow turns a collection of local website checkouts into one repeatable operating queue. It complements the public owner-portfolio trend registry: the registry answers which reviewed changes may apply; the workspace answers which local repositories are available, clean and ready to verify.

## Start from an existing inventory

```bash
arwp-portfolio fleet-init portfolio-inventory.json --output=portfolio-workspace.json
arwp-portfolio fleet-check portfolio-workspace.json
arwp-portfolio fleet-inspect portfolio-workspace.json --output=inspection.json --json
```

`fleet-init` preserves known checkout, canonical URL and profile-path fields. It creates no test commands. Review the output before adding each repository's actual checks.

## Fast operating modes

- `fleet-inspect` reads Git state, profile validity, canonical consistency and declared discovery-file presence. It does not fetch remotes or modify a checkout.
- `fleet-verify` executes reviewed argument arrays without a shell, sequentially per checkout and concurrently across sites. Dirty worktrees are skipped by default. Receipts keep the executable, argument count and argument/output SHA-256 hashes rather than collecting argument values or logs.
- `fleet-live` performs bounded public HTTPS reads of the canonical homepage and public profile. It validates the profile and reports whether the homepage references it.

Filter any mode with `--site=id-a,id-b`. Concurrency is bounded independently: inspect up to 8, local checks up to 4, and public reads up to 5.

## Evidence boundaries

An inspection describes current local files. A passing command describes one configured local check. A live response describes public HTTP at the observation time. None proves commit identity, successful provider deployment, indexing, ranking, AI citation or business outcomes. Keep those receipts and owner measurements separate.

Use the [`arwp-portfolio-fleet` skill](./skills/arwp-portfolio-fleet/SKILL.md) to choose the smallest useful target set and route a selected site into the existing Growth Loop.
