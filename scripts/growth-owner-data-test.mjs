import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyOwnerDataEvidence, OWNER_DATA_ACTION_REQUIREMENTS, parseOwnerDataReceipt } from '../lib/growth-owner-data.mjs';

const now = new Date('2026-09-06T12:00:00Z');
const basePlan = {
  canonicalUrl: 'https://example.com/',
  summary: {},
  observations: {},
  refinements: {},
  actions: [
    { id: 'growth:google-generative-ai-measurement-global', priority: 'P1', lane: 'measurement', status: 'external-owner-data', title: 'Google AI measurement' },
    { id: 'growth:bing-ai-citation-measurement', priority: 'P1', lane: 'measurement', status: 'external-owner-data', title: 'Bing AI measurement' },
    { id: 'growth:google-platform-properties', priority: 'P2', lane: 'measurement', status: 'external-owner-data', title: 'Platform properties' },
    { id: 'trend-owner:google-generative-ai-control-global', priority: 'P1', lane: 'ai-access', status: 'external-owner-data', title: 'Google AI inclusion' },
    { id: 'growth:preferred-source-acquisition', priority: 'P2', lane: 'citation', status: 'opportunity', title: 'Preferred Sources' }
  ]
};

function receipt(records, overrides = {}) {
  return {
    ok: true,
    url: 'https://example.com/ai/growth-owner-data.json',
    text: JSON.stringify({
      version: '0.1',
      site: 'https://example.com/',
      evidenceClass: 'owner-data',
      generatedAt: '2026-09-06T10:00:00Z',
      guardrails: {
        notIndependentEvidence: true,
        noRankingClaim: true,
        noCrossSurfaceInference: true,
        noProviderInference: true,
        sensitiveDataOmitted: true
      },
      records,
      ...overrides
    })
  };
}

function record(actionId, provider, kind, evidenceType = 'measurement', extra = {}) {
  return {
    actionId,
    evidenceType,
    provider,
    kind,
    status: evidenceType === 'owner-state' ? 'verified' : 'observed',
    observedAt: '2026-09-06T09:40:05Z',
    dataThrough: '2026-09-04',
    summary: 'Authenticated owner-side evidence was observed.',
    scope: ['https://example.com/'],
    evidence: ['https://github.com/example/site/actions'],
    sourceDigest: `sha256:${'a'.repeat(64)}`,
    ...extra
  };
}

assert.equal(Object.keys(OWNER_DATA_ACTION_REQUIREMENTS).length, 4);

const baseline = record('observation:google-search-console-baseline', 'google-search-console', 'search-performance');
const parsedBaseline = parseOwnerDataReceipt(receipt([baseline]), { canonicalUrl: basePlan.canonicalUrl, now });
assert.equal(parsedBaseline.valid, true);
const baselineApplied = applyOwnerDataEvidence(basePlan, receipt([baseline]), { now });
assert.equal(baselineApplied.ownerDataEvidence.length, 0, 'ordinary GSC Search performance must not close AI owner-data actions');
assert.equal(baselineApplied.actions.length, 4);
assert.equal(baselineApplied.opportunities.length, 1);
assert.equal(baselineApplied.opportunities[0].id, 'growth:preferred-source-acquisition');
assert.deepEqual(baselineApplied.observations.ownerData.matchedActionIds, []);
assert.deepEqual(baselineApplied.observations.ownerData.unmatchedRecordIds, ['observation:google-search-console-baseline']);
assert.equal(baselineApplied.refinements.optionalOpportunitiesSeparated, 1);

const googleAi = record('growth:google-generative-ai-measurement-global', 'google-search-console', 'generative-ai-performance');
const googleAiApplied = applyOwnerDataEvidence(basePlan, receipt([googleAi]), { now });
assert.equal(googleAiApplied.actions.some(item => item.id === googleAi.actionId), false);
assert.deepEqual(googleAiApplied.observations.ownerData.matchedActionIds, [googleAi.actionId]);
assert.equal(googleAiApplied.ownerDataEvidence[0].independentEvidence, false);
assert.equal(googleAiApplied.ownerDataEvidence[0].crossSurfaceInference, false);
assert.equal(googleAiApplied.ownerDataEvidence[0].rankingImpactClaimed, false);

const wrongKind = record('growth:google-generative-ai-measurement-global', 'google-search-console', 'search-performance');
assert.equal(
  applyOwnerDataEvidence(basePlan, receipt([wrongKind]), { now }).actions.some(item => item.id === wrongKind.actionId),
  true,
  'standard Search performance must not masquerade as generative-AI performance'
);

const crossProvider = record('growth:bing-ai-citation-measurement', 'google-search-console', 'ai-performance');
assert.equal(
  applyOwnerDataEvidence(basePlan, receipt([crossProvider]), { now }).actions.some(item => item.id === crossProvider.actionId),
  true,
  'Google owner data must not close Bing owner-data actions'
);

const includedControl = record(
  'trend-owner:google-generative-ai-control-global',
  'google-search-console',
  'generative-ai-inclusion-control',
  'owner-state',
  { value: 'included', dataThrough: undefined }
);
const includedApplied = applyOwnerDataEvidence(basePlan, receipt([includedControl]), { now });
assert.equal(includedApplied.actions.some(item => item.id === includedControl.actionId), false);

const excludedControl = { ...includedControl, value: 'excluded' };
assert.equal(
  applyOwnerDataEvidence(basePlan, receipt([excludedControl]), { now }).actions.some(item => item.id === excludedControl.actionId),
  true,
  'an excluded control is observed state but not completion of the inclusion goal'
);

const staleAi = { ...googleAi, observedAt: '2026-06-01T09:40:05Z', dataThrough: '2026-06-01' };
assert.equal(
  applyOwnerDataEvidence(basePlan, receipt([staleAi]), { now }).actions.some(item => item.id === staleAi.actionId),
  true,
  'stale owner data must not close current measurement work'
);

const invalidClass = parseOwnerDataReceipt(receipt([googleAi], { evidenceClass: 'independent' }), { canonicalUrl: basePlan.canonicalUrl, now });
assert.equal(invalidClass.valid, false);
assert.ok(invalidClass.issues.includes('evidence-class-must-be-owner-data'));

assert.ok(fs.existsSync('schema/growth-owner-data.schema.json'));
JSON.parse(fs.readFileSync('schema/growth-owner-data.schema.json', 'utf8'));
assert.ok(fs.existsSync('templates/growth/owner-data.json'));
JSON.parse(fs.readFileSync('templates/growth/owner-data.json', 'utf8'));

console.log('PASS Growth owner-data receipts are provider/kind/freshness scoped, ordinary GSC data cannot close AI actions, and optional opportunities stay outside active remediation');
