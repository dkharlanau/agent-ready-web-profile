import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateSiteStateGraph } from './repository-mapper.mjs';

export const FRESHNESS_INTEGRITY_VERSION = '0.1';
export const FRESHNESS_MAX_SITEMAP_ENTRIES = 50000;

const GOOGLE_SITEMAP_SOURCE = 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap';
const W3C_LASTMOD = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const snapshotSchemaPath = path.join(root, 'schema', 'freshness-snapshot.schema.json');
const comparisonSchemaPath = path.join(root, 'schema', 'freshness-comparison.schema.json');

function compileSchema(file) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function validateFreshnessSnapshot(snapshot) {
  const validate = compileSchema(snapshotSchemaPath);
  const valid = Boolean(validate(snapshot));
  return { valid, errors: validate.errors || [] };
}

export function validateFreshnessComparison(comparison) {
  const validate = compileSchema(comparisonSchemaPath);
  const valid = Boolean(validate(comparison));
  return { valid, errors: validate.errors || [] };
}

function digest(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function decodeXml(value) {
  return String(value || '').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, token => {
    const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    const lower = token.toLowerCase();
    if (named[lower]) return named[lower];
    const number = lower.startsWith('&#x') ? parseInt(lower.slice(3, -1), 16) : parseInt(lower.slice(2, -1), 10);
    return Number.isInteger(number) && number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number)
      : '\ufffd';
  });
}

function validW3cLastmod(value) {
  if (!W3C_LASTMOD.test(String(value || ''))) return false;
  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const calendar = new Date(`${datePart}T00:00:00Z`);
  if (Number.isNaN(calendar.getTime())) return false;
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) return false;
  return !Number.isNaN(Date.parse(value));
}

export function parseLeafSitemap(xml) {
  const text = String(xml || '');
  if (Buffer.byteLength(text, 'utf8') > 50 * 1024 * 1024) throw new Error('Sitemap exceeds the 50 MiB XML sitemap limit supported by this bounded tool.');
  if (/<sitemapindex\b/i.test(text)) throw new Error('A sitemap index is not a leaf urlset. Build one freshness snapshot per final urlset sitemap.');
  if (!/<urlset\b/i.test(text)) throw new Error('Freshness snapshot requires an XML urlset sitemap.');
  const entries = [];
  const seen = new Set();
  for (const match of text.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const body = match[1];
    const rawLoc = body.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
    if (!rawLoc) throw new Error('Sitemap url entry is missing loc.');
    const url = normalizeUrl(decodeXml(rawLoc));
    if (!url) throw new Error(`Sitemap loc must be an absolute credential-free HTTPS URL: ${decodeXml(rawLoc).slice(0, 200)}`);
    if (seen.has(url)) throw new Error(`Duplicate sitemap loc: ${url}`);
    seen.add(url);
    const rawLastmod = body.match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim();
    const lastmod = rawLastmod ? decodeXml(rawLastmod) : null;
    const lastmodState = lastmod == null ? 'missing' : validW3cLastmod(lastmod) ? 'valid' : 'invalid';
    entries.push({ url, lastmod, lastmodState });
    if (entries.length > FRESHNESS_MAX_SITEMAP_ENTRIES) throw new Error(`Sitemap exceeds ${FRESHNESS_MAX_SITEMAP_ENTRIES} URL entries.`);
  }
  return entries;
}

function mappedBuildInputs(graph, route) {
  if (!route || route.state !== 'resolved' || !route.ownerPath) {
    return { ownerPath: null, ownerSha256: null, paths: [], buildDigest: null, coverage: 'unavailable', evidence: [] };
  }
  const files = new Map((graph.files || []).map(file => [file.path, file]));
  const owner = files.get(route.ownerPath);
  const paths = [...new Set([...(route.buildPath || []), route.ownerPath])].sort();
  const missing = paths.filter(item => !files.has(item));
  if (!owner || missing.length) {
    return {
      ownerPath: route.ownerPath,
      ownerSha256: owner?.sha256 || null,
      paths,
      buildDigest: null,
      coverage: 'partial',
      evidence: [
        ...(owner ? [] : [`missing-owner-file:${route.ownerPath}`]),
        ...missing.slice(0, 20).map(item => `missing-build-input:${item}`)
      ]
    };
  }
  const material = paths.map(item => `${item}\n${files.get(item).sha256}`).join('\n--\n');
  return {
    ownerPath: route.ownerPath,
    ownerSha256: owner.sha256,
    paths,
    buildDigest: digest(material),
    coverage: 'complete',
    evidence: paths.map(item => `mapped-build-input:${item}`)
  };
}

export function buildFreshnessSnapshot(siteStateGraph, sitemapXml, options = {}) {
  const graphValidation = validateSiteStateGraph(siteStateGraph);
  if (!graphValidation.valid) throw new Error(`Invalid Site State Graph: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const sitemapEntries = parseLeafSitemap(sitemapXml);
  const routeMap = new Map();
  for (const route of siteStateGraph.routes || []) {
    const url = route.url ? normalizeUrl(route.url) : null;
    if (!url) continue;
    if (routeMap.has(url)) throw new Error(`Site State Graph exposes more than one route for ${url}; freshness mapping must stay ambiguous rather than choose one.`);
    routeMap.set(url, route);
  }
  const entries = sitemapEntries.map(item => {
    const route = routeMap.get(item.url) || null;
    const mapped = mappedBuildInputs(siteStateGraph, route);
    const routeState = route?.state || 'not-mapped';
    const evidence = [
      `sitemap-lastmod:${item.lastmodState}`,
      route ? `site-state-route:${route.id}` : 'site-state-route:not-mapped',
      ...mapped.evidence
    ];
    return {
      url: item.url,
      lastmod: item.lastmod,
      lastmodState: item.lastmodState,
      routeState,
      ownerPath: mapped.ownerPath,
      ownerSha256: mapped.ownerSha256,
      buildInputPaths: mapped.paths,
      buildInputDigestSha256: mapped.buildDigest,
      buildInputCoverage: mapped.coverage,
      evidence: [...new Set(evidence)].slice(0, 30)
    };
  });
  const summary = {
    sitemapEntries: entries.length,
    mappedRoutes: entries.filter(item => item.routeState === 'resolved').length,
    unmappedRoutes: entries.filter(item => item.routeState !== 'resolved').length,
    withLastmod: entries.filter(item => item.lastmodState !== 'missing').length,
    withoutLastmod: entries.filter(item => item.lastmodState === 'missing').length,
    invalidLastmod: entries.filter(item => item.lastmodState === 'invalid').length,
    completeBuildInputs: entries.filter(item => item.buildInputCoverage === 'complete').length,
    partialBuildInputs: entries.filter(item => item.buildInputCoverage !== 'complete').length
  };
  const snapshot = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/freshness-snapshot.schema.json',
    version: FRESHNESS_INTEGRITY_VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    site: { origin: siteStateGraph.site.origin, basePath: siteStateGraph.site.basePath },
    repository: {
      fullName: siteStateGraph.repository.fullName,
      baseRef: siteStateGraph.repository.baseRef,
      baseCommitSha: siteStateGraph.repository.baseCommitSha
    },
    sitemap: {
      source: String(options.sitemapSource || 'local-leaf-sitemap.xml'),
      sha256: digest(sitemapXml),
      entries: sitemapEntries.length
    },
    entries,
    summary,
    sources: [GOOGLE_SITEMAP_SOURCE],
    guardrails: {
      noRankingPromise: true,
      noRecrawlPromise: true,
      sourceDigestNotRenderedProof: true,
      mappingAmbiguityPreserved: true,
      significantChangeNeedsReview: true,
      noBuildTimestampInference: true
    }
  };
  const validation = validateFreshnessSnapshot(snapshot);
  if (!validation.valid) throw new Error(`Generated freshness snapshot is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return snapshot;
}

function snapshotRef(snapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    baseRef: snapshot.repository.baseRef,
    baseCommitSha: snapshot.repository.baseCommitSha,
    sitemapSha256: snapshot.sitemap.sha256
  };
}

function compareIdentity(before, after) {
  if (before.site.origin !== after.site.origin || before.site.basePath !== after.site.basePath) throw new Error('Freshness snapshots must describe the same site origin and basePath.');
  if (before.repository.fullName !== after.repository.fullName) throw new Error('Freshness snapshots must describe the same repository.');
}

function reviewAction(kind, priority, url, reason, verification) {
  return {
    id: `freshness:${kind}:${crypto.createHash('sha256').update(url).digest('hex').slice(0, 20)}`,
    priority,
    status: 'review',
    url,
    kind,
    reason,
    verification,
    source: GOOGLE_SITEMAP_SOURCE,
    doesNotProve: 'A freshness-integrity finding does not prove that Google ignored lastmod, delayed crawling, changed ranking, or changed Search/AI visibility.'
  };
}

export function compareFreshnessSnapshots(before, after, options = {}) {
  const beforeValidation = validateFreshnessSnapshot(before);
  const afterValidation = validateFreshnessSnapshot(after);
  if (!beforeValidation.valid) throw new Error(`Invalid before freshness snapshot: ${beforeValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  if (!afterValidation.valid) throw new Error(`Invalid after freshness snapshot: ${afterValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  compareIdentity(before, after);

  const beforeMap = new Map(before.entries.map(item => [item.url, item]));
  const afterMap = new Map(after.entries.map(item => [item.url, item]));
  const urls = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  const observations = [];
  const actions = [];

  for (const url of urls) {
    const left = beforeMap.get(url);
    const right = afterMap.get(url);
    if (!left) {
      observations.push({ url, state: 'added', beforeLastmod: null, afterLastmod: right.lastmod, ownerChanged: null, mappedInputsChanged: null, confidence: 'not-applicable', reason: 'URL is present only in the after sitemap snapshot.' });
      continue;
    }
    if (!right) {
      observations.push({ url, state: 'removed', beforeLastmod: left.lastmod, afterLastmod: null, ownerChanged: null, mappedInputsChanged: null, confidence: 'not-applicable', reason: 'URL is present only in the before sitemap snapshot.' });
      continue;
    }
    const comparable = left.lastmodState === 'valid' && right.lastmodState === 'valid'
      && left.routeState === 'resolved' && right.routeState === 'resolved'
      && left.buildInputCoverage === 'complete' && right.buildInputCoverage === 'complete'
      && left.ownerSha256 && right.ownerSha256 && left.buildInputDigestSha256 && right.buildInputDigestSha256;
    if (!comparable) {
      observations.push({
        url, state: 'unknown', beforeLastmod: left.lastmod, afterLastmod: right.lastmod,
        ownerChanged: null, mappedInputsChanged: null, confidence: 'low',
        reason: 'A valid lastmod plus complete resolved Repository Mapper owner/build-input evidence is required on both revisions; missing or ambiguous evidence remains unknown.'
      });
      continue;
    }
    const ownerChanged = left.ownerSha256 !== right.ownerSha256;
    const mappedInputsChanged = left.buildInputDigestSha256 !== right.buildInputDigestSha256;
    const lastmodChanged = Date.parse(left.lastmod) !== Date.parse(right.lastmod);
    if (lastmodChanged && !ownerChanged && !mappedInputsChanged) {
      const sameCommit = before.repository.baseCommitSha && before.repository.baseCommitSha === after.repository.baseCommitSha;
      const confidence = sameCommit ? 'high' : 'medium';
      const reason = sameCommit
        ? 'Sitemap lastmod changed even though the exact repository commit and all mapped route build inputs are unchanged.'
        : 'Sitemap lastmod changed while the route owner and every Repository Mapper build input remained byte-identical across the compared revisions.';
      observations.push({ url, state: 'lastmod-churn-candidate', beforeLastmod: left.lastmod, afterLastmod: right.lastmod, ownerChanged, mappedInputsChanged, confidence, reason });
      actions.push(reviewAction(
        'review-synthetic-lastmod', 'P1', url, reason,
        'Review the sitemap generator and the deployed page. Keep the newer lastmod only if a significant page change exists outside the currently mapped inputs; otherwise stop deriving lastmod from build/deploy time.'
      ));
      continue;
    }
    if (!lastmodChanged && (ownerChanged || mappedInputsChanged)) {
      const reason = ownerChanged
        ? 'The mapped route owner and/or another mapped route build input changed while sitemap lastmod stayed unchanged. The source change may be insignificant, so this requires review rather than automatic date mutation.'
        : 'At least one mapped route build input changed while sitemap lastmod stayed unchanged. The source change may be insignificant, so this requires review rather than automatic date mutation.';
      observations.push({ url, state: 'stale-lastmod-candidate', beforeLastmod: left.lastmod, afterLastmod: right.lastmod, ownerChanged, mappedInputsChanged, confidence: 'medium', reason });
      actions.push(reviewAction(
        'review-stale-lastmod', 'P2', url, reason,
        'Review the changed mapped inputs and rendered page. Update lastmod only if the change is significant to page content, structured data or links; do not change it for cosmetic/build-only edits.'
      ));
      continue;
    }
    if (lastmodChanged && (ownerChanged || mappedInputsChanged)) {
      observations.push({
        url, state: 'aligned-change', beforeLastmod: left.lastmod, afterLastmod: right.lastmod, ownerChanged, mappedInputsChanged, confidence: 'medium',
        reason: 'Sitemap lastmod and at least one mapped route input changed. This is mechanically aligned, but significance still requires page-level review.'
      });
      continue;
    }
    observations.push({
      url, state: 'unchanged', beforeLastmod: left.lastmod, afterLastmod: right.lastmod, ownerChanged, mappedInputsChanged, confidence: 'medium',
      reason: 'Sitemap lastmod, route owner and mapped build-input digest are unchanged.'
    });
  }

  const count = state => observations.filter(item => item.state === state).length;
  const comparison = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/freshness-comparison.schema.json',
    version: FRESHNESS_INTEGRITY_VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    site: `${before.site.origin}${before.site.basePath === '/' ? '/' : before.site.basePath}`,
    repository: before.repository.fullName,
    before: snapshotRef(before),
    after: snapshotRef(after),
    summary: {
      urls: observations.length,
      comparable: observations.filter(item => !['added', 'removed', 'unknown'].includes(item.state)).length,
      lastmodChurnCandidates: count('lastmod-churn-candidate'),
      staleLastmodCandidates: count('stale-lastmod-candidate'),
      alignedChanges: count('aligned-change'),
      unchanged: count('unchanged'),
      added: count('added'),
      removed: count('removed'),
      unknown: count('unknown')
    },
    observations,
    actions,
    sources: [GOOGLE_SITEMAP_SOURCE],
    guardrails: {
      noRankingPromise: true,
      noRecrawlPromise: true,
      digestEqualityNotRenderedProof: true,
      digestChangeNotSignificantChangeProof: true,
      unknownRemainsUnknown: true,
      noCompositeScore: true,
      negativeResultsPreserved: true
    }
  };
  const validation = validateFreshnessComparison(comparison);
  if (!validation.valid) throw new Error(`Generated freshness comparison is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return comparison;
}

export function formatFreshnessComparison(comparison) {
  const s = comparison.summary;
  const lines = [
    `Goose Freshness Integrity v${comparison.version} — ${comparison.site}`,
    `Comparable=${s.comparable}/${s.urls}; lastmod-churn=${s.lastmodChurnCandidates}; stale-lastmod=${s.staleLastmodCandidates}; aligned=${s.alignedChanges}; unchanged=${s.unchanged}; unknown=${s.unknown}`,
    'No freshness, ranking or recrawl score.',
    ''
  ];
  for (const item of comparison.actions.slice(0, 50)) lines.push(`${item.priority} REVIEW ${item.kind} — ${item.url}`);
  if (comparison.actions.length > 50) lines.push(`... ${comparison.actions.length - 50} more review action(s)`);
  lines.push('', 'Mapped source/build digests constrain implementation evidence only. Significant content change and Search outcomes remain separate review/measurement questions.');
  return lines.join('\n');
}
