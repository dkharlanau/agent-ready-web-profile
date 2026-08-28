import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReviewCards } from './ground-truth-review.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'results', '2026-08-28-r4-ground-truth-review-queue.json'), 'utf8'));
const receipts = JSON.parse(fs.readFileSync(path.join(ROOT, 'reviews', 'semantic-review-v0.2.json'), 'utf8'));
const cards = buildReviewCards(queue, receipts, path.join(ROOT, 'corpus'));

assert.equal(cards.length, 5);
assert.deepEqual(cards.map(card => `${card.site_id}:${card.intent}`), [
  'fastmcp-docs:agent',
  'langchain-docs:agent',
  'mintlify-docs:structured',
  'perplexity-docs:agent',
  'pinecone-docs:agent'
]);

for (const card of cards) {
  assert.deepEqual(card.frozen_truth.accepted, []);
  assert.equal(card.review_policy.current_benchmark_result_remains_frozen, true);
  assert.equal(card.review_policy.automatic_ground_truth_change_allowed, false);
  assert.ok(card.frozen_truth.fixture_blob_sha);
  assert.ok(card.frozen_truth.semantic_reviewed_at);
  assert.ok(card.frozen_truth.evidence_basis.length > 0);
  assert.ok(card.live_signal_under_review.conventional_probe);
  assert.equal(
    new URL(card.live_signal_under_review.conventional_probe).origin,
    new URL(card.site_url).origin
  );
}

const a2a = cards.filter(card => card.live_signal_under_review.protocol === 'A2A');
assert.equal(a2a.length, 4);
assert.ok(a2a.every(card => card.live_signal_under_review.conventional_probe.endsWith('/.well-known/agent-card.json')));

const apiCatalog = cards.find(card => card.site_id === 'mintlify-docs');
assert.equal(apiCatalog.live_signal_under_review.protocol, 'RFC9727');
assert.ok(apiCatalog.live_signal_under_review.conventional_probe.endsWith('/.well-known/api-catalog'));

console.log('PASS re-review cards preserve frozen expectations and assemble prior review receipts without mutation capability');
