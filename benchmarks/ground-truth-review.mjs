#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_QUEUE = path.join(ROOT, 'results', '2026-08-28-r4-ground-truth-review-queue.json');
const REVIEW_RECEIPTS = path.join(ROOT, 'reviews', 'semantic-review-v0.2.json');
const CORPUS = path.join(ROOT, 'corpus');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function option(args, name, fallback = null) {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function conventionalProbe(siteUrl, sourceId) {
  const id = String(sourceId || '');
  let pathname = null;
  if (id.startsWith('a2a-agent-card:')) pathname = '/.well-known/agent-card.json';
  else if (id.startsWith('api-catalog:') || id.startsWith('api-catalog-link:')) pathname = '/.well-known/api-catalog';
  else if (id.startsWith('mcp-server-card:')) pathname = '/.well-known/mcp/server-card.json';
  else if (id.startsWith('agent-skills:')) pathname = '/.well-known/skills/';
  if (!pathname) return null;
  try {
    return new URL(pathname, siteUrl).toString();
  } catch {
    return null;
  }
}

export function buildReviewCards(queue, receipts, corpusRoot = CORPUS) {
  const receiptById = new Map((receipts.fixtures || []).map(item => [item.id, item]));
  return (queue.review_candidates || []).map(candidate => {
    const receipt = receiptById.get(candidate.site_id);
    if (!receipt) throw new Error(`${candidate.site_id}: missing semantic-review receipt`);
    const fixturePath = path.join(corpusRoot, receipt.file);
    const fixture = readJson(fixturePath);
    const frozenAccepted = fixture.accepted?.[candidate.intent];
    if (!Array.isArray(frozenAccepted)) {
      throw new Error(`${candidate.site_id}: fixture has no accepted.${candidate.intent} array`);
    }
    return {
      site_id: candidate.site_id,
      site_url: fixture.url,
      intent: candidate.intent,
      frozen_truth: {
        accepted: frozenAccepted,
        fixture_reviewed_at: fixture.reviewedAt || null,
        semantic_reviewed_at: receipt.reviewedAt || receipts.reviewedAt || null,
        receipt_status: receipt.status || null,
        fixture_blob_sha: receipt.blobSha || null,
        evidence_basis: receipt.evidenceBasis || [],
        fixture_note: fixture.note || null
      },
      live_signal_under_review: {
        protocol: candidate.protocol,
        kind: candidate.kind,
        source_id: candidate.source_id,
        source_authority: candidate.source_authority,
        same_origin_host: candidate.same_origin_host,
        conventional_probe: conventionalProbe(fixture.url, candidate.source_id)
      },
      review_policy: {
        current_benchmark_result_remains_frozen: true,
        automatic_ground_truth_change_allowed: false,
        allowed_outcomes: candidate.allowed_outcomes || [
          'resolver-error',
          'publisher-capability-drift',
          'ambiguous-or-insufficient'
        ],
        questions: [
          'Does the live standard resource belong to this publisher/target rather than merely documenting another system?',
          'Does it declare or lead to a usable interface for the benchmark intent?',
          'Is the interface stable and publisher-controlled enough to become reviewed ground truth?',
          'If the answer changed since the frozen review, what new publisher evidence justifies a new review revision?'
        ]
      }
    };
  });
}

function renderMarkdown(card) {
  const accepted = card.frozen_truth.accepted.length
    ? card.frozen_truth.accepted.map(item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n')
    : '- none (`correct-none`)';
  const evidence = card.frozen_truth.evidence_basis.length
    ? card.frozen_truth.evidence_basis.map(item => `- ${item}`).join('\n')
    : '- none recorded';
  return `# Ground-truth re-review: ${card.site_id} / ${card.intent}\n\n`
    + `## Frozen expectation\n\n${accepted}\n\n`
    + `Fixture reviewed: ${card.frozen_truth.fixture_reviewed_at || 'unknown'}  \n`
    + `Semantic receipt: ${card.frozen_truth.semantic_reviewed_at || 'unknown'} · ${card.frozen_truth.receipt_status || 'unknown'}  \n`
    + `Pinned fixture blob: ${card.frozen_truth.fixture_blob_sha || 'unknown'}\n\n`
    + `### Previous evidence basis\n\n${evidence}\n\n`
    + `## Live standard signal under review\n\n`
    + `- protocol: ${card.live_signal_under_review.protocol}\n`
    + `- kind: ${card.live_signal_under_review.kind}\n`
    + `- source: ${card.live_signal_under_review.source_id} (${card.live_signal_under_review.source_authority})\n`
    + `- same-origin host: ${card.live_signal_under_review.same_origin_host}\n`
    + `- conventional probe: ${card.live_signal_under_review.conventional_probe || 'n/a'}\n\n`
    + `## Review questions\n\n${card.review_policy.questions.map(question => `- ${question}`).join('\n')}\n\n`
    + `Allowed outcomes: ${card.review_policy.allowed_outcomes.join(' · ')}\n\n`
    + `> This card is read-only. The frozen benchmark remains unchanged until a separate reviewed ground-truth revision is committed.\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const queuePath = path.resolve(option(args, 'queue', DEFAULT_QUEUE));
  const site = option(args, 'site');
  const intent = option(args, 'intent');
  const format = option(args, 'format', 'json');
  if (!['json', 'markdown'].includes(format)) throw new Error('--format must be json or markdown');

  const queue = readJson(queuePath);
  const receipts = readJson(REVIEW_RECEIPTS);
  let cards = buildReviewCards(queue, receipts);
  if (site) cards = cards.filter(card => card.site_id === site);
  if (intent) cards = cards.filter(card => card.intent === intent);
  if (!cards.length) throw new Error('No ground-truth review cards matched the requested filters.');

  if (format === 'markdown') {
    process.stdout.write(cards.map(renderMarkdown).join('\n---\n\n'));
  } else {
    process.stdout.write(`${JSON.stringify({ version: '0.1', cards }, null, 2)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
