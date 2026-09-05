import fs from 'node:fs';
import path from 'node:path';

export const INDEXNOW_MAX_URLS = 10000;

function normalizeHostUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('A canonical site URL is required.');
  const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('IndexNow site URL must use HTTP or HTTPS.');
  parsed.hash = '';
  return parsed;
}

export function validateIndexNowKey(key) {
  const value = String(key || '').trim();
  if (!/^[A-Za-z0-9-]{8,128}$/.test(value)) {
    throw new Error('IndexNow key must be 8-128 characters using letters, numbers or dashes.');
  }
  return value;
}

export function normalizeIndexNowUrls(site, urls) {
  const base = normalizeHostUrl(site);
  const host = base.hostname.toLowerCase();
  const input = (urls || []).map(value => String(value || '').trim()).filter(Boolean);
  if (!input.length) throw new Error('At least one changed URL is required.');
  if (input.length > INDEXNOW_MAX_URLS) throw new Error(`IndexNow supports at most ${INDEXNOW_MAX_URLS} URLs per POST.`);

  const normalized = input.map(value => {
    const parsed = new URL(value, base.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Unsupported URL protocol: ${parsed.href}`);
    if (parsed.hostname.toLowerCase() !== host) throw new Error(`IndexNow URL host mismatch: ${parsed.hostname} != ${host}`);
    parsed.hash = '';
    return parsed.href;
  });
  return [...new Set(normalized)];
}

export function buildIndexNowPayload(site, { key, keyLocation, urls }) {
  const base = normalizeHostUrl(site);
  const cleanKey = validateIndexNowKey(key);
  const urlList = normalizeIndexNowUrls(base.href, urls);
  const payload = {
    host: base.hostname,
    key: cleanKey,
    urlList
  };
  if (keyLocation) {
    const location = new URL(String(keyLocation), base.origin);
    if (!['http:', 'https:'].includes(location.protocol)) throw new Error('IndexNow keyLocation must use HTTP or HTTPS.');
    if (location.hostname.toLowerCase() !== base.hostname.toLowerCase()) throw new Error('IndexNow keyLocation must be hosted on the submitted host.');
    payload.keyLocation = location.href;
  }
  return payload;
}

export function readIndexNowUrls(filePath) {
  const text = fs.readFileSync(path.resolve(filePath), 'utf8').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('IndexNow JSON URL file must be an array.');
    return parsed;
  }
  return text.split(/\r?\n/).map(value => value.trim()).filter(value => value && !value.startsWith('#'));
}

export function publicIndexNowPayload(payload) {
  return {
    host: payload.host,
    keyLocation: payload.keyLocation || `https://${payload.host}/<key>.txt`,
    urlCount: payload.urlList.length,
    urlList: payload.urlList
  };
}

export async function submitIndexNow(payload, endpoint, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const target = new URL(endpoint);
  if (target.protocol !== 'https:') throw new Error('IndexNow submission endpoint must use HTTPS.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target.href, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/json, text/plain, */*;q=0.1',
        'user-agent': 'arwp-indexnow/0.1'
      },
      body: JSON.stringify(payload)
    });
    try { await response.body?.cancel?.(); } catch { /* no-op */ }
    return {
      accepted: response.status === 200 || response.status === 202,
      status: response.status,
      endpoint: target.href,
      host: payload.host,
      urlCount: payload.urlList.length,
      note: response.status === 200 || response.status === 202
        ? 'The endpoint accepted/received the submission. This does not guarantee crawling or indexing.'
        : 'The endpoint did not accept the submission. Check key ownership, host scope, request format and rate limits.'
    };
  } finally {
    clearTimeout(timer);
  }
}
