import assert from 'node:assert/strict';
import {
  analyzeUrlMigrationIntegrity,
  normalizeMigrationPairs,
  urlMigrationIntegrity,
  validateUrlMigrationIntegrityReport
} from '../lib/url-migration-integrity.mjs';
import { analyzeInternalDiscoveryFromPages } from '../lib/internal-discovery.mjs';
import { validateSiteStateGraph } from '../lib/repository-mapper.mjs';

const origin = 'https://example.com';
const oldUrl = `${origin}/old`;
const newUrl = `${origin}/new`;
const digest = char => `sha256:${char.repeat(64)}`;

function graph(phase) {
  const before = phase === 'before';
  const routePath = before ? '/old' : '/new';
  const ownerPath = before ? 'old.html' : 'new.html';
  const files = [{ path: ownerPath, sha256: digest(before ? 'a' : 'b'), bytes: 100, role: 'page-source', mutationClass: 'editorial', generated: false }];
  const routes = [{ id: `route:${routePath}`, routePath, url: `${origin}${routePath}`, state: 'resolved', ownerPath, candidates: [], buildPath: [ownerPath], evidence: ['fixture:route'] }];
  const ownership = [{ surfaceKey: `route:${routePath}:document`, surfaceType: 'document', routePath, state: 'resolved', ownerPath, candidates: [], mutationClass: 'editorial', evidenceClass: 'direct-source', value: null, locator: null, evidence: ['fixture:owner'] }];
  const facts = [];
  const value = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: before ? '2026-09-09T18:00:00.000Z' : '2026-09-09T19:00:00.000Z',
    repository: { fullName: 'owner/site', baseRef: phase, baseCommitSha: (before ? '1' : '2').repeat(40), siteRoot: '.' },
    site: { origin, basePath: '/' },
    adapter: { id: 'static-html', version: '0.1', detection: ['fixture:static-html'], confidence: 'deterministic' },
    files,
    routes,
    ownership,
    facts,
    warnings: [],
    summary: { files: files.length, routes: routes.length, resolvedRoutes: 1, ambiguousRoutes: 0, unresolvedRoutes: 0, ownershipClaims: 1, resolvedOwnership: 1, ambiguousOwnership: 0, unresolvedOwnership: 0, facts: 0 },
    guardrails: { noPathGuessing: true, ambiguityPreserved: true, generatedOutputNotPreferred: true, ownershipIsNotAuthorization: true, policyAndEditorialRemainGated: true, symlinksNotFollowed: true, noRankingGuarantee: true }
  };
  assert.equal(validateSiteStateGraph(value).valid, true);
  return value;
}

const html = body => `<!doctype html><html><head><title>Example</title></head><body>${body}</body></html>`;
const discoveryPage = (url, body) => ({ requestedUrl: url, url, ok: true, status: 200, contentType: 'text/html', headers: {}, html: html(body) });
const cleanDiscovery = analyzeInternalDiscoveryFromPages({
  canonicalUrl: `${origin}/`,
  pages: [
    discoveryPage(`${origin}/`, '<main><a href="/new">New page</a></main>'),
    discoveryPage(newUrl, '<main>New page</main>')
  ],
  generatedAt: '2026-09-09T19:00:00Z'
});
const dirtyDiscovery = analyzeInternalDiscoveryFromPages({
  canonicalUrl: `${origin}/`,
  pages: [
    discoveryPage(`${origin}/`, '<main><a href="/old">Old page</a><a href="/new">New page</a></main>'),
    discoveryPage(newUrl, '<main>New page</main>')
  ],
  generatedAt: '2026-09-09T19:00:00Z'
});

const directTrace = {
  state: 'observed',
  requestedUrl: oldUrl,
  finalUrl: newUrl,
  finalStatus: 200,
  redirectCount: 1,
  hops: [
    { url: oldUrl, status: 301, location: newUrl },
    { url: newUrl, status: 200, location: null }
  ]
};
const cleanTarget = { state: 'observed', url: newUrl, status: 200, finalUrl: newUrl, contentType: 'text/html', html: true, canonical: newUrl, noindex: false };
const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${newUrl}</loc><lastmod>2026-09-09</lastmod></url></urlset>`;

{
  const report = analyzeUrlMigrationIntegrity({
    pairs: [{ oldUrl, newUrl }],
    traceByOldUrl: new Map([[oldUrl, directTrace]]),
    targetByNewUrl: new Map([[newUrl, cleanTarget]]),
    beforeState: graph('before'),
    afterState: graph('after'),
    afterSitemapXml: sitemap,
    internalDiscovery: cleanDiscovery,
    generatedAt: '2026-09-09T19:05:00Z'
  });
  assert.equal(validateUrlMigrationIntegrityReport(report).valid, true);
  assert.deepEqual(report.summary, { pairs: 1, checks: 8, pass: 8, fail: 0, watch: 0, unknown: 0, notProvided: 0, notApplicable: 0, pairsWithBlockingFindings: 0 });
  assert.equal(report.actions.length, 0);
  assert.equal(report.guardrails.canonicalIsNotRedirectProof, true);
}

{
  const chain = structuredClone(directTrace);
  chain.redirectCount = 2;
  chain.hops = [
    { url: oldUrl, status: 308, location: `${origin}/middle` },
    { url: `${origin}/middle`, status: 301, location: newUrl },
    { url: newUrl, status: 200, location: null }
  ];
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: chain }, targetByNewUrl: { [newUrl]: cleanTarget } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-destination').status, 'pass');
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-directness').status, 'watch');
  assert.ok(report.actions.some(item => item.checkId === 'redirect-directness'));
}

{
  const temporary = structuredClone(directTrace);
  temporary.hops[0].status = 302;
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: temporary }, targetByNewUrl: { [newUrl]: cleanTarget } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-directness').status, 'watch');
}

{
  const mismatch = structuredClone(directTrace);
  mismatch.finalUrl = `${origin}/wrong`;
  mismatch.hops = [
    { url: oldUrl, status: 301, location: `${origin}/wrong` },
    { url: `${origin}/wrong`, status: 200, location: null }
  ];
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: mismatch }, targetByNewUrl: { [newUrl]: cleanTarget } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-destination').status, 'fail');
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-directness').status, 'not-applicable');
  assert.equal(report.summary.pairsWithBlockingFindings, 1);
}

{
  const noRedirect = { state: 'observed', requestedUrl: oldUrl, finalUrl: oldUrl, finalStatus: 200, redirectCount: 0, hops: [{ url: oldUrl, status: 200, location: null }] };
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: noRedirect }, targetByNewUrl: { [newUrl]: cleanTarget } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-destination').status, 'fail');
}

{
  const target = { ...cleanTarget, noindex: true, canonical: oldUrl };
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: directTrace }, targetByNewUrl: { [newUrl]: target } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'target-indexability').status, 'fail');
  assert.equal(report.pairs[0].checks.find(item => item.id === 'target-canonical').status, 'fail');
}

{
  const target = { ...cleanTarget, canonical: null };
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: directTrace }, targetByNewUrl: { [newUrl]: target } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'target-canonical').status, 'watch');
}

{
  const target = { ...cleanTarget, contentType: 'application/pdf', html: false, canonical: null };
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: directTrace }, targetByNewUrl: { [newUrl]: target } });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'target-canonical').status, 'not-applicable');
}

{
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], traceByOldUrl: { [oldUrl]: directTrace }, targetByNewUrl: { [newUrl]: cleanTarget }, internalDiscovery: dirtyDiscovery });
  const cleanup = report.pairs[0].checks.find(item => item.id === 'internal-link-cleanup');
  assert.equal(cleanup.status, 'fail');
  assert.equal(report.pairs[0].internalLinks.oldTargetEdges, 1);
  assert.deepEqual(report.pairs[0].internalLinks.sourceUrlsPreview, [`${origin}/`]);
}

{
  const crossOld = 'https://old.example.net/page';
  const crossNew = 'https://new.example.net/page';
  const crossDiscovery = analyzeInternalDiscoveryFromPages({
    canonicalUrl: 'https://new.example.net/',
    pages: [discoveryPage('https://new.example.net/', '<main>Home</main>')],
    generatedAt: '2026-09-09T19:00:00Z'
  });
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl: crossOld, newUrl: crossNew }], internalDiscovery: crossDiscovery });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'internal-link-cleanup').status, 'unknown');
  assert.equal(report.guardrails.crossOriginOldLinksRemainUnknown, true);
}

{
  const oldAndNewSitemap = `<?xml version="1.0"?><urlset><url><loc>${oldUrl}</loc></url><url><loc>${newUrl}</loc></url></urlset>`;
  const report = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], afterSitemapXml: oldAndNewSitemap });
  assert.equal(report.pairs[0].checks.find(item => item.id === 'canonical-sitemap').status, 'watch');
  const missingNew = analyzeUrlMigrationIntegrity({ pairs: [{ oldUrl, newUrl }], afterSitemapXml: `<?xml version="1.0"?><urlset><url><loc>${oldUrl}</loc></url></urlset>` });
  assert.equal(missingNew.pairs[0].checks.find(item => item.id === 'canonical-sitemap').status, 'fail');
}

assert.throws(() => normalizeMigrationPairs([{ oldUrl, newUrl: oldUrl }]), /maps a URL to itself/);
assert.throws(() => normalizeMigrationPairs([{ oldUrl, newUrl }, { oldUrl, newUrl: `${origin}/other` }]), /Duplicate oldUrl/);
assert.throws(() => normalizeMigrationPairs([{ oldUrl: 'http://example.com/old', newUrl }]), /HTTPS/);

{
  const resolveImpl = async () => [{ address: '93.184.216.34', family: 4 }];
  let cancels = 0;
  const response = (status, body, headers = {}) => ({
    status,
    headers: { get: name => headers[String(name).toLowerCase()] ?? null },
    body: { cancel: async () => { cancels += 1; } },
    text: async () => body
  });
  const fetchImpl = async url => {
    if (url === oldUrl) return response(301, '', { location: newUrl });
    if (url === newUrl) return response(200, '<!doctype html><html><head><!-- <meta name="robots" content="noindex"><link rel="canonical" href="https://example.com/wrong"> --><link rel="canonical" href="https://example.com/new"></head><body>New</body></html>', { 'content-type': 'text/html; charset=utf-8' });
    throw new Error(`unexpected URL ${url}`);
  };
  const report = await urlMigrationIntegrity([{ oldUrl, newUrl }], { fetchImpl, resolveImpl, generatedAt: '2026-09-09T19:05:00Z' });
  assert.equal(report.pairs[0].target.noindex, false, 'commented fake noindex must not become live migration evidence');
  assert.equal(report.pairs[0].target.canonical, newUrl, 'commented fake canonical must not override the live head canonical');
  assert.equal(report.pairs[0].checks.find(item => item.id === 'redirect-directness').status, 'pass');
  assert.ok(cancels >= 2, 'redirect-trace responses should be cancelled without body download');
}

console.log('PASS URL Migration Integrity separates live redirect destination/directness, destination canonical/indexability, optional repository/sitemap/internal-link evidence and Search outcomes without a composite migration score.');
