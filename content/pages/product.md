# SiteCurrent — Adaptive Website Improvement

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/product/

**Keep your site ready for what finds it next.**

The web changes. Your site should keep up.

SiteCurrent watches current Search, AI and agent guidance, checks what actually applies to your website, and turns that into concrete improvements — **what to change, where to change it, how to verify it and what to measure afterward**.

It is the product-facing layer built on the open-source **Agent-Ready Web Profile (ARWP)** project.

> **Found. Understood. Cited. Used.**

That is the rhythm. Not a promise of rankings. A practical direction for making a website easier for people, search systems and compatible agents to discover, interpret, reference and use.

## Why SiteCurrent exists

Most website tools are snapshots.

They crawl the site, produce a score, hand over 74 issues and quietly wait for the next subscription month.

SiteCurrent is designed around a different question:

> **What should this actual site change now — given what the web looks like now?**

That requires more than an audit. The intelligence has to stay current. The system has to understand whether a tactic applies. The recommendation has to resolve into real work. Safe work should be able to reach the repository. And passing a build still should not be confused with proving a ranking gain.

```text
WHAT CHANGED ON THE WEB?
          ↓
WHAT APPLIES TO THIS SITE?
          ↓
WHAT IS MISSING / STALE HERE?
          ↓
WHAT EXACTLY SHOULD CHANGE?
          ↓
CAN WE CHANGE IT SAFELY?
          ↓
DID THE IMPLEMENTATION PASS?
          ↓
WHAT HAPPENED AFTERWARD?
          └──────────────↺
```

## What you get

### 1. A site that does not depend on yesterday's checklist

Search guidance, AI discovery controls, crawler behavior, agent interfaces and measurement surfaces keep changing. SiteCurrent stores dated, source-backed guidance and moves stale knowledge to `review-due` instead of treating every old recommendation as permanent truth.

**Benefit:** less time chasing platform updates and less chance of optimizing around something that is already obsolete.

### 2. Recommendations that know when they do not belong

A real research corpus may need dataset metadata, versioning, checksums and DOI publication. A normal brochure site should not manufacture a dataset because a checklist said so. An interactive product may benefit from agent-operability work. A static article library should not expose fake tools.

**Benefit:** fewer decorative files, fewer cargo-cult tactics, more work tied to the actual site.

### 3. A shorter path from finding a problem to fixing it

The Adaptive Site Upgrade Engine turns evidence into exact surfaces, recipes, dependencies and verification contracts. The Target-Site Transformation Engine can promote deterministic or explicitly grounded work into digest-gated file changes and a reviewable pull request.

**Benefit:** less developer guesswork between “SEO recommendation” and “which file do I actually touch?”

### 4. Automation that knows where to stop

Mechanical work can be automated. Grounded templates can move forward only after real facts and exact target files are resolved. Publisher policy, editorial judgment, authenticated owner settings and runtime/security decisions stay gated.

**Benefit:** useful automation without pretending every website decision is safe because an agent can edit Git.

### 5. Proof after the change, not confidence theatre

A build that passes proves the implementation passed. It does not prove Google will rank the page, an AI system will cite it or users will convert. SiteCurrent keeps implementation evidence and outcome evidence separate and preserves neutral or negative results.

**Benefit:** a system that can actually learn instead of continuously declaring itself successful.

## The product loop

**Current guidance → target-site evidence → upgrade graph → exact change → verification → measurement → next signal.**

The loop is the product. Individual SEO, GEO, dataset, provenance, crawler or agent techniques are modules inside it.

## Core capabilities

- **Search + AI visibility audit** — crawlability, indexability, citation surfaces, freshness, identity, structured data, crawler policy and owner-measurement gates.
- **Versioned best-practice intelligence** — source, applicability, review date, maturity and stale-knowledge handling.
- **Adaptive Site Upgrade Engine** — site-specific change surfaces, recipes, dependencies, verification and measurement contracts.
- **Target-Site Transformation Engine** — path allowlists, file digests, grounded change promotion, rollback and production-path PR delivery.
- **Dataset publication + DOI readiness** — only for genuine reusable corpora; metadata, methodology, distributions, versioning, checksums and external archive workflow.
- **Growth hypotheses + experiments** — connects changes to explicit hypotheses and before/after evidence without inventing causality.
- **Agentic-web discovery + resolution** — API, MCP, A2A, WebMCP, Agent Skills, ARD and ordinary web discovery surfaces where they are real.
- **Evidence + drift** — implementation snapshots, negative results, upstream changes and long-running site history.

## Fast path

```bash
# What does this site need now?
arwp-growth https://example.com --vertical=documentation --upgrade

# Turn the evidence into a site-specific upgrade graph.
arwp-upgrade site https://example.com \
  --vertical=documentation \
  --output=upgrade.json

# Once the exact repository facts/files are grounded:
arwp-transform compile upgrade.json transform-spec.json \
  --output=transform.json

# Inspect before touching production files.
arwp-transform simulate transform.json
```

GitHub production delivery uses a new branch and pull request after explicit authorization and base/file digest checks. There is no direct-main transformation mode.

## Not another AI-visibility dashboard

Visibility monitoring is useful, but SiteCurrent's center of gravity is different.

It connects five layers that are often separated across different tools:

1. **live knowledge** — what current platforms and specifications actually say;
2. **site understanding** — what this site is and what evidence it already exposes;
3. **decision** — what is applicable and worth changing;
4. **execution** — the exact safe repository work;
5. **learning** — what the implementation and owner/runtime evidence say afterward.

That is why the preferred category is **adaptive website improvement system**, not “SEO score” or “GEO checker”.

## Brand

**SiteCurrent** is the product brand. **Agent-Ready Web Profile (ARWP)** remains the open-source project, technical foundation, repository/package identity and profile/interoperability terminology.

Primary line:

> **Keep your site ready for what finds it next.**

Short rhythm:

> **Found. Understood. Cited. Used.**

Brand system and visual assets: [`docs/BRAND-SITECURRENT.md`](../../docs/BRAND-SITECURRENT.md) · `/media/sitecurrent-mark.svg` · `/media/sitecurrent-lockup.svg`

## Availability

- GitHub: https://github.com/dkharlanau/agent-ready-web-profile
- npm: https://www.npmjs.com/package/agent-ready-web-profile
- License: Apache-2.0
- Current open-source price: 0

The architecture leaves a clean future boundary for hosted continuous monitoring, managed transformations, private owner-data connectors, portfolio intelligence and team governance without making them prerequisites for the open-source core.

## Product boundary

SiteCurrent does **not** guarantee ranking, indexing, Discover placement, AI citation, recommendation traffic or conversion. It aims to make the path from changing web guidance to a verified, measurable site improvement faster, clearer and less speculative.
