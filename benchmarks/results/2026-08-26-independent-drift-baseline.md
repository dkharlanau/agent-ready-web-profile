# Independent resolver drift — persisted baseline observation

Observed on 2026-08-26 from GitHub Actions run `32918402907` at commit `4b5541a511605c9455067ed2471964089b12b294`.

This is operational engineering evidence for the resolver monitor. It is not evidence of external adoption and it is not a public Internet registry.

## Corpus

The persisted observation corpus is `benchmarks/drift-corpus.config.json` and contains six independent public sites:

- A2A Protocol documentation
- Model Context Protocol documentation
- Stripe documentation
- Supabase documentation
- Vercel documentation
- JSON Feed

The workflow is `.github/workflows/independent-resolver-drift.yml`. It restores prior snapshots from a GitHub Actions cache, performs bounded resolution, writes a compact drift report, preserves report/snapshot artifacts for 90 days, and fails only on the configured monitor classes. The initial corpus currently configures `resolution-failed` as the only fail-on class so ordinary observed change is collected as evidence instead of being treated automatically as a CI regression.

## Attempt 1 — baseline creation

Observed at `2026-08-26T01:17:23.475Z` with Resolver `0.2.0`:

- sites: 6
- baseline created: 6
- stable: 0
- drifted: 0
- resolution failed: 0
- configured monitor failure: false

Artifact ID: `9588968060`

Artifact digest: `sha256:b9c075599d58f29762829b51164846355f2e2f7387570598509ace2a7ab83f7f`

The baseline resolved the MCP documentation canonical URL to `https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro`; the other five retained their configured canonical site/documentation URLs.

## Attempt 2 — persisted-state check

The completed monitor job was deliberately rerun after the first cache save to verify that the workflow actually restored and compared the prior persisted snapshots rather than creating a new baseline every time.

Observed at `2026-08-26T01:18:56.465Z`:

- sites: 6
- baseline created: 0
- stable: 6
- drifted: 0
- resolution failed: 0
- configured monitor failure: false
- identity changes: 0
- source additions/removals/changes: 0
- interface additions/removals/changes: 0
- conflict additions/removals/changes: 0
- intent-plan changes: 0

Artifact ID: `9588998609`

Artifact digest: `sha256:324cf47a0143af169751264e1db27559cb9db21293ff59a041a47183450d75bf`

This second observation proves the persistence/comparison path works for the reviewed corpus. It does **not** prove that real external drift has occurred: no structural drift was observed in this short interval. The issue gate for observing actual independent-site drift therefore remains open until a future scheduled observation records a real structural change.
