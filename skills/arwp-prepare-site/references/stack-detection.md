# Stack detection for ARWP site preparation

Before editing, identify how the site generates public files and metadata. Prefer framework-native integration over hard-coded duplicate HTML.

## Signals to inspect

- `package.json`, lockfiles, build scripts and deployment config;
- framework config (`next.config.*`, `astro.config.*`, `vite.config.*`, Nuxt/SvelteKit/Docusaurus/MkDocs/Hugo/Jekyll config, etc.);
- source/content directories and route conventions;
- existing SEO/head components;
- sitemap/robots plugins or generators;
- static public directory;
- CMS/export pipelines;
- GitHub Pages/Netlify/Vercel/Cloudflare deploy workflows;
- analytics/search-console verification files;
- API schemas, MCP/A2A/WebMCP/skills metadata;
- existing structured data and canonical URL helpers.

## Integration rules

1. Change the source of truth, not generated output, unless the repository intentionally versions generated output.
2. Reuse existing metadata helpers/components before creating new ones.
3. Generate repeated JSON-LD/page metadata from content data where practical.
4. Avoid two competing sitemap/robots generators.
5. Preserve existing route/base-path behavior; GitHub Project Pages often use a subpath.
6. Treat origin-root mechanisms such as `robots.txt` according to actual hosting authority, not repository-relative assumptions.
7. Keep build output deterministic when the repository enforces zero-diff generated artifacts.
8. If framework behavior is uncertain and current documentation matters, verify it from the framework's official docs before making a consequential change.

## Static-site fallback

For plain HTML/static repositories, direct public files are appropriate. Keep canonical URLs/base paths explicit and validate links after build/deploy.

## CMS fallback

If source templates are unavailable, prepare a publisher implementation guide plus machine-readable examples, but do not claim the repository itself is fully prepared until the deployed site is verified.
