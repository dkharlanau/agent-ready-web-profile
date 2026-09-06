import assert from 'node:assert/strict';
import { buildTrendRadar, findTrend, loadTrendRegistry, validateTrendRegistry } from '../lib/trend-radar.mjs';
import { ownerActionsFromTrends } from '../lib/growth-plan.mjs';

const registry = loadTrendRegistry();
const validation = validateTrendRegistry(registry);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(new Set(registry.trends.map(item => item.id)).size, registry.trends.length);

const fixedNow = new Date('2026-09-06T12:00:00Z');
const recent = buildTrendRadar(registry, { now: fixedNow, sinceDays: 30, includeRetired: false });
assert(recent.trends.some(item => item.id === 'openai-publisher-agent-guidance-refresh'));
assert(recent.trends.some(item => item.id === 'google-preferred-sources-custom-button'));
assert(recent.trends.every(item => item.daysSinceDetected <= 30));
assert(recent.trends.every(item => item.stage !== 'retired'));

const openai = buildTrendRadar(registry, { now: fixedNow, provider: 'openai' });
assert(openai.trends.length >= 1);
assert(openai.trends.every(item => item.provider === 'openai'));

const editorial = buildTrendRadar(registry, { now: fixedNow, vertical: 'editorial', stage: 'adopt' });
assert(editorial.trends.length >= 3);
assert(editorial.trends.every(item => item.stage === 'adopt'));
assert(editorial.trends.every(item => item.appliesTo.includes('editorial')));

const googleControls = buildTrendRadar(registry, { now: fixedNow, provider: 'google', stage: 'adopt', vertical: 'general' });
const ownerActions = ownerActionsFromTrends(googleControls);
const aiControl = ownerActions.find(item => item.id === 'trend-owner:google-generative-ai-control-global');
assert(aiControl, 'Google Search generative AI control must become an owner-side Growth action');
assert.equal(aiControl.priority, 'P1');
assert.equal(aiControl.lane, 'ai-access');
assert.equal(aiControl.status, 'external-owner-data');
assert.match(aiControl.reason, /authenticated owner-side state/i);
assert.match(aiControl.source, /^https:\/\/support\.google\.com\//);

const cloudflare = findTrend('cloudflare-content-use-reference-enforcement', registry, { now: fixedNow });
assert.equal(cloudflare.stage, 'watch');
assert.equal(cloudflare.attentionState, 'early');

const retired = findTrend('google-faq-rich-result-retired', registry, { now: fixedNow });
assert.equal(retired.attentionState, 'retired');

console.log(`PASS trend-radar-test (${registry.trends.length} trends, ${ownerActions.length} owner-side platform control action(s))`);
