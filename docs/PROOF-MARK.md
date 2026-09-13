# Goose ARWP Proof Mark

Status: experimental product surface, v0.1.

The **Goose ARWP Proof Mark** is a small, static, footer-friendly representation of a dated ARWP audit snapshot. It makes evidence discoverable without flattening heterogeneous website evidence into a score, certification, approval or endorsement.

A valid mark links to Goose ARWP methodology and, when available, a site-specific evidence report. It does not assert certification, approval, partnership, ranking eligibility, indexing, AI citation, accessibility conformance, security assurance, legal compliance, business impact or future performance.

## States

- `REVIEWED` — whole-site coverage (`complete`, `runtime-complete` or `template-runtime-complete`) with no recorded P0/P1 findings in the snapshot.
- `ATTENTION` — whole-site coverage with recorded P0/P1 findings.
- `PARTIAL` — some pages or applicable checks were sampled, capped, skipped or otherwise not fully covered. The compact mark must say `scope incomplete` rather than implying zero high-priority findings.
- `UNKNOWN` — important inventory/evidence could not be reconciled.

The coverage semantics come from `registry/comprehensive-site-audit.json`. A bounded check must never be relabelled as whole-site coverage merely to obtain a better-looking mark.

## Embed policy

Prefer a footer, trust/about surface or evidence-adjacent location. Keep the mark subordinate to the host site's content. Do not use percentages, stars, 0–100 scores, `Certified`, `Approved`, or other wording that implies a universal quality guarantee.

For a `PARTIAL` rollout without a published site-specific report, link the mark to the Goose ARWP product/methodology page and identify the scope as incomplete. Upgrade the mark only after a newer auditable snapshot justifies it.

Canonical Goose ARWP product page: https://dkharlanau.github.io/agent-ready-web-profile/product/
