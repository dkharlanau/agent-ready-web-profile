# Goose Winner Observatory

The Winner Observatory turns repeated Search/AI result observations into dated evidence that Goose can compare without pretending to know a provider's hidden ranking weights.

It answers a narrower, testable question:

> For the same fixed query/prompt cohort, which URLs entered, persisted, dropped, gained/lost citations or moved materially between observations?

It does **not** answer “why Google ranked this page” or “this site used no advertising.”

## Snapshot contract

`schema/winner-observation.schema.json` stores one observation of a fixed cohort.

A snapshot preserves:

- `cohortId` — identity of a frozen query/prompt panel;
- `observedAt` — exact observation time;
- `surface` and `locale` — provider surface scope;
- capture method and optional evidence URI;
- stable query IDs + exact query text;
- URL, optional rank, citation state and explicit brand-mention state;
- paid-acquisition state as `unknown`, `none-observed` or `confirmed-present`;
- anti-causality guardrails.

Changing query text is a cohort change. Create a new `cohortId`; do not silently rewrite the historical panel.

## CLI

Until the package alias is promoted, run the repository CLI directly:

```bash
node bin/arwp-winners.mjs validate before.json
node bin/arwp-winners.mjs summarize before.json
node bin/arwp-winners.mjs diff before.json after.json --output=diff.json
```

`diff` rejects different cohort IDs, surfaces, locales, query IDs/text or reversed observation dates.

## Metrics

The first engine exposes metrics that survive provider/UI churn better than a single screenshot:

### Result persistence

`persisted query/URL pairs / query/URL pairs observed in the before snapshot`

Also retains explicit entrants and drops.

### Top-10 persistence

For ranked surfaces, the same calculation limited to pairs with rank `<= 10`.

### Citation persistence

`previously cited query/URL pairs still cited / previously cited query/URL pairs`

A newly cited URL and a persistent citation are deliberately different observations.

### Rank movement

For pairs ranked in both snapshots:

`before rank - after rank`

Positive means numerical rank improved; negative means it fell. This is an observation, not causal attribution.

## Why persistence matters

AI citation/source sets can change rapidly. A one-off citation is therefore weak evidence for a durable discovery outcome. Goose keeps one-off observations, but decisions should prefer repeated observations across declared windows.

## Winner discovery protocol

A useful manual or automated run follows this order:

1. Freeze query/prompt panel before inspecting desired winners.
2. Capture snapshot using a declared method.
3. Repeat without changing query IDs/text.
4. Diff snapshots.
5. Classify entrants, drops and persistent URLs.
6. Inspect entrant pages against appropriate controls.
7. Record possible explanatory differences as hypotheses, not factors.
8. Test applicable hypotheses on an owned site with unchanged controls where feasible.
9. Feed reviewed positive, neutral and negative outcomes into the existing Growth/Trend lifecycle.

## Controls

Do not compare a new entrant only with a weak page. Prefer several views:

- persistent incumbent for the same intent;
- ranking but uncited URL;
- cited URL with weaker classic rank where observable;
- comparable target-site page;
- same URL before/after a meaningful revision where available.

## Paid acquisition boundary

Public observation rarely proves a company uses **zero** paid acquisition.

`none-observed` means exactly that no paid signal was observed under the documented check. It remains a warning in validation output. `unknown` is the safe default.

## Ptichi controlled cohort

The first owned-site proof design is stored in:

`knowledge/experiments/2026-09-09-ptichi-controlled-cohort-plan.json`

The plan deliberately starts with 20–50 treatment pages and comparable controls rather than thousands of generated pages. It tracks Search exposure, query breadth, persistence, citations, referrals and product actions separately.

The cohort must be frozen before post-change outcomes are inspected.

## Relationship to Goose evidence

```text
external provider / study
          ↓
external evidence record
          ↓
Winner Observatory snapshot(s)
          ↓
entrant / persistence observation
          ↓
reviewed hypothesis
          ↓
owned-site controlled experiment
          ↓
Growth Experiment / visibility evidence
          ↓
keep / revise / revert / retire / continue
```

No edge in this chain silently upgrades correlation into causality.

## Next engine step

After real snapshots accumulate, the next useful layer is a Recommendation Review/Decay queue that can combine:

- provider contradiction;
- source age/review-due state;
- independent study disagreement;
- winner-prevalence/persistence observations;
- owned-site positive/neutral/negative experiments.

That queue should propose `fresh`, `challenged`, `review-due`, `contradicted` or `retire-candidate` states while requiring explicit review before registry mutation.
