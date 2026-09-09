# Cite Goose Site Focus v0.3

Site Focus v0.3 turns a broad instruction such as “make this site clearer, brighter and faster” into an explicit owner-declared contract that can be compared with the observed site without inventing a ranking or design score.

It extends v0.2. Existing v0.2 profiles remain supported.

## Why v0.3 exists

A technically valid site can still have an unclear product boundary: too many audiences, unrelated top-level topics, a homepage that reads like a feature catalog, navigation that mirrors repository structure, or a distinctive visual direction that gets diluted by unbounded UI expansion.

v0.3 therefore makes five things explicit:

1. **problem lanes** — who has each first-order problem, what the problem is, the desired outcome and the next action;
2. **homepage ownership** — one primary lane, supporting lanes and the signals the homepage must communicate;
3. **navigation budget** — an owner-declared maximum for primary navigation plus a consistency requirement;
4. **visual principles** — a small design contract carried as intent, never converted into an automated beauty score;
5. **performance budget** — LCP, INP and CLS field-data ceilings that static analysis is forbidden to fabricate.

## Profile

Use `docs/examples/site-focus-v0.3.profile.json` as the copyable starting point.

```json
{
  "version": "0.3",
  "problemLanes": [
    {
      "id": "decide",
      "label": "Decide",
      "job": "Understand what the site should own.",
      "audience": "A site owner deciding what to publish.",
      "problem": "The site covers too many unrelated intents.",
      "desiredOutcome": "Choose a small explicit problem boundary.",
      "primaryAction": "Review the declared scope."
    }
  ],
  "homepage": {
    "primaryLane": "decide",
    "supportingLanes": [],
    "requiredSignals": ["problem", "audience", "outcome", "evidence", "action"]
  },
  "experience": {
    "visualPrinciples": [
      "Bright high-contrast identity without decorative clutter.",
      "Strong typographic hierarchy with evidence-led diagrams."
    ],
    "navigation": {
      "maxPrimaryItems": 5,
      "consistentAcrossPages": true
    },
    "performance": {
      "lcpMsP75Max": 2500,
      "inpMsP75Max": 200,
      "clsP75Max": 0.1
    }
  }
}
```

The full schema is `schema/site-focus-profile-v0.3.schema.json`.

## What the engine can observe

`arwp-focus` reuses the v0.2 declared-vs-observed layer and adds explicit v0.3 diagnostics.

### Homepage lane

The `/` route should resolve to the declared `homepage.primaryLane`. A mismatch emits `homepage-primary-lane-mismatch`.

This is route ownership evidence. It does not prove that visitors perceive the intended positioning.

### Homepage signals

For every required signal, the report exposes lexical evidence separately:

- `problem`;
- `audience`;
- `outcome`;
- `evidence`;
- `action`.

Each signal is `observed`, `partial` or `missing` based on transparent token overlap with the sampled homepage. The result is deliberately not averaged into a score. Human review remains necessary because wording overlap is not comprehension or persuasion evidence.

### Problem-lane coverage

Every declared problem lane is checked against route rules and the sampled pages. A lane without any route rule emits `problem-lane-without-route-contract`.

This catches a common architecture smell: a product says it solves a problem, but no surface actually owns the job.

### Navigation budget

The observed primary navigation count is compared with `experience.navigation.maxPrimaryItems`. Exceeding the owner budget emits `primary-navigation-over-budget` and a proposal-only handoff candidate.

A canonical-root brand identity link is not counted as an extra primary navigation destination unless its visible label is explicitly navigational, such as `Home`, `Start`, or `Overview`. This keeps the navigation budget about user choices rather than double-counting the site identity.

The budget is a deliberate product constraint, not a search-engine requirement. A site can choose another value if its audience and task justify it.

### Visual principles

The report preserves declared visual principles with assessment state:

`owner-declared-not-static-quality-scored`

Site Focus does not try to infer whether a design is beautiful, distinctive or accessible from a few strings. Those principles are meant for design implementation and visual QA.

### Performance budget

The report preserves the declared Core Web Vitals budget with assessment state:

`field-data-required`

The static analyzer does not invent LCP, INP or CLS. Real field or explicitly scoped performance evidence must be attached by another measurement step.

## Default experience direction

For a focused specialist site, Cite Goose currently recommends this as a starting design constraint, not a platform mandate:

- one primary problem territory;
- one primary homepage lane plus up to two supporting lanes;
- a small top-level navigation, usually no more than five destinations;
- one dominant next action per primary page;
- a visually recognizable system with high contrast, clear typography and a few meaningful visual fields rather than many dashboard-like widgets;
- technical depth progressively disclosed below a simple first screen;
- motion only when it explains state, causality or progression;
- real field performance checked against the declared budget.

## Evidence basis

The contract intentionally separates upstream guidance from Cite Goose heuristics.

### Google: intended audience and primary site focus

Primary source: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>

Google's people-first guidance asks publishers to consider whether content has an existing or intended audience and whether the site has a primary purpose or focus. Cite Goose uses that as support for making audience and site focus explicit. It does **not** claim that the v0.3 schema or lane count is a Google ranking factor.

### W3C: consistent navigation

Primary source: <https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation>

WCAG 2.2 Success Criterion 3.2.3 requires repeated navigation mechanisms to occur in the same relative order unless the user initiates a change. v0.3 records a consistency requirement but does not claim homepage-only observation proves WCAG conformance.

### web.dev: Core Web Vitals thresholds

Primary source: <https://web.dev/articles/vitals>

The default v0.3 maximums correspond to current “good” Core Web Vitals thresholds at the 75th percentile:

- LCP: 2.5 seconds or less;
- INP: 200 milliseconds or less;
- CLS: 0.1 or less.

They remain performance evidence, not a Site Focus score and not proof of search outcome impact.

## Safe transformation boundary

v0.3 can add proposal-only candidates such as:

- `reduce-or-restructure-primary-navigation`;
- `align-homepage-primary-problem-lane`;
- `clarify-homepage-problem-contract`;
- `map-problem-lane-to-route-or-remove-lane`.

They remain:

```json
{
  "mode": "proposal-only",
  "executable": false,
  "acceptedDecisionRequiredBeforeTransformation": true,
  "destructiveOperationsAllowed": false
}
```

Editorial truth, visual design, redirects, URL history and production mutation still require an explicit reviewed decision.

## Deployment proof

A push-triggered live crawl is not automatically proof of the new release: the crawl can finish while deployment is still publishing the previous public bytes.

For deployment-linked evidence, split the workflow into source validation and a second production crawl triggered only after a successful deployment of the exact commit SHA. The required proof chain and GitHub Actions pattern are defined in [`SITE-FOCUS-DEPLOYMENT-PROOF.md`](SITE-FOCUS-DEPLOYMENT-PROOF.md).

## Remediation receipts

When a reviewed Site Focus finding leads to a direct repository patch, use a **Site Focus Remediation Receipt v0.1** to preserve the finding, exact commits and paths, source check, successful deploy, post-deploy artifact digest, before/after diagnostics and explicit known unknowns.

This receipt does not fabricate SignalBraid Transformation Bundle/BraidGraph lineage. The contract is documented in [`SITE-FOCUS-REMEDIATION-RECEIPTS.md`](SITE-FOCUS-REMEDIATION-RECEIPTS.md) and validated by `schema/site-focus-remediation-receipt-v0.1.schema.json`.

## Run

```bash
node bin/arwp-focus.mjs https://example.com \
  --focus-profile=.arwp/site-focus.json \
  --max-pages=30 \
  --json
```

Repository mode discovers `.arwp/site-focus.json` automatically:

```bash
node bin/arwp-focus.mjs https://example.com/ --repo-root=. --json
```

## Migration from v0.2

Keep the v0.2 thesis, scope, navigation and route rules. Then:

1. enrich each `problemLane` with `audience`, `problem`, `desiredOutcome` and `primaryAction`;
2. add `homepage.primaryLane`, supporting lanes and required signals;
3. add visual principles;
4. declare a navigation budget;
5. declare the performance budget;
6. set `version` to `0.3` and use `schema/site-focus-profile-v0.3.schema.json`.

The v0.2 engine behavior remains the base layer underneath v0.3, so existing route-role, locale-equivalence and proposal-only safeguards are preserved.