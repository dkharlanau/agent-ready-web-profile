import assert from 'node:assert/strict';
import { auditInternalLinkTargetHealth, mergeInternalLinkHealth, selectInternalLinkTargets } from '../lib/internal-link-target-health.mjs';

const canonicalUrl = 'https://example.com/';
const sourceA = `${canonicalUrl}a/`;
const sourceB = `${canonicalUrl}b/`;
const sourcePages = [
  {
    ok: true,
    url: sourceA,
    text: '<main><a href="/ok/">OK</a><a href="/ok/">OK again</a><a href="/missing/">Missing</a><a href="/redirect/">Redirect</a><a href="https://other.example/out/">External</a></main>'
  },
  {
    ok: true,
    url: sourceB,
    text: '<main><a href="/ok/">OK</a><a href="/server/">Server</a><a href="/login/">Login</a><a href="mailto:test@example.com">Mail</a></main>'
  }
];

const selected = selectInternalLinkTargets(sourcePages, canonicalUrl, 5);
assert.deepEqual(selected.map(item => item.url), [
  'https://example.com/ok/',
  'https://example.com/login/',
  'https://example.com/missing/',
  'https://example.com/redirect/',
  'https://example.com/server/'
]);
assert.equal(selected[0].sourcePages, 2);
assert.equal(selected[0].occurrences, 3);
assert.equal(selectInternalLinkTargets(sourcePages, canonicalUrl, 0).length, 0);

const htmlByUrl = new Map([
  [sourceA, sourcePages[0].text],
  [sourceB, sourcePages[1].text]
]);

const statusByUrl = new Map([
  ['https://example.com/ok/', { status: 200 }],
  ['https://example.com/missing/', { status: 404 }],
  ['https://example.com/server/', { status: 503 }],
  ['https://example.com/login/', { status: 403 }],
  ['https://example.com/redirect/', { status: 301, location: '/ok/' }]
]);

async function resolveImpl() {
  return [{ address: '93.184.216.34', family: 4 }];
}

async function fetchImpl(url) {
  const href = String(url);
  if (htmlByUrl.has(href)) return new Response(htmlByUrl.get(href), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  const entry = statusByUrl.get(href);
  if (!entry) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  if (entry.location) headers.location = entry.location;
  return new Response(entry.status === 200 ? '<main>OK</main>' : 'state', { status: entry.status, headers });
}

const audit = await auditInternalLinkTargetHealth({
  canonicalUrl,
  cohortUrls: [sourceA, sourceB],
  maxTargets: 5,
  concurrency: 2,
  timeoutMs: 2000,
  maxBytes: 64 * 1024,
  fetchImpl,
  resolveImpl
});

assert.equal(audit.selectedTargets, 5);
assert.equal(audit.sourcePagesUnavailable, 0);
assert.equal(audit.check.status, 'fail');
assert.equal(audit.check.sampledTargets.filter(item => item.state === 'fail').length, 2);
assert.equal(audit.check.sampledTargets.find(item => item.url.endsWith('/missing/')).reason, 'HTTP 404');
assert.equal(audit.check.sampledTargets.find(item => item.url.endsWith('/server/')).reason, 'HTTP 503');
assert.equal(audit.check.sampledTargets.find(item => item.url.endsWith('/login/')).state, 'watch');
assert.equal(audit.check.sampledTargets.find(item => item.url.endsWith('/redirect/')).state, 'watch');
assert.match(audit.check.sampledTargets.find(item => item.url.endsWith('/redirect/')).reason, /redirects to/);

const merged = mergeInternalLinkHealth({
  version: '0.2',
  rulesVersion: '0.4',
  summary: { counts: { pass: 1, fail: 0, watch: 1, 'not-applicable': 0 }, p0Failures: 0, state: 'review' },
  checks: [
    { id: 'google-robots-fetch-state', priority: 'P0', status: 'pass' },
    { id: 'bounded-internal-link-target-health', priority: 'P1', status: 'watch', message: 'placeholder' }
  ]
}, audit);
assert.equal(merged.rulesVersion, '0.4');
assert.equal(merged.checks.find(item => item.id === 'bounded-internal-link-target-health').status, 'fail');
assert.equal(merged.summary.counts.fail, 1);
assert.equal(merged.summary.counts.watch, 0);
assert.equal(merged.summary.p0Failures, 0);
assert.equal(merged.summary.state, 'review');
assert.equal(merged.internalLinkTargetAudit.selectedTargets, 5);

const healthyStatusByUrl = new Map([
  ['https://example.com/ok/', { status: 200 }],
  ['https://example.com/missing/', { status: 200 }]
]);
async function healthyFetch(url) {
  const href = String(url);
  if (htmlByUrl.has(href)) return new Response('<main><a href="/ok/">OK</a><a href="/missing/">Also OK</a></main>', { status: 200, headers: { 'content-type': 'text/html' } });
  const entry = healthyStatusByUrl.get(href) || { status: 200 };
  return new Response('<main>OK</main>', { status: entry.status, headers: { 'content-type': 'text/html' } });
}
const healthy = await auditInternalLinkTargetHealth({
  canonicalUrl,
  cohortUrls: [sourceA],
  maxTargets: 2,
  concurrency: 1,
  fetchImpl: healthyFetch,
  resolveImpl
});
assert.equal(healthy.check.status, 'pass');
assert.equal(healthy.check.sampledTargets.every(item => item.state === 'pass'), true);

console.log('internal-link target health tests passed');
