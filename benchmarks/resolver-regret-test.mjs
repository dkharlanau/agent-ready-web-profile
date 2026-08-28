import assert from 'node:assert/strict';
import { buildSelectionDiagnostics } from './selection-diagnostics.mjs';

function intent(correct, classification = correct ? 'correct-interface' : 'wrong-interface') {
  return { correct, classification, selected: null, accepted: [] };
}

function allIntents(overrides = {}) {
  return {
    read: intent(false),
    search: intent(false),
    structured: intent(false),
    tools: intent(false),
    agent: intent(false),
    ...overrides
  };
}

const report = {
  benchmarkVersion: '0.2',
  generatedAt: '2026-08-28T00:00:00.000Z',
  results: [
    {
      id: 'regret-fixture',
      url: 'https://example.test/',
      ownership: 'independent',
      status: 'resolved',
      strategyResults: {
        'resolver-union': { intents: allIntents({
          read: intent(true),
          search: intent(false, 'false-positive'),
          structured: intent(false),
          tools: intent(false, 'false-positive'),
          agent: intent(true)
        }) },
        'ordinary-web': { intents: allIntents({ agent: intent(true) }) },
        'llms-aware': { intents: allIntents({ read: intent(true), search: intent(true), tools: intent(true), agent: intent(true) }) },
        'agents-aware': { intents: allIntents({ agent: intent(true) }) },
        'protocol-native': { intents: allIntents({ structured: intent(true), agent: intent(true) }) },
        'arwp-profile-only': { intents: allIntents({ agent: intent(true) }) }
      }
    }
  ]
};

const diagnostics = buildSelectionDiagnostics(report);
assert.equal(diagnostics.summary.resolverRegret, 3);
assert.deepEqual(diagnostics.summary.regretByIntent, { search: 1, structured: 1, tools: 1 });
assert.deepEqual(diagnostics.summary.regretBySimplerStrategy, { 'llms-aware': 2, 'protocol-native': 1 });
assert.equal(diagnostics.summary.resolverUniquelyCorrect, 0);
assert.equal(diagnostics.regretCases.length, 3);
assert.equal(diagnostics.uniquelyCorrectCases.length, 0);

console.log('PASS Resolver regret counts union misses where at least one simpler strategy was correct, without changing benchmark ground truth');
