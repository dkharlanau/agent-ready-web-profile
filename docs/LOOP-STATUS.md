# ARWP implementation loop status

Started: 2026-08-26
Integrated into: `main`
Last major implementation review: 2026-09-06

## 25 October 2026 decision-quality repair

The [visibility Deep Run](../research/product/2026-10-25-visibility-deep-run.md) documents the evidence and applied-pilot proposals. Search Failure Doctor now distinguishes dated current evidence from stale, future, undated and empty-sample observations. The opportunity planner uses the exact target's non-brand observations and exposes the actual alternative pages. The portfolio registry adds Vedokrok and Bonihua as observe-only and corrects the MetalHatsCats source repository. The legacy Ptichi `GSC empty` label is replaced with dated historical context.

These changes repair implementation and decision routing. They do not establish a completed Search outcome loop or authorize target-site rollout. Preserve the original Ptichi freeze and review later control-page edits before interpreting a comparison. Use #148 for continuing product validation; closed implementation issue #55 is not proof of the M1 outcome gate.

### Release and portfolio capture follow-up

[ARWP PR #161](https://github.com/dkharlanau/agent-ready-web-profile/pull/161) merged the decision repairs. Its [post-merge portfolio capture](https://github.com/dkharlanau/agent-ready-web-profile/actions/runs/40218065560) exposed a comparison gap: a site's observed canonical URL can change between otherwise successful captures. The follow-up preserves both canonical URLs and marks that row `canonical-url-changed` with a null `growthDiff`; other sites remain comparable. Historical runs and the strict single-site comparator are unchanged. Confirm the next released capture separately before calling the collection loop restored.

[Metkagram PR #152](https://github.com/metkagram/metkagram.github.io/pull/152) is merged, with 384 normal verification tests and exact-head checks passing. The [production deployment](https://github.com/metkagram/metkagram.github.io/actions/runs/40218161067) passed its release contract, and public robots bytes and selected resources were verified. Local browser E2E remained unavailable without Chromium. These are implementation/deployment results, not evidence of indexing or traffic gains.

## Product focus — Search and recommendation Growth Loop

The existing Resolver, publisher profile, protocol work, scanner, evidence receipts, benchmarks and runtime integrations remain in place. The top-level operating focus is:

> **research current Search/recommendation/AI changes → express applicable mechanisms as testable hypotheses → inspect a real site → implement → verify → measure → review evidence → keep/revise/revert/retire**

## Implemented in the 2026-09-06 loop

### Research and planning

- machine-readable `registry/growth-hypotheses.json` with evidence classes, applicability, checks and success signals;
- public Growth hypothesis surface and `arwp-hypotheses` CLI;
- Growth Profile integration via `hypothesisProgram`;
- Trend Radar with primary-source watch registry and scheduled source-change detection;
- immutable Trend snapshots/diffs;
- `arwp-growth-loop` as the default outcome-driven Agent Skill.

### Implementation evidence

- immutable Growth snapshots and action/observation diffs;
- versioned Growth Experiment records linking hypothesis → active actions → implementation → before/after evidence;
- explicit experiment review decisions: keep, revise, revert, retire or continue measuring;
- negative, mixed and unchanged experiment results preserved.

### Owner outcome evidence

- `arwp-visibility import` for owner-provided CSV/JSON exports;
- Google generative Search impression import;
- Bing AI Performance citation/page/query import;
- AI/referral analytics import with configurable referrer matching;
- aggregate-only visibility snapshots with explicit time windows and source evidence URI;
- no inferred zeroes for unknown export fields.

### Trend learning lifecycle

- deterministic source-to-trend mappings;
- `arwp-trends propose` creates review-required `WATCH -> ADOPT` proposals only for mapped WATCH trends;
- `arwp-trends review` records approve/reject/defer without mutating `trends.json`;
- `arwp-trends measure` aggregates reviewed Growth Experiments by linked action;
- `ADOPT -> MEASURED` proposals require real before/after owner visibility evidence with comparable metrics;
- positive, negative, mixed and unchanged evidence all remain in the denominator;
- `MEASURED` means observed longitudinal evidence exists, not that the effect was positive or causal;
- dedicated Growth Learning CI guards against silent maturity promotion and passes on `main`.

### Packaging and documentation

- Growth, Growth Policy, Growth History, Hypotheses, Growth Experiment, Trend Radar and Trend History tooling exposed through package surfaces;
- `docs/GROWTH-LOOP.md`, `docs/GROWTH-EXPERIMENTS.md`, `docs/GROWTH-LEARNING.md`, Trend Radar/History docs;
- dedicated package, Growth Profile and Growth Learning CI gates.

## Existing foundation retained

- frozen 20-site Resolver decision-quality corpus and regret diagnostics;
- source-backed Search + Agent recommendations ruleset 2026.09;
- `arwp audit` with explicit pass/fail/warn/observed/not-assessed/not-applicable/watch states;
- Search/AI crawler, freshness, IndexNow and browser-agent evaluation tooling;
- multi-standard Resolver, runtime reconciliation, signatures, snapshots/drift and monitoring;
- negative/no-gain evidence preservation.

## Evidence boundary

Repository tests prove internal consistency, not improved ranking, crawling, Discover placement, citation frequency, traffic or conversion. Those outcomes remain owner-side/external measurements. Trend maturity changes remain explicit reviewed repository changes even after evidence becomes eligible.

## Current priority authority

This file is an implementation-status record, not an independent roadmap.

Use live GitHub issues for actionable work and [`../ROADMAP.md`](../ROADMAP.md) for current durable priorities. Reconcile older milestone documents, historical backlogs and this status record against those sources before resuming work.

The retained Resolver/interoperability foundation may continue to receive maintenance and evidence-driven fixes, but old R4 ordering or this file's historical implementation sequence must not override the current proof-first product priorities.
