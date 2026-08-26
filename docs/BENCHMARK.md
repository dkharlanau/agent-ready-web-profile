# ARWP Resolver Benchmark

ARWP should justify its existence through measurable interoperability utility, not through a readiness score or unverified marketing claims.

The benchmark program has three layers.

## Layer 1 — deterministic regression benchmark

Run:

```bash
npm run benchmark:resolver
```

or:

```bash
node benchmarks/resolver-regression.mjs --json
```

This local benchmark uses synthetic fixtures to prevent regressions in one narrow question:

> Given different discovery surfaces, can a strategy select the interface that the fixture defines as correct for the requested intent?

The fixtures cover publisher-maintained retrieval, MCP discovery, RFC 9727 API discovery, A2A discovery and Agent Skills discovery.

Strategies are compared separately:

- HTML-only
- `llms.txt`-only
- ARWP-profile-only
- `agents.json`-only
- upstream-native discovery only
- resolver union

### What this benchmark proves

It can prove that resolver logic combines surfaces and preserves intent-selection coverage in deterministic test cases.

### What it does not prove

It does **not** prove:

- real-world latency savings;
- token savings;
- search ranking benefit;
- broader agent compatibility;
- adoption;
- better answer quality;
- economic value.

The script prints this limitation on every run.

## Layer 2 — external utility benchmark

The next evidence milestone is a public corpus of independent sites.

Target initial sample:

```text
20–50 public sites
```

Prefer documentation, research, public knowledge, technical portals and open-data sites. Do not fill the corpus with only ARWP-owned reference sites.

For each site, evaluate concrete intents:

1. find canonical readable content;
2. find publisher-maintained search/retrieval if available;
3. find a structured API description if available;
4. find provenance/license/trust metadata;
5. find a callable remote agent/tool interface if available.

Compare discovery strategies:

```text
A — ordinary web / HTML discovery
B — llms.txt-aware
C — agents.txt / agents.json-aware
D — protocol-native discovery only
E — ARWP profile only
F — ARWP Resolver union
```

Run the reviewed external corpus with:

```bash
npm run benchmark:external -- --output=benchmark-results/external.json
```

Only fixtures marked `ownership=independent` count toward the primary aggregate unless an engineering-only run explicitly opts into the other fixtures.

### Reviewed evidence liveness

The reviewed corpus now has a separate transport-level liveness check:

```bash
npm run benchmark:evidence -- --output=benchmark-results/evidence.json
```

It probes, for independent fixtures only:

- the canonical site URL;
- public `evidence[]` URLs;
- URL-bearing accepted interfaces across benchmark intents.

Targets are deduplicated, fetched with bounded concurrency, restricted to validated public HTTPS destinations, and revalidated on every redirect. The probe cancels response bodies after receiving headers/status, so evidence monitoring does not require downloading large pages or API documents. It reports HTTP reachability, probe errors, final redirect targets, content type and review-date age.

This is deliberately not a semantic reviewer. A `200` response does not prove that the page still supports the fixture's claim, and a redirect does not automatically authorize changing accepted ground truth. `reviewedAt` remains human evidence metadata. Use the liveness artifact to identify what needs re-review, then change a fixture only after the public evidence has been inspected independently of Resolver output.

`--strict` is available for controlled runs, but the public external workflow records liveness observationally rather than failing the whole benchmark because a third-party site has a transient outage.

## Layer 3 — resolver-backed federation smoke corpus

Resolver-backed federation has a separate live corpus because a discovery-selection score does not prove that a resolved interface can actually be executed and parsed.

Run:

```bash
npm run benchmark:federation-external -- --output=benchmark-results/federation.json
```

`benchmarks/federation-corpus.json` contains only reviewed independent sites with publisher/spec evidence for a public JSON Feed. The runner resolves each canonical site first and then executes only the static surface selected by `searchResolvedFederated`.

This layer records:

- whether the reviewed interface was actually selected and fetched;
- which discovery source/authority produced it;
- records parsed;
- query hits;
- skipped sites and retrieval failures.

A query hit is only a smoke signal that records reached the generic search path. It is not a ranking or answer-quality metric.

The first live observation on 2026-08-26 executed the reviewed interface for 1 of 4 sites. `ai.rud.is` exposed `/feed.json`; JSONFeed.org, Manton Reece and Daring Fireball were retained as misses rather than redefining ground truth. After ordinary-web JSON Feed fallback discovery was tightened to accept `application/json` only with explicit feed evidence, the unchanged four-site corpus executed 4 of 4 reviewed expected interfaces. Durable evidence is recorded in `benchmarks/results/2026-08-26-federation-v0.2.{json,md}`. This is execution/discovery evidence, not adoption, ranking quality or universal federation compatibility.

## Metrics

Record observable metrics, not a composite score:

- HTTP requests until a usable interface is identified;
- bytes downloaded during discovery;
- wall-clock discovery time;
- correct interface selected / available interface missed;
- false-positive capability declarations;
- conflicting declarations detected;
- canonical identity preserved;
- provenance/trust surface retained;
- fallback required;
- protocol/runtime verification still required.

### Failure-inclusive correctness

The primary external correctness denominator is all reviewed independent sites multiplied by all scored intents. A site-level Resolver failure therefore counts as incorrect for every intent on that site. It is not removed from the denominator.

This rule prevents survivorship bias: a strategy cannot improve its reported accuracy by failing before it produces a selection on a difficult site.

The external report also exposes:

- `resolutionCoverage` — independently reviewed sites that completed `resolveSite` divided by all independently reviewed sites;
- `resolvedOnlyAggregate` — a diagnostic selection-quality view restricted to sites that resolved successfully.

`resolvedOnlyAggregate` must not replace the primary aggregate in headline comparisons. It is useful for separating selection mistakes from whole-site resolution failures.

Only the Resolver-union observation contains measured Resolver request/byte counters. Sub-strategy rows are selection-only projections over the same observation and must not be described as independent network-performance measurements.

## Ground truth

Ground truth cannot be “whatever ARWP says.”

For each benchmark site, record a reviewed fixture describing which public interfaces actually exist and why each one counts. Evidence should link to the public resource or protocol-native runtime check.

A site may legitimately have multiple correct interfaces. Benchmark scoring should therefore support sets of accepted results rather than forcing one URL when several are equivalent.

Review dates are evidence metadata, not proof by themselves. When a live site changes, re-review its accepted interfaces rather than changing the fixture merely to match Resolver output.

## Publication rules

When external benchmark results are published:

1. publish the corpus and measurement script;
2. publish raw per-site results, not only aggregates;
3. label community/experimental protocols by their real status;
4. do not convert the metrics into a universal readiness score;
5. report cases where Resolver performs worse;
6. separate discovery success from runtime protocol conformance;
7. keep owned/reference sites identifiable so they cannot be mistaken for independent evidence;
8. keep failed sites in the primary denominator and report resolution coverage separately;
9. sanitize transient signed URLs, tokens, cookies or other request-specific material before committing a durable result artifact;
10. keep transport-level evidence liveness separate from semantic ground-truth re-review.

## Decision gate

The external benchmark should answer whether the resolver materially improves at least one of these outcomes:

- correct-interface discovery;
- requests/bytes required to reach the correct interface;
- preservation of source identity/provenance;
- detection of conflicting metadata.

If it does not, the project should reduce scope rather than invent new metadata fields to manufacture an advantage.