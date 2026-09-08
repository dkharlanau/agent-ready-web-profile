import { fetchPublicText, mediaTypeOnly } from './public-fetch.mjs';
import { validateIntentOwnershipLedger } from './intent-ownership.mjs';

export const INTENT_OWNERSHIP_SURFACE_PROOF_VERSION = '0.1';
const INDEX_STATES = new Set(['indexable', 'noindex', 'redirect', 'unknown']);

function normalizeUrl(value) {
  try { return new URL(value).href; } catch { return String(value || ''); }
}

function isHttps(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function parseAttributes(tag) {
  const attrs = {};
  const body = String(tag || '').replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(body))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function parseRobotsGroups(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === 'user-agent') {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
      continue;
    }
    if ((name === 'allow' || name === 'disallow') && agents.length && value.startsWith('/')) {
      rules.push({ type: name, path: value });
    }
  }
  flush();
  return groups;
}

function safeDecode(value) {
  try { return decodeURI(value); } catch { return value; }
}

function ruleRegex(rulePath) {
  const anchored = rulePath.endsWith('$');
  const body = anchored ? rulePath.slice(0, -1) : rulePath;
  const escaped = body.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

function ruleMatches(rulePath, targetPath) {
  const pairs = [
    [rulePath, targetPath],
    [safeDecode(rulePath), safeDecode(targetPath)]
  ];
  return pairs.some(([rule, target]) => ruleRegex(rule).test(target));
}

function specificity(rulePath) {
  return rulePath.replace(/\*/g, '').replace(/\$$/, '').length;
}

export function robotsPathAccess(text, userAgent, targetUrl) {
  const parsed = new URL(targetUrl);
  const token = String(userAgent || '').toLowerCase();
  const groups = parseRobotsGroups(text);
  const exact = groups.filter(group => group.agents.includes(token));
  const applicable = exact.length ? exact : groups.filter(group => group.agents.includes('*'));
  if (!applicable.length) return { status: 'allowed', reason: 'no applicable robots group', matchedRule: null };

  const targetPath = `${parsed.pathname}${parsed.search}`;
  const matching = applicable.flatMap(group => group.rules).filter(rule => ruleMatches(rule.path, targetPath));
  if (!matching.length) return { status: 'allowed', reason: 'no matching robots rule', matchedRule: null };
  matching.sort((a, b) => specificity(b.path) - specificity(a.path) || (a.type === b.type ? 0 : a.type === 'allow' ? -1 : 1));
  const winnerLength = specificity(matching[0].path);
  const tied = matching.filter(rule => specificity(rule.path) === winnerLength);
  const winner = tied.find(rule => rule.type === 'allow') || tied[0];
  return {
    status: winner.type === 'allow' ? 'allowed' : 'blocked',
    reason: `${winner.type}: ${winner.path}`,
    matchedRule: winner
  };
}

function pageDirectives(html, headers) {
  const values = [];
  if (headers?.xRobotsTag) values.push(String(headers.xRobotsTag));
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const name = String(attrs.name || '').toLowerCase();
    if (['robots', 'googlebot'].includes(name) && attrs.content) values.push(String(attrs.content));
  }
  const tokens = values.flatMap(value => value.toLowerCase().split(/[,;\s]+/).map(token => token.replace(/^googlebot:/, '')).filter(Boolean));
  return { raw: values, noindex: tokens.includes('noindex') };
}

function declaredCanonicals(html, pageUrl) {
  const urls = [];
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const rel = String(attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes('canonical') || !attrs.href) continue;
    try { urls.push(new URL(attrs.href, pageUrl).href); } catch { /* ignore malformed hints */ }
  }
  return [...new Set(urls)].sort();
}

function classifyRobotsFetch(result) {
  if (!result) return { availability: 'unknown', text: '', reason: 'robots fetch failed' };
  if (result.ok) return { availability: 'available', text: result.text || '', reason: 'robots.txt fetched' };
  if (result.status >= 400 && result.status < 500 && result.status !== 429) {
    return { availability: 'absent', text: '', reason: `robots.txt HTTP ${result.status}; treated as no crawl restriction for this observation` };
  }
  return { availability: 'unknown', text: '', reason: `robots.txt HTTP ${result.status ?? 'unknown'} cannot establish current crawl access` };
}

function visibleHtmlTextObserved(html) {
  const text = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

function derivePageState({ requestedUrl, result, robots, directives, canonicals, htmlTextObserved }) {
  if (!result || result.status !== 200) return { state: 'unknown', reason: `page HTTP ${result?.status ?? 'unavailable'}; this proof requires HTTP 200` };
  const finalUrl = normalizeUrl(result.url || requestedUrl);
  const requested = normalizeUrl(requestedUrl);
  if (finalUrl !== requested) {
    if (new URL(finalUrl).origin === new URL(requested).origin) return { state: 'redirect', reason: `same-origin redirect to ${finalUrl}` };
    return { state: 'unknown', reason: `cross-origin redirect to ${finalUrl}` };
  }
  if (directives.noindex) return { state: 'noindex', reason: 'noindex observed in robots meta or X-Robots-Tag' };
  if (robots.status !== 'allowed') return { state: 'unknown', reason: robots.status === 'blocked' ? `Googlebot crawl blocked by ${robots.reason}` : robots.reason };
  if (!['text/html', 'application/xhtml+xml'].includes(mediaTypeOnly(result.contentType))) {
    return { state: 'unknown', reason: `content type ${result.contentType || 'unknown'} is outside this HTML proof adapter` };
  }
  if (!htmlTextObserved) return { state: 'unknown', reason: 'no textual HTML content was observed by this bounded proof adapter' };
  const conflicting = canonicals.filter(url => normalizeUrl(url) !== requested);
  if (conflicting.length) return { state: 'unknown', reason: `declared canonical points away from owner URL: ${conflicting.join(', ')}` };
  return { state: 'indexable', reason: 'HTTP 200 HTML, Googlebot crawl allowed, no noindex, and no conflicting declared canonical observed' };
}

export function validateIntentOwnershipSurfaceProof(proof, ledger = null) {
  const errors = [];
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return { valid: false, errors: ['proof must be an object'] };
  if (proof.version !== INTENT_OWNERSHIP_SURFACE_PROOF_VERSION) errors.push(`version must be ${INTENT_OWNERSHIP_SURFACE_PROOF_VERSION}`);
  if (proof.kind !== 'intent-ownership-surface-proof') errors.push('kind must be intent-ownership-surface-proof');
  if (!isHttps(proof.site?.url)) errors.push('site.url must be https');
  if (Number.isNaN(Date.parse(proof.observedAt))) errors.push('observedAt must be an ISO date/time');
  if (!Array.isArray(proof.pages) || proof.pages.length === 0) errors.push('pages must be a non-empty array');
  else {
    const seen = new Set();
    for (const [index, page] of proof.pages.entries()) {
      if (!isHttps(page?.url)) errors.push(`pages[${index}].url must be https`);
      const url = normalizeUrl(page?.url);
      if (seen.has(url)) errors.push(`pages[${index}].url must be unique`);
      seen.add(url);
      if (!isHttps(page?.finalUrl)) errors.push(`pages[${index}].finalUrl must be https`);
      if (page?.httpStatus != null && (!Number.isInteger(page.httpStatus) || page.httpStatus < 100 || page.httpStatus > 599)) errors.push(`pages[${index}].httpStatus is invalid`);
      if (typeof page?.redirectObserved !== 'boolean') errors.push(`pages[${index}].redirectObserved must be boolean`);
      if (typeof page?.htmlTextObserved !== 'boolean') errors.push(`pages[${index}].htmlTextObserved must be boolean`);
      if (!INDEX_STATES.has(page?.derivedIndexState)) errors.push(`pages[${index}].derivedIndexState is invalid`);
      if (!Array.isArray(page?.evidenceRefs) || page.evidenceRefs.some(ref => !isHttps(ref))) errors.push(`pages[${index}].evidenceRefs must be https URLs`);
    }
    if (ledger) {
      const ledgerUrls = new Set(ledger.canonicalPages.map(page => normalizeUrl(page.url)));
      if (seen.size !== ledgerUrls.size || [...seen].some(url => !ledgerUrls.has(url))) errors.push('proof pages must exactly match ledger canonicalPages');
    }
  }
  if (proof.boundaries?.technicalEligibilityOnly !== true) errors.push('boundaries.technicalEligibilityOnly must be true');
  if (proof.boundaries?.actualGoogleIndexingObserved !== false) errors.push('boundaries.actualGoogleIndexingObserved must be false');
  if (proof.boundaries?.searchConsoleIndexCoverageObserved !== false) errors.push('boundaries.searchConsoleIndexCoverageObserved must be false');
  if (proof.boundaries?.deploymentCommitProven !== false) errors.push('boundaries.deploymentCommitProven must be false');
  if (proof.boundaries?.googleSelectedCanonicalObserved !== false) errors.push('boundaries.googleSelectedCanonicalObserved must be false');
  return { valid: errors.length === 0, errors };
}

export async function probeIntentOwnershipSurface(ledger, {
  fetchText = fetchPublicText,
  fetchOptions = {},
  observedAt = new Date().toISOString(),
  userAgent = 'arwp-intent-ownership/0.1'
} = {}) {
  const validation = validateIntentOwnershipLedger(ledger);
  if (!validation.valid) throw new Error(`Invalid Intent Ownership ledger:\n- ${validation.errors.join('\n- ')}`);

  const robotsCache = new Map();
  const pages = [];
  for (const page of ledger.canonicalPages) {
    const requestedUrl = normalizeUrl(page.url);
    const origin = new URL(requestedUrl).origin;
    if (!robotsCache.has(origin)) {
      const robotsUrl = new URL('/robots.txt', origin).href;
      let fetchResult = null;
      try { fetchResult = await fetchText(robotsUrl, { ...fetchOptions, userAgent }); } catch { /* represented as unknown below */ }
      robotsCache.set(origin, { url: robotsUrl, result: classifyRobotsFetch(fetchResult) });
    }
    const robotsEntry = robotsCache.get(origin);
    let result = null;
    try { result = await fetchText(requestedUrl, { ...fetchOptions, userAgent }); } catch { /* represented as unknown below */ }

    const finalUrl = normalizeUrl(result?.url || requestedUrl);
    const directives = pageDirectives(result?.text, result?.headers);
    const canonicals = declaredCanonicals(result?.text, finalUrl);
    const htmlTextObserved = visibleHtmlTextObserved(result?.text);
    const robots = robotsEntry.result.availability === 'unknown'
      ? { status: 'unknown', reason: robotsEntry.result.reason, matchedRule: null }
      : robotsPathAccess(robotsEntry.result.text, 'Googlebot', requestedUrl);
    const derived = derivePageState({ requestedUrl, result, robots, directives, canonicals, htmlTextObserved });
    pages.push({
      url: requestedUrl,
      finalUrl,
      httpStatus: result?.status ?? null,
      contentType: result?.contentType ?? null,
      redirectObserved: finalUrl !== requestedUrl,
      robots: {
        url: robotsEntry.url,
        availability: robotsEntry.result.availability,
        access: robots.status,
        matchedRule: robots.matchedRule,
        reason: robots.reason
      },
      directives,
      declaredCanonicalUrls: canonicals,
      htmlTextObserved,
      derivedIndexState: derived.state,
      reason: derived.reason,
      evidenceRefs: [...new Set([requestedUrl, robotsEntry.url, ...(finalUrl !== requestedUrl ? [finalUrl] : [])])]
    });
  }

  const proof = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/intent-ownership-surface-proof.schema.json',
    version: INTENT_OWNERSHIP_SURFACE_PROOF_VERSION,
    kind: 'intent-ownership-surface-proof',
    observedAt,
    site: { url: ledger.site.url },
    source: { mode: 'bounded-public-http', userAgent },
    pages,
    boundaries: {
      technicalEligibilityOnly: true,
      actualGoogleIndexingObserved: false,
      searchConsoleIndexCoverageObserved: false,
      deploymentCommitProven: false,
      googleSelectedCanonicalObserved: false
    }
  };
  const proofValidation = validateIntentOwnershipSurfaceProof(proof, ledger);
  if (!proofValidation.valid) throw new Error(`Invalid generated surface proof:\n- ${proofValidation.errors.join('\n- ')}`);
  return proof;
}

export function applyIntentOwnershipSurfaceProof(ledger, proof) {
  const validation = validateIntentOwnershipLedger(ledger);
  if (!validation.valid) throw new Error(`Invalid Intent Ownership ledger:\n- ${validation.errors.join('\n- ')}`);
  const proofValidation = validateIntentOwnershipSurfaceProof(proof, ledger);
  if (!proofValidation.valid) throw new Error(`Invalid Intent Ownership surface proof:\n- ${proofValidation.errors.join('\n- ')}`);
  if (new URL(proof.site.url).origin !== new URL(ledger.site.url).origin) throw new Error('Surface proof site origin does not match ledger site origin.');

  const byUrl = new Map(proof.pages.map(page => [normalizeUrl(page.url), page]));
  const updated = structuredClone(ledger);
  updated.reviewedAt = proof.observedAt;
  updated.canonicalPages = updated.canonicalPages.map(page => {
    const observation = byUrl.get(normalizeUrl(page.url));
    const next = { ...page, indexState: observation.derivedIndexState };
    next.evidenceRefs = [...new Set([...(page.evidenceRefs || []), ...observation.evidenceRefs])];
    if (observation.derivedIndexState === 'redirect' && new URL(observation.finalUrl).origin === new URL(page.url).origin) next.canonicalUrl = observation.finalUrl;
    else delete next.canonicalUrl;
    return next;
  });
  const updatedValidation = validateIntentOwnershipLedger(updated);
  if (!updatedValidation.valid) throw new Error(`Surface proof produced an invalid ledger:\n- ${updatedValidation.errors.join('\n- ')}`);
  return updated;
}
