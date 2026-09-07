---
name: arwp-adaptive-upgrade
description: Convert an ARWP Growth audit into a target-specific website upgrade graph with current source-backed practices, applicability, exact change surfaces, implementation recipes, verification contracts, measurement signals and knowledge-freshness checks. Use when the goal is to inspect a real site and decide what should be added, changed or retired rather than only report an SEO/GEO score.
license: Apache-2.0
compatibility: Requires ARWP and a public website or captured Growth Plan. Repository access is recommended when implementation work follows the recommendation stage.
metadata:
  standard: agent-skills
  arwp-role: adaptive-upgrade-intelligence
---

# ARWP Adaptive Upgrade

Use this skill after or together with the Growth Loop when the user expects concrete changes to a target website.

## Goal

Translate current evidence into:

`site state → applicable practice → exact target → change recipe → verification → measurement → review`

Do not emit a generic 0–100 GEO score.

## Workflow

1. Identify the target site's real vertical(s) and goals. Do not classify a normal site as `research-dataset` unless a genuine reusable/distributable corpus exists.
2. Run or reuse the Growth Plan and vertical evidence.
3. Compile the Adaptive Upgrade Graph:

```bash
node bin/arwp-upgrade.mjs site https://example.com/ \
  --vertical=<vertical> \
  --goals=search,generative-search,ai-citations,measurement
```

or:

```bash
node bin/arwp-upgrade.mjs compile arwp-growth.json \
  --verticals=<verticals> \
  --goals=<goals> \
  --output=arwp-upgrade.json
```

4. Review `knowledgeState`. Any `review-due` pack must have its upstream primary source rechecked before implementation.
5. Work in dependency/priority waves. Fix P0 eligibility before optional acquisition or experimental agent surfaces.
6. Respect the automation class:
   - `mechanical`: deterministic change may be suitable for bounded automation after authorization;
   - `grounded-template`: fill only facts already verified in the target repository/site;
   - `policy-gated`: require publisher decision;
   - `editorial`: do not manufacture expertise, experience, claims or data;
   - `owner-platform`: require authenticated platform evidence;
   - `runtime`: require browser/task evaluation.
7. For repository implementation, record the exact files/surfaces changed and run the site's own tests/build plus the recommendation verification contract.
8. After verification, capture owner/runtime outcome evidence separately. Never treat a successful implementation check as proof of ranking or citation impact.
9. Keep/revise/revert/retire the recommendation and preserve negative results.

## Dataset activation

When a real corpus exists, activate `dataset-publication-pid` and prepare:

- canonical Dataset identity and landing page;
- methodology/provenance/limitations;
- license and version;
- frozen distributions and SHA-256 manifest;
- citation metadata;
- archival publication workflow;
- verified DOI only after the external record exists.

Never fabricate DOI, ORCID, SWHID, ROR or independent adoption evidence.

## Measurement feedback

Where authenticated data exists, use Google generative Search reports and Bing AI Performance as feedback inputs. Bing grounding queries, intents, topics and Citation Share can generate the next reviewed backlog, but must not become a thin query-page factory.

## Core rule

The output is an evidence-to-change graph for the actual site. It may tell an implementation agent what to add, remove or modify, but it does not authorize unsafe production mutation and does not promise Search or AI visibility outcomes.
