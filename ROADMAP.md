# Goose ARWP Roadmap

Reviewed: **2026-09-09** after the Goose self-interview loop.

**Goose ARWP — Get Found.**

Goose helps a site become easier for Search and AI systems to discover, understand, verify, cite and route to useful actions. **Agent-Ready Web Profile (ARWP)** remains the technical foundation: schemas, Resolver, evidence contracts, site analysis, transformations and interoperability machinery.

The project is no longer roadmaped as “build a better Resolver first.” Resolver quality remains an important technical workstream, but the product North Star is now an **evidence-backed site improvement loop**.

## Product North Star

> **How many real sites can complete a reviewed Goose loop from intended outcome → observed site state → applicable change → verified deployment → provider-native Search/AI evidence → explicit keep/revise/stop decision?**

Track separately:

1. sites with an explicit purpose / intent boundary;
2. sites with a verified production ref matching the measured implementation;
3. sites with real provider-native Search/AI evidence;
4. experiments reaching a reviewed decision;
5. neutral/negative experiments retained;
6. independent sites/consumers using Goose outside owner-controlled dogfood.

Do **not** collapse these into a Goose score. Feature count, page count, schema count, GitHub stars, Resolver interface count and owner-controlled “wins” are not North Star metrics.

---

# M1 — Proof before more product

**Status: current P0 milestone.**

The immediate goal is to demonstrate that Goose can operate a small number of sites end to end without changing definitions after seeing outcomes.

## Exit criteria

- at least **three owned sites** have an explicit experiment/evidence state;
- each measured treatment has an independently checked production/deployment ref;
- at least two sites have real owner/provider-native Search or AI visibility evidence;
- at least one experiment reaches a human-reviewed `keep`, `revise`, `continue-measuring`, `revert` or `retire` decision;
- negative/neutral evidence remains visible;
- the public Proof Board can render status from committed evidence rather than hand-written success claims;
- no new large protocol/module track is started merely because the proof window is slow.

**Ptichi stays measurement-hold until production parity is independently verified.** Its existing 12 treatment + 6 control cohort is the authoritative cohort; do not manufacture a larger replacement merely to satisfy an old planning number.

## P0 work

| Initiative | Why now |
| --- | --- |
| Portfolio Proof Board (#93) | Make real experiment/deployment/evidence state visible before selling architecture. |
| Real longitudinal Growth/Controlled Cohort evidence (#55, #83) | The largest remaining credibility gap is outcome population, not another schema. |
| Production parity gates | Observation clocks start only when the intended implementation is verifiably live. |
| Provider-native AI/Search evidence | Google AI impressions, Bing citations/grounding evidence and referrals have different semantics and must stay separate. |
| Recommendation review/decay | Weak or contradicted advice should age out instead of accumulating forever. |

---

# M2 — One obvious first-run journey

**Status: P1 after proof instrumentation is stable.**

The external journey should be understandable without learning Goose internals:

```text
TELL GOOSE THE GOAL
        ↓
INSPECT THE REAL SITE
        ↓
DECIDE THE TOP 1–3 MOVES
        ↓
CHANGE SAFELY
        ↓
PROVE IMPLEMENTATION
        ↓
MEASURE OUTCOME
        ↓
WATCH / REVISE
```

Relevant work:

- #92 — owner-declared context / adaptive interview;
- #94 — concise Get Found Brief;
- #96 — first-run journey hiding internal module complexity;
- Site Focus and Intent Ownership stay the existing truth models rather than being duplicated.

The interface should simplify the product, **not** simplify away uncertainty, evidence class or owner-vs-observed conflicts.

---

# M3 — Provider-native Search & AI measurement

**Status: active foundation; next hardening required.**

Goose must model each provider according to the evidence the provider actually exposes.

### Google

Treat Search Console generative-AI visibility as **exposure/impression evidence**. Keep pages/countries/devices/time dimensions where owner exports provide them. Do not relabel these impressions as citations, rankings or ChatGPT-style mentions.

### Bing / Microsoft

Treat AI Performance as **citation/grounding evidence**. Keep page-level citations and grounding-query relationships separate from Search rankings. Intents, Topics and Citation Share are provider-native dimensions and must not be flattened into a universal AI visibility score.

### OpenAI / ChatGPT

Treat OAI-SearchBot access, public Search eligibility and referral observations as separate evidence classes. Crawler access is not a citation result; GPTBot training controls are not Search visibility controls.

### Cross-provider rule

Use a funnel, not a score:

```text
ACCESS
  ↓
INDEX / ELIGIBILITY
  ↓
EXPOSURE
  ↓
CITATION / REFERENCE
  ↓
BRAND MENTION
  ↓
VISIT
  ↓
USEFUL ACTION
```

A provider may expose only some stages. Missing stages remain unknown.

---

# M4 — Evidence-backed content / GEO operations

**Status: active.**

Google's current guidance does not require special AI markup for AI Overviews or AI Mode. Goose therefore treats “GEO” as an evidence-backed extension of good Search/content operations, not an excuse to generate AI-specific files or thin pages.

Keep strengthening existing layers:

- Site Focus — problem/audience/outcome boundaries;
- Intent Ownership — one reviewed page/job per intent family before adding URLs;
- Data Authority — genuine datasets/entities/relationships when they provide standalone value;
- Answer surfaces — direct useful answers, evidence, authorship/provenance and clear continuation paths;
- entity graph / structured data — only where it represents visible facts;
- freshness/review dates — meaningful changes, not timestamp theater;
- page value gate — demand + unique value + standalone usefulness + canonical identity before indexable expansion;
- original evidence/tools/examples over commodity text.

The goal is not “more pages.” The goal is more **useful, ownable, verifiable information surfaces** that can earn Search/AI discovery.

---

# M5 — Portfolio maintenance and scale

**Status: later commercial leverage, after proof.**

Once the proof loop is real on several sites, Goose Watch / portfolio capabilities become much more valuable:

- multi-site source/rule blast radius;
- scheduled re-review;
- provider policy drift;
- deployment/evidence queues;
- approved change waves;
- portfolio policy-as-code;
- owner-data connectors;
- verified stack transformation packs.

The commercial value is maintenance, evidence, governance and scale — not a ranking guarantee.

---

# Technical foundation workstreams

These remain important but are **supporting engines**, not the public journey.

| Engine | Current role |
| --- | --- |
| Resolver / protocol adapters | Discover and normalize real machine interfaces with provenance. |
| Site Focus + Intent Ownership | Define problem, audience, route and intent boundaries. |
| Growth / Recommendation Registry | Turn current evidence into applicable candidate work. |
| Repository Mapper / Transformation packs | Resolve source ownership and prepare deterministic changes. |
| BraidGraph | Preserve evidence → rule → site → recommendation → change → proof relationships and reverse impact. |
| Evidence / Change Receipts | Preserve what was observed, changed and verified. |
| Controlled Cohorts / Winner Observatory | Run bounded longitudinal discovery experiments. |
| Recommendation Review | Age, challenge, revise and retire advice. |
| Project Maturity Surfaces | Keep identity, rights, governance and collaboration inspectable. |

## Resolver decision-quality gate

The existing reviewed Resolver evidence still matters. Do not weaken it, rewrite frozen truth or add hostname-specific exceptions. However, new Resolver/protocol breadth is lower priority than real site evidence unless a concrete interoperability failure blocks a current Goose workflow.

---

# Stop / deprioritize rules

Until M1 has real evidence:

- do not create a new top-level product module without a demonstrated user job;
- do not create AI-specific markup/files merely because a third party calls them “GEO”;
- do not expand URL counts before intent/page value gates;
- do not treat crawler access as citation evidence;
- do not treat citation as brand mention, traffic or conversion;
- do not start new protocol adapters without a concrete blocked workflow or interoperability case;
- do not rewrite experiments after observing winners;
- do not use policy/trust page count as maturity;
- do not hide neutral or negative results;
- do not replace provider-native metrics with one composite score.

Surface lifecycle work in #95 should actively consolidate or retire low-job/duplicative surfaces over time.

---

# Current execution order

1. keep the production/CI baseline green;
2. keep Ptichi on HOLD until exact production parity is observed;
3. build the portfolio Proof Board from committed evidence (#93);
4. populate at least two additional real owned-site experiment states without inventing outcomes;
5. harden provider-native AI/Search measurement semantics and imports;
6. run Recommendation Review on real reviewed outcomes;
7. implement the simplified first-run/Get Found Brief only against the existing evidence engines (#92, #94, #96);
8. dogfood Surface Budget / Retirement Gate on Goose (#95);
9. only then increase portfolio automation / Watch scale;
10. continue Resolver/protocol work when a real Goose workflow demonstrates the need.

# Decision rule

> **When forced to choose between another capability and another trustworthy real-site evidence loop, choose the evidence loop.**
