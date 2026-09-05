import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { fetchPublicText } from './public-fetch.mjs';

const DEFAULT_CAPTURE_MAX_BYTES = 512 * 1024;
const DEFAULT_CAPTURE_MAX_SOURCES = 8;
const SKIP_SOURCE_TYPES = new Set(['http-head']);

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function sourceGroups(resolution) {
  const groups = new Map();
  for (const source of Array.isArray(resolution?.sources) ? resolution.sources : []) {
    if (source?.status !== 'resolved') continue;
    if (SKIP_SOURCE_TYPES.has(String(source.type || ''))) continue;
    const url = normalizeUrl(source.url);
    if (!url || !/^https:\/\//i.test(url)) continue;
    if (!groups.has(url)) groups.set(url, { url, sourceIds: [], sourceTypes: [] });
    const group = groups.get(url);
    if (source.id && !group.sourceIds.includes(source.id)) group.sourceIds.push(source.id);
    if (source.type && !group.sourceTypes.includes(source.type)) group.sourceTypes.push(source.type);
  }
  return [...groups.values()].sort((a, b) => a.url.localeCompare(b.url));
}

export async function captureSourceBodyDigests(resolution, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = 8000,
  maxBytes = DEFAULT_CAPTURE_MAX_BYTES,
  maxSources = DEFAULT_CAPTURE_MAX_SOURCES
} = {}) {
  if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) throw new Error('A Resolver resolution object is required.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be a positive number.');
  if (!Number.isInteger(maxBytes) || maxBytes < 1024) throw new Error('maxBytes must be an integer of at least 1024.');
  if (!Number.isInteger(maxSources) || maxSources < 1 || maxSources > 20) throw new Error('maxSources must be an integer between 1 and 20.');

  const candidates = sourceGroups(resolution);
  const selected = candidates.slice(0, maxSources);
  const omittedByLimit = candidates.slice(maxSources).map(item => ({
    url: item.url,
    sourceIds: item.sourceIds,
    sourceTypes: item.sourceTypes,
    reason: 'max-sources-limit'
  }));

  const digests = [];
  const failures = [];
  for (const item of selected) {
    try {
      const fetched = await fetchPublicText(item.url, {
        fetchImpl,
        resolveImpl,
        timeoutMs,
        maxBytes,
        accept: 'application/json, application/ld+json, application/linkset+json, text/plain, text/markdown, text/html;q=0.9, */*;q=0.1'
      });
      if (!fetched.ok) {
        failures.push({
          requestedUrl: item.url,
          finalUrl: fetched.url || item.url,
          sourceIds: item.sourceIds,
          sourceTypes: item.sourceTypes,
          status: 'not-captured',
          httpStatus: fetched.status,
          reason: 'http-non-success'
        });
        continue;
      }
      const text = String(fetched.text ?? '');
      digests.push({
        sourceIds: item.sourceIds,
        sourceTypes: item.sourceTypes,
        requestedUrl: item.url,
        finalUrl: fetched.url,
        contentType: fetched.contentType || null,
        networkBytes: Number(fetched.bytes || 0),
        hashedUtf8Bytes: Buffer.byteLength(text, 'utf8'),
        algorithm: 'sha256',
        digest: sha256Text(text),
        digestScope: 'decoded-utf8-complete-bounded-response-body',
        completeWithinBound: true
      });
    } catch (error) {
      failures.push({
        requestedUrl: item.url,
        sourceIds: item.sourceIds,
        sourceTypes: item.sourceTypes,
        status: 'not-captured',
        reason: 'fetch-error',
        issue: String(error?.message || error)
      });
    }
  }

  return {
    captureVersion: '0.1',
    digestScope: 'decoded-utf8-complete-bounded-response-body',
    maxBytesPerSource: maxBytes,
    maxSources,
    candidates: candidates.length,
    attempted: selected.length,
    captured: digests.length,
    failed: failures.length,
    omittedByLimit,
    digests,
    failures,
    boundaries: {
      ordinaryResolverNetworkUnchanged: true,
      headOnlySourcesSkipped: true,
      rawWireBytesClaimed: false,
      truncatedBodyDigestsPublished: false,
      note: 'Digests cover the complete decoded UTF-8 text returned by the bounded explicit refetch. They are not hashes of HTTP transfer framing or guaranteed raw origin bytes.'
    }
  };
}

export const EVIDENCE_CAPTURE_DEFAULTS = {
  maxBytes: DEFAULT_CAPTURE_MAX_BYTES,
  maxSources: DEFAULT_CAPTURE_MAX_SOURCES
};
