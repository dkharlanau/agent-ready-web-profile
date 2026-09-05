import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'arwp-receipt.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-receipt-cli-'));

const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /arwp-receipt/);
assert.match(help.stdout, /create <resolution\.json>/);
assert.match(help.stdout, /verify <receipt\.json>/);
assert.match(help.stdout, /not a publisher manifest/i);

const resolutionPath = path.join(temp, 'resolution.json');
const receiptPath = path.join(temp, 'receipt.json');
const resolution = {
  resolverVersion: '0.1',
  decisionPolicyVersion: '0.1',
  target: 'https://example.com/',
  canonicalUrl: 'https://example.com/',
  identity: { name: 'Example', canonicalUrl: 'https://example.com/' },
  sources: [{ id: 'http-head:0', type: 'http-head', url: 'https://example.com/', status: 'resolved', authority: 'observed-web' }],
  conflicts: [],
  metrics: { resolverRequests: 1, resolverBytes: 0 },
  upstreamStatus: {},
  summary: { sourcesAttempted: 1, sourcesResolved: 1, interfacesResolved: 1, conflicts: 0 },
  plans: {
    read: { intent: 'read', outcome: 'selected', selected: { url: 'https://example.com/', kind: 'html', protocol: 'HTML', sourceId: 'http-head:0', sourceAuthority: 'observed-web' }, fallbacks: [], rejected: [], reason: 'HTML fallback.' },
    search: { intent: 'search', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' },
    structured: { intent: 'structured', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' },
    tools: { intent: 'tools', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' },
    agent: { intent: 'agent', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'None.' }
  }
};
fs.writeFileSync(resolutionPath, JSON.stringify(resolution, null, 2));

const created = spawnSync(process.execPath, [
  cli, 'create', resolutionPath,
  '--observed-at=2026-09-05T20:00:00Z',
  '--tool-version=0.2.0',
  `--output=${receiptPath}`
], { encoding: 'utf8' });
assert.equal(created.status, 0, created.stderr || created.stdout);
assert.match(created.stdout, /PASS evidence receipt urn:sha256:/);
assert.match(created.stdout, /Digest: sha256:/);
assert.ok(fs.existsSync(receiptPath));

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
assert.equal(receipt.observedAt, '2026-09-05T20:00:00.000Z');
assert.equal(receipt.toolVersion, '0.2.0');
assert.match(receipt.receiptId, /^urn:sha256:[a-f0-9]{64}$/);

const verified = spawnSync(process.execPath, [cli, 'verify', receiptPath], { encoding: 'utf8' });
assert.equal(verified.status, 0, verified.stderr || verified.stdout);
assert.match(verified.stdout, /^PASS evidence receipt/m);
assert.match(verified.stdout, /Integrity: verified/);
assert.match(verified.stdout, /does not establish publisher endorsement/i);

const verifiedJson = spawnSync(process.execPath, [cli, 'verify', receiptPath, '--json'], { encoding: 'utf8' });
assert.equal(verifiedJson.status, 0, verifiedJson.stderr || verifiedJson.stdout);
const report = JSON.parse(verifiedJson.stdout);
assert.equal(report.valid, true);
assert.equal(report.integrity, true);
assert.equal(report.receiptId, receipt.receiptId);

receipt.plans.read.selected.url = 'https://tampered.example/';
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
const tampered = spawnSync(process.execPath, [cli, 'verify', receiptPath], { encoding: 'utf8' });
assert.equal(tampered.status, 2);
assert.match(tampered.stdout, /^FAIL evidence receipt/m);
assert.match(tampered.stdout, /payload digest does not match/i);

const unknown = spawnSync(process.execPath, [cli, 'unknown'], { encoding: 'utf8' });
assert.notEqual(unknown.status, 0);
assert.match(unknown.stderr, /Unknown command/);

fs.rmSync(temp, { recursive: true, force: true });
console.log('PASS arwp-receipt CLI creates deterministic receipts from saved Resolver JSON, verifies canonical payload integrity and exits non-zero after tampering');
