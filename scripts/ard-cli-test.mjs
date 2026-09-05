import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'arwp-ard.mjs');

const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /arwp-ard/);
assert.match(help.stdout, /search <registry-base-url>/);
assert.match(help.stdout, /validate-entry/);
assert.match(help.stdout, /semantic relevance, not trust/i);
assert.match(help.stdout, /never followed automatically/i);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-ard-cli-'));
const validPath = path.join(temp, 'valid.json');
fs.writeFileSync(validPath, JSON.stringify({
  '@context': [{ acme: 'https://acme.example/vocab#' }],
  identifier: 'urn:air:example.com:skill:summary',
  displayName: 'Summary Skill',
  type: 'application/ai-skill+md',
  url: 'https://example.com/skills/summary/SKILL.md',
  representativeQueries: ['summarize this', 'write a brief'],
  'acme:quality': 'reviewed'
}, null, 2));

const validated = spawnSync(process.execPath, [cli, 'validate-entry', validPath], { encoding: 'utf8' });
assert.equal(validated.status, 0, validated.stderr || validated.stdout);
assert.match(validated.stdout, /^PASS ARD entry/m);
assert.match(validated.stdout, /does not prove artifact reachability/i);

const validatedJson = spawnSync(process.execPath, [cli, 'validate-entry', validPath, '--json'], { encoding: 'utf8' });
assert.equal(validatedJson.status, 0, validatedJson.stderr || validatedJson.stdout);
const report = JSON.parse(validatedJson.stdout);
assert.equal(report.valid, true);
assert.equal(report.normalized.identifier, 'urn:air:example.com:skill:summary');
assert.equal(report.normalized.extensionTerms['acme:quality'], 'reviewed');

const invalidPath = path.join(temp, 'invalid.json');
fs.writeFileSync(invalidPath, JSON.stringify({ displayName: 'Missing required fields', type: 'application/json' }));
const invalid = spawnSync(process.execPath, [cli, 'validate-entry', invalidPath], { encoding: 'utf8' });
assert.equal(invalid.status, 2);
assert.match(invalid.stdout, /^FAIL ARD entry/m);
assert.match(invalid.stdout, /identifier is required/i);
assert.match(invalid.stdout, /Exactly one of url or data is required/i);

const unknown = spawnSync(process.execPath, [cli, 'unknown-command'], { encoding: 'utf8' });
assert.notEqual(unknown.status, 0);
assert.match(unknown.stderr, /Unknown command/);

console.log('PASS arwp-ard CLI exposes explicit search boundaries and deterministic offline ARD entry validation');
