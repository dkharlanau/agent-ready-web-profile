# SignalBraid Repository Mapper / Site State Graph

Status: **v0.1 · static HTML + Jekyll + Astro · 2026-09-07**.

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

Evidence sources:

- `astro.config.mjs|js|ts|cjs` and/or an `astro` package dependency;
- documented file-based routing from static files in `src/pages` (or an inspectable literal `srcDir`);
- inspectable literal `build.format`, `output`, `site`, `base`, `trailingSlash`, `srcDir` and `publicDir` options;
- exact relative `.astro` imports for component/layout build-path evidence;
- exact machine files copied from `public/`.

Supported page-source extensions are `.astro`, `.md`, `.mdx` (only when `@astrojs/mdx` is proven from package dependencies), and `.html`.

Route path calculation respects `build.format`:

```text
# directory (default)
src/pages/index.astro       → /
src/pages/about.astro       → /about/
src/pages/about/index.astro → /about/   # collision if both exist

# file
src/pages/about.astro       → /about.html
src/pages/about/index.astro → /about.html

# preserve
src/pages/about.astro       → /about.html
src/pages/about/index.astro → /about/
```

Astro routes fail closed when exact public ownership requires behavior the mapper refuses to execute:

- bracket/dynamic routes such as `[slug].astro`;
- `getStaticPaths()` expansion;
- on-demand/server rendering unless a route has an inspectable `export const prerender = true` override;
- per-page computed `prerender` expressions;
- i18n routing;
- computed/uninspectable critical config values;
- integration-generated routes and redirects (reported as warnings, not invented as file routes).

A static file route may still record literal canonical/JSON-LD/title/description/robots source ownership when directly visible in the page source. Dynamic metadata expressions are not reduced to invented values.

## Astro evidence receipt

`fixtures/repository-mapper/astro-official-basics.json` pins the independently reviewable upstream evidence used for this adapter:

- `withastro/astro` commit `9870f95601690d9d98799b6fa78a0bc76165ee06`;
- the official `examples/basics/astro.config.mjs` blob;
- the official `examples/basics/src/pages/index.astro` blob;
- current Astro routing/configuration documentation URLs.

The fixture is an evidence manifest, not vendored framework source. CI does not fetch or execute upstream Astro code.

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
auto | static-html | jekyll | astro
```

`auto` first uses explicit framework evidence. If Astro and Jekyll signals coexist at the same site root, auto-detection stops with an error instead of selecting one silently.

For Astro, a literal `site` or `base` in `astro.config.*` must agree with the requested public site/base path. Conflict is a hard failure because an ownership graph with the wrong public identity is unsafe.

## Validate and resolve

```bash
node bin/arwp-map-repo.mjs validate .arwp/site-state.json

node bin/arwp-map-repo.mjs resolve .arwp/site-state.json \
  --route=/ \
  --type=canonical
```

Validation includes JSON Schema plus semantic checks: resolved route/surface owners must exist in `files[]`, while ambiguous/unresolved claims must not silently select an owner.

## Ambiguity is a first-class result

If two sources map to the same public route, for example Astro `src/pages/about.astro` and `src/pages/about/index.astro` under `build.format: 'directory'`, the graph records both candidates:

```json
{
  "state": "ambiguous",
  "ownerPath": null
}
```

Downstream layers must preserve this state. More automation is not a valid reason to erase ambiguity.

## Build-path evidence

Jekyll can preserve a route chain such as:

```text
index.md → _layouts/default.html → _includes/head.html → _config.yml
```

Astro can preserve explicit relative component/layout dependencies such as:

```text
src/pages/index.astro
  → src/layouts/Base.astro
  → src/components/Head.astro
  → astro.config.mjs
  → package.json
```

Only exact relative `.astro` imports that resolve to scanned files are followed. Alias imports, computed imports and framework execution are not guessed.

## Machine surfaces

Static/Jekyll machine files and Astro `public/` machine files can map to source ownership for surfaces such as:

- `robots.txt`;
- sitemap XML;
- `llms.txt`;
- selected agent discovery files;
- OpenAPI descriptions.

Mutation classes remain explicit. For example, crawler policy stays policy-gated and an `llms.txt` editorial surface is not silently reclassified as mechanical just to enable automation.

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
- generated/output directories such as `_site`, `dist`, `.astro`, `.next`, `build` and `out` are excluded as source authority;
- file count and file size are bounded;
- no shell command from the target repository is executed;
- Jekyll/Liquid/Astro/plugin/integration code is not executed to manufacture ownership evidence;
- server/runtime state is not relabeled as static file ownership.

## Current limitations

The mapper deliberately does not claim general support for:

- Astro dynamic routes, i18n route rewriting, computed critical config or integration-generated routes;
- Next.js ownership where routes/metadata depend on runtime/server components or generated manifests;
- Docusaurus until a dedicated adapter has reproducible source-ownership evidence;
- WordPress/Shopify/CMS content as local-file ownership;
- Jekyll collection/post routing that needs unresolved config/plugin execution;
- computed metadata whose source value cannot be established directly.

## Verification

Dedicated CI covers:

- static GitHub Pages mapping;
- Jekyll mapping, front-matter ownership and duplicate/unresolved routes;
- Astro static route mapping and adapter auto-detection;
- Astro layout/component build paths;
- Astro `public/` machine-surface ownership;
- Astro dynamic route fail-closed behavior;
- Astro server/prerender boundaries;
- Astro unsupported config fail-closed behavior;
- Astro route-collision ambiguity;
- generated-output and symlink exclusion;
- BraidGraph and mapped-transform preparation regression;
- current ARWP GitHub Pages dogfood.

## Guardrails

- mapped ownership is evidence, not authorization;
- ambiguity and unsupported runtime state remain explicit;
- generated output is not preferred over source;
- policy/editorial decisions remain gated;
- no ranking, recommendation or AI-citation guarantee follows from a successful map.

## Next adapters

1. harden Astro/Jekyll against more real-world evidence manifests;
2. Docusaurus/documentation generators;
3. selected Next.js patterns only where source ownership is provable without arbitrary application execution;
4. explicit CMS/API ownership adapters where content is not file-owned.
