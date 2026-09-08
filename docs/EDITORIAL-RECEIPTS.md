# Editorial evidence receipts

An editorial receipt connects a useful page, its factual claims and its sources. It is an ARWP authoring convention, not a search-engine format. Keep private experiment data outside public receipts.

```json
{
  "page_url": "https://example.com/guide/",
  "reviewed_at": "2026-09-08",
  "audience": "People maintaining a documentation site",
  "question": "Does an AI file replace crawlable documentation?",
  "direct_answer": "Keep important documentation available as crawlable text.",
  "original_contribution": "A worked HTML and evidence-link example",
  "useful_action": "Inspect one generated page",
  "sources": [{
    "id": "google-ai",
    "url": "https://developers.google.com/search/docs/appearance/ai-features",
    "checked_at": "2026-09-08",
    "support": "Technical requirements and SEO best practices: textual content, internal links and matching structured data."
  }],
  "claims": [{
    "id": "text-access",
    "text": "Google recommends making important content available in textual form.",
    "anchor": "text-access",
    "evidence_level": "documented",
    "source_ids": ["google-ai"]
  }]
}
```

Run `arwp editorial-check receipt.json --json`. The command rejects broken source references, duplicate identifiers and missing comparison methodology. It cannot decide whether a source entails a claim, whether a link is live or whether the content appears on the page. Review those explicitly.

For a comparison, add `comparison` with `criteria` (string array), `methodology`, `as_of` (date) and at least two `products`. Each product requires `name`, `best_for`, `limitation` and `source_ids`. An author-written comparison is not an independent review; disclose that relationship visibly. Prices, feature availability and eligibility need a current check.

Use visible source links, with optional internal annotations:

```html
<p id="text-access" data-claim-id="text-access" data-evidence="documented">
  Make important content available as text.
  <a href="#source-google-ai" aria-label="Source: Google Search Central">[1]</a>
</p>
<ol aria-label="Sources">
  <li id="source-google-ai"><a href="https://developers.google.com/search/docs/appearance/ai-features">Google Search Central: AI features and your website</a></li>
</ol>
```

These `data-*` attributes help a local review tool trace a claim. They do not ask agents to recommend a site and are not a documented Google ranking mechanism. A footnote should remain usable when JavaScript is disabled.
