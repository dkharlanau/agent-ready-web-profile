# AI Search & Citation Profile

The ARWP AI Search & Citation Profile is a **non-normative implementation profile** for websites that want to become easier for search systems and AI agents to identify, retrieve, verify and cite.

It is deliberately not an AI-readiness score, ranking promise or replacement for ordinary web quality. The profile is a reusable implementation plan that records which citation, trust and discovery surfaces are active, planned, paused or not applicable.

Canonical schema:

`/schema/ai-search-profile.schema.json`

ARWP dogfoods the profile at:

`/ai/ai-search-profile.json`

## Why this exists

An agent-ready website, a cite-worthy website and a trustworthy website overlap, but they are not the same thing.

ARWP already resolves machine interfaces. The AI Search Profile adds two questions:

> What should this site publish so an external search or AI system can identify the entity, find original evidence, answer recurring questions, verify claims and cite stable sources?

> What should this site expose so a person or machine can inspect authorship, corrections, security, provenance, reuse rights and the limits of those trust signals?

The model prefers useful primary-source material and verifiable external signals over decorative AI metadata or a synthetic readiness score.

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

The generator intentionally marks proposed surfaces as `planned`. It never claims that a guessed path, DOI, badge, attestation or adoption signal already exists.

## Status model

Every surface or module uses one of four explicit states:

- `planned` — intended implementation, not claimed as live;
- `active` — currently published/operated;
- `paused` — intentionally not being advanced now;
- `not-applicable` — evaluated and intentionally excluded.

This lets the profile serve as backlog, deployment contract and durable record without converting plans into false capability or trust declarations.

## Core surfaces

The profile can track stable canonical surfaces such as:

- entity/home page;
- `ai/site-profile.json`;
- canonical `llms.txt`;
- product history;
- locale manifest;
- sitemap and crawler policy;
- knowledge graph;
- claims index;
- press/media kit;
- machine-readable reuse-rights manifest;
- Trust Center;
- machine-readable corrections ledger.

A URL is not proof of ranking, independent adoption, security or external endorsement.

## P0 — create something worth citing and trusting

**Answer pages** — direct stable answers to recurring questions, leading with the answer and then evidence/boundaries.

**Original research** — measurements, datasets, experiments and negative results that generic summary content cannot reproduce.

**Protocol observatory** — dated facts about relevant protocols/discovery mechanisms, maturity, discovery path, implementation state and primary evidence.

**Trust Center** — one canonical surface for maintainer/entity identity, review methodology, security policy, corrections, provenance, reuse, persistent-identifier state and explicit limitations. A Trust Center is valuable because its signals are individually inspectable, not because it produces a composite score.

## P1 — make facts, rights and provenance easy to verify

**Comparison pages** — evidence-backed comparisons for closely related technologies or choices.

**Concept definitions** — stable canonical definitions for terminology the project actually uses.

**Claims registry** — stable claim IDs with scope, review state, evidence and machine-readable representation.

**Evidence receipts** — replayable/digestible records of important resolver observations or research claims.

**Crawler matrix** — dated source-backed crawler/access configuration that separates search/indexing, user-triggered retrieval and training/model controls.

**Agent fetch lab** — reproducible experiments about which surfaces agents actually retrieve for real tasks.

**Open reuse assets** — press/media pack with explicit scope, standard license, machine-readable rights, canonical facts, boilerplate and attribution instructions.

**Corrections ledger** — public policy plus machine-readable history of material published factual errors. Historical measurements, superseded claims and negative results should not be silently rewritten.

**Software provenance** — verifiable provenance for released artifacts people actually consume. Prefer attesting the exact published artifact, not a different build created earlier in the workflow. An SBOM can be attached to the same artifact, but provenance/SBOM attestations are not security certificates.

**Persistent identifiers** — externally issued identifiers such as DOI where durable citation materially helps. Keep the module `planned` until the external archive/provider actually issues the identifier. Never invent a DOI-shaped string locally.

**Localization** — reviewed language-specific discovery/routing while canonical technical semantics remain stable.

**History** — dated product evolution and maturity for both people and machines.

## P2 — amplify, measure and add external signals

**Knowledge graph** — connect people/entities, products, protocols, concepts, claims, evidence and canonical pages.

**Citation visuals** — charts/diagrams with stable URLs, source notes, alt text and explicit reuse terms.

**External trust signals** — OpenSSF results, external archive records, independent compatibility evidence or similar third-party signals. State exactly what each signal measures; do not turn it into a generic quality certificate.

**External distribution** — distribute substantial primary-source releases while keeping one canonical source URL.

**AI visibility** — measure observable citations, grounding queries, referrals and mentions without collapsing them into a vanity score.

## Trust Center pattern

Recommended minimum structure:

```text
/trust/
├─ index.html           # human-readable trust center
├─ trust.json           # machine-readable identity/evidence/security/provenance state
├─ corrections.html     # human corrections policy + ledger
└─ corrections.json     # machine-readable corrections history
```

Useful Trust Center fields include:

- named maintainer/organization and canonical identities;
- citation metadata and licenses;
- primary-source/review methodology;
- distinction between owner-controlled and independent evidence;
- security reporting policy;
- corrections/supersession policy;
- release/build provenance state;
- SBOM/provenance verification instructions where available;
- DOI/persistent-identifier status;
- external security/trust signals;
- explicit `does not prove` boundaries.

For pre-stable or solo-maintained projects, honest scope is stronger than invented SLAs, certifications or maturity claims.

## Software provenance pattern

For a package release, a strong pipeline is:

```text
source commit
    ↓
CI + tests
    ↓
pack exact release artifact
    ↓
generate dependency SBOM
    ↓
attest artifact provenance
    ↓
attest SBOM to the same artifact
    ↓
publish that exact artifact
    ↓
expose verification instructions
```

Do not state that older artifacts are attested merely because the workflow is configured now.

## Persistent identifier / DOI pattern

Persistent identifiers are deliberately external evidence.

For a GitHub/Zenodo workflow:

1. maintain accurate `CITATION.cff` metadata;
2. connect the repository to Zenodo through the repository owner's external account;
3. publish the intended release;
4. verify that Zenodo archived it and issued a DOI;
5. only then publish the exact DOI through the Trust Center, citation metadata, press facts and relevant research pages.

When version DOI and concept DOI both exist, state their roles rather than treating them as interchangeable.

## Open media / AI reuse pattern

A reusable site should make permission easy to understand before a journalist, researcher or machine has to ask.

```text
/media/
├─ index.html
├─ rights.json
├─ press-facts.json
├─ boilerplate.txt
└─ attribution.txt
```

ARWP uses CC BY 4.0 for designated project-authored press/research/media material because it permits redistribution, adaptation and commercial reuse with attribution. Software remains under its software license; third-party material stays outside the grant unless separately licensed.

The rights manifest should explicitly state whether covered material may be used for search/indexing, AI/ML training, embeddings, RAG, dataset inclusion, summarization and translation. Content-license permission remains separate from crawler/access controls.

## Suggested site structure

```text
/
├─ ai/
│  ├─ site-profile.json
│  ├─ ai-search-profile.json
│  └─ locales.json
├─ llms.txt
├─ trust/
│  ├─ index.html
│  ├─ trust.json
│  ├─ corrections.html
│  └─ corrections.json
├─ history.html
├─ history.json
├─ media/
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

A site should implement only modules that produce real value. Empty SEO pages, fake badges or placeholder trust claims are worse than a smaller set of useful primary sources.

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

```text
observe / scan
      ↓
review evidence
      ↓
publish original data + methodology
      ↓
publish claims / answers / comparisons / visuals
      ↓
publish trust, corrections and reuse metadata
      ↓
distribute externally with canonical source
      ↓
measure citations / referrals / mentions
      ↓
review what actually earned retrieval or citation
      ↓
next observation
```

This is intentionally different from publishing large volumes of generic SEO content.

## Vocabulary ownership

The profile can declare canonical terms the site defines consistently. Creating a term does not make it an industry standard; the purpose is to keep project language stable, attributable and linkable.

For ARWP, candidate concepts include `agentic web resolver`, `resolver regret`, `discovery conflict` and `agent capability graph`.

## Measurement

Useful signals can include:

- indexed canonical pages and search queries;
- observable AI citations/grounding queries;
- AI referral traffic when identifiable;
- external mentions and referring domains;
- repeated retrieval of research/definition pages;
- controlled agent-fetch experiments;
- reuse of openly licensed charts/press facts;
- verified external archive/security/trust records.

Measurement should remain privacy-minimized.

## Guardrails

Every valid profile requires:

- no ranking claims without evidence;
- owner-controlled examples remain separate from independent evidence;
- preserve negative results;
- canonical technical semantics stay stable across localization;
- no fabricated adoption;
- no single readiness score.

Additional trust guardrails:

- do not claim a DOI until externally issued;
- do not claim past artifacts are attested because a future workflow is configured;
- do not present provenance/SBOM as proof of security;
- do not present OpenSSF/self-certification as independent audit;
- do not silently delete corrections or superseded claims;
- do not accidentally relicense third-party content.

## Applying this to another site

1. Generate a starter with `arwp-ai-search init`.
2. Change `planned` to `active` only for verified deployed/operated surfaces.
3. Rewrite `targetQuestions` around the product's real user/agent questions.
4. Build a minimal P0: useful answer/research surface plus a real Trust Center.
5. Add canonical claims/definitions only where the site has authority/evidence.
6. Choose site-owned assets for open reuse and publish machine-readable rights.
7. Configure search/training crawler policy independently.
8. Add corrections/security/provenance mechanisms appropriate to the product.
9. Keep external identifiers/badges `planned` until an external service confirms them.
10. Run `plan`, implement the highest-priority remaining work, and review monthly.

The profile is designed to be copied across sites while preserving ARWP's evidence discipline: useful primary sources, inspectable trust signals and explicit uncertainty instead of SEO folklore.
