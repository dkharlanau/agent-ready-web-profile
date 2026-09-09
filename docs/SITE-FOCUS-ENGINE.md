# Goose Site Focus Engine

The Site Focus Engine turns the `arwp-site-focus` product/design gate into an executable, reviewable system. It is deliberately **not** a ranking score, readiness score or automated content-pruning system.

Version 0.2 adds an owner-declared Site Focus profile so Goose can compare **what the site is meant to be** with **what the sampled site currently exposes**.

## The operating model

```text
DECLARE
  ↓
OBSERVE
  ↓
COMPARE
  ↓
MAP PAGE ROLES
  ↓
REVIEW DRIFT
  ↓
ACCEPT A DECISION
  ↓
PROPOSAL-ONLY TRANSFORMATION HANDOFF
```

The engine keeps two kinds of truth separate:

- **declared intent** — product boundary supplied by the site owner;
- **observed evidence** — title/H1/description, links, route families, proof/action signals and sampled graph structure.

Declared intent does not prove that the implementation is good. Observed lexical difference does not prove that the product strategy is wrong.

## Why v0.2 exists

The first dogfood cycle exposed an important failure mode in v0.1: route families are not problem territories.

A focused site can legitimately have many content families. A studio or portfolio can legitimately have hundreds of routes. Technical/reference and proof pages may also use vocabulary very different from the homepage without being out of scope.

Therefore v0.2 does not treat route count as product breadth. It asks whether routes have a declared role and whether the observed implementation drifts from the declared boundary.

## Site Focus profile

Put the owner contract at:

```text
.arwp/site-focus.json
```

Repository mode auto-discovers that path. A root-level `site-focus.json` is the fallback. Live mode can use an explicit local profile:

```bash
arwp-focus https://example.com --focus-profile=.arwp/site-focus.json
```

The profile schema is `schema/site-focus-profile.schema.json`.

Core fields:

```json
{
  "version": "0.2",
  "canonicalUrl": "https://example.com/",
  "thesis": {
    "primaryProblem": "...",
    "primaryAudience": "...",
    "usefulOutcome": "...",
    "distinctEvidence": "...",
    "primaryAction": "..."
  },
  "scope": {
    "in": ["..."],
    "adjacent": ["..."],
    "out": ["..."]
  },
  "problemLanes": [
    { "id": "lane", "label": "Lane", "job": "..." }
  ],
  "primaryNavigation": ["/one/", "/two/"],
  "routeRules": []
}
```

The profile is product intent, not Search configuration. Its numeric architecture limits remain Goose house heuristics rather than platform requirements.

## Page roles

v0.2 supports explicit route roles:

- `problem-commercial` — solves the primary problem or carries the commercial/product continuation;
- `proof-portfolio` — cases, research, experiments, datasets or projects that reduce uncertainty;
- `trust-utility` — about, policy, evidence, methodology, contact or similar trust/support surfaces;
- `technical-reference` — APIs, schemas, protocol docs, implementation details and other technical depth;
- `localization-equivalent` — an explicitly managed localized representation when needed by a route rule.

Each route rule also has `IN`, `ADJACENT` or `OUT` scope.

A declared supporting role can legitimately have low homepage lexical similarity. That is no longer enough for automatic `DEFER`.

## Locale equivalence

For multilingual sites, declare locale prefixes:

```json
{
  "locales": {
    "default": "en",
    "prefixes": {
      "ru": "/ru",
      "de": "/de"
    }
  }
}
```

Pages with the same normalized route below different locale prefixes are treated as locale-equivalent for duplicate-intent review. The engine suppresses that pair from `MERGE` noise.

This does **not** prove that canonical/hreflang implementation is correct. Search technical validation remains separate.

## Declared ↔ observed drift

v0.2 records independent drift evidence instead of a composite score.

### Thesis wording

The engine compares meaningful tokens from the declared problem/audience/outcome/evidence/action with observed homepage title/H1/description tokens.

It reports:

- overlap tokens;
- missing declared tokens;
- additional observed tokens;
- transparent token coverage;
- `aligned`, `partial-review` or `drift-review` status.

Token coverage is a wording diagnostic, **not a focus score** and not proof of user comprehension.

### Navigation contract

The report compares declared primary navigation with sampled homepage navigation:

- matches;
- declared destinations not observed;
- observed destinations not declared.

This makes a six-item menu on a five-destination declared architecture visible as drift without pretending that six links are universally bad.

### Route-role coverage

Every sampled page receives the most-specific matching route rule. Unclassified routes are surfaced for review rather than silently being interpreted as another product territory.

## Run it

```bash
arwp-focus https://example.com
arwp-focus https://example.com --focus-profile=.arwp/site-focus.json --max-pages=30 --json
arwp-focus https://example.com/project/ --repo-root=. --output=site-focus-report.json
```

### Live mode

Without `--repo-root`, the engine uses bounded public discovery:

1. fetch the supplied HTTPS start page;
2. inspect same-scope homepage links;
3. inspect a same-scope `sitemap.xml` when available;
4. fetch at most `--max-pages` HTML pages;
5. retain candidate discovery sources in the report.

A bounded sample is not a complete inventory unless discovery evidence establishes coverage.

### Repository mode

With `--repo-root`, v0.1 observation logic looks for generated/static HTML under the first available conventional public root:

`docs/` → `public/` → `dist/` → `build/` → `_site/` → repository root fallback.

v0.2 then applies the declared-intent layer. Repository mode can map observed contracts back to files when static HTML exists.

Framework source routes that have not been rendered to HTML are not equivalent to observed public pages; use live mode or a generated production output for stronger coverage.

## Page Contract Map

Every sampled page keeps the v0.1 evidence and receives v0.2 intent fields:

- URL and local file when resolvable;
- title, H1 and observed page-job signal;
- proof and useful-action candidates;
- sampled inbound-link count;
- route family;
- locale and locale-equivalent key;
- declared role, scope and problem lane;
- `KEEP / NARROW / MERGE / DEFER` decision;
- explicit reasons.

## Decisions and safety

`KEEP` means no current bounded focus conflict requires action.

`NARROW` means the page contract is incomplete or unclear.

`MERGE` means non-locale-equivalent sampled intent overlap deserves consolidation review.

`DEFER` means scope/placement deserves review. A declared `OUT` rule can make that conclusion stronger, but it still does not mean delete.

`REMOVE` is never emitted automatically.

`SPLIT` is never emitted automatically.

Both require product/editorial review, traffic/history evidence, redirect implications and the real business boundary.

## Transformation handoff

v0.2 closes the conceptual gap between Focus and Target Transformation without allowing focus heuristics to mutate a repository.

The report emits a `transformationHandoff`:

```text
mode: proposal-only
executable: false
acceptedDecisionRequiredBeforeTransformation: true
destructiveOperationsAllowed: false
```

Candidate actions currently include:

- clarify a `NARROW` page contract;
- review consolidation/redirect history for `MERGE`;
- review placement for owner-declared `OUT` pages.

A later Target Transformation step may compile an **accepted** decision into exact repository operations. Focus itself cannot do that.

## Dogfood state

Goose now carries `.arwp/site-focus.json` and validates it against generated `docs/` output in the dedicated `Site Focus v0.2` workflow.

The same declaration contract has been added to two intentionally different dogfood sites:

- Ptichi — one speech-practice territory with multilingual entity families;
- MetalHatsCats — a broader public-systems studio where projects/research/experiments are supporting proof rather than automatically separate problem territories.

The contrast is intentional. Thresholds should improve because the engine survives different legitimate site shapes, not because it maximizes warnings.

## Relationship to the rest of Goose

```text
FOCUS
  ↓
MAP
  ↓
PLAN
  ↓
PATCH
  ↓
VERIFY
  ↓
MEASURE
```

Focus should run before broad content/discoverability expansion when the thesis, audience, scope or information architecture is unclear. It does not replace technical Search eligibility, source review, provenance, owner-side measurement or the Growth Loop.
