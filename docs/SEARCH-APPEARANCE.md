# Search appearance: site identity, title, snippet and favicon

Reviewed: **2026-09-10**. This is a bounded implementation and rollout discipline, not a ranking hypothesis, a Google validator or a guarantee of Search appearance.

## Run on built HTML

```bash
node bin/arwp-search-appearance.mjs _site/index.html \
  --url=https://example.com/ --output=appearance.json

# Explicit review gate: malformed JSON-LD, missing/duplicate title or description,
# conflicting site identity, weak hostname branding signals, or favicon issues fail.
node bin/arwp-search-appearance.mjs _site/index.html \
  --url=https://example.com/ --strict

node scripts/search-appearance-test.mjs
```

Supply the **actual public URL of the inspected HTML**. The command reads a regular local UTF-8 HTML file, bounded to 1 MiB. It makes no network requests, executes no page scripts, follows no URLs, and never edits the site. `--output` creates a new file and refuses to overwrite an existing report or input.

Version 0.2 statically observes four parts of the Search-result identity chain: HTML title, meta description, hostname-level WebSite identity, and favicon declarations. It also records `og:site_name`, `og:title`, and `og:description` so a portfolio review can catch obvious brand drift. Editorial quality, visible H1/intro consistency, rendered markup, live assets, recrawl, and Google's final title/site-name/snippet choice remain separate review work.

## Durable search-result identity pattern

Use this pattern for every public site rollout, especially GitHub Pages portfolios where the search result can otherwise look like a generic hosting result rather than the actual project.

1. **Classify scope first.** Decide whether the published page is the hostname root (`https://project.github.io/`, `https://example.com/`) or a project subdirectory (`https://owner.github.io/project/`). Site-name and Search-favicon scope belongs to the hostname, not a subdirectory. Never overwrite the parent hostname identity to brand one project path.
2. **Make the homepage title explicit and useful.** The root `<title>` should identify the real site and concisely explain what it is. Prefer a natural pattern such as `Site Name: clear descriptor` or `Clear descriptor | Site Name`. Avoid generic `Home`, keyword stuffing and long boilerplate. The visible primary heading should not contradict the title.
3. **Provide one useful meta description, but keep visible copy strong.** Write a concise, page-specific `<meta name="description">` that accurately summarizes the page. Google primarily creates snippets from page content and may use the meta description when it is more useful, so the visible homepage introduction must carry the same clear promise.
4. **Keep identity declarations coherent.** At a hostname root, reconcile the visible site name, `WebSite.name`, genuine `alternateName`, `WebSite.url`, `og:site_name`, canonical URL and social title/description. Correct an existing identity node instead of appending a competing one. The homepage title should visibly carry the actual site name so the result does not read like a generic hosted document.
5. **Use a real brand favicon.** Declare a stable favicon URL in the homepage `<head>`. The actual asset must be square and at least 8×8; Google recommends larger than 48×48. Prefer a simple mark that remains recognizable at search-result size, not a dense illustration or an old tiny asset merely because it already exists.
6. **Verify the final build, not an early template.** Many static sites run several generators or post-processors. Put search-identity normalization late enough that a later build step cannot silently restore an old title, description, site name or favicon. Rebuild from canonical source and inspect the final generated homepage HTML.
7. **Verify production separately.** After deployment, confirm the public HTML and favicon correspond to the intended revision and remain crawlable. Then observe owner-side Search appearance after recrawl. Repository checks prove implementation state, not what Google selected.

This pattern came from a real failure mode: a site had useful content and structured data, but the Search result still showed a generic host label, weak title/description and an unsuitable icon. The fix was not “more SEO metadata”; it was one coherent, durable identity chain from visible brand to final generated HTML.

## Portfolio gate for GitHub-hosted sites

Search appearance is now a normal release check for every maintained GitHub-hosted public site, not a one-off SEO cleanup. A portfolio loop should inspect the canonical homepage of each maintained site and record the result before considering the pass complete.

Minimum root checks:

- exactly one non-empty HTML `<title>`;
- exactly one non-empty meta description;
- title clearly carries the site's real brand/product name;
- one coherent `WebSite` JSON-LD identity with the canonical hostname root;
- `og:site_name` does not contradict the WebSite name;
- canonical, `og:url`, social title/description, visible H1/intro and product position do not conflict;
- a stable, simple, square, crawlable favicon is declared, with a supported raster/ICO option when the primary browser icon is SVG;
- final generated HTML is checked after all build/post-processing steps;
- production is checked separately after deploy/recrawl.

Do not copy one title or description across repositories. Reuse the checklist, but write the actual site name, descriptor, favicon and structured identity from that project's own position.

### GitHub Pages publication shapes

| Publication shape | Apply |
| --- | --- |
| `https://project.github.io/` or custom-domain root | Full identity pass: title, visible promise, meta description, WebSite identity, `og:site_name`, canonical, favicon, final-build durability. |
| `https://owner.github.io/project/` | Page/project title and description may be improved, but do not claim a separate Google site name or Search favicon for the subdirectory. Preserve the owner hostname identity. |
| Redirected custom domain | Audit the final canonical hostname, not only the repository's default `github.io` URL. |

## Hostname scope comes first

Google's site-name documentation supports site names for domain/subdomain roots, not subdirectories. Its favicon documentation similarly defines Search favicon scope by hostname.

| Inspected URL | Consequence |
| --- | --- |
| `https://owner.github.io/` | Root-level site-name and favicon observations are applicable. |
| `https://owner.github.io/project/` | No separate Google site-name or Search-favicon scope for the project. |
| `https://product.example/` | A separate hostname root can be inspected. |
| `https://example.com/de/` | Localized directory is not a separate site-name scope. |

This does **not** prevent subdirectory pages from being indexed, having meaningful page titles, a browser-tab favicon, their own product identity or useful semantic `WebSite` markup. It means that adding a project-local declaration is not evidence of independent hostname-level Search branding.

Inspect hostname HTML separately only where access and ownership permit it. Do not rewrite a portfolio's homepage branding during a project rollout. `/index.html` and query-bearing root URLs conservatively remain non-root observations; confirm the canonical root or redirect target separately.

## What the current checker observes

**HTML title.** The checker reads non-empty `<title>` content from an explicit head. Missing and duplicate titles become review actions. It does not invent a numeric character-count score. On hostname roots with one coherent WebSite name, it also flags a homepage title that does not carry that declared name. This is an editorial consistency guard, not proof of Google's chosen title link.

**Meta description.** The checker observes one non-empty `<meta name="description">`. Missing or duplicate descriptions become review actions. It does not pretend the description will become the Search snippet; Google may instead use visible page text.

**Site name.** The checker reads JSON-LD scripts in the head or body, top-level arrays and `@graph` with a simple `http(s)://schema.org` context. It merges same-`@id` fragments while preserving conflicting names and URLs. A root declaration should have one name and an absolute root URL. Multiple nodes, missing fields, contradictory names and different-origin URLs trigger review. Genuine `alternateName` values can explain differences in `og:site_name`. Missing `og:site_name` is treated as a portfolio identity-review signal, not a ranking requirement. Legitimate canonical aliases need human review, not automatic replacement.

**Social identity observations.** The report records `og:site_name`, `og:title` and `og:description`. They are evidence for consistency review; their mere presence is not a Search eligibility pass.

**Favicon.** It observes supported icon-link relations inside an explicit head and resolves relative URLs using the first base URL. CDN URLs are allowed. A usable URL declaration does not prove the asset exists or is crawlable. Format and `sizes` attributes are hints only. Under the reviewed Google guidance, BMP, GIF, ICO, PNG, JPEG, PPM and TIFF are listed; an SVG-only declaration triggers a review for a supported alternative. Preserve browser-specific SVG assets where useful. The actual image must be square and at least 8×8; larger than 48×48 is recommended. There is no multiple-of-48 rule in this check.

**Malformed JSON-LD.** A syntax error stays visible even when another block is valid or the inspected URL is a subdirectory. It is never silently reported as missing metadata.

Every emitted action is review-only, includes its primary source, and has `autofix:false`. Real names, ownership and existing canonical policy cannot be safely invented from a parser result.

## Coverage boundaries

This is not a complete HTML tree builder or JSON-LD expansion processor. Comments, raw-text examples, template/noscript content and body icon links are not promoted into head metadata. Unsupported JSON-LD contexts remain explicitly unassessed, and graph traversal is bounded. Microdata, RDFa, JavaScript-rendered markup, redirects, response headers, actual image bytes, robots rules and actual Google appearance require separate evidence.

Title and snippet quality still require editorial review. Google can generate title links and snippets from several sources, and Search may rewrite them. Do not turn character-count folklore into a pass/fail rule. Review whether the title is descriptive, concise and consistent with visible content, and whether the description accurately summarizes the page.

## Safe patch preparation from repository ownership

The static audit deliberately does not know which source file produced the built HTML. Do not turn `appearance.actions[]` directly into edits. First compile a Repository Mapper Site State Graph at the exact target revision, then map the findings to source ownership:

```bash
node bin/arwp-map-repo.mjs compile \
  --root=. \
  --site-root=. \
  --repository=owner/site \
  --site=https://example.com \
  --base-path=/ \
  --base-ref=main \
  --base-sha=<40-character-sha> \
  --adapter=auto \
  --out=.arwp/site-state.json

node bin/arwp-search-appearance-patch.mjs build \
  appearance.json .arwp/site-state.json \
  --output=.arwp/search-appearance-patch.json
```

The patch preparation manifest is proposal-only. It records the repository base commit, exact source digest when ownership is proven, build-path context, required publisher facts, preconditions and post-change verification. It never writes the target repository.

Before an edit, re-check both `baseCommitSha` and `beforeSha256`. If either drifted, regenerate the Site State Graph and patch preparation. Never treat a stale digest as authorization to patch current source.

## Use in the Growth Loop

Run the Search Appearance audit after building the target site's relevant HTML. Then run the durable identity checklist above against the **final** generated homepage. Record the actual page URL, source file/build revision, review date and report. Prioritize real indexing blockers before appearance refinements.

For a maintained portfolio, a new site or substantial homepage redesign should automatically trigger this lane. A Search screenshot showing a generic host label, wrong favicon, weak title or poor snippet should also trigger a cross-portfolio pass, because the failure mode is reusable even when the exact copy and branding are project-specific.

When repository edits are available, reconcile existing JSON-LD, visible identity and hostname ownership. After implementation, rebuild and repeat the check, then separately verify deployed assets/crawler access and observe Search appearance. Do not claim ranking or traffic improvement from changing names, adding files or passing tests.

## Source record

- Google Search Central, **Provide a site name to Google Search**: reviewed 2026-09-10. https://developers.google.com/search/docs/appearance/site-names
- Google Search Central, **Define a favicon to show in search results**: reviewed 2026-09-10; documentation recommends a square favicon larger than 48×48 while requiring at least 8×8. https://developers.google.com/search/docs/appearance/favicon-in-search
- Google Search Central, **Influencing your title links in search results**: reviewed 2026-09-10; recommends descriptive, concise, non-boilerplate titles and concise branding. https://developers.google.com/search/docs/appearance/title-link
- Google Search Central, **Control your snippets in search results**: reviewed 2026-09-10; states snippets are primarily generated from page content and may use a meta description when it better describes the page. https://developers.google.com/search/docs/appearance/snippet

Review dates are provenance, not artificial content freshness. Recheck upstream guidance before changing format support or promoting declaration hints to eligibility assertions.
