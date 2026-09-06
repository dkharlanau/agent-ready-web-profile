import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadTrendRegistry, validateTrendRegistry } from './trend-radar.mjs';
import { loadTrendWatchConfig } from './trend-source-watch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'trend-promotion-proposal.schema.json');

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateTrendPromotionBatch(batch) {
  const validate = createValidator();
  const valid = Boolean(validate(batch));
  return { valid, errors: validate.errors || [] };
}

export function loadTrendPromotionBatch(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function safeCandidate(candidate, source) {
  const url = candidate.url || source.canonicalPage || source.url;
  const publishedAt = candidate.publishedAt || new Date().toISOString();
  return {
    sourceId: candidate.sourceId,
    type: candidate.type || 'source-change',
    title: candidate.title ?? null,
    summary: candidate.summary ?? null,
    url,
    publishedAt: iso(publishedAt)
  };
}

export function buildTrendPromotionProposals(watchReport, registry = loadTrendRegistry(), config = loadTrendWatchConfig(), options = {}) {
  const registryValidation = validateTrendRegistry(registry);
  if (!registryValidation.valid) throw new Error(`Invalid Trend Radar registry: ${registryValidation.errors.join('; ')}`);
  if (!watchReport || !Array.isArray(watchReport.candidates)) throw new Error('A Trend source-watch report with candidates is required.');
  if (!watchReport.generatedAt || !watchReport.reviewedThrough) throw new Error('Source-watch generatedAt and reviewedThrough are required.');

  const sources = new Map((config.sources || []).map(item => [item.id, item]));
  const trends = new Map((registry.trends || []).map(item => [item.id, item]));
  const proposals = new Map();

  for (const candidate of watchReport.candidates) {
    const source = sources.get(candidate.sourceId);
    if (!source) continue;
    const targetIds = Array.isArray(source.trendIds) ? source.trendIds : [];
    for (const trendId of targetIds) {
      const trend = trends.get(trendId);
      if (!trend || trend.stage !== 'watch') continue;
      const id = `promote:${trend.id}:${watchReport.reviewedThrough}`;
      if (!proposals.has(id)) {
        proposals.set(id, {
          id,
          trendId: trend.id,
          provider: trend.provider,
          currentStage: 'watch',
          proposedStage: 'adopt',
          status: 'review-required',
          rationale: `Primary-source monitoring found evidence newer than the reviewed-through date for a WATCH trend. Review the upstream change, applicability, maturity and linked Growth actions before any stage change.`,
          primarySource: trend.source,
          evidenceCandidates: [],
          affectedActionRefs: [...(trend.actionRefs || [])],
          affectedMeasurementRefs: [...(trend.measurementRefs || [])],
          review: { decision: 'pending' }
        });
      }
      const proposal = proposals.get(id);
      const evidence = safeCandidate(candidate, source);
      const key = `${evidence.sourceId}|${evidence.url}|${evidence.publishedAt}`;
      if (!proposal.evidenceCandidates.some(item => `${item.sourceId}|${item.url}|${item.publishedAt}` === key)) proposal.evidenceCandidates.push(evidence);
    }
  }

  const batch = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/trend-promotion-proposal.schema.json',
    version: '0.1',
    generatedAt: iso(options.generatedAt),
    sourceWatch: { generatedAt: iso(watchReport.generatedAt), reviewedThrough: watchReport.reviewedThrough },
    proposals: [...proposals.values()].sort((a, b) => a.trendId.localeCompare(b.trendId)),
    guardrails: {
      candidateIsNotRecommendation: true,
      approvalDoesNotMutateRegistry: true,
      promotionRequiresReview: true,
      noRankingInference: true
    }
  };
  const validation = validateTrendPromotionBatch(batch);
  if (!validation.valid) throw new Error(`Generated Trend promotion batch is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return batch;
}

export function reviewTrendPromotion(batch, proposalId, decision, options = {}) {
  const validation = validateTrendPromotionBatch(batch);
  if (!validation.valid) throw new Error('Cannot review an invalid Trend promotion batch.');
  if (!['approve', 'reject', 'defer'].includes(decision)) throw new Error('decision must be approve, reject or defer.');
  if (!options.reviewer) throw new Error('reviewer is required.');
  const next = structuredClone(batch);
  const proposal = next.proposals.find(item => item.id === proposalId);
  if (!proposal) throw new Error(`Unknown proposal: ${proposalId}`);
  proposal.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'deferred';
  proposal.review = {
    decision,
    reviewer: String(options.reviewer),
    reviewedAt: iso(options.reviewedAt),
    ...(options.note ? { note: String(options.note) } : {})
  };
  const result = validateTrendPromotionBatch(next);
  if (!result.valid) throw new Error(`Reviewed Trend promotion batch is invalid: ${result.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return next;
}

export function summarizeTrendPromotions(batch) {
  return {
    total: batch.proposals.length,
    reviewRequired: batch.proposals.filter(item => item.status === 'review-required').length,
    approved: batch.proposals.filter(item => item.status === 'approved').length,
    rejected: batch.proposals.filter(item => item.status === 'rejected').length,
    deferred: batch.proposals.filter(item => item.status === 'deferred').length
  };
}

export function formatTrendPromotions(batch) {
  const summary = summarizeTrendPromotions(batch);
  const lines = [
    `ARWP Trend promotion proposals`,
    `Source watch: ${batch.sourceWatch.reviewedThrough}`,
    `Proposals: ${summary.total}; review required: ${summary.reviewRequired}; approved: ${summary.approved}; rejected: ${summary.rejected}; deferred: ${summary.deferred}`,
    ''
  ];
  for (const item of batch.proposals) {
    lines.push(`${item.status.toUpperCase()} ${item.trendId}: ${item.currentStage.toUpperCase()} -> ${item.proposedStage.toUpperCase()}`);
    lines.push(`  Evidence candidates: ${item.evidenceCandidates.length}; source: ${item.primarySource}`);
    if (item.affectedActionRefs.length) lines.push(`  Affected actions: ${item.affectedActionRefs.join(', ')}`);
    if (item.review.decision !== 'pending') lines.push(`  Review: ${item.review.decision} by ${item.review.reviewer}`);
  }
  lines.push('', 'Approval is an explicit review record only. It does not mutate registry/trends.json or prove that adoption improves ranking, citation or recommendation outcomes.');
  return lines.join('\n');
}
