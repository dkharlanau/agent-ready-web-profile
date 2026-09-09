# Site Pattern Graph v0.1

The Site Pattern Graph turns Cite Goose's versioned practice and anti-pattern catalogs into **site-specific observed knowledge**.

The existing catalogs answer: **what is the pattern, what problem does it address, what evidence supports it, and what can be misclassified?**

The Site Pattern Graph answers a different question: **where does this pattern apply on this site, what was actually observed, what evidence supports that observation, what was changed, and what happened later?**

It is deliberately not an SEO score, AI-readiness score, ranking model, penalty detector or automated content-pruning system.

## Why this layer exists

Cite Goose already has:

- a versioned discoverability corpus with positive practices;
- a separate anti-pattern catalog with false-positive boundaries;
- Site Focus for problem territory, route roles and experience intent;
- Site Focus Remediation Receipts for deployment-linked corrections;
- Growth and visibility evidence for later outcomes.

Without an applied binding layer, a reviewer still has to mentally connect those objects. A catalog pattern can be good in general and irrelevant to a specific route. An anti-pattern can resemble a valid implementation. A validator pass can be mistaken for growth. A portfolio can repeat a recommendation without learning where it was actually useful.

`Site Pattern Map v0.1` provides the missing graph.

## Four objects, four meanings

### 1. Pattern passport

The canonical pattern remains in `knowledge/discoverability-corpus.json` or `knowledge/research/anti-patterns.json`.

A site map never copies the pattern text. It pins the pattern ID and version. This prevents site-specific observations from silently redefining the standard.

### 2. Pattern instance

A pattern instance binds a passport to a target:

- whole site;
- exact route;
- route prefix;
- Site Focus route role;
- template;
- page type.

Each instance records:

- applicability: `applicable`, `not-applicable`, `unknown`;
- verdict: `present`, `absent`, `unknown`, `not-applicable`;
- basis: `manual-reviewed`, `deterministic`, `provider-observation`, `heuristic-candidate`;
- concrete evidence;
- false-positive review state;
- remediation state and optional receipt;
- later observational outcomes.

### 3. Pattern relation

Instances can be connected with typed edges:

- `reinforces`;
- `prerequisite-for`;
- `conflicts-with`;
- `replaces`;
- `co-occurs-with`.

The graph is descriptive. A relation does not claim a search-engine weight.

### 4. Outcome observation

A pattern instance can later hold a before/after observation, but v0.1 requires `causalClaim=false`.

That constraint is intentional. A release preceding a traffic or citation change is not enough to prove causation. Stronger causal methods can be layered later without rewriting the historical observation.

## Evidence rules

### Heuristics nominate; they do not convict

A `heuristic-candidate` may only have `verdict: unknown`.

For example, finding the words `llms.txt`, `best`, `review`, or `updated` is not enough to establish an anti-pattern. The detector can create a review candidate with the relevant target and evidence locator. A later review may change the basis and verdict.

### Manual anti-pattern boundaries stay manual

The current anti-pattern catalog marks its synthetic examples `manual-required`. If such an anti-pattern is recorded as present or absent, the Site Pattern Graph requires `basis: manual-reviewed`.

A present anti-pattern also requires `falsePositiveBoundaryReviewed: true`.

This prevents a rule engine from turning a textual resemblance into a policy accusation or penalty prediction.

### Absence is bounded by coverage

`absent` means absent on the declared target under the recorded evidence. It does not mean absent across the whole website unless coverage is explicitly `complete-known-set`.

Maps therefore carry a coverage object and a mandatory list of known unknowns.

## The operational chain

```text
Site Focus
  what problem does this site own?
        |
        v
Pattern passports
  which reviewed practices / anti-patterns may matter?
        |
        v
Site Pattern Map
  where are they applicable and what is actually observed?
        |
        +--> unknown -> review
        +--> positive absent -> consider practice
        +--> anti-pattern present -> remediation
                                |
                                v
                  Site Focus Remediation Receipt
                  was the correction deployed and rechecked?
                                |
                                v
                       Outcome observations
                  did provider/user/business signals change?
                                |
                                v
                       Pattern Learning Loop
              what repeats across independent sites?
```

Implementation proof and outcome evidence remain separate.

## CLI

Validate the repository dogfood map:

```bash
node bin/arwp-patterns.mjs check .arwp/site-pattern-map.json
```

Show bounded summary:

```bash
node bin/arwp-patterns.mjs summary .arwp/site-pattern-map.json --json
```

Generate review/remediation candidates:

```bash
node bin/arwp-patterns.mjs actions .arwp/site-pattern-map.json --json
```

Aggregate several site maps without inventing causal conclusions:

```bash
node bin/arwp-patterns.mjs portfolio \
  brali.patterns.json \
  ptichi.patterns.json \
  metalheadcats.patterns.json \
  --json
```

The portfolio output reports prevalence by pattern and site. It explicitly does **not** infer that a common pattern caused rankings, citations, traffic or conversion.

## Pattern Learning Loop

A portfolio should improve the standard, not merely produce a dashboard. The `learning` command looks for repeated evidence-system signals across at least two sites by default:

```bash
node bin/arwp-patterns.mjs learning \
  brali.patterns.json \
  ptichi.patterns.json \
  metalheadcats.patterns.json \
  --min-repeat=2 \
  --json
```

It can emit five kinds of review signal:

- `evidence-gap` — a pattern remains unknown repeatedly; improve the detector, review procedure or owner-data boundary;
- `repeated-practice-gap` — an applicable positive practice is repeatedly absent; inspect site-archetype fit before considering a reusable adoption pack;
- `repeated-anti-pattern` — the same anti-pattern is manually confirmed on multiple sites; inspect the shared implementation cause and possible remediation pack;
- `measurement-debt` — multiple remediations are deployment-verified but no later outcome observation is attached;
- `applicability-filter-candidate` — a pattern is repeatedly not applicable; use that evidence to improve early filtering rather than showing every rule to every site;
- `version-fragmentation` — active site maps span multiple pattern versions; preserve history but review whether current deployments need migration before comparison.

Every learning signal contains `causalClaim: false`. Repetition across sites is useful product evidence, but it does not reveal a search-engine ranking factor or prove that a remediation caused an outcome.

`minRepeat` cannot be lower than 2. One site is dogfood; it is not a portfolio pattern.

## Recommended site workflow

1. Define or confirm `.arwp/site-focus.json`.
2. Select a small set of applicable positive practices and anti-patterns from the versioned catalogs.
3. Bind them to the exact route, route role, template or page type.
4. Leave uncertain candidates `unknown`.
5. Attach inspectable evidence.
6. Review false-positive boundaries before confirming anti-patterns.
7. Remediate one bounded problem.
8. Link a deployment receipt when the correction is verified.
9. Add provider/user/business observations later, preserving non-causal wording unless a stronger design exists.
10. Aggregate maps across sites to identify repeated opportunities, repeated risks and gaps in the catalog itself.
11. Feed repeated evidence gaps back into detectors, applicability profiles, pattern boundaries and remediation packs through reviewed changes to the canonical catalog.

## What portfolio learning can legitimately tell us

With several maps, Cite Goose can answer useful questions such as:

- Which positive practices are repeatedly applicable but absent on documentation sites?
- Which anti-patterns repeatedly appear on generated landing-page fleets?
- Which rules remain unknown because the required owner data is unavailable?
- Which remediation types recur across GitHub Pages sites?
- Which catalog entries are almost always `not-applicable` for a given site archetype and should be filtered earlier?
- Which pattern pairs commonly co-occur and deserve an explicit relation in the catalog?
- Which patterns have many verified deployments but no outcome observations yet?

Those are empirical product-learning questions. They are more useful than counting how many checkboxes a site passes.

## Next compatible layers

The v0.1 contract intentionally leaves room for:

- **Applicability profiles** by site archetype and Site Focus route role;
- **detector registry** where deterministic checks and heuristic candidates declare their limits;
- **Pattern Outcome Ledger** that joins maps, remediation receipts and provider observations across releases;
- **counterfactual experiments** for patterns where causal testing is feasible;
- **portfolio heatmaps** that show known/unknown/present/absent states without collapsing them into one score;
- **pattern evolution feedback** when repeated site evidence shows that a passport needs a narrower boundary, replacement or retirement.

The core rule remains: the catalog describes the practice; the site map describes the observation; the receipt proves the deployed change; later measurements describe outcomes; repeated observations may improve the standard only through an explicit reviewed learning step.

## Files

- Schema: `schema/site-pattern-map-v0.1.schema.json`
- Runtime: `lib/site-pattern-graph.mjs`
- CLI: `bin/arwp-patterns.mjs`
- Dogfood map: `.arwp/site-pattern-map.json`
- Example: `docs/examples/site-pattern-map-v0.1.json`
- CI: `.github/workflows/site-pattern-graph.yml`
