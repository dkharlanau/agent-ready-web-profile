# ARWP toolchain bootstrap

Use this reference when the Agent Skill is installed in a target repository but the ARWP toolchain itself is not present.

## Temporary read-only toolchain checkout

Prefer an isolated subdirectory that is excluded from target commits:

```bash
git clone --depth=1 https://github.com/dkharlanau/agent-ready-web-profile.git .arwp-toolchain
npm ci --prefix .arwp-toolchain --ignore-scripts --no-audit --no-fund
```

Then run:

```bash
node .arwp-toolchain/bin/arwp.mjs audit https://example.com/ --json
node .arwp-toolchain/bin/arwp-growth.mjs https://example.com/ --json
node .arwp-toolchain/bin/arwp-receipt.mjs capture https://example.com/ --output=arwp-receipt.json
```

Do not commit `.arwp-toolchain` into the target repository unless the repository explicitly vendors tools.

## Raw template catalog

Use templates as starting points, not files to copy mechanically:

- Organization JSON-LD: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/growth/organization.jsonld
- Article JSON-LD: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/growth/article.jsonld
- Content quality checklist: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/growth/content-quality-checklist.md
- Preferred Sources example: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/growth/preferred-source.html
- AI search open / training closed policy example: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/growth/robots.ai-search-open-training-closed.txt
- Read-only Growth workflow: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/growth/github-action.yml
- Combined Site Quality workflow: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/adoption/github-action-quality.yml
- Target AGENTS.md snippet: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/adoption/AGENTS-snippet.md
- Machine bootstrap manifest: https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/templates/adoption/bootstrap-manifest.json

## Safety

- Inspect the target stack before choosing a template.
- Never overwrite existing framework metadata/robots/sitemap generators blindly.
- Treat robots/content-use policies as publisher decisions.
- Keep toolchain checkout and generated evidence free of credentials.
- Verify the deployed URL after target build/deploy when possible.
