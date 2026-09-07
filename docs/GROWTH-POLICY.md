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
node bin/arwp-growth.mjs https://example.com --json > arwp-growth.json
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
- the site's selected vertical module;
- vertical-specific evidence checks that say what should be verified rather than treating a site class as a label;
- desired Search/AI crawler intent;
- optional provider-specific Content-Signal policy;
- publisher/author structured-data expectations;
- Preferred Sources URL only when enabled;
- owner-side measurement requirements.

It does not directly overwrite `robots.txt` or any production file.

## Site classes

The current registry (`registry/growth-verticals.json`, v0.2) separates:

- `documentation`;
- `editorial`;
- `software-product`;
- `commerce`;
- `local-business`;
- `research-dataset`;
- `general`.

A vertical is a scope filter, not an industry score. The universal baseline should stay small and stable while vertical modules can evolve independently.

Since registry v0.2, each vertical also carries explicit evidence checks. For example, `software-product` asks separately for canonical product identity, stable release/change history, crawlable docs/support/trust surfaces, and truthful implemented agent/API interfaces. `research-dataset` separates dataset identity, methodology/provenance, citation/license/version history and actual data access. Commerce and local-business checks explicitly preserve the boundary between public crawl evidence and authenticated owner-platform state.

These checks are desired evidence, not automatic pass/fail claims. If ARWP cannot observe a condition from a bounded public audit, it must remain a manual or owner-data verification instead of being guessed.

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
ARWP audit + Growth Profile (public evidence + current guidance)
        ↓
Implementation manifest (only relevant actions + vertical evidence checks)
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
