import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeInternalDiscoveryFromPages, validateInternalDiscoveryReport } from '../lib/internal-discovery.mjs';

const root = 'https://example.com/';
const html = body => `<!doctype html><html><head><title>Example</title></head><body>${body}</body></html>`;
const page = (url, body, extra = {}) => ({
  requestedUrl: url,
  url,
  ok: true,
  status: 200,
  contentType: 'text/html; charset=utf-8',
  headers: {},
  html: html(body),
  ...extra
});

const pages = [
  page(root, `
    <header><nav><a href="/a">Section A</a></nav></header>
    <main>
      <p>Read <a href="/b">evidence guide B</a>.</p>
      <section class="related-topics"><a href="/c">Related topic C</a></section>
      <p><a href="/tool">Try the diagnostic tool</a></p>
      <p><a href="/old">Old B address</a></p>
    </main>`),
  page('https://example.com/a', '<main><h1>A</h1></main>'),
  page('https://example.com/legacy', '<main>legacy</main>', { requestedUrl: 'https://example.com/legacy', url: 'https://example.com/b', redirected: true }),
  page('https://example.com/b', '<main><h1>B</h1><p><a href="/c">Continue to topic C</a></p></main>'),
  page('https://example.com/c', '<main><h1>C</h1></main>'),
  page('https://example.com/tool', '<main><h1>Tool</h1></main>'),
  page('https://example.com/orphan', '<main><h1>Orphan candidate</h1></main>'),
  page('https://example.com/old', '<main><h1>Old B</h1></main>', { html: '<!doctype html><html><head><link rel="canonical" href="https://example.com/b"></head><body><main><h1>Old B</h1></main></body></html>' }),
  page('https://example.com/draft', '<main><h1>Draft</h1></main>', { html: '<!doctype html><html><head><meta name="robots" content="noindex"></head><body><main><h1>Draft</h1></main></body></html>' })
];

const report = analyzeInternalDiscoveryFromPages({ canonicalUrl: root, pages, generatedAt: '2026-09-09T18:00:00Z' });
assert.equal(validateInternalDiscoveryReport(report).valid, true);
assert.equal(report.summary.reviewedPages, 9);
assert.equal(report.summary.canonicalOwners, 6);
assert.equal(report.summary.redirectAliases, 1);
assert.equal(report.summary.canonicalAliases, 1);
assert.equal(report.summary.nonIndexableStates, 1);
assert.equal(report.summary.unknownNodes, 0);
assert.equal(report.summary.ownerEdges, 5);
assert.equal(report.summary.globalOwnerEdges, 1);
assert.equal(report.summary.contextualOwnerEdges, 2);
assert.equal(report.summary.hubOwnerEdges, 1);
assert.equal(report.summary.utilityOwnerEdges, 1);
assert.equal(report.summary.transitionEdges, 1);
assert.equal(report.summary.gapEvaluationState, 'complete');
assert.deepEqual(report.gaps.withoutInbound, ['https://example.com/orphan']);
assert.deepEqual(report.gaps.globalOnlyInbound, ['https://example.com/a']);
assert.ok(report.gaps.withoutContinuation.includes('https://example.com/a'));
assert.ok(report.gaps.withoutContinuation.includes('https://example.com/c'));
assert.ok(report.gaps.withoutContinuation.includes('https://example.com/tool'));
assert.deepEqual(report.gaps.transitionTargets, ['https://example.com/old']);
assert.ok(report.actions.some(item => item.url === 'https://example.com/orphan' && item.priority === 'P1'));
assert.ok(report.actions.some(item => item.url === 'https://example.com/a' && /global-only/i.test(item.title)));
assert.equal(report.guardrails.noPageRankApproximation, true);
assert.equal(report.guardrails.linkCountNotCausality, true);

const edge = (from, to) => report.edges.find(item => item.from === from && item.to === to);
assert.equal(edge(root, 'https://example.com/a').linkClass, 'global');
assert.equal(edge(root, 'https://example.com/b').linkClass, 'contextual');
assert.equal(edge(root, 'https://example.com/c').linkClass, 'hub');
assert.equal(edge(root, 'https://example.com/tool').linkClass, 'utility');
assert.equal(edge(root, 'https://example.com/old').targetState, 'transition');

{
  const truncated = analyzeInternalDiscoveryFromPages({
    canonicalUrl: root,
    pages: [
      page(root, '<main><a href="/a">A</a><a href="/orphan">Orphan but beyond cap</a></main>', { maxLinksPerPage: 1 }),
      page('https://example.com/a', '<main>A</main>'),
      page('https://example.com/orphan', '<main>Orphan</main>')
    ],
    generatedAt: '2026-09-09T18:00:00Z'
  });
  assert.equal(truncated.summary.truncatedPages, 1);
  assert.equal(truncated.summary.gapEvaluationState, 'partial');
  assert.deepEqual(truncated.gaps.withoutInbound, [], 'inbound gaps must be suppressed when a canonical owner link sample is truncated');
  assert.deepEqual(truncated.gaps.globalOnlyInbound, []);
  assert.equal(truncated.actions.some(item => item.id.startsWith('internal-discovery:inbound:')), false);
}

{
  const failed = analyzeInternalDiscoveryFromPages({
    canonicalUrl: root,
    pages: [
      page(root, '<main>Home</main>'),
      { requestedUrl: 'https://example.com/fail', url: 'https://example.com/fail', ok: false, status: null, contentType: null, headers: {}, html: null }
    ],
    generatedAt: '2026-09-09T18:00:00Z'
  });
  assert.equal(failed.summary.unknownNodes, 1);
  assert.deepEqual(failed.gaps.unknownPages, ['https://example.com/fail']);
  assert.equal(failed.nodes.find(item => item.url.endsWith('/fail')).nodeClass, 'unknown');
}

assert.throws(() => analyzeInternalDiscoveryFromPages({ canonicalUrl: 'http://example.com/', pages }), /HTTPS/);
assert.throws(() => analyzeInternalDiscoveryFromPages({ canonicalUrl: root, pages: [] }), /non-empty/);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-internal-discovery-'));
const cli = fileURLToPath(new URL('../bin/arwp-internal-discovery.mjs', import.meta.url));
try {
  const reportFile = path.join(directory, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.equal(run('validate', reportFile).status, 0);
  assert.match(run('validate', reportFile).stdout, /PASS Internal Discovery/);
  assert.equal(run('--help').status, 0);
  assert.equal(run('validate').status, 2);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log('PASS Internal Discovery keeps rendered owner relations, redirects/non-indexable states, structural link classes, partial coverage and Search outcome claims separate.');
