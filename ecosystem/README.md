# Ecosystem publication package

This directory contains artifacts that are ready for external ecosystem submission but should not be presented as accepted until the external system confirms them.

## SchemaStore

`schemastore-catalog-entry.json` is a candidate catalog record using the current SchemaStore catalog shape:

- name
- description
- fileMatch
- schema URL

Submission gate:

1. keep the public schema URL stable;
2. collect independent ARWP adopters beyond the original reference suite;
3. submit the candidate through the SchemaStore contribution process;
4. only document SchemaStore support after the upstream PR is accepted.

ARWP does not need SchemaStore in order to work. The benefit is editor/schema auto-discovery for the conventional `**/ai/site-profile.json` path.

## Official MCP Registry

The repository-root `server.json` is prepared for the Official MCP Registry and the package declares matching:

```json
"mcpName": "io.github.dkharlanau/agent-ready-web-profile"
```

Publication order matters:

1. publish the exact package version to npm;
2. verify the npm package contains `mcpName` matching `server.json`;
3. use the gated `.github/workflows/publish-ecosystem.yml` workflow;
4. authenticate to the registry using GitHub OIDC;
5. publish `server.json`;
6. record the authoritative Registry URL in the ARWP documentation/profile only after publication succeeds.

The MCP Registry stores metadata; npm remains the package distribution surface.

## Discovery location

ARWP currently recommends:

```text
/ai/site-profile.json
```

and optional HTML discovery with:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

The project intentionally does not claim a registered `.well-known` URI or custom link relation. A new discovery mechanism should be considered only after independent adoption demonstrates that explicit configuration, the current path convention and ordinary link discovery are insufficient.
