# ARWP Site Readiness Gate

Use this before a Search/AI acquisition experiment and again at review time. This is a **non-composite gate**, not a score. Record each item as `pass`, `fail`, `manual-pass`, `manual-fail`, `owner-data`, `not-applicable` or `watch`. Missing owner data stays unknown; it is never converted to zero.

A site is not ready to interpret an acquisition experiment while a relevant P0 blocker is unresolved. It can still implement fixes and collect a new baseline.

## 0. Site boundary and target outcome
- [ ] One sentence states what the site is for, who it serves and the primary task it helps complete.
- [ ] One sentence states what the site intentionally does **not** cover.
- [ ] Priority page cohort is named rather than treating every URL as equally important.
- [ ] Target discovery surfaces are explicit: classic Search, Google generative Search, Bing AI, referrals, Discover, images/video or agent retrieval.
- [ ] One real downstream outcome is defined: signup, contact, download, tool use, completed exercise, qualified visit or another task-specific result.

## 1. P0 eligibility and canonical truth
- [ ] Priority pages return the intended successful HTTP status.
- [ ] Intended search/answer crawlers are not accidentally blocked.
- [ ] Training/model crawler policy is reviewed separately from search/answer retrieval policy where the provider exposes separate controls.
- [ ] No unintended `noindex`, `nosnippet` or equivalent blocker exists.
- [ ] Canonical URL, indexability and sitemap inclusion agree for priority pages.
- [ ] Sitemap is reachable and `lastmod` reflects significant changes rather than build time alone.
- [ ] Redirects, locale alternates and duplicate variants do not create competing canonical identities.

## 2. Page value and citability
- [ ] The first useful paragraph answers the page's main question or states its main value.
- [ ] Priority pages contribute original evidence, data, experience, analysis, calculation, curation or an executable utility.
- [ ] Important factual claims have inspectable evidence or an explicit evidence boundary.
- [ ] Important sections have stable headings/anchors and can be linked directly.
- [ ] Page title/H1/visible content describe the same topic and intent.
- [ ] Authorship, review date, provenance and corrections state are accurate where readers need them.
- [ ] A direct landing visitor can complete a useful task without first understanding the site's internal taxonomy.

## 3. Entity, dataset and representation integrity
- [ ] Canonical entities have stable identities and are reused consistently across pages/JSON-LD/data exports.
- [ ] Structured data is grounded in visible public facts; no authors, dates, ratings, prices, reviews or provenance are invented.
- [ ] Dataset/CSV/JSON/JSON-LD companions describe real reusable data and do not contradict canonical HTML.
- [ ] Visible relationships are semantically real and useful to a person, not keyword adjacency generated for linking volume.
- [ ] Generated pages have a page-value gate: real demand, unique value, standalone usefulness and canonical identity.
- [ ] Filter/search/query variants do not expand into uncontrolled indexable near-duplicates.

## 4. AI access and agent usability
- [ ] Search/answer retrieval and model-training policy are deliberate rather than inferred from one generic “AI bot” rule.
- [ ] `llms.txt`, ARWP, Agent Skills, API/MCP/A2A/WebMCP/ARD surfaces exist only where they expose a real capability or useful corpus.
- [ ] Runtime capabilities have runtime evidence; static metadata alone is not marked conformant.
- [ ] Primary tasks work with semantic HTML, accessible names and ordinary links/buttons before agent-specific metadata is added.
- [ ] Dynamic controls expose meaningful accessibility/ARIA semantics where an agent or assistive technology needs them.
- [ ] Machine-readable facts have canonical human-readable sources and reuse/licensing boundaries where relevant.

## 5. Measurement baseline
- [ ] Baseline start/end dates and the implementation/change timestamp are recorded.
- [ ] Google generative Search evidence is captured from the dedicated report where available; ordinary Search impressions are not relabeled as AI impressions.
- [ ] Bing AI citations, cited pages and grounding-query samples are captured where available.
- [ ] AI referral traffic is captured with source/referrer/UTM evidence where available.
- [ ] Cloudflare AI Crawl Control or equivalent edge/server evidence is captured where available: requests, allowed/blocked state, response success and useful path/content-format breakdowns.
- [ ] First-party task completion/conversion for AI-referred visits is captured when the product can measure it.
- [ ] Missing provider evidence is recorded as unavailable/partial, never `0` by assumption.
- [ ] The stage-separated view `access → exposure → citation → visit → task` can be reproduced from stored evidence.

## 6. Measurement integrity
- [ ] Ratios use one provider and one compatible population/window unless a join key makes the relationship explicit.
- [ ] No “Bing citations / Google AI impressions” or similar cross-provider conversion rate is reported.
- [ ] No single synthetic “AI visibility score” is used as the system of record.
- [ ] Before/after windows are non-overlapping and comparable; seasonality, launches and major unrelated changes are noted.
- [ ] Provider exports and evidence locations are preserved so observations can be replayed.
- [ ] Page/query dimensions are retained privately when needed for cohort analysis rather than discarded into site-wide totals.

## 7. Experiment design
- [ ] Selected hypothesis IDs and exact implementation actions are recorded before outcome review.
- [ ] Treatment cohort is explicit. For large data sites, prefer a bounded priority cohort before scaling.
- [ ] Comparable unchanged pages are retained as a control where practical; otherwise preserve a dated pre-change baseline.
- [ ] One intervention family is tested at a time when practical: value/evidence, internal relations, representation parity, snippet/preview policy, crawl/index control, etc.
- [ ] Success signals, guardrails and stop conditions are defined before measurement.
- [ ] Observation window is long enough for the provider/site to produce meaningful data; early absence is not automatically failure.

## 8. Data-site / large knowledge-site specialization
- [ ] Priority entity pages pass demand + unique-value + standalone-usefulness + canonical-identity gates.
- [ ] Deep pages are reachable through useful crawlable relationships from collections/hubs.
- [ ] Deep-page contribution is measured separately by surface: Search/generative impressions, citations, AI referrals and task outcomes.
- [ ] Crawl/index growth is compared with useful discovery growth; raw page count is never the success metric.
- [ ] Thin or duplicate cohorts can be excluded, consolidated or retired without breaking canonical data identity.
- [ ] Relationship graphs exposed to machines correspond to relationships users can understand or verify.

## 9. Review decision
- [ ] Implementation checks are complete and separated from outcome evidence.
- [ ] External/manual checks remain explicitly external/manual.
- [ ] Result is marked `keep`, `revise`, `revert`, `retire` or `continue-measuring`.
- [ ] Neutral and negative evidence is preserved.
- [ ] New learning is routed back to the hypothesis/pattern registry rather than becoming an undocumented “SEO rule”.

Passing this gate does not guarantee crawling, indexing, ranking, recommendations, AI citations, traffic or conversion. It establishes that the site and experiment are sufficiently well-defined to interpret the next observation.
