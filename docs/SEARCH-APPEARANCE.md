# Search appearance: site names and favicons

Reviewed: **2026-09-09**. This is a bounded implementation check, not a ranking hypothesis, a Google validator or a guarantee of Search appearance.

## Run on built HTML

```bash
node bin/arwp-search-appearance.mjs _site/index.html \
  --url=https://example.com/ --output=appearance.json

# Explicit review gate: malformed JSON-LD or conflicting declarations fail.
node bin/arwp-search-appearance.mjs _site/index.html \
  --url=https://example.com/ --strict

node scripts/search-appearance-test.mjs
```

Supply the **actual public URL of the inspected HTML**. The command reads a regular local UTF-8 HTML file, bounded to 1 MiB. It makes no network requests, executes no page scripts, follows no URLs, and never edits the site. `--output` creates a new file and refuses to overwrite an existing report or input. An installed package also contains the `bin/` and `lib/` files; invoke this CLI through `node` (there is no new npm executable alias yet).

The JSON includes source-backed checks, Growth-compatible review actions, observed declarations, coverage gaps and manual follow-up checks. There is no score.

| Status | Meaning |
| --- | --- |
| `observed` | A declaration or syntactic fact was seen in supplied HTML; not live validation. |
| `review` | Observed conflicting or suspect declarations need inspection before a change. |
| `fail` | A supplied JSON-LD block could not be parsed. Other blocks remain visible. |
| `not-observed` | The supported static representation was not found; other representations may exist. |
| `not-assessed` | This checker has insufficient evidence or does not support the representation. |
| `not-applicable` | A hostname-level feature cannot be separately configured for this non-root URL. |

Exit codes: `0` = completed inspection; `1` = `--strict` encountered a `review` or `fail`; `2` = invalid invocation, unreadable/oversized/non-UTF-8 input, or output error. Missing declarations and unknown evidence do not fail strict mode. A zero exit code does **not** mean a site is fully eligible.

## Hostname scope comes first

Google's [site-name documentation](https://developers.google.com/search/docs/appearance/site-names) supports site names for domain/subdomain roots, not subdirectories. Its [favicon documentation](https://developers.google.com/search/docs/appearance/favicon-in-search) similarly defines Search favicon scope by hostname.

| Inspected URL | Consequence |
| --- | --- |
| `https://owner.github.io/` | Root-level site-name and favicon observations are applicable. |
| `https://owner.github.io/project/` | No separate Google site-name or Search-favicon scope for the project. |
| `https://product.example/` | A separate hostname root can be inspected. |
| `https://example.com/de/` | Localized directory is not a separate site-name scope. |

This does **not** prevent subdirectory pages from being indexed, having meaningful page titles, a browser-tab favicon, their own product identity or useful semantic `WebSite` markup. It means that adding a project-local declaration is not evidence of independent hostname-level Search branding. Do not remove legitimate project metadata just because this feature is not applicable.

Inspect hostname HTML separately only where access and ownership permit it. Do not rewrite a portfolio's homepage branding during a project rollout. `/index.html` and query-bearing root URLs conservatively remain non-root observations; confirm the canonical root or redirect target separately.

## What the checks observe

**Site name.** The checker reads JSON-LD scripts in the head or body, top-level arrays and `@graph` with a simple `http(s)://schema.org` context. It merges same-`@id` fragments while preserving conflicting names and URLs. A root declaration should have one name and an absolute root URL. Multiple nodes, missing fields, contradictory names and different-origin URLs trigger review. Genuine `alternateName` values can explain differences in `og:site_name`. Legitimate canonical aliases need human review, not automatic replacement. Existing nodes should be corrected rather than adding competing identities.

**Favicon.** It observes supported icon-link relations inside an explicit head and resolves relative URLs using the first base URL. CDN URLs are allowed. A usable URL declaration does not prove the asset exists or is crawlable. Format and `sizes` attributes are hints only. Under the Google guidance retrieved on the review date, BMP, GIF, ICO, PNG, JPEG, PPM and TIFF are listed; an SVG-only declaration triggers a review for a supported alternative. Preserve browser-specific SVG assets where useful. The actual image must be square and at least 8x8; larger than 48x48 is recommended. There is no multiple-of-48 rule in this check.

**Malformed JSON-LD.** A syntax error stays visible even when another block is valid or the inspected URL is a subdirectory. It is never silently reported as missing metadata.

Every emitted action is review-only, includes its primary source, and has `autofix:false`. Real names, ownership and existing canonical policy cannot be safely invented from a parser result.

## Coverage boundaries

This is not a complete HTML tree builder or JSON-LD expansion processor. Comments, raw-text examples, template/noscript content and body icon links are not promoted into head metadata. Unsupported JSON-LD contexts remain explicitly unassessed, and graph traversal is bounded. Microdata, RDFa, JavaScript-rendered markup, redirects, response headers, actual image bytes, robots rules and actual Google appearance require separate evidence. Headless snippets are not treated as a verified favicon head.

The Google site-name guide points to a schema validator and owner-side URL Inspection; it explicitly says site names are **not supported by the Rich Results Test**. Use a suitable validator and actual owner-side observation instead of interpreting a generic green result as site-name validation.

## Safe patch preparation from repository ownership

The static audit deliberately does not know which source file produced the built HTML. Do not turn `appearance.actions[]` directly into edits. First compile a [Repository Mapper](REPOSITORY-MAPPER.md) Site State Graph at the exact target revision, then map the findings to source ownership:

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

node bin/arwp-search-appearance-patch.mjs validate \
  .arwp/search-appearance-patch.json

node scripts/search-appearance-patch-test.mjs
```

The patch preparation manifest is proposal-only. It records the repository base commit, exact source digest when ownership is proven, build-path context, required publisher facts, preconditions and post-change verification. It never writes the target repository.

| Patch status | Meaning |
| --- | --- |
| `mapped-review` | One non-generated source owner and its SHA-256 are proven. An agent may inspect that exact source next, but the manifest still does not authorize a mutation or invent identity facts. |
| `manual-review` | Build-path context exists but exact field/source ownership is not proven. Resolve ownership before editing. |
| `blocked` | The supplied repository/site graph does not own the hostname-root scope. Do not patch a project subdirectory or unrelated repository to change hostname-wide Search branding. |

Static HTML can often map root metadata directly to its owning HTML file. Framework build paths are intentionally stricter: a Next.js `page.tsx -> layout.tsx` chain, for example, is not proof that `layout.tsx` owns a favicon or site-name field. A resolved `jsonld` ownership claim can map a JSON-LD/site-name review; otherwise Next.js/Astro/Jekyll remain manual until the mapper has exact evidence. This is deliberate fail-closed behavior, not missing automation.

Before an edit, re-check both `baseCommitSha` and `beforeSha256`. If either drifted, regenerate the Site State Graph and patch preparation. Never treat a stale digest as authorization to patch current source.

The manifest schema is `schema/search-appearance-patch-manifest.schema.json`. It carries no ranking score, no generated replacement copy and no automatic write primitive. Exact textual transforms remain a separate Transformation Engine concern and should only be added for stack/source patterns that have real blocked work and deterministic grounding.

## Use in the Growth Loop

Run the Search Appearance audit after building the target site's relevant HTML. Record the actual page URL, source file/build revision, review date and report. Prioritize real indexing blockers before appearance refinements. The report's `actions` use the existing Growth action shape, but the live `arwp-growth` network audit does not automatically run this local built-output check.

When repository edits are available, compile a Site State Graph and create the safe patch preparation manifest before changing hostname-level identity. Reconcile existing JSON-LD, visible identity and hostname ownership. After implementation, rebuild and repeat the check, then separately verify deployed assets/crawler access and observe Search appearance. Do not claim ranking or traffic improvement from changing names, adding files or passing tests.

See also [Growth Loop](GROWTH-LOOP.md), [Repository Mapper](REPOSITORY-MAPPER.md), [Mapped Transform Preparation](MAPPED-TRANSFORM-PREPARATION.md), [Site Rollout Playbook](SITE-ROLLOUT-PLAYBOOK.md) and [Maturity Profile](MATURITY-PROFILE.md).

## Source record

- Google Search Central, **Provide a site name to Google Search**: retrieved 2026-09-09; page states updated 2025-12-10. [Primary documentation](https://developers.google.com/search/docs/appearance/site-names).
- Google Search Central, **Define a favicon to show in search results**: retrieved 2026-09-09; page states updated 2026-08-28. [Primary documentation](https://developers.google.com/search/docs/appearance/favicon-in-search).

Review dates are provenance, not artificial content freshness. Recheck upstream guidance before changing format support or promoting declaration hints to eligibility assertions.
