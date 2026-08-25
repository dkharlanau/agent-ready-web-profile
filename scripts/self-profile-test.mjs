import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfile } from '../lib/validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'ai', 'site-profile.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'ai', 'site-profile.json'), 'utf8'));

const validation = validateProfile(source);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.deepEqual(published, source, 'GitHub Pages self-profile must match the canonical repository profile');
assert.equal(source.canonicalUrl, 'https://dkharlanau.github.io/agent-ready-web-profile/');
assert.equal(source.data.catalog, 'https://dkharlanau.github.io/agent-ready-web-profile/directory.json');
assert.ok(source.mcp.servers.some(server => server.name === 'arwp-federated-router'));

console.log('PASS ARWP project dogfoods its own profile contract and publishes the same self-profile through GitHub Pages');
