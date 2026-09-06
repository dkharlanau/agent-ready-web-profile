import assert from 'node:assert/strict';
import { buildGrowthRemediationManifest, validateGrowthRemediationManifest } from '../lib/growth-remediation.mjs';

const plan = {
  profile: '2026-09-06',
  canonicalUrl: 'https://example.com/',
  actions: [
    {
      id: 'growth:cloudflare-content-signals',
      priority: 'P2',
      lane: 'ai-access',
      title: 'Declare content signals',
      status: 'recommended',
      reason: 'Policy example.',
      source: 'https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/',
      implementation: {
        file: '/robots.txt',
        suggestedPolicy: 'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
        note: 'Use only when this is the publisher policy.'
      }
    },
    {
      id: 'growth:entity-identity',
      priority: 'P1',
      lane: 'entity-identity',
      title: 'Publish identity',
      status: 'recommended',
      reason: 'Identity is missing.',
      source: 'https://developers.google.com/search/docs/appearance/structured-data/organization',
      implementation: {
        template: 'templates/growth/organization.jsonld',
        placement: 'homepage or canonical About page'
      }
    },
    {
      id: 'growth:non-commodity-review',
      priority: 'P1',
      lane: 'content-quality',
      title: 'Review content quality',
      status: 'manual',
      reason: 'Editorial judgment is required.',
      implementation: { template: 'templates/growth/content-quality-checklist.md' }
    },
    {
      id: 'trend-owner:provider-setting',
      priority: 'P1',
      lane: 'measurement',
      title: 'Verify owner setting',
      status: 'external-owner-data',
      reason: 'Authenticated state.',
      implementation: { surface: 'authenticated platform owner control' }
    },
    {
      id: 'growth:preferred-source-acquisition',
      priority: 'P2',
      lane: 'citation',
      title: 'Add Preferred Sources CTA',
      status: 'opportunity',
      reason: 'Optional acquisition surface.',
      implementation: {
        url: 'https://www.google.com/preferences/source?q=example.com',
        template: 'templates/growth/preferred-source.html'
      }
    },
    {
      id: 'growth:unsafe-template',
      priority: 'P1',
      lane: 'governance',
      title: 'Unsafe reference fixture',
      status: 'recommended',
      reason: 'Regression fixture.',
      implementation: { template: 'templates/growth/../private.txt' }
    },
    {
      id: 'audit:eligibility',
      priority: 'P1',
      lane: 'eligibility',
      title: 'Review audit failure',
      status: 'fail',
      reason: 'No safe implementation metadata exists.'
    }
  ]
};

const manifest = buildGrowthRemediationManifest(plan, { generatedAt: '2026-09-06T13:40:00Z' });
const validation = validateGrowthRemediationManifest(manifest);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.equal(manifest.version, '0.1');
assert.equal(manifest.site, plan.canonicalUrl);
assert.equal(manifest.summary.total, plan.actions.length);
assert.equal(manifest.guardrails.writesTargetRepository, false);
assert.equal(manifest.guardrails.requiresExplicitAuthorizationBeforeMutation, true);

const byId = new Map(manifest.items.map(item => [item.actionId, item]));
const robots = byId.get('growth:cloudflare-content-signals');
assert.equal(robots.disposition, 'policy-review');
assert.match(robots.implementation.snippet, /^Content-Signal:/);
assert(robots.warnings.includes('robots-policy-must-reflect-publisher-rights-and-distribution-intent'));

const identity = byId.get('growth:entity-identity');
assert.equal(identity.disposition, 'structured-data-proposal');
assert.equal(identity.implementation.templateRef, 'templates/growth/organization.jsonld');
assert.match(identity.implementation.templateSha256, /^sha256:[a-f0-9]{64}$/);
assert.match(identity.implementation.snippet, /REPLACE_WITH_ORGANIZATION_NAME/);

assert.equal(byId.get('growth:non-commodity-review').disposition, 'manual-review');
assert.equal(byId.get('trend-owner:provider-setting').disposition, 'external-owner-review');
assert.equal(byId.get('growth:preferred-source-acquisition').disposition, 'template-proposal');
assert.equal(byId.get('growth:unsafe-template').disposition, 'blocked-unsafe-reference');
assert.equal(byId.get('growth:unsafe-template').implementation.snippet, undefined);
assert.equal(byId.get('audit:eligibility').disposition, 'advisory');
assert(manifest.items.every(item => item.automation === 'proposal-only' && item.humanReviewRequired === true));

assert.throws(
  () => buildGrowthRemediationManifest({ canonicalUrl: 'http://example.com/', profile: 'x', actions: [] }),
  /public HTTPS URL/
);

console.log('PASS growth-remediation-test');
