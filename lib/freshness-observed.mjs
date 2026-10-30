import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parseLeafSitemap } from './freshness-integrity.mjs';

const MiB = 1024 * 1024;
const MAX_CAPTURES = 256, MAX_BODY_BYTES = 2 * MiB, MAX_TOTAL_BODY_BYTES = 128 * MiB, MAX_CAPTURE_LAG_MS = 24 * 60 * 60 * 1000;
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const validStamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return false;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`), time = Date.parse(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10) && Number.isFinite(time) && time <= Date.now();
};
const validDigest = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
function exactHttps(value) {
  try {
    const url = new URL(value);
    return typeof value === 'string' && url.protocol === 'https:' && !url.username && !url.password && !url.hash && url.href === value ? url : null;
  } catch { return null; }
}
function exactKeys(value, required, allowed = required) {
  return value && typeof value === 'object' && !Array.isArray(value) && required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => allowed.includes(k));
}
function privateFile(base, relative, maxBytes) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('Capture file must be a safe relative path.');
  const root = fs.realpathSync(base), file = path.join(root, relative);
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Capture file must not be a symbolic link.');
  const physical = fs.realpathSync(file), rel = path.relative(root, physical);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('Capture file escapes its manifest directory.');
  const stat = fs.statSync(physical);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('Capture file is not a bounded regular file.');
  const bytes = fs.readFileSync(physical);
  if (bytes.length > maxBytes) throw new Error('Capture file exceeds its bound.');
  return bytes;
}
function loadCapture(manifestFile) {
  const physical = fs.realpathSync(manifestFile), stat = fs.statSync(physical);
  if (!stat.isFile() || stat.size > MiB) throw new Error('Capture manifest must be a bounded regular JSON file.');
  const raw = fs.readFileSync(physical);
  if (raw.length > MiB) throw new Error('Capture manifest exceeds its bound.');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  if (!exactKeys(manifest, ['schema', 'sitemap', 'captures']) || manifest.schema !== 'freshness-observed-capture/v1' || !Array.isArray(manifest.captures) || manifest.captures.length > MAX_CAPTURES) throw new Error('Invalid observed freshness capture manifest.');
  const map = manifest.sitemap;
  if (!exactKeys(map, ['source', 'finalUrl', 'observedAt', 'status', 'contentType', 'complete', 'file', 'sha256']) ||
      !exactHttps(map.source) || map.finalUrl !== map.source || map.status !== 200 || map.complete !== true ||
      (map.contentType !== null && (typeof map.contentType !== 'string' || !map.contentType.trim() || map.contentType.length > 200)) ||
      !validStamp(map.observedAt) || !validDigest(map.sha256)) throw new Error('Invalid sitemap observation.');
  const base = path.dirname(physical), xmlBytes = privateFile(base, map.file, 50 * MiB);
  if (sha(xmlBytes) !== map.sha256) throw new Error('Sitemap capture digest mismatch.');
  const sitemap = parseLeafSitemap(new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes));
  const urls = new Set(sitemap.map(x => x.url)), origin = new URL(map.source).origin, captures = new Map();
  if (sitemap.some(item => new URL(item.url).origin !== origin)) throw new Error('Cross-origin sitemap entries require separate review.');
  let totalBytes = 0;
  for (const record of manifest.captures) {
    const fields = ['requestedUrl', 'finalUrl', 'observedAt', 'status', 'contentType', 'contentEncoding', 'bodyScope', 'requestProfile', 'complete', 'bodyFile', 'sha256'];
    if (!exactKeys(record, fields) || !exactHttps(record.requestedUrl) || new URL(record.requestedUrl).origin !== origin || !urls.has(record.requestedUrl) || captures.has(record.requestedUrl) ||
        (record.finalUrl !== null && !exactHttps(record.finalUrl)) || !validStamp(record.observedAt) || !Number.isInteger(record.status) || record.status < 100 || record.status > 599 ||
        (record.contentType !== null && (typeof record.contentType !== 'string' || !record.contentType.trim() || record.contentType.length > 200)) ||
        (record.contentEncoding !== null && (typeof record.contentEncoding !== 'string' || record.contentEncoding.trim() !== record.contentEncoding || !/^[a-z0-9][a-z0-9, -]{0,99}$/.test(record.contentEncoding))) ||
        ![null, 'http-payload', 'content-decoded'].includes(record.bodyScope) ||
        typeof record.requestProfile !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(record.requestProfile) || typeof record.complete !== 'boolean') throw new Error('Invalid or duplicate resource observation.');
    let bodyDigest = null;
    if (record.complete) {
      if (!validDigest(record.sha256)) throw new Error('Complete resource observation requires a body digest.');
      const bytes = privateFile(base, record.bodyFile, MAX_BODY_BYTES); totalBytes += bytes.length;
      if (totalBytes > MAX_TOTAL_BODY_BYTES) throw new Error('Captured resource bodies exceed the total bound.');
      if (sha(bytes) !== record.sha256) throw new Error('Resource capture digest mismatch.');
      bodyDigest = record.sha256;
    } else if (record.bodyFile !== null || record.sha256 !== null) throw new Error('Incomplete captures cannot claim a body digest.');
    captures.set(record.requestedUrl, { requestedUrl: record.requestedUrl, finalUrl: record.finalUrl, observedAt: record.observedAt,
      status: record.status, contentType: record.contentType, contentEncoding: record.contentEncoding, bodyScope: record.bodyScope,
      requestProfile: record.requestProfile, complete: record.complete, sha256: bodyDigest });
  }
  return { source: { manifestSha256: sha(raw), sitemapSource: map.source, sitemapFinalUrl: map.finalUrl,
    sitemapStatus: map.status, sitemapContentType: map.contentType, sitemapSha256: map.sha256, sitemapObservedAt: map.observedAt }, sitemap, captures };
}

/** Read and compare two owner-supplied capture manifests. No network or site mutation. */
export function compareObservedFreshness(beforeManifest, afterManifest) {
  const before = loadCapture(beforeManifest), after = loadCapture(afterManifest);
  if (before.source.sitemapSource !== after.source.sitemapSource) throw new Error('Observed snapshots must use the same sitemap URL.');
  if (Date.parse(before.source.sitemapObservedAt) >= Date.parse(after.source.sitemapObservedAt)) throw new Error('Sitemap observations must be in chronological order.');
  const a = new Map(before.sitemap.map(x => [x.url, x])), b = new Map(after.sitemap.map(x => [x.url, x]));
  const observations = [];
  for (const url of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const left = a.get(url), right = b.get(url), oldCapture = before.captures.get(url) ?? null, newCapture = after.captures.get(url) ?? null;
    let state = 'unknown', reason = '';
    if (!left) { state = 'added'; reason = 'URL appears only in the later sitemap capture.'; }
    else if (!right) { state = 'removed'; reason = 'URL appears only in the earlier sitemap capture.'; }
    else {
      const missing = [];
      if (left.lastmodState !== 'valid' || right.lastmodState !== 'valid') missing.push('lastmod missing or invalid');
      if (!oldCapture) missing.push('earlier response not captured');
      if (!newCapture) missing.push('later response not captured');
      if (oldCapture && newCapture) {
        if (oldCapture.status !== 200 || newCapture.status !== 200 || !oldCapture.complete || !newCapture.complete) missing.push('response incomplete or non-200');
        if (oldCapture.finalUrl !== url || newCapture.finalUrl !== url) missing.push('redirect or final URL unavailable');
        if (!oldCapture.contentType || oldCapture.contentType !== newCapture.contentType) missing.push('content type missing or different');
        if (!oldCapture.contentEncoding || oldCapture.contentEncoding !== newCapture.contentEncoding) missing.push('content encoding missing or different');
        if (!oldCapture.bodyScope || oldCapture.bodyScope !== newCapture.bodyScope) missing.push('body scope missing or different');
        if (oldCapture.requestProfile !== newCapture.requestProfile) missing.push('request profile differs');
        if (Date.parse(oldCapture.observedAt) < Date.parse(before.source.sitemapObservedAt) ||
            Date.parse(oldCapture.observedAt) - Date.parse(before.source.sitemapObservedAt) > MAX_CAPTURE_LAG_MS ||
            Date.parse(oldCapture.observedAt) >= Date.parse(after.source.sitemapObservedAt) ||
            Date.parse(newCapture.observedAt) < Date.parse(after.source.sitemapObservedAt) ||
            Date.parse(newCapture.observedAt) - Date.parse(after.source.sitemapObservedAt) > MAX_CAPTURE_LAG_MS) missing.push('response timing outside the capture window');
      }
      if (missing.length) reason = missing.join('; ');
      else {
        const dateChanged = Date.parse(left.lastmod) !== Date.parse(right.lastmod), bodyChanged = oldCapture.sha256 !== newCapture.sha256;
        state = dateChanged ? (bodyChanged ? 'both_changed' : 'date_changed_equal_bodies') : (bodyChanged ? 'body_changed_equal_date' : 'equal_at_samples');
        reason = 'Two endpoint samples only; review significance and intermediate changes separately.';
      }
    }
    observations.push({ url, state, beforeLastmod: left?.lastmod ?? null, afterLastmod: right?.lastmod ?? null,
      beforeCapture: oldCapture, afterCapture: newCapture, reason });
  }
  const counts = {};
  for (const item of observations) counts[item.state] = (counts[item.state] ?? 0) + 1;
  return { schema: 'freshness-observed-comparison/v1', generatedAt: new Date().toISOString(), source: { before: before.source, after: after.source }, observations, counts,
    limitations: ['Capture metadata and request profiles are operator-supplied, not authenticated HTTP receipts.',
      'Equal bodies at two times do not prove there were no changes between observations.',
      'Different bodies do not prove a significant change; content type, encoding, body scope and request profile must match.',
      'The 24-hour capture-window limit is an operational bound, not proof that a body and sitemap describe the same version.',
      'This does not establish source ownership, a rendered page, Google crawling, indexing, ranking or Search outcomes.'] };
}

/** Recompute a saved report from its original local manifests and captured bytes. */
export function verifyObservedFreshnessComparison(report, beforeManifest, afterManifest) {
  if (!report || typeof report !== 'object' || !validStamp(report.generatedAt)) throw new Error('Invalid observed comparison timestamp.');
  const expected = compareObservedFreshness(beforeManifest, afterManifest);
  const dates = [expected.source.before.sitemapObservedAt, expected.source.after.sitemapObservedAt,
    ...expected.observations.flatMap(item => [item.beforeCapture?.observedAt, item.afterCapture?.observedAt].filter(Boolean))];
  if (dates.some(value => Date.parse(value) > Date.parse(report.generatedAt))) throw new Error('Observed comparison predates its capture evidence.');
  if (!isDeepStrictEqual({ ...report, generatedAt: expected.generatedAt }, expected)) throw new Error('Observed comparison differs from replayed capture evidence.');
  return { valid: true, observations: expected.observations.length };
}
