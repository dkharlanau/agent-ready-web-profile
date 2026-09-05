import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createEvidenceReceipt } from '../lib/evidence-receipt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'arwp-assert.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-assert-cli-'));

const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /0  contract passed/);
assert.match(help.stdout, /2  valid contract evaluated/);
assert.match(help.stdout, /does not invoke MCP tools/i);

const resolution = {
  resolverVersion: '0.1',
  decisionPolicyVersion: '0.1',
  target: 'https://example.com/docs/',
  canonicalUrl: 'https://example.com/docs/',
  identity: { name: 'Example Docs', canonicalUrl: 'https://example.com/docs/' },
  sources: [{ id: 'agents-json:0', type: 'agents-json', url: 'https://example.com/agents.json', status: 'resolved', authority: 'community-convention' }],
  conflicts: [],
  metrics: { resolverRequests: 4, resolverBytes: 800 },
  upstreamStatus: {},
  summary: { sourcesAttempted: 4, sourcesResolved: 3, interfacesResolved: 2, conflicts: 0 },
  plans: {
    read: { intent: 'read', outcome: 'selected', selected: { url: 'https://example.com/llms.txt', protocol: 'llms.txt', kind: 'llms', sourceAuthority: 'observed-web' }, fallbacks: [], rejected: [], reason: 'Read.' },
    search: { intent: 'search', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' },
    structured: { intent: 'structured', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' },
    tools: { intent: 'tools', outcome: 'selected', selected: { url: 'https://example.com/mcp', protocol: 'MCP', kind: 'mcp', sourceAuthority: 'community-convention' }, fallbacks: [], rejected: [], reason: 'Tools.' },
    agent: { intent: 'agent', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' }
  }
};
const contract = {
  contractVersion: '0.1',
  target: 'https://example.com/docs/',
  canonicalUrl: 'https://example.com/docs/',
  expect: {
    read: { required: true, protocol: 'llms.txt' },
    tools: { required: true, protocol: 'MCP', kind: 'mcp' },
    agent: { forbidden: true }
  },
  maxConflicts: 0,
  changePolicy: { selectedInterface: 'fail', selectedProtocol: 'fail', newConflicts: 'fail' }
};

const resolutionPath = path.join(temp, 'resolution.json');
const contractPath = path.join(temp, 'contract.json');
const baselinePath = path.join(temp, 'baseline.json');
const receiptOutput = path.join(temp, 'current-receipt.json');
fs.writeFileSync(resolutionPath, JSON.stringify(resolution, null, 2));
fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2));
fs.writeFileSync(baselinePath, JSON.stringify(createEvidenceReceipt(resolution, { observedAt: '2026-09-05T20:00:00Z' }), null, 2));

const pass = spawnSync(process.execPath, [
  cli, contractPath,
  `--resolution=${resolutionPath}`,
  `--baseline-receipt=${baselinePath}`,
  `--receipt-output=${receiptOutput}`,
  '--observed-at=2026-09-05T21:00:00Z'
], { encoding: 'utf8' });
assert.equal(pass.status, 0, pass.stderr || pass.stdout);
assert.match(pass.stdout, /^PASS ARWP assertion contract/m);
assert.match(pass.stdout, /failures: 0/);
assert.match(pass.stdout, /Receipt: urn:sha256:/);
assert.ok(fs.existsSync(receiptOutput));
const emittedReceipt = JSON.parse(fs.readFileSync(receiptOutput, 'utf8'));
assert.equal(emittedReceipt.producer, 'ARWP assertion contract');
assert.equal(emittedReceipt.observedAt, '2026-09-05T21:00:00.000Z');

const passJson = spawnSync(process.execPath, [cli, contractPath, `--resolution=${resolutionPath}`, '--json'], { encoding: 'utf8' });
assert.equal(passJson.status, 0, passJson.stderr || passJson.stdout);
const passReport = JSON.parse(passJson.stdout);
assert.equal(passReport.passed, true);
assert.equal(passReport.mode, 'saved-resolution');
assert.equal(passReport.exitCode, 0);
assert.equal(passReport.summary.failures, 0);

const failedResolution = structuredClone(resolution);
failedResolution.plans.tools.selected.protocol = 'WebMCP';
const failedPath = path.join(temp, 'failed-resolution.json');
fs.writeFileSync(failedPath, JSON.stringify(failedResolution, null, 2));
const failed = spawnSync(process.execPath, [cli, contractPath, `--resolution=${failedPath}`, '--json'], { encoding: 'utf8' });
assert.equal(failed.status, 2, failed.stderr || failed.stdout);
const failedReport = JSON.parse(failed.stdout);
assert.equal(failedReport.passed, false);
assert.equal(failedReport.exitCode, 2);
assert.ok(failedReport.failures.some(item => item.id === 'intent.tools.protocol'));

const invalidContractPath = path.join(temp, 'invalid-contract.json');
fs.writeFileSync(invalidContractPath, JSON.stringify({ contractVersion: '0.1', target: 'https://example.com/', expect: { tools: { required: true, forbidden: true } } }, null, 2));
const invalid = spawnSync(process.execPath, [cli, invalidContractPath, `--resolution=${resolutionPath}`, '--json'], { encoding: 'utf8' });
assert.equal(invalid.status, 1);
const invalidReport = JSON.parse(invalid.stdout);
assert.equal(invalidReport.contractValid, false);
assert.equal(invalidReport.exitCode, 1);

const changed = structuredClone(resolution);
changed.plans.tools.selected.url = 'https://example.com/mcp-v2';
const changedPath = path.join(temp, 'changed.json');
fs.writeFileSync(changedPath, JSON.stringify(changed, null, 2));
const changedResult = spawnSync(process.execPath, [cli, contractPath, `--resolution=${changedPath}`, `--baseline-receipt=${baselinePath}`, '--json'], { encoding: 'utf8' });
assert.equal(changedResult.status, 2);
const changedReport = JSON.parse(changedResult.stdout);
assert.ok(changedReport.failures.some(item => item.id === 'change.tools.selectedInterface'));

const tamperedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
tamperedBaseline.plans.read.selected.url = 'https://tampered.example/';
const tamperedPath = path.join(temp, 'tampered-baseline.json');
fs.writeFileSync(tamperedPath, JSON.stringify(tamperedBaseline, null, 2));
const tamperedResult = spawnSync(process.execPath, [cli, contractPath, `--resolution=${resolutionPath}`, `--baseline-receipt=${tamperedPath}`, '--json'], { encoding: 'utf8' });
assert.equal(tamperedResult.status, 2);
const tamperedReport = JSON.parse(tamperedResult.stdout);
assert.ok(tamperedReport.failures.some(item => item.id === 'baseline.receiptIntegrity'));

fs.rmSync(temp, { recursive: true, force: true });
console.log('PASS arwp-assert uses deterministic 0/1/2 exit codes, evaluates saved Resolver output without network, detects contract and baseline drift failures, and can emit a current Evidence Receipt');
