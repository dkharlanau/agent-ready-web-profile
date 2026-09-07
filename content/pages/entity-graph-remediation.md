# Entity Graph Remediation Engine

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/entities/remediation/

ARWP converts Entity Graph Gap Reports into proposal-only remediation manifests.

Two modes:

1. gap report only -> classify safe review lanes;
2. gap report + local first-party repository -> find grounded facts and target files, then emit review-required patch proposals.

A JSON Patch proposal is allowed only when the value already exists in first-party repository evidence for the same entity. The engine never writes target files and never invents authors, licenses, prices, ratings, reviews, events, people, credentials or relationships.

Main command:

```bash
node bin/arwp-entity-remediation.mjs entity-gap-report.json --repo-root=. --output=entity-remediation.json
```
