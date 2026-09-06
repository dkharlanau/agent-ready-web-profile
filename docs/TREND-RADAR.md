# ARWP Trend Radar

ARWP Trend Radar is the early-adoption layer for Search, AI-search, citation and agent-web change.

It exists to answer a practical question:

> What changed recently, is it real enough to act on, which website types does it affect, and how should ARWP turn it into a measured improvement rather than another SEO checklist item?

The canonical source registry is [`registry/trends.json`](../registry/trends.json). The public copy is published at `/trends/trends.json`.

## Lifecycle

A trend moves through explicit states:

```text
WATCH -> ADOPT -> MEASURED
   \                    \
    +------> RETIRED <---+
```

### WATCH

Use when a mechanism is emerging, experimental, provider-specific, insufficiently deployed, or not yet strong enough to enter default website recommendations.

WATCH is not a recommendation.

Examples include browser-origin trials or provider-specific content-policy mechanisms that may become important but should not be generalized into Google/OpenAI requirements.

### ADOPT

Use only when a primary source documents a currently applicable mechanism with at least one concrete publisher action or measurement path.

ADOPT does not mean "ranking factor". It means ARWP has enough upstream evidence to make the change available to applicable website types.

### MEASURED

Reserve for real longitudinal evidence linking:

1. a trend/action ID;
2. a before evidence snapshot/receipt;
3. an implemented change/commit;
4. an after evidence snapshot/receipt;
5. owner-side Search/AI observations when available;
6. uncertainty and regressions.

Temporal sequence alone never proves ARWP caused a result.

### RETIRED

Keep deprecated or obsolete mechanisms visible instead of deleting them. This prevents stale SEO tactics from re-entering generated backlogs later.

## Attention window

Each trend may define `attentionWindowDays`.

The runtime derives:

- `early` — inside the first ARWP attention window;
- `active` — inside the second window;
- `established` — older than both windows;
- `retired` — historical/deprecated.

This is an editorial prioritization model only. It is **not** evidence of a first-mover ranking advantage.

## Registry record

A trend contains:

- stable `id`;
- `provider`;
- `detectedAt` and `sourceReviewedAt`;
- `stage`, `confidence`, and upstream `maturity`;
- affected `surfaces`;
- applicable website verticals;
- primary source;
- `actionRefs` into ARWP Growth recommendations;
- `measurementRefs` for follow-up evidence;
- bounded notes/guardrails.

## CLI

```bash
node bin/arwp-trends.mjs check
node bin/arwp-trends.mjs list --since=30 --exclude-retired
node bin/arwp-trends.mjs list --provider=google --stage=adopt
node bin/arwp-trends.mjs list --vertical=software-product --stage=adopt,measured
node bin/arwp-trends.mjs show openai-publisher-agent-guidance-refresh --json
```

## Growth Profile integration

`arwp-growth` attaches applicable `ADOPT` and `MEASURED` trends to a site plan.

```bash
node bin/arwp-growth.mjs https://example.com --vertical=editorial --json
```

The site plan does not automatically turn every trend into an implementation task. The existing site audit and Growth rules still determine whether a concrete remediation/action is warranted. The attached Trend Radar context explains what changed recently and which current actions/measurements it relates to.

`WATCH` trends stay out of default Growth plans.

## Source policy

A secondary article, social post or community discussion can be useful for discovery, but it cannot promote a trend to ADOPT by itself.

Primary-source examples include:

- Google Search Central documentation/changelog/blog;
- OpenAI publisher/developer guidance;
- Bing Webmaster/Search documentation;
- Chrome/WebMCP documentation;
- upstream protocol specifications;
- provider changelogs for provider-specific mechanisms.

Every fast-moving record carries a review date.

## Product boundary

Trend Radar is designed to improve ARWP's adaptation speed as Search and agent behavior changes. It does not claim that:

- implementing a new feature guarantees ranking;
- a crawler visit is a citation;
- AI-specific metadata improves Google visibility unless Google says so;
- one provider convention is a universal standard;
- one before/after movement proves causality.

The long-term moat is not the number of tracked trends. It is the evidence chain from **change detected -> applicability -> implementation -> verification -> measured outcome -> recommendation update**.
