# Earned Discovery

Reviewed: **2026-09-15**.

Earned Discovery is the external-distribution safety layer for ARWP. It starts only after a useful public asset exists and turns explicit audience/channel evidence into a bounded distribution plan without treating backlink acquisition, outreach volume or paid placement as ranking proof.

Canonical practices: [`registry/earned-discovery-practices.json`](../registry/earned-discovery-practices.json).

## Why this exists

Search readiness does not make people aware that a page exists. Google's SEO Starter Guide explicitly recommends promoting useful content through channels such as social media, community engagement, advertising and word of mouth, while also warning that promotion can be overdone and become manipulative.

At the same time, Google's spam policies prohibit link practices whose primary purpose is ranking manipulation, including bought ranking links, excessive reciprocal linking, automated link creation, low-quality directory links and optimized forum-comment links.

ARWP therefore separates two jobs:

```text
make something worth discovering
→ distribute it to a relevant audience
→ measure audience/outcome evidence
```

from:

```text
manufacture links / placements / thin variants
→ count backlinks
→ claim ranking impact
```

The second workflow is outside the Earned Discovery contract.

## What counts as a promotable asset

The planner requires two explicit statements before distribution can become ready:

- `originalContribution: true`;
- `evidenceVisible: true`.

Useful candidates include original research, datasets, benchmarks, tools, reference guides, first-hand comparisons, explanatory visuals and other resources with a real contribution beyond rephrasing existing material.

These declarations are review evidence, not automated proof of quality. If either is unknown the asset stays `watch`; if either is explicitly false, the plan fails closed.

## Input

```json
{
  "site": "https://example.com/",
  "asset": {
    "url": "https://example.com/research/microphone-test/",
    "kind": "research",
    "originalContribution": true,
    "evidenceVisible": true,
    "audience": "people comparing microphones"
  },
  "channels": [
    {
      "id": "audio-community",
      "kind": "community",
      "audienceFit": true,
      "paid": false,
      "linkGoal": "audience"
    },
    {
      "id": "owned-newsletter",
      "kind": "newsletter",
      "audienceFit": true,
      "paid": false,
      "linkPossible": false
    },
    {
      "id": "sponsored-placement",
      "kind": "sponsorship",
      "audienceFit": true,
      "paid": true,
      "linkQualification": "sponsored"
    }
  ],
  "measurements": [
    "qualified-referral-visits",
    "returning-or-subscribed-readers"
  ],
  "automation": {
    "massLinkCreation": false,
    "bulkForumPosting": false
  }
}
```

Supported channel kinds are:

```text
community | social | newsletter | word-of-mouth | advertising |
sponsorship | partner | directory | forum | press | other
```

## Run it

```bash
node bin/arwp-earned-discovery.mjs plan earned-discovery.json
node bin/arwp-earned-discovery.mjs plan earned-discovery.json --json
```

The command is read-only. It does **not** contact communities, post messages, create links, buy placements or submit anything to Search providers.

Exit code `1` means at least one anti-spam or evidence rule failed. `watch` does not cause a failing exit code, but a plan with missing asset evidence or missing outcome measurement is not `ready`.

## Audience fit before channel volume

Every distribution channel must declare `audienceFit`.

- `true` — the channel can be considered for this asset;
- `false` — it is blocked from the plan;
- omitted — it stays `watch`.

The planner does not reward the number of channels. One tightly matched community can be more useful than dozens of unrelated placements.

## Link manipulation is a hard boundary

The following declarations fail the plan:

- `linkGoal: "ranking"`;
- `requiresReciprocalLink: true`;
- global `reciprocalLinkRequirement: true`;
- `automation.massLinkCreation: true`;
- `automation.bulkForumPosting: true`;
- channel-level `automatedPosting: true`.

This does not mean all reciprocal links, forum participation or directories are inherently bad. The failure is specifically for using them as a required/manufactured ranking-link tactic rather than because the destination is genuinely useful to the audience.

Primary source: https://developers.google.com/search/docs/essentials/spam-policies

## Paid distribution stays paid distribution

Advertising and sponsorship are valid acquisition channels. They are not treated as earned authority.

If a paid channel can create a link, it must declare either:

```text
linkQualification: sponsored
```

or:

```text
linkQualification: nofollow
```

Otherwise the plan fails the paid-link boundary. A paid channel with `linkPossible: false` does not need link qualification.

Primary sources:

- https://developers.google.com/search/docs/essentials/spam-policies
- https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links

## Measure outcomes, not activity

A ready plan requires at least one meaningful outcome measurement. Useful examples:

- qualified referral visits;
- returning or subscribed readers;
- legitimate editorial citations/references;
- direct or branded demand;
- owner-observed Search or AI visibility.

Metrics such as `backlink-count`, `outreach-count` or `messages-sent` may be operational diagnostics but cannot be the only measurement. If they are mixed with real outcomes the measurement gate remains `watch`; if they are the only metrics it fails.

No before/after result from this layer proves that distribution caused a Search ranking or AI-citation change. Use the existing Growth Experiment / Visibility / Change Receipt layers for longitudinal evidence and preserve confounders.

## Relationship to existing ARWP layers

```text
people-first / evidence-bearing asset
→ Search/Technical release readiness
→ Earned Discovery plan
→ audience distribution
→ referral/subscriber/reference evidence
→ Search / AI owner evidence
→ Growth Experiment review
```

Earned Discovery complements Internal Discovery. Internal Discovery helps users and crawlers move through the site; Earned Discovery asks whether a strong asset has a truthful path to the external audience that might actually care about it.

It is not a backlink builder, outreach automation system or universal authority score.
