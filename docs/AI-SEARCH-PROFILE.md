# AI Search & Citation Profile

The ARWP AI Search & Citation Profile is a **non-normative implementation profile** for websites that want to become easier for search systems and AI agents to identify, retrieve, verify and cite.

It is deliberately not an AI-readiness score, ranking promise or replacement for ordinary web quality. The profile is a reusable plan that records which citation-oriented surfaces are active, planned, paused or not applicable.

Canonical schema:

`/schema/ai-search-profile.schema.json`

ARWP dogfoods the profile at:

`/ai/ai-search-profile.json`

## Why this exists

An agent-ready website and a cite-worthy website overlap, but they are not the same thing.

ARWP already resolves machine interfaces. The AI Search Profile adds a second question:

> What should this site publish so an external search or AI system can identify the entity, find original evidence, answer recurring questions from canonical pages, verify claims, reuse clearly licensed assets and cite stable sources?

The model prefers useful primary-source material over decorative AI metadata.

## CLI

Create a starter plan for any site:

```bash
node bin/arwp-ai-search.mjs init https://example.com/ \
  --name="Example" \
  --languages=en,de,ru \
  --output=ai/ai-search-profile.json
```

Validate it:

```bash
node bin/arwp-ai-search.mjs validate ai/ai-search-profile.json
```

Show implementation priorities:

```bash
node bin/arwp-ai-search.mjs plan ai/ai-search-profile.json
```

The generator intentionally marks most proposed surfaces as `planned`. It never claims that a guessed path is already deployed.

## Status model

Every surface or module uses one of four explicit states:

- `planned` — intended implementation, not claimed as live;
- `active` — currently published/operated;
- `paused` — intentionally not being advanced now;
- `not-applicable` — evaluated and intentionally excluded.

This distinction lets the same profile serve as a backlog, deployment contract and durable record without turning plans into false capability declarations.

## Core surfaces

The profile can track stable canonical surfaces such as:

- entity/home page;
- ARWP `ai/site-profile.json`;
- canonical `llms.txt`;
- product history;
- locale manifest;
- sitemap and crawler policy;
- knowledge graph;
- claims index;
- press/media kit;
- machine-readable reuse-rights manifest.

These are URLs, not proof of ranking or inclusion in an AI product.

## Citation modules

The reusable module set is intentionally opinionated.

### P0 — create something worth citing

**Answer pages**

Create direct, stable pages for recurring questions. Lead with a concise answer, then evidence, boundaries and links to primary sources.

**Original research**

Publish measurements, experiments, datasets and negative results that cannot be reproduced by generic summary content. For ARWP this includes resolver benchmarks and the planned State of the Agentic Web series.

**Protocol observatory**

Maintain dated facts about relevant protocols/discovery mechanisms, their purpose, maturity, discovery path, current version/support status and evidence source.

### P1 — make facts easy to verify, retrieve and reuse

**Comparison pages** — e.g. MCP vs A2A, WebMCP vs MCP, llms.txt vs agent manifests.

**Concept definitions** — stable canonical definitions for terminology the project actually uses.

**Claims registry** — stable claim IDs with review state, evidence and machine-readable representation.

**Evidence receipts** — replayable/digestible records of important resolver observations and benchmark claims.

**Crawler matrix** — dated, source-backed crawler/access configuration rather than folklore about AI bots.

**Agent fetch lab** — reproducible experiments about which surfaces agents actually retrieve for real tasks.

**Open reuse assets** — a press/media pack with explicit reuse scope, a standard license, machine-readable rights, canonical facts, boilerplate and attribution instructions. Covered assets should be usable without asking for individual permission. When AI/ML training, embeddings, RAG or dataset inclusion are allowed, say so explicitly in the machine-readable rights manifest rather than expecting an agent to infer it from a prose copyright page.

**Localization** — reviewed language-specific discovery/routing while canonical technical semantics remain stable.

**History** — dated product evolution and maturity for both people and machines.

### P2 — amplify and measure

**Knowledge graph** — connect entities, protocols, concepts, claims and evidence.

**Citation visuals** — charts/diagrams with stable URLs, source notes, alt text and explicit reuse terms.

**External distribution** — distribute substantial primary-source releases while keeping one canonical source URL.

**AI visibility** — measure observable citations, grounding queries, referrals and mentions without collapsing them into a vanity score.

## Open media / AI reuse pattern

A reusable site should make permission easy to understand before a journalist, researcher or machine has to ask.

Recommended pattern:

```text
/media/
├─ index.html          # human-readable permission + asset guide
├─ rights.json         # license, scope, permitted machine uses, attribution
├─ press-facts.json    # canonical facts, versions, source links
├─ boilerplate.txt     # ready-to-use short/standard project description
└─ attribution.txt     # copyable credit line
```

ARWP uses CC BY 4.0 for designated project-authored press/research/media material because it permits redistribution, adaptation and commercial reuse with attribution. Software remains under its software license; third-party logos, screenshots, quotations and other third-party material must stay outside the open-media grant unless they are separately licensed.

For AI use, the reusable rights manifest should explicitly state whether the covered material may be used for:

- search/indexing;
- AI/ML training;
- embeddings;
- retrieval-augmented generation;
- dataset inclusion;
- summarization and translation.

When attribution is technically possible, preserve the canonical source URL in dataset/model cards, provenance metadata, citations, output attribution or another reasonable attribution surface. A machine-readable permission is useful discovery metadata; it does not override third-party rights or the legal text of the chosen license.

## Suggested site structure

A mature implementation may converge on a structure such as:

```text
/
├─ ai/
│  ├─ site-profile.json
│  ├─ ai-search-profile.json
│  └─ locales.json
├─ llms.txt
├─ history.html
├─ history.json
├─ media/
│  ├─ index.html
│  ├─ rights.json
│  ├─ press-facts.json
│  ├─ boilerplate.txt
│  └─ attribution.txt
├─ answers/
├─ research/
│  ├─ state-of-agentic-web/
│  ├─ what-agents-fetch/
│  └─ negative-results/
├─ observatory/
├─ compare/
├─ concepts/
├─ crawler-matrix/
├─ evidence/
│  ├─ claims/
│  └─ receipts/
├─ knowledge/
│  └─ graph.json
└─ visibility/
```

A site should implement only the modules that produce real value. Empty SEO pages are worse than a smaller set of useful primary sources.

## Content pattern for answer-ready pages

Recommended order:

1. direct answer in the first useful paragraph;
2. definition/scope;
3. current dated facts;
4. source/evidence links;
5. comparison or boundary cases;
6. machine-readable companion when useful;
7. last-reviewed date.

Do not pad a page to hit a word count.

## Original-research loop

For research-heavy sites, the strongest reusable loop is:

```text
observe / scan
      ↓
review evidence
      ↓
publish original data + methodology
      ↓
produce answer / comparison / visual surfaces
      ↓
publish open reuse rights + attribution
      ↓
distribute externally with canonical source
      ↓
measure citations / referrals / mentions
      ↓
review what actually earned retrieval or citation
      ↓
next observation
```

This is intentionally different from publishing large volumes of generic SEO articles.

## Vocabulary ownership

The profile can declare canonical terms the site wants to define consistently. A vocabulary item has:

- term;
- concise definition;
- canonical URL;
- status.

For ARWP, candidate concepts include `agentic web resolver`, `resolver regret`, `discovery conflict` and `agent capability graph`.

Creating a term does not make it an industry standard. The purpose is to make the project's own language stable, attributable and linkable.

## Measurement

Measurements are platform-dependent and change over time, so the schema intentionally uses generic named signals rather than hard-coding one vendor API.

Useful signals can include:

- indexed canonical pages and search queries;
- observable AI citations/grounding queries;
- AI referral traffic when identifiable;
- external mentions;
- referring domains;
- which research/definition pages are repeatedly retrieved;
- agent-fetch experiments under controlled conditions;
- reuse of openly licensed charts/press facts where observable.

Measurement should remain privacy-minimized.

## Guardrails

Every valid profile requires these rules:

- no ranking claims without evidence;
- owner-controlled examples remain separate from independent evidence;
- preserve negative results;
- canonical technical semantics stay stable across localization;
- no fabricated adoption;
- no single readiness score.

Open reuse additionally needs a clear scope: do not accidentally relicense third-party logos, trademarks, screenshots, quotations or other material you do not own.

These guardrails are part of the schema so they cannot quietly disappear when the profile is copied to another site.

## Applying this to another site

1. Generate a starter with `arwp-ai-search init`.
2. Change `planned` to `active` only for surfaces you have verified as deployed.
3. Rewrite `targetQuestions` around the real user/agent questions for that product.
4. Pick 2–4 P0/P1 modules with genuine source material; do not create every section at once.
5. Add a small vocabulary of terms the product can define with authority.
6. Choose which site-owned assets can be openly reused and publish `/media/rights.json` with an explicit standard license and attribution path.
7. Run `plan` and implement the highest-priority remaining work.
8. Review monthly and record real external evidence before claiming improvements.

The profile is designed to be copied across the user's sites while preserving the same evidence discipline as the ARWP Resolver.
