# Growth owner-data receipts

Status: operational contract · v0.1 · reviewed 2026-09-06

Some Growth actions depend on authenticated publisher tools. Public crawling cannot honestly determine Search Console generative-AI performance, Bing AI citations, social/video platform-property performance, or an authenticated generative-AI inclusion control. A site can publish a bounded receipt at `ai/growth-owner-data.json` so ARWP can distinguish measured owner-side state from an unverified reminder.

This receipt is **owner data**, not independent evidence. It never proves ranking, indexing, citation, recommendation, traffic quality or causation.

## Resolution rules

ARWP resolves an `external-owner-data` action only when a fresh record matches the exact action ID and the required provider, evidence type and measurement/control kind:

| Action | Provider | Kind | Evidence |
| --- | --- | --- | --- |
| `growth:google-generative-ai-measurement-global` | `google-search-console` | `generative-ai-performance` | measurement |
| `growth:bing-ai-citation-measurement` | `bing-webmaster-tools` | `ai-performance` | measurement |
| `growth:google-platform-properties` | `google-search-console` | `platform-property-performance` | measurement |
| `trend-owner:google-generative-ai-control-global` | `google-search-console` | `generative-ai-inclusion-control` | verified owner state with `value: "included"` |

Measurement evidence is accepted for 45 days. The inclusion control is accepted for 30 days. Stale records remain observable but do not close active work.

An ordinary Search Console report uses `kind: "search-performance"` and **cannot** resolve `generative-ai-performance`. The same applies across providers and surfaces: Google data cannot resolve Bing actions, website Search performance cannot stand in for platform-property performance, and a public crawl cannot infer an authenticated owner setting.

## Privacy and publication

Publish only the minimum bounded proof needed for the workflow. A public receipt should omit raw queries, visitor-level records, submitted URLs, account identifiers and credentials. Aggregated values may be kept private; the receipt can state that authenticated measurement ran, its observation date/data-through date, scope and a digest of the source artifact.

Required guardrails explicitly state that the receipt is not independent evidence, carries no ranking claim, forbids cross-surface/provider inference and omits sensitive data.

## Optional opportunities

`status: "opportunity"` items are kept outside the active remediation backlog. For example, Google Preferred Sources can be a useful acquisition experiment for a site with repeat readers, but absence of that CTA is not a defect.

## Example

```json
{
  "version": "0.1",
  "site": "https://example.com/",
  "evidenceClass": "owner-data",
  "generatedAt": "2026-09-06T10:00:00Z",
  "guardrails": {
    "notIndependentEvidence": true,
    "noRankingClaim": true,
    "noCrossSurfaceInference": true,
    "noProviderInference": true,
    "sensitiveDataOmitted": true
  },
  "records": [{
    "actionId": "observation:google-search-console-baseline",
    "evidenceType": "measurement",
    "provider": "google-search-console",
    "kind": "search-performance",
    "status": "observed",
    "observedAt": "2026-09-06T09:40:05Z",
    "dataThrough": "2026-09-04",
    "summary": "Authenticated standard Search Analytics and URL Inspection ran; no generative-AI performance is asserted.",
    "scope": ["https://example.com/"],
    "evidence": ["https://github.com/example/site/actions/workflows/google-search.yml"],
    "sourceDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }]
}
```
