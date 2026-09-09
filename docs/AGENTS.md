# Agent-Ready Web Profile (ARWP)

ARWP is an evidence-backed website growth and agent-readiness toolkit with an agentic web interoperability Resolver underneath it.

Primary workflow:

`research current Search/recommendation changes -> classify evidence -> technical preflight -> select hypotheses -> improve a real site -> verify -> measure -> iterate`

The Resolver remains the technical foundation for discovering machine- and agent-facing interfaces, preserving evidence/conflicts and selecting a suitable interface for a concrete intent. The publisher ARWP profile remains optional.

## Run the Growth Loop

```bash
git clone https://github.com/dkharlanau/agent-ready-web-profile.git
cd agent-ready-web-profile
npm ci
node bin/arwp-trends.mjs list --since=90 --exclude-retired
node bin/arwp-hypotheses.mjs list --vertical=editorial
node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json
node bin/arwp-growth.mjs https://example.com --vertical=editorial --json
```

Machine-readable hypotheses:
https://dkharlanau.github.io/agent-ready-web-profile/growth/hypotheses.json

## Use with an AI coding agent

```bash
npx skills add dkharlanau/agent-ready-web-profile
```

Default growth workflow: `arwp-growth-loop`.

Use `arwp-prepare-site` for initial technical preparation. Specialists remain available for content, agent discovery and evidence/CI.

Use `arwp-portfolio-fleet` when several local site repositories need one bounded inventory, verification run or live-profile report before selecting a single Growth target.

The growth skill should research primary sources when possible, establish a baseline, select applicable hypotheses, edit the target repository, verify checks and identify owner-side success metrics. Preserve neutral/negative results and never claim causation from implementation alone.

<!-- BEGIN GOOSE TECHNICAL PREFLIGHT -->
## Technical preflight

Before optional Search/GEO/content/agent tactics on a public target, run the bounded Technical Integrity audit:

```bash
node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json
```

Interpret the result conservatively:

- `FAIL` — a bounded source-backed blocker was observed; fix it or explicitly resolve why it is intentional before optional acquisition work;
- `WATCH` — investigate context, rendered/runtime behavior or audit limits; do not automatically call it a defect;
- `PASS` — no issue was observed by that detector in the bounded sample; this is not indexing, ranking or citation proof;
- `not-applicable` — the check does not apply to the observed representation.

A bounded fetch failure remains unknown rather than becoming an indexability failure. Non-HTML resources are not required to carry HTML-only canonical markup. If dogfood exposes a detector false positive, repair the detector/evidence boundary instead of editing the target site to satisfy a bad check.

Use Technical Integrity before optional tactics and again after the changed public/deployed surface is observable.
<!-- END GOOSE TECHNICAL PREFLIGHT -->

## Resolver remains

```bash
node bin/arwp.mjs resolve https://example.com
node bin/arwp.mjs explain https://example.com
node bin/arwp.mjs plan https://example.com --intent=search
```

## Interpretation rules

- Platform requirements outrank optional tactics and experiments.
- A hypothesis is an assumption/test plan, not a promise.
- Manual editorial quality cannot be converted into an honest static score.
- Authenticated Google/Bing/referral outcomes are external owner evidence.
- Crawler access does not guarantee indexing/citation.
- Passing ARWP checks does not guarantee ranking or recommendations.
- Metadata never grants authorization or automatically proves runtime conformance.
- llms.txt, Agent Skills, ARD, MCP, A2A and ARWP profiles are interoperability surfaces, not ranking signals merely because agents can use them.

## Main public surfaces

- Growth: https://dkharlanau.github.io/agent-ready-web-profile/growth/
- Trends: https://dkharlanau.github.io/agent-ready-web-profile/trends/
- Recommendations: https://dkharlanau.github.io/agent-ready-web-profile/recommendations/
- Agent Skills: https://dkharlanau.github.io/agent-ready-web-profile/skills/
- Resolver/project: https://dkharlanau.github.io/agent-ready-web-profile/
- Sitemap: https://dkharlanau.github.io/agent-ready-web-profile/sitemap.md

## Implementation practice library

Use `arwp-discoverability` inside the default Growth Loop for concrete editorial, comparison, technical and measurement practices. The library at `discoverability.html` and `knowledge/discoverability-corpus.json` routes to existing hypotheses and rules. Exported selections are plans, not verified changes or outcome receipts. Rebuild with `npm run build:discoverability` after changing the corpus or templates; retain every existing sitemap route.
