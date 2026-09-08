# Discoverability knowledge library

`discoverability-corpus.json` is the canonical machine-readable practice corpus. The 1.1.0 edition contains 144 tactics across 16 categories and references 60 primary sources checked on 2026-09-08. It separates documented mechanisms, inferred workflows, and experimental ideas. It does not encode a ranking formula.

Each tactic includes a stable ID, problem, implementation steps, verification criteria, source IDs, applicability, effort, impact hypothesis, anti-pattern, and measurement method. IDs are durable references: preserve them when refining wording and introduce a new ID only when the underlying tactic changes substantially.

`growth_hypothesis_ids` routes each practice into the existing [Growth Hypotheses registry](../registry/growth-hypotheses.json); `recommendation_rule_ids` links relevant [current recommendations](../registry/search-agent-recommendations.json). These are references, not duplicated rule definitions. A related hypothesis supplies workflow context without endorsing every implementation detail. An empty rule array explicitly means no matching current recommendation. The original evidence level remains unchanged, and native applicability, check modes and owner-data gates remain authoritative.

Use `arwp discoverability --hypothesis=platform-ai-measurement --rule=google-generative-ai-measurement --json` to select practices from existing routing decisions. An `adoption-plan` is a saved practice selection for the Growth Loop; it does not replace the live `arwp-growth` audit, create verified site actions, or establish outcomes. Carry applicable selections into the site's normal adoption record and measurement workflow.

The source registry's notes state support boundaries. A reference can establish an underlying capability while the tactic proposes an original workflow; these are deliberately labeled `inferred` or `experimental`. Observed documentation patterns do not establish the cause of another site's search performance.

`source-link-checks.json` records a separate bounded HTTP check. Successful retrieval does not establish semantic support, indexing, ranking, or independent adoption. A network error in this check does not erase a source reviewed through browser retrieval; retain the specific observation rather than manufacturing a successful status.

Use [the Growth Loop](../docs/GROWTH-LOOP.md), [the playbook](../docs/DISCOVERABILITY-PLAYBOOK.md) and [editorial examples](../docs/examples/editorial/README.md) to apply the corpus. Source review should revisit the supporting passage, not merely check that a link still returns 200. The JSON is the maintained artifact; no hidden generator is required to edit it.
