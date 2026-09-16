# Site Purpose & Mission Layer

ARWP must establish **why a site exists** before it optimizes how that site is discovered.

The canonical machine-readable practices live in [`registry/site-purpose-mission-practices.json`](../registry/site-purpose-mission-practices.json). The whole-site audit domain is `site-purpose-mission-alignment`, owned by the `site-purpose-mission` execution module in `registry/site-execution-manifest.json`.

This is a product/content/trust layer first. It can improve coherence across Search, structured data and agent-facing surfaces, but ARWP does **not** claim that adding a mission statement or footer sentence is itself a ranking factor.

## Why this is a top-level layer

A technically valid site can still be difficult to understand.

Common failure modes include:

- the homepage never states who the site helps or what outcome it creates;
- navigation accumulates unrelated pages because there is no scope boundary;
- SEO work creates query-led pages that fit keywords but not the product;
- a shared footer becomes a block of keyword boilerplate;
- homepage copy, About copy, structured data, RSS and agent summaries describe different products;
- old pages keep an obsolete positioning after the site changes direction;
- localizations translate phrases but drift from the actual mission.

ARWP therefore treats purpose as a required execution stage:

```text
inspect
  ↓
inventory
  ↓
purpose
  ↓
applicability
  ↓
execute / repair / verify
  ↓
Surface Integrity
  ↓
receipt
```

The purpose stage defines the contract. Later modules test and improve their own surfaces against that contract.

## Purpose contract

For a site-wide ARWP application, establish or explicitly mark unknown:

- `primaryAudience` — who should benefit;
- `userProblemOrNeed` — what problem, decision or need brings them here;
- `desiredOutcome` — what should be better after using the site;
- `mechanismOrApproach` — how the site creates that outcome;
- `distinctContribution` — what the site contributes beyond generic information;
- `scopeBoundaries` — what the site does not claim or try to cover;
- `supportingEvidence` — what in the actual product/content supports the promise;
- `primaryUserAction` — what useful next step the site wants to enable.

A compact drafting form is:

> `[Site] helps [primary audience] [desired outcome] through [mechanism or distinctive contribution].`

The sentence is not the whole contract. It is the shortest human-visible projection of it.

### Weak

> We empower better decisions with useful insights.

Almost any site could say this. It provides little control over content, navigation or claims.

### Stronger

> We help people recognize common cognitive biases and make clearer decisions through concise, sourced explanations and practical examples.

This names the audience broadly but defensibly, states the outcome, describes the mechanism and gives the site a boundary against unrelated content.

## Search-independence test

A useful purpose must survive this question:

> If organic Search traffic became zero tomorrow, would this site still have a coherent reason to exist?

If the answer is no, the statement is probably a traffic-acquisition description rather than a site purpose.

SEO can help the right audience discover a useful site. Search traffic must not become the site's reason for existing.

## Anti-purpose and scope boundaries

A strong mission also says what the site is **not**.

Examples:

- an educational cognitive-bias site is not a diagnosis or treatment service;
- a microphone test site can compare observed recordings without claiming one microphone is universally best;
- a research catalog can summarize evidence without presenting correlations as causal proof;
- an online service should not fabricate a physical local-business identity to target local queries.

This boundary protects content quality, structured data, claims and future roadmap decisions.

## Human-visible manifesto

The purpose cannot live only in an internal JSON file.

At minimum, the homepage or primary entry should make the audience, outcome and mechanism understandable in normal visible copy.

For a larger editorial, product, research, service or portfolio site, an About, Mission or Method page can expand on:

- why the site exists;
- how it works;
- evidence and methodology;
- limitations;
- publisher/operator identity;
- what the site deliberately does not do.

Do not create a thin `/mission/` page merely because ARWP has a mission layer. If the homepage already provides enough context, a separate page can be unnecessary.

The word **manifesto** here means human-readable purpose/operating intent. It is not `manifest.webmanifest` and must not be confused with a web app manifest.

## Footer contract

The shared footer should carry a compact purpose reminder on applicable public pages.

Example:

```html
<footer>
  <p class="site-mission">
    Example helps small teams make safer product decisions through concise,
    evidence-linked decision tools.
  </p>
  <a href="/about/">Why this site exists</a>
</footer>
```

Prefer:

- one useful sentence;
- natural language;
- a link to a deeper About/Mission/Method page only when that page is useful;
- wording consistent with the homepage and real product.

Avoid:

- lists of services, locations, synonyms or target queries;
- repeating the entire homepage pitch;
- copying the exact mission into every title, H1 and meta description;
- unsupported superlatives or outcome guarantees;
- hiding the purpose only in machine-readable metadata.

Because footer text is ordinary page content, review how it interacts with page-specific snippet sources. Do not apply `data-nosnippet` by default; first improve wording and placement. Snippet controls should reflect an actual publisher decision.

## SEO and Search alignment

The purpose layer should improve **semantic and product coherence**, not manufacture ranking signals.

Use the purpose as a constraint for:

- homepage title and meta description;
- site-name and publisher identity;
- homepage first useful content;
- information architecture and navigation;
- page portfolio decisions;
- internal links and continuation;
- social preview copy;
- structured-data descriptions;
- feed/channel descriptions;
- AI/agent-facing summaries;
- localized positioning.

Keep leaf pages specific to their own job. A page about one topic should have a descriptive page-specific title and description rather than repeating the site mission.

Do not:

- stuff the mission with keywords;
- expand it from a keyword list;
- repeat long boilerplate across every page;
- claim that a footer mission directly improves ranking;
- publish thin query variants because they appear to match the mission lexically.

Google's people-first guidance explicitly asks whether a site has an intended audience and a primary purpose or focus. Its Search guidance also treats SEO as useful when it supports people-first content rather than when content exists primarily to attract Search visits. ARWP follows that boundary.

## Generative AI Search

Do not create a separate artificial “AI mission.”

The human-visible purpose remains canonical. When AI/search-agent surfaces exist, they should provide a concise, truthful projection of the same product:

```text
human site purpose
        ↓
machine summary
        ↓
content/entity/feed/agent representations
```

Current Search guidance for generative experiences continues to build on foundational Search practices and useful, distinctive content. ARWP therefore uses the same purpose contract as the coherence boundary instead of inventing a second AI-only positioning.

## Structured data and entity parity

The purpose layer does not create a new Schema.org vocabulary.

When the site already uses relevant entities:

- `WebSite` describes the site;
- `Organization` or `Person` describes the real publisher/operator;
- stable `@id` values identify the same entity across pages;
- supported descriptive properties may summarize truthful facts;
- page-specific entity types continue to describe the actual page/content.

Do not invent fields such as:

```json
{
  "mission": "...",
  "purposeScore": 98,
  "seoMission": "..."
}
```

Do not turn aspirations into machine-readable capabilities.

The visible mission, `WebSite` description and publisher description should be compatible, but they do not need to be identical strings. Publisher identity and site user outcome are different concepts.

## Page-job alignment

Every important canonical page or route archetype should be able to answer:

```text
pageJob
targetUserNeed
purposeContribution
primaryAction
```

This creates a practical filter for content debt.

Flag a page when it:

- has no identifiable user job;
- exists mainly as a thin query variation;
- repeats another page's promise without independent value;
- falls outside the site's scope boundary;
- makes a broader claim than the site purpose supports;
- leads nowhere useful after the user consumes it.

The purpose layer therefore helps SEO partly by reducing incoherent inventory, not by increasing keyword density.

## Feeds, APIs and agent surfaces

When present, reconcile:

- RSS/Atom/JSON Feed channel descriptions;
- `llms.txt`;
- ARWP site/profile descriptions;
- public APIs and catalogs;
- Agent Skills;
- MCP/A2A/WebMCP/OpenAPI discovery;
- other machine-readable summaries.

These surfaces may be concise or task-specific, but they must not broaden the site mission, invent permissions, or promise functionality the visible product does not have.

## Localization

Translate the **meaning**, not a bag of keywords.

Each locale should preserve:

- target audience;
- user problem;
- promised outcome;
- scope and limitations;
- publisher identity;
- primary action.

Market-specific differences are allowed when they are real and intentionally documented.

## Purpose changes are migrations

A material change in site purpose is not a one-line copy edit.

Review the blast radius across:

- homepage;
- shared footer;
- About/Mission/Method;
- navigation and information architecture;
- homepage title/description;
- social previews;
- WebSite/publisher structured data;
- feeds;
- AI/agent-facing summaries;
- localized variants;
- existing content outside the new scope;
- CTAs;
- analytics and outcome definitions.

Old positioning that remains on one machine or human surface is drift.

## Audit evidence

For a site application, retain evidence such as:

```text
canonicalPurposeSource
purposeFields
visibleManifestoEvidence
footerEvidence
missionAboutEvidence
pageJobCoverage
searchSurfaceParity
structuredDataParity
feedAgentParity
localeParity
driftFindings
state
```

Use normal ARWP states:

- `pass`
- `fail`
- `warning`
- `stale`
- `missing`
- `incomplete`
- `intentionally-excepted`
- `not-applicable`
- `not-assessed`

If owner intent cannot be inferred safely, keep it unknown/incomplete rather than generating a persuasive mission from SEO data.

## Measurement boundary

Measure at least two categories separately:

1. **User/product outcome** — task completion, useful next action, engagement with the real product, subscription/download/use of the intended capability, or another purpose-derived outcome.
2. **Distribution outcome** — impressions, clicks, rankings, indexed pages, AI citations/referrals and other Search/AI visibility evidence.

A distribution gain does not prove that the site's mission is better fulfilled. A useful site can also exist with little or no Search traffic.

## Verification

Repository composition is protected by:

```bash
node scripts/site-execution-manifest-test.mjs
node scripts/agent-skills-test.mjs
```

The execution manifest test requires:

- a P0 `site-purpose-mission-alignment` audit domain;
- exactly one `site-purpose-mission` module owner;
- a required `purpose` stage before applicability/optimization;
- a canonical purpose-practices registry;
- footer, visible-manifesto, Search-alignment and entity-parity practices;
- anti-keyword-stuffing and no-direct-ranking-claim guardrails.

Repository tests validate the contract. They do not prove that a target site's mission is good, that visitors understand it, or that Search performance improved.

## Primary references

- Google Search Central, Creating helpful, reliable, people-first content: `https://developers.google.com/search/docs/fundamentals/creating-helpful-content`
- Google Search Central, AI optimization guide: `https://developers.google.com/search/docs/fundamentals/ai-optimization-guide`
- Google Search Central, Title links: `https://developers.google.com/search/docs/appearance/title-link`
- Google Search Central, Snippets: `https://developers.google.com/search/docs/appearance/snippet`
- Google Search Central, Organization structured data: `https://developers.google.com/search/docs/appearance/structured-data/organization`
- Schema.org `WebSite`: `https://schema.org/WebSite`
