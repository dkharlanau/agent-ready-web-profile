import assert from 'node:assert/strict';
import { probeMcpEndpoint, reconcileMcpRuntime } from '../lib/mcp-runtime.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

let modernCalls = 0;
const modernFetch = async (url, init) => {
  modernCalls += 1;
  assert.equal(url, 'https://mcp.example/mcp');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'manual');
  const message = JSON.parse(init.body);
  assert.equal(message.method, 'server/discover');
  return jsonResponse({
    jsonrpc: '2.0', id: message.id,
    result: {
      supportedVersions: ['2026-07-28'],
      capabilities: { tools: { listChanged: true } },
      instructions: 'Fixture modern server.',
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'modern-server', version: '1.2.3' } }
    }
  });
};
const modern = await probeMcpEndpoint('https://mcp.example/mcp', { fetchImpl: modernFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000 });
assert.equal(modern.status, 'runtime-observed');
assert.equal(modern.era, 'modern');
assert.equal(modern.discoverSupported, true);
assert.equal(modern.serverInfo.name, 'modern-server');
assert.equal(modernCalls, 1);

const legacyMessages = [];
const legacyFetch = async (url, init) => {
  assert.equal(url, 'https://legacy.example/mcp');
  const message = JSON.parse(init.body);
  legacyMessages.push({ message, headers: new Headers(init.headers) });
  if (message.method === 'server/discover') return jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }, { status: 400 });
  if (message.method === 'initialize') return jsonResponse({
    jsonrpc: '2.0', id: 2,
    result: {
      protocolVersion: '2025-11-25',
      capabilities: { resources: {}, tools: {} },
      serverInfo: { name: 'legacy-server', version: '4.5.6' },
      instructions: 'Fixture legacy server.'
    }
  }, { headers: { 'mcp-session-id': 'fixture-session' } });
  if (message.method === 'notifications/initialized') {
    assert.equal(new Headers(init.headers).get('mcp-session-id'), 'fixture-session');
    assert.equal(new Headers(init.headers).get('mcp-protocol-version'), '2025-11-25');
    return new Response(null, { status: 202 });
  }
  throw new Error(`Unexpected MCP method ${message.method}`);
};
const legacy = await probeMcpEndpoint('https://legacy.example/mcp', { fetchImpl: legacyFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000 });
assert.equal(legacy.status, 'runtime-observed');
assert.equal(legacy.era, 'legacy');
assert.equal(legacy.discoverSupported, false);
assert.equal(legacy.serverInfo.name, 'legacy-server');
assert.equal(legacy.sessionIssued, true);
assert.deepEqual(legacyMessages.map(item => item.message.method), ['server/discover', 'initialize', 'notifications/initialized']);

const auth = await probeMcpEndpoint('https://auth.example/mcp', {
  resolveImpl: PUBLIC_DNS,
  fetchImpl: async () => new Response(null, { status: 401 })
});
assert.equal(auth.status, 'authorization-required');

const crossOriginRedirect = await probeMcpEndpoint('https://redirect.example/mcp', {
  resolveImpl: PUBLIC_DNS,
  fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://other.example/mcp' } })
});
assert.equal(crossOriginRedirect.status, 'runtime-failed');
assert.match(crossOriginRedirect.error, /Cross-origin MCP runtime redirect blocked/);

const resolution = {
  interfaces: {
    tools: [{
      sourceId: 'arwp-profile:0', sourceAuthority: 'project-profile', protocol: 'MCP', kind: 'mcp',
      transport: 'streamable-http', url: 'https://mcp.example/mcp', name: 'static-server-name'
    }]
  }
};
const reconciled = await reconcileMcpRuntime(resolution, {
  probeImpl: async endpoint => ({ status: 'runtime-observed', endpoint, era: 'modern', discoverSupported: true, serverInfo: { name: 'runtime-server-name', version: '1.0.0' }, capabilities: {} })
});
assert.equal(reconciled.summary.observed, 1);
assert.equal(reconciled.summary.conflicts, 1);
assert.equal(reconciled.conflicts[0].kind, 'mcp-runtime-identity-mismatch');

console.log('PASS MCP runtime probe observes modern server/discover, legacy initialize lifecycle, auth boundaries and static/runtime identity conflicts');
