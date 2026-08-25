import assert from 'node:assert/strict';
import { healthReport } from '../lib/health.mjs';

const scanImpl = async () => ({
  canonicalUrl: 'https://example.com/',
  evidence: [{ key: 'web.homepage', status: 'detected', url: 'https://example.com/' }],
  warnings: [],
  capabilities: { web: { status: 'assessed', detected: ['web.homepage'] } },
  existingProfile: { valid: true, url: 'https://example.com/ai/site-profile.json', profileId: 'example' }
});
const readProfileImpl = async () => ({ profile: {
  profileVersion: '0.1', id: 'example', name: 'Example', canonicalUrl: 'https://example.com/', description: 'Example',
  web: { sitemap: 'https://example.com/sitemap.xml' },
  retrieval: { indexes: [{ name: 'search', url: 'https://example.com/search.json', mediaType: 'application/json' }] }
} });
const verifyImpl = async () => ({
  valid: true,
  summary: { pass: 2, warn: 0, fail: 0 },
  warnings: [],
  resources: [
    { key: 'web.sitemap', status: 'pass', url: 'https://example.com/sitemap.xml' },
    { key: 'retrieval.indexes.0', status: 'pass', url: 'https://example.com/search.json' }
  ]
});

const report = await healthReport('https://example.com/', { scanImpl, readProfileImpl, verifyImpl });
assert.equal(report.profile.status, 'verified');
assert.equal(report.groups.web, 'verified');
assert.equal(report.groups.retrieval, 'verified');
assert.equal(report.groups.mcp, 'not-declared');
assert.equal(report.resourceHealth.summary.pass, 2);

const absent = await healthReport('https://example.com/', {
  scanImpl: async () => ({ canonicalUrl: 'https://example.com/', evidence: [], warnings: [], capabilities: {}, existingProfile: null })
});
assert.equal(absent.profile.status, 'not-detected');
assert.equal(absent.groups.web, 'observed');
assert.equal(absent.groups.mcp, 'not-assessed');

console.log('PASS capability health report separates observed, declared, verified and not-assessed states');
