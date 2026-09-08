---
name: arwp-discoverability
description: Select concrete implementation practices from the ARWP discoverability corpus and validate editorial evidence receipts for articles and comparisons. Use as a specialist within arwp-growth-loop after the site problem and measurement scope are known.
license: Apache-2.0
compatibility: Node.js >=20 for local corpus and receipt validation.
metadata:
  standard: agent-skills
  arwp-role: discoverability-practices
---

# ARWP discoverability

Use this repository's [corpus](../../knowledge/discoverability-corpus.json) and [playbook](../../DISCOVERABILITY-PLAYBOOK.md) to turn a site's real value into content people can find, evaluate and use. The ARWP manifest describes interfaces; it does not confer ranking or AI recommendation priority.

## Workflow

Start with `arwp-growth-loop`; it remains the default orchestrator. This specialist supplies implementation choices, not a second policy or outcome system. Follow each practice's `growth_hypothesis_ids` and `recommendation_rule_ids` into the current native registries; mappings are routing context, not an endorsement. Carry selected site actions through the existing adoption record, Growth experiment and change receipt. Use BraidGraph for shared provenance; do not mint a disconnected graph.

### Choose work from evidence

Inspect repository instructions, dirty state, the canonical hostname/path and the authoritative build output. Read the site's actual offer, content and measurement scope. Prefer fixing lost access or an existing useful landing page before adding another page. Preserve edits owned by other work.

Search the corpus with `node bin/arwp.mjs discoverability --search="comparison" --json` from the ARWP checkout (or `arwp` from an installed package). Read the implementation, verification, source notes and evidence level for the few matching tactics. `documented` means the linked guidance supports the practice; it does not establish a ranking effect. Recheck sources when advice, feature eligibility or prices may have changed.

Create a local adoption config containing `site_url`, `audience`, `useful_action`, explicit `tactic_ids` and optional `page_urls`. Run `arwp adoption-plan <config.json> --output=<new-plan.json>`. This produces a planned experiment, never an implementation or outcome receipt.

## Implement a useful page

Start from a real question and a defensible direct answer. Add original evidence: an executable example, worked analysis, first-hand result, reusable dataset or clearly labeled demonstration. Choose structure for the question; do not fill a generic article template merely to increase coverage.

For comparisons, define audience and criteria first. Verify each product against current primary sources, disclose the publisher's interest and the observation date, explain where the alternative is a better fit, and keep unsupported cells unknown. Do not manufacture testimonials, customers, credentials, independent adoption or benchmark wins.

Use ordinary semantic HTML, stable headings, tables with headers and visible source links. Inline `data-*` evidence attributes are an optional project convention. They are not a search-engine instruction or ranking signal. Schema.org markup must describe the visible page and supported entity relationships. Keep the HTML, graph and profile consistent.

For substantive factual content, record an editorial receipt and run `arwp editorial-check <receipt.json>`. Read [the receipt contract](../../EDITORIAL-RECEIPTS.md) when producing one. A passing receipt checks consistency; inspect actual source support and the rendered page separately.

## Close the loop

Validate the actual generated output and the user journey. Apply changes within the user's existing authorization. Record local validation, commit, release and verified live exposure as separate states; a generated manifest is not live adoption.

Freeze the page/query cohort and useful-action definition before observing results. Keep technical checks, search impressions/clicks, AI citations/recommendations and product actions separate. Use comparable complete windows; represent missing access and unmeasured outcomes explicitly. AI checks need exact prompts, model/surface, date, locale, citations and raw answer evidence; a brand-seeded prompt is not an unprompted recommendation. See [measurement protocol](../../DISCOVERABILITY-BENCHMARKS.md).

Continue with the highest-value unblocked change, document regressions and null results, and revise a hypothesis when evidence contradicts it. Do not rewrite the same page repeatedly before a meaningful observation window exists.
