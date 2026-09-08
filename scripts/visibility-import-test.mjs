import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

  const options = { site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z' };
  const web = path.join(temp, 'web.csv');
  fs.writeFileSync(web, 'Date,Clicks,Impressions,CTR,Position\n2026-08-01,3,100,3%,4.5\n');
  assert.throws(() => importVisibilityExport('google', web, options), /Impressions is ambiguous/);
  assert.throws(() => importVisibilityExport('google', web, { ...options, reportScope: 'web' }), /Ordinary Web Search/);
  assert.throws(() => importVisibilityExport('google', google, { ...options, reportScope: 'web' }), /Ordinary Web Search/);
  assert.throws(() => importVisibilityExport('google', google, { ...options, reportScope: 'unknown' }), /--report-scope supports only/);

  const scoped = path.join(temp, 'generative.csv');
  fs.writeFileSync(scoped, 'Date,Impressions\n2026-08-01,12\n2026-08-02,0\n');
  const scopedResult = importVisibilityExport('google', scoped, { ...options, reportScope: 'generative-ai', evidence: 'https://example.com/evidence/generative-export' });
  assert.equal(scopedResult.snapshot.sources[0].metrics.aiImpressions, 12);
  assert.equal(scopedResult.snapshot.sources[0].evidence, 'https://example.com/evidence/generative-export');
  assert.equal(scopedResult.import.reportScope, 'generative-ai');
  assert.match(scopedResult.snapshot.sources[0].notes, /scope was supplied by the owner/);
  assert.equal(validateVisibilitySnapshot(scopedResult.snapshot).valid, true);

  const json = path.join(temp, 'google.json');
  for (const column of ['AI Impressions', 'Generative AI Impressions', 'Generative Search Impressions']) {
    fs.writeFileSync(json, JSON.stringify({ rows: [{ [column]: 7, Impressions: 900 }] }));
    const explicit = importVisibilityExport('google', json, options);
    assert.deepEqual(explicit.snapshot.sources[0].metrics, { aiImpressions: 7 });
    assert.equal(explicit.import.reportScope, null);
  }
  fs.writeFileSync(json, JSON.stringify([{ 'AI Impressions': null, Impressions: 900 }]));
  for (const reportScope of [undefined, 'generative-ai']) {
    const unavailable = importVisibilityExport('google', json, { ...options, reportScope });
    assert.deepEqual(unavailable.snapshot.sources[0].metrics, {});
    assert.equal(unavailable.snapshot.sources[0].status, 'partial');
  }
  fs.writeFileSync(json, JSON.stringify([{ 'AI Impressions': 0, Impressions: 900 }]));
  assert.deepEqual(importVisibilityExport('google', json, options).snapshot.sources[0].metrics, { aiImpressions: 0 });
  fs.writeFileSync(json, JSON.stringify([{ 'AI Impressions': 7 }, { Impressions: 900 }]));
  assert.throws(() => importVisibilityExport('google', json, options), /Impressions is ambiguous/);
  fs.writeFileSync(json, JSON.stringify({ rows: [{ Impressions: 0 }] }));
  assert.throws(() => importVisibilityExport('google', json, options), /Impressions is ambiguous/);
  assert.deepEqual(importVisibilityExport('google', json, { ...options, reportScope: 'generative-ai' }).snapshot.sources[0].metrics, { aiImpressions: 0 });

  const cli = fileURLToPath(new URL('../bin/arwp-visibility.mjs', import.meta.url));
  const output = path.join(temp, 'imported.json');
  const cliArgs = ['--provider=google', '--site=https://example.com/', '--start=2026-08-01', '--end=2026-08-31', `--output=${output}`, '--json'];
  const rejected = spawnSync(process.execPath, [cli, 'import', web, ...cliArgs], { encoding: 'utf8' });
  assert.equal(rejected.status, 2, rejected.stderr);
  assert.match(JSON.parse(rejected.stdout).fatal, /Impressions is ambiguous/);
  assert.equal(fs.existsSync(output), false, 'An ambiguous export must not write a visibility snapshot');
  for (const scopeArgs of [['--report-scope=generative-ai'], ['--report-scope', 'generative-ai']]) {
    const accepted = spawnSync(process.execPath, [cli, 'import', scoped, ...cliArgs, ...scopeArgs], { encoding: 'utf8' });
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).import.reportScope, 'generative-ai');
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')).sources[0].metrics, { aiImpressions: 12 });
  }

  const bing = path.join(temp, 'bing.csv');
  fs.writeFileSync(bing, 'Cited URL,Citations,Grounding Query\nhttps://example.com/a,4,alpha\nhttps://example.com/a,2,beta\nhttps://example.com/b,3,alpha\n');
  const b = importVisibilityExport('bing', bing, {
    site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z'
  });
  assert.equal(b.snapshot.sources[0].metrics.totalCitations, 9);
  assert.equal(b.snapshot.sources[0].metrics.citedPages, 2);
  assert.equal(b.snapshot.sources[0].metrics.groundingQueriesSampled, 2);
  assert.throws(() => importVisibilityExport('bing', bing, { ...options, reportScope: 'generative-ai' }), /--report-scope supports only/);

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
