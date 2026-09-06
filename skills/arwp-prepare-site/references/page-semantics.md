# Page semantics routing

Use this reference when the target site needs structured data, author identity, events, datasets, terms, localization or canonical cleanup.

Canonical registry: `registry/page-semantics-profiles.json` in the ARWP repository. If the skill is installed without that registry, use the published copy at `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/page-semantics.json`.

## Decision order

1. Inventory actual routes/content types before editing metadata.
2. Identify the canonical site/publisher entities.
3. Assign each important route one primary page-semantics profile.
4. Inspect visible first-party facts available to populate that profile.
5. Add only applicable JSON-LD/protocol metadata.
6. Create a missing user-facing page only when the source data is real and the page has independent user value.
7. Align canonical, sitemap, indexability and hreflang.
8. Verify the built/deployed HTML, not only source templates.

## Entity IDs

Prefer stable absolute identities, for example:

- `https://example.com/#website`
- `https://example.com/#organization`
- `https://example.com/authors/jane/#person`
- `https://example.com/terms/example/#term`

Reuse them. Do not generate slightly different Organization/Person/Product objects across templates.

## Autofix boundary

Safe automation requires grounded data already present in the repo or public page. Never invent:

- author/reviewer biography or credentials;
- publication history;
- organization/legal/contact facts;
- event dates/location/ticket status;
- price, availability, rating or review data;
- dataset identifiers, licenses or provenance.

If the required fact is missing, emit an owner-data gate instead of a placeholder.

## Remediation output

For each meaningful finding record:

- `problem`
- `evidence`
- `risk`
- `recommendedChange`
- `files`
- `autofix`
- `verification`
- `source`

This gives Codex a bounded implementation task rather than an SEO suggestion.

## Important anti-patterns

- universal JSON-LD bundle;
- invisible or contradictory markup;
- `SearchAction` kept only for the retired Google sitelinks search box;
- FAQ/HowTo schema sprayed across normal editorial pages;
- fake reviews/ratings/offers;
- build-time timestamp churn;
- non-canonical/noindex URLs in the canonical sitemap;
- thin author/event/glossary pages made only for bots.
