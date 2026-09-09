# Goose Controlled Cohorts

Controlled Cohorts are the bridge between a plausible Search/AI recommendation and evidence from an owned site.

The contract freezes three things **before post-change outcomes are reviewed**:

1. treatment pages/entities;
2. comparable unchanged controls;
3. a stable query/prompt panel.

It also refuses to start the observation clock until a production receipt proves that the frozen implementation is actually live.

## Why this exists

A common failure mode in website experiments is to compare “before” with “after” while changing the cohort, query set or deployment state along the way. That makes a positive screenshot easy to obtain and hard to interpret.

Goose instead keeps the cohort explicit and versioned. Small or negative experiments remain useful evidence.

## Contract

`schema/controlled-cohort.schema.json` records:

- exact site and repository;
- frozen repository implementation ref;
- source experiment/evidence artifact;
- treatment and control members;
- fixed query panel and target entities;
- baseline owner/public/deployment evidence;
- production measurement gate;
- declared observation windows and outcomes;
- decision rules and anti-causality guardrails.

A site-specific cohort is allowed to be smaller than a generic playbook target when the real published universe, safety boundary or expansion policy makes a larger cohort artificial.

## CLI

```bash
node bin/arwp-cohort.mjs validate cohort.json
node bin/arwp-cohort.mjs summarize cohort.json
node bin/arwp-cohort.mjs gate cohort.json \
  --production-ref=<exact-live-commit-sha>
```

`gate` returns exit code `0` only when the independently observed production ref exactly matches the frozen implementation ref. A mismatch returns `2` and the observation clock stays stopped.

This deliberately separates:

```text
repository implementation
        !=
verified live deployment
        !=
Search exposure
        !=
ranking/citation
        !=
acquisition/product outcome
```

## Cohort integrity rules

Validation rejects:

- the same entity/source in treatment and control;
- duplicate member or query IDs;
- query targets outside the frozen cohort;
- non-increasing observation windows;
- `ready-to-observe` or `observing` state while the production gate is HOLD;
- a ready production gate whose production SHA does not match the implementation SHA.

Changing query text or treatment/control membership after outcomes are visible should create a new cohort/version rather than rewriting the old freeze.

## First dogfood: Ptichi PTI-DA-001

`knowledge/experiments/2026-09-09-ptichi-cohort-freeze.json` imports the existing owner-reviewed Ptichi Data Authority experiment rather than inventing a parallel design.

The authoritative site-specific design contains:

- 12 existing treatment entities;
- 6 comparable unchanged controls;
- 12 fixed English Search queries;
- no new indexable URLs;
- 14/28/56-day review windows.

The generic earlier Goose plan suggested 20–50 treatment pages. Ptichi overrides that because its binding expansion gate and current published universe make 20–50 artificial. The smaller real cohort is preferable to manufacturing extra pages for statistical appearance.

At freeze time, Ptichi source `main` contains the treatment implementation, but the preserved production receipt points to an older commit. Therefore the cohort is `measurement-hold`. No outcome should be attributed to PTI-DA-001 until production evidence matches the frozen implementation ref.

## Relationship to Winner Observatory

The fixed query panel can later seed Winner Observatory snapshots:

```text
Controlled Cohort freeze
        ↓
verified production gate
        ↓
Winner snapshot at T0 / T14 / T28 / T56
        ↓
result + citation persistence
        ↓
owner Search/AI evidence
        ↓
treatment vs control review
        ↓
Recommendation Review event
```

Winner Observatory and owner metrics are complementary. Public result observation does not replace Search Console/Bing owner evidence, and owner visibility does not prove a hidden ranking factor.

## Scale-up rule

Do not expand a cohort merely because the site can generate many pages. Expand only after a review establishes that:

- the existing pages are genuinely useful;
- the observed queries fit their jobs;
- control behavior has been considered;
- crawl/index/release truth remains healthy;
- neutral and negative outcomes remain in the record.

A `GO` decision permits the next bounded experiment; it is not a general ranking claim.
