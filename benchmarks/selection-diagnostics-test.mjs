import assert from 'node:assert/strict';
import { buildSelectionDiagnostics } from './selection-diagnostics.mjs';

function intent(correct, classification, selected = null, accepted = []) {
  return { correct, classification, selected, accepted };
}

const sensitiveUrl = 'https://storage.example/object?X-Amz-Credential=temp&AUTH=keep-secret&plain=ok#fragment';
const report = {
  benchmarkVersion: '0.2',
  generatedAt: '2026-08-26T00:00:00.000Z',
  results: [
    {
      id: 'mixed-site',
      url: 'https://user:password@mixed.example/?token=secret&plain=ok',
      ownership: 'independent',
      status: 'resolved',
      strategyResults: {
        'resolver-union': {
          intents: {
            read: intent(true, 'correct-interface', { url: 'https://mixed.example/llms.txt' }, ['https://mixed.example/llms.txt']),
            search: intent(false, 'missed-interface', null, ['https://mixed.example/search.json?api_key=secret&plain=ok']),
            structured: intent(false, 'wrong-interface', { url: sensitiveUrl, protocol: 'OpenAPI' }, [{ url: 'https://mixed.example/openapi.json?signature=secret&plain=ok', protocol: 'OpenAPI' }]),
            tools: intent(false, 'false-positive', { url: 'https://mixed.example/mcp', protocol: 'MCP' }, []),
            agent: intent(true, 'correct-none', null, [])
          }
        }
      }
    },
    {
      id: 'failed-site',
      url: 'https://failed.example/?session=secret',
      ownership: 'independent',
      status: 'failed',
      error: 'request failed with Authorization: top-secret'
    },
    {
      id: 'owned-reference',
      url: 'https://owned.example/',
      ownership: 'project-reference',
      status: 'failed',
      error: 'ignored'
    }
  ]
};

const diagnostics = buildSelectionDiagnostics(report);
assert.equal(diagnostics.strategy, 'resolver-union');
assert.equal(diagnostics.summary.independentSites, 2);
assert.equal(diagnostics.summary.resolvedSites, 1);
assert.equal(diagnostics.summary.failedSites, 1);
assert.equal(diagnostics.summary.total, 10);
assert.equal(diagnostics.summary.correct, 2);
assert.equal(diagnostics.summary.incorrect, 8);
assert.deepEqual(diagnostics.summary.byCategory, {
  'discovery-gap': 1,
  'over-selection': 1,
  'resolution-failure': 5,
  'selection-gap': 1
});
assert.deepEqual(diagnostics.summary.byIntent, {
  agent: 1,
  read: 1,
  search: 2,
  structured: 2,
  tools: 2
});
assert.equal(diagnostics.weakSites[0].id, 'failed-site');
assert.equal(diagnostics.weakSites[0].misses, 5);
assert.equal(diagnostics.weakSites[1].id, 'mixed-site');
assert.equal(diagnostics.weakSites[1].misses, 3);

const selectionGap = diagnostics.issues.find(item => item.category === 'selection-gap');
assert.match(selectionGap.selected.url, /X-Amz-Credential=%5BREDACTED%5D/);
assert.match(selectionGap.selected.url, /AUTH=%5BREDACTED%5D/);
assert.match(selectionGap.selected.url, /plain=ok/);
assert.doesNotMatch(selectionGap.selected.url, /temp|keep-secret|#fragment/);
assert.match(selectionGap.accepted[0].url, /signature=%5BREDACTED%5D/);
assert.doesNotMatch(selectionGap.accepted[0].url, /secret/);

const discoveryGap = diagnostics.issues.find(item => item.category === 'discovery-gap');
assert.match(discoveryGap.accepted[0], /api_key=%5BREDACTED%5D/);
assert.doesNotMatch(discoveryGap.accepted[0], /secret/);
assert.equal(diagnostics.weakSites.find(item => item.id === 'mixed-site').url.includes('password'), false);
assert.equal(diagnostics.weakSites.find(item => item.id === 'mixed-site').url.includes('secret'), false);
assert.equal(Object.hasOwn(diagnostics.issues.find(item => item.siteId === 'failed-site'), 'error'), false);

const serialized = JSON.stringify(diagnostics);
for (const forbidden of ['top-secret', 'keep-secret', 'password@', 'api_key=secret', 'signature=secret']) {
  assert.equal(serialized.includes(forbidden), false, `diagnostic output leaked ${forbidden}`);
}

assert.throws(() => buildSelectionDiagnostics({ results: [{ id: 'x', url: 'https://x.example/', ownership: 'independent', status: 'resolved', strategyResults: {} }] }, 'missing-strategy'), /missing strategy result/);

console.log('PASS benchmark selection diagnostics separate mismatch classes and sanitize URLs/free-form failure details without redefining ground truth');
