# ARWP Site Rollout Playbook

Status: operational guidance on `main` · reviewed 2026-09-06

Use this playbook when applying Agent-Ready Web Profile Growth work to another website. The reusable product is the **decision and evidence loop**, not a bundle of metadata copied into every repository.

## Standard rollout output

Each site rollout should leave five durable things behind:

1. a site classification: canonical URL, repository, verticals, target surfaces and publisher access/reuse policy;
2. a baseline Growth audit plus the selected non-experimental hypothesis IDs;
3. safe repository changes that fit the site rather than generic SEO/GEO cargo cult;
4. verification inside the site's own build/CI plus a recurring ARWP Growth audit artifact;
5. an adoption record that identifies owner-side measurement gates and a keep / revise / revert / retire decision.

Start from `templates/growth/site-adoption-record.md`. Keep `templates/growth/growth-loop-checklist.md` as the human review contract.

## Decision order

### 0. Classify the site before changing it

Record:

- canonical public URL and source repository;
- verticals such as editorial, documentation, software-product, research-dataset or commerce;
- actual goals: classic Search, generative Search, Discover, images/video, AI citation, referrals, agent retrieval or product conversion;
- publisher crawler/training/reuse policy;
- owner-data sources already available.

Do not enable a provider feature merely because ARWP can detect it. Applicability comes first.

### 1. Fix eligibility and crawl foundations

Prioritize P0 blockers before optional optimizations:

- priority URLs return HTTP 200;
- intended Search crawlers are not accidentally blocked;
- no unintended `noindex`, `nosnippet` or restrictive preview directive exists;
- canonicals are stable and correct;
- sitemap is reachable;
- sitemap `lastmod` changes only after meaningful content changes.

Relevant hypothesis: `search-foundation-first`.

### 2. Improve content and retrieval quality

For priority pages, prefer material that adds something real:

- first-hand experience, original evidence, examples, data or non-obvious analysis;
- reliable/primary source support for material factual claims;
- descriptive headings that reflect questions, decisions or evidence;
- stable section IDs for long answers;
- internal links from hubs to the strongest answer/evidence pages;
- no thin query-variant page factory.

Relevant hypotheses: `non-commodity-evidence`, `answer-addressability`.

Manual editorial judgment stays manual. An HTTP scanner must not fabricate a content-quality score.

### 3. Make identity, authorship and freshness resolvable

Use one canonical Organization/Person identity across appropriate pages and structured data. For authored content, expose real authorship when readers would expect it. Use `datePublished` / `dateModified` only when those dates are true and meaningful.

Do not create synthetic authors or synthetic freshness.

Relevant hypotheses: `identity-and-provenance`, `freshness-without-fake-recency`.

### 4. Add recommendation and visual features only where they fit

For editorial/Discover-suitable priority content:

- use a relevant representative image, not a generic logo;
- follow the current platform large-image requirements for the target surface;
- allow large image previews when the publisher wants them;
- keep the preferred image consistent across visible content, Open Graph/social metadata and structured data where appropriate;
- measure Discover/image visibility instead of assuming the markup caused distribution.

For Google Preferred Sources, add a user-facing control only when the site plausibly has repeat readers. It is a user preference mechanism, not a general ranking switch.

Relevant hypotheses: `discover-visual-preview`, `preferred-source-loop`.

### 5. Keep Search/AI access separate from training and reuse policy

Crawler policy must reflect publisher intent, not ARWP's growth preference.

- Search/answer access and model-training access are separate controls where the provider exposes separate crawlers.
- For ChatGPT Search, check OAI-SearchBot independently from GPTBot.
- Do not silently change GPTBot, Claude, Perplexity or other training/reuse permissions during a Search optimization rollout.
- Keep robots policy, license and content-reuse terms conceptually separate.

Relevant hypothesis: `chatgpt-search-access`.

### 6. Publish agent surfaces only for real capabilities

`llms.txt`, ARWP profile, Agent Skills, ARD, OpenAPI, MCP, A2A or other agent-facing surfaces can reduce integration friction when they describe a real interface. They are not a substitute for ordinary web quality and must not be represented as Search ranking factors.

Relevant hypothesis: `agent-readable-routes` — project experiment, excluded from default ranking-oriented Growth planning.

### 7. Measure outcomes separately from implementation

Record a before/after window where owner data exists:

- Google Search / generative Search / Discover / image visibility;
- Bing AI citations, cited pages and grounding-query samples;
- ChatGPT/referral traffic and observable citations;
- site-specific product outcome such as conversion, task completion or return use.

Keep missing metrics missing; do not convert them to zero. Preserve neutral and negative movement.

Relevant hypothesis: `platform-ai-measurement`.

## Repository implementation pattern

A well-maintained site should normally have:

- its existing build/test gate as the first authority;
- ARWP technical/profile validation where applicable;
- a recurring `.github/workflows/arwp-growth.yml` based on `templates/growth/github-action.yml`;
- the exact ARWP revision stored with each generated Growth artifact when the recurring audit follows `main`;
- a site-specific adoption record under `growth/` or another documented governance path;
- regression checks for high-confidence changes introduced by the rollout.

The recurring audit may follow current ARWP `main` to surface fresh recommendations. Reproducible experiments and historical comparisons must record the exact ARWP commit used.

## Brali reference rollout

`Brali-LifeOS/brali-lifeos.github.io` is the first reference implementation of this playbook.

Baseline 2026-09-06:

- existing strengths: canonical/sitemap/freshness checks, deep-linkable long-form sections, evidence/provenance layers, representative 16:9 article imagery, Search Console pipeline, explicit OpenAI crawler blocks, agent/citation/trust surfaces;
- added Growth controls: `max-image-preview:large`, large social previews for representative article imagery, `Article.image`, `WebPage.primaryImageOfPage`, canonical homepage Organization identity, bounded Preferred Sources CTA, regression checks, current ARWP validator pin and weekly Growth artifact with exact ARWP revision;
- deliberately unchanged: GPTBot permission and public reuse rights. The rollout records those policies but does not choose them for the publisher;
- measurement: existing Google owner-side pipeline stays authoritative for Search visibility; AI/referral evidence is added only when observable.

See the site's `growth/arwp-adoption.md` for the concrete mapping.

## Completion rule

A rollout is complete for the current iteration when:

1. P0 eligibility blockers are resolved or explicitly documented;
2. selected hypothesis IDs and implementation checks are recorded;
3. the site's own build/tests pass;
4. ARWP checks/audit run successfully;
5. credential-dependent or longitudinal measurement is named as an external gate;
6. the decision is recorded as keep / revise / revert / retire.

Passing the rollout does not guarantee crawling, indexing, ranking, Discover placement, AI citation, recommendations, traffic or conversion.
