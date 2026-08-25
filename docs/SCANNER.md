# Website scanner and profile bootstrap

ARWP includes a bounded discovery pass for existing public HTTPS websites. The scanner is designed to answer a practical adoption question:

> Which machine-readable surfaces can be directly observed on this site, and what minimal ARWP profile can be generated without inventing capabilities?

It is intentionally conservative. It is not a general crawler, vulnerability scanner, SEO grader or browser-agent evaluator.

## Scan a site

From a repository checkout:

```bash
node bin/arwp.mjs scan https://example.com
```

After the npm package is published, the intended equivalent will be:

```bash
npx agent-ready-web-profile scan https://example.com
```

Machine-readable output:

```bash
node bin/arwp.mjs scan https://example.com --json
```

Optional limits:

```bash
node bin/arwp.mjs scan https://example.com --timeout=5000 --max-bytes=262144
```

The scan fetches the homepage and a small documented set of discovery resources. It currently looks for:

- canonical page metadata and HTML language;
- `/robots.txt`;
- sitemaps declared by `robots.txt` and the conventional `/sitemap.xml` path;
- explicitly linked or conventional `/llms.txt`;
- RSS, Atom and JSON feeds explicitly linked from HTML;
- OpenAPI documents explicitly linked with `rel="service-desc"`;
- an explicitly linked or conventional `/ai/site-profile.json`, which is syntax-validated when present.

The scanner does not turn page text such as “supports MCP” into a capability declaration.

## Generate a draft profile

```bash
node bin/arwp.mjs init https://example.com
```

By default this writes:

```text
ai/site-profile.json
```

Choose another path:

```bash
node bin/arwp.mjs init https://example.com --output=public/ai/site-profile.json
```

Existing files are not overwritten unless `--force` is supplied.

Every generated draft is passed through the existing ARWP validator before it is written. The generated `$schema` points to the immutable v0.1.0 schema tag rather than the moving `main` branch.

After generation:

```bash
node bin/arwp.mjs validate ai/site-profile.json
```

Then review the profile manually. Add capabilities only when the corresponding public implementation actually exists.

## GitHub Pages / static-site example

Suppose a GitHub Pages repository publishes from its repository root and the live site is:

```text
https://example.github.io/project/
```

From a local ARWP checkout, generate a draft into the site repository:

```bash
node /path/to/agent-ready-web-profile/bin/arwp.mjs scan https://example.github.io/project/
node /path/to/agent-ready-web-profile/bin/arwp.mjs init https://example.github.io/project/ --output=ai/site-profile.json
```

Commit the generated file so it is published at a stable public URL, normally:

```text
https://example.github.io/project/ai/site-profile.json
```

Then add ARWP validation to that repository's workflow:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

The profile must point to canonical live URLs rather than local source paths. If the Pages build copies assets from another source directory, place `site-profile.json` in whichever source path maps to `/ai/site-profile.json` in the deployed site.

## What is deliberately not inferred

The bounded scanner does not currently claim to detect or verify:

- Agent Skills from prose or directory names;
- WebMCP from static HTML, because tool exposure is a browser/runtime behavior;
- MCP from marketing text, because a real server/runtime or Registry entry must be checked;
- A2A from filenames alone, because Agent Card semantics and the actual agent service must be validated;
- arbitrary data catalogs, retrieval indexes or trust metadata without an explicit discovery relationship.

These groups are reported as `not-assessed`, not as absent. Protocol-specific adapters can be added later using upstream validators rather than duplicating those protocols inside ARWP.

## Network and SSRF boundaries

The scanner is built so the same discovery engine can later sit behind a small public scanning service without becoming an arbitrary fetch proxy.

Current protections include:

- HTTPS-only targets;
- no URL credentials;
- standard HTTPS port only;
- rejection of localhost, local/internal hostnames and private/reserved IP addresses;
- DNS resolution checks before requests;
- the same checks after every redirect;
- a maximum of five redirects;
- per-request timeouts;
- bounded response bodies;
- a small finite candidate set rather than recursive crawling.

A hosted scanner should additionally apply request rate limiting, deployment-specific egress policy and abuse controls.

## Evidence model

`scan --json` separates observed evidence from unassessed capability groups. There is intentionally no single “AI readiness” score.

A result should be inspectable:

- where a resource was discovered;
- which URL responded;
- which capability groups were actually assessed;
- which advanced groups still need protocol/runtime verification;
- which warnings occurred during bounded discovery.

This keeps profile generation evidence-based and avoids rewarding sites for publishing empty badges or speculative metadata.
