import assert from 'node:assert/strict';
import { scanSite } from '../lib/scanner.mjs';

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) ?? null;
    }
  };
}

function response({ status = 200, contentType = 'text/plain', text = '', extraHeaders = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers({ 'content-type': contentType, ...extraHeaders }),
    body: {
      async cancel() {}
    },
    async text() {
      return text;
    }
  };
}

function streamedResponse(text, { contentType = 'text/html; charset=utf-8', chunkBytes = 4096, onCancel = () => {} } = {}) {
  const encoded = new TextEncoder().encode(text);
  let offset = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (offset >= encoded.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkBytes, encoded.byteLength);
      controller.enqueue(encoded.slice(offset, end));
      offset = end;
    },
    cancel() {
      onCancel();
    }
  });
  return {
    status: 200,
    ok: true,
    headers: headers({
      'content-type': contentType,
      'content-length': encoded.byteLength
    }),
    body,
    async text() {
      throw new Error('streaming response should be consumed through getReader()');
    }
  };
}

const head = `<!doctype html>
<html lang="en">
<head>
  <title>Large Docs</title>
  <meta name="description" content="Metadata appears before a very large application payload.">
  <link rel="canonical" href="https://large.example/">
</head>
<body>`;
const hugeHtml = `${head}${'x'.repeat(80 * 1024)}</body></html>`;
const hugeRobots = `User-agent: *\n${'x'.repeat(32 * 1024)}`;
let homepageCancelled = false;

const mockFetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  if (url === 'https://large.example/' && method === 'GET') {
    return streamedResponse(hugeHtml, { onCancel: () => { homepageCancelled = true; } });
  }
  if (url === 'https://large.example/robots.txt' && method === 'GET') {
    return response({
      status: 200,
      text: hugeRobots,
      extraHeaders: { 'content-length': new TextEncoder().encode(hugeRobots).byteLength }
    });
  }
  return response({ status: 404 });
};

const resolvePublic = async () => [{ address: '93.184.216.34', family: 4 }];
const maxBytes = 16 * 1024;
const scan = await scanSite('https://large.example/', {
  fetchImpl: mockFetch,
  resolveImpl: resolvePublic,
  timeoutMs: 1000,
  maxBytes
});

assert.equal(scan.canonicalUrl, 'https://large.example/');
assert.equal(scan.identity.name, 'Large Docs');
assert.equal(scan.identity.description, 'Metadata appears before a very large application payload.');
assert.equal(homepageCancelled, true, 'homepage stream should be cancelled once the bounded prefix is sufficient');
assert.ok(scan.warnings.some(warning => warning.includes(`Homepage body exceeded maxBytes (${maxBytes})`)));
assert.ok(scan.warnings.some(warning => warning.includes('robots.txt probe failed: Response exceeds maxBytes')),
  'non-homepage discovery resources must retain strict full-body limits');

console.log('PASS large HTML homepages use a bounded discovery prefix while strict resource limits remain enforced');
