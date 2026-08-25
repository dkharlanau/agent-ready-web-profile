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

## Verify the published site

```bash
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
```

A valid JSON document is not enough. Verification catches stale or unreachable declarations.

## Optional: connect through the generic MCP gateway

Local stdio:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
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
