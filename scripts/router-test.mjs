import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDirectory, searchFederated, selectSites } from '../router/federated.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-router-'));
try {
  const directoryPath = path.join(temp, 'sites.json');
  fs.writeFileSync(directoryPath, JSON.stringify({
    version: '0.1',
    sites: [{
      id: 'one-site',
      name: 'One Site',
      category: 'Test',
      canonicalUrl: 'https://one.example/',
      profileUrl: 'https://one.example/ai/site-profile.json',
      capabilities: { web: true, retrieval: true, trust: true }
    }, {
      id: 'no-retrieval',
      name: 'No Retrieval',
      category: 'Test',
      canonicalUrl: 'https://two.example/',
      profileUrl: 'https://two.example/ai/site-profile.json',
      capabilities: { web: true, retrieval: false }
    }]
  }, null, 2));

  const { directory } = await loadDirectory(directoryPath);
  assert.equal(directory.sites.length, 2);
  assert.deepEqual(selectSites(directory, { capability: 'retrieval' }).map(site => site.id), ['one-site']);

  const profile = {
    profileVersion: '0.1',
    id: 'one-site',
    name: 'One Site',
    canonicalUrl: 'https://one.example/',
    description: 'Test profile for federated router.',
    retrieval: {
      indexes: [{ name: 'records', url: 'https://one.example/data/search.json', mediaType: 'application/json', format: 'json' }]
    }
  };
  const index = [{ id: 'alpha', title: 'Planning fallacy', summary: 'Forecasts often ignore the outside view.', url: 'https://one.example/alpha/' }];

  function responseFor(url, body, init = {}) {
    const response = new Response(body, init);
    Object.defineProperty(response, 'url', { value: String(url), configurable: true });
    return response;
  }

  const fetchImpl = async url => {
    if (String(url).endsWith('/ai/site-profile.json')) return responseFor(url, JSON.stringify(profile), { status: 200, headers: { 'content-type': 'application/json' } });
    if (String(url).endsWith('/data/search.json')) return responseFor(url, JSON.stringify(index), { status: 200, headers: { 'content-type': 'application/json' } });
    return responseFor(url, 'not found', { status: 404 });
  };

  const result = await searchFederated('outside view', { directorySource: directoryPath, fetchImpl });
  assert.equal(result.searchedSites.length, 1, 'router must skip sites that do not declare retrieval');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].site.id, 'one-site');
  assert.equal(result.results[0].id, 'alpha');
  assert.equal(result.failures.length, 0);

  console.log('PASS federated router preserves source identity and searches only declared retrieval surfaces');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
