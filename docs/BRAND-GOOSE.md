# Goose ARWP visual identity

Identity revision 1.2 — 2026-09-09.

**Goose ARWP** is the canonical product-facing name. **Goose** is the short form used in conversational copy and module names. **Agent-Ready Web Profile** remains the technical foundation, and **ARWP** remains its established technical abbreviation; package names, CLI commands, canonical URLs and entity IDs retain their existing identity. No registered or cleared trademark status is asserted.

The preferred display lockup is **“Goose ARWP — Get Found.”** The primary tagline is **“Get Found.”** It states the user goal without promising rankings, citations or traffic. Use measured results to describe actual discovery outcomes.

## Product focus before visual expansion

Goose should model the same discipline it recommends to other sites: **own a problem, not a pile of adjacent topics**.

Its primary problem territory is helping a useful, focused website decide which Search/AI/agent-web improvements actually apply, implement them safely, preserve evidence and learn from observed outcomes.

Goose does:

- define and inspect applicable website improvements;
- improve discoverability, answer usefulness, evidence and machine-readable routes;
- preserve source, implementation and measurement lineage;
- expose specialist technical tools when they support that core problem.

Goose does not:

- promise rankings, citations or recommendations;
- become a general SEO/AI-news content mill;
- reward publishing volume without a clear page job;
- treat ARWP as a universal replacement for native standards;
- compress heterogeneous evidence into an opaque readiness score.

Before adding another first-class site section, use the [Site Focus playbook](site-focus.html) and `arwp-site-focus` skill. A distinct problem territory may deserve a separate resource rather than another navigation level.

## Information architecture

The public website follows a problem-first hierarchy. The current house heuristic is **1 primary problem territory, up to 3 homepage problem lanes, up to 5 primary navigation destinations and 1 dominant action per page**. These are clarity heuristics, not Search/AI ranking requirements.

The homepage routes visitors through three first-order problems:

1. **Be found** — can people and machines reach the useful surface?
2. **Be used** — is the answer, evidence, tool or comparison worth using?
3. **Be proven** — did the implemented change produce an observed outcome?

Protocols, resolver internals, directories, benchmarks, standards and research infrastructure remain accessible as technical depth, but do not compete with those problem lanes for the site's top-level identity.

Every primary page should have a page job, primary question, in-scope and out-of-scope boundary, proof/evidence mechanism, one dominant next action and one canonical parent hub.

## Voice and public copy

Goose should sound like a knowledgeable person explaining something useful, not like a dashboard, audit log or vendor setup guide.

Use clear, semi-formal language. Start with the reader's question, choice or outcome. Keep technical names in the background unless they are genuinely needed to understand the decision. In particular, primary copy should not advertise analytics providers, tag managers, frameworks, protocol names or internal scoring/checking machinery when a simple human explanation is enough.

For optional measurement, explain the choice directly — for example, that it helps us understand which pages are useful and that it starts only after permission. Put implementation detail in technical documentation when it is needed for verification.

## Editorial review before publication

Goose should explain itself as if a thoughtful website owner had asked a practical question. Do not write for an imagined AI evaluator. Technical accuracy belongs in the explanation and supporting detail, not in every headline.

For every public page, recommendation, notice or generated plan, run these four passes:

1. **Reader:** Can someone name the problem and first useful action after reading the opening? If not, rewrite the opening.
2. **Practitioner:** Does the advice say where to start, what would change, what to check and when not to use it? Keep a worked example if possible; mark hypothetical examples clearly.
3. **Skeptic:** Is a reported result actually measured? Are missing reports, uncertain causes and alternative choices visible? Never fabricate experience, testimonials or conversion evidence.
4. **Editor:** Read the headings and notices aloud. Cut abstract nouns, repeated claims, unnecessary provider names and strings of internal terms. Keep any essential caveat close to the recommendation.

**Before → after examples (fictional writing examples, not outcomes):**

- "Enable cross-channel analytics instrumentation for downstream outcome attribution" → "Want to know whether a page helped? Start by checking relevant visits and whether visitors took the next useful step."
- "Improve entity resolution and machine-readable content surfaces" → "Make the page clear about what you offer, who it is for and where to go next."
- "Apply evidence-based discovery optimization tactics" → "Check why a useful page is hard to find. Fix the obstacle you can verify before writing another article."

Keep the underlying source, version, checks, contracts and licensing truthful. Do not delete important constraints to make a sentence feel easier. Use technical headings only when the section exists to teach a technical task. For optional statistics, say what the visitor agrees to and what is sent; don't call third-party measurements anonymous without verification.

A successful editorial change must survive review in the **canonical source**, the **published page**, and any **generated recommendation surface**. After editing a catalog, rebuild dependent pages and check stable IDs, anchors, search summaries, machine descriptions and the current software license against `LICENSE`.

## Visual identity

The website uses a bright editorial direction: lime `#eff600`, ink `#080c0b`, warm white `#fafaf7`, orange `#ff7138` and blue evidence links `#173bea`. Inter Tight is self-hosted under the included SIL Open Font License. System monospace distinguishes source and version metadata.

Use large editorial typography, high-contrast color fields, clear borders and a small number of strong compositional moves instead of dashboard-style widget noise. Brightness should come from hierarchy and palette, not animation or heavy client-side frameworks.

The goose illustration carries “Show your sources.” Its purpose is recognition and tone; it is not a customer, reviewer or evidence of product impact. The [asset provenance](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/media/cite-goose/illustration-provenance.json) records generation, encoding and checksum; [font provenance](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/media/cite-goose/font-provenance.json) records its upstream distribution and license.

Use a clear primary action and readable editorial rows. Keep implementation detail in expandable/secondary technical depth when it is not the visitor's first job. Source retrieval, individual pattern review, implementation checks and measured outcomes have different labels. Counts come from the actual corpus, and a missing review date stays unknown.

## Performance and accessibility

The brand should remain recognizable in mostly static HTML/CSS. Core content must not depend on third-party JavaScript. Self-hosted fonts stay limited, image dimensions are explicit, non-critical media should be lazy-loaded, and decorative motion must not be required for comprehension. Preserve visible focus states, semantic headings, contrast and narrow-screen usability.

Use field Core Web Vitals where available and lab checks as diagnostics. Do not market a lab score, byte count or synthetic timing as proof of search/recommendation success.

The [previous SignalBraid direction](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/BRAND-SIGNALBRAID.md) remains a historical design reference. It does not describe the current public name.