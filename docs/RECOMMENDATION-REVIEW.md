# Goose Recommendation Review / Decay Queue

Goose should be able to remove or downgrade weak advice as aggressively as it adds new advice.

The Recommendation Review queue is the first executable part of that lifecycle. It is deliberately **read-only**: evidence can create attention, but it cannot silently rewrite `registry/search-agent-recommendations.json`.

## States

Each current recommendation is classified as one of:

- `fresh` — no review trigger is currently present;
- `review-due` — source age or a reviewed source-change event requires re-reading;
- `challenged` — counter-evidence exists, such as an independent challenge, winner counterexample or negative owned-site experiment;
- `contradicted` — reviewed provider evidence conflicts with the current rule;
- `retire-candidate` — upstream is already retired/deprecated or a human has explicitly proposed retirement.

These are workflow states, not truth scores.

## Evidence event contract

`schema/recommendation-review-events.schema.json` accepts reviewed events tied to a known recommendation rule:

- `source-changed`;
- `provider-contradiction`;
- `independent-challenge`;
- `winner-counterexample`;
- `experiment-positive`;
- `experiment-neutral`;
- `experiment-negative`;
- `manual-retire-proposal`.

Every event requires a dated `evidenceUri`.

A positive experiment is retained but does not automatically upgrade a rule. A neutral experiment does not disappear. A negative experiment can challenge a rule without proving the opposite universally.

## CLI

```bash
node bin/arwp-recommendation-review.mjs validate events.json
node bin/arwp-recommendation-review.mjs queue events.json \
  --as-of=2026-09-09T00:00:00Z \
  --stale-after=90 \
  --output=review-queue.json
```

The generated report contains every rule plus a compact `attention` queue.

## Source-age trigger

Source review age is a maintenance trigger, not evidence that guidance became wrong.

By default the CLI uses a 90-day review threshold. The threshold is operational policy and can be changed per run. Provider guidance that is known to change quickly can be reviewed more often.

## Severity order

When multiple events exist, Goose keeps the strongest attention state:

```text
fresh
  ↓
review-due
  ↓
challenged
  ↓
contradicted
  ↓
retire-candidate
```

This ordering controls queue attention only. It does not claim that a `challenged` rule is false or a `fresh` rule is effective.

## Relationship to Winner Observatory

Winner Observatory can produce observations worth reviewing:

```text
new entrant / persistent winner / repeated counterexample
                    ↓
       reviewer classifies evidence
                    ↓
         recommendation event
                    ↓
       Recommendation Review queue
                    ↓
      re-read / test / revise / retire
```

No raw winner snapshot automatically becomes a recommendation event. Human or explicitly reviewed agent classification stays between observation and registry lifecycle.

## Relationship to owned-site experiments

Growth Experiments remain the stronger local evidence path because they can preserve intervention, baseline, owner metrics, controls/confounders and review decisions.

Repeated negative or neutral local evidence should be allowed to reduce local priority even when external observational studies are positive.

## Mutation boundary

Every queue row carries `mutationAllowed:false`, and the report carries `registryMutationAllowed:false`.

A real lifecycle change still requires an explicit repository edit/review with source evidence. This prevents a transient SERP change, one expert post or one site experiment from silently rewriting Goose guidance.
