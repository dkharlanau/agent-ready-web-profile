---
name: arwp-ai-search-content
description: Improve website content for search, AI search, citation, and recommendation surfaces without AI-generated filler. Use when asked to optimize articles, docs, landing pages, comparisons, answer pages, or knowledge content for Google Search, AI Overviews/AI Mode, ChatGPT Search, Bing/Copilot citations, or ARWP content quality. Preserve human usefulness, evidence, originality, and clear entity/topic structure.
license: PolyForm-Strict-1.0.0
metadata:
  compatibility: Works on Markdown, HTML, MDX, CMS-exported content, documentation sites, and static/generated pages.
  standard: agent-skills
  arwp-role: content-quality
---

# ARWP AI Search Content

Use this skill to improve content quality for humans first, while making the content easier for search and AI systems to retrieve, understand, cite, compare and route.

## Core rule

Do not rewrite content into generic "AI SEO" prose. Google explicitly emphasizes useful, original, non-commodity content rather than special AI-only markup. Treat special AI files as supporting surfaces, not ranking shortcuts.

Before editing, use `docs/ANTI-PATTERNS.md` and `knowledge/research/anti-patterns.json` to review applicable negative examples. Record context and false-positive boundaries using `templates/growth/anti-pattern-review.md`; automated text matches cannot prove low quality.

## Workflow

1. Identify the page's real job.
   - What user problem does it solve?
   - What query/task should it satisfy?
   - What makes this page non-commodity: first-hand experience, data, benchmark, implementation detail, decision framework, original example, product evidence, or expert synthesis?
   - If nothing is distinctive, add evidence/value before adding more words.

2. Make the answer retrievable.
   - Put a direct answer near its relevant question when that serves the reader; keep meaningful narrative context. Do not enforce a chunk size, word count or FAQ quota.
   - Use descriptive H2/H3 sections with stable IDs where the framework supports them.
   - Keep important facts in visible page content.
   - Use tables only when they genuinely clarify comparisons or dense data.
   - Add lists/process steps only where the information is procedural.

3. Strengthen evidence and provenance.
   - Cite primary sources for changing technical/platform claims.
   - Add publication/update dates where meaningful.
   - Identify author/organization when useful for accountability.
   - Link benchmarks, datasets, receipts, changelogs or source repositories when claims depend on them.
   - Distinguish measured facts, interpretation and prediction.

4. Build entity clarity.
   - Use the canonical product/project/person/organization name consistently.
   - State what the entity is and what category it belongs to in normal prose.
   - Link to canonical About/Product/Comparison pages.
   - Add appropriate Schema.org JSON-LD when the page maps cleanly to a supported type; do not invent types or stuff keywords.

5. Build citation-worthy page types when relevant.
   - direct answer / concept page;
   - comparison vs named alternatives;
   - methodology / benchmark page;
   - changelog / history page;
   - implementation guide;
   - original dataset/research release;
   - FAQ only when real recurring questions exist, not as schema bait.

6. Improve information architecture.
   - Link detail pages back to a hub.
   - Link related concepts and comparisons contextually.
   - Avoid near-duplicate pages targeting trivial keyword variants.
   - Preserve canonical URLs and meaningful fragment anchors.

7. Create machine-readable companions only when useful.
   - JSON dataset for research/table content;
   - CSV for tabular releases;
   - citation index for canonical claims/answers;
   - `llms.txt` or `sitemap.md` for navigation summaries;
   - JSON-LD for entities/pages.

8. Quality gate before completion.
   Reject or rewrite:
   - vague intros and generic conclusions;
   - invented statistics;
   - unsourced current claims;
   - excessive rhetorical questions;
   - repetitive "in today's rapidly evolving" style filler;
   - hidden important content;
   - keyword stuffing;
   - `meta keywords`;
   - claims that ARWP/llms.txt/schema guarantee ranking or AI citation.

## Completion standard

A good ARWP content change should leave the page more useful even if no AI system ever reads it. It should also make the page's answer, entity, evidence, date, source relationships and canonical location easier for machines to identify.

## Worked article and comparison evidence

Use [the practice library](../../docs/DISCOVERABILITY-PLAYBOOK.md) for decision-oriented article shapes, cell-level comparison sources and visible footnotes. The [editorial receipt contract](../../docs/EDITORIAL-RECEIPTS.md) records the question, original contribution, useful action and source support; run `arwp editorial-check receipt.json` to detect broken references. This local convention cannot establish source entailment, actual rendered content or ranking benefit. Inspect those separately. The [article](../../docs/examples/editorial/article.html) and [comparison](../../docs/examples/editorial/comparison.html) are explicitly noindex fixtures with reserved example identities; adapt only verified facts.

## Research edition 1.0.0 (8 September 2026)

When choosing voice, titles, openings or passage-level markup, read [the editorial field guide](../../docs/EDITORIAL-SEARCH-LAB.md) and use [the research brief](../../templates/growth/editorial-research-brief.md). Select the format from the reader task and real evidence; keep first-person experience, sourced facts and interpretation distinguishable. Test one question where the recommendation should reverse before scaling a format.

Keep provider scope explicit: Google's current guide rejects mandatory chunking and AI-only writing; Microsoft clarity suggestions do not become universal punctuation or length checks. Selective section graphs and Web Annotation are optional consumer-specific semantics. Check speakable's actual feature scope; it is not a generic citation instruction.

For measurement, inspect effective Search generative AI property inclusion with owner access and preserve inheritance. Dedicated AI impressions overlap overall Search reporting. Missing reports remain unavailable, and citation frequency does not establish recommendation correctness. Recheck the guide's primary sources when applying these temporally changing controls.
