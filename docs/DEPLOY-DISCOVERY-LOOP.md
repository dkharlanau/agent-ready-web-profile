# Deploy Discovery Loop

Reviewed: **2026-09-15**.

Deploy Discovery Loop is the release-to-discovery layer that sits after Production Search Build Gate.

It answers a narrower question than a Search audit:

> After this exact production revision is verified, which canonical URLs are evidence-backed candidates for URL-level discovery notification, what remains sitemap/feed coverage, and what owner-side evidence should be collected next?

It does **not** promise indexing, ranking, AI citation, referrals or business impact.

Canonical rules: [`registry/deploy-discovery-loop-practices.json`](../registry/deploy-discovery-loop-practices.json).

## Why this exists

A repository diff is not a Search discovery plan.

A deploy can contain:

- newly added canonical URLs;
- materially updated visible content;
- changed Search metadata/structured data;
- removed canonical URLs;
- byte-only rebuild churn with no visible/Search change;
- an unchanged canonical inventory;
- a sitemap that remains the broad coverage layer;
- an RSS/Atom feed used for recent updates;
- owner-side Search/Bing evidence that is only observable later.

The loop keeps those states separate instead of mass-submitting every URL after every build.

## Required evidence order

```text
before final artifact (optional for first release)
→ after final artifact
→ Production Search Build Gate
→ exact source/deployed SHA parity
→ complete live Search parity
→ canonical URL diff
→ exact live byte parity for added/updated candidate URLs
→ safe discovery plan
→ provider-native owner evidence
```

If exact deployment evidence is missing, the planner can still show candidate differences, but IndexNow output is blocked.

Production Search Build Gate may intentionally use its bounded `search-surface` parity mode. Deploy Discovery Loop adds a stricter candidate-level rule: an added or updated URL cannot enter the IndexNow-ready handoff unless the final artifact bytes observed for that URL equal the live bytes in the supplied parity report. This prevents a stale body from being notified merely because title/canonical/JSON-LD evidence already matches.

## Run it

```bash
node bin/arwp-deploy-discovery.mjs plan \
  --site=https://example.com/ \
  --before-artifact=before/out \
  --after-artifact=after/out \
  --live-report=search-build-live.json \
  --source-sha=<40-char-deployed-sha> \
  --removed-status=removed-status.json \
  --json \
  --output=deploy-discovery.json \
  --indexnow-output=changed-urls.txt
```

`removed-status.json` may be either:

```json
{
  "https://example.com/old-page/": 410
}
```

or:

```json
[
  { "url": "https://example.com/old-page/", "status": 404 }
]
```

The planner never sends network submissions. `changed-urls.txt` is only an evidence-gated handoff to the existing `arwp-indexnow` helper.

## URL classification

### `added`

A canonical URL exists in the after sitemap/index cohort but not in the before cohort.

It becomes ready only after exact deployment/revision evidence passes **and** the live parity report proves byte equality for that added URL.

### `updated`

The URL exists in both cohorts and either:

- visible text changed; or
- title/description/canonical/noindex/Open Graph URL/JSON-LD Search-surface evidence changed.

This is stronger than a raw file hash. The URL becomes ready only when the changed final artifact is also byte-identical to the live representation observed by the supplied parity report.

### `artifactOnlyChanged`

The HTML bytes changed while normalized visible text and bounded Search-surface evidence stayed the same.

This remains `watch` by default. It may be a CSS/class/minification/build-output difference rather than a meaningful content update.

Do not mass-submit these URLs merely because a deployment rebuilt them.

### `removed`

A canonical URL existed in the before cohort and is absent from the after cohort.

It becomes IndexNow-ready as a deletion only when explicit live `404` or `410` evidence is supplied. An unverified removal remains `watch` because repository/sitemap disappearance is not proof that the production URL is actually gone.

## Partial handoff

Discovery evidence is URL-scoped. If one changed URL has live byte drift while another changed URL is exact-live and a deletion is independently verified, the report may expose the independently proven URLs as ready while marking the overall loop incomplete and the stale URL blocked.

This does not relax the release gate: `report.pass` stays false until every changed candidate has the required live evidence. The partial ready list exists so one stale URL does not erase valid evidence for unrelated URLs.

## Sitemap role

The after artifact must still pass the Production Search Build Gate sitemap/canonical contract.

Sitemaps remain the broad coverage mechanism. URL-level notifications do not replace them.

Google documents sitemap submission as a hint rather than an indexing guarantee. Bing recommends combining complete XML sitemap coverage with IndexNow for real-time added/updated/removed URL notification.

Primary sources:

- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search

## Feed role

The planner inspects the final homepage artifact for RSS/Atom autodiscovery links.

For an advertised same-site feed it verifies that the referenced artifact exists in the final build. A missing advertised artifact is a release failure. No feed is a `watch`, not a mandatory Search defect.

RSS/Atom is complementary to the canonical XML sitemap and URL-level notification layer. Do not create fake feed freshness or emit feed items solely because a build ran.

## IndexNow handoff

When `indexNow.state` is `ready` or `partial`, the `readyUrls` list contains only independently proven candidates. Use the existing helper separately:

```bash
export INDEXNOW_KEY='...'
node bin/arwp-indexnow.mjs payload https://example.com/ \
  --urls-file=changed-urls.txt \
  --key-location=https://example.com/indexnow-key.txt

node bin/arwp-indexnow.mjs submit https://example.com/ \
  --urls-file=changed-urls.txt \
  --key-location=https://example.com/indexnow-key.txt \
  --endpoint=https://api.indexnow.org/indexnow
```

Keep the key outside the public repository. A successful HTTP receipt proves only that the endpoint accepted/received the request.

## Owner evidence queue

The planner emits follow-ups instead of pretending the release itself proves Search outcomes:

- Google Search Console sitemap processing;
- Google query/page Search performance for the changed cohort;
- Google Generative AI Search/Discover performance where data exists;
- IndexNow submission receipt;
- Bing sitemap processing;
- Bing AI Performance citations/cited pages/grounding-query evidence;
- Search/AI referral and downstream task/conversion outcomes.

Owner exports remain private. Existing ARWP visibility importers can normalize provider-native aggregate evidence later.

## First deployment

`--before-artifact` is optional. Without it, the after canonical cohort is classified as newly added. Ready output is still blocked unless live deployment and exact changed-URL byte parity are supplied.

## Relationship to other ARWP layers

```text
Repository Mapper / source ownership
→ stack-specific Search Pack
→ Production Search Build Gate
→ Deploy Discovery Loop
→ IndexNow / sitemap / feed handoff
→ owner Search/Bing/referral evidence
→ Growth experiment keep/revise/revert decision
```

Use Search Platform Eligibility separately for provider applicability such as Google Preferred Sources and the restricted Google Indexing API.
