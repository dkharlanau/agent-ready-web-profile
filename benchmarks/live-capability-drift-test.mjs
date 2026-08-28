import assert from 'node:assert/strict';
import { buildSelectionDiagnostics } from './selection-diagnostics.mjs';

function intent(correct, classification, selected = null, accepted = []) {
  return { correct, classification, selected, accepted };
}

const falseIntent = intent(false, 'missed-interface');
const correctNone = intent(true, 'correct-none');

const report = {
  benchmarkVersion: '0.2',
  generatedAt: '2026-08-28T00:00:00.000Z',
  results: [
    {
      id: 'publisher-drift',
      url: 'https://docs.example.test/',
      ownership: 'independent',
      status: 'resolved',
      strategyResults: {
        'resolver-union': {
          intents: {
            read: falseIntent,
            search: falseIntent,
            structured: correctNone,
            tools: correctNone,
            agent: intent(false, 'false-positive', {
              url: 'https://docs.example.test/a2a',
              protocol: 'A2A',
              kind: 'agent-endpoint',
              sourceId: 'a2a-agent-card:0',
              sourceAuthority: 'upstream-standard'
            }, [])
          }
        },
        'ordinary-web': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'llms-aware': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'agents-aware': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'protocol-native': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'arwp-profile-only': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } }
      }
    },
    {
      id: 'cross-origin-noise',
      url: 'https://docs.other.test/',
      ownership: 'independent',
      status: 'resolved',
      strategyResults: {
        'resolver-union': {
          intents: {
            read: falseIntent,
            search: falseIntent,
            structured: intent(false, 'false-positive', {
              url: 'https://api.vendor.test/openapi.json',
              protocol: 'RFC9727',
              kind: 'api-endpoint',
              sourceId: 'api-catalog-link:0',
              sourceAuthority: 'ietf-standard'
            }, []),
            tools: correctNone,
            agent: correctNone
          }
        },
        'ordinary-web': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'llms-aware': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'agents-aware': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'protocol-native': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } },
        'arwp-profile-only': { intents: { read: falseIntent, search: falseIntent, structured: correctNone, tools: correctNone, agent: correctNone } }
      }
    }
  ]
};

const diagnostics = buildSelectionDiagnostics(report);

// Frozen truth is unchanged: all six deliberate mismatches remain errors until human re-review.
assert.equal(diagnostics.summary.correct, 4);
assert.equal(diagnostics.summary.incorrect, 6);
assert.equal(diagnostics.summary.byCategory['discovery-gap'], 4);
assert.equal(diagnostics.summary.byCategory['over-selection'], 2);
assert.equal(diagnostics.summary.resolverRegret, 2);

// Only same-origin standard-native publisher evidence is queued for truth re-review.
assert.equal(diagnostics.summary.groundTruthReviewCandidates, 1);
assert.deepEqual(diagnostics.summary.groundTruthReviewByProtocol, { A2A: 1 });
assert.deepEqual(diagnostics.summary.groundTruthReviewByIntent, { agent: 1 });
assert.deepEqual(diagnostics.groundTruthReviewCandidates, [{
  siteId: 'publisher-drift',
  intent: 'agent',
  protocol: 'A2A',
  kind: 'agent-endpoint',
  sourceId: 'a2a-agent-card:0',
  sourceAuthority: 'upstream-standard',
  reason: 'live_same_origin_standard_native_surface_conflicts_with_frozen_correct_none',
  requiredAction: 'human-ground-truth-re-review'
}]);

console.log('PASS live standard-native capability drift is queued for human review without changing frozen benchmark correctness');
