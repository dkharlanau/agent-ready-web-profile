import { lookup as dnsLookup } from 'node:dns/promises';
import { assertPublicHttpsUrl } from './public-fetch.mjs';

const MODERN_VERSION = '2026-07-28';
const LEGACY_VERSION = '2025-11-25';
const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 256 * 1024;

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

function mergeSignals(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
  const controller = new AbortController();
  const abort = signal => { if (!controller.signal.aborted) controller.abort(signal.reason); };
  if (a.aborted) abort(a); else a.addEventListener('abort', () => abort(a), { once: true });
  if (b.aborted) abort(b); else b.addEventListener('abort', () => abort(b), { once: true });
  return controller.signal;
}

async function readJsonRpcResponse(response, expectedId, { maxBytes, signal, metrics }) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) throw new Error(`MCP response exceeds maxBytes (${maxBytes}).`);

  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).byteLength;
    if (metrics) metrics.bytes = (metrics.bytes || 0) + bytes;
    if (bytes > maxBytes) throw new Error(`MCP response exceeds maxBytes (${maxBytes}).`);
    return JSON.parse(text || '{}');
  }

  const decoder = new TextDecoder();
  let total = 0;
  let buffer = '';
  while (true) {
    if (signal?.aborted) throw signal.reason || new Error('MCP response aborted.');
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (metrics) metrics.bytes = (metrics.bytes || 0) + value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* no-op */ }
      throw new Error(`MCP response exceeds maxBytes (${maxBytes}).`);
    }
    buffer += decoder.decode(value, { stream: true });

    if (contentType.includes('text/event-stream')) {
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const event of events) {
        const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        let payload;
        try { payload = JSON.parse(data); } catch { continue; }
        if (payload?.id === expectedId) {
          try { await reader.cancel(); } catch { /* no-op */ }
          return payload;
        }
      }
    }
  }
  buffer += decoder.decode();
  if (contentType.includes('text/event-stream')) {
    for (const event of buffer.split(/\r?\n\r?\n/)) {
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) continue;
      const payload = JSON.parse(data);
      if (payload?.id === expectedId) return payload;
    }
    throw new Error(`MCP SSE response ended without JSON-RPC id ${expectedId}.`);
  }
  return JSON.parse(buffer || '{}');
}

async function postMessage(endpoint, message, {
  fetchImpl,
  resolveImpl,
  timeoutMs,
  maxBytes,
  expectedOrigin,
  sessionId = null,
  protocolVersion = null,
  metrics
}) {
  const body = JSON.stringify(message);
  let current = await assertPublicHttpsUrl(endpoint, resolveImpl);
  if (current.origin !== expectedOrigin) throw new Error(`MCP runtime endpoint origin changed unexpectedly: ${current.origin}`);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(new Error(`MCP runtime request timed out after ${timeoutMs}ms.`)), timeoutMs);
    const headers = new Headers({
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'user-agent': 'arwp-resolver/0.2'
    });
    if (sessionId) headers.set('mcp-session-id', sessionId);
    if (protocolVersion) headers.set('mcp-protocol-version', protocolVersion);
    if (metrics) metrics.requests = (metrics.requests || 0) + 1;
    let response;
    try {
      response = await fetchImpl(current.href, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: mergeSignals(undefined, timeoutController.signal)
      });

      if (response.status >= 300 && response.status < 400 && response.status !== 304) {
        const location = response.headers.get('location');
        try { await response.body?.cancel?.(); } catch { /* no-op */ }
        if (!location) throw new Error(`MCP redirect without Location from ${current.href}`);
        if (redirects === MAX_REDIRECTS) throw new Error('Too many MCP runtime redirects.');
        const next = await assertPublicHttpsUrl(new URL(location, current).href, resolveImpl);
        if (next.origin !== expectedOrigin) throw new Error(`Cross-origin MCP runtime redirect blocked: ${next.origin}`);
        current = next;
        continue;
      }

      const status = response.status;
      const responseSessionId = response.headers.get('mcp-session-id');
      if (message.id === undefined) {
        try { await response.body?.cancel?.(); } catch { /* no-op */ }
        return { status, url: current.href, sessionId: responseSessionId, payload: null };
      }
      let payload = null;
      if (response.body && status !== 204 && status !== 202) payload = await readJsonRpcResponse(response, message.id, { maxBytes, signal: timeoutController.signal, metrics });
      return { status, url: current.href, sessionId: responseSessionId, payload };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many MCP runtime redirects.');
}

function serverInfoFromDiscover(discover) {
  return discover?._meta?.['io.modelcontextprotocol/serverInfo'] || null;
}

function classifyHttp(status) {
  if (status === 401 || status === 403) return 'authorization-required';
  if (status >= 500) return 'server-error';
  return 'runtime-failed';
}

export async function probeMcpEndpoint(endpoint, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = 8000,
  maxBytes = DEFAULT_MAX_BYTES
} = {}) {
  const validated = await assertPublicHttpsUrl(endpoint, resolveImpl);
  const expectedOrigin = validated.origin;
  const metrics = { requests: 0, bytes: 0 };

  const discoverRequest = { jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} };
  try {
    const discoverResponse = await postMessage(validated.href, discoverRequest, { fetchImpl, resolveImpl, timeoutMs, maxBytes, expectedOrigin, metrics });
    if (discoverResponse.status === 401 || discoverResponse.status === 403) return {
      status: 'authorization-required', endpoint: validated.href, era: null, discoverSupported: null, metrics, httpStatus: discoverResponse.status
    };
    const discover = discoverResponse.payload?.result;
    if (discover && Array.isArray(discover.supportedVersions) && discover.capabilities) {
      return {
        status: 'runtime-observed',
        endpoint: discoverResponse.url,
        era: 'modern',
        discoverSupported: true,
        supportedVersions: discover.supportedVersions,
        capabilities: discover.capabilities,
        instructions: discover.instructions || null,
        serverInfo: serverInfoFromDiscover(discover),
        metrics
      };
    }

    const methodNotFound = discoverResponse.payload?.error?.code === -32601;
    const legacyCandidate = methodNotFound || [400, 404, 405].includes(discoverResponse.status);
    if (!legacyCandidate) return {
      status: classifyHttp(discoverResponse.status), endpoint: discoverResponse.url, era: null, discoverSupported: false,
      metrics, httpStatus: discoverResponse.status, error: discoverResponse.payload?.error || null
    };
  } catch (error) {
    return { status: 'runtime-failed', endpoint: validated.href, era: null, discoverSupported: null, metrics, error: String(error?.message || error) };
  }

  const initializeRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'initialize',
    params: {
      protocolVersion: LEGACY_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'arwp-resolver-runtime-probe',
        version: '0.2.0',
        description: 'Read-only interoperability probe. It does not invoke MCP tools or send discovered credentials.'
      }
    }
  };

  try {
    const initialized = await postMessage(validated.href, initializeRequest, { fetchImpl, resolveImpl, timeoutMs, maxBytes, expectedOrigin, metrics });
    if (initialized.status === 401 || initialized.status === 403) return {
      status: 'authorization-required', endpoint: initialized.url, era: 'legacy', discoverSupported: false, metrics, httpStatus: initialized.status
    };
    if (!initialized.payload?.result?.protocolVersion || !initialized.payload?.result?.capabilities) return {
      status: classifyHttp(initialized.status), endpoint: initialized.url, era: 'legacy', discoverSupported: false,
      metrics, httpStatus: initialized.status, error: initialized.payload?.error || 'initialize did not return a valid MCP result'
    };

    const negotiatedVersion = initialized.payload.result.protocolVersion;
    const sessionId = initialized.sessionId || null;
    const notification = await postMessage(initialized.url, {
      jsonrpc: '2.0', method: 'notifications/initialized', params: {}
    }, {
      fetchImpl, resolveImpl, timeoutMs, maxBytes, expectedOrigin,
      sessionId, protocolVersion: negotiatedVersion, metrics
    });
    if (notification.status < 200 || notification.status >= 300) return {
      status: 'runtime-failed', endpoint: initialized.url, era: 'legacy', discoverSupported: false, metrics,
      httpStatus: notification.status, error: 'Server rejected notifications/initialized.'
    };

    return {
      status: 'runtime-observed',
      endpoint: initialized.url,
      era: 'legacy',
      discoverSupported: false,
      protocolVersion: negotiatedVersion,
      capabilities: initialized.payload.result.capabilities,
      instructions: initialized.payload.result.instructions || null,
      serverInfo: initialized.payload.result.serverInfo || null,
      sessionIssued: Boolean(sessionId),
      metrics
    };
  } catch (error) {
    return { status: 'runtime-failed', endpoint: validated.href, era: 'legacy', discoverSupported: false, metrics, error: String(error?.message || error) };
  }
}

export async function reconcileMcpRuntime(resolution, {
  probeImpl = probeMcpEndpoint,
  maxEndpoints = 4,
  probeOptions = {}
} = {}) {
  const byEndpoint = new Map();
  for (const item of resolution?.interfaces?.tools || []) {
    if (item.protocol !== 'MCP' || item.transport !== 'streamable-http' || !item.url) continue;
    const key = normalizeUrl(item.url);
    if (!byEndpoint.has(key)) byEndpoint.set(key, []);
    byEndpoint.get(key).push(item);
  }

  const checks = [];
  const conflicts = [];
  for (const [endpoint, staticItems] of [...byEndpoint.entries()].slice(0, maxEndpoints)) {
    const runtime = await probeImpl(endpoint, probeOptions);
    const staticNames = [...new Set(staticItems.map(item => item.name).filter(Boolean))];
    const runtimeName = runtime.serverInfo?.name || null;
    if (runtime.status === 'runtime-observed' && runtimeName && staticNames.length === 1 && staticNames[0] !== runtimeName) {
      conflicts.push({
        kind: 'mcp-runtime-identity-mismatch',
        severity: 'warning',
        capability: 'MCP',
        endpoint,
        staticName: staticNames[0],
        runtimeName,
        message: `MCP runtime server name ${runtimeName} differs from static metadata name ${staticNames[0]}.`
      });
    }
    checks.push({
      endpoint,
      staticEvidence: staticItems.map(item => ({ sourceId: item.sourceId || null, sourceAuthority: item.sourceAuthority || null, name: item.name || null })),
      runtime
    });
  }

  return {
    runtimeCheckVersion: '0.1',
    policy: 'Runtime probing performs server/discover for modern MCP or the legacy initialize + notifications/initialized lifecycle. It never invokes tools and never sends credentials discovered from site metadata.',
    checks,
    conflicts,
    summary: {
      endpoints: checks.length,
      observed: checks.filter(item => item.runtime.status === 'runtime-observed').length,
      authorizationRequired: checks.filter(item => item.runtime.status === 'authorization-required').length,
      failed: checks.filter(item => item.runtime.status === 'runtime-failed' || item.runtime.status === 'server-error').length,
      conflicts: conflicts.length
    }
  };
}

export { MODERN_VERSION, LEGACY_VERSION };
