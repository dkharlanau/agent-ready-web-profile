import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { tracePublicHttpsRedirects } from './public-redirect-trace.mjs';
import { fetchPublicText } from './public-fetch.mjs';
import { parseLeafSitemap } from './freshness-integrity.mjs';
import { validateSiteStateGraph } from './repository-mapper.mjs';
import { validateInternalDiscoveryReport } from './internal-discovery.mjs';

export const URL_MIGRATION_INTEGRITY_VERSION = '0.1';
export const URL_MIGRATION_MAX_PAIRS = 1000;
export const URL_MIGRATION_LIVE_MAX_PAIRS = 100;

const GOOGLE_MOVE_SOURCE = 'https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes';
const GOOGLE_CANONICAL_SOURCE = 'https://developers.google.com/search/docs/crawling-indexing/canonicalization';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'url-migration-integrity.schema.json');

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateUrlMigrationIntegrityReport(report) {
  const validate = validator();
  const valid = Boolean(validate(report));
  return { valid, errors: validate.errors || [] };
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeMigrationPairs(value) {
  const input = Array.isArray(value) ? value : value?.pairs;
  if (!Array.isArray(input) || !input.length) throw new Error('Migration manifest must contain a non-empty array of {oldUrl,newUrl} pairs.');
  if (input.length > URL_MIGRATION_MAX_PAIRS) throw new Error(`Migration manifest exceeds ${URL_MIGRATION_MAX_PAIRS} pairs.`);
  const seenOld = new Set();
  return input.map((item, index) => {
    const oldUrl = normalizeUrl(item?.oldUrl);
    const newUrl = normalizeUrl(item?.newUrl);
    if (!oldUrl || !newUrl) throw new Error(`Migration pair ${index + 1} must use absolute credential-free HTTPS oldUrl and newUrl.`);
    if (oldUrl === newUrl) throw new Error(`Migration pair ${index + 1} maps a URL to itself.`);
    if (seenOld.has(oldUrl)) throw new Error(`Duplicate oldUrl in migration manifest: ${oldUrl}`);
    seenOld.add(oldUrl);
    return { oldUrl, newUrl };
  });
}

function attributes(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[\w:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) {
    const key = match[1].toLowerCase();
    if (!(key in out)) out[key] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return out;
}

function canonicalFromHtml(html, base) {
  const head = String(html || '').match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const rel = String(attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes('canonical') || !attrs.href) continue;
    return normalizeUrl(new URL(attrs.href, base).href);
  }
  return null;
}

function noindexFromTarget(html, headers = {}) {
  const values = [String(headers?.xRobotsTag || '')];
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const name = String(attrs.name || '').toLowerCase();
    if (name === 'robots' || name === 'googlebot') values.push(String(attrs.content || ''));
  }
  return values.some(value => value.toLowerCase().split(/[,;]/).some(token => token.trim() === 'noindex'));
}

function isHtml(contentType) {
  const type = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  return type === 'text/html' || type === 'application/xhtml+xml';
}

function routeState(graph, url) {
  if (!graph) return 'not-provided';
  const matches = (graph.routes || []).filter(route => route.url && normalizeUrl(route.url) === url);
  if (!matches.length) return 'absent';
  if (matches.length > 1) return 'ambiguous';
  return matches[0].state;
}

function validateGraph(value, label) {
  if (!value) return null;
  const validation = validateSiteStateGraph(value);
  if (!validation.valid) throw new Error(`Invalid ${label} Site State Graph: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return value;
}

function repositoryObservation(beforeGraph, afterGraph, oldUrl, newUrl) {
  if (!beforeGraph && !afterGraph) {
    return { state: 'not-provided', beforeOld: 'not-provided', beforeNew: 'not-provided', afterOld: 'not-provided', afterNew: 'not-provided' };
  }
  return {
    state: 'observed',
    beforeOld: routeState(beforeGraph, oldUrl),
    beforeNew: routeState(beforeGraph, newUrl),
    afterOld: routeState(afterGraph, oldUrl),
    afterNew: routeState(afterGraph, newUrl)
  };
}

function sitemapObservation(sitemapSet, oldUrl, newUrl) {
  if (!sitemapSet) return { state: 'not-provided', oldPresent: null, newPresent: null };
  return { state: 'observed', oldPresent: sitemapSet.has(oldUrl), newPresent: sitemapSet.has(newUrl) };
}

function internalLinkObservation(report, oldUrl, newUrl) {
  if (!report) {
    return { state: 'not-provided', oldTargetEdges: null, sourceUrlsPreview: [], sourceUrlsPreviewTruncated: false, reason: 'No bounded Internal Discovery report was supplied.' };
  }
  const validation = validateInternalDiscoveryReport(report);
  if (!validation.valid) throw new Error(`Invalid Internal Discovery report: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const discoveryOrigin = new URL(report.canonicalUrl).origin;
  if (new URL(oldUrl).origin !== discoveryOrigin || new URL(newUrl).origin !== discoveryOrigin) {
    return {
      state: 'unknown',
      oldTargetEdges: null,
      sourceUrlsPreview: [],
      sourceUrlsPreviewTruncated: false,
      reason: 'The bounded Internal Discovery graph is same-origin. It cannot prove cleanup of links that cross from the new origin to an old migration origin.'
    };
  }
  const edges = (report.edges || []).filter(edge => normalizeUrl(edge.to) === oldUrl);
  const sources = [...new Set(edges.map(edge => edge.from))].sort();
  return {
    state: 'observed',
    oldTargetEdges: edges.length,
    sourceUrlsPreview: sources.slice(0, 20),
    sourceUrlsPreviewTruncated: sources.length > 20,
    reason: edges.length
      ? `${edges.length} bounded same-origin Internal Discovery edge(s) still target the old URL.`
      : 'No edge in the supplied bounded same-origin Internal Discovery report targets the old URL.'
  };
}

function unavailableTrace(oldUrl, error = 'Redirect trace was not supplied.') {
  return { state: 'unavailable', requestedUrl: oldUrl, finalUrl: null, finalStatus: null, redirectCount: null, hops: [], error: String(error).slice(0, 2000) };
}

function unavailableTarget(newUrl, error = 'Destination page observation was not supplied.') {
  return { state: 'unavailable', url: newUrl, status: null, finalUrl: null, contentType: null, html: null, canonical: null, noindex: null, error: String(error).slice(0, 2000) };
}

function normalizeTrace(value, oldUrl) {
  if (!value || value.state === 'unavailable') return unavailableTrace(oldUrl, value?.error);
  return {
    state: 'observed',
    requestedUrl: oldUrl,
    finalUrl: normalizeUrl(value.finalUrl),
    finalStatus: value.finalStatus ?? null,
    redirectCount: value.redirectCount ?? null,
    hops: (value.hops || []).map(hop => ({ url: normalizeUrl(hop.url), status: hop.status, location: hop.location ? normalizeUrl(hop.location) : null })),
    error: null
  };
}

function normalizeTarget(value, newUrl) {
  if (!value || value.state === 'unavailable') return unavailableTarget(newUrl, value?.error);
  return {
    state: 'observed',
    url: newUrl,
    status: value.status ?? null,
    finalUrl: value.finalUrl ? normalizeUrl(value.finalUrl) : newUrl,
    contentType: value.contentType || null,
    html: value.html ?? null,
    canonical: value.canonical ? normalizeUrl(value.canonical) : null,
    noindex: value.noindex ?? null,
    error: null
  };
}

function check(id, priority, status, message, source, evidence = []) {
  return { id, priority, status, message, source, evidence: [...new Set(evidence.filter(Boolean))].slice(0, 30) };
}

function checksForPair({ oldUrl, newUrl, trace, target, repository, sitemap, internalLinks }) {
  const checks = [];
  if (trace.state !== 'observed') {
    checks.push(check('redirect-destination', 'P1', 'unknown', 'Live redirect behavior from the old URL could not be observed.', GOOGLE_MOVE_SOURCE, [trace.error]));
    checks.push(check('redirect-directness', 'P2', 'unknown', 'Redirect permanence/directness cannot be evaluated without a live redirect trace.', GOOGLE_MOVE_SOURCE, [trace.error]));
  } else {
    const finalMatches = trace.redirectCount > 0 && trace.finalUrl === newUrl;
    checks.push(check(
      'redirect-destination',
      'P1',
      finalMatches ? 'pass' : 'fail',
      finalMatches
        ? `The old URL redirects to the declared new URL after ${trace.redirectCount} redirect hop(s).`
        : trace.redirectCount === 0
          ? 'The old URL did not redirect to the declared new URL.'
          : `The old URL resolves to ${trace.finalUrl || 'an unknown final URL'} instead of the declared new URL.`,
      GOOGLE_MOVE_SOURCE,
      trace.hops.map(hop => `${hop.status} ${hop.url}${hop.location ? ` -> ${hop.location}` : ''}`)
    ));
    if (!finalMatches) {
      checks.push(check('redirect-directness', 'P2', 'not-applicable', 'Permanence/directness is not graded because the redirect does not currently resolve to the declared new URL.', GOOGLE_MOVE_SOURCE));
    } else {
      const firstStatus = trace.hops[0]?.status;
      const permanent = firstStatus === 301 || firstStatus === 308;
      const direct = trace.redirectCount === 1;
      const status = direct && permanent ? 'pass' : 'watch';
      const message = direct && permanent
        ? `A direct server-side permanent ${firstStatus} redirect points to the declared new URL.`
        : !direct
          ? `The migration reaches the declared new URL through ${trace.redirectCount} redirects; Google recommends redirecting to the final destination directly when possible.`
          : `The redirect is direct but uses HTTP ${firstStatus}; Google recommends server-side permanent redirects such as 301 or 308 when possible.`;
      checks.push(check('redirect-directness', 'P2', status, message, GOOGLE_MOVE_SOURCE, trace.hops.map(hop => `${hop.status} ${hop.url}${hop.location ? ` -> ${hop.location}` : ''}`)));
    }
  }

  if (target.state !== 'observed') {
    checks.push(check('target-availability', 'P1', 'unknown', 'The declared new URL could not be fetched as a terminal resource.', GOOGLE_MOVE_SOURCE, [target.error]));
    checks.push(check('target-indexability', 'P1', 'unknown', 'Indexability of the declared new URL could not be evaluated.', GOOGLE_MOVE_SOURCE, [target.error]));
    checks.push(check('target-canonical', 'P1', 'unknown', 'Canonical annotation of the declared new URL could not be evaluated.', GOOGLE_CANONICAL_SOURCE, [target.error]));
  } else {
    const available = Number.isInteger(target.status) && target.status >= 200 && target.status < 300 && target.finalUrl === newUrl;
    checks.push(check(
      'target-availability', 'P1', available ? 'pass' : 'fail',
      available ? `The declared new URL is a terminal HTTP ${target.status} resource.` : `The declared new URL is not observed as a terminal 2xx resource (status=${target.status ?? 'unknown'}, final=${target.finalUrl || 'unknown'}).`,
      GOOGLE_MOVE_SOURCE,
      [`status:${target.status ?? 'unknown'}`, `final:${target.finalUrl || 'unknown'}`, `content-type:${target.contentType || 'unknown'}`]
    ));
    if (!available) {
      checks.push(check('target-indexability', 'P1', 'not-applicable', 'Noindex is not graded because the declared destination is not currently a terminal 2xx resource.', GOOGLE_MOVE_SOURCE));
      checks.push(check('target-canonical', 'P1', 'not-applicable', 'Canonical annotation is not graded because the declared destination is not currently a terminal 2xx resource.', GOOGLE_CANONICAL_SOURCE));
    } else {
      checks.push(check(
        'target-indexability', 'P1', target.noindex === true ? 'fail' : target.noindex === false ? 'pass' : 'unknown',
        target.noindex === true ? 'The declared new URL is explicitly noindex.' : target.noindex === false ? 'No explicit noindex directive was observed on the declared new URL.' : 'Noindex state could not be established.',
        GOOGLE_MOVE_SOURCE,
        [`noindex:${target.noindex == null ? 'unknown' : target.noindex}`]
      ));
      if (target.html !== true) {
        checks.push(check('target-canonical', 'P1', 'not-applicable', 'HTML rel=canonical is not applicable to the observed non-HTML destination representation.', GOOGLE_CANONICAL_SOURCE, [`content-type:${target.contentType || 'unknown'}`]));
      } else if (target.canonical === newUrl) {
        checks.push(check('target-canonical', 'P1', 'pass', 'The new HTML URL exposes a self-referencing canonical annotation.', GOOGLE_MOVE_SOURCE, [`canonical:${target.canonical}`]));
      } else if (!target.canonical) {
        checks.push(check('target-canonical', 'P1', 'watch', 'No HTML rel=canonical was observed on the new URL. Google site-move guidance recommends updating the new page annotations to the new URL.', GOOGLE_MOVE_SOURCE, ['canonical:not-observed']));
      } else {
        checks.push(check('target-canonical', 'P1', 'fail', `The new HTML URL declares ${target.canonical} as canonical instead of itself.`, GOOGLE_CANONICAL_SOURCE, [`canonical:${target.canonical}`]));
      }
    }
  }

  if (repository.state === 'not-provided') {
    checks.push(check('repository-continuity', 'P2', 'not-provided', 'No before/after Repository Mapper evidence was supplied.', GOOGLE_MOVE_SOURCE));
  } else {
    const states = [repository.beforeOld, repository.beforeNew, repository.afterOld, repository.afterNew];
    if (states.some(state => state === 'ambiguous' || state === 'unresolved')) {
      checks.push(check('repository-continuity', 'P2', 'unknown', 'Repository route ownership is ambiguous or unresolved for at least one migration endpoint.', GOOGLE_MOVE_SOURCE, states.map((state, index) => `${['before-old', 'before-new', 'after-old', 'after-new'][index]}:${state}`)));
    } else if (repository.beforeOld === 'resolved' && repository.afterNew === 'resolved' && repository.afterOld === 'absent') {
      checks.push(check('repository-continuity', 'P2', 'pass', 'The old route is resolved before the move, the new route is resolved after it, and the old canonical page route is absent after the move.', GOOGLE_MOVE_SOURCE, states.map((state, index) => `${['before-old', 'before-new', 'after-old', 'after-new'][index]}:${state}`)));
    } else {
      checks.push(check('repository-continuity', 'P2', 'watch', 'Repository route evidence does not cleanly show old-owner-before and new-owner-after with the old canonical page route removed. This may be legitimate for runtime/server-managed redirects, so review rather than infer a live redirect defect.', GOOGLE_MOVE_SOURCE, states.map((state, index) => `${['before-old', 'before-new', 'after-old', 'after-new'][index]}:${state}`)));
    }
  }

  if (sitemap.state === 'not-provided') {
    checks.push(check('canonical-sitemap', 'P2', 'not-provided', 'No explicit after-migration canonical urlset sitemap was supplied.', GOOGLE_MOVE_SOURCE));
  } else if (!sitemap.newPresent) {
    checks.push(check('canonical-sitemap', 'P2', 'fail', 'The declared new URL is missing from the supplied after-migration canonical sitemap.', GOOGLE_MOVE_SOURCE, [`old-present:${sitemap.oldPresent}`, 'new-present:false']));
  } else if (sitemap.oldPresent) {
    checks.push(check('canonical-sitemap', 'P2', 'watch', 'The supplied after-migration canonical sitemap contains both the old and new URLs. Old monitoring sitemaps can be useful separately, but the canonical new-site sitemap should use the new URL mapping.', GOOGLE_MOVE_SOURCE, ['old-present:true', 'new-present:true']));
  } else {
    checks.push(check('canonical-sitemap', 'P2', 'pass', 'The supplied after-migration canonical sitemap contains the new URL and not the old URL.', GOOGLE_MOVE_SOURCE, ['old-present:false', 'new-present:true']));
  }

  if (internalLinks.state === 'not-provided') {
    checks.push(check('internal-link-cleanup', 'P2', 'not-provided', 'No bounded Internal Discovery report was supplied.', GOOGLE_MOVE_SOURCE));
  } else if (internalLinks.state === 'unknown') {
    checks.push(check('internal-link-cleanup', 'P2', 'unknown', internalLinks.reason, GOOGLE_MOVE_SOURCE));
  } else if (internalLinks.oldTargetEdges > 0) {
    checks.push(check('internal-link-cleanup', 'P2', 'fail', internalLinks.reason, GOOGLE_MOVE_SOURCE, internalLinks.sourceUrlsPreview.map(url => `source:${url}`)));
  } else {
    checks.push(check('internal-link-cleanup', 'P2', 'pass', `${internalLinks.reason} This is a bounded cohort observation, not a whole-site guarantee.`, GOOGLE_MOVE_SOURCE));
  }

  return checks;
}

function verificationFor(checkId) {
  switch (checkId) {
    case 'redirect-destination': return 'Test the old URL live and confirm it redirects to the explicitly mapped new URL, not to an unrelated page or a different final destination.';
    case 'redirect-directness': return 'Prefer one server-side permanent 301/308 hop to the final destination; retest the full redirect trace after configuration changes.';
    case 'target-availability': return 'Fetch the declared new URL directly and confirm it is the terminal intended resource with a successful response.';
    case 'target-indexability': return 'Remove unintended noindex/X-Robots-Tag restrictions from the new destination and verify the live response again.';
    case 'target-canonical': return 'For HTML pages, verify the new page canonical annotation points to the intended new URL and does not point back to the old location or another page.';
    case 'repository-continuity': return 'Review before/after route ownership and server/runtime redirect configuration; repository evidence alone cannot prove live HTTP behavior.';
    case 'canonical-sitemap': return 'Regenerate the canonical after-migration sitemap from the new URL mapping and validate the exact leaf sitemap again.';
    case 'internal-link-cleanup': return 'Update observed internal links to the final new URL and rerun the same bounded rendered Internal Discovery cohort; use a broader rendered crawl for whole-site evidence.';
    default: return 'Review the migration evidence and rerun the relevant bounded check.';
  }
}

function actionFor(pair, item) {
  return {
    id: `url-migration:${item.id}:${crypto.createHash('sha256').update(`${pair.oldUrl}\n${pair.newUrl}`).digest('hex').slice(0, 16)}`,
    oldUrl: pair.oldUrl,
    newUrl: pair.newUrl,
    checkId: item.id,
    priority: item.priority,
    status: 'review',
    reason: item.message,
    verification: verificationFor(item.id),
    source: item.source,
    doesNotProve: 'Repairing a URL migration does not prove ranking preservation, signal transfer, recrawl timing, indexing, traffic recovery or AI visibility.'
  };
}

function lookupObservation(source, key) {
  if (!source) return null;
  if (source instanceof Map) return source.get(key) || null;
  return source[key] || null;
}

export function analyzeUrlMigrationIntegrity({
  pairs,
  traceByOldUrl = null,
  targetByNewUrl = null,
  beforeState = null,
  afterState = null,
  afterSitemapXml = null,
  internalDiscovery = null,
  generatedAt = new Date().toISOString()
}) {
  const normalizedPairs = normalizeMigrationPairs(pairs);
  const beforeGraph = validateGraph(beforeState, 'before');
  const afterGraph = validateGraph(afterState, 'after');
  const sitemapSet = afterSitemapXml == null ? null : new Set(parseLeafSitemap(afterSitemapXml).map(item => item.url));
  if (internalDiscovery) {
    const validation = validateInternalDiscoveryReport(internalDiscovery);
    if (!validation.valid) throw new Error(`Invalid Internal Discovery report: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }

  const pairReports = normalizedPairs.map(pair => {
    const trace = normalizeTrace(lookupObservation(traceByOldUrl, pair.oldUrl), pair.oldUrl);
    const target = normalizeTarget(lookupObservation(targetByNewUrl, pair.newUrl), pair.newUrl);
    const repository = repositoryObservation(beforeGraph, afterGraph, pair.oldUrl, pair.newUrl);
    const sitemap = sitemapObservation(sitemapSet, pair.oldUrl, pair.newUrl);
    const internalLinks = internalLinkObservation(internalDiscovery, pair.oldUrl, pair.newUrl);
    const checks = checksForPair({ ...pair, trace, target, repository, sitemap, internalLinks });
    return {
      id: `migration-${crypto.createHash('sha256').update(`${pair.oldUrl}\n${pair.newUrl}`).digest('hex').slice(0, 16)}`,
      ...pair,
      redirectTrace: trace,
      target,
      repository,
      sitemap,
      internalLinks,
      checks
    };
  });

  const allChecks = pairReports.flatMap(pair => pair.checks);
  const count = status => allChecks.filter(item => item.status === status).length;
  const actions = pairReports.flatMap(pair => pair.checks
    .filter(item => item.status === 'fail' || item.status === 'watch' || (item.status === 'unknown' && item.priority === 'P1'))
    .map(item => actionFor(pair, item)));
  const report = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/url-migration-integrity.schema.json',
    version: URL_MIGRATION_INTEGRITY_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    scope: 'Bounded URL migration implementation evidence. Live redirect hops are observed through SSRF-safe public HTTPS requests; destination HTML is inspected without browser rendering; repository, sitemap and Internal Discovery evidence are optional and keep their own coverage boundaries. No aggregate migration/SEO score is produced.',
    summary: {
      pairs: pairReports.length,
      checks: allChecks.length,
      pass: count('pass'),
      fail: count('fail'),
      watch: count('watch'),
      unknown: count('unknown'),
      notProvided: count('not-provided'),
      notApplicable: count('not-applicable'),
      pairsWithBlockingFindings: pairReports.filter(pair => pair.checks.some(item => item.priority === 'P1' && item.status === 'fail')).length
    },
    pairs: pairReports,
    actions,
    sources: [GOOGLE_MOVE_SOURCE, GOOGLE_CANONICAL_SOURCE],
    guardrails: {
      noRankingPromise: true,
      noSignalTransferPromise: true,
      canonicalIsNotRedirectProof: true,
      boundedInternalLinksNotWholeSite: true,
      crossOriginOldLinksRemainUnknown: true,
      repositoryEvidenceNotLiveRedirectProof: true,
      unknownRemainsUnknown: true,
      noCompositeScore: true
    }
  };
  const validation = validateUrlMigrationIntegrityReport(report);
  if (!validation.valid) throw new Error(`Generated URL Migration Integrity report is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return report;
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, run));
  return results;
}

export async function urlMigrationIntegrity(pairs, {
  beforeState = null,
  afterState = null,
  afterSitemapXml = null,
  internalDiscovery = null,
  timeoutMs = 8000,
  maxBytes = 1024 * 1024,
  maxRedirects = 5,
  concurrency = 4,
  fetchImpl = fetch,
  resolveImpl,
  generatedAt
} = {}) {
  const normalizedPairs = normalizeMigrationPairs(pairs);
  if (normalizedPairs.length > URL_MIGRATION_LIVE_MAX_PAIRS) throw new Error(`Live URL Migration Integrity supports at most ${URL_MIGRATION_LIVE_MAX_PAIRS} pairs per run.`);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error('concurrency must be an integer between 1 and 10.');
  const traceByOldUrl = new Map();
  const targetByNewUrl = new Map();

  await mapLimit(normalizedPairs, concurrency, async pair => {
    try {
      const trace = await tracePublicHttpsRedirects(pair.oldUrl, {
        timeoutMs,
        maxRedirects,
        fetchImpl,
        ...(resolveImpl ? { resolveImpl } : {})
      });
      traceByOldUrl.set(pair.oldUrl, { state: 'observed', ...trace });
    } catch (error) {
      traceByOldUrl.set(pair.oldUrl, { state: 'unavailable', error: String(error?.message ?? error) });
    }

    try {
      const response = await fetchPublicText(pair.newUrl, {
        timeoutMs,
        maxBytes,
        maxRedirects: 0,
        accept: 'text/html, application/xhtml+xml;q=0.9, application/pdf;q=0.8, image/*;q=0.7, */*;q=0.1',
        userAgent: 'goose-migration-integrity/0.1',
        fetchImpl,
        ...(resolveImpl ? { resolveImpl } : {})
      });
      const html = response.ok && isHtml(response.contentType) && typeof response.text === 'string';
      targetByNewUrl.set(pair.newUrl, {
        state: 'observed',
        status: response.status,
        finalUrl: response.url || pair.newUrl,
        contentType: response.contentType || null,
        html,
        canonical: html ? canonicalFromHtml(response.text, pair.newUrl) : null,
        noindex: response.ok ? noindexFromTarget(html ? response.text : '', response.headers || {}) : null
      });
    } catch (error) {
      targetByNewUrl.set(pair.newUrl, { state: 'unavailable', error: String(error?.message ?? error) });
    }
  });

  return analyzeUrlMigrationIntegrity({
    pairs: normalizedPairs,
    traceByOldUrl,
    targetByNewUrl,
    beforeState,
    afterState,
    afterSitemapXml,
    internalDiscovery,
    ...(generatedAt ? { generatedAt } : {})
  });
}

export function formatUrlMigrationIntegrityReport(report) {
  const s = report.summary;
  const lines = [
    `Goose URL Migration Integrity v${report.version}`,
    `Pairs=${s.pairs}; checks=${s.checks}; pass=${s.pass}; fail=${s.fail}; watch=${s.watch}; unknown=${s.unknown}; blocking pairs=${s.pairsWithBlockingFindings}`,
    'No migration, SEO, PageRank/signal-transfer or ranking score.',
    ''
  ];
  for (const pair of report.pairs) {
    const findings = pair.checks.filter(item => !['pass', 'not-provided', 'not-applicable'].includes(item.status));
    lines.push(`${pair.oldUrl} -> ${pair.newUrl}`);
    if (!findings.length) lines.push('  no bounded fail/watch/unknown finding');
    for (const item of findings) lines.push(`  ${item.priority} ${item.status.toUpperCase()} ${item.id}: ${item.message}`);
  }
  lines.push('', 'Migration implementation evidence is separate from Search Console indexing/traffic recovery and other outcome monitoring.');
  return lines.join('\n');
}
