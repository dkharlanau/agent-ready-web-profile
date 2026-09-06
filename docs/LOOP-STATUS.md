# ARWP implementation loop status

Started: 2026-08-26
Integrated into: `main`
Last major implementation review: 2026-09-06

## Product-focus shift — Search and recommendation Growth Loop

The existing Resolver, publisher profile, protocol work, scanner, evidence receipts, benchmarks and runtime integrations remain in place. The top-level operating focus is now:

> **research current Search/recommendation/AI changes → express applicable mechanisms as testable hypotheses → inspect a real site → implement → verify → measure → keep/revise/revert**

Implemented in the 2026-09-06 loop:

- machine-readable `registry/growth-hypotheses.json` with evidence classes, applicability, checks and success signals;
- public `/growth/hypotheses.json`;
- `arwp-hypotheses` CLI;
- Growth Profile integration via `hypothesisProgram`;
- `arwp-growth-loop` as the default outcome-driven Agent Skill;
- durable Growth checklist and hypothesis ledger;
- dedicated hypothesis CI validation;
- growth-first README, agent instructions, skill catalog and public Growth page;
- Resolver retained as the interoperability foundation and `arwp-prepare-site` retained for initial technical adoption.

Default priority remains evidence-weighted: platform requirements and high-confidence guidance before optional features; project experiments stay out of the default Growth plan.

## Existing foundation retained

- frozen 20-site Resolver decision-quality corpus and regret diagnostics;
- source-backed Search + Agent recommendations ruleset 2026.09;
- Trend Radar with WATCH / ADOPT / MEASURED lifecycle;
- `arwp audit` with explicit pass/fail/warn/observed/not-assessed/not-applicable/watch states;
- Search/AI crawler, freshness, IndexNow, visibility evidence and browser-agent evaluation tooling;
- multi-standard Resolver, runtime reconciliation, signatures, snapshots/drift and monitoring;
- negative/no-gain evidence preservation.

## Evidence boundary

Repository tests can prove internal consistency. They do not prove improved ranking, crawling, Discover placement, citation frequency, traffic or conversion. Those outcomes remain owner-side/external measurements and should feed back into the hypothesis ledger.

## Next loop

- run Growth Loop against real target sites and capture before/after owner evidence where available;
- expand hypotheses only when primary-source changes or measured results justify it;
- add richer page/content audits without inventing a universal quality score;
- continue Resolver decision-quality and independent interoperability work as the technical foundation.
