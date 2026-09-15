# Next.js Search Pack v0.2

Reviewed: **2026-09-15**.

Next.js Search Pack v0.2 joins two evidence lanes without confusing them:

```text
App Router source ownership / deployment constraints
                    ↓
            source diagnostics
                    ↓
        already-produced final artifact
                    ↓
        Production Search Build Gate
```

Canonical rules: [`registry/nextjs-search-pack-practices.json`](../registry/nextjs-search-pack-practices.json).

## Why this exists

A Next.js repository can look Search-ready in source while the production artifact still differs because metadata is inherited, generated, streamed, post-processed or emitted for a route that source mapping cannot safely expand.

The opposite problem also exists: generated `out/` HTML can prove what the build emitted, but it is not source authority and does not tell a transformation agent which TS/TSX file is safe to mutate.

v0.2 keeps those questions separate.

## Source lane

The pack reuses the fail-closed App Router Repository Mapper and adds bounded Search/deployment diagnostics. It does **not** execute Next.js, React, Server Components, `generateMetadata()`, route handlers, Proxy/middleware or application imports.

It records:

- Next.js package version when inspectable;
- App Router root (`app/` or `src/app/`);
- literal `output: 'export'` versus `dynamic-or-unspecified` deployment mode;
- expected static artifact directory (`out/` or literal `distDir`);
- static `metadata` exports, `generateMetadata()` and `metadataBase` presence;
- explicit `htmlLimitedBots` configuration;
- dynamic page segments plus inspectable `generateStaticParams()` ownership;
- `next/image` usage and whether static-export-compatible image configuration is proven in `next.config.*`;
- JSON-LD serialization that needs a sanitization review.

Source presence is never treated as proof of final metadata values.

## Static export compatibility

When `output: 'export'` is literal, the pack fails on inspectable use of current Next.js static-export-incompatible behavior, including:

- `rewrites()` / `redirects()` / `headers()`;
- Proxy or legacy middleware files;
- request-state `cookies()`, `headers()` or `draftMode()`;
- Server Actions (`'use server'`);
- ISR/revalidation;
- non-GET Route Handlers;
- Route Handlers that visibly read incoming request URL/headers/cookies;
- dynamic App Router pages without inspectable `generateStaticParams()` evidence.

`next/image` without an inspectable global custom/unoptimized configuration remains **watch**, not automatic failure, because a component-level loader may still make the build valid. The final Next.js build is the authority for build compatibility.

## Metadata boundary

Next.js supports static `metadata` objects and `generateMetadata()` in Server Components. `generateMetadata()` can contribute metadata to initial HTML when the route is prerenderable; current Next.js can also stream metadata for JavaScript-capable bots while keeping metadata blocking for HTML-limited bots.

The pack therefore:

- inventories source declarations;
- fails an inspectable `'use client'` + metadata/generateMetadata conflict;
- watches explicit `htmlLimitedBots` overrides;
- does **not** execute or guess `generateMetadata()` output;
- requires final artifact evidence for static-export release completeness.

## JSON-LD

Current Next.js guidance recommends rendering JSON-LD as an `application/ld+json` script and warns that raw `JSON.stringify()` does not sanitize malicious strings. The docs show escaping `<` to `\u003c` as one option.

v0.2 emits **watch** when it sees `application/ld+json` + `JSON.stringify()` but cannot inspectably prove less-than escaping or a known serializer. It stays watch because projects may use a custom sanitizer that a regex-only source pass cannot safely infer.

The Production Search Build Gate separately validates that emitted JSON-LD parses and that its normalized semantics do not drift between artifact and production.

## Final artifact lane

For an existing static export:

```bash
node bin/arwp-nextjs-search.mjs check \
  --root=. \
  --repository=owner/site \
  --site=https://example.com/ \
  --base-sha=<40-character-sha> \
  --artifact=out
```

The artifact is passed to Production Search Build Gate, which reconciles the sitemap index cohort with emitted HTML and validates title, canonical, robots/noindex, Open Graph URL and JSON-LD integrity.

The pack never runs `next build`. The target repository owns its build. Run the pack after the real build/post-processing step that creates the publish artifact.

For static export:

- source clean + no artifact → source can pass, release evidence is **incomplete**;
- source clean + artifact clean → release evidence is **complete** at the build-artifact layer;
- source clean + artifact broken → overall failure;
- unresolved dynamic source expansion can coexist with a valid built artifact; the mapper keeps ownership ambiguity instead of inventing dynamic parameter values.

Live deployment parity remains a separate Production Search Build Gate `live` step after deployment.

## Dynamic/server deployments

If `output: 'export'` is not literally configured, the pack reports `dynamic-or-unspecified`. That is not an error: Next.js can legitimately run with server rendering/runtime features.

A static `out/` artifact is not required for those deployments. Runtime Search evidence needs the deployed HTTP/rendered representation and exact deployment revision, not fabricated static-export assumptions.

## CLI

```bash
node bin/arwp-nextjs-search.mjs --help

node bin/arwp-nextjs-search.mjs check \
  --root=. \
  --repository=owner/site \
  --site=https://example.com/ \
  --json
```

Useful fields:

- `deployment.mode`;
- `deployment.expectedArtifactDirectory`;
- `source.mapperUnresolved`;
- `source.metadata`;
- `source.dynamicRoutes`;
- `artifact.state`;
- `sourcePass`;
- `pass`;
- `releaseEvidenceComplete`.

## Evidence boundaries

A successful report means only that the inspected source did not violate the bounded pack contract and, when supplied, the final static artifact passed its Search build contract.

It does **not** prove:

- Google/Bing indexing;
- ranking;
- selected title/snippet/favicon;
- AI Overview/AI Mode/ChatGPT/Bing citation;
- traffic;
- conversion;
- causal uplift.

## Primary sources

- Next.js — Static Exports: https://nextjs.org/docs/app/guides/static-exports
- Next.js — `generateMetadata`: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js — JSON-LD: https://nextjs.org/docs/app/guides/json-ld
