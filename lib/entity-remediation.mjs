import fs from 'node:fs';
import path from 'node:path';

export const ENTITY_REMEDIATION_VERSION = '0.1';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.next', '.cache', 'coverage']);
const STRUCTURED_EXTS = new Set(['.json', '.jsonld']);
const HTML_EXTS = new Set(['.html', '.htm']);
const TEXT_EXTS = new Set(['.md', '.markdown', '.txt']);
const RELATION_KEYS = ['about','author','brand','creator','hasPart','inDefinedTermSet','isPartOf','isRelatedTo','itemOffered','mainEntity','maintainer','mentions','organizer','provider','publisher','subjectOf','workFeatured'];
const TYPE_FAMILY = {
  Person:'Person', Organization:'Organization', Corporation:'Organization', LocalBusiness:'Organization',
  Product:'Product', ProductGroup:'Product', SoftwareApplication:'Software', WebApplication:'Software', MobileApplication:'Software',
  Service:'Service', Dataset:'Dataset', DefinedTerm:'DefinedTerm', Article:'Article', TechArticle:'Article', BlogPosting:'Article',
  NewsArticle:'Article', ScholarlyArticle:'Article'
};

const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const pointerEscape = value => String(value).replace(/~/g, '~0').replace(/\//g, '~1');

export function validateEntityRemediationManifest(manifest) {
  const errors = [];
  const dispositions = new Set(['grounded-json-patch-proposal','grounded-structured-data-proposal','verify-deployment','content-review','entity-page-review','relationship-review','identity-review','missing-evidence-review','advisory']);
  if (!manifest || typeof manifest !== 'object') errors.push({ path: '/', message: 'manifest must be an object' });
  else {
    if (manifest.version !== ENTITY_REMEDIATION_VERSION) errors.push({ path: '/version', message: `must equal ${ENTITY_REMEDIATION_VERSION}` });
    if (!/^https:\/\//.test(String(manifest.site || ''))) errors.push({ path: '/site', message: 'must be an HTTPS URL' });
    if (!Array.isArray(manifest.items)) errors.push({ path: '/items', message: 'must be an array' });
    else for (const [index, item] of manifest.items.entries()) {
      if (!dispositions.has(item.disposition)) errors.push({ path: `/items/${index}/disposition`, message: 'unsupported disposition' });
      if (item.automation !== 'proposal-only') errors.push({ path: `/items/${index}/automation`, message: 'must be proposal-only' });
      if (item.humanReviewRequired !== true) errors.push({ path: `/items/${index}/humanReviewRequired`, message: 'must be true' });
      if (!Array.isArray(item.evidence) || !Array.isArray(item.warnings)) errors.push({ path: `/items/${index}`, message: 'evidence and warnings must be arrays' });
    }
    if (manifest.guardrails?.writesTargetRepository !== false || manifest.guardrails?.appliesPatches !== false) errors.push({ path: '/guardrails', message: 'manifest must remain non-mutating' });
    if (!Array.isArray(manifest.doesNotProve)) errors.push({ path: '/doesNotProve', message: 'must be an array' });
  }
  return { valid: errors.length === 0, errors };
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function familyFromTypes(types) {
  for (const type of arr(types).map(String)) {
    if (TYPE_FAMILY[type]) return TYPE_FAMILY[type];
    if (/Event$/.test(type)) return 'Event';
  }
  return null;
}

function canonicalFromHtml(html, fallback = null) {
  const match = String(html || '').match(/<link\b[^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i)
    || String(html || '').match(/<link\b[^>]*\bhref\s*=\s*["'][^"']+["'][^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i);
  if (!match) return fallback;
  const href = match[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href) return fallback;
  try { return new URL(href, fallback || undefined).href; } catch { return fallback; }
}

function visibleText(html) {
  return norm(String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function flattenObjects(value, pointer = '') {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenObjects(item, `${pointer}/${index}`));
  const out = [{ pointer, object: value }];
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') out.push(...flattenObjects(child, `${pointer}/${pointerEscape(key)}`));
  }
  return out;
}

function parseHtmlJsonLd(text, file) {
  const records = [];
  const errors = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 0;
  while ((match = re.exec(text))) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1])) continue;
    try {
      const parsed = JSON.parse(match[2]);
      for (const item of flattenObjects(parsed, '')) records.push({ file, format: 'html-jsonld', pointer: `/script/${scriptIndex}${item.pointer}`, object: item.object });
    } catch (error) {
      errors.push({ file, message: `Invalid JSON-LD: ${error.message}` });
    }
    scriptIndex += 1;
  }
  return { records, errors };
}

function safeWalk(repoRoot, { maxFiles = 500, maxFileBytes = 1024 * 1024 } = {}) {
  const rootPath = path.resolve(repoRoot);
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) throw new Error(`repoRoot must be an existing directory: ${rootPath}`);
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 5000) throw new Error('maxFiles must be an integer between 1 and 5000.');
  if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1024 || maxFileBytes > 10 * 1024 * 1024) throw new Error('maxFileBytes must be between 1024 and 10485760.');

  const files = [];
  const stack = [rootPath];
  while (stack.length && files.length < maxFiles) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= maxFiles) break;
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(rootPath, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (![...STRUCTURED_EXTS, ...HTML_EXTS, ...TEXT_EXTS].includes(ext)) continue;
      const size = fs.statSync(absolute).size;
      if (size > maxFileBytes) continue;
      files.push({ absolute, relative, ext, size });
    }
  }
  return { rootPath, files, truncated: files.length >= maxFiles, maxFiles, maxFileBytes };
}

function normalizeRecord(file, format, pointer, object, extra = {}) {
  const id = typeof object?.['@id'] === 'string' ? object['@id'] : null;
  const name = typeof object?.name === 'string' ? object.name.trim() : null;
  const types = arr(object?.['@type']).map(String);
  return { file, format, pointer, object, id, name, types, family: familyFromTypes(types), ...extra };
}

export function scanRepositoryEntityEvidence(repoRoot, options = {}) {
  const walk = safeWalk(repoRoot, options);
  const records = [];
  const texts = [];
  const parseErrors = [];
  for (const file of walk.files) {
    const text = fs.readFileSync(file.absolute, 'utf8');
    if (STRUCTURED_EXTS.has(file.ext)) {
      try {
        const parsed = JSON.parse(text);
        for (const item of flattenObjects(parsed, '')) records.push(normalizeRecord(file.relative, 'json', item.pointer, item.object));
      } catch (error) {
        parseErrors.push({ file: file.relative, message: `Invalid JSON: ${error.message}` });
      }
      continue;
    }
    if (HTML_EXTS.has(file.ext)) {
      const canonicalUrl = canonicalFromHtml(text, null);
      const parsed = parseHtmlJsonLd(text, file.relative);
      records.push(...parsed.records.map(record => normalizeRecord(record.file, record.format, record.pointer, record.object, { canonicalUrl })));
      parseErrors.push(...parsed.errors);
      texts.push({ file: file.relative, format: 'html', canonicalUrl, text: visibleText(text) });
      continue;
    }
    texts.push({ file: file.relative, format: 'text', canonicalUrl: null, text: norm(text) });
  }
  return {
    repoRoot: walk.rootPath,
    filesScanned: walk.files.length,
    truncated: walk.truncated,
    maxFiles: walk.maxFiles,
    maxFileBytes: walk.maxFileBytes,
    records,
    texts,
    parseErrors
  };
}

function entityForGap(report, gap) {
  return (report.entities || []).find(entity => entity.id === gap.entityId)
    || { id: gap.entityId, family: gap.family, name: gap.entityName, declaredUrls: [], sourcePages: gap.evidence || [] };
}

function recordStrength(record, entity) {
  if (record.id && entity.id && record.id === entity.id) return 'exact-id';
  if (record.name && entity.name && norm(record.name) === norm(entity.name) && (!record.family || !entity.family || record.family === entity.family)) return 'name-family';
  return null;
}

function matchingRecords(repo, entity) {
  if (!repo) return [];
  const exact = repo.records.filter(record => recordStrength(record, entity) === 'exact-id');
  if (exact.length) return exact.map(record => ({ ...record, matchStrength: 'exact-id' }));
  const byName = repo.records.filter(record => recordStrength(record, entity) === 'name-family');
  if (byName.length === 1) return [{ ...byName[0], matchStrength: 'unique-name-family' }];
  return [];
}

function propertyKeysFromGap(gap) {
  const match = String(gap.id || '').match(/^property:[^:]+:([^:]+):/);
  return match ? match[1].split('|').filter(Boolean) : [];
}

function hasValue(object, key) {
  const value = object?.[key];
  return value != null && (!Array.isArray(value) || value.length > 0) && value !== '';
}

function repoEvidence(record, extra = {}) {
  return { file: record.file, format: record.format, pointer: record.pointer || '/', matchStrength: record.matchStrength || null, ...extra };
}

function jsonTarget(records, key) {
  return records.find(record => record.format === 'json' && !hasValue(record.object, key)) || null;
}

function htmlTarget(records, key) {
  return records.find(record => record.format === 'html-jsonld' && !hasValue(record.object, key)) || null;
}

function proposalBase(gap, entity, disposition) {
  return {
    gapId: String(gap.id),
    priority: String(gap.priority || 'P2'),
    family: String(gap.family || entity.family || 'Unknown'),
    entityId: String(gap.entityId || entity.id || ''),
    entityName: gap.entityName || entity.name || null,
    problem: String(gap.problem || ''),
    recommendation: String(gap.recommendation || ''),
    disposition,
    automation: 'proposal-only',
    humanReviewRequired: true,
    evidence: [],
    warnings: []
  };
}

function addWarning(item, warning) {
  if (!item.warnings.includes(warning)) item.warnings.push(warning);
}

function propertyRemediation(gap, entity, repo) {
  const keys = propertyKeysFromGap(gap);
  const item = proposalBase(gap, entity, 'missing-evidence-review');
  if (!keys.length || !repo) {
    addWarning(item, 'no-grounded-first-party-value-observed');
    return item;
  }
  const records = matchingRecords(repo, entity);
  for (const key of keys) {
    const source = records.find(record => hasValue(record.object, key));
    if (!source) continue;
    const value = source.object[key];
    item.evidence.push(repoEvidence(source, { property: key, value }));
    const targetJson = jsonTarget(records, key);
    if (targetJson && (targetJson.file !== source.file || targetJson.pointer !== source.pointer)) {
      item.disposition = 'grounded-json-patch-proposal';
      item.target = { file: targetJson.file, format: targetJson.format, pointer: targetJson.pointer || '/' };
      item.proposal = {
        type: 'json-patch',
        operations: [{ op: 'add', path: `${targetJson.pointer || ''}/${pointerEscape(key)}` || `/${pointerEscape(key)}`, value }]
      };
      addWarning(item, 'apply-only-after-visible-content-and-identity-parity-review');
      return item;
    }
    const targetHtml = htmlTarget(records, key);
    if (targetHtml && (targetHtml.file !== source.file || targetHtml.pointer !== source.pointer)) {
      item.disposition = 'grounded-structured-data-proposal';
      item.target = { file: targetHtml.file, format: targetHtml.format, pointer: targetHtml.pointer || '/' };
      item.proposal = { type: 'structured-data-property', property: key, value };
      addWarning(item, 'html-jsonld-edit-is-never-applied-automatically');
      return item;
    }
    item.disposition = 'verify-deployment';
    item.proposal = { type: 'verification', check: `Repository evidence already contains ${key}; verify the deployed canonical page and build pipeline.` };
    addWarning(item, 'repository-state-and-deployed-state-appear-to-differ');
    return item;
  }
  addWarning(item, 'no-grounded-first-party-value-observed');
  return item;
}

function stableIdRemediation(gap, entity, repo) {
  const item = proposalBase(gap, entity, 'identity-review');
  const candidate = arr(entity.declaredUrls).find(url => /^https:\/\//.test(String(url || '')));
  if (!candidate || !repo) {
    addWarning(item, 'stable-id-must-be-chosen-from-real-canonical-identity');
    return item;
  }
  const records = matchingRecords(repo, entity).filter(record => !record.object?.['@id']);
  const target = records.find(record => record.format === 'json') || records.find(record => record.format === 'html-jsonld');
  if (!target) {
    item.disposition = 'verify-deployment';
    item.proposal = { type: 'verification', check: `Observed declared URL ${candidate}; locate the structured-data source that emits this entity before editing.` };
    return item;
  }
  item.evidence.push(repoEvidence(target, { declaredUrl: candidate }));
  item.target = { file: target.file, format: target.format, pointer: target.pointer || '/' };
  if (target.format === 'json') {
    item.disposition = 'grounded-json-patch-proposal';
    item.proposal = { type: 'json-patch', operations: [{ op: 'add', path: `${target.pointer || ''}/@id`, value: candidate }] };
  } else {
    item.disposition = 'grounded-structured-data-proposal';
    item.proposal = { type: 'structured-data-property', property: '@id', value: candidate };
    addWarning(item, 'html-jsonld-edit-is-never-applied-automatically');
  }
  addWarning(item, 'stable-id-choice-requires-human-identity-review');
  return item;
}

function visibleParityRemediation(gap, entity, repo) {
  const item = proposalBase(gap, entity, 'content-review');
  if (!repo || !entity.name) return item;
  const hits = repo.texts.filter(record => record.text.includes(norm(entity.name))).slice(0, 5);
  if (hits.length) {
    item.evidence.push(...hits.map(record => ({ file: record.file, format: record.format, canonicalUrl: record.canonicalUrl || null, matchStrength: 'visible-name-text' })));
    item.disposition = 'verify-deployment';
    item.proposal = { type: 'verification', check: 'Repository-visible text contains the entity name; verify which source builds the deployed page and whether the current deployment is stale.' };
    addWarning(item, 'repository-state-and-deployed-state-may-differ');
  } else addWarning(item, 'visible-first-party-content-must-be-authored-or-corrected-manually');
  return item;
}

function entityPageRemediation(gap, entity, repo) {
  const item = proposalBase(gap, entity, 'entity-page-review');
  if (!repo || !entity.name) return item;
  const declared = new Set(arr(entity.declaredUrls).filter(Boolean));
  const candidate = repo.texts.find(record => record.format === 'html' && record.canonicalUrl && declared.has(record.canonicalUrl) && record.text.includes(norm(entity.name)));
  if (candidate) {
    item.disposition = 'verify-deployment';
    item.evidence.push({ file: candidate.file, format: candidate.format, canonicalUrl: candidate.canonicalUrl, matchStrength: 'canonical-visible-entity-page' });
    item.proposal = { type: 'verification', check: 'A canonical visible entity page exists in repository evidence; verify deployment/discovery before creating another page.' };
  } else addWarning(item, 'do-not-create-thin-entity-page-only-for-schema');
  return item;
}

function orphanRemediation(gap, entity, repo) {
  const item = proposalBase(gap, entity, 'relationship-review');
  if (!repo) return item;
  const records = matchingRecords(repo, entity);
  for (const record of records) {
    const found = RELATION_KEYS.find(key => hasValue(record.object, key));
    if (!found) continue;
    item.disposition = 'verify-deployment';
    item.evidence.push(repoEvidence(record, { property: found, value: record.object[found] }));
    item.proposal = { type: 'verification', check: `Repository evidence already contains relation ${found}; verify deployed structured data.` };
    addWarning(item, 'repository-state-and-deployed-state-appear-to-differ');
    return item;
  }
  addWarning(item, 'relationship-target-must-be-grounded-before-adding-a-link');
  return item;
}

function remediationForGap(gap, report, repo) {
  const entity = entityForGap(report, gap);
  const id = String(gap.id || '');
  if (id.startsWith('property:')) return propertyRemediation(gap, entity, repo);
  if (id.startsWith('stable-id:')) return stableIdRemediation(gap, entity, repo);
  if (id.startsWith('visible-parity:')) return visibleParityRemediation(gap, entity, repo);
  if (id.startsWith('entity-page:')) return entityPageRemediation(gap, entity, repo);
  if (id.startsWith('orphan:')) return orphanRemediation(gap, entity, repo);
  if (id.startsWith('identity-conflict:')) {
    const item = proposalBase(gap, entity, 'identity-review');
    addWarning(item, 'conflicting-identity-must-be-resolved-before-automation');
    return item;
  }
  return proposalBase(gap, entity, 'advisory');
}

function summarize(items, repo) {
  const byDisposition = {};
  let withPatch = 0;
  let groundedByRepository = 0;
  for (const item of items) {
    byDisposition[item.disposition] = (byDisposition[item.disposition] || 0) + 1;
    if (item.proposal?.type === 'json-patch') withPatch += 1;
    if (item.evidence?.some(evidence => evidence.file)) groundedByRepository += 1;
  }
  return {
    total: items.length,
    withPatch,
    groundedByRepository,
    byDisposition,
    repository: repo ? { filesScanned: repo.filesScanned, truncated: repo.truncated, parseErrors: repo.parseErrors.length } : null
  };
}

export function buildEntityRemediationManifest(report, options = {}) {
  if (!report || report.scope !== 'bounded-observed-entity-graph-not-ranking-score' || !Array.isArray(report.gaps)) {
    throw new Error('A valid ARWP Entity Graph Gap Report is required.');
  }
  if (!/^https:\/\//.test(String(report.canonicalUrl || ''))) throw new Error('Gap report canonicalUrl must be a public HTTPS URL.');
  const repo = options.repoRoot ? scanRepositoryEntityEvidence(options.repoRoot, options) : null;
  const items = report.gaps.map(gap => remediationForGap(gap, report, repo));
  const manifest = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/entity-remediation-manifest.schema.json',
    version: ENTITY_REMEDIATION_VERSION,
    generatedAt: iso(options.generatedAt),
    site: report.canonicalUrl,
    sourceReport: {
      reportVersion: report.reportVersion || 'unknown',
      scope: report.scope,
      generatedAt: report.generatedAt || null,
      source: report.source || null,
      gaps: report.gaps.length
    },
    summary: summarize(items, repo),
    items,
    repositoryEvidence: repo ? {
      repoRoot: repo.repoRoot,
      filesScanned: repo.filesScanned,
      truncated: repo.truncated,
      parseErrors: repo.parseErrors
    } : null,
    guardrails: {
      writesTargetRepository: false,
      appliesPatches: false,
      repoScanReadOnly: true,
      allChangesProposalOnly: true,
      humanReviewRequired: true,
      groundedValuesRequireFirstPartyRepositoryEvidence: true,
      htmlAndMarkdownNeverAutoPatched: true,
      noInventedFacts: true,
      noInventedPeopleCredentialsRatingsReviewsPricesLicensesEventsOrRelationships: true,
      noRankingOrRichResultGuarantee: true
    },
    doesNotProve: [
      'that a proposed patch is semantically correct without human review',
      'that repository state matches the deployed website',
      'search ranking, rich-result eligibility, AI citation, or recommendation inclusion',
      'identity authority beyond the supplied first-party evidence',
      'that a missing fact should exist when the real-world relationship is absent'
    ]
  };
  const validation = validateEntityRemediationManifest(manifest);
  if (!validation.valid) throw new Error(`Generated entity remediation manifest is invalid: ${validation.errors.map(error => `${error.path || '/'} ${error.message}`).join('; ')}`);
  return manifest;
}

export function formatEntityRemediationManifest(manifest) {
  const lines = [
    'ARWP Entity Graph Remediation Manifest',
    `Site: ${manifest.site}`,
    `Items: ${manifest.summary.total}; grounded: ${manifest.summary.groundedByRepository}; JSON patch proposals: ${manifest.summary.withPatch}`,
    ''
  ];
  for (const item of manifest.items) {
    lines.push(`${item.priority} ${item.disposition.toUpperCase()} ${item.gapId}`);
    if (item.entityName) lines.push(`  Entity: ${item.entityName}`);
    if (item.target?.file) lines.push(`  Target: ${item.target.file}${item.target.pointer ? ` ${item.target.pointer}` : ''}`);
    if (item.proposal?.type) lines.push(`  Proposal: ${item.proposal.type}`);
    for (const evidence of item.evidence || []) if (evidence.file) lines.push(`  Evidence: ${evidence.file}${evidence.property ? ` (${evidence.property})` : ''}`);
  }
  lines.push('', 'No files are changed. Every item is proposal-only and requires human review before any repository mutation or deployment.');
  return lines.join('\n');
}
