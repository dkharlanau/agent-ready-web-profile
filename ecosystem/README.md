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
2. collect independent ARWP profile adopters beyond the original reference suite;
3. submit the candidate through the SchemaStore contribution process;
4. only document SchemaStore support after the upstream PR is accepted.

ARWP Resolver does not require a site to publish an ARWP profile. SchemaStore therefore remains useful specifically for publishers that choose the profile contract; it is not a Resolver adoption prerequisite.

## Official MCP Registry

The repository-root `server.json` is prepared to publish the **ARWP Site Resolver** as the package's primary MCP artifact. It does not require `ARWP_PROFILE`: an MCP client supplies public site URLs to resolver tools.

The package declares matching ownership metadata:

```json
"mcpName": "io.github.dkharlanau/agent-ready-web-profile"
```

The prepared Registry package launches:

```text
arwp resolver-mcp
```

and exposes resolver operations rather than the older one-profile gateway as the default package identity.

The generic profile-driven gateway remains available through:

```text
arwp mcp
```

for integrations that deliberately want one fixed ARWP profile.

Publication order matters:

1. publish the exact package version to npm;
2. verify the npm package contains `mcpName` matching `server.json`;
3. verify the packaged `server.json` launches `resolver-mcp` and requires no publisher profile environment variable;
4. use the gated `.github/workflows/publish-ecosystem.yml` workflow;
5. authenticate to the registry using GitHub OIDC;
6. publish `server.json`;
7. record the authoritative Registry URL only after publication succeeds.

The MCP Registry stores metadata; npm remains the package distribution surface.

## ARWP profile discovery location

For publishers that choose to expose an ARWP profile, the project currently recommends:

```text
/ai/site-profile.json
```

and optional HTML discovery with:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

The project intentionally does not claim a registered ARWP `.well-known` URI or custom link relation. Resolver development reduces the pressure to create another global manifest location because protocol-native/community discovery can be read directly. A new ARWP discovery mechanism should be considered only after independent evidence demonstrates that explicit configuration, the current path convention and ordinary link discovery are insufficient.
