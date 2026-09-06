# ARWP implementation loop status

Started: 2026-08-26
Integrated into: `main`
Last major implementation review: 2026-09-06

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
- dedicated Growth Learning CI guards against silent maturity promotion and currently passes on `main`.

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

## Next loop

- managed longitudinal operation in target repositories: retain snapshots/experiments, show changes since the previous run and surface experiments awaiting measurement/review;
- portfolio rollout: map applicable ADOPT trends to target sites and generate target-specific implementation proposals;
- deeper vertical adapters only where upstream evidence is strong;
- stronger search-appearance identity checks and safe patch-manifest generation;
- continue Resolver decision-quality and independent interoperability work as the technical foundation.
