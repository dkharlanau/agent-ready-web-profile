# Release and distribution policy

ARWP v0.x is experimental, but public consumers still need reproducible, versioned artifacts. This document defines the release path for the profile, validator, GitHub Action and future MCP distribution.

## Release principles

- Treat `main` as development, not a stable dependency target.
- Publish immutable semantic-version tags such as `v0.1.0`.
- Maintain a moving major tag such as `v0` for GitHub Action consumers that accept compatible v0 updates.
- Keep schema, validator, Action and documentation in the same release unless a change is explicitly tooling-only.
- Do not publish planned MCP, WebMCP, A2A or other capabilities as if they are already deployed.
- Prefer reproducible installs from `package-lock.json` and `npm ci`.

## v0.1.0 release gate

Before publishing the first release:

1. Confirm `package-lock.json` is committed and matches `package.json`.
2. Run deterministic tests with Node.js 24:

   ```bash
   npm ci --ignore-scripts --no-audit --no-fund
   npm test
   node bin/arwp.mjs validate examples/minimal.site-profile.json
   node bin/arwp.mjs validate examples/knowledge-site.site-profile.json
   ```

3. Confirm the repository GitHub Action passes against a real example profile.
4. Confirm the scheduled reference verifier is not used as a release gate for ordinary code changes; external sites can fail independently of ARWP.
5. Review `CHANGELOG.md` and ensure the release describes implemented behavior only.
6. Confirm `action.yml` remains the only Action metadata file at the repository root.
7. Search GitHub Marketplace for the exact Action name and confirm it is still unique.

## GitHub Marketplace publication

The first Marketplace release should use:

- Action name: `Validate Agent-Ready Web Profile`
- Release/tag: `v0.1.0`
- Primary category: `Code quality`
- Secondary category: `Utilities`

Publish the release from GitHub and select **Publish this Action to the GitHub Marketplace**. GitHub requires a public repository, a root `action.yml`/`action.yaml`, a unique Action name, Marketplace agreement acceptance and two-factor authentication for publication.

After `v0.1.0` is published, create or move the compatibility tag:

```bash
git tag -f v0 v0.1.0
git push origin v0 --force
```

Consumers can then choose between:

```yaml
# Compatible v0 updates
- uses: dkharlanau/agent-ready-web-profile@v0
  with:
    profile: ai/site-profile.json
```

and a fully pinned release:

```yaml
- uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

Security-sensitive environments may pin the exact commit SHA.

## Release notes for v0.1.0

The release should lead with what users can do today:

- validate an ARWP profile locally or in CI;
- verify declared public resources;
- run the generic read-only MCP gateway over a declared profile;
- inspect five reference architectures.

Do not position ARWP as a search-ranking mechanism or as a replacement for MCP, WebMCP, Agent Skills, A2A, OpenAPI, Schema.org, sitemaps or `llms.txt`.

## Future npm distribution

The CLI should be published only after its public package name and package boundary are fixed. A future package should support a normal executable entry point such as:

```bash
npx <package> validate ai/site-profile.json
npx <package> verify https://example.com/ai/site-profile.json
```

The highest-value next CLI capability is profile generation/discovery (`init` or `scan`), not more schema fields.

Before npm publication:

- choose and verify the package namespace;
- remove the current private-package guard intentionally;
- define the `bin` entry and published `files` set;
- test installation from a packed tarball;
- document Node.js support and compatibility policy;
- keep the GitHub Action pinned to the repository release rather than depending on an unversioned npm install.

## Future MCP Registry publication

The generic gateway may be published to the Official MCP Registry only when there is a real installable or hosted MCP server artifact matching the Registry metadata.

Registry publication should not turn ARWP into an MCP-specific format. The ARWP profile remains the discovery contract; the generic MCP gateway is one consumer of that contract.

When the gateway package is ready:

1. publish the installable package or hosted endpoint;
2. create and validate `server.json` using the official MCP Registry tooling;
3. authenticate ownership of the chosen namespace;
4. publish with the official `mcp-publisher` workflow;
5. add the resulting Registry URL to ARWP documentation and only to profiles where that server is actually used.

## Compatibility

During v0.x, incompatible changes are possible. They must still be intentional and documented.

- Patch releases should fix implementation defects without changing the profile contract.
- Minor v0 releases may extend or revise the experimental contract.
- A profile-version change must be reflected in the schema, validator, examples, specification and compatibility documentation.

Do not move the `v0` GitHub Action tag to a release that knowingly breaks the documented Action inputs or invocation contract without a migration note.
