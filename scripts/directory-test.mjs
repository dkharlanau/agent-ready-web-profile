import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'directory.schema.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'sites.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'directory.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'stats.json'), 'utf8'));
const publishedStats = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'stats.json'), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
assert.equal(validate(canonical), true, JSON.stringify(validate.errors, null, 2));
assert.equal(canonical.sites.length, 5);
assert.equal(new Set(canonical.sites.map(site => site.id)).size, canonical.sites.length);
for (const site of canonical.sites) {
  assert.match(site.profileUrl, /^https:\/\/.+\/ai\/site-profile\.json$/);
  assert.equal(site.capabilities.web, true);
}

const canonicalComparable = { ...canonical };
delete canonicalComparable.$schema;
assert.deepEqual(published, canonicalComparable, 'docs/directory.json must remain a semantic copy of registry/sites.json except for $schema');

const capabilityNames = ['web', 'data', 'retrieval', 'openapi', 'agentSkills', 'webmcp', 'mcp', 'a2a', 'trust'];
const expectedCounts = Object.fromEntries(capabilityNames.map(name => [name, canonical.sites.filter(site => Boolean(site.capabilities?.[name])).length]));
assert.equal(stats.sites, canonical.sites.length);
assert.deepEqual(stats.capabilities, expectedCounts, 'aggregate capability statistics must be derived from directory declarations');
assert.equal(stats.privacy, 'Aggregate counts derived from the public directory only. No visitor, scan or user tracking is collected.');
assert.deepEqual(publishedStats, stats, 'Pages stats must remain synchronized with registry stats');

console.log(`PASS ARWP directory schema validates ${canonical.sites.length} sites, Pages data is synchronized, and aggregate stats require no visitor tracking`);
