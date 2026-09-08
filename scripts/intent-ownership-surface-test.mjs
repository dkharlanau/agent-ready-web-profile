import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIntentOwnershipReport } from '../lib/intent-ownership.mjs';
import {
  applyIntentOwnershipSurfaceProof,
  probeIntentOwnershipSurface,
  robotsPathAccess,
  validateIntentOwnershipSurfaceProof
} from '../lib/intent-ownership-surface.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks', 'intent-ownership', 'public-fixture.json'), 'utf8'));

const robotsRules = 'User-agent: *\nDisallow: /practice/\nAllow: /practice/public/\n';
assert.equal(robotsPathAccess(robotsRules, 'Googlebot', 'https://example.com/practice/concise-speaking/').status, 'blocked');
assert.equal(robotsPathAccess(robotsRules, 'Googlebot', 'https://example.com/practice/public/example/').status, 'allowed');
assert.equal(robotsPathAccess('User-agent: *\nAllow: /folder\nDisallow: /folder', 'Googlebot', 'https://example.com/folder/page').status, 'allowed');
assert.equal(robotsPathAccess('User-agent: *\nAllow: /$\nDisallow: /', 'Googlebot', 'https://example.com/').status, 'allowed');
assert.equal(robotsPathAccess('User-agent: *\nAllow: /$\nDisallow: /', 'Googlebot', 'https://example.com/page').status, 'blocked');

async function fetchText(url) {
  if (url === 'https://example.com/robots.txt') return { ok: true, status: 200, url, contentType: 'text/plain', headers: {}, text: robotsRules };
  if (url === 'https://example.com/guide/clear-explanations/') return { ok: true, status: 200, url, contentType: 'text/html; charset=utf-8', headers: {}, text: '<html><head><link rel="canonical" href="/guide/clear-explanations/"></head><body>Clear explanations</body></html>' };
  if (url === 'https://example.com/guide/status-updates/') return { ok: true, status: 200, url, contentType: 'text/html', headers: { xRobotsTag: 'noindex' }, text: '<html><body>Status update guidance</body></html>' };
  if (url === 'https://example.com/practice/concise-speaking/') return { ok: true, status: 200, url, contentType: 'text/html', headers: {}, text: '<html><body>Concise speaking practice</body></html>' };
  if (url === 'https://example.com/old/clear-speaking/') return { ok: true, status: 200, url: 'https://example.com/guide/clear-explanations/', contentType: 'text/html', headers: {}, text: '<html><body>Redirect target</body></html>' };
  if (url === 'https://example.com/draft/meeting-answer/') return { ok: true, status: 200, url, contentType: 'text/html', headers: {}, text: '<html><head><link rel="canonical" href="/guide/status-updates/"></head><body>Meeting answer draft</body></html>' };
  throw new Error(`Unexpected URL ${url}`);
}

const proof = await probeIntentOwnershipSurface(fixture, { fetchText, observedAt: '2026-09-08T06:00:00Z' });
assert.equal(validateIntentOwnershipSurfaceProof(proof, fixture).valid, true);
assert.deepEqual(Object.fromEntries(proof.pages.map(page => [new URL(page.url).pathname, page.derivedIndexState])), {
  '/guide/clear-explanations/': 'indexable',
  '/guide/status-updates/': 'noindex',
  '/practice/concise-speaking/': 'unknown',
  '/old/clear-speaking/': 'redirect',
  '/draft/meeting-answer/': 'unknown'
});
assert.equal(proof.boundaries.technicalEligibilityOnly, true);
assert.equal(proof.boundaries.actualGoogleIndexingObserved, false);
assert.equal(proof.boundaries.deploymentCommitProven, false);
assert.equal(proof.boundaries.googleSelectedCanonicalObserved, false);

const updated = applyIntentOwnershipSurfaceProof(fixture, proof);
assert.equal(updated.reviewedAt, '2026-09-08T06:00:00Z');
assert.equal(updated.canonicalPages.find(page => page.url.endsWith('/guide/clear-explanations/')).indexState, 'indexable');
assert.equal(updated.canonicalPages.find(page => page.url.endsWith('/guide/status-updates/')).indexState, 'noindex');
assert.equal(updated.canonicalPages.find(page => page.url.endsWith('/old/clear-speaking/')).canonicalUrl, 'https://example.com/guide/clear-explanations/');
const report = buildIntentOwnershipReport(updated);
assert.equal(report.families.find(family => family.id === 'explain-clearly').ownershipState, 'owned');
assert.equal(report.families.find(family => family.id === 'declined-navigation-mismatch').ownershipState, 'declined');

const tampered = structuredClone(proof);
tampered.boundaries.actualGoogleIndexingObserved = true;
assert.equal(validateIntentOwnershipSurfaceProof(tampered, fixture).valid, false);

console.log('Intent Ownership surface proof regression passed.');
