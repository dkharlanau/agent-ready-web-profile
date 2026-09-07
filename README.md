<p align="center">
  <img src="docs/media/sitecurrent-lockup.svg" alt="SiteCurrent — Adaptive Website Improvement" width="520">
</p>

# SiteCurrent

**Adaptive website improvement, powered by Agent-Ready Web Profile (ARWP).**

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Adaptive Site Upgrade validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml)
[![Target-Site Transformation validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/transformation-engine.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/transformation-engine.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

> **Keep your site ready for what finds it next.**

The web changes. Search changes. AI discovery changes. Crawlers change. Agent interfaces change. The site should not quietly age underneath all of that.

SiteCurrent maintains current, source-backed web guidance, checks what actually applies to a target website, and turns it into concrete work: **what to change, where to change it, how to verify it, and what to measure afterward**.

**Found. Understood. Cited. Used.**

That is the direction — not a ranking promise.

## Why this exists

Most website tools are snapshots. They crawl, score, export a list of issues and stop.

SiteCurrent is built around a continuing loop:

```text
WHAT CHANGED ON THE WEB?
          ↓
WHAT APPLIES TO THIS SITE?
          ↓
WHAT IS MISSING OR STALE?
          ↓
WHAT EXACTLY SHOULD CHANGE?
          ↓
CAN IT CHANGE SAFELY?
          ↓
DID THE IMPLEMENTATION PASS?
          ↓
WHAT HAPPENED AFTERWARD?
          └──────────────↺
```

The goal is not “more SEO files”. The goal is a website that adapts to useful changes in Search, generative discovery, citation systems and compatible agents without accumulating cargo-cult tactics.

## What SiteCurrent does

### Keeps the intelligence current

Recommendations are source-backed, dated and versioned. Guidance carries review windows; stale knowledge becomes `review-due` instead of surviving forever as a checklist item.

### Understands the target before prescribing fixes

A genuine research corpus may need dataset versioning, methodology, checksums and DOI publication. An ordinary marketing site should not manufacture a dataset to look sophisticated. An interactive product may benefit from agent-operability work; a static article library should not expose fake tools.

### Turns evidence into exact work

The **Adaptive Site Upgrade Engine** compiles target-site evidence into change surfaces, recipes, dependencies, verification contracts and follow-up measurement signals.

### Can carry safe work to the repository

The **Target-Site Transformation Engine** promotes only deterministic mechanical or explicitly grounded changes into path-allowlisted, digest-gated operations. GitHub production delivery uses a new branch and pull request. It does not expose a direct-main transformation mode.

### Knows when automation should stop

Publisher policy, editorial judgment, authenticated owner settings and runtime/security decisions remain gated. The fact that an agent can edit a file is not evidence that it should.

### Separates implementation proof from outcome proof

A successful build proves that the implementation passed. It does not prove ranking, indexing, AI citation, recommendation traffic or conversion. SiteCurrent keeps those evidence classes separate and preserves neutral or negative results.

## Product loop

```text
CURRENT GUIDANCE
      ↓
TARGET-SITE EVIDENCE
      ↓
APPLICABILITY + DEBT
      ↓
ADAPTIVE UPGRADE GRAPH
      ↓
EXACT TARGET + TRANSFORM
      ↓
VERIFY / PR / DEPLOY
      ↓
MEASURE / LEARN / RE-REVIEW
      └──────────────────↺
```

Individual SEO, GEO, dataset, provenance, crawler, content and agent mechanisms are modules inside this loop — not the product by themselves.

## Fast path

```bash
git clone https://github.com/dkharlanau/agent-ready-web-profile.git
cd agent-ready-web-profile
npm ci

# What changed recently?
arwp-trends list --since=90 --exclude-retired

# What should this site do now?
arwp-growth https://example.com --vertical=documentation --upgrade

# Build the site-specific upgrade graph.
arwp-upgrade site https://example.com \
  --vertical=documentation \
  --output=upgrade.json

# Once exact repository files and facts are grounded:
arwp-transform compile upgrade.json transform-spec.json \
  --output=transform.json

# Inspect the deterministic changes before applying them.
arwp-transform simulate transform.json
```

The npm package also exposes `arwp-dataset` for genuine reusable corpora and the existing audit, visibility, resolver, evidence and experiment tooling.

## Core product layers

### 1. Trend + recommendation intelligence

Tracks current Search, AI-search, citation, crawler and agent-web changes from primary sources. Recommendations retain source, maturity, applicability and review freshness.

### 2. Growth Profile

Audits a real site and produces a prioritized evidence-backed backlog rather than a universal readiness score.

### 3. Adaptive Site Upgrade Engine

Compiles current evidence into dependency-aware target-site upgrades with exact change surfaces, automation class, recipes, verification contracts and measurement signals.

Canonical intelligence: [`registry/adaptive-upgrade-packs.json`](registry/adaptive-upgrade-packs.json)

### 4. Target-Site Transformation Engine

Turns grounded upgrade work into deterministic file operations with:

- explicit path allowlists;
- before/after SHA-256 digests;
- exact-match preconditions;
- stale-base refusal;
- blocked sensitive paths;
- rollback support;
- new-branch/PR GitHub delivery;
- no direct-main production mode.

See [`docs/TARGET-SITE-TRANSFORMATION.md`](docs/TARGET-SITE-TRANSFORMATION.md).

### 5. Evidence + learning

Keeps implementation snapshots, hypothesis history, owner-provided visibility evidence, runtime receipts, negative results and upstream rule changes connected over time.

### 6. Resolver + interoperability foundation

The original ARWP Resolver remains part of the product. It discovers heterogeneous website interfaces, preserves provenance and conflicts, and selects a suitable interface for concrete intents without requiring every external website to adopt ARWP.

## Dataset publication when it is real

A genuine reusable corpus can activate dataset publication work: canonical Dataset metadata, methodology, license, frozen versioned distributions, SHA-256 checksums and external archival DOI workflow.

An ordinary site should **not** create a decorative dataset or DOI merely to pass a profile.

See [`docs/DATASET-PUBLICATION.md`](docs/DATASET-PUBLICATION.md).

## Agent Skills

```bash
npx skills add dkharlanau/agent-ready-web-profile
```

The skill composition follows the product loop:

`arwp-growth-loop → arwp-adaptive-upgrade → arwp-target-transformation → verification / measurement`

Specialists remain available for initial site preparation, content quality, genuine dataset publication, agent discovery and evidence/CI.

## What makes this different

SiteCurrent deliberately separates five things that are often collapsed into one “AI visibility score”:

1. **upstream knowledge** — what current platforms/specifications actually say;
2. **applicability** — whether it belongs on this particular site;
3. **decision** — what is worth changing now;
4. **implementation evidence** — whether the actual change is present and correct;
5. **outcome evidence** — what Search, AI citation, referral or agent metrics did afterward.

That separation makes the system more conservative in claims and more useful in execution.

## Brand architecture

**SiteCurrent** is the human-facing product brand.

**Agent-Ready Web Profile (ARWP)** remains the open-source technical project, repository/package identity, profile terminology and interoperability foundation.

Preferred relationship:

> **SiteCurrent — adaptive website improvement, powered by ARWP.**

Brand system: [`docs/BRAND-SITECURRENT.md`](docs/BRAND-SITECURRENT.md)  
Machine-readable identity: [`brand/sitecurrent.json`](brand/sitecurrent.json)  
Open media assets: [`docs/media/sitecurrent-mark.svg`](docs/media/sitecurrent-mark.svg) · [`docs/media/sitecurrent-lockup.svg`](docs/media/sitecurrent-lockup.svg)

## Evidence before claims

- passing a check does not prove ranking or indexing;
- owner-controlled reference sites are implementation evidence, not independent adoption;
- benchmark improvements are not evidence of Search/AI visibility gains;
- static metadata never grants authorization or security trust;
- source-watch candidates are not recommendations;
- `review-due` knowledge cannot silently remain executable;
- generated upgrade graphs do not authorize unsafe production mutation;
- a DOI is a persistent citation identifier, not a ranking factor or quality certificate;
- negative benchmark and experiment results stay visible.

## North stars

Primary product North Star:

> **How reliably can SiteCurrent turn a real change in the web ecosystem into the right change for a real site, verify it, and connect it to measurable follow-up evidence?**

Transformation North Star:

> **How much target-site implementation debt can the system correctly address without generic advice, invented facts, stale rules or unsafe mutation?**

Resolver North Star:

> **How many external sites can ARWP correctly understand and route without site-specific integration code?**

## Key docs

- [`docs/BRAND-SITECURRENT.md`](docs/BRAND-SITECURRENT.md) — product brand, voice, messaging and visual system.
- [`docs/ADAPTIVE-SITE-UPGRADE.md`](docs/ADAPTIVE-SITE-UPGRADE.md) — evidence-to-change intelligence.
- [`docs/TARGET-SITE-TRANSFORMATION.md`](docs/TARGET-SITE-TRANSFORMATION.md) — safe production-path transformation.
- [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) — operating model.
- [`docs/GROWTH-LEARNING.md`](docs/GROWTH-LEARNING.md) — evidence and learning lifecycle.
- [`docs/SEARCH-AGENT-RECOMMENDATIONS.md`](docs/SEARCH-AGENT-RECOMMENDATIONS.md) — dated upstream recommendations.
- [`docs/DATASET-PUBLICATION.md`](docs/DATASET-PUBLICATION.md) — genuine corpus publication and DOI boundary.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — interoperability model.
- [`TRADEMARKS.md`](TRADEMARKS.md) — naming and trademark boundary.

Public product page: https://dkharlanau.github.io/agent-ready-web-profile/product/

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
