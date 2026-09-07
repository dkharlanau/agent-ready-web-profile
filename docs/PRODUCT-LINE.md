# SignalBraid · ARWP — Product Line

Reviewed: **2026-09-07**.

> **Weave the signals. Ship the change.**

SignalBraid · ARWP is the product-facing layer of Agent-Ready Web Profile (ARWP). The product is not another single-purpose GEO dashboard. Its intended category is **evidence-to-change website operations**: keep current upstream guidance connected to the exact target-site state, the exact change, the verification receipt and the evidence observed afterwards.

The short operating rhythm is:

> **Detect. Map. Decide. Change. Prove. Watch.**

## Market reality in 2026

The AI-search market already covers much more than basic visibility dashboards:

| Market lane | What strong products already do | SignalBraid boundary |
| --- | --- | --- |
| AI visibility intelligence | Ahrefs Brand Radar, Semrush AI Visibility, Peec AI, OtterlyAI and Profound track prompts, mentions, citations, competitors, sentiment/share of voice and related opportunities. | These measurements are valuable **evidence inputs and outcomes**, but SignalBraid does not make a vendor-defined visibility score the system of record. |
| AI-search action/content workflows | Profound connects AI-search data to Agents, Sheets and content workflows; Otterly and Peec provide prioritized optimization guidance. | SignalBraid is broader than content generation: technical Search foundations, crawler policy, structured data, entity/provenance, datasets, agent interfaces and repository configuration can all be first-class change surfaces. |
| Agent experience delivery | Scrunch AXP can serve an AI-optimized representation of a website to known agents at the edge. | SignalBraid's main mutation path is the **canonical source/repository**, with reviewable changes and post-change verification, rather than a parallel AI-only representation. |
| AI crawler control | Cloudflare AI Crawl Control observes crawlers and can allow, block or monetize access. | SignalBraid treats crawler policy and traffic as owner/platform state. It can reason about and verify policy, but it is not a WAF or crawler-enforcement network. |
| Agent-readiness scoring | AgentReady/Ora and related scanners measure whether products are readable/discoverable/actionable by agents. | SignalBraid avoids a universal readiness score. It asks which capabilities actually apply to this site, then connects the answer to exact implementation work. |
| Open-source GEO/AEO tooling | GEO-AI generates AI-search artifacts and crawler rules; AEO audit tooling can gate built HTML in CI and detect regressions. | SignalBraid's stronger target is the **full evidence lineage and reverse impact graph**: why a rule exists, whether it still applies, which site/file it affects, what changed, and whether later evidence supports keeping it. |

Current source references:

- Ahrefs Brand Radar: https://ahrefs.com/brand-radar
- Semrush AI Visibility Toolkit: https://www.semrush.com/kb/1493-ai-visibility-toolkit
- Peec AI: https://peec.ai/product/ai-visibility
- OtterlyAI: https://otterly.ai/features/
- Profound: https://www.tryprofound.com/features
- Profound Sheets: https://www.tryprofound.com/blog/profound-sheets-launch
- Scrunch Agent Experience Platform: https://helpcenter.scrunchai.com/en/articles/13656392-agent-experience-platform-axp
- Cloudflare AI Crawl Control: https://developers.cloudflare.com/ai-crawl-control/
- AgentReady: https://www.agentready.org/
- GEO-AI: https://github.com/madeburo/GEO-AI
- AEO audit action: https://github.com/Canonry/aeo-audit-action

This review is a capability map, not a winner ranking. Vendor capabilities change quickly and unknown capabilities are not assumed absent.

## The unique product primitive: BraidGraph

The strongest defensible primitive is not a score, prompt database or generated file. It is a versioned graph that connects the whole evidence-to-change chain:

```text
UPSTREAM SOURCE
      ↓
RULE VERSION
      ↓
TARGET-SITE EVIDENCE
      ↓
APPLICABILITY
      ↓
RECOMMENDATION
      ↓
REPOSITORY SURFACE
      ↓
TRANSFORMATION
      ↓
VERIFICATION RECEIPT
      ↓
OUTCOME EVIDENCE
```

Call this **BraidGraph**.

The graph must also work in reverse. That is where the product becomes much more valuable:

- an upstream rule changes → which sites are now affected?
- a recommendation becomes `review-due` → which previous changes depended on it?
- a file changed → which source-backed recommendation justified it?
- an implementation passed → which outcome signals are still missing?
- a portfolio policy changes → which repositories need a reviewable patch?

This is closer to dependency management and change-impact analysis for websites than to a conventional SEO audit.

## Product line

### 1. SignalBraid Radar — **Detect**

**Status:** active foundation.

Tracks meaningful Search, AI-search, crawler, dataset/PID and agent-web changes from primary sources.

Current ARWP assets already provide Trend Radar, recommendation registries, source snapshots and knowledge freshness. The next step is to make source change events first-class BraidGraph nodes with semantic diffs and explicit affected-rule edges.

**Value:** stop manually chasing platform blogs and stale checklists.

### 2. SignalBraid Map — **Map**

**Status:** next core build.

Build a target-site **Site State Graph** from both the public site and its source repository.

It should map:

- routes/pages and which source files render them;
- framework/stack and build/deploy ownership;
- entities, structured data and factual source-of-truth files;
- content collections and datasets;
- crawler and access policy;
- Search/AI/agent discovery surfaces;
- APIs, MCP/A2A/WebMCP/Agent Skills where real;
- existing analytics/owner evidence adapters;
- repository paths that are safe, gated or forbidden to mutate.

The critical capability is **rendered surface → owning source file** resolution. That removes the current manual gap between an upgrade recommendation and a deterministic target transformation.

**Value:** the system understands the actual site before prescribing changes.

### 3. SignalBraid Plan — **Decide**

**Status:** active.

The Adaptive Site Upgrade Engine is this layer.

It combines current rules, site evidence, vertical/site type, goals and dependencies into a target-specific upgrade graph. It explicitly distinguishes `recommended`, `conditional`, `not-applicable` and `review-due` work instead of giving every site the same checklist.

**Value:** fewer cargo-cult fixes; higher relevance of every change.

### 4. SignalBraid Patch — **Change**

**Status:** active v0.1 / expanding.

The Target-Site Transformation Engine converts deterministic work into path-allowlisted, digest-gated operations and production-path pull requests.

Future transformation packs should be stack-aware:

- GitHub Pages / static HTML;
- Jekyll;
- Next.js;
- Astro;
- Docusaurus;
- documentation generators;
- WordPress/Shopify through explicit adapters rather than guessed file edits.

Policy, editorial truth, authenticated owner settings and security/runtime decisions remain gated.

**Value:** move from advice to a reviewable implementation without turning the product into unsafe autonomous editing.

### 5. SignalBraid Proof — **Prove**

**Status:** partial foundation active.

Unify evidence receipts, build/test results, ARWP re-audits, visibility imports, runtime agent evaluations and experiment records into one change receipt.

A proof object should answer:

- what source/rule triggered the change;
- what exact file/state changed;
- before/after digests;
- what checks passed;
- what remains owner-controlled or unknown;
- what Search/AI/referral/runtime evidence was observed later;
- whether the change was kept, revised, reverted or retired.

A successful build is implementation proof, not ranking proof.

**Value:** every important change remains explainable months later.

### 6. SignalBraid Watch — **Watch**

**Status:** next commercial/high-leverage layer.

Portfolio mode turns BraidGraph into continuous change-impact monitoring.

Example questions:

> Google changed a Search/AI rule yesterday. Which 14 sites, 31 recommendations and 9 source files in this portfolio are affected?

> Which sites still depend on a rule whose upstream source is now `review-due`?

> Which repository patches were merged but still have no owner-side outcome evidence?

This layer should support scheduled source re-review, multi-site drift, portfolio policy, alerts and prioritized change waves.

**Value:** one team can maintain many sites without re-auditing everything manually after every platform change.

### 7. SignalBraid Connect — **Observe owner reality**

**Status:** extension layer.

Adapters should bring external owner evidence into the same graph without pretending that ARWP controls those systems:

- Google generative Search/Search Console exports;
- Bing AI Performance / grounding queries / citation data;
- Cloudflare AI crawler activity and policy state;
- referral analytics;
- deployment/build providers;
- optional CMS/repository metadata.

**Value:** connect implementation evidence to what actually happened outside the repository.

## Product packaging

### Open core

Best for developers and individual sites:

- Radar intelligence registry;
- Map/site inspection primitives;
- Plan/upgrade graph;
- Patch/PR transformation engine;
- Proof receipts and local evidence;
- open schemas, CLI and Agent Skills.

### Hosted / Pro

Best for agencies, maintainers and multi-site owners:

- continuously refreshed managed intelligence;
- SignalBraid Watch portfolio mode;
- scheduled re-audits and source-impact alerts;
- owner-data connectors;
- verified stack transformation packs;
- longitudinal evidence dashboards;
- managed transformation PRs.

### Team / Enterprise

Best for governed environments:

- private rule packs;
- organization policy-as-code;
- automation-class overrides with approval boundaries;
- team review/approval workflows;
- audit history and change accountability;
- portfolio-level allowed/blocked crawler and AI-use policies.

The paid value is **maintenance, automation, governance, evidence and scale** — not a promise to rank or be cited.

## Highest-value new product bets

### P0 — BraidGraph schema and compiler

Create the canonical graph linking source → rule → site evidence → recommendation → repo surface → transform → verification → outcome.

This becomes the shared data model behind all product layers.

### P0 — Repository Mapper

Automatically resolve rendered public surfaces to source repository owners/files, framework-aware build paths and mutation classes.

This is the missing bridge that allows more `grounded-template` work to become safe deterministic transformation bundles.

### P0 — Reverse impact analysis

Given a changed/retired/review-due source rule, compute affected sites, recommendations, previous transforms and files.

This is the foundation for SignalBraid Watch.

### P0 — Unified Change Receipt

Every transformation should emit one durable receipt with source rule version, before/after digests, verification results, deployment evidence and follow-up measurement requirements.

### P1 — Portfolio policy-as-code

Allow an organization to define bounded policy such as:

- permit OAI-SearchBot but keep training-bot policy owner-controlled;
- never auto-edit editorial claims;
- require human review for identity/schema facts;
- allow deterministic sitemap/canonical/build metadata repairs;
- require specific tests before opening a production PR.

### P1 — Verified stack transformation packs

Build high-confidence adapters with fixtures and regression tests for the most common stacks rather than generic text editing.

### P1 — Source semantic-diff watcher

Detect material guidance changes, not only timestamp or page-text churn. A source change should produce a proposed rule revision and blast-radius preview before it affects target sites.

### P1 — First-party evidence connectors

Normalize Google, Bing, Cloudflare and analytics evidence into source-identified graph nodes.

### P2 — Page-cohort evidence helper

Assist with before/after cohorts and comparable unchanged pages to make outcome review less anecdotal while explicitly avoiding unsupported causality claims.

### P2 — Public transformation benchmark

Publish reproducible fixtures showing whether a transformation closed the intended implementation debt, including failures and negative results. Do not turn it into a ranking benchmark.

## Durable differentiation

The durable thesis is:

> **Visibility tools tell you what AI/search systems are doing. Audit tools tell you what is missing. SignalBraid should connect changing upstream evidence to the exact safe site change, preserve why it happened, and know which sites need attention when the evidence changes again.**

If that chain is implemented well, the product has a reason to exist even as visibility dashboards, GEO scores and content-generation features become commodity.