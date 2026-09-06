# ARWP Growth Profile

Status: experimental product layer on `main` · reviewed 2026-09-06

The **ARWP Growth Profile** turns source-backed Search, generative-search, citation and agent-web guidance into a prioritized improvement plan for a public website.

It is deliberately separate from the core ARWP interoperability profile and Resolver:

- the core profile describes what a site exposes;
- the Resolver discovers and selects interfaces;
- the Recommendations Registry records upstream requirements/opportunities;
- the Growth Profile converts that evidence into a practical implementation backlog.

The Growth Profile does **not** output a universal quality/readiness score and does not promise ranking, AI citation, recommendation, traffic or conversion outcomes.

## Run it

```bash
node bin/arwp-growth.mjs https://example.com
node bin/arwp-growth.mjs https://example.com --json
node bin/arwp-growth.mjs https://example.com --output=arwp-growth.json
```

The planner reuses the existing Search + Agent audit and adds 2026-specific growth checks around:

- technical Search / AI-search eligibility;
- original non-commodity content review;
- author / Organization / Person identity;
- visible and structured publication dates;
- stable deep-linkable sections;
- Google Preferred Sources;
- OAI-SearchBot versus GPTBot policy separation;
- Cloudflare Content Signals and `use=reference` as provider-specific policy syntax;
- Google Generative AI performance reporting;
- Bing AI Performance citations and grounding queries;
- Search Console platform properties for Instagram, TikTok, X and YouTube;
- relevant original images/video;
- FAQ rich-result deprecation awareness;
- site reputation abuse guardrails;
- agent interoperability surfaces without pretending they are Google ranking factors.

## Priority model

The output is a backlog, not a score.

- `P0`: observable blockers to a targeted eligibility goal.
- `P1`: high-value Search, AI-access, content-quality, identity, freshness or governance work.
- `P2`: optional acquisition, measurement and multi-format opportunities.
- `P3`: lower-priority experiments where applicable.

Experimental/upstream-incubation mechanisms must not outrank known Search eligibility problems merely because they are newer.

## Drop-in GitHub Actions loop

Copy `templates/growth/github-action.yml` into a website repository as `.github/workflows/arwp-growth.yml`, change `ARWP_TARGET`, and run it.

The template:

1. downloads the current ARWP repository;
2. installs pinned dependencies from `package-lock.json`;
3. evaluates the configured public site;
4. emits `arwp-growth.json`;
5. stores the report as a GitHub Actions artifact.

This creates a simple recurring improvement loop without granting ARWP write access to the target website repository.

## Templates shipped with the profile

### AI search open / training closed robots policy

`templates/growth/robots.ai-search-open-training-closed.txt`

This example separates:

- search indexing: allowed;
- real-time AI answer input: allowed where Content Signals are supported;
- model training: disallowed;
- reusable content level: `reference`;
- OAI-SearchBot: allowed;
- GPTBot: disallowed.

The Cloudflare `Content-Signal` syntax is provider-specific. It is not a Google ranking directive or a universal web standard. The publisher must choose policy based on its own distribution/legal intent.

### Organization identity

`templates/growth/organization.jsonld`

Use accurate values only. Keep the same canonical identity across home/About pages, structured data, author profiles and relevant external profiles.

### Article authorship/freshness

`templates/growth/article.jsonld`

Use when Article/NewsArticle/BlogPosting structured data is appropriate. `dateModified` should represent a real significant update, not synthetic freshness.

### Preferred Sources

`templates/growth/preferred-source.html`

This provides a simple link to Google's Preferred Sources preference flow. It helps only users who explicitly select the domain/subdomain and is not a general ranking guarantee.

### Non-commodity content review

`templates/growth/content-quality-checklist.md`

This manual contract captures the part an HTTP scanner cannot honestly score: first-hand knowledge, original evidence, authorship, methodology, useful visuals, topical purpose and editorial governance.

## Fresh 2026 signals included

The current profile includes primary-source changes reviewed on 2026-09-06, including:

- Google Generative AI Search guidance emphasizing unique, expert-led, non-commodity content and explicitly rejecting AI-only markup/chunking cargo cults;
- worldwide rollout of Google Search Console Generative AI performance insights as of 2026-08-31;
- Google Preferred Sources availability in AI Mode / AI Overviews where supported;
- Google Search Console platform properties for Instagram, TikTok, X and YouTube;
- Google's April 2026 Read more deep-link guidance;
- Google FAQ rich-result deprecation in May 2026;
- Google's August 2026 site reputation policy update;
- OpenAI's current OAI-SearchBot publisher guidance;
- Bing Webmaster Tools AI Performance;
- Cloudflare's Search / Agent / Training crawler separation and Content Signals;
- Cloudflare Browser Run enforcement of the newer `use` Content Signals directive as of 2026-08-31.

## Evidence boundary

A `pass`, `warning`, template or recommendation means ARWP observed a condition and mapped it to reviewed upstream guidance. It never means that Google, Bing, OpenAI or another system has endorsed the site or will rank/cite/recommend it.

The correct success loop is:

`observe → prioritize → implement → verify → measure owner-side Search/AI visibility → preserve evidence → revise`
