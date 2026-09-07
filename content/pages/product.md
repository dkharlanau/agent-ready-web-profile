# SignalBraid · ARWP

**Weave the signals. Ship the change.**

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/product/

SignalBraid · ARWP is the product-facing identity for the open-source adaptive website improvement system built by Agent-Ready Web Profile (ARWP).

It is designed to go beyond a static SEO/GEO score. The system maintains dated best-practice intelligence, determines which mechanisms actually apply to a target site, braids current Search, AI, agent-web and repository evidence into a concrete upgrade graph, resolves safe changes to exact repository files, verifies the resulting implementation and keeps outcome measurement separate from implementation claims.

> **Detect. Braid. Change. Prove.**

```text
SEARCH SIGNALS ─────╮
AI SIGNALS ─────────┼──► BRAID ► EXACT CHANGE ► VERIFY ► MEASURE
AGENT SIGNALS ──────┤
TARGET-SITE EVIDENCE╯
```

## Core capabilities

- **Search + AI visibility audit** — crawlability, indexability, citation surfaces, freshness, identity, structured data, crawler policy and owner-measurement gates.
- **Versioned best-practice intelligence** — recommendations carry sources, applicability, review dates and stale-knowledge gates rather than living forever as an undated checklist.
- **Adaptive Site Upgrade Engine** — translates observed target-site debt into exact change surfaces, recipes, dependencies, verification contracts and measurement signals.
- **Target-Site Transformation Engine** — promotes only deterministic mechanical or explicitly grounded changes into digest-gated, path-allowlisted repository mutations. Production delivery is new-branch/PR first; policy, editorial, owner-platform and runtime decisions remain gated.
- **Dataset publication + DOI readiness** — detects genuine reusable corpora and prepares versioned, reproducible dataset releases with metadata, provenance, distributions, checksums and external persistent-identifier workflow.
- **Growth hypotheses + experiments** — connects implementation to explicit hypotheses and before/after evidence without claiming ranking causality.
- **Agentic web interface discovery + resolution** — normalizes heterogeneous API, MCP, A2A, WebMCP, Agent Skills, ARD and ordinary web discovery surfaces.
- **Evidence + drift** — preserves implementation snapshots, verification evidence, negative results and changes in upstream guidance.

## Installed workflow

```bash
# What does this site need now?
arwp-growth https://example.com --vertical=documentation --upgrade

# Inspect / compile the target-specific upgrade graph.
arwp-upgrade site https://example.com --vertical=documentation --output=upgrade.json

# After exact repository files and grounded facts are resolved:
arwp-transform compile upgrade.json target-transform-spec.json --output=transform.json
arwp-transform simulate transform.json
```

A production transform can be delivered through a new GitHub branch and pull request after explicit authorization and base/file digest verification. ARWP does not expose a direct-main transformation mode.

## Product boundary

SignalBraid · ARWP distinguishes four things that many audit products collapse together:

1. **upstream knowledge** — what current platforms/specifications actually say;
2. **applicability** — whether the mechanism is relevant to this target site;
3. **implementation evidence** — whether the technical change is really present and correct;
4. **outcome evidence** — what Search, AI citation, referral or agent metrics did afterward.

A technically correct change can produce neutral or negative external outcomes. The system keeps that evidence instead of converting it into a vanity readiness score.

## Brand relationship

- **SignalBraid** — product brand and human-facing metaphor.
- **ARWP** — technical project identity and the suffix in the canonical lockup.
- **Agent-Ready Web Profile** — repository, package and interoperability foundation.

Canonical presentation: **SignalBraid · ARWP**.

## Availability

- GitHub: https://github.com/dkharlanau/agent-ready-web-profile
- npm: https://www.npmjs.com/package/agent-ready-web-profile
- License: Apache-2.0
- Current open-source price: 0

The architecture also leaves a clean future boundary for hosted continuous monitoring, managed target-site transformations, private owner-data connectors, team governance and longitudinal portfolio intelligence without making those paid capabilities prerequisites for the open-source core.

## Structured-data boundary

ARWP uses SoftwareApplication semantics. Google SoftwareApplication rich-result eligibility also requires a genuine rating or review; the project does not fabricate either.
