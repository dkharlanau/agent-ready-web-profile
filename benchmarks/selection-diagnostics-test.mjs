import assert from 'node:assert/strict';
import { buildSelectionDiagnostics } from './selection-diagnostics.mjs';

function intent(correct, classification, selected = null, accepted = []) {
  return { correct, classification, selected, accepted };
}

const report = {
  benchmarkVersion: '0.2',
  generatedAt: '2026-08-26T00:00:00.000Z',
  results: [
    {
      id: 'mixed-site',
      url: 'https://mixed.example/',
      ownership: 'independent',
      status: 'resolved',
      strategyResults: {
        'resolver-union': {
          intents: {
            read: intent(true, 'correct-interface', { url: 'https://mixed.example/llms.txt' }, ['https://mixed.example/llms.txt']),
            search: intent(false, 'missed-interface', null, ['https://mixed.example/search.json']),
            structured: intent(false, 'wrong-interface', { url: 'https://mixed.example/wrong.json', protocol: 'OpenAPI' }, ['https://mixed.example/openapi.json']),
            tools: intent(false, 'false-positive', { url: 'https://mixed.example/mcp', protocol: 'MCP' }, []),
            agent: intent(true, 'correct-none', null, [])
          }
        }
      }
    },
    {
      id: 'failed-site',
      url: 'https://failed.example/',
      ownership: 'independent',
      status: 'failed',
      error: 'timeout'
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
assert.equal(diagnostics.issues.find(item => item.category === 'selection-gap').selected.url, 'https://mixed.example/wrong.json');
assert.deepEqual(diagnostics.issues.find(item => item.category === 'discovery-gap').accepted, ['https://mixed.example/search.json']);

assert.throws(() => buildSelectionDiagnostics({ results: [{ id: 'x', url: 'https://x.example/', ownership: 'independent', status: 'resolved', strategyResults: {} }] }, 'missing-strategy'), /missing strategy result/);

console.log('PASS benchmark selection diagnostics separate discovery, ranking, over-selection and full-site resolution failures without redefining ground truth');
