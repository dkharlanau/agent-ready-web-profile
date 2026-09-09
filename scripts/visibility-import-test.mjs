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
  const options = { site: 'https://example.com/', start: '2026-08-01', end: '2026-08-31', capturedAt: '2026-09-01T10:00:00Z' };
  const google = path.join(temp, 'google.csv');
  fs.writeFileSync(google, 'Date,Page,Country,Device,AI Impressions\n2026-08-01,https://example.com/a,US,DESKTOP,"1,200"\n2026-08-02,https://example.com/a,US,MOBILE,800\n2026-08-03,https://example.com/b,DE,MOBILE,100\n');
  const g = importVisibilityExport('google', google, options);
  assert.equal(g.snapshot.version, '0.2');
  assert.equal(g.snapshot.sources[0].provider, 'google-search-console-generative-ai');
  assert.equal(g.snapshot.sources[0].metrics.aiImpressions, 2100);
  assert.equal(g.snapshot.sources[0].metrics.aiVisiblePages, 2);
  assert.equal(g.snapshot.sources[0].metrics.aiVisibleCountries, 2);
  assert.equal(g.snapshot.sources[0].metrics.aiVisibleDevices, 2);
  assert.equal(validateVisibilitySnapshot(g.snapshot).valid, true);

  const web = path.join(temp, 'web.csv');
  fs.writeFileSync(web, 'Date,Clicks,Impressions,CTR,Position\n2026-08-01,3,100,3%,4.5\n');
  assert.throws(() => importVisibilityExport('google', web, options), /Impressions is ambiguous/);
  assert.throws(() => importVisibilityExport('google', web, { ...options, reportScope: 'web' }), /Ordinary Web Search/);

  const scoped = path.join(temp, 'generative.csv');
  fs.writeFileSync(scoped, 'Date,Page,Impressions\n2026-08-01,https://example.com/a,12\n2026-08-02,https://example.com/b,0\n');
  const scopedResult = importVisibilityExport('google', scoped, { ...options, reportScope: 'generative-ai', evidence: 'https://example.com/evidence/generative-export' });
  assert.equal(scopedResult.snapshot.sources[0].metrics.aiImpressions, 12);
  assert.equal(scopedResult.snapshot.sources[0].metrics.aiVisiblePages, 2);
  assert.equal(scopedResult.snapshot.sources[0].evidence, 'https://example.com/evidence/generative-export');

  const json = path.join(temp, 'google.json');
  fs.writeFileSync(json, JSON.stringify([{ 'AI Impressions': null, Impressions: 900 }]));
  const unavailable = importVisibilityExport('google', json, options);
  assert.deepEqual(unavailable.snapshot.sources[0].metrics, {});
  assert.equal(unavailable.snapshot.sources[0].status, 'partial');

  const cli = fileURLToPath(new URL('../bin/arwp-visibility.mjs', import.meta.url));
  const output = path.join(temp, 'imported.json');
  const cliArgs = ['--provider=google', '--site=https://example.com/', '--start=2026-08-01', '--end=2026-08-31', `--output=${output}`, '--json'];
  const rejected = spawnSync(process.execPath, [cli, 'import', web, ...cliArgs], { encoding: 'utf8' });
  assert.equal(rejected.status, 2, rejected.stderr);
  assert.match(JSON.parse(rejected.stdout).fatal, /Impressions is ambiguous/);
  assert.equal(fs.existsSync(output), false);
  const accepted = spawnSync(process.execPath, [cli, 'import', scoped, ...cliArgs, '--report-scope=generative-ai'], { encoding: 'utf8' });
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')).sources[0].metrics, { aiImpressions: 12, aiVisiblePages: 2 });

  const bing = path.join(temp, 'bing.csv');
  fs.writeFileSync(bing, 'Cited URL,Citations,Grounding Query\nhttps://example.com/a,4,alpha\nhttps://example.com/a,2,beta\nhttps://example.com/b,3,alpha\n');
  const b = importVisibilityExport('bing', bing, options);
  assert.equal(b.snapshot.sources[0].metrics.totalCitations, 9);
  assert.equal(b.snapshot.sources[0].metrics.citedPages, 2);
  assert.equal(b.snapshot.sources[0].metrics.groundingQueriesSampled, 2);

  const cloudflare = path.join(temp, 'cloudflare.csv');
  fs.writeFileSync(cloudflare, 'Status Code,Requests,Action,Bytes Transferred,Referrals\n200,80,allow,10000,4\n403,20,block,1000,0\n');
  const c = importVisibilityExport('cloudflare', cloudflare, options);
  assert.equal(c.snapshot.sources[0].provider, 'cloudflare-ai-crawl-control');
  assert.deepEqual(c.snapshot.sources[0].metrics, {
    aiCrawlerRequests: 100,
    aiCrawlerAllowedRequests: 80,
    aiCrawlerSuccessfulRequests: 80,
    aiCrawlerUnsuccessfulRequests: 20,
    aiCrawlerReferrals: 4,
    bytesTransferred: 11000
  });
  assert.equal(validateVisibilitySnapshot(c.snapshot).valid, true);

  const referrals = path.join(temp, 'referrals.csv');
  fs.writeFileSync(referrals, 'Source,Sessions,Engaged Sessions,Conversions\nchatgpt.com,11,7,2\nperplexity.ai,5,3,1\nexample.org,100,80,20\n');
  const r = importVisibilityExport('referrals', referrals, { ...options, match: 'chatgpt.com,perplexity.ai' });
  assert.deepEqual(r.snapshot.sources[0].metrics, { referrals: 16, engagedVisits: 10, taskCompletions: 3 });
  assert.match(r.snapshot.sources[0].notes, /chatgpt\.com/);
  assert.equal(validateVisibilitySnapshot(r.snapshot).valid, true);

  const utm = path.join(temp, 'utm.csv');
  fs.writeFileSync(utm, 'utm_source,Sessions\nchatgpt.com,6\nnewsletter,50\n');
  assert.equal(importVisibilityExport('referrals', utm, options).snapshot.sources[0].metrics.referrals, 6);

  const partial = path.join(temp, 'partial.json');
  fs.writeFileSync(partial, JSON.stringify([{ somethingElse: 1 }]));
  const p = importVisibilityExport('google', partial, options);
  assert.equal(p.snapshot.sources[0].status, 'partial');
  assert.deepEqual(p.snapshot.sources[0].metrics, {});

  console.log('PASS visibility import adapters normalize Google, Bing, Cloudflare and AI referral evidence without inventing unavailable metrics');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
