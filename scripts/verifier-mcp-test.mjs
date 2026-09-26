import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyProfileSource } from '../lib/verifier.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-verifier-mcp-'));

function writeProfile(name, profile) {
  const file = path.join(tmpdir, name);
  fs.writeFileSync(file, JSON.stringify(profile, null, 2));
  return file;
}

function baseProfile(extra = {}) {
  return {
    profileVersion: '0.1',
    id: 'fixture-site',
    name: 'Fixture Site',
    canonicalUrl: 'https://fixture.example/',
    description: 'Verifier MCP fixture profile.',
    ...extra
  };
}

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

// A spec-shaped legacy Streamable HTTP MCP server: no server/discover,
// initialize succeeds, notifications/initialized accepted.
function legacyMcpFetch(recorded, { initializeResponse } = {}) {
  return async (url, init = {}) => {
    recorded.push({ url, method: init.method || 'GET' });
    assert.equal(init.method, 'POST', 'MCP-aware verification must not probe MCP endpoints with GET/HEAD');
    const message = JSON.parse(init.body);
    if (message.method === 'server/discover') {
      return jsonResponse({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }, { status: 400 });
    }
    if (message.method === 'initialize') {
      return initializeResponse ? initializeResponse(message) : jsonResponse({
        jsonrpc: '2.0', id: message.id,
        result: {
          protocolVersion: '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: 'fixture-mcp', version: '1.0.0' }
        }
      }, { headers: { 'mcp-session-id': 'fixture-session' } });
    }
    if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
    throw new Error(`Unexpected MCP method ${message.method}`);
  };
}

function mcpResource(result) {
  const item = result.resources.find(entry => entry.key === 'mcp.servers.0.url');
  assert.ok(item, 'expected mcp.servers.0.url in verification resources');
  return item;
}

const mcpProfile = writeProfile('mcp.site-profile.json', baseProfile({
  mcp: { servers: [{ name: 'Fixture MCP', transport: 'streamable-http', url: 'https://mcp.example/mcp' }] }
}));

// 1. Valid Streamable HTTP MCP initialization is verified as MCP, not as a webpage.
{
  const recorded = [];
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: legacyMcpFetch(recorded), resolveImpl: PUBLIC_DNS, timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'pass');
  assert.equal(item.verification, 'protocol-verified');
  assert.equal(item.method, 'MCP');
  assert.equal(item.mcp.serverInfo.name, 'fixture-mcp');
  assert.equal(item.mcp.protocolVersion, '2025-11-25');
  assert.ok(recorded.every(call => call.method === 'POST'));
  assert.equal(result.valid, true);
}

// 2. A server rejecting GET/HEAD but answering MCP POST must pass (the Vedokrok false negative).
{
  const recorded = [];
  const rejectingGet = async (url, init = {}) => {
    if ((init.method || 'GET') !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    return legacyMcpFetch(recorded)(url, init);
  };
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: rejectingGet, resolveImpl: PUBLIC_DNS, timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'pass');
  assert.equal(result.valid, true);
  assert.ok(recorded.length >= 2, 'expected MCP POST exchanges');
}

// 3. Unreachable MCP endpoint fails with evidence.
{
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: async () => { throw new TypeError('fetch failed'); },
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'fail');
  assert.equal(item.verification, 'failed');
  assert.match(item.issues.join(' '), /fetch failed/);
  assert.equal(result.valid, false);
}

// 4. Malformed MCP initialize result fails with protocol-specific evidence.
{
  const recorded = [];
  const malformed = legacyMcpFetch(recorded, {
    initializeResponse: message => jsonResponse({ jsonrpc: '2.0', id: message.id, result: { unexpected: true } })
  });
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: malformed, resolveImpl: PUBLIC_DNS, timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'fail');
  assert.match(item.issues.join(' '), /did not return a valid MCP result/);
}

// 5. An HTTP 200 webpage that is not MCP must fail, not pass.
{
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: async () => new Response('<html><body>not mcp</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' }
    }),
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'fail');
  assert.equal(item.verification, 'failed');
  assert.match(item.issues.join(' '), /MCP protocol verification failed/);
}

// 6. Redirects to another origin are blocked.
{
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://other.example/mcp' } }),
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'fail');
  assert.match(item.issues.join(' '), /Cross-origin MCP runtime redirect blocked/);
}

// 7. Oversized responses are rejected by the byte bound.
{
  const recorded = [];
  const oversized = legacyMcpFetch(recorded, {
    initializeResponse: message => new Response(JSON.stringify({
      jsonrpc: '2.0', id: message.id,
      result: { protocolVersion: '2025-11-25', capabilities: {} }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': String(10 * 1024 * 1024) }
    })
  });
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: oversized, resolveImpl: PUBLIC_DNS, timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'fail');
  assert.match(item.issues.join(' '), /exceeds maxBytes/);
}

// 8. Timeouts fail with timeout evidence instead of hanging.
{
  const hanging = (url, init = {}) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: hanging, resolveImpl: PUBLIC_DNS, timeoutMs: 50
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'fail');
  assert.match(item.issues.join(' '), /timed out after 50ms/);
}

// 9. A streamable-http MCP declaration without a URL fails schema validation before any probing.
{
  let probed = false;
  const missingUrl = writeProfile('mcp-missing-url.site-profile.json', baseProfile({
    mcp: { servers: [{ name: 'URL-less MCP', transport: 'streamable-http' }] }
  }));
  const result = await verifyProfileSource(missingUrl, {
    fetchImpl: async () => { probed = true; throw new Error('must not probe'); },
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  assert.equal(result.valid, false);
  assert.ok(result.schemaErrors.length > 0);
  assert.equal(result.resources.length, 0);
  assert.equal(probed, false);
}

// 10. Generic resources and non-streamable MCP metadata keep the generic HEAD/GET probe.
{
  const recorded = [];
  const genericFetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    recorded.push({ url, method });
    if (method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { 'content-type': url.endsWith('robots.txt') ? 'text/plain' : 'text/html' }
      });
    }
    throw new Error(`Unexpected method ${method}`);
  };
  const mixed = writeProfile('mixed.site-profile.json', baseProfile({
    web: { robots: 'https://fixture.example/robots.txt' },
    mcp: {
      servers: [
        { name: 'SSE MCP', transport: 'sse', url: 'https://fixture.example/sse' },
        { name: 'Local MCP', transport: 'stdio', package: 'example-mcp' }
      ]
    }
  }));
  const result = await verifyProfileSource(mixed, {
    fetchImpl: genericFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000
  });
  assert.equal(result.valid, true);
  const keys = result.resources.map(item => item.key);
  assert.deepEqual(keys, ['web.robots', 'mcp.servers.0.url']);
  assert.ok(result.resources.every(item => item.method === 'HEAD'));
  assert.ok(recorded.every(call => call.method === 'HEAD'));
}

// 11. Reachable MCP endpoint requiring authorization is warned as not-assessed, not failed.
{
  const result = await verifyProfileSource(mcpProfile, {
    fetchImpl: async () => new Response(null, { status: 401 }),
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  const item = mcpResource(result);
  assert.equal(item.status, 'warn');
  assert.equal(item.verification, 'not-assessed');
  assert.match(item.issues.join(' '), /requires authorization/);
  assert.equal(result.valid, true, 'authorization boundaries must not fail the profile');
}

console.log('PASS verifier performs protocol-aware MCP verification: initialize success, GET-rejection tolerance, unreachable/malformed/non-MCP/redirect/oversize/timeout failures, schema guard, generic-resource compatibility and authorization not-assessed');
