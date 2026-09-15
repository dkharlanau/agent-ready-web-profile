import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileNextjsSearchPack, loadNextjsSearchPackRegistry } from '../lib/nextjs-search-pack.mjs';

function write(root, name, content) {
  const target = path.join(root, ...name.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}
function html(url, title) {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${title} description"><link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"${url}"}</script></head><body><main><h1>${title}</h1></main></body></html>`;
}
function cleanFixture({ artifact = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-search-'));
  write(root, 'package.json', JSON.stringify({ dependencies: { next: '16.3.4', react: '19.2.0' } }, null, 2));
  write(root, 'next.config.ts', `export default { output: 'export', images: { unoptimized: true } };\n`);
  write(root, 'src/app/layout.tsx', `import type { Metadata } from 'next';\nexport const metadata: Metadata = { metadataBase: new URL('https://example.com'), title: { default: 'Example', template: '%s | Example' } };\nexport default function Layout({ children }) { return <html><body>{children}</body></html>; }\n`);
  write(root, 'src/app/page.tsx', `export const metadata = { title: 'Home' };\nexport default function Page() { const data = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Home' }; return <main><h1>Home</h1><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} /></main>; }\n`);
  write(root, 'src/app/blog/[slug]/page.tsx', `export function generateStaticParams() { return [{ slug: 'hello' }]; }\nexport async function generateMetadata({ params }) { return { title: 'Post' }; }\nexport default function Page() { return <main><h1>Post</h1></main>; }\n`);
  write(root, 'src/app/sitemap.ts', `export default function sitemap() { return [{ url: 'https://example.com/' }, { url: 'https://example.com/blog/hello' }]; }\n`);
  write(root, 'src/app/robots.ts', `export default function robots() { return { rules: { userAgent: '*', allow: '/' } }; }\n`);
  if (!artifact) return { root, artifactRoot: null };
  const artifactRoot = path.join(root, 'out');
  write(artifactRoot, 'index.html', html('https://example.com/', 'Home'));
  write(artifactRoot, 'blog/hello.html', html('https://example.com/blog/hello', 'Post'));
  write(artifactRoot, 'sitemap.xml', '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/blog/hello</loc></url></urlset>');
  return { root, artifactRoot };
}
function compile(root, artifactRoot = null) {
  return compileNextjsSearchPack({
    root,
    repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha: 'a'.repeat(40) },
    site: { origin: 'https://example.com', basePath: '/' },
    artifactRoot,
    artifactSite: 'https://example.com/',
    sourceSha: 'a'.repeat(40),
    generatedAt: '2026-09-15T10:00:00.000Z'
  });
}
function copyFixture() {
  return cleanFixture({ artifact: false }).root;
}

const registry = loadNextjsSearchPackRegistry();
assert.equal(registry.version, '0.2');
assert.equal(registry.reviewedAt, '2026-09-15');
assert.equal(registry.rules.length, 6);
assert.equal(new Set(registry.rules.map(rule => rule.id)).size, 6);

const clean = cleanFixture();
const report = compile(clean.root, clean.artifactRoot);
assert.equal(report.pass, true, JSON.stringify(report.failures));
assert.equal(report.sourcePass, true);
assert.equal(report.releaseEvidenceComplete, true);
assert.equal(report.deployment.mode, 'static-export');
assert.equal(report.deployment.expectedArtifactDirectory, 'out');
assert.equal(report.artifact.state, 'pass');
assert.equal(report.framework.nextVersion, '16.3.4');
assert.equal(report.source.metadata.metadataBase.includes('src/app/layout.tsx'), true);
assert.equal(report.source.metadata.generateMetadata.includes('src/app/blog/[slug]/page.tsx'), true);
assert.equal(report.source.dynamicRoutes[0].generateStaticParamsOwner, 'src/app/blog/[slug]/page.tsx');
assert.equal(report.source.mapperUnresolved > 0, true, 'source mapper must keep concrete dynamic expansion unresolved');

const noArtifactFixture = cleanFixture({ artifact: false });
const noArtifact = compile(noArtifactFixture.root);
assert.equal(noArtifact.pass, true, 'missing final artifact is watch, not invented source failure');
assert.equal(noArtifact.releaseEvidenceComplete, false);
assert.ok(noArtifact.watches.some(item => item.code === 'next-static-export-final-artifact-not-provided'));

const cookiesRoot = copyFixture();
write(cookiesRoot, 'src/app/account/page.tsx', `import { cookies } from 'next/headers';\nexport default async function Page(){ const jar = await cookies(); return <main>{String(jar)}</main>; }\n`);
const cookies = compile(cookiesRoot);
assert.equal(cookies.pass, false);
assert.ok(cookies.failures.some(item => item.code === 'next-static-export-cookies-runtime'));

const clientMetadataRoot = copyFixture();
write(clientMetadataRoot, 'src/app/client/page.tsx', `'use client';\nexport const metadata = { title: 'Client' };\nexport default function Page(){ return <main>Client</main>; }\n`);
const clientMetadata = compile(clientMetadataRoot);
assert.equal(clientMetadata.pass, false);
assert.ok(clientMetadata.failures.some(item => item.code === 'next-client-metadata-export'));

const dynamicRoot = copyFixture();
write(dynamicRoot, 'src/app/shop/[id]/page.tsx', `export default function Page(){ return <main>Item</main>; }\n`);
const dynamic = compile(dynamicRoot);
assert.equal(dynamic.pass, false);
assert.ok(dynamic.failures.some(item => item.code === 'next-static-export-dynamic-route-without-static-params'));

const configRoot = copyFixture();
write(configRoot, 'next.config.ts', `export default { output: 'export', async rewrites(){ return [{ source: '/a', destination: '/b' }]; } };\n`);
const config = compile(configRoot);
assert.equal(config.pass, false);
assert.ok(config.failures.some(item => item.code === 'next-static-export-rewrites-unsupported'));

const handlerRoot = copyFixture();
write(handlerRoot, 'src/app/api/route.ts', `export async function POST(){ return Response.json({ ok: true }); }\n`);
const handler = compile(handlerRoot);
assert.equal(handler.pass, false);
assert.ok(handler.failures.some(item => item.code === 'next-static-export-route-handler-non-get'));

const requestRoot = copyFixture();
write(requestRoot, 'src/app/data.json/route.ts', `export async function GET(request){ return Response.json({ url: request.url }); }\n`);
const requestDependent = compile(requestRoot);
assert.equal(requestDependent.pass, false);
assert.ok(requestDependent.failures.some(item => item.code === 'next-static-export-route-handler-request-dependent'));

const serverRoot = copyFixture();
write(serverRoot, 'src/app/actions.ts', `'use server';\nexport async function save(){ return true; }\n`);
const serverAction = compile(serverRoot);
assert.equal(serverAction.pass, false);
assert.ok(serverAction.failures.some(item => item.code === 'next-static-export-server-action'));

const isrRoot = copyFixture();
write(isrRoot, 'src/app/news/page.tsx', `export const revalidate = 60;\nexport default function Page(){ return <main>News</main>; }\n`);
const isr = compile(isrRoot);
assert.equal(isr.pass, false);
assert.ok(isr.failures.some(item => item.code === 'next-static-export-isr'));

const proxyRoot = copyFixture();
write(proxyRoot, 'proxy.ts', `export function proxy(){ return new Response('ok'); }\n`);
const proxy = compile(proxyRoot);
assert.equal(proxy.pass, false);
assert.ok(proxy.failures.some(item => item.code === 'next-static-export-proxy-unsupported'));

const jsonLdRoot = copyFixture();
write(jsonLdRoot, 'src/app/schema/page.tsx', `export default function Page(){ const data = { '@context': 'https://schema.org', name: '<unsafe>' }; return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />; }\n`);
const jsonLd = compile(jsonLdRoot);
assert.equal(jsonLd.pass, true, 'unproven custom JSON-LD sanitization remains review/watch');
assert.ok(jsonLd.watches.some(item => item.code === 'next-jsonld-sanitization-unproven'));

const imageRoot = copyFixture();
write(imageRoot, 'next.config.ts', `export default { output: 'export' };\n`);
write(imageRoot, 'src/app/image/page.tsx', `import Image from 'next/image';\nexport default function Page(){ return <Image src="/x.png" alt="x" width={10} height={10}/>; }\n`);
const image = compile(imageRoot);
assert.equal(image.pass, true, 'per-component image loaders may exist; source absence stays watch');
assert.ok(image.watches.some(item => item.code === 'next-static-export-image-loader-unproven'));

const artifactBad = cleanFixture();
write(artifactBad.artifactRoot, 'blog/hello.html', '<!doctype html><html><head><title>Broken</title></head><body>Broken</body></html>');
const artifactFailure = compile(artifactBad.root, artifactBad.artifactRoot);
assert.equal(artifactFailure.pass, false);
assert.equal(artifactFailure.artifact.state, 'fail');
assert.ok(artifactFailure.failures.some(item => item.code === 'next-final-artifact-search-contract-failed'));

const dynamicModeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-runtime-'));
write(dynamicModeRoot, 'package.json', JSON.stringify({ dependencies: { next: '16.3.4' } }));
write(dynamicModeRoot, 'next.config.ts', `export default {};\n`);
write(dynamicModeRoot, 'app/layout.tsx', `export const metadata = { title: 'Runtime' }; export default function Layout({ children }){ return <html><body>{children}</body></html>; }\n`);
write(dynamicModeRoot, 'app/page.tsx', `export default function Page(){ return <main>Runtime</main>; }\n`);
const dynamicMode = compile(dynamicModeRoot);
assert.equal(dynamicMode.deployment.mode, 'dynamic-or-unspecified');
assert.equal(dynamicMode.pass, true);
assert.equal(dynamicMode.releaseEvidenceComplete, true, 'static artifact proof is required only when static export is explicitly declared');

console.log('PASS Next.js Search Pack v0.2 separates non-executing App Router source diagnostics from final static-export Search artifact evidence and fails closed on inspectable static-export incompatibilities.');
