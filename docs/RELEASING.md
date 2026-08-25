# Release and distribution policy

ARWP v0.x is experimental, but public consumers still need reproducible, versioned artifacts. This document defines the release path for the profile contract, CLI, GitHub Action and MCP distribution.

## Version layers

ARWP has two related but distinct version numbers:

- **tool/package release**, such as `0.2.0`, covers the CLI, scanner, verifier, validator, Action and generic MCP gateway;
- **profile contract version**, currently `profileVersion: "0.1"`, covers the normative `site-profile.json` contract.

A tooling release does not require a profile-contract bump. ARWP 0.2.0 can therefore add `scan` and `init` while continuing to generate and validate profile version 0.1.

## Release principles

- Treat `main` as development, not a stable dependency target.
- Publish immutable semantic-version tags such as `v0.1.0` and `v0.2.0`.
- Keep a released schema immutable; generated v0.1 profiles should reference the released v0.1.0 schema URL.
- Keep capability declarations truthful: tooling must not publish planned MCP, WebMCP, A2A or Agent Skills as implemented facts.
- Prefer `package-lock.json` + `npm ci` for reproducible installs.
- Test the packed npm artifact in a clean consumer project before publication.
- Prefer npm trusted publishing/OIDC over long-lived write tokens after the package exists.
- Keep external-network reference checks separate from deterministic release gates.

## GitHub Marketplace

The validator Action was first released as `v0.1.0` under the name:

`Validate Agent-Ready Web Profile`

Recommended Marketplace categories remain:

- `Code quality`
- `Utilities`

Consumers that want a fully pinned Action should use:

```yaml
- uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

A moving `v0` compatibility tag is optional and is intentionally deferred until there is a stronger compatibility policy across more than one v0 release.

## ARWP 0.2.0 release gate

ARWP 0.2.0 is the first release intended to contain scan/init onboarding and a normal npm-installable CLI while retaining profile contract 0.1.

Before publishing `v0.2.0`:

1. Confirm `package.json` and `package-lock.json` both report `0.2.0`.
2. Run the deterministic suite on Node.js 24:

   ```bash
   npm ci --ignore-scripts --no-audit --no-fund
   npm test
   npm run test:package
   ```

3. Confirm the package smoke test:
   - runs `npm pack`;
   - excludes development fixtures/tests from the tarball;
   - installs the tarball into a clean consumer project;
   - creates the `arwp` binary shim;
   - reports `0.2.0` through `arwp --version`;
   - validates a profile using the schema shipped inside the installed package.
4. Confirm the reusable GitHub Action still passes.
5. Review `CHANGELOG.md` and ensure `Unreleased` accurately describes only implemented behavior.
6. Confirm the public npm name immediately before the first publish.
7. Do not create the GitHub `v0.2.0` release until the exact npm publication sequence is ready, so release artifacts and package version stay aligned.

## npm package

The intended public package name is:

```text
agent-ready-web-profile
```

It exposes one executable:

```text
arwp
```

The expected installed UX is:

```bash
npx agent-ready-web-profile scan https://example.com
npx agent-ready-web-profile init https://example.com
npx agent-ready-web-profile validate ai/site-profile.json
npx agent-ready-web-profile verify https://example.com/ai/site-profile.json
```

After normal installation, the shorter executable is available directly:

```bash
arwp scan https://example.com
arwp init https://example.com
arwp mcp
arwp mcp-http
```

Do not advertise the `npx` commands as generally available until the package has actually been published to npm.

## First npm publication

npm trusted publishing can only be configured for a package that already exists in the npm registry. Therefore the first package publication is a one-time bootstrap operation performed by the owner with normal npm authentication and 2FA.

The first publication should happen only after `v0.2.0` code is final and CI is green:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:package
npm publish --access public
```

Immediately after the package exists, configure npm Trusted Publishing for this repository instead of storing a long-lived npm write token in GitHub.

## Trusted publishing after bootstrap

For GitHub Actions trusted publishing, configure npm with:

- GitHub user/organization: `dkharlanau`
- repository: `agent-ready-web-profile`
- workflow filename: the dedicated npm publishing workflow once it is added;
- allowed action: `npm publish` (or staged publish if human approval is preferred).

The workflow must run on a GitHub-hosted runner and grant:

```yaml
permissions:
  contents: read
  id-token: write
```

Use Node.js 24 and a current npm CLI supporting trusted publishing. Once trusted publishing is configured, npm can use OIDC instead of a long-lived write token and automatically attach provenance for the public package from this public repository.

A dedicated automatic publishing workflow should be added only after the first package exists and the npm trusted-publisher configuration can be tested. This avoids committing a workflow that will predictably fail before registry ownership is established.

## MCP Registry

The generic gateway may be published to the Official MCP Registry only after the npm package or a hosted gateway is a real public artifact matching the Registry metadata.

Registry publication must not turn ARWP into an MCP-specific format. The ARWP profile remains the discovery contract; the generic MCP gateway is one consumer of that contract.

When the package is public:

1. decide whether the generic gateway remains inside `agent-ready-web-profile` or should split only if installation/adoption evidence justifies it;
2. create and validate the official `server.json`;
3. verify namespace ownership;
4. publish using the official MCP Registry tooling;
5. add the authoritative Registry entry to documentation and only to profiles where that server is actually used.

## Compatibility

During v0.x, incompatible changes are possible. They must still be intentional and documented.

- Patch releases should fix implementation defects without changing the profile contract.
- Tooling minor releases may add commands while retaining the same profile contract.
- A profile-version change must be reflected in the schema, validator, examples, specification and compatibility documentation.
- Do not introduce a moving compatibility tag until its update policy is clear enough that consumers can reasonably depend on it.
