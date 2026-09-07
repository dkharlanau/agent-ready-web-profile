# Adaptive Site Upgrade Engine

Status: **v0.1 active** · reviewed **2026-09-07**.

ARWP is evolving from a website audit into an **evidence-to-change operating system for public websites**. Product-facing, this sits inside **SignalBraid · ARWP**.

The core question is no longer only:

> What is wrong with this site?

It is:

> Given what this site actually is, what should be changed now, where should it be changed, which upstream evidence justifies the recommendation, how can the change be verified, and what should be measured afterwards?

That distinction is the product.

## SignalBraid product loop

```text
RADAR       What changed upstream?
  ↓
MAP         What does this site actually have and where is it owned?
  ↓
PLAN        What applies here now?
  ↓
PATCH       What can change safely and exactly?
  ↓
PROOF       Did implementation pass and what evidence followed?
  ↓
WATCH       What drifted or became affected when rules changed again?
  └──────────────────────────────────────────────────────────────↺
```

The Adaptive Site Upgrade Engine is primarily the **Plan** layer. The Target-Site Transformation Engine is the **Patch** layer. Trend/source intelligence feeds **Radar**; evidence receipts and owner-data observations feed **Proof**. The next major architectural work is **Map** and **Watch**.

See [`PRODUCT-LINE.md`](PRODUCT-LINE.md) and [`BRAIDGRAPH.md`](BRAIDGRAPH.md).

## Product loop

```text
upstream platform/standards change
            ↓
versioned ARWP intelligence
            ↓
target-site audit + vertical/context detection
            ↓
applicability engine
            ↓
adaptive upgrade graph
            ↓
exact target surfaces + change recipe
            ↓
verification contract
            ↓
owner/runtime measurement
            ↓
keep / revise / revert / retire
            ↓
knowledge refresh + drift watch
```

ARWP does not treat a website as a generic bag of SEO checks. A research corpus, documentation site, interactive product, editorial publication and local business should not receive the same backlog.

## The upgrade graph

`arwp-upgrade` compiles the existing Growth Plan and vertical evidence into a target-specific upgrade graph.

Each selected upgrade contains:

- **why now** — unresolved audit actions, vertical gaps or a declared target goal;
- **authority** — platform guidance, platform tooling, protocol, repository/PID guidance, or explicit ARWP method;
- **knowledge freshness** — `current` or `review-due`;
- **target surfaces** — the concrete files/pages/platform state affected;
- **automation class** — mechanical, grounded template, policy-gated, editorial, owner-platform or runtime;
- **recipe** — the intended change rather than a vague recommendation;
- **verification contract** — what must be true after implementation;
- **measurement signals** — what to observe later without turning correlation into causation;
- **dependencies** — prerequisites and change ordering;
- **addresses** — the exact source action/check IDs the upgrade is expected to close.

Example:

```bash
node bin/arwp-upgrade.mjs site https://example.com/ \
  --vertical=research-dataset \
  --goals=search,generative-search,ai-citations,measurement
```

Or compile an already captured Growth Plan:

```bash
node bin/arwp-upgrade.mjs compile arwp-growth.json \
  --verticals=research-dataset \
  --goals=search,generative-search,ai-citations,measurement \
  --output=arwp-upgrade.json
```

Then model which known implementation gaps an accepted set would address:

```bash
node bin/arwp-upgrade.mjs simulate arwp-upgrade.json \
  --accept=foundation,dataset-publication-pid
```

Simulation predicts **implementation debt coverage only**. It never predicts ranking, citation, traffic or conversion uplift.

## Versioned intelligence, not permanent SEO folklore

The intelligence registry lives in:

```text
registry/adaptive-upgrade-packs.json
```

Every pack includes `sourceReviewedAt` and `reviewAfterDays`.

When upstream knowledge ages past that interval, the recommendation remains visible but is marked `review-due`. This creates a real maintenance contract:

1. re-check the primary source;
2. confirm, revise, downgrade or retire the pack;
3. preserve history instead of silently rewriting past guidance;
4. re-audit affected target sites.

This is important because Search, AI answer systems, crawler controls, reporting products and agent interfaces change quickly. A static checklist inevitably becomes cargo cult.

## Current intelligence packs

The first adaptive registry covers:

1. Search/generative-search technical foundation;
2. evidence-addressable, non-commodity content;
3. canonical entity/provenance graph;
4. ChatGPT Search access separated from GPTBot training policy;
5. semantic accessibility for interactive browser agents;
6. citable versioned dataset publication with verified DOI when a real corpus exists;
7. Google Preferred Sources for suitable repeat-reader sites;
8. Google generative Search owner-measurement loop;
9. Bing citation/grounding-query/intent/topic/Citation Share feedback loop;
10. provider-specific AI content-use policy;
11. real agent/API interface contracts;
12. a change-evidence loop that preserves why a site was modified and what happened next.

The registry is intentionally smaller than every idea ARWP has ever observed. A mechanism becomes an adaptive upgrade only when there is enough evidence and a useful target-site change contract.

## Dataset example: cards, knowledge bases and language corpora

A site may already contain hundreds or thousands of useful JSON/JSONL records but still expose them only as application files.

When `research-dataset` is genuinely applicable, ARWP should recommend promoting the corpus into a first-class data product:

```text
raw corpus
  ↓
stable dataset identity
  ↓
landing page + Dataset metadata
  ↓
methodology / provenance / limitations
  ↓
license + version
  ↓
frozen distributions
  ↓
SHA-256 manifest
  ↓
archival publication
  ↓
verified DOI
  ↓
CITATION / related identifiers / version graph
```

The DOI is never invented and is never treated as a ranking factor. Until an external resolver confirms it, status remains `not-issued`.

This is particularly relevant to card libraries, structured knowledge bases, benchmark/evaluation corpora, linguistic annotations, reusable research observations and other sites where the underlying data is itself valuable.

## AI citation feedback becomes a planning signal

Bing Webmaster Tools exposes citation activity, cited pages and grounding queries, with additional intent/topic/share views evolving over time.

ARWP's `bing-citation-intelligence-loop` treats these as owner-side observations that can feed the next backlog:

```text
grounding query/topic
        ↓
existing cited page?
   ↙             ↘
yes               no
 ↓                 ↓
depth/freshness   real unmet intent?
review             ↓
                only then propose content
```

This avoids the obvious failure mode of turning every query variant into another thin page.

## Mutation model

ARWP separates four levels:

### 1. Detect
Public, bounded inspection discovers evidence and gaps.

### 2. Recommend
The Adaptive Upgrade Engine produces precise desired-state changes.

### 3. Prepare
Remediation/PR delivery can create durable review artifacts in an explicitly authorized target repository.

### 4. Apply
Production mutation begins only with deterministic mechanical or grounded transformations and retains:

- explicit repository authorization;
- path allowlists;
- before/after digests;
- rollback data;
- post-change verification;
- policy/truth gates for robots, identity, editorial and owner-platform changes.

The product should become more autonomous **by proving which classes of changes are safe**, not by pretending every recommendation can be blindly auto-fixed.

## Product moat: from upgrade graph to BraidGraph

The defensible asset is not an `llms.txt` generator, not a prompt-monitoring dashboard and not a 0–100 GEO score.

The stronger system is **BraidGraph**, linking:

```text
upstream source
  ↔ rule version + freshness/history
  ↔ site state + repository ownership
  ↔ applicability
  ↔ recommendation
  ↔ exact repository/site surface
  ↔ deterministic transform
  ↔ verification receipt
  ↔ owner/runtime outcome evidence
  ↔ next experiment
```

The graph must work backwards as well as forwards.

A source/rule revision should be able to produce a **blast-radius query**:

```text
changed rule
   ↓
affected recommendations
   ↓
affected sites
   ↓
previous transforms
   ↓
repo files / surfaces needing re-review
```

That reverse impact path is a more durable differentiation than merely producing recommendations. It turns upstream platform drift into portfolio-specific website operations.

## Current competitive boundary

By September 2026, leading AI-search products already cover prompt monitoring, citations, sentiment, competitor share, recommendations and increasingly content/action automation. Agent-experience platforms can also serve AI-specific content layers; crawler platforms can enforce access policy; readiness scanners can gate technical regressions.

SignalBraid should therefore compete on a different chain:

> **source-backed rule supply chain → target applicability → canonical source-file resolution → safe reversible change → verification → outcome evidence → reverse impact when the rule changes again**.

This is intentionally broader than content optimization and narrower than pretending to control Search/AI outcomes.

Detailed market map and product packaging: [`PRODUCT-LINE.md`](PRODUCT-LINE.md).

## Commercial path

The open core can remain useful while commercial layers emerge around operation rather than unverifiable promises.

### Open core

- Radar/recommendation registries;
- single-site Map/Plan/Patch primitives;
- open BraidGraph schema/compiler;
- deterministic transformation engine;
- local receipts and verification;
- open Agent Skills and CLI.

### Hosted / Pro

- managed continuously refreshed intelligence feed;
- SignalBraid Watch portfolio monitoring and rule-impact alerts;
- scheduled source re-review and site drift;
- repository PR/remediation automation;
- owner-data adapters for Google, Bing, Cloudflare and analytics;
- historical before/after evidence and executive reporting;
- verified transformation packs for common stacks.

### Team / Enterprise

- private/company rule packs;
- policy-as-code;
- team review and approval gates;
- automation governance;
- portfolio audit history;
- organization-level crawler/content-use policy controls.

A paid edition should sell **maintenance, automation, governance, evidence and scale**, not a promise to rank.

## Highest-leverage next builds

1. **BraidGraph compiler** — canonical graph linking existing ARWP artifacts.
2. **Repository Mapper** — rendered surface → owning source file/fact/build path.
3. **Reverse impact analysis** — changed source/rule → affected sites/files/transforms.
4. **Unified Change Receipt** — rule version + digests + verification + measurement state.
5. **Portfolio Watch** — multi-site drift and rule-impact waves.
6. **Verified stack transformation packs** — tested adapters instead of generic editing.
7. **Owner evidence connectors** — Google/Bing/Cloudflare/referral evidence with provenance.

## Current primary sources

- Google generative Search guidance: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Preferred Sources: https://developers.google.com/search/docs/appearance/preferred-sources
- Google generative Search performance reports: https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports
- OpenAI publisher/developer guidance: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- Bing AI Performance: https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c
- Bing Webmaster Guidelines: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- Cloudflare AI Crawl Control: https://developers.cloudflare.com/ai-crawl-control/
- Zenodo GitHub/software archiving: https://help.zenodo.org/docs/github/
- DataCite Metadata Schema 4.7: https://schema.datacite.org/meta/kernel-4/
