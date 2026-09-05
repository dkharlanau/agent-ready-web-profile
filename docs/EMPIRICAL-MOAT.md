# Empirical evidence as ARWP's moat

Research on 2026-09-05 reinforced a strategic distinction: the market is filling with agent-readiness/readability scanners and 0-100 scores. ARWP should not compete by creating one more opaque score.

The stronger moat is a reproducible empirical corpus connecting:

1. what websites actually publish;
2. what ARWP resolves from those sites;
3. what a reviewed simpler strategy would select;
4. where sources conflict;
5. what runtime/browser agents actually succeed at;
6. what external search/citation evidence changes over time.

## Corpus principles

- independent sites must be separated from owner-controlled reference sites;
- sampling method and known bias must be explicit;
- historical releases are immutable;
- negative results remain published;
- protocol presence is not readiness or quality;
- ARWP decision quality is measured against reviewed ground truth;
- network cost and request counts stay visible;
- agent/browser task evidence is scoped to the runner and task set;
- search/citation deltas never prove ARWP causality by themselves.

## Minimum next research release

A useful State of the Agentic Web release should include:

- at least one reproducible independent sample;
- per-site observations for HTML/Markdown, llms.txt, sitemaps, ARD, RFC 9727/9728, MCP, A2A, Skills, WebMCP observability state and other supported mechanisms;
- resolver selection versus baseline strategies;
- conflict counts and failure modes;
- request/byte/time cost;
- JSON and CSV release data;
- methodology and sampling limitations;
- versioned snapshot date;
- an explicit statement that the sample is not automatically representative of the web.

This corpus is strategically more defensible than adding another readiness score because it can improve the Resolver, Recommendations Registry and browser/runtime evaluations from the same evidence base.
