# Entity Graph Gap Report

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/entities/gaps/

ARWP samples a bounded set of public same-site pages and reports structural entity-graph gaps without producing a ranking score.

Observed families:
- Person
- Organization
- Product
- SoftwareApplication / WebApplication
- Service
- Dataset
- Event family
- DefinedTerm
- Article family

Checks:
- stable absolute `@id`;
- visible-name parity;
- useful observed entity page;
- truthful graph relations;
- family-specific evidence such as Service provider, Dataset creator/license, Article author and Event date/location.

Run:

`node bin/arwp-entities.mjs https://example.com`

This Markdown file is a repository-only source/agent companion. The canonical Search surface is the HTML page above.
