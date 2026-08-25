import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';

export const DEFAULT_PUBLIC_FETCH_TIMEOUT_MS = 8000;
export const DEFAULT_PUBLIC_FETCH_MAX_BYTES = 512 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export function mediaTypeOnly(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function isPublicIpv4(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address) {
  const normalized = String(address).toLowerCase();
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('::ffff:')) return isPublicIpv4(normalized.slice('::ffff:'.length));
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  const first = Number.parseInt(normalized.split(':', 1)[0] || '0', 16);
  if (Number.isFinite(first) && (first & 0xffc0) === 0xfe80) return false;
  if (normalized.startsWith('2001:db8:') || normalized === '2001:db8::') return false;
  return true;
}

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export async function assertPublicHttpsUrl(value, resolveImpl = dnsLookup) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`Only public HTTPS URLs are allowed: ${parsed.href}`);
  if (parsed.username || parsed.password) throw new Error('URLs containing credentials are not allowed.');
  if (parsed.port && parsed.port !== '443') throw new Error(`Non-standard HTTPS ports are not allowed: ${parsed.port}`);

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Local hostname is not allowed: ${parsed.hostname}`);
  }

  if (net.isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error(`Private or reserved address is not allowed: ${hostname}`);
    return parsed;
  }

  let resolved;
  try {
    resolved = await resolveImpl(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`Unable to resolve ${hostname}: ${error?.message ?? error}`);
  }
  const addresses = Array.isArray(resolved) ? resolved : [resolved];
  if (!addresses.length) throw new Error(`Unable to resolve ${hostname}.`);
  for (const item of addresses) {
    const address = typeof item === 'string' ? item : item?.address;
    if (!address || !isPublicAddress(address)) throw new Error(`Target resolves to a private or reserved address: ${address || hostname}`);
  }
  return parsed;
}

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

async function readTextBounded(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length') || 0);
  if (declaredLength && declaredLength > maxBytes) throw new Error(`Response exceeds maxBytes (${maxBytes}).`);

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* no-op */ }
        throw new Error(`Response exceeds maxBytes (${maxBytes}).`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { text: new TextDecoder('utf-8', { fatal: false }).decode(merged), bytes: total };
  }

  const text = await response.text();
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) throw new Error(`Response exceeds maxBytes (${maxBytes}).`);
  return { text, bytes };
}

export async function fetchPublicText(url, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = DEFAULT_PUBLIC_FETCH_TIMEOUT_MS,
  maxBytes = DEFAULT_PUBLIC_FETCH_MAX_BYTES,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  accept = 'application/json, text/plain, text/markdown, application/xml;q=0.9, text/html;q=0.8, */*;q=0.1',
  userAgent = 'arwp-resolver/0.1',
  metrics = null
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be a positive number.');
  if (!Number.isFinite(maxBytes) || maxBytes < 1024) throw new Error('maxBytes must be at least 1024.');

  let current = await assertPublicHttpsUrl(url, resolveImpl);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetchWithTimeout(fetchImpl, current.href, {
      method: 'GET',
      headers: { Accept: accept, 'user-agent': userAgent }
    }, timeoutMs, metrics);

    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers?.get?.('location');
      try { await response.body?.cancel?.(); } catch { /* no-op */ }
      if (!location) throw new Error(`Redirect without Location from ${current.href}`);
      if (redirectCount === maxRedirects) throw new Error(`Too many redirects while fetching ${url}`);
      current = await assertPublicHttpsUrl(new URL(location, current).href, resolveImpl);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      try { await response.body?.cancel?.(); } catch { /* no-op */ }
      return {
        ok: false,
        status: response.status,
        url: current.href,
        contentType: response.headers?.get?.('content-type') || null,
        text: null,
        bytes: 0
      };
    }

    const body = await readTextBounded(response, maxBytes);
    if (metrics) metrics.bytes = (metrics.bytes || 0) + body.bytes;
    return {
      ok: true,
      status: response.status,
      url: current.href,
      contentType: response.headers?.get?.('content-type') || null,
      text: body.text,
      bytes: body.bytes
    };
  }
  throw new Error(`Too many redirects while fetching ${url}`);
}

export async function fetchPublicJson(url, options = {}) {
  const result = await fetchPublicText(url, {
    ...options,
    accept: options.accept || 'application/json, application/linkset+json, application/mcp-server-card+json, */*;q=0.1'
  });
  if (!result.ok) return { ...result, json: null };
  try {
    return { ...result, json: JSON.parse(result.text) };
  } catch (error) {
    return { ...result, ok: false, parseError: `Invalid JSON: ${error.message}`, json: null };
  }
}
