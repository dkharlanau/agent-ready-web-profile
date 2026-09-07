# SignalBraid Repository Mapper / Site State Graph

Status: **v0.1 foundation · static HTML + Jekyll · 2026-09-07**.

Repository Mapper is the `Map` layer between an Adaptive Upgrade recommendation and a deterministic repository transformation.

Its job is deliberately narrow:

> **Given a repository and the site source root, which repository file can be proven to own a rendered route or machine/metadata surface?**

It does not choose editorial truth, authorize mutation, infer ranking impact or guess a source path when ownership is ambiguous.

## Why this layer exists

Before Repository Mapper, ARWP could already:

1. audit a deployed site;
2. compile target-specific Adaptive Upgrade recommendations;
3. apply an exact digest-gated Transformation Bundle once an agent supplied the owning file.

The weak link was step 2 → 3. Crawling a page can show that a canonical, title or JSON-LD surface exists, but cannot by itself prove which repository source owns that value.

Repository Mapper records that ownership evidence explicitly.

```text
public route / metadata surface
          ↓
Site State Graph ownership claim
          ↓
resolved | ambiguous | unresolved
          ↓
exact repo source + build path + source fact
          ↓
BraidGraph repo-file → renders → surface
          ↓
optional transformation path hint
```

Only `resolved` ownership produces a BraidGraph `renders` edge.

## Supported adapters

### `static-html`

Deterministic direct-file mapping for plain/static HTML and GitHub Pages repositories where source HTML is versioned.

Examples:

```text
index.html       → /
guide/index.html → /guide/
about.html       → /about.html
robots.txt       → /robots.txt
```

The adapter extracts direct ownership for:

- document route;
- `<title>`;
- meta description;
- canonical link;
- robots meta;
- JSON-LD presence;
- `robots.txt`;
- sitemap XML;
- `llms.txt`;
- selected agent/API discovery files.

### `jekyll`

Deterministic/explicit mapping for Jekyll pages.

The adapter uses:

- `_config.yml` / `_config.yaml` and Jekyll repository signals;
- explicit front-matter `permalink` when present;
- Jekyll page path convention for ordinary page files;
- `_layouts` and `_includes` as build-path evidence;
- front-matter scalar values as first-party source facts.

A post/collection path that needs additional Jekyll configuration is **not guessed**. Without an explicit resolvable permalink, it remains `unresolved`.

## Compile

For a GitHub Pages project served from `docs/`:

```bash
node bin/arwp-map-repo.mjs compile \
  --root=. \
  --site-root=docs \
  --repository=owner/site \
  --site=https://owner.github.io \
  --base-path=/site/ \
  --base-ref=main \
  --base-sha=<40-character-sha> \
  --out=.arwp/site-state.json
```

`--site-root` is repository-relative and defaults to `.`.

Supported `--adapter` values are `auto`, `static-html`, and `jekyll`. `auto` is preferred when the mapper can detect the stack from repository evidence.

## Validate

```bash
node bin/arwp-map-repo.mjs validate .arwp/site-state.json
```

Validation includes both JSON Schema and semantic checks:

- a `resolved` route/ownership claim must reference a file actually present in the graph;
- an `ambiguous` or `unresolved` claim must not silently select `ownerPath`;
- repository/base/site evidence remains explicit.

## Resolve ownership

Exact surface key:

```bash
node bin/arwp-map-repo.mjs resolve .arwp/site-state.json \
  --surface=metadata:/:canonical
```

Route + surface type:

```bash
node bin/arwp-map-repo.mjs resolve .arwp/site-state.json \
  --route=/ \
  --type=canonical
```

If the surface is absent, the answer is `unresolved`, not a guessed file path.

## Ambiguity is a first-class result

If two Jekyll files both declare:

```yaml
permalink: /about/
```

Repository Mapper records both candidates and sets:

```json
{
  "state": "ambiguous",
  "ownerPath": null
}
```

That ambiguity is preserved downstream. BraidGraph receives the surface but **no `renders` edge** until ownership is resolved by better evidence.

## Source facts

Jekyll front matter and direct static HTML metadata can emit first-party source facts with an exact repository path and locator.

Example:

```json
{
  "key": "product_name",
  "value": "SignalBraid",
  "routePath": "/",
  "sourcePath": "index.md",
  "locator": {
    "line": 7,
    "field": "product_name"
  },
  "evidenceClass": "frontmatter"
}
```

A fact is source evidence. It is not automatically permission to publish, rewrite or infer adjacent claims.

## Build-path evidence

For Jekyll, a resolved route can preserve a deterministic build chain such as:

```text
index.md
  → _layouts/default.html
  → _includes/head.html
  → _config.yml
```

The route owner remains `index.md`; layouts/includes are build dependencies, not silently promoted to value ownership.

## Adaptive Upgrade ownership hints

Repository Mapper can resolve known recommendation target vocabulary against mapped surfaces:

```bash
node bin/arwp-map-repo.mjs upgrade-hints \
  adaptive-upgrade.json \
  .arwp/site-state.json
```

The output can identify one exact owner for known surfaces such as canonical, title, description, robots, sitemap, JSON-LD, `llms.txt`, OpenAPI and agent discovery.

`allowedPathHints` are emitted only when:

- one mapped surface has one proven owner;
- the recommendation automation class is `mechanical` or `grounded-template`;
- the mapped surface is not policy-gated, editorial, runtime, owner-platform or blocked.

An allowed-path hint is still **not a Transformation Bundle**. Exact operation content, before-state digest, grounding and authorization remain Transformation Engine responsibilities.

## BraidGraph integration

Merge proven repository ownership into an existing BraidGraph:

```bash
node bin/arwp-map-repo.mjs braid \
  braid.json \
  .arwp/site-state.json \
  --out=braid-with-map.json
```

Then inspect the mapping evidence:

```bash
node bin/arwp-map-repo.mjs braid-report braid-with-map.json
```

The integration:

- records the exact Site State Graph digest in `inputs.repositoryMap`;
- refuses site/repository/base-commit conflicts;
- reuses compatible Transformation Bundle repo-file nodes when possible;
- refuses a file digest that conflicts with the Transformation Bundle before-state;
- creates `repo-file → renders → surface` only from `resolved` ownership;
- preserves ambiguous surfaces without inventing a file owner;
- carries repository source facts as provenance-bearing BraidGraph fact nodes.

A graph that already references a different Repository Map cannot silently replace it. Compile a fresh graph so historical evidence is not overwritten.

## Mutation classes

Repository Mapper records a surface/file mutation class for downstream policy decisions:

- `mechanical`;
- `grounded-template`;
- `editorial`;
- `policy-gated`;
- `runtime`;
- `owner-platform`;
- `blocked`.

Examples:

- canonical: `grounded-template`;
- title/description: `editorial`;
- robots controls: `policy-gated`;
- structured data: `grounded-template`.

These labels constrain automation; they do not authorize it.

## Filesystem safety

The mapper is local and read-only.

- symbolic links are not followed;
- `..` repository paths are rejected;
- generated/output directories such as `_site`, `.next`, `dist` and `build` are skipped as ownership sources;
- file count and file size are bounded;
- no shell command from the target repository is executed;
- the mapper does not build Jekyll or execute Liquid/plugins to manufacture ownership evidence.

This is intentional: the Map layer should be safer than arbitrary framework execution.

## Current limitations

v0.1 deliberately does not claim support for:

- Next.js ownership where routes depend on runtime/server components or generated manifests;
- Astro/Docusaurus ownership without dedicated adapters;
- WordPress/Shopify content ownership as local files;
- Jekyll collection/post routing that requires unresolved config/plugin execution;
- Liquid-computed metadata values that do not have a direct source fact.

Those should be added as evidence-backed adapters, not generic path heuristics.

## Verification

Dedicated CI covers:

- static GitHub Pages fixture;
- Jekyll fixture;
- duplicate-route ambiguity;
- unresolved Jekyll content;
- front-matter fact ownership;
- mutation gating;
- BraidGraph `renders` integration;
- mismatched site rejection;
- generated-output exclusion;
- symlink exclusion where the platform permits symlink creation.

The workflow also dogfoods the current ARWP `docs/` GitHub Pages source on every relevant change.

## Guardrails

- mapped ownership is evidence, not authorization;
- ambiguity is preserved;
- generated output is not preferred over source;
- missing ownership remains unknown;
- policy/editorial decisions remain gated;
- no ranking, recommendation or AI-citation guarantee follows from a successful map.

## Next adapters

1. harden static/Jekyll against more real-site fixtures;
2. Next.js only where source ownership is provable from framework-native evidence;
3. Astro;
4. Docusaurus/documentation generators;
5. explicit CMS/API ownership adapters for systems where content is not file-owned.
