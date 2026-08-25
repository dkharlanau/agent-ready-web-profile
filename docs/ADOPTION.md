# ARWP Adoption Kit

This guide is for a site owner who wants to publish an Agent-Ready Web Profile without first learning the entire specification.

## Fast path

From a repository checkout:

```bash
npm ci
node bin/arwp.mjs scan https://example.com
node bin/arwp.mjs init https://example.com
node bin/arwp.mjs validate ai/site-profile.json
```

Publish the generated file at:

```text
/ai/site-profile.json
```

Then advertise it from HTML when practical:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

## Add CI validation

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

Use an immutable release or commit when reproducibility matters.

## Let GitHub propose profile updates

The repository includes:

```text
templates/github-actions/propose-arwp-profile.yml
```

Copy it into an adopting repository's `.github/workflows/` directory. A manual workflow run will:

1. scan the configured public site;
2. generate a conservative profile draft;
3. validate it;
4. create a branch and pull request only when `ai/site-profile.json` changed.

The generated PR deliberately does not invent domain-specific data, retrieval, Agent Skills, WebMCP, MCP or A2A declarations.

## Verify the published site

```bash
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
```

A valid JSON document is not enough. Verification catches stale or unreachable declarations.

For a higher-level evidence report:

```bash
node bin/arwp.mjs health https://example.com
```

The report separates observed, declared, verified, warning/failing and not-assessed states rather than producing an opaque readiness score.

## Optional: show profile availability

A neutral badge is available at:

```text
https://dkharlanau.github.io/agent-ready-web-profile/arwp-profile.svg
```

Example Markdown:

```markdown
[![ARWP profile available](https://dkharlanau.github.io/agent-ready-web-profile/arwp-profile.svg)](https://example.com/ai/site-profile.json)
```

The badge says only that a profile is available. It is not a certification or quality score.

## Optional: connect through the generic MCP gateway

Local stdio:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

Remote Streamable HTTP:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json \
ARWP_HTTP_ALLOWED_HOSTS=mcp.example.com \
npm run mcp:http
```

The generic gateway is intentionally read-only and only fetches resources declared by the profile. If your domain requires semantic operations, authorization, safety rules or mutation, build a domain-specific server instead.

## Optional: join the public directory

Open an issue in this repository with:

- canonical website URL;
- public ARWP profile URL;
- short site description/category;
- which capability groups are actually declared;
- a successful `arwp verify` result.

Directory inclusion means only that a public profile is available and can be inspected. It is not a quality endorsement.

The directory itself is machine-readable at:

```text
https://dkharlanau.github.io/agent-ready-web-profile/directory.json
```

and can be queried locally:

```bash
node bin/arwp.mjs directory --capability=retrieval
node bin/arwp.mjs federated-search "outside view"
```

## What makes a useful external adoption report

Good feedback describes an interoperability failure, for example:

- the scanner missed a public surface that has a reliable discovery signal;
- two clients interpreted one field differently;
- a capability could not be represented without inventing metadata;
- a verifier rule rejected a real deployment pattern;
- a profile became stale after a common deployment workflow.

Avoid requests whose only goal is to add another AI-related keyword or badge.

## Independent-adopter success criteria

For the experimental phase, the project should collect at least three sites outside the original five-site reference suite and record:

1. time from first scan to a valid published profile;
2. which capability groups were used;
3. which declarations required manual editing;
4. whether a downstream client actually used the profile;
5. concrete integration failures or ambiguities.

Those failures, not field count, should drive the next profile revision.
