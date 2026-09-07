import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileNextSiteStateGraph } from '../lib/repository-mapper-nextjs.mjs';
import { compileRepositorySiteStateGraph, detectRepositoryMapperAdapter } from '../lib/repository-mapper-frameworks.mjs';
import { prepareTransformationPackOperation, loadTransformationPackRegistry } from '../lib/transformation-pack.mjs';

function write(root, name, content) {
  const target = path.join(root, ...name.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-map-'));
  write(root, 'package.json', JSON.stringify({ dependencies: { next: '16.3.4', react: '19.2.0' } }, null, 2));
  write(root, 'next.config.ts', `const nextConfig = { poweredByHeader: false };\nexport default nextConfig;\n`);
  write(root, 'src/app/layout.tsx', `export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n`);
  write(root, 'src/app/page.tsx', `export default function Page() { return <main>Home</main>; }\n`);
  write(root, 'src/app/about/page.tsx', `export default function Page() { return <main>About</main>; }\n`);
  write(root, 'src/app/(marketing)/pricing/page.tsx', `export default function Page() { return <main>Pricing</main>; }\n`);
  write(root, 'src/app/[locale]/page.tsx', `export async function generateMetadata() { return { title: 'Locale' }; }\nexport default function Page() { return <main>Locale</main>; }\n`);
  write(root, 'src/app/sitemap.ts', `export default function sitemap() { return [{ url: 'https://example.com/' }]; }\n`);
  write(root, 'src/app/robots.ts', `export default function robots() { return { rules: { userAgent: '*', allow: '/' } }; }\n`);
  write(root, 'src/app/manifest.ts', `export default function manifest() { return { name: 'Example', start_url: '/' }; }\n`);
  write(root, 'src/components/Card.tsx', `export function Card() { return <div>Card</div>; }\n`);
  write(root, '.next/server/app/index.html', '<html>generated</html>\n');
  return root;
}

const root = fixture();
const graph = compileNextSiteStateGraph({
  root,
  repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  site: { origin: 'https://example.com', basePath: '/' },
  generatedAt: '2026-09-07T19:30:00.000Z'
});
assert.equal(graph.adapter.id, 'nextjs');
assert.equal(graph.adapter.confidence, 'explicit-config');
assert.equal(graph.routes.find(route => route.routePath === '/').ownerPath, 'src/app/page.tsx');
assert.equal(graph.routes.find(route => route.routePath === '/about/').ownerPath, 'src/app/about/page.tsx');
assert.equal(graph.routes.find(route => route.routePath === '/pricing/').ownerPath, 'src/app/(marketing)/pricing/page.tsx');
assert.equal(graph.routes.filter(route => route.state === 'unresolved').length, 1);
assert.equal(graph.routes.find(route => route.routePath === '/').buildPath[0], 'src/app/page.tsx');
assert.ok(graph.routes.find(route => route.routePath === '/').buildPath.includes('src/app/layout.tsx'));
assert.ok(graph.routes.find(route => route.routePath === '/').buildPath.includes('next.config.ts'));
assert.equal(graph.ownership.find(item => item.surfaceKey === 'machine:/sitemap.xml').ownerPath, 'src/app/sitemap.ts');
assert.equal(graph.ownership.find(item => item.surfaceKey === 'machine:/robots.txt').mutationClass, 'policy-gated');
assert.equal(graph.ownership.find(item => item.surfaceKey === 'machine:/manifest.webmanifest').ownerPath, 'src/app/manifest.ts');
assert.equal(graph.files.find(file => file.path === 'src/app/sitemap.ts').role, 'machine-surface');
assert.equal(graph.files.find(file => file.path === 'src/app/robots.ts').mutationClass, 'policy-gated');
assert.ok(!graph.files.some(file => file.path.startsWith('.next/')));
assert.ok(graph.warnings.some(warning => warning.code === 'generated-output-skipped'));
assert.ok(graph.warnings.some(warning => warning.code === 'next-computed-metadata-unmapped'));
assert.ok(graph.warnings.some(warning => warning.code === 'next-route-unresolved'));

const detected = detectRepositoryMapperAdapter({ root });
assert.equal(detected.id, 'nextjs');
const facade = compileRepositorySiteStateGraph({ root, repository: { fullName: 'owner/site' }, site: { origin: 'https://example.com', basePath: '/' }, generatedAt: '2026-09-07T19:31:00.000Z' });
assert.equal(facade.adapter.id, 'nextjs');

const registry = loadTransformationPackRegistry();
const sitemap = graph.ownership.find(item => item.surfaceKey === 'machine:/sitemap.xml');
const sitemapFile = graph.files.find(file => file.path === sitemap.ownerPath);
const beforeContent = fs.readFileSync(path.join(root, sitemap.ownerPath), 'utf8');
let prepared = prepareTransformationPackOperation(graph, {
  packId: 'nextjs-app-router-v0.1',
  recipeId: 'machine-surface-replace',
  recommendationId: 'rec:next-sitemap',
  surfaceKey: 'machine:/sitemap.xml',
  beforeContent,
  inputs: { content: `${beforeContent}// reviewed update\n` },
  reviewedGrounding: false,
  groundedEvidence: []
}, { registry });
assert.equal(prepared.status, 'blocked');
assert.equal(prepared.reason, 'reviewed-grounding-required');

prepared = prepareTransformationPackOperation(graph, {
  packId: 'nextjs-app-router-v0.1',
  recipeId: 'machine-surface-replace',
  recommendationId: 'rec:next-sitemap',
  surfaceKey: 'machine:/sitemap.xml',
  beforeContent,
  inputs: { content: `${beforeContent}// reviewed update\n` },
  reviewedGrounding: true,
  groundedEvidence: ['first-party:route-inventory']
}, { registry });
assert.equal(prepared.status, 'ready');
assert.equal(prepared.operationSpec.operation, 'replace-file');
assert.equal(prepared.operationSpec.path, 'src/app/sitemap.ts');
assert.equal(prepared.boundaries.productionMutationPerformed, false);
assert.equal(sitemapFile.sha256, graph.files.find(file => file.path === prepared.path).sha256);

const noop = prepareTransformationPackOperation(graph, {
  packId: 'nextjs-app-router-v0.1', recipeId: 'machine-surface-replace', recommendationId: 'rec:noop', surfaceKey: 'machine:/sitemap.xml', beforeContent,
  inputs: { content: beforeContent }, reviewedGrounding: true, groundedEvidence: ['first-party:route-inventory']
}, { registry });
assert.equal(noop.status, 'no-op');
assert.equal(noop.reason, 'already-correct');

const drift = prepareTransformationPackOperation(graph, {
  packId: 'nextjs-app-router-v0.1', recipeId: 'machine-surface-replace', recommendationId: 'rec:drift', surfaceKey: 'machine:/sitemap.xml', beforeContent: `${beforeContent}drift`,
  inputs: { content: beforeContent }, reviewedGrounding: true, groundedEvidence: ['first-party:route-inventory']
}, { registry });
assert.equal(drift.status, 'blocked');
assert.equal(drift.reason, 'source-digest-drift');

const baseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-base-'));
write(baseRoot, 'package.json', JSON.stringify({ dependencies: { next: '16.3.4' } }));
write(baseRoot, 'next.config.ts', `const basePath = process.env.BASE_PATH; export default { basePath };\n`);
write(baseRoot, 'app/page.tsx', `export default function Page(){ return null; }\n`);
const baseGraph = compileNextSiteStateGraph({ root: baseRoot, repository: { fullName: 'owner/base' }, site: { origin: 'https://base.example', basePath: '/' } });
assert.equal(baseGraph.routes[0].state, 'unresolved');
assert.ok(baseGraph.warnings.some(warning => warning.code === 'next-basepath-not-literal'));

const rewritesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-rewrites-'));
write(rewritesRoot, 'package.json', JSON.stringify({ dependencies: { next: '16.3.4' } }));
write(rewritesRoot, 'next.config.mjs', `export default { async rewrites() { return [{ source: '/a', destination: '/b' }]; } };\n`);
write(rewritesRoot, 'app/page.tsx', `export default function Page(){ return null; }\n`);
const rewrites = compileNextSiteStateGraph({ root: rewritesRoot, repository: { fullName: 'owner/rewrites' }, site: { origin: 'https://rewrites.example', basePath: '/' } });
assert.equal(rewrites.routes[0].state, 'unresolved');
assert.ok(rewrites.routes[0].evidence.includes('next:rewrites-present'));

const pagesOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-pages-'));
write(pagesOnly, 'package.json', JSON.stringify({ dependencies: { next: '16.3.4' } }));
write(pagesOnly, 'pages/index.tsx', `export default function Page(){ return null; }\n`);
assert.throws(() => compileNextSiteStateGraph({ root: pagesOnly, repository: { fullName: 'owner/pages' }, site: { origin: 'https://pages.example', basePath: '/' } }), /requires App Router/);

const conflicting = fixture();
write(conflicting, 'astro.config.mjs', `export default {};\n`);
assert.throws(() => detectRepositoryMapperAdapter({ root: conflicting }), /conflicting framework signals/);

console.log('PASS Next.js Repository Mapper resolves only inspectable App Router routes/metadata surfaces, preserves dynamic/config ambiguity, excludes generated output, and gates grounded machine-surface transforms with exact digest ownership');
