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

The current owner portfolio contains five public sites. Two are configured for managed Growth operation and three remain proposal-only until explicitly promoted.

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
node bin/arwp-portfolio.mjs rollout --trend=webmcp-origin-trial-evals --include-watch --json
```

Each candidate carries:

- site/repository identity;
- matched verticals;
- Trend Radar source and maturity;
- action and measurement references;
- candidate type (`site-audit`, `owner-review`, or `manual-review`);
- an explicit next step;
- `productionMutationAllowed: false`;
- owner-controlled evidence classification.

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
current public-site Growth audit
        ↓
keep only actions actually active on that site
        ↓
implementation / owner-control review
        ↓
Growth Experiment + visibility evidence
```

A portfolio match is intentionally weaker than a site audit. It tells ARWP where to look, not what to patch.

## Guardrails

- Owner-controlled portfolio membership is not independent adoption evidence.
- No ranking, citation, recommendation, traffic, or conversion gain is inferred from a portfolio match.
- No generic production patch is generated from vertical matching alone.
- Retired trends never roll out.
- WATCH trends remain opt-in research candidates.
- Site-specific implementation still depends on the live Growth Profile and repository context.
