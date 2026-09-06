import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importVisibilityExport, parseCsv } from '../lib/visibility-import.mjs';
import { validateVisibilitySnapshot } from '../lib/visibility-evidence.mjs';

const parsed = parseCsv('Date,AI Impressions\n2026-08-01,"1,200"\n2026-08-02,800\n');
assert.equal(parsed.length, 2);
assert.equal(parsed[0]['AI Impressions'], '1,200');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-visibility-import-'));
try {
  const google = path.join(temp, 'google.csv');
  fs.writeFileSync(google, 'Date,AI Impressions\n2026-08-01,"1,200"\n2026-08-02,800\n');
  const g = importVisibilityExport('google', google, {
    site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z'
  });
  assert.equal(g.snapshot.sources[0].provider, 'google-search-console-generative-ai');
  assert.equal(g.snapshot.sources[0].metrics.aiImpressions, 2000);
  assert.equal(validateVisibilitySnapshot(g.snapshot).valid, true);

  const bing = path.join(temp, 'bing.csv');
  fs.writeFileSync(bing, 'Cited URL,Citations,Grounding Query\nhttps://example.com/a,4,alpha\nhttps://example.com/a,2,beta\nhttps://example.com/b,3,alpha\n');
  const b = importVisibilityExport('bing', bing, {
    site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z'
  });
  assert.equal(b.snapshot.sources[0].metrics.totalCitations, 9);
  assert.equal(b.snapshot.sources[0].metrics.citedPages, 2);
  assert.equal(b.snapshot.sources[0].metrics.groundingQueriesSampled, 2);

  const referrals = path.join(temp, 'referrals.csv');
  fs.writeFileSync(referrals, 'Source,Sessions\nchatgpt.com,11\nperplexity.ai,5\nexample.org,100\n');
  const r = importVisibilityExport('referrals', referrals, {
    site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z', match: 'chatgpt.com,perplexity.ai'
  });
  assert.equal(r.snapshot.sources[0].metrics.referrals, 16);
  assert.match(r.snapshot.sources[0].notes, /chatgpt\.com/);
  assert.equal(validateVisibilitySnapshot(r.snapshot).valid, true);

  const partial = path.join(temp, 'partial.json');
  fs.writeFileSync(partial, JSON.stringify([{ somethingElse: 1 }]));
  const p = importVisibilityExport('google', partial, {
    site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z'
  });
  assert.equal(p.snapshot.sources[0].status, 'partial');
  assert.deepEqual(p.snapshot.sources[0].metrics, {});
  assert.equal(validateVisibilitySnapshot(p.snapshot).valid, true);

  console.log('PASS visibility import adapters normalize owner CSV/JSON evidence without inventing unavailable metrics');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
