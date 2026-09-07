# ARWP Growth Policy

Status: experimental contract v0.1 · reviewed 2026-09-07

A generic website audit cannot know the publisher's business goal, rights policy or target search/AI surfaces. The **Growth Policy** makes those choices explicit before ARWP turns a Growth Profile into an implementation manifest.

## Why this exists

Without an owner policy a scanner can easily make the wrong recommendation:

- allowing ChatGPT Search does not imply allowing model training;
- a documentation site should not receive commerce/local-business requirements;
- Preferred Sources is useful only when the publisher wants that acquisition surface;
- social/video measurement is relevant only when those properties exist;
- Cloudflare Content Signals are provider-specific and should be emitted only when the publisher chooses to use them.

The Growth Policy avoids hidden assumptions.

## Example

See `examples/growth-policy.example.json`.

```json
{
  "policyVersion": "0.1",
  "target": "https://example.com/",
  "siteClass": "software-product",
  "goals": {
    "googleSearch": true,
    "googleGenerativeSearch": true,
    "chatgptSearch": true,
    "bingAi": true,
    "browserAgents": true
  },
  "aiUsagePolicy": {
    "modelTraining": "deny",
    "realTimeAiInput": "allow",
    "contentReuse": "reference",
    "emitCloudflareContentSignals": true
  }
}
```

## Validate

```bash
node bin/arwp-growth-policy.mjs validate examples/growth-policy.example.json
```

Schema: `schema/growth-policy.schema.json`.

## Compile a desired state

First create the evidence-backed Growth Profile:

```bash
node bin/arwp-growth.mjs https://example.com --vertical=software-product --json > arwp-growth.json
```

Then apply the owner's policy:

```bash
node bin/arwp-growth-policy.mjs compile \
  arwp-growth.json \
  examples/growth-policy.example.json \
  --json
```

The resulting implementation manifest contains:

- only actions relevant to the declared goals;
- the site's selected vertical module and expected evidence checks;
- desired Search/AI crawler intent;
- optional provider-specific Content-Signal policy;
- publisher/author structured-data expectations;
- Preferred Sources URL only when enabled;
- owner-side measurement requirements.

It does not directly overwrite `robots.txt` or any production file.

## Site classes and vertical evidence

The current registry (`registry/growth-verticals.json`, v0.2) separates:

- `documentation`;
- `editorial`;
- `software-product`;
- `commerce`;
- `local-business`;
- `research-dataset`;
- `general`.

A vertical is a scope filter, not an industry score. Each vertical now carries concrete expected evidence checks rather than only prose focus areas.

`arwp-growth --vertical=...` evaluates those checks using a bounded relevant-surface sample selected from the canonical entry page and canonical-path sitemap. The adapter may inspect product, changelog, docs, methodology, dataset, citation or similar relevant URLs when they are actually discoverable, rather than assuming the homepage contains every signal.

The implementation deliberately distinguishes:

- `observed` public evidence;
- `partial` public evidence;
- `not-observed` within the bounded sample;
- `manual` editorial/context review;
- `external-owner-data` for authenticated platform/feed/business-profile state;
- `not-applicable-or-not-observed` where absence must not create a requirement;
- `unavailable` when evidence could not be captured.

Current remediation boundary:

- software-product, research-dataset and documentation checks can generate guarded vertical backlog items when bounded evidence is concretely partial/missing;
- editorial authorship/dates are observable, but first-hand quality remains manual;
- commerce Product/Offer and policy links are observable, while Merchant/feed freshness stays owner-side;
- LocalBusiness/address/contact can be observed publicly, while external Business Profile state stays owner-side;
- absence of an API/agent interface never tells ARWP to invent one.

A missing signal in the bounded sample is not proof of whole-site absence. Every generated vertical action therefore requires checking the relevant canonical surface before editing content or structured data.

The same evidence layer is used by `arwp-improve`. If `--vertical` is omitted, the unified planner can conservatively map unambiguous Search Surface site kinds such as `software-product`, `ecommerce`, `local-business` and `editorial-news` to the matching Growth vertical. Ambiguous `documentation-research` defaults to documentation and can be overridden with `--vertical=research-dataset`.

The universal baseline stays small and stable while vertical modules can evolve independently.

## Rights / AI policy

Example policy:

```json
{
  "modelTraining": "deny",
  "realTimeAiInput": "allow",
  "contentReuse": "reference",
  "emitCloudflareContentSignals": true
}
```

When enabled, the compiler can express the intent as:

```text
Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference
```

and can separately emit an `OAI-SearchBot` allow rule and `GPTBot` deny rule when those choices match the owner's goals.

This is a desired-state fragment, not a replacement `robots.txt`. Existing crawler, legal, security and sitemap rules must be merged deliberately.

Cloudflare Content Signals are provider-specific conventions. They must not be represented as a Google ranking requirement or a universal web standard.

## Product loop

The intended deployment loop becomes:

```text
Growth Policy (owner intent)
        ↓
ARWP audit + Growth Profile + bounded vertical evidence
        ↓
Implementation manifest (only relevant actions)
        ↓
site changes
        ↓
ARWP assert / Evidence Receipt
        ↓
Google/Bing/AI owner-side measurement
        ↓
new dated observation
```

This lets ARWP improve a site's implementation quality while preserving the key distinction between **quality work that can help eligibility/discoverability** and an unsupported promise that a platform will rank or recommend the site.
