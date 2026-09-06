import assert from 'node:assert/strict';
import { buildTrendRadar, findTrend, loadTrendRegistry, validateTrendRegistry } from '../lib/trend-radar.mjs';

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

const cloudflare = findTrend('cloudflare-content-use-reference-enforcement', registry, { now: fixedNow });
assert.equal(cloudflare.stage, 'watch');
assert.equal(cloudflare.attentionState, 'early');

const retired = findTrend('google-faq-rich-result-retired', registry, { now: fixedNow });
assert.equal(retired.attentionState, 'retired');

console.log(`PASS trend-radar-test (${registry.trends.length} trends)`);
