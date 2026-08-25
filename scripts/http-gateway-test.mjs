import assert from 'node:assert/strict';
import { createArwpHttpGateway } from '../gateway/http.mjs';

await assert.rejects(
  () => createArwpHttpGateway({
    profileSource: 'examples/minimal.site-profile.json',
    allowedHosts: []
  }),
  /ARWP_HTTP_ALLOWED_HOSTS/
);

const gateway = await createArwpHttpGateway({
  profileSource: 'examples/minimal.site-profile.json',
  allowedHosts: ['mcp.example.com'],
  allowedOrigins: ['app.example.com']
});

const wrongPath = await gateway.fetch(new Request('https://mcp.example.com/not-mcp', {
  method: 'GET',
  headers: { host: 'mcp.example.com' }
}));
assert.equal(wrongPath.status, 404);

const wrongHost = await gateway.fetch(new Request('https://mcp.example.com/mcp', {
  method: 'POST',
  headers: {
    host: 'evil.example.com',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
}));
assert.equal(wrongHost.status, 403);

const wrongOrigin = await gateway.fetch(new Request('https://mcp.example.com/mcp', {
  method: 'POST',
  headers: {
    host: 'mcp.example.com',
    origin: 'https://evil.example.com',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
}));
assert.equal(wrongOrigin.status, 403);

await gateway.close();

console.log('PASS remote gateway startup, path, Host and Origin guards');
