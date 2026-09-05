# ARD v0.91 compatibility in ARWP

Reviewed: 2026-09-05

ARWP treats **Agentic Resource Discovery (ARD) v0.91** as an upstream discovery specification, not as an ARWP-owned protocol and not as a product competitor.

Primary upstream specification: https://github.com/ards-project/ard-spec/blob/main/spec/ard.md

## Current interpretation

ARD v0.91 defines an ARD entry as a JSON-LD node. Core terms use the ARD base context:

```text
https://agenticresourcediscovery.org/context/v1
```

A publisher may add other namespaces through `@context`. ARWP must process terms it understands and **preserve terms it does not understand** rather than deleting them or inventing semantics.

For static discovery, v0.91 defines these publisher mechanisms:

- canonical `/.well-known/ard.json` manifest;
- in-page JSON-LD entries;
- `Agentmap:` directives in `robots.txt`;
- HTML/HTTP `rel="ard"` links;
- DNS Service Binding discovery.

The predecessor names `/.well-known/ai-catalog.json` and `rel="ai-catalog"` may still be consulted for compatibility. ARWP labels them as predecessor/legacy evidence instead of presenting them as the v0.91 canonical mechanism.

## Pure compatibility layer shipped

`lib/ard-v091.mjs` provides deterministic parsing primitives with no network side effects:

- validation of required ARD entry terms;
- exact-one-of `url` / `data` enforcement;
- `representativeQueries` as SHOULD guidance rather than a hard validity condition;
- ARD base-context recording;
- explicit `@context` and `@id` preservation;
- preservation of unknown prefixed namespace terms as opaque `extensionTerms`;
- preservation of unknown unprefixed terms as opaque `unknownTerms`;
- HTML `<link rel="ard">` discovery;
- predecessor `<link rel="ai-catalog">` discovery with a legacy marker;
- in-page `application/ld+json` ARD entry extraction;
- `@graph` and manifest `entries[]` extraction;
- `Agentmap:` parsing;
- deterministic discovery-source collection with the canonical well-known URI first.

The layer is covered by `scripts/ard-v091-test.mjs` and a dedicated CI workflow.

## Deliberate non-goals of this slice

This pure layer does **not**:

- recursively fetch nested catalogs;
- perform ARD registry `POST /search`;
- execute or contact discovered resources;
- treat a discovery URL as authorization to contact/invoke;
- validate an MCP/A2A artifact merely because ARD references it;
- interpret arbitrary extension namespaces;
- perform DNS/SVCB lookup;
- assign a readiness score;
- change Resolver intent ranking.

## Resolver integration rule

ARD evidence may increase what ARWP knows, but it must not silently make an interface executable or preferred.

A later integration step should:

1. reuse the scanner's already-fetched homepage/robots content where possible;
2. feed canonical, HTML, Agentmap and predecessor ARD sources into bounded Resolver discovery;
3. preserve per-source provenance;
4. adapt only artifact types whose semantics ARWP actually understands;
5. retain unknown ARD terms/artifact types as inspectable evidence;
6. run the unchanged reviewed decision-quality corpus before any planner-policy change;
7. keep optional registry federation outside default site resolution.

## Field evidence worth tracking

The upstream ARD repository already records implementation divergence in the wild, including transitional `urn:ai:` vs `urn:air:` identifiers and multiple MCP media-type spellings. ARWP should record such drift in the Protocol Observatory and compatibility tests only when it can do so without silently changing canonical upstream meaning.

## Security / authority boundary

Discovery is not authorization. ARWP must preserve this distinction even if a registry returns an exact URL, strong relevance score, trust metadata or a federation referral.

Static ARD evidence answers **what was published/discovered**. Runtime verification, authentication, delegation and permission remain separate evidence classes.
