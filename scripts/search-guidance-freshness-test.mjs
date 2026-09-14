import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = new URL('../registry/search-guidance-2026.json', import.meta.url);
const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
const ids = new Set();
const required = [
  'google-llms-txt',
  'google-hreflang-representations',
  'google-hreflang-code-eligibility',
  'google-language-detection',
  'google-faq-rich-results',
  'google-generative-ai-search-console'
];

for (const rule of registry.rules || []) {
  assert.ok(rule.id && !ids.has(rule.id), `duplicate/missing rule id: ${rule.id}`);
  ids.add(rule.id);
  assert.match(rule.source || '', /^https:\/\/(developers\.google\.com|support\.google\.com|www\.w3\.org|schema\.org)\//, `${rule.id}: source must be primary`);
  assert.ok(registry.authorityClasses.includes(rule.authority), `${rule.id}: unknown authority class`);
  assert.ok(registry.surfaceClasses.includes(rule.surfaceClass), `${rule.id}: unknown surface class`);
  assert.match(rule.verifiedAt || '', /^\d{4}-\d{2}-\d{2}$/, `${rule.id}: verifiedAt`);
  assert.match(rule.reviewBy || '', /^\d{4}-\d{2}-\d{2}$/, `${rule.id}: reviewBy`);
  assert.ok(Date.parse(rule.reviewBy) >= Date.parse(rule.verifiedAt), `${rule.id}: reviewBy precedes verifiedAt`);
}

for (const id of required) assert.ok(ids.has(id), `missing Search freshness rule ${id}`);
const faq = registry.rules.find((r) => r.id === 'google-faq-rich-results');
assert.equal(faq.status, 'removed', 'FAQ rich results must not silently return as a current Google feature without an explicit registry update');
const llms = registry.rules.find((r) => r.id === 'google-llms-txt');
assert.equal(llms.surfaceClass, 'optional-agent-interoperability', 'llms.txt must not be classified as Search-required');
assert.equal(llms.status, 'not-required-for-google-search');

console.log(`Search guidance freshness registry passed (${registry.rules.length} rules).`);
