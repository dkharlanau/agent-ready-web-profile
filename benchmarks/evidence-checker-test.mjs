import assert from 'node:assert/strict';
import { collectFixtureTargets, runEvidenceChecks } from './evidence-checker.mjs';

const fixture = {
  id: 'alpha',
  url: 'https://alpha.example/',
  ownership: 'independent',
  reviewedAt: '2026-08-20',
  evidence: [
    { url: 'https://alpha.example/docs', note: 'Public docs', sourceType: 'docs' },
    { url: 'https://alpha.example/api.json', note: 'API document', sourceType: 'openapi' },
    { url: 'https://alpha.example/mcp', note: 'Method-specific endpoint', sourceType: 'mcp' },
    { url: 'https://alpha.example/unhealthy', note: 'Unhealthy fixture', sourceType: 'docs' }
  ],
  accepted: {
    read: ['https://alpha.example/docs'],
    search: [],
    structured: [{ url: 'https://alpha.example/api.json', protocol: 'openapi' }],
    tools: [{ url: 'https://alpha.example/mcp', protocol: 'mcp' }],
    agent: []
  }
};

const targets = collectFixtureTargets(fixture);
assert.equal(targets.length, 5, 'duplicate evidence/accepted URLs must be checked once');
const docs = targets.find(item => item.url === 'https://alpha.example/docs');
assert.deepEqual(docs.roles, [
  { role: 'evidence', detail: 'docs' },
  { role: 'accepted-interface', detail: 'read' }
]);

let active = 0;
let maxActive = 0;
const probeImpl = async url => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise(resolve => setTimeout(resolve, 5));
  active -= 1;
  if (url.endsWith('/api.json')) return { ok: false, status: 404, url, redirected: false, contentType: 'application/json' };
  if (url.endsWith('/mcp')) return { ok: false, status: 405, url, redirected: false, contentType: 'application/json' };
  if (url.endsWith('/unhealthy')) return { ok: false, status: 503, url, redirected: false, contentType: 'text/html' };
  if (url.includes('boom.example')) throw new Error('network fixture failure');
  if (url.endsWith('/docs')) return { ok: true, status: 200, url: 'https://alpha.example/docs/latest', redirected: true, contentType: 'text/html' };
  return { ok: true, status: 200, url, redirected: false, contentType: 'text/html' };
};

const report = await runEvidenceChecks([
  fixture,
  {
    ...fixture,
    id: 'boom',
    url: 'https://boom.example/',
    reviewedAt: '2026-01-01',
    evidence: [],
    accepted: { read: [], search: [], structured: [], tools: [], agent: [] }
  },
  { ...fixture, id: 'reference', ownership: 'project-reference' }
], {
  probeImpl,
  concurrency: 2,
  reviewMaxAgeDays: 30,
  now: new Date('2026-08-26T00:00:00Z')
});

assert.equal(report.schemaVersion, '0.2');
assert.equal(report.totals.independentFixtures, 2);
assert.equal(report.totals.targets, 6);
assert.equal(report.totals.reachable, 2);
assert.equal(report.totals.restricted, 1, '405 is endpoint evidence, not proof of absence');
assert.equal(report.totals.missing, 1);
assert.equal(report.totals.unhealthy, 1);
assert.equal(report.totals.errors, 1);
assert.equal(report.totals.redirected, 1);
assert.equal(report.totals.staleReviews, 1);
assert.ok(maxActive <= 2, 'evidence checker must honor the global concurrency bound');
assert.equal(report.sites.find(site => site.id === 'alpha').reviewStale, false);
assert.equal(report.sites.find(site => site.id === 'boom').reviewStale, true);
assert.equal(report.sites.find(site => site.id === 'alpha').checks.find(check => check.url.endsWith('/api.json')).status, 'missing');
assert.equal(report.sites.find(site => site.id === 'alpha').checks.find(check => check.url.endsWith('/mcp')).status, 'restricted');
assert.equal(report.sites.find(site => site.id === 'alpha').checks.find(check => check.url.endsWith('/unhealthy')).status, 'unhealthy');
assert.match(report.sites.find(site => site.id === 'boom').checks[0].error, /network fixture failure/);
assert.match(report.scope, /does not re-confirm semantic ground truth/i);
assert.match(report.statusSemantics.restricted, /401, 403, 405 or 429/);

await assert.rejects(() => runEvidenceChecks([fixture], { probeImpl, concurrency: 0 }), /between 1 and 10/);
await assert.rejects(() => runEvidenceChecks([fixture], { probeImpl, reviewMaxAgeDays: 0 }), /positive integer/);

console.log('PASS evidence checker deduplicates targets, bounds concurrency, classifies restricted/missing/unhealthy responses and keeps transport evidence separate from semantic review');
