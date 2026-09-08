# ARWP Portfolio Rollout

ARWP can map reviewed Trend Radar changes to an owner-controlled website portfolio without pretending that a trend automatically applies to every site.

The portfolio layer is operational metadata. It is not an adoption directory, quality ranking, or independent evidence cohort.

## Model

`registry/portfolio-sites.json` records:

- the canonical website URL;
- the repository that owns the site;
- explicit Growth verticals;
- owner goals;
- rollout mode;
- optional provider allowlists and trend exclusions.

The current owner portfolio contains six public sites. Three are configured for managed Growth operation and three are proposal-only until explicitly promoted.

`https://ptichi.com/` is included as a proposal-only target. Ptichi is intentionally treated as a fresh-site baseline in the separate State of the Agentic Web owner reference cohort because its first recorded public release is 2026-09-05. Freshness is context for comparison, not evidence that ARWP caused later Search or AI-discovery movement.

## Rollout rules

Default rollout includes only `ADOPT` and `MEASURED` trends.

A trend becomes a site candidate only when:

1. the portfolio site is enabled;
2. the trend stage is allowed by the requested rollout;
3. the trend and site have at least one exact vertical in common;
4. the provider is allowed for that site when a provider allowlist exists;
5. the trend is not explicitly excluded for the site.

`general` is a normal vertical, not a wildcard. This prevents a trend that applies to `general` and `software-product` sites from leaking into unrelated editorial or research sites.

`WATCH` never enters the default rollout. It requires an explicit `--include-watch` opt-in and remains `watch-only`.

## CLI

```bash
node bin/arwp-portfolio.mjs check
node bin/arwp-portfolio.mjs list
node bin/arwp-portfolio.mjs rollout --json
node bin/arwp-portfolio.mjs rollout --site=metkagram-language-knowledge --provider=google --json
node bin/arwp-portfolio.mjs rollout --site=ptichi-fresh-site --json
node bin/arwp-portfolio.mjs rollout --trend=webmcp-origin-trial-evals --include-watch --json
node bin/arwp-portfolio.mjs propose --json
node bin/arwp-portfolio.mjs propose --site=dkharlanau/dkharlanau.github.io --provider=google --json
```

For local operations across a larger set of checkouts, use the separate [portfolio workspace workflow](./PORTFOLIO-FLEET.md). It adds read-only Git/profile inventory, reviewed local checks and bounded public profile checks without changing the six-site trend-mapping registry.

Each rollout candidate carries:

- site/repository identity;
- matched verticals;
- Trend Radar source and maturity;
- action and measurement references;
- candidate type (`site-audit`, `owner-review`, or `manual-review`);
- an explicit next step;
- `productionMutationAllowed: false`;
- owner-controlled evidence classification.

## Target-specific proposal bundles

`arwp-portfolio propose` converts the filtered rollout candidates into deterministic review artifacts grouped by target repository.

Each proposal includes:

- a stable proposal ID derived from the target and mapped trend evidence rather than the execution time;
- target site/repository identity and rollout mode;
- the exact Trend Radar candidates, primary sources, matched verticals and ARWP action/measurement references;
- a suggested GitHub issue title and review body;
- an explicit live-site audit requirement before any action is kept;
- `githubMutationAllowed: false` and `productionMutationAllowed: false`;
- an explicit requirement for separate target-repository authorization before any later GitHub write.

The command does **not** create an issue. This boundary is intentional: vertical/trend matching is enough to decide where to investigate, but not enough to decide what must change on a deployed site.

Explicitly requested unknown site IDs or repositories are returned in `unknownTargets`. ARWP emits no generic fallback proposal for them.

Proposal IDs remain stable for the same target and same mapped Trend evidence even if the command is rerun later. This allows downstream review systems to de-duplicate proposals without pretending that a proposal is implementation evidence.

## Rollout modes

- `managed-issue` — the site is ready for the recurring Growth backlog/experiment workflow.
- `proposal-only` — ARWP may produce target-specific review candidates, but should not create a recurring managed issue automatically.
- `observe-only` — retain the site in portfolio reasoning without generating implementation work.

The mode does not authorize production changes. It only controls how far the rollout workflow may proceed before another explicit review boundary.

## Correct workflow

```text
reviewed Trend Radar change
        ↓
owner portfolio vertical mapping
        ↓
target-specific rollout candidate
        ↓
review-only proposal bundle
        ↓
current public-site Growth audit
        ↓
keep only actions actually active on that site
        ↓
explicit target-repository authorization when a GitHub write is desired
        ↓
implementation / owner-control review
        ↓
Growth Experiment + visibility evidence
```

A portfolio match is intentionally weaker than a site audit. It tells ARWP where to look, not what to patch.

## Owner-controlled research comparison

`research/state-of-agentic-web/reference-sites.json` keeps the user's own sites in a separate comparison cohort. It includes the five previously registered GitHub-hosted portfolio sites, ARWP itself, and Ptichi.

The comparison cohort can be used for longitudinal checks such as Growth debt, Search/agent surfaces, implementation velocity and owner visibility evidence. It is explicitly excluded from the independent State of the Agentic Web aggregate.

## CI evidence

The dedicated `ARWP Portfolio Rollout` workflow validates both layers:

- default rollout excludes WATCH/retired trends and never authorizes production mutation;
- proposal generation produces target-specific review artifacts without GitHub mutation;
- proposal IDs are deterministic for unchanged evidence;
- an unknown target is reported and receives no generic proposal;
- JSON rollout/proposal/unknown-target outputs are retained as workflow artifacts.

The State of the Agentic Web research workflow separately validates that owner reference sites, including Ptichi, cannot enter the independent aggregate.

## Guardrails

- Owner-controlled portfolio membership is not independent adoption evidence.
- No ranking, citation, recommendation, traffic, or conversion gain is inferred from a portfolio match.
- No generic production patch is generated from vertical matching alone.
- Retired trends never roll out.
- WATCH trends remain opt-in research candidates.
- Site-specific implementation still depends on the live Growth Profile and repository context.
- Suggested issue text is a review artifact, not permission to create or mutate a target-repository issue.
