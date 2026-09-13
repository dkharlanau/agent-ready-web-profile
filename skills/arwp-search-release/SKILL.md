---
name: arwp-search-release
description: Run the final Search release interview for a public website, especially GitHub Pages portfolios. Use before or after deployment when title, site name, snippet, favicon, canonical host, sitemap, robots, internal discovery, localization, publishing source, structured data, freshness, machine-readable surfaces, custom-domain aliases, or final-build durability could affect how the site is discovered and presented. This skill treats the search result as a product surface and requires production/owner evidence separately from repository checks.
license: PolyForm-Strict-1.0.0
compatibility: Requires access to the website source or final generated HTML. Network access and Search Console/Bing owner data improve production verification but are not required for offline implementation review.
metadata:
  standard: agent-skills
  arwp-role: search-release-gate
---

# ARWP Search Release

Read `registry/search-release-practices.json` and `docs/SEARCH-RELEASE-GATE.md` before changing a public site's search identity.

## Why this gate exists

A green crawl/indexability report is not enough. A site may still ship with a generic host label, weak title, polluted snippet, stale favicon, wrong canonical host, fabricated sitemap freshness, conflicting structured data, a misleading CNAME assumption, a stale machine-readable surface, or metadata that an earlier generator later overwrites. It can also fail to deploy after every content check passed.

Treat the Search result as a public product surface.

## Workflow — required interview

Resolve these in order:

1. canonical production hostname and root scope;
2. actual GitHub Pages publishing source when applicable: branch or custom Actions;
3. coherent homepage site identity and one authoritative identity contract;
4. title-source convergence;
5. snippet-source hygiene;
6. favicon declaration, delivery and small-size brand check;
7. canonical/redirect/host coherence and indexability state;
8. sitemap, truthful freshness and robots discovery contract;
9. important internal crawl paths and explicit error-route behavior;
10. structured-data coherence and machine-readable surface consistency;
11. localization/hreflang when applicable;
12. GitHub Pages custom-domain HTTPS/DNS/alias behavior when applicable;
13. final generated artifact after every local mutator;
14. post-mutation gate immediately before artifact upload;
15. actual deployment workflow success for the intended revision;
16. production bytes/assets/redirects for that deployed revision;
17. negative assertions for known bad states;
18. actual Search/Bing selection after recrawl.

Do not skip an item because another SEO tool is green. Record `not-applicable` or `unknown` explicitly.

## Existing ARWP checks

Use the current Search Appearance checker against the **final built hostname-root HTML**:

```bash
node bin/arwp-search-appearance.mjs <built-homepage.html> \
  --url=https://example.com/ --strict
```

Also run Technical Integrity on the public surface when network access exists:

```bash
node bin/arwp.mjs technical-integrity https://example.com/ \
  --max-pages=20 --max-link-targets=24 --json
```

For multi-page sites, add Internal Discovery before approving broad URL expansion:

```bash
node bin/arwp-internal-discovery.mjs https://example.com/ \
  --max-pages=20 --json
```

These checks overlap deliberately but prove different things. Search Appearance examines root identity declarations; Technical Integrity examines bounded crawl/index/canonical/link conditions; Internal Discovery examines bounded site paths. None proves the actual title, site name, favicon, snippet, canonical, ranking, citation or traffic selected by a search engine.

## Identity contract

Generated sites SHOULD keep intentional site-level values in one explicit contract: canonical root, site name, homepage title, homepage description and stable favicon URL. Generators and finalizers consume the contract; tests validate the final output against it.

Do not leave the same release-critical string independently hard-coded in a generator, a late finalizer and a test. That creates a failure mode where the metadata is corrected but deployment fails because an old assertion still expects the previous value.

## Snippet hygiene

Google primarily derives snippets from visible page content and may use the meta description. Therefore inspect the page as text, not just head tags.

When non-essential consent/utility UI appears before the page's real promise and could dominate snippet extraction, narrowly apply `data-nosnippet` to that UI container. Do not use `nosnippet` or `max-snippet:0` on pages intended for Search/AI snippets. Do not wrap the actual answer, evidence, product description or key page content in `data-nosnippet` merely to control appearance.

## GitHub Pages mode

For a hostname root such as `project.github.io`, run the full practice set.

For `owner.github.io/project/`, do not claim a separate Google site-name or Search-favicon scope for the project path. Improve page-level title, description, canonical and content without overwriting the parent hostname identity.

Before editing `CNAME` or domain logic, classify the active publishing source. With a custom GitHub Actions workflow, the deployed artifact is the publication source; an existing repository `CNAME` file is ignored and is not required. Verify that the uploaded artifact contains `index.html` at its top level.

For a GitHub Pages custom domain:

- verify the intended canonical host;
- verify GitHub domain ownership/DNS configuration;
- enforce HTTPS;
- review apex and `www` behavior;
- avoid wildcard DNS;
- check the default `github.io` hostname and any prior custom host for conflicting live copies;
- remove old-host URLs from canonical, structured data, sitemap and internal links after the migration policy is established.

Do not assume a `CNAME` file alone proves production configuration.

## Freshness provenance

Treat freshness metadata as evidence, not decoration. A sitemap `<lastmod>` must come from a significant page or data change. Do not stamp generated URLs with the current build date merely because the site was rebuilt. When a reliable content date does not exist, omission is better than fabricated lastmod.

Apply the same reasoning to feed dates and dated structured data: the date should describe the resource, not the CI run that happened to regenerate it.

## Structured data and machine-readable surfaces

JSON-LD must parse and must describe the visible canonical page. On the hostname root, prefer one coherent `WebSite` identity rather than competing blocks. Canonical URLs, `WebSite`/`WebPage` URLs, feeds, schemas, datasets, `llms.txt`-style files and agent manifests must not disagree about hostname or product identity.

Machine-readable discovery surfaces complement canonical HTML. Do not claim that an unofficial discovery file is a ranking factor or that its presence proves AI citation/discovery.

## Error routes

For multi-page sites, test a nonexistent route. If the platform supports a custom 404, make it useful to people, clearly an error state, absent from the sitemap, and not a substitute canonical page. For GitHub Pages, `404.html` belongs in the publishing artifact when a custom error experience is intended.

## Final-artifact and post-mutation rule

Find every HTML-, metadata-, sitemap-, robots-, feed- or asset-producing step, including workflow steps that run **after** the main test suite. Search identity checks belong after the last one.

If deployment runs GTM injection, consent injection, ARWP publication, growth rollout, owner-data restoration, theme rewriting or any other mutator after `build`/`check`, add a small deterministic **post-mutation gate** immediately before artifact upload. It should fail closed on wrong homepage identity, conflicting canonical host, accidental noindex, malformed JSON-LD, sitemap aliases, fabricated lastmod or missing entry files.

Then inspect production separately. If production still serves an earlier title/favicon/site identity, treat that as deployment drift instead of editing correct source repeatedly.

## Deployment success is evidence

The workflow that actually publishes the site must succeed for the intended revision. A green auxiliary workflow, a successful commit, or a correct local `dist` is not proof that GitHub Pages changed.

Verify the publishing workflow, artifact upload, deploy job and deployed revision before saying a fix is live. Failed or cancelled deployments are blocking evidence.

## Negative assertions

Positive checks such as “a canonical exists” are not enough. Include negative assertions for the site's known failure modes, for example:

- old site-name/title/description literals do not survive;
- no intended page carries `noindex`;
- no canonical uses the wrong host;
- aliases and error pages are absent from the sitemap;
- no fabricated lastmod appears where provenance is unavailable;
- no final post-processor restores stale metadata;
- the artifact root contains the required entry file.

A regression that is known today should become executable evidence tomorrow.

## Portfolio mode

When the task concerns several sites, reuse the practice IDs, not the text values. For every hostname record:

- canonical host and GitHub Pages publishing source;
- actual product/site name and identity contract;
- homepage title and visible promise;
- meta description;
- WebSite identity;
- favicon asset and delivery status;
- sitemap/robots host and freshness contract;
- important internal-link reachability and 404 behavior;
- machine-readable surface consistency;
- final post-mutation gate;
- deployment revision;
- latest owner-side Search observation.

Never copy one site's title, description, publisher identity or favicon into another merely to make the checks pass.

## Stop condition

An implementation pass is complete when all applicable P0 practices have evidence of either `pass`, `intentional`, or explicit `external-owner-data/unknown`, the final post-mutation artifact has been inspected, the publishing workflow succeeded for the intended revision, and production has no known contradictory host/identity state.

Search outcome evaluation remains a later loop. Do not wait for rankings to finish repository work, and do not call the release successful in Search until the engine-selected result is observed.
