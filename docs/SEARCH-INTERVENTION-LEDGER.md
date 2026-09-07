# Search Intervention Ledger

Status: experimental public contract · reviewed 2026-09-07

The Search Intervention Ledger is the bridge between the Search Maturity Benchmark and longitudinal outcome learning.

It records **one bounded intervention**:

```text
site class + intent
→ timestamped baseline
→ exact changed URLs + Search Maturity dimensions
→ implementation / build / deployment proof
→ separate outcome windows
→ crawl/index | Search | AI retrieval | citation | absorption | referral | useful action | product continuation | conversion
→ controls + confounders
→ support | neutral | negative | inconclusive
```

It does not turn an implementation diff into a ranking claim.

## Why this is separate from Growth Experiment

ARWP already has a `Growth Experiment` ledger. That ledger is the general ARWP experiment record: it links Growth actions, before/after Growth snapshots and optional owner-side visibility evidence.

Search Intervention is narrower and can link to a Growth Experiment through `linkedGrowthExperimentId`. It adds the pieces Search Maturity dogfooding needs:

- intent family and site class;
- exact Search Maturity dimensions changed;
- exact changed canonical URLs;
- disclosure classification;
- controls and confounders;
- separate Search/AI/business outcome channels;
- explicit neutral/negative/inconclusive states.

Do not replace Growth Experiment with this contract. Link them when both apply.

## Outcome channels

The public contract deliberately keeps nine channels separate:

1. `crawl-index`
2. `classic-search-visibility`
3. `ai-retrieval`
4. `ai-citation`
5. `answer-absorption`
6. `referral`
7. `useful-action`
8. `product-continuation`
9. `conversion`

A page can improve in one channel and remain unchanged or become worse in another.

`ai-citation` and `answer-absorption` are intentionally distinct. A source can be selected/cited without materially shaping the answer, and influence should not be inferred from citation alone.

## Intervention state

`intervention.status` progresses only with evidence:

- `planned`
- `source-implemented`
- `build-verified`
- `deployed-verified`

A source commit is not a deployment receipt. A deployment receipt is not a Search outcome.

## Disposition

After follow-up observations, human review may classify the intervention as:

- `support`
- `neutral`
- `negative`
- `inconclusive`

The validator blocks `support`, `neutral` or `negative` when no compatible follow-up observation exists. Medium/high confidence also requires follow-up evidence.

This is still observational evidence unless the experiment design warrants a stronger causal claim. The contract itself never grants that claim.

## Disclosure boundary

Every record carries one disclosure class:

- `public-methodology`
- `public-fixture`
- `commercial-private`
- `confidential-rd`
- `defensive-publication`

Public methodology/fixtures must declare `containsLiveCorpus:false` and `containsLearnedPriors:false`.

Use the public repository for schemas, validators and synthetic/reviewed fixtures. Continuously refreshed query observations, competitor cohorts, large negative-results sets, cross-site outcome history and learned recommendation priors are candidates for private/hosted storage. Potentially novel similarity/attribution/decision mechanisms stay out of public implementation until the IP decision is made.

## From Search Maturity diff to intervention candidate

```bash
node bin/arwp-search-maturity.mjs diff \
  benchmarks/search-maturity/pilot-2026-09-07.json \
  target-search-maturity.json \
  --intent=ai-search-optimization \
  --output=/tmp/diff.json

node bin/arwp-search-intervention.mjs candidates /tmp/diff.json \
  --site=https://example.com/ \
  --site-class=technical-b2b
```

Candidates are `manual-review`. They intentionally have no changed URL until a maintainer decides the cohort gap is applicable and useful for the target.

## Validate a record

```bash
node bin/arwp-search-intervention.mjs check \
  benchmarks/search-intervention/example-public-safe.json
```

The included fixture is synthetic. It exists to prove the contract and CI, not to publish a live corpus.

## Dogfood rule

For real owner sites:

1. keep the detailed live baseline in the private target repository or private evidence store;
2. assign a stable intervention ID;
3. record the exact source commit and changed canonical URLs;
4. do not mark deployment until deployment is independently observed;
5. collect outcome observations at predeclared windows such as 7/14/28 days;
6. preserve unchanged controls where practical;
7. preserve negative and neutral results;
8. only then update a learned prior for comparable site/intent cohorts.

The durable moat is the accumulated relationship between comparable context, intervention and outcome—not the public JSON schema.
