import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditProjectSurfaces, REQUIRED_PROJECT_SURFACE_ROLES } from '../lib/project-surfaces.mjs';

const site = 'https://example.org/';
const html = url => `<!doctype html><html><head><meta name="description" content="A substantive policy page for a test-only fixture."><link rel="canonical" href="${url}"></head><body><h1>Policy</h1></body></html>`;
const requiredSurfaces = REQUIRED_PROJECT_SURFACE_ROLES.map((id, index) => ({
  id,
  path: index < 5 ? 'project.html' : id === 'security' ? 'SECURITY.md' : id === 'change-history' ? 'history.html' : 'trust.html',
  publicUrl: index < 5 ? `${site}project/` : id === 'security' ? `${site}security` : id === 'change-history' ? `${site}history.html` : `${site}trust/`,
  job: `Test-only semantic job for ${id}`
}));
const manifest = {
  schemaVersion: '1.0',
  scope: 'Synthetic fixture; not legal compliance, certification or ranking evidence.',
  product: { name: 'Fixture Product', canonicalUrl: site },
  owner: { id: `${site}#owner`, name: 'Fixture Owner', type: 'Person' },
  requiredSurfaces,
  conditionalSurfaces: [
    { id: 'privacy-data-use', applicable: true, path: 'privacy.html', publicUrl: `${site}privacy.html`, reason: 'Fixture enables analytics.' },
    { id: 'terms-service', applicable: false, reason: 'Fixture has no service contract.' }
  ],
  projectNames: [
    { name: 'Fixture Product', role: 'canonical-product-name', status: 'active-project-reserved', registeredTrademarkClaimed: false },
    { name: 'Fixture Technical Name', role: 'technical-project-name', status: 'active-project-reserved', registeredTrademarkClaimed: false }
  ],
  guardrails: {
    pageCountIsNotMaturity: true,
    legalComplianceClaimedByPresence: false,
    rankingBenefitClaimed: false,
    trademarkRegistrationClaimed: false,
    partnershipImpliesEndorsement: false,
    conditionalSurfacesMustMatchActualSiteBehavior: true
  }
};
const files = {
  'project.html': html(`${site}project/`),
  'SECURITY.md': '# Security\nFixture security process.',
  'history.html': html(`${site}history.html`),
  'trust.html': html(`${site}trust/`),
  'privacy.html': html(`${site}privacy.html`)
};
const clone = value => JSON.parse(JSON.stringify(value));
const run = (value = manifest, source = files) => auditProjectSurfaces(value, { readText: file => {
  if (!(file in source)) throw new Error('Missing file');
  return source[file];
} });
let cases = 0;
const test = (name, fn) => { fn(); cases++; console.log(`PASS ${name}`); };

test('valid role manifest allows substantive page consolidation', () => {
  const result = run();
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.files.filter(item => item.path === 'project.html').length, 1);
});
test('missing semantic role fails even when many pages exist', () => {
  const value = clone(manifest); value.requiredSurfaces = value.requiredSurfaces.filter(item => item.id !== 'copyright-rights');
  assert.equal(run(value).valid, false);
});
test('duplicate role id fails', () => {
  const value = clone(manifest); value.requiredSurfaces.push(clone(value.requiredSurfaces[0]));
  assert.equal(run(value).valid, false);
});
test('applicable conditional policy needs a real local surface', () => {
  const source = { ...files }; delete source['privacy.html'];
  assert.equal(run(manifest, source).valid, false);
});
test('non-applicable conditional policy still needs a reason', () => {
  const value = clone(manifest); delete value.conditionalSurfaces[1].reason;
  assert.equal(run(value).valid, false);
});
test('html canonical must match declared public url', () => {
  assert.equal(run(manifest, { ...files, 'privacy.html': html('https://wrong.example/privacy') }).valid, false);
});
test('project naming roles do not imply trademark registration', () => {
  const result = run();
  assert.match(result.review.join(' '), /not trademark registration/i);
});
test('guardrails reject page-count and ranking theater', () => {
  const value = clone(manifest); value.guardrails.rankingBenefitClaimed = true;
  assert.equal(run(value).valid, false);
});
test('unsafe policy paths fail', () => {
  const value = clone(manifest); value.requiredSurfaces[0].path = '../secret';
  assert.equal(run(value).valid, false);
});

if (process.argv.includes('--site')) {
  const current = JSON.parse(fs.readFileSync('docs/project/profile.json', 'utf8'));
  const result = auditProjectSurfaces(current, { readText: file => fs.readFileSync(file, 'utf8') });
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(current.product.name, 'Goose ARWP');
  assert.equal(current.companyRouting.url, 'https://www.linkedin.com/company/metalhatscats');
  assert.equal(current.companyRouting.surface, 'LinkedIn Company');
  assert.ok(!JSON.stringify(current).includes('metalhatscats.com'));
  for (const role of REQUIRED_PROJECT_SURFACE_ROLES) assert.ok(result.roles.includes(role));
  for (const role of ['canonical-product-name', 'technical-project-name']) assert.ok(current.projectNames.some(item => item.role === role));
  assert.ok(current.projectNames.some(item => item.name === 'Cite Goose' && item.status.startsWith('deprecated')));
  const sitemap = fs.readFileSync('docs/sitemap.xml', 'utf8');
  for (const route of ['project/', 'project/rights.html', 'project/marks.html', 'project/collaboration.html', 'project/governance.html', 'project/privacy.html']) {
    assert.ok(sitemap.includes(`${current.product.canonicalUrl}${route}</loc>`), `sitemap missing ${route}`);
  }
  console.log(`PASS Goose project surface integration: ${result.roles.length} required roles, ${result.files.length} observed local artifacts`);
}
console.log(`PASS ${cases} project surface regression cases; no network or legal certification performed`);
