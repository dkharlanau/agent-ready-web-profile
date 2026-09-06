import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const templateRoot = path.join(root, 'templates', 'growth');
const schemaPath = path.join(root, 'schema', 'growth-remediation-manifest.schema.json');

export const GROWTH_REMEDIATION_VERSION = '0.1';

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateGrowthRemediationManifest(manifest) {
  const validate = createValidator();
  const valid = Boolean(validate(manifest));
  return { valid, errors: validate.errors || [] };
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function sha256(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function safeTemplateRef(value) {
  if (typeof value !== 'string' || !value.startsWith('templates/growth/')) return null;
  const absolute = path.resolve(root, value);
  const relative = path.relative(templateRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  return { ref: value, absolute };
}

function implementationTarget(implementation = {}) {
  if (typeof implementation.file === 'string' && implementation.file) return { targetKind: 'file', target: implementation.file };
  if (typeof implementation.template === 'string' && implementation.template) return { targetKind: 'template', target: implementation.template };
  if (typeof implementation.url === 'string' && implementation.url) return { targetKind: 'url', target: implementation.url };
  if (typeof implementation.field === 'string' && implementation.field) return { targetKind: 'field', target: implementation.field };
  if (typeof implementation.surface === 'string' && implementation.surface) return { targetKind: 'surface', target: implementation.surface };
  return { targetKind: 'advisory' };
}

function disposition(action) {
  const implementation = action?.implementation || {};
  if (action?.status === 'external-owner-data' || String(action?.id || '').startsWith('trend-owner:')) return 'external-owner-review';
  if (action?.status === 'manual') return 'manual-review';
  if (typeof implementation.template === 'string' && implementation.template.startsWith('templates/') && !safeTemplateRef(implementation.template)) return 'blocked-unsafe-reference';
  if (implementation.file === '/robots.txt') return 'policy-review';
  if (typeof implementation.template === 'string' && implementation.template.endsWith('.jsonld')) return 'structured-data-proposal';
  if (typeof implementation.template === 'string') return 'template-proposal';
  if (typeof implementation.url === 'string') return 'external-link-proposal';
  return 'advisory';
}

function warningsFor(action, kind) {
  const warnings = [];
  if (kind === 'policy-review') warnings.push('robots-policy-must-reflect-publisher-rights-and-distribution-intent');
  if (kind === 'structured-data-proposal') warnings.push('structured-data-values-must-match-visible-real-world-identity-or-content');
  if (kind === 'template-proposal') warnings.push('template-content-is-a-starting-point-not-ready-to-publish-copy');
  if (kind === 'external-owner-review') warnings.push('authenticated-owner-state-cannot-be-inferred-or-changed-by-this-manifest');
  if (kind === 'manual-review') warnings.push('manual-editorial-or-governance-judgment-is-required');
  if (kind === 'external-link-proposal') warnings.push('external-platform-behavior-and-eligibility-must-be-verified-before-publication');
  if (kind === 'blocked-unsafe-reference') warnings.push('template-reference-is-outside-the-shipped-growth-template-boundary-or-does-not-exist');
  if (action?.implementation?.note) warnings.push('preserve-action-note-during-review');
  return [...new Set(warnings)];
}

function remediationItem(action) {
  const kind = disposition(action);
  const sourceImplementation = action?.implementation || {};
  const implementation = implementationTarget(sourceImplementation);
  if (typeof sourceImplementation.placement === 'string' && sourceImplementation.placement) implementation.placement = sourceImplementation.placement;
  if (typeof sourceImplementation.note === 'string' && sourceImplementation.note) implementation.note = sourceImplementation.note;

  if (typeof sourceImplementation.suggestedPolicy === 'string' && sourceImplementation.suggestedPolicy.trim()) {
    implementation.snippet = `${sourceImplementation.suggestedPolicy.trim()}\n`;
  }

  const template = safeTemplateRef(sourceImplementation.template);
  if (template) {
    const content = fs.readFileSync(template.absolute, 'utf8');
    implementation.templateRef = template.ref;
    implementation.templateSha256 = sha256(content);
    implementation.snippet = content;
  }

  const item = {
    actionId: String(action.id),
    priority: String(action.priority || 'P2'),
    lane: String(action.lane || 'governance'),
    title: String(action.title || action.id),
    status: String(action.status || 'recommended'),
    disposition: kind,
    automation: 'proposal-only',
    humanReviewRequired: true,
    reason: String(action.reason || ''),
    implementation,
    warnings: warningsFor(action, kind)
  };
  if (typeof action.source === 'string' && /^https:\/\//.test(action.source)) item.source = action.source;
  return item;
}

function summarize(items) {
  const byDisposition = {};
  let withSnippet = 0;
  for (const item of items) {
    byDisposition[item.disposition] = (byDisposition[item.disposition] || 0) + 1;
    if (item.implementation?.snippet) withSnippet += 1;
  }
  return { total: items.length, withSnippet, byDisposition };
}

export function buildGrowthRemediationManifest(plan, options = {}) {
  if (!plan || !Array.isArray(plan.actions)) throw new Error('A Growth plan with actions is required.');
  if (!/^https:\/\//.test(String(plan.canonicalUrl || ''))) throw new Error('Growth plan canonicalUrl must be a public HTTPS URL.');
  const items = plan.actions.map(remediationItem);
  const manifest = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/growth-remediation-manifest.schema.json',
    version: GROWTH_REMEDIATION_VERSION,
    generatedAt: iso(options.generatedAt),
    site: plan.canonicalUrl,
    profile: String(plan.profile || plan.growthProfileVersion || 'unknown'),
    summary: summarize(items),
    items,
    guardrails: {
      writesTargetRepository: false,
      requiresExplicitAuthorizationBeforeMutation: true,
      robotsPolicyNeedsHumanReview: true,
      structuredDataNeedsHumanReview: true,
      editorialContentNeedsHumanReview: true,
      externalOwnerControlsNeverAutomated: true,
      templatePlaceholdersRemainUnresolved: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateGrowthRemediationManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Generated remediation manifest is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  return manifest;
}

export function formatGrowthRemediationManifest(manifest) {
  const lines = [
    'ARWP Growth remediation manifest',
    `Site: ${manifest.site}`,
    `Items: ${manifest.summary.total}; snippets: ${manifest.summary.withSnippet}`,
    ''
  ];
  for (const item of manifest.items) {
    lines.push(`${item.priority} ${item.disposition.toUpperCase()} ${item.actionId}`);
    lines.push(`  ${item.title}`);
    if (item.implementation.target) lines.push(`  Target: ${item.implementation.target}`);
    if (item.implementation.templateRef) lines.push(`  Template: ${item.implementation.templateRef} (${item.implementation.templateSha256})`);
  }
  lines.push('', 'All items are proposal-only and require human review. The manifest never writes the target repository or authorizes robots, structured-data, editorial or external-owner changes.');
  return lines.join('\n');
}
