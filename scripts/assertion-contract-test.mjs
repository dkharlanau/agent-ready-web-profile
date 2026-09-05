import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { evaluateAssertionContract, validateAssertionContract } from '../lib/assertion-contract.mjs';
import { createEvidenceReceipt } from '../lib/evidence-receipt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'assertion-contract.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function resolution(overrides = {}) {
  const base = {
    resolverVersion: '0.1',
    decisionPolicyVersion: '0.1',
    target: 'https://example.com/docs/',
    canonicalUrl: 'https://example.com/docs/',
    identity: { name: 'Example Docs', canonicalUrl: 'https://example.com/docs/' },
    sources: [
      { id: 'http-head:0', type: 'http-head', url: 'https://example.com/docs/', status: 'resolved', authority: 'observed-web' },
      { id: 'agents-json:0', type: 'agents-json', url: 'https://example.com/agents.json', status: 'resolved', authority: 'community-convention' }
    ],
    conflicts: [],
    metrics: { resolverRequests: 5, resolverBytes: 1000 },
    upstreamStatus: {},
    summary: { sourcesAttempted: 5, sourcesResolved: 4, interfacesResolved: 3, conflicts: 0 },
    plans: {
      read: { intent: 'read', outcome: 'selected', selected: { url: 'https://example.com/llms.txt', protocol: 'llms.txt', kind: 'llms', sourceId: 'homepage-scan', sourceAuthority: 'observed-web' }, fallbacks: [], rejected: [], reason: 'Selected llms.' },
      search: { intent: 'search', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' },
      structured: { intent: 'structured', outcome: 'insufficient-evidence', selected: null, fallbacks: [], rejected: [{ url: 'https://example.com/openapi.json', protocol: 'OpenAPI', kind: 'api-description', rejectionReason: 'root-scope-not-target-scope' }], reason: 'Rejected root-scoped API.' },
      tools: { intent: 'tools', outcome: 'selected', selected: { url: 'https://example.com/mcp', protocol: 'MCP', kind: 'mcp', sourceId: 'agents-json:0', sourceAuthority: 'community-convention' }, fallbacks: [], rejected: [], reason: 'Selected MCP.' },
      agent: { intent: 'agent', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' }
    }
  };
  return { ...base, ...overrides, plans: { ...base.plans, ...(overrides.plans || {}) } };
}

const contract = {
  contractVersion: '0.1',
  target: 'https://example.com/docs/',
  canonicalUrl: 'https://example.com/docs/',
  expect: {
    read: { required: true, protocol: ['llms.txt', 'HTTP'], sourceAuthority: 'observed-web', urlPrefix: 'https://example.com/' },
    search: { required: false, protocol: 'OpenAPI' },
    structured: { required: false, outcome: ['none', 'insufficient-evidence'], maxRejected: 2 },
    tools: { required: true, protocol: 'MCP', kind: 'mcp' },
    agent: { forbidden: true }
  },
  maxConflicts: 0,
  forbidConflictKinds: ['identity-mismatch'],
  requiredSourceAuthorities: ['observed-web', 'community-convention'],
  changePolicy: {
    selectedInterface: 'fail',
    selectedProtocol: 'fail',
    planOutcome: 'warn',
    newConflicts: 'fail'
  }
};

assert.equal(validateAssertionContract(contract).valid, true);
assert.equal(validateSchema(contract), true, JSON.stringify(validateSchema.errors));
const current = resolution();
const baselineReceipt = createEvidenceReceipt(current, { observedAt: '2026-09-05T20:00:00Z' });
const result = evaluateAssertionContract(contract, current, { baselineReceipt });
assert.equal(result.valid, true);
assert.equal(result.passed, true, JSON.stringify(result.failures));
assert.equal(result.summary.failures, 0);
assert.equal(result.summary.conflicts, 0);
assert.ok(result.checks.some(item => item.id === 'intent.read.required' && item.passed));
assert.ok(result.checks.some(item => item.id === 'intent.tools.protocol' && item.passed));
assert.ok(result.checks.some(item => item.id === 'intent.agent.forbidden' && item.passed));
assert.ok(result.checks.some(item => item.id === 'intent.search.selectionConstraints' && item.severity === 'info'));
assert.ok(result.checks.some(item => item.id === 'sources.authority.observed-web' && item.passed));
assert.equal(result.note.includes('not readiness scores'), true);

const missingTools = resolution({ plans: { tools: { intent: 'tools', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'Missing.' } } });
const missingToolsResult = evaluateAssertionContract(contract, missingTools);
assert.equal(missingToolsResult.passed, false);
assert.ok(missingToolsResult.failures.some(item => item.id === 'intent.tools.required'));

const wrongProtocol = resolution({ plans: { tools: { ...current.plans.tools, selected: { ...current.plans.tools.selected, protocol: 'WebMCP' } } } });
const wrongProtocolResult = evaluateAssertionContract(contract, wrongProtocol);
assert.equal(wrongProtocolResult.passed, false);
assert.ok(wrongProtocolResult.failures.some(item => item.id === 'intent.tools.protocol'));

const forbiddenAgent = resolution({ plans: { agent: { intent: 'agent', outcome: 'selected', selected: { url: 'https://example.com/a2a', protocol: 'A2A', kind: 'agent-endpoint', sourceAuthority: 'upstream-standard' }, fallbacks: [], rejected: [], reason: 'Selected.' } } });
const forbiddenResult = evaluateAssertionContract(contract, forbiddenAgent);
assert.equal(forbiddenResult.passed, false);
assert.ok(forbiddenResult.failures.some(item => item.id === 'intent.agent.forbidden'));

const conflictResolution = resolution({
  conflicts: [{ kind: 'identity-mismatch', capability: 'identity', severity: 'warning', message: 'Identity changed.' }],
  summary: { sourcesAttempted: 5, sourcesResolved: 4, interfacesResolved: 3, conflicts: 1 }
});
const conflictResult = evaluateAssertionContract(contract, conflictResolution);
assert.equal(conflictResult.passed, false);
assert.ok(conflictResult.failures.some(item => item.id === 'conflicts.max'));
assert.ok(conflictResult.failures.some(item => item.id === 'conflicts.forbid.identity-mismatch'));

const changed = resolution({
  plans: {
    tools: { ...current.plans.tools, selected: { ...current.plans.tools.selected, url: 'https://example.com/mcp-v2', protocol: 'MCP2' } },
    structured: { ...current.plans.structured, outcome: 'none', rejected: [] }
  },
  conflicts: [{ kind: 'mcp-endpoint-mismatch', capability: 'MCP', severity: 'warning', message: 'New MCP mismatch.' }]
});
const changedResult = evaluateAssertionContract(contract, changed, { baselineReceipt });
assert.equal(changedResult.passed, false);
assert.ok(changedResult.failures.some(item => item.id === 'change.tools.selectedInterface'));
assert.ok(changedResult.failures.some(item => item.id === 'change.tools.selectedProtocol'));
assert.ok(changedResult.failures.some(item => item.id === 'change.newConflicts'));
assert.ok(changedResult.warnings.some(item => item.id === 'change.structured.planOutcome'));

const warnContract = structuredClone(contract);
warnContract.expect.tools.protocol = ['MCP', 'MCP2'];
warnContract.maxConflicts = 2;
warnContract.changePolicy.selectedInterface = 'warn';
warnContract.changePolicy.selectedProtocol = 'warn';
warnContract.changePolicy.newConflicts = 'warn';
const warnResult = evaluateAssertionContract(warnContract, changed, { baselineReceipt });
assert.equal(warnResult.passed, true, JSON.stringify(warnResult.failures));
assert.ok(warnResult.warnings.length >= 3);

const tamperedBaseline = structuredClone(baselineReceipt);
tamperedBaseline.plans.read.selected.url = 'https://tampered.example/';
const tamperedBaselineResult = evaluateAssertionContract(contract, current, { baselineReceipt: tamperedBaseline });
assert.equal(tamperedBaselineResult.passed, false);
assert.ok(tamperedBaselineResult.failures.some(item => item.id === 'baseline.receiptIntegrity'));

const invalid = { contractVersion: '0.1', target: 'https://example.com/', expect: { tools: { required: true, forbidden: true } } };
assert.equal(validateAssertionContract(invalid).valid, false);
assert.equal(validateSchema(invalid), false);

console.log('PASS assertion contract v0.1 enforces required/forbidden intent surfaces, protocol/kind/authority/conflict constraints, validates baseline receipt integrity and detects selected-interface/protocol/outcome/conflict drift without readiness scoring or execution');
