# ARWP AI Site Bootstrap Bundle

This bundle is for AI coding agents preparing an existing website repository under ARWP.

Start with the portable skill:

```text
arwp-prepare-site
```

Machine decision map:

```text
templates/adoption/bootstrap-manifest.json
```

The manifest intentionally distinguishes **always-review** items from **conditional artifacts**. Agents should adapt the target repository's existing framework and deployment model instead of copying every template into every site.

Recommended flow:

1. inspect the repository and deployment model;
2. run a live `arwp audit` / `arwp-growth` baseline when possible;
3. fix P0 crawl/index blockers;
4. improve P1 entity/content/freshness/navigation quality;
5. add only useful agent-facing surfaces;
6. add assertion/evidence/recurring checks where valuable;
7. run the target site's own build/tests and ARWP verification.

Reusable templates live in `templates/growth/`.

The bundle is implementation assistance, not a ranking system. It does not claim that adopting ARWP, Agent Skills, `llms.txt`, JSON-LD, or other metadata guarantees ranking, citation, recommendation, or agent task success.
