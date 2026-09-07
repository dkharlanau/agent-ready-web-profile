import assert from 'node:assert/strict';
import { analyzeVerticalEvidenceSite, discoverVerticalUrls } from '../lib/growth-vertical-site.mjs';
import { verticalEvidenceActions } from '../lib/growth-vertical-evidence.mjs';

const root = 'https://software.example/project/';
const entryHtml = `<!doctype html><html><body>
<h1>Example Software</h1>
<a href="docs/">Docs</a>
<a href="unrelated/team/">Team</a>
</body></html>`;
const sitemap = `<urlset>
<url><loc>${root}</loc></url>
<url><loc>${root}product/</loc></url>
<url><loc>${root}changelog/</loc></url>
<url><loc>${root}docs/</loc></url>
<url><loc>${root}support/</loc></url>
<url><loc>${root}api/</loc></url>
<url><loc>https://other.example/product/</loc></url>
</urlset>`;

const discovered = discoverVerticalUrls({ canonicalUrl: root, entryHtml, sitemapXml: sitemap, vertical: 'software-product', maxPages: 6 });
assert.equal(discovered[0], root);
assert.ok(discovered.includes(`${root}product/`));
assert.ok(discovered.includes(`${root}docs/`));
assert.ok(discovered.includes(`${root}changelog/`));
assert.equal(discovered.includes('https://other.example/product/'), false, 'cross-origin sitemap URLs must be excluded');
assert.equal(discovered.some(url => url.includes('/unrelated/team/')), false, 'irrelevant same-origin URLs should not consume the vertical evidence budget');
assert.ok(discovered.length <= 6);

const pages = [
  {
    ok: true,
    url: `${root}product/`,
    text: `<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Example Software","url":"${root}product/","softwareVersion":"2.4.0"}</script></head><body><h1>Product</h1></body></html>`
  },
  {
    ok: true,
    url: `${root}changelog/`,
    text: `<!doctype html><html><body><h1>Changelog</h1><a href="${root}changelog/v2.4/">Version 2.4 release notes</a></body></html>`
  },
  {
    ok: true,
    url: `${root}docs/`,
    text: `<!doctype html><html><body><h1>Docs</h1><a href="${root}docs/guide/">Documentation guide</a><a href="${root}examples/">Examples</a><a href="${root}support/">Support</a><a href="${root}api/">API</a></body></html>`
  },
  {
    ok: true,
    url: `${root}support/`,
    text: '<!doctype html><html><body><h1>Support</h1></body></html>'
  },
  {
    ok: true,
    url: `${root}api/`,
    text: '<!doctype html><html><body><h1>API</h1></body></html>'
  }
];

const report = await analyzeVerticalEvidenceSite(root, {
  vertical: 'software-product',
  maxPages: 6,
  entryPage: { ok: true, url: root, text: entryHtml },
  sitemap: { ok: true, url: `${root}sitemap.xml`, text: sitemap },
  pages
});
assert.equal(report.coverage, 'bounded-relevant-surface-public-evidence');
assert.equal(report.vertical, 'software-product');
assert.ok(report.pagesObserved >= 4);
assert.ok(report.discoveredUrls.length <= 6);
assert.equal(report.failedUrls.length, 0);
for (const id of [
  'software-product-identity',
  'software-product-release-history',
  'software-product-docs-support',
  'software-product-agent-interfaces'
]) {
  const check = report.checks.find(item => item.id === id);
  assert.ok(check, `missing ${id}`);
  assert.equal(check.status, 'observed', `${id} should be satisfied by evidence distributed across relevant surfaces`);
  assert.ok(check.surfaceObservations >= 1);
  assert.ok(check.observedOn.length >= 1);
}
assert.equal(verticalEvidenceActions(report).length, 0, 'multi-surface evidence should suppress false homepage-only remediation');

const bounded = discoverVerticalUrls({ canonicalUrl: root, entryHtml, sitemapXml: sitemap, vertical: 'software-product', maxPages: 2 });
assert.equal(bounded.length, 2, 'vertical discovery must obey the hard page budget');
assert.equal(bounded[0], root);
assert.throws(() => discoverVerticalUrls({ canonicalUrl: root, vertical: 'software-product', maxPages: 13 }), /between 1 and 12/);

const unavailable = await analyzeVerticalEvidenceSite(root, {
  vertical: 'software-product',
  entryPage: { ok: false, url: root, text: null, issue: 'fixture unavailable' }
});
assert.equal(unavailable.coverage, 'unavailable');
assert.equal(unavailable.pagesObserved, 0);
assert.equal(unavailable.summary.unavailable, 4);
assert.equal(verticalEvidenceActions(unavailable).length, 0);

console.log('PASS bounded vertical site evidence discovers relevant same-origin surfaces from links+sitemap, aggregates distributed software evidence, obeys page budgets, and suppresses false homepage-only remediation');
