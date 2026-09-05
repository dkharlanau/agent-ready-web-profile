import assert from 'node:assert/strict';
import { summarizeAgentEvalReceipt, validateAgentEvalReceipt } from '../lib/agent-eval.mjs';

const receipt = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/agent-eval-receipt.schema.json',
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-09-05T17:00:00Z',
  runtime: {
    browser: 'Chrome',
    browserVersion: '149',
    runner: 'reviewed browser-agent harness',
    webmcpState: 'observed-runtime'
  },
  tasks: [
    {
      id: 'search-catalog',
      description: 'Search the public catalog for a named item and return the canonical result.',
      variants: [
        { mode: 'ui', success: true, interactions: 12, retries: 1, toolCalls: 0, durationMs: 4100 },
        { mode: 'webmcp', success: true, interactions: 1, retries: 0, toolCalls: 1, durationMs: 850 }
      ]
    },
    {
      id: 'apply-filter',
      description: 'Apply a structured filter and return the resulting count.',
      variants: [
        { mode: 'ui', success: false, interactions: 9, retries: 2, toolCalls: 0, durationMs: 5600, errors: ['filter state was not recovered'] },
        { mode: 'webmcp', success: true, interactions: 1, retries: 0, toolCalls: 1, durationMs: 920 }
      ]
    }
  ],
  guardrails: { sameTaskDefinition: true, noSecretsInReceipt: true, runtimeEvidenceIsNotTrust: true }
};

const validation = validateAgentEvalReceipt(receipt);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.deepEqual(validation.warnings, []);

const summary = summarizeAgentEvalReceipt(receipt);
assert.equal(summary.valid, true);
assert.equal(summary.runtime.webmcpState, 'observed-runtime');
assert.equal(summary.tasks[0].comparison.interactionDelta, -11);
assert.equal(summary.tasks[0].comparison.retryDelta, -1);
assert.equal(summary.tasks[0].comparison.durationDeltaMs, -3250);
assert.equal(summary.tasks[1].comparison.successChanged, true);
assert.match(summary.interpretation, /not proof of security/i);

const noBaseline = structuredClone(receipt);
noBaseline.tasks[0].variants = noBaseline.tasks[0].variants.filter(variant => variant.mode !== 'ui');
const noBaselineValidation = validateAgentEvalReceipt(noBaseline);
assert.equal(noBaselineValidation.valid, true, 'schema permits partial receipts');
assert.ok(noBaselineValidation.warnings.some(value => /no UI baseline/i.test(value)));

const invalid = structuredClone(receipt);
invalid.guardrails.runtimeEvidenceIsNotTrust = false;
assert.equal(validateAgentEvalReceipt(invalid).valid, false, 'receipt contract must preserve runtime-evidence trust boundary');

console.log('PASS browser agent eval receipts compare identical UI/WebMCP tasks while keeping runtime evidence separate from trust and search claims');
