# SignalBraid Repository Mapper / Site State Graph

Status: **v0.1 · static HTML + Jekyll + Astro + Next.js App Router · 2026-09-07**.

Repository Mapper is the `Map` layer between an Adaptive Upgrade recommendation and a deterministic repository transformation. Its narrow question is:

> Given a repository and site source root, which repository file can be proven to own a public route or machine/metadata surface?

It records `resolved | ambiguous | unresolved` ownership with source digests and build-path evidence. It does not choose editorial truth, authorize mutation, execute target build code, infer ranking impact, or guess missing ownership.

```text
public route / machine surface
          ↓
Site State Graph
          ↓
resolved | ambiguous | unresolved
          ↓
exact repository source + SHA-256 + build path
          ↓
BraidGraph / Transformation preparation
```

Only resolved ownership is eligible for downstream source-path hints. Those hints still do not authorize mutation.

## Supported adapters

### `static-html`

Direct mapping for versioned HTML/static GitHub Pages sources.

```text
index.html       → /
guide/index.html → /guide/
about.html       → /about.html
```

The adapter can record document ownership plus literal title, description, canonical, robots meta, JSON-LD presence and selected machine files.

### `jekyll`

Evidence-backed Jekyll mapping using `_config.yml` / `_config.yaml`, Jekyll repository signals, explicit front-matter `permalink`, ordinary Jekyll page conventions, and `_layouts` / `_includes` build dependencies.

Post/collection routes that require unresolved configuration or plugin execution remain `unresolved`; the mapper does not run Liquid or Jekyll to manufacture ownership evidence.

### `astro`

Astro v0.1 maps only framework-native ownership that can be established without executing Astro or target repository code.

Evidence sources include:

- `astro.config.mjs|js|ts|cjs` and/or an `astro` package dependency;
- documented file-based routing from static files in `src/pages`;
- inspectable literal routing/build configuration;
- exact relative `.astro` imports for component/layout build-path evidence;
- exact machine files copied from `public/`.

Dynamic bracket routes, `getStaticPaths()` expansion, unresolved i18n/configuration, and runtime/server output fail closed unless static ownership is directly inspectable. Generated `dist/`, `.astro/`, `build/` and similar output is never preferred as source authority.

### `nextjs`

Next.js v0.1 is intentionally narrower than a general Next.js parser. It supports **App Router source ownership only** and does not execute Next.js, React, Server Components, route handlers, middleware/proxy code, or application imports.

Detection evidence:

- `next.config.js|mjs|cjs|ts` and/or a `next` package dependency;
- exactly one App Router source root: `app/` or `src/app/`.

Static App Router page ownership is resolved only when the file path itself proves the public path:

```text
src/app/page.tsx                    → /
src/app/about/page.tsx              → /about/
src/app/(marketing)/pricing/page.tsx → /pricing/
```

Route groups such as `(marketing)` do not become URL segments. Bracket routes such as `[locale]`, `[slug]` or catch-all segments remain `unresolved`; no concrete path is invented. Parallel/intercepting routing is also unresolved.

The adapter records exact ancestor `layout.*`, `next.config.*` and `package.json` files in the page build path where present. It detects `generateMetadata()` but does **not** infer field-level metadata values from executable code.

Root App Router metadata routes are source-owned directly:

```text
src/app/sitemap.ts  → /sitemap.xml
src/app/robots.ts   → /robots.txt
src/app/manifest.ts → /manifest.webmanifest
```

`robots.ts` remains `policy-gated`. Mapping a crawler-policy source never turns it into an automatically mutable surface.

Routing fails closed when a critical value is not inspectable:

- computed `basePath`;
- rewrites that can change public route interpretation;
- dynamic/parallel/intercepting segments;
- Pages Router-only repositories in v0.1.

Redirects and response headers are recorded as warnings rather than executed. A literal configured `basePath` must agree with the requested site base path. Generated `.next/`, `out/`, `dist/`, `build/` and `.vercel/` output is excluded as source authority.

## Compile

```bash
node bin/arwp-map-repo.mjs compile \
  --root=. \
  --site-root=. \
  --repository=owner/site \
  --site=https://example.com \
  --base-path=/ \
  --base-ref=main \
  --base-sha=<40-character-sha> \
  --adapter=auto \
  --out=.arwp/site-state.json
```

Supported `--adapter` values:

```text
auto | static-html | jekyll | astro | nextjs
```

`auto` uses explicit framework evidence first. If more than one supported framework signal coexists at the same site root, detection stops with an error rather than choosing one silently.

For Astro, literal `site` / `base` identity must agree with the requested public site. For Next.js, literal `basePath` must agree with the requested base path. Identity conflicts are hard failures because a graph tied to the wrong public URL is unsafe.

## Validate and resolve

```bash
node bin/arwp-map-repo.mjs validate .arwp/site-state.json

node bin/arwp-map-repo.mjs resolve .arwp/site-state.json \
  --route=/ \
  --type=canonical
```

Validation includes JSON Schema plus semantic checks: resolved route/surface owners must exist in `files[]`, while ambiguous/unresolved claims must not silently select an owner.

## Ambiguity is a first-class result

If several sources could own the same public surface, the graph records candidates instead of selecting one opportunistically:

```json
{
  "state": "ambiguous",
  "ownerPath": null
}
```

Downstream layers must preserve this state. More automation is not a valid reason to erase ambiguity.

## Build-path evidence

Examples:

```text
# Jekyll
index.md → _layouts/default.html → _includes/head.html → _config.yml

# Astro
src/pages/index.astro → src/layouts/Base.astro → astro.config.mjs → package.json

# Next.js App Router
src/app/about/page.tsx → src/app/layout.tsx → next.config.ts → package.json
```

Only dependencies the adapter can establish without arbitrary target-code execution are recorded.

## Machine surfaces

Mapped source-owned machine surfaces may include:

- `robots.txt` / Next.js `robots.ts`;
- sitemap XML / Next.js `sitemap.ts`;
- `llms.txt` where the stack exposes an actual file-owned surface;
- selected agent-discovery files;
- OpenAPI descriptions;
- Next.js manifest metadata routes.

Mutation classes remain explicit. Crawler policy stays policy-gated and editorial surfaces are not reclassified as mechanical simply to increase automation coverage.

## Adaptive Upgrade and BraidGraph integration

```bash
node bin/arwp-map-repo.mjs upgrade-hints adaptive-upgrade.json .arwp/site-state.json
node bin/arwp-map-repo.mjs prepare-transform adaptive-upgrade.json .arwp/site-state.json
node bin/arwp-map-repo.mjs braid braid.json .arwp/site-state.json --out=braid-with-map.json
```

Allowed path hints are emitted only from one proven owner and compatible automation/mutation classes. Exact operation content, before-state digest, grounding, verification and authorization remain Transformation Engine responsibilities.

## Filesystem and execution safety

Repository Mapper is local and read-only.

- symbolic links are not followed;
- repository escape via `..` is rejected;
- generated/output directories are excluded as source authority;
- file count and file size are bounded;
- no shell command from the target repository is executed;
- framework/plugin/application code is not executed to manufacture ownership evidence;
- server/runtime state is not relabeled as deterministic file ownership.

## Current limitations

The mapper deliberately does not claim general support for:

- Astro dynamic routes, i18n route rewriting, computed critical config or integration-generated routes;
- Next.js Pages Router in v0.1;
- Next.js concrete expansion of bracket, parallel or intercepting routes;
- Next.js field-level ownership produced by `generateMetadata()` or arbitrary Server Component execution;
- Next.js rewrite/runtime semantics beyond preserving them as a blocker/warning;
- Docusaurus until its dedicated adapter has reproducible source-ownership evidence;
- WordPress/Shopify/CMS content as local-file ownership;
- Jekyll collection/post routing that needs unresolved config/plugin execution.

## Verification

Dedicated CI covers:

- static GitHub Pages mapping;
- Jekyll front-matter/build ownership;
- Astro route/config/layout/public ownership and fail-closed boundaries;
- Next.js App Router static page ownership;
- Next.js route-group handling and dynamic route blocking;
- Next.js computed base-path and rewrites blocking;
- Next.js root metadata-route ownership;
- Next.js policy boundary for `robots.ts`;
- Pages Router-only rejection and conflicting-framework detection;
- deterministic no-op / reviewed grounding / digest-drift behavior for the Next.js transformation pack;
- generated-output and symlink exclusion;
- BraidGraph and mapped-transform preparation regression;
- current ARWP GitHub Pages dogfood;
- read-only live ownership dogfood against the owner-controlled `dkharlanau/ptichi-site` repository.

The Ptichi dogfood proves source ownership only. It does not mutate Ptichi, does not claim ranking impact and does not turn unresolved locale routes into inferred routes.

## Guardrails

- mapped ownership is evidence, not authorization;
- ambiguity and unsupported runtime state remain explicit;
- generated output is not preferred over source;
- policy/editorial decisions remain gated;
- no ranking, recommendation or AI-citation guarantee follows from a successful map.

## Next adapters

1. Docusaurus/documentation generators with reproducible route/source ownership;
2. harden Next.js against additional patterns only when they stay non-executing and fail-closed;
3. explicit CMS/API ownership adapters where content is not file-owned.
