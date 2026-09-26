import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  flattenValidationContract,
  validationGroups,
  validationPhases
} from './validation-contract.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

const core = flattenValidationContract('core');
assert.equal(core.length, 85, 'core validation contract command count changed; review coverage intentionally before updating this assertion');
const coreFingerprint = crypto
  .createHash('sha256')
  .update(JSON.stringify(core.map((command) => command.args)))
  .digest('hex');
assert.equal(
  coreFingerprint,
  '04de55c62261ee94d62d9604df977a3e2061640b631e51a13e8ce7eeab2eaa24',
  'core validation command/order fingerprint changed; review equivalence intentionally before updating the fingerprint'
);

for (const [phaseName, phase] of Object.entries(validationPhases)) {
  assert.ok(phase.description, `${phaseName} must explain its boundary`);
  assert.ok(phase.commands.length > 0, `${phaseName} must contain at least one command`);
  for (const command of phase.commands) {
    assert.equal(command.runtime, 'node', `${phaseName} must remain shell-free`);
    const candidates = command.args.filter((arg) =>
      typeof arg === 'string' &&
      /^(?:ai|benchmarks|bin|docs|examples|gateway|lib|monitor|registry|resolver|scanner-service|schema|scripts)\//.test(arg) &&
      /\.(?:json|mjs)$/.test(arg)
    );
    for (const candidate of candidates) {
      if (!fs.existsSync(path.join(repoRoot, candidate))) {
        fail(`${phaseName} points to missing path: ${candidate}`);
      }
    }
  }
}

for (const [groupName, entries] of Object.entries(validationGroups)) {
  assert.ok(entries.length > 0, `${groupName} must contain at least one phase`);
  for (const phaseName of entries) {
    if (!validationPhases[phaseName] && !validationGroups[phaseName]) {
      fail(`${groupName} references unknown validation entry: ${phaseName}`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
if (packageJson.scripts?.test !== 'node scripts/validation-contract.mjs core') {
  fail('package.json scripts.test must delegate to validation-contract.mjs core');
}
if (packageJson.scripts?.['test:validation-contract'] !== 'node scripts/validation-contract-test.mjs') {
  fail('package.json must expose test:validation-contract');
}

const ciPath = path.join(repoRoot, '.github/workflows/ci.yml');
const ci = fs.readFileSync(ciPath, 'utf8');
const ciPhaseMatches = [...ci.matchAll(/node scripts\/validation-contract\.mjs ([a-z0-9-]+)/g)].map((match) => match[1]);
const expectedCiPhases = [
  'ci-maturity',
  'ci-site-focus',
  'ci-entity-gap',
  'ci-entity-remediation',
  'ci-search-surface',
  'ci-site-improvement',
  'ci-dataset',
  'ci-content-profile',
  'ci-classification',
  'ci-benchmark-publication',
  'ci-benchmark-diagnostics',
  'ci-large-homepage',
  'ci-package-improvement',
  'ci-examples'
];
assert.deepEqual(ciPhaseMatches, expectedCiPhases, 'main CI phase routing changed; review the validation boundary intentionally');

const preservedCiBoundaries = [
  'node scripts/repository-memory-test.mjs',
  'node scripts/validation-contract-test.mjs',
  'npm test',
  'npm install --no-save --ignore-scripts --no-audit --no-fund @a2a-js/sdk@1.0.1',
  "python -m pip install --disable-pip-version-check --index-url https://pypi.org/simple 'a2a-sdk[signing,encryption]==1.1.2'",
  'node bin/arwp-focus.mjs https://dkharlanau.github.io/agent-ready-web-profile/',
  'uses: ./'
];
for (const boundary of preservedCiBoundaries) {
  if (!ci.includes(boundary)) fail(`main CI lost explicit boundary: ${boundary}`);
}

if (failures.length) {
  console.error('Validation contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validation contract passed: ${core.length} core commands across ${Object.keys(validationPhases).length} phases.`);
