import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { checkLocalization } from '../lib/localization-quality.mjs';
import { evaluateSurfaceIntegrity } from '../lib/surface-integrity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'benchmarks', 'localization-quality', 'base');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

const compile = name => {
  const validate = ajv.compile(read(path.join(root, 'schema', name)));
  return value => ({ valid: validate(value), errors: validate.errors });
};
const requireValid = (validator, value, name) => {
  const result = validator(value);
  assert.equal(result.valid, true, `${name}: ${ajv.errorsText(result.errors)}`);
};

const validateProfile = compile('localization-profile.schema.json');
const validateReport = compile('localization-report.schema.json');
const validateDebt = compile('quality-debt-ledger.schema.json');
const validateSurfaceContract = compile('surface-integrity-contract.schema.json');
const validateSurfaceReport = compile('surface-integrity-report.schema.json');
const validateAgentEval = compile('agent-eval-receipt.schema.json');

const profile = read(path.join(fixture, 'profile.json'));
requireValid(validateProfile, profile, 'localization-profile.schema.json');
requireValid(validateDebt, read(path.join(fixture, 'debt.json')), 'quality-debt-ledger.schema.json');
requireValid(
  validateReport,
  checkLocalization(profile, { root: fixture, generatedAt: '2026-09-13T12:00:00.000Z' }),
  'localization-report.schema.json'
);

const surfaceContract = {
  version: '0.1',
  site: 'https://example.test/',
  expectations: [
    {
      id: 'x:page',
      entityId: 'x',
      surface: 'page',
      representation: 'html',
      applicability: 'required',
      parity: 'semantic'
    }
  ],
  impactRules: [{ paths: ['content/**'], surfaces: ['page'] }]
};
requireValid(validateSurfaceContract, surfaceContract, 'surface-integrity-contract.schema.json');
requireValid(
  validateSurfaceReport,
  evaluateSurfaceIntegrity(
    surfaceContract,
    [{ expectationId: 'x:page', state: 'present', evidence: ['fixture'] }],
    { generatedAt: '2026-09-13T12:00:00.000Z' }
  ),
  'surface-integrity-report.schema.json'
);

const legacyAgentEval = {
  version: '0.1',
  site: 'https://example.test/',
  capturedAt: '2026-09-13T12:00:00Z',
  runtime: { browser: 'Chrome', webmcpState: 'not-assessed' },
  tasks: [
    {
      id: 'legacy-task',
      description: 'Complete the same task through the declared interface.',
      variants: [{ mode: 'ui', success: true, interactions: 2, retries: 0, toolCalls: 0 }]
    }
  ],
  guardrails: {
    sameTaskDefinition: true,
    noSecretsInReceipt: true,
    runtimeEvidenceIsNotTrust: true
  }
};
requireValid(validateAgentEval, legacyAgentEval, 'legacy Agent Eval receipt');

const localizedAgentEval = structuredClone(legacyAgentEval);
localizedAgentEval.tasks[0] = {
  ...localizedAgentEval.tasks[0],
  id: 'localized-search-filter',
  locale: 'pt-BR',
  market: 'BR',
  taskClass: 'search-filter',
  expectedOutcome: 'The Portuguese result set preserves the intended filter semantics.',
  route: '/pt-br/biases/',
  surface: 'bias-catalog',
  interactionMode: 'comparison',
  sideEffectClass: 'none',
  authorizationRequirement: 'none'
};
requireValid(validateAgentEval, localizedAgentEval, 'locale-aware Agent Eval receipt');

const tooManyTasks = structuredClone(legacyAgentEval);
tooManyTasks.tasks = Array.from({ length: 101 }, (_, index) => ({
  ...legacyAgentEval.tasks[0],
  id: `task-${index}`
}));
assert.equal(validateAgentEval(tooManyTasks).valid, false, 'Agent Eval must retain the original 100-task bound');

const tooManyVariants = structuredClone(legacyAgentEval);
tooManyVariants.tasks[0].variants = Array.from({ length: 5 }, (_, index) => ({
  mode: index % 2 ? 'webmcp' : 'ui',
  success: true,
  interactions: 1,
  retries: 0,
  toolCalls: index % 2 ? 1 : 0
}));
assert.equal(validateAgentEval(tooManyVariants).valid, false, 'Agent Eval must retain the original four-variant bound');

const invalidGuardrail = structuredClone(legacyAgentEval);
invalidGuardrail.guardrails.runtimeEvidenceIsNotTrust = false;
assert.equal(validateAgentEval(invalidGuardrail).valid, false, 'Agent Eval trust boundary must remain mandatory');

console.log('PASS localization, Surface Integrity and additive locale-aware Agent Eval schemas');
