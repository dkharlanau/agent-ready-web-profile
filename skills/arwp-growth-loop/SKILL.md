---
name: arwp-growth-loop
description: Run an evidence-backed website growth loop for Search, Google Discover and recommendations, generative Search, Bing AI citations, ChatGPT Search and agent readability. Use when asked to make a site rank or discover better, get into recommendations, improve AI-search visibility, apply current ARWP guidance, or continuously improve a website repository. Research current primary-source guidance, select explicit hypotheses, inspect and edit the repository, verify checks, measure owner-side outcomes where available, and preserve negative results.
license: Apache-2.0
compatibility: Requires a website repository/filesystem. Node.js is recommended for ARWP CLI checks. Network access is useful for current primary-source research and live audits.
metadata:
  standard: agent-skills
  arwp-role: growth-orchestrator
---

# ARWP Growth Loop

Use this skill when the outcome is not merely “make the site agent-ready” but “improve the site's chances of being discovered, selected, cited or recommended while keeping the work evidence-backed and measurable.”

## Product loop

`research → classify → baseline → hypothesis → implement → verify → measure → keep/revert/revise`

Do not collapse this into a generic SEO checklist.

## Workflow

1. **Research before adding a tactic.** Start with:

```bash
node bin/arwp-trends.mjs list --since=90 --exclude-retired
node bin/arwp-hypotheses.mjs list --vertical=general
```

When network access exists, review current primary sources for the target surfaces. Prefer official platform documentation and specifications. Classify a mechanism as platform requirement, platform guidance, platform feature, platform measurement, or project experiment. Newness alone is not evidence.

2. **Establish the site baseline.** Inspect framework, deployment, public root, routes, content architecture, metadata, sitemap/robots, structured data, images/video, crawler policy, existing agent surfaces and owner-side metrics where available. Then run:

```bash
node bin/arwp-growth.mjs https://example.com --vertical=<vertical> --json
```

Do not infer Google/Bing/ChatGPT visibility from repository metadata.

3. **Select hypotheses, not cargo cult.** Choose the smallest applicable hypothesis set that has a clear implementation change, checkable completion condition and observable success signal. Platform requirements and high-confidence guidance come before optional features or experiments.

4. **Implement highest-confidence changes.** Typical order:
   - Search/AI/Discover eligibility blockers;
   - canonical URLs, sitemap and meaningful freshness;
   - non-commodity content and original evidence;
   - resolvable identity, authorship and provenance;
   - deep-linkable sections and internal links;
   - relevant large images/video when a target surface benefits;
   - Preferred Sources or other bounded acquisition features when applicable;
   - crawler/freshness mechanisms that match publisher policy;
   - agent interoperability only for real agent use cases.

5. **Verify.** Run the site's own build/tests/lint and relevant ARWP checks. For each selected hypothesis, distinguish `pass`, `fail`, `manual-pass`, `manual-fail`, `external-owner-data`, `not-applicable` and `watch`. Never call a manual or owner-data check automated.

6. **Measure.** Where owner data exists, compare the relevant Google Search/generative/Discover signals, Bing AI citations and grounding-query samples, ChatGPT referral traffic/citations, image/video discovery, conversions and agent task completion. Choose a sensible before/after window. Do not automatically attribute movement to ARWP.

7. **Keep, revise, revert or retire.** Preserve negative results. Keep a correct change when evidence is neutral/positive, revise a weak implementation or measurement design, revert harmful changes, and retire a hypothesis when upstream guidance or evidence invalidates it.

Use `templates/growth/growth-loop-checklist.md` and `templates/growth/hypothesis-ledger.md` when a durable review trail is useful.

## Core rule

ARWP never guarantees ranking, Discover placement, AI citation, recommendation traffic or conversion. The goal is faster adaptation, stronger implementation discipline and better evidence about what works for the actual site.
