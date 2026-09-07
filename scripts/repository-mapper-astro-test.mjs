import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAstroSiteStateGraph } from '../lib/repository-mapper-astro.mjs';
import { compileRepositorySiteStateGraph, detectRepositoryMapperAdapter } from '../lib/repository-mapper-frameworks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const provenance = JSON.parse(fs.readFileSync(path.resolve(here, '../fixtures/repository-mapper/astro-official-basics.json'), 'utf8'));
assert.equal(provenance.framework, 'astro');
assert.match(provenance.upstream.commit, /^[0-9a-f]{40}$/);
assert.equal(provenance.upstream.files.find(file => file.path.endsWith('/astro.config.mjs')).gitBlobSha, 'e762ba5cf616b20d817d2ba33183df1f8fc0fbc5');
assert.equal(provenance.upstream.files.find(file => file.path.endsWith('/src/pages/index.astro')).gitBlobSha, 'c04f3602b5521c56580c70dd0846b2c559be7193');

function write(root, name, content) {
  const target = path.join(root, ...name.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-map-'));
  write(root, 'package.json', JSON.stringify({ devDependencies: { astro: '^6.0.0' } }, null, 2));
  write(root, 'astro.config.mjs', `import { defineConfig } from 'astro/config';\nexport default defineConfig({ site: 'https://example.com', base: '/docs', trailingSlash: 'always', build: { format: 'directory' } });\n`);
  write(root, 'src/layouts/Base.astro', '<html><head><slot name="head" /></head><body><slot /></body></html>\n');
  write(root, 'src/pages/index.astro', `---\nimport Base from '../layouts/Base.astro';\n---\n<Base><title slot="head">Home</title><h1>Home</h1></Base>\n`);
  write(root, 'src/pages/about.astro', '<html><head><title>About</title></head><body>About</body></html>\n');
  write(root, 'src/pages/posts/[slug].astro', '<html><head><title>Post</title></head><body>Dynamic</body></html>\n');
  write(root, 'public/sitemap.xml', '<urlset></urlset>\n');
  write(root, 'dist/about/index.html', '<html>generated</html>\n');
  return root;
}

const root = fixture();
const graph = compileAstroSiteStateGraph({
  root,
  repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  site: { origin: 'https://example.com', basePath: '/docs/' },
  generatedAt: '2026-09-07T18:00:00.000Z'
});
assert.equal(graph.adapter.id, 'astro');
assert.equal(graph.adapter.confidence, 'explicit-config');
assert.equal(graph.routes.find(route => route.routePath === '/').state, 'resolved');
assert.equal(graph.routes.find(route => route.routePath === '/about/').ownerPath, 'src/pages/about.astro');
assert.equal(graph.routes.filter(route => route.state === 'unresolved').length, 1);
assert.ok(graph.routes.find(route => route.routePath === '/').buildPath.includes('src/layouts/Base.astro'));
assert.ok(graph.routes.find(route => route.routePath === '/').buildPath.includes('astro.config.mjs'));
assert.equal(graph.ownership.find(item => item.surfaceKey === 'machine:/sitemap.xml').ownerPath, 'public/sitemap.xml');
assert.ok(!graph.files.some(file => file.path.startsWith('dist/')));
assert.ok(graph.warnings.some(warning => warning.code === 'generated-output-skipped'));
assert.ok(graph.warnings.some(warning => warning.code === 'astro-dynamic-route-unresolved'));

const detected = detectRepositoryMapperAdapter({ root });
assert.equal(detected.id, 'astro');
const facade = compileRepositorySiteStateGraph({ root, repository: { fullName: 'owner/site' }, site: { origin: 'https://example.com', basePath: '/docs/' }, generatedAt: '2026-09-07T18:01:00.000Z' });
assert.equal(facade.adapter.id, 'astro');

write(root, 'src/pages/about/index.astro', '<html><head></head><body>duplicate</body></html>\n');
const ambiguous = compileAstroSiteStateGraph({ root, repository: { fullName: 'owner/site' }, site: { origin: 'https://example.com', basePath: '/docs/' } });
assert.equal(ambiguous.routes.find(route => route.routePath === '/about/').state, 'ambiguous');
assert.equal(ambiguous.routes.find(route => route.routePath === '/about/').ownerPath, null);

const serverRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-server-'));
write(serverRoot, 'package.json', JSON.stringify({ dependencies: { astro: '^6.0.0' } }));
write(serverRoot, 'astro.config.mjs', `export default { output: 'server', build: { format: 'directory' } };\n`);
write(serverRoot, 'src/pages/index.astro', '<html><body>runtime</body></html>\n');
write(serverRoot, 'src/pages/static.astro', `---\nexport const prerender = true;\n---\n<html><body>static</body></html>\n`);
const server = compileAstroSiteStateGraph({ root: serverRoot, repository: { fullName: 'owner/server' }, site: { origin: 'https://server.example', basePath: '/' } });
assert.equal(server.routes.find(route => route.routePath === '/').state, 'unresolved');
assert.equal(server.routes.find(route => route.routePath === '/static/').state, 'resolved');

const unsupportedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-i18n-'));
write(unsupportedRoot, 'package.json', JSON.stringify({ dependencies: { astro: '^6.0.0' } }));
write(unsupportedRoot, 'astro.config.mjs', `export default { i18n: { defaultLocale: 'en', locales: ['en', 'de'] } };\n`);
write(unsupportedRoot, 'src/pages/index.astro', '<html></html>\n');
const unsupported = compileAstroSiteStateGraph({ root: unsupportedRoot, repository: { fullName: 'owner/i18n' }, site: { origin: 'https://i18n.example', basePath: '/' } });
assert.equal(unsupported.routes[0].state, 'unresolved');
assert.ok(unsupported.routes[0].evidence.includes('astro:unsupported-config:i18n-routing-unsupported'));

assert.throws(() => compileAstroSiteStateGraph({ root, repository: { fullName: 'owner/site' }, site: { origin: 'https://example.com', basePath: '/wrong/' } }), /conflicts with requested site basePath/);

console.log('PASS Astro Repository Mapper resolves only inspectable static file routes, preserves dynamic/runtime/config ambiguity, records exact component/config/public ownership, and auto-detects Astro without executing framework code');
