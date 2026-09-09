import { lookup as dnsLookup } from 'node:dns/promises';
import { assertPublicHttpsUrl, DEFAULT_PUBLIC_FETCH_TIMEOUT_MS } from './public-fetch.mjs';

export const DEFAULT_PUBLIC_REDIRECT_TRACE_MAX_HOPS = 5;

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs, metrics) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (metrics) metrics.requests = (metrics.requests || 0) + 1;
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timer);
  }
}

function header(response, name) {
  return response.headers?.get?.(name) || null;
}

export async function tracePublicHttpsRedirects(url, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = DEFAULT_PUBLIC_FETCH_TIMEOUT_MS,
  maxRedirects = DEFAULT_PUBLIC_REDIRECT_TRACE_MAX_HOPS,
  accept = 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
  userAgent = 'goose-migration-integrity/0.1',
  metrics = null
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be a positive number.');
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 20) throw new Error('maxRedirects must be an integer between 0 and 20.');

  const requested = await assertPublicHttpsUrl(url, resolveImpl);
  let current = requested;
  const hops = [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetchWithTimeout(fetchImpl, current.href, {
      method: 'GET',
      headers: { Accept: accept, 'user-agent': userAgent }
    }, timeoutMs, metrics);
    const status = response.status;
    const redirect = status >= 300 && status < 400 && status !== 304;

    if (redirect) {
      const rawLocation = header(response, 'location');
      try { await response.body?.cancel?.(); } catch { /* no-op */ }
      if (!rawLocation) throw new Error(`Redirect without Location from ${current.href}`);
      if (redirectCount === maxRedirects) throw new Error(`Too many redirects while tracing ${url}`);
      const next = await assertPublicHttpsUrl(new URL(rawLocation, current).href, resolveImpl);
      hops.push({ url: current.href, status, location: next.href });
      current = next;
      continue;
    }

    hops.push({ url: current.href, status, location: null });
    const result = {
      requestedUrl: requested.href,
      finalUrl: current.href,
      finalStatus: status,
      finalContentType: header(response, 'content-type'),
      redirected: hops.length > 1,
      redirectCount: hops.length - 1,
      hops
    };
    try { await response.body?.cancel?.(); } catch { /* no-op */ }
    return result;
  }

  throw new Error(`Too many redirects while tracing ${url}`);
}
