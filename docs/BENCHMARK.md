# ARWP Resolver Benchmark

ARWP should justify its existence through measurable interoperability utility, not through a readiness score or unverified marketing claims.

The benchmark program has two layers.

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

## Ground truth

Ground truth cannot be “whatever ARWP says.”

For each benchmark site, record a reviewed fixture describing which public interfaces actually exist and why each one counts. Evidence should link to the public resource or protocol-native runtime check.

A site may legitimately have multiple correct interfaces. Benchmark scoring should therefore support sets of accepted results rather than forcing one URL when several are equivalent.

## Publication rules

When external benchmark results are published:

1. publish the corpus and measurement script;
2. publish raw per-site results, not only aggregates;
3. label community/experimental protocols by their real status;
4. do not convert the metrics into a universal readiness score;
5. report cases where Resolver performs worse;
6. separate discovery success from runtime protocol conformance;
7. keep owned/reference sites identifiable so they cannot be mistaken for independent evidence.

## Decision gate

The external benchmark should answer whether the resolver materially improves at least one of these outcomes:

- correct-interface discovery;
- requests/bytes required to reach the correct interface;
- preservation of source identity/provenance;
- detection of conflicting metadata.

If it does not, the project should reduce scope rather than invent new metadata fields to manufacture an advantage.
