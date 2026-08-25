# ARWP Directory and Federation

The ARWP directory is a small discovery catalog of websites that publish public ARWP profiles.

Canonical repository data:

```text
registry/sites.json
```

Public GitHub Pages copy:

```text
https://dkharlanau.github.io/agent-ready-web-profile/directory.json
```

JSON Schema:

```text
registry/directory.schema.json
```

## What directory inclusion means

A directory record says:

- this site publishes an ARWP profile at the listed URL;
- these high-level capability groups are declared by that profile/reference review;
- a client has a stable URL from which to continue discovery.

It does **not** say:

- the site is endorsed or high quality;
- every declared resource is currently healthy;
- a capability is better than its alternatives;
- the site is safe for every use case.

Live verification remains a separate operation.

## Capability discovery

Clients may filter the directory by high-level capability before fetching profiles, for example:

```bash
arwp directory --capability=retrieval
arwp directory --capability=mcp
```

The directory is an optimization. The individual site profile remains authoritative for detailed integration metadata.

## Federated retrieval

The repository includes `router/federated.mjs` and a local MCP router.

```bash
arwp federated-search "outside view"
npm run router:mcp
```

The router:

1. selects only directory sites that declare retrieval;
2. loads and validates each site's ARWP profile;
3. uses the site's declared retrieval index;
4. performs bounded lexical search through the existing generic gateway primitives;
5. returns each result with its source site, profile and index.

The router does not merge records into a new canonical knowledge base. Each publisher remains the source of record.

## Future directory API

The static JSON document is intentionally sufficient for the experimental phase. A hosted query API should be introduced only if independent consumers demonstrate needs that cannot be met by downloading/caching the small catalog.

If such an API is added, it should remain a query layer over the same versioned directory contract rather than a second source of truth.
