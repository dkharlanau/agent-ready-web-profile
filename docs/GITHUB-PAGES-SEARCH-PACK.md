# GitHub Pages Search Pack

Reviewed: **2026-09-15**.

The GitHub Pages Search Pack turns GitHub Pages-specific hosting assumptions into explicit evidence before Search release:

```text
repository identity
→ public host/scope
→ branch or Actions publishing boundary
→ final Pages artifact
→ project-subpath Search integrity
→ exact deploy SHA + live parity
```

Canonical rules: [`registry/github-pages-search-pack-practices.json`](../registry/github-pages-search-pack-practices.json).

## Why this exists

GitHub Pages has three materially different public identities:

- `owner.github.io/` — hostname-root user/organization site;
- `owner.github.io/repository/` — project site under a shared hostname;
- `https://www.example.com/` — custom-domain hostname root.

Those differences affect base paths, canonical/feed/sitemap ownership and provider features. A project subdirectory is a valid public site but is not a separate domain/subdomain for Google Preferred Sources.

A repository `CNAME` file is also not proof that the custom domain is active. GitHub explicitly requires custom-domain configuration through Pages settings/API, while the repository file is only one source-side signal.

## Run it

For a branch-published project site after reproducing its final Jekyll artifact:

```bash
node bin/arwp-github-pages-search.mjs check \
  --root=. \
  --repository=owner/project \
  --site=https://owner.github.io/project/ \
  --publishing-mode=branch \
  --pages-source=docs \
  --artifact=docs/_site \
  --source-sha=<40-character-sha>
```

For custom Actions publication:

```bash
node bin/arwp-github-pages-search.mjs check \
  --root=. \
  --repository=owner/project \
  --site=https://www.example.com/ \
  --publishing-mode=github-actions \
  --pages-source=. \
  --artifact=dist
```

The command is read-only. It never changes Pages settings, DNS, Actions, branches or deployments.

## Host identity

The pack checks the supplied repository and public root together.

For the default GitHub hostname:

- `owner/owner.github.io` must resolve at `https://owner.github.io/`;
- `owner/project` must resolve at `https://owner.github.io/project/`.

A contradictory path is a hard failure because all downstream canonical/base-path reasoning would otherwise be wrong.

A supplied custom domain is treated as hostname-root. A custom-domain URL with an additional site-root subdirectory is rejected rather than silently treated as a GitHub project path.

Custom domains do **not** receive a ranking bonus from this pack. Their relevant advantages are independent site identity, stable branding and eligibility for hostname-scoped platform features when the provider supports them.

## Publication boundary

GitHub Pages can publish from:

- a branch (`/` or `/docs` source only);
- a custom GitHub Actions workflow.

The mode must be explicit. Repository workflow inspection can corroborate standard `configure-pages`, `upload-pages-artifact` and `deploy-pages` usage, but file presence is not treated as the active Pages setting.

For branch publication, the pack records whether `.nojekyll` is present:

- no `.nojekyll` → `jekyll-default`;
- `.nojekyll` → `nojekyll`.

GitHub documents Jekyll as the default branch-publishing build. For a non-Jekyll generator, custom Actions is the preferred publication model; an already-built branch source can also explicitly disable Jekyll with `.nojekyll`.

## Final artifact and project base path

The pack delegates final HTML/sitemap/canonical/robots/JSON-LD integrity to Production Search Build Gate.

For `owner.github.io/project/`, it then adds Pages-specific checks:

- same-host RSS/Atom autodiscovery must stay inside `/project/`;
- an advertised feed inside `/project/` must exist in the final artifact;
- same-host `hreflang` alternates must not accidentally escape `/project/`;
- `robots.txt` sitemap declarations must stay inside `/project/`;
- ordinary root-relative navigation/assets that resolve to `owner.github.io/...` outside the project are `watch`, not automatic failure, because a project may intentionally reuse a host-root asset.

This distinction avoids both common errors: silently broken project-base URLs and false failures for intentionally shared resources.

## Custom-domain evidence

When the supplied public site is a custom domain:

- a contradictory source/artifact `CNAME` is a hard failure;
- missing `CNAME` is `watch`, because Pages settings/API may be authoritative;
- HTTPS is required for release-facing evidence;
- a matching `CNAME` is still only declaration evidence, not proof that DNS/certificate/live routing is correct.

Runtime domain and certificate proof belongs to deployed HTTP evidence.

## Preferred Sources

The pack delegates this decision to Search Platform Eligibility.

- `owner.github.io/project/` → `subdirectory` → Google Preferred Sources is `not-applicable` as an independent source;
- `owner.github.io/` hostname-root → scope-eligible;
- custom-domain root → scope-eligible.

Scope eligibility does not prove that the site appears in Google's source preferences tool or that any user selected it. The CTA remains an optional acquisition tactic, never a ranking requirement.

Google source: https://developers.google.com/search/docs/appearance/preferred-sources

## Exact deployment proof

This pack stops at source/final-artifact evidence. The production release loop remains:

```text
GitHub Pages deploy check with head_sha == source SHA
→ Production Search Build Gate live parity
→ owner Search evidence later
```

Do not substitute a CNAME file, workflow success, branch state or build timestamp for exact deployed revision evidence.

## Evidence boundaries

A clean report does not prove:

- Google/Bing indexing;
- rankings;
- title/snippet/favicon selection;
- Google Preferred Sources selection;
- AI citation;
- traffic or business impact.

Primary sources:

- GitHub Pages publishing source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Pages site creation / Jekyll boundary: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- GitHub Pages custom domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- GitHub Pages HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- Google Preferred Sources: https://developers.google.com/search/docs/appearance/preferred-sources
