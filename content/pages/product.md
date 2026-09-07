# SignalBraid · ARWP

**Weave the signals. Ship the change.**

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/product/

SignalBraid · ARWP is the product-facing identity for the adaptive website-improvement system built by Agent-Ready Web Profile (ARWP).

The product is designed for a web that keeps changing underneath a site. Search guidance changes. AI citation and retrieval behavior changes. Crawler policy changes. Agent interfaces change. New measurement surfaces appear. A one-time audit goes stale.

SignalBraid keeps the evidence chain connected from **what changed upstream** to **what should change in this exact website**, then to **what actually changed in the repository**, **whether the implementation passed**, and **what evidence appeared afterwards**.

> **Detect. Map. Decide. Change. Prove. Watch.**

```text
SEARCH / AI / AGENT / CRAWLER / DATA SIGNALS
                    ↓
                 RADAR
                    ↓
                  MAP
                    ↓
                  PLAN
                    ↓
                  PATCH
                    ↓
                  PROOF
                    ↓
                  WATCH
                    └──────────────────────↺
```

## The unique primitive: BraidGraph

The main product asset is not a GEO score or another prompt dashboard. It is a versioned evidence-to-change graph:

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

The important part is that the graph works backwards too.

If a source rule changes or becomes `review-due`, SignalBraid should be able to tell an owner **which sites, recommendations, previous transformations and source files now require re-review**.

That turns platform drift into a concrete website-maintenance problem instead of another news feed.

## Product line

### Radar — what changed?

Versioned source-backed intelligence for Search, AI search, crawler policy, agent-web interfaces, datasets/PIDs and related platform guidance.

### Map — what does this site actually have?

A Site State Graph that understands the public surface and the source repository: routes, framework, source-of-truth files, structured data, entities, datasets, policies, agent interfaces and safe/gated mutation boundaries.

The next major technical goal is **rendered surface → owning source file** resolution.

### Plan — what actually applies?

The Adaptive Site Upgrade Engine filters current guidance through site type, real evidence, goals, dependencies and knowledge freshness. It can say `recommended`, `conditional`, `not-applicable` or `review-due` rather than handing every site the same checklist.

### Patch — what can change safely?

The Target-Site Transformation Engine turns deterministic mechanical or grounded work into digest-gated, path-allowlisted changes and reviewable production pull requests. Policy, editorial truth, authenticated owner settings and runtime/security decisions stay gated.

### Proof — did the implementation pass?

Build/test results, ARWP re-audits, transformation digests, evidence receipts, runtime checks and owner-side visibility/referral evidence remain connected to the exact change that produced them.

A successful build proves implementation, not ranking or citation impact.

### Watch — what needs attention now?

Portfolio mode should continuously connect new upstream changes and site drift to affected websites and files.

Example:

> Google changes a rule. Which 12 sites, 27 recommendations and 8 repository paths now need review?

That reverse impact analysis is the intended high-leverage commercial layer.

## What is genuinely different

By 2026, strong AI-search products already offer prompt monitoring, mentions, citations, share of voice, sentiment, competitor analysis, recommendations and increasingly content/action automation. Other products specialize in agent-ready content delivery, crawler enforcement or technical readiness scoring.

SignalBraid should therefore compete on a different chain:

> **source-backed rule supply chain → site-specific applicability → canonical source-file resolution → safe reversible change → verification → outcome evidence → reverse impact when the rule changes again**

That distinction matters because it keeps the product useful even if visibility dashboards and content-generation features become commodity.

## Core capabilities today

- **Search + AI visibility audit** — crawlability, indexability, citation surfaces, freshness, identity, structured data, crawler policy and owner-measurement gates.
- **Versioned best-practice intelligence** — sources, applicability, review dates and stale-knowledge gates.
- **Adaptive Site Upgrade Engine** — exact change surfaces, recipes, dependencies, verification contracts and measurement signals.
- **Target-Site Transformation Engine** — digest-gated, path-allowlisted deterministic mutations and PR-first production delivery.
- **Dataset publication + DOI readiness** — only for genuine reusable corpora, with provenance, versioning, checksums and external PID workflow.
- **Agentic web interoperability** — API, MCP, A2A, WebMCP, Agent Skills, ARD and ordinary web discovery remain part of the technical foundation.
- **Evidence + drift** — implementation snapshots, negative results, source history and owner-side outcome evidence stay separate and inspectable.

## Installed workflow

```bash
# What does this site need now?
arwp-growth https://example.com --vertical=documentation --upgrade

# Compile the target-specific plan.
arwp-upgrade site https://example.com --vertical=documentation --output=upgrade.json

# After exact repository files and grounded facts are resolved:
arwp-transform compile upgrade.json target-transform-spec.json --output=transform.json
arwp-transform simulate transform.json
```

A production transform can be delivered through a new GitHub branch and pull request after explicit authorization and base/file digest verification. ARWP does not expose a direct-main transformation mode.

## Product packaging direction

### Open core

Single-site Radar / Map / Plan / Patch / Proof primitives, open schemas, CLI, transformation engine and Agent Skills.

### Hosted / Pro

Managed intelligence freshness, SignalBraid Watch, portfolio impact analysis, scheduled re-audits, owner-data connectors, verified stack transformation packs and managed PR delivery.

### Team / Enterprise

Private rule packs, organization policy-as-code, automation governance, approval gates, audit history and portfolio-level crawler/content-use policy.

The paid value should be **maintenance, automation, governance, evidence and scale** — not a promise to rank or be cited.

## Product boundary

SignalBraid · ARWP keeps four things distinct:

1. **upstream knowledge** — what current platforms/specifications actually say;
2. **applicability** — whether a mechanism is relevant to this site;
3. **implementation evidence** — whether the technical change is really present and correct;
4. **outcome evidence** — what Search, AI citation, referral or agent metrics did afterward.

A technically correct change can produce neutral or negative external outcomes. The system keeps that evidence instead of converting it into a vanity readiness score.

## Brand relationship

- **SignalBraid** — product brand and human-facing metaphor.
- **ARWP** — technical project identity and suffix in the canonical lockup.
- **Agent-Ready Web Profile** — repository, package and interoperability foundation.

Canonical presentation: **SignalBraid · ARWP**.

## Key product docs

- `docs/PRODUCT-LINE.md` — market boundary, packaging and product bets.
- `docs/BRAIDGRAPH.md` — evidence-to-change graph design.
- `docs/ADAPTIVE-SITE-UPGRADE.md` — target-specific planning engine.
- `docs/TARGET-SITE-TRANSFORMATION.md` — safe repository transformation engine.

## Availability

- GitHub: https://github.com/dkharlanau/agent-ready-web-profile
- npm: https://www.npmjs.com/package/agent-ready-web-profile
- License: Apache-2.0
- Current open-source price: 0

## Structured-data boundary

ARWP uses SoftwareApplication semantics. Google SoftwareApplication rich-result eligibility also requires a genuine rating or review; the project does not fabricate either.
