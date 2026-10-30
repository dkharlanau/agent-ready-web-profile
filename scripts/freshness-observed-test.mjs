import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareObservedFreshness } from '../lib/freshness-observed.mjs';

const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-observed-freshness-'));
const cli = fileURLToPath(new URL('../bin/arwp-freshness.mjs', import.meta.url));
const url = id => `https://example.test/${id}.json`;
const source = 'https://example.test/sitemap.xml';
const beforeIds = ['date', 'body', 'both', 'same', 'missing', 'failed', 'profile', 'removed'];
const afterIds = ['date', 'body', 'both', 'same', 'missing', 'failed', 'profile', 'added'];
function fixture(which, ids) {
  const dir = path.join(directory, which); fs.mkdirSync(dir);
  const later = which === 'after';
  const rows = ids.map(id => `<url><loc>${url(id)}</loc><lastmod>${later && ['date','both'].includes(id) ? '2026-01-02' : '2026-01-01'}</lastmod></url>`).join('');
  const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), xml);
  const captures = ids.filter(id => id !== 'missing' && id !== 'added' && id !== 'removed').map(id => {
    const body = JSON.stringify({ value: later && ['body','both'].includes(id) ? 2 : 1 });
    const record = { requestedUrl:url(id), finalUrl:url(id), observedAt:later?'2026-01-03T01:00:00Z':'2026-01-01T01:00:00Z', status:200,
      contentType:'application/json', contentEncoding:'identity', bodyScope:'http-payload', requestProfile:later&&id==='profile'?'other':'public-json-v1', complete:true, bodyFile:`${id}.json`, sha256:hash(body) };
    if (id === 'failed') Object.assign(record, { status:503, complete:false, bodyFile:null, sha256:null });
    else fs.writeFileSync(path.join(dir, record.bodyFile), body);
    return record;
  });
  const manifest = { schema:'freshness-observed-capture/v1', sitemap:{ source, finalUrl:source, status:200, contentType:'application/xml', complete:true, observedAt:later?'2026-01-03T00:00:00Z':'2026-01-01T00:00:00Z', file:'sitemap.xml', sha256:hash(xml) }, captures };
  const file = path.join(dir, 'capture.json'); fs.writeFileSync(file, JSON.stringify(manifest)); return { dir, file, manifest };
}
try {
  const before = fixture('before', beforeIds), after = fixture('after', afterIds);
  const result = compareObservedFreshness(before.file, after.file);
  const state = id => result.observations.find(x => x.url === url(id)).state;
  assert.equal(state('date'), 'date_changed_equal_bodies');
  assert.equal(state('body'), 'body_changed_equal_date');
  assert.equal(state('both'), 'both_changed');
  assert.equal(state('same'), 'equal_at_samples');
  for (const id of ['missing','failed','profile']) assert.equal(state(id), 'unknown');
  assert.match(result.observations.find(x=>x.url===url('missing')).reason, /earlier response not captured/);
  assert.match(result.observations.find(x=>x.url===url('failed')).reason, /non-200/);
  assert.match(result.observations.find(x=>x.url===url('profile')).reason, /request profile differs/);
  assert.equal(state('added'), 'added'); assert.equal(state('removed'), 'removed');
  assert.equal(result.observations.length, 9);
  assert.equal(result.source.before.manifestSha256, hash(fs.readFileSync(before.file)));
  assert.match(result.limitations.join(' '), /do not prove there were no changes between/i);
  assert.throws(() => compareObservedFreshness(after.file, before.file), /chronological/);

  const replace = mutation => { const data = structuredClone(after.manifest); mutation(data); fs.writeFileSync(after.file, JSON.stringify(data)); };
  replace(x => { x.sitemap.source = 'https://example.test/other.xml'; x.sitemap.finalUrl = x.sitemap.source; });
  assert.throws(() => compareObservedFreshness(before.file, after.file), /same sitemap URL/);
  replace(x => x.sitemap.status = 500); assert.throws(() => compareObservedFreshness(before.file, after.file), /sitemap observation/);
  replace(x => x.captures.push(x.captures[0])); assert.throws(() => compareObservedFreshness(before.file, after.file), /duplicate/);
  replace(x => x.captures[0].bodyFile = '../before/date.json'); assert.throws(() => compareObservedFreshness(before.file, after.file), /safe relative path/);
  replace(x => x.captures[0].requestedUrl = 'https://foreign.example.test/date.json'); assert.throws(() => compareObservedFreshness(before.file, after.file), /resource observation/);
  replace(x => x.captures[0].sha256 = `sha256:${'0'.repeat(64)}`); assert.throws(() => compareObservedFreshness(before.file, after.file), /digest mismatch/);
  replace(x => x.captures[0].finalUrl = 'https://example.test/other.json'); assert.equal(compareObservedFreshness(before.file, after.file).observations.find(x=>x.url===url('date')).state,'unknown');
  replace(x => x.captures[0].contentEncoding = null); assert.equal(compareObservedFreshness(before.file, after.file).observations.find(x=>x.url===url('date')).state,'unknown');
  replace(x => x.captures[0].bodyScope = 'content-decoded'); assert.equal(compareObservedFreshness(before.file, after.file).observations.find(x=>x.url===url('date')).state,'unknown');
  replace(x => x.captures[0].observedAt = '2026-01-05T00:00:00Z'); assert.equal(compareObservedFreshness(before.file, after.file).observations.find(x=>x.url===url('date')).state,'unknown');
  replace(x => x.captures[0].observedAt = '2026-02-31T00:00:00Z'); assert.throws(() => compareObservedFreshness(before.file, after.file), /resource observation/);
  replace(x => x.sitemap.observedAt = '9999-01-01T00:00:00Z'); assert.throws(() => compareObservedFreshness(before.file, after.file), /sitemap observation/);
  fs.writeFileSync(after.file, JSON.stringify(after.manifest));
  const out = path.join(directory, 'comparison.json');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding:'utf8' });
  assert.equal(run('observed-compare', before.file, after.file, `--output=${out}`).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(out)).observations.length, 9);
  assert.equal(run('observed-verify', out, before.file, after.file).status, 0);
  const report = fs.readFileSync(out), altered = JSON.parse(report); altered.counts.unknown++;
  fs.writeFileSync(out, JSON.stringify(altered));
  assert.equal(run('observed-verify', out, before.file, after.file).status, 2, 'altered derived results must fail replay');
  const early = JSON.parse(report); early.generatedAt = '2026-01-01T00:00:00Z';
  fs.writeFileSync(out, JSON.stringify(early));
  const earlyCheck = run('observed-verify', out, before.file, after.file);
  assert.equal(earlyCheck.status, 2, 'a report cannot predate the evidence');
  assert.match(earlyCheck.stderr, /predates/);
  fs.writeFileSync(out, report);
  assert.equal(run('observed-compare', before.file, after.file, `--output=${out}`).status, 2, 'must not overwrite a report');
  const snapshot = fs.readFileSync(path.join(after.dir,'date.json')); fs.writeFileSync(path.join(after.dir,'date.json'), 'tampered');
  const badOutput = path.join(directory,'bad.json');
  assert.equal(run('observed-compare', before.file, after.file, `--output=${badOutput}`).status, 2);
  assert.equal(run('observed-verify', out, before.file, after.file).status, 2, 'changed source bytes must fail replay');
  assert.equal(fs.existsSync(badOutput), false); fs.writeFileSync(path.join(after.dir,'date.json'),snapshot);
} finally { fs.rmSync(directory, {recursive:true,force:true}); }
console.log('PASS observed freshness compares bounded hash-checked samples and preserves missing or incompatible evidence as unknown.');
