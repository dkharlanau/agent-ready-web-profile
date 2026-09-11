import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublicText, probePublicHttpsUrl } from './public-fetch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const rulesPath = path.join(root, 'registry', 'technical-integrity-rules.json');
const RULE_ID = 'bounded-internal-link-target-health';

function loadRule() {
  const registry = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  const rule = registry.rules.find(item => item.id === RULE_ID);
  if (!rule) throw new Error(`${RULE_ID} is missing from registry/technical-integrity-rules.json.`);
  return rule;
}

function attrs(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[\w:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function normalizeInternalTarget(raw, base, origin) {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'https:' || url.origin !== origin) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function internalTargets(html, base, origin) {
  const out = [];
  for (const match of String(html || '').matchAll(/<a\b([^>]*)>/gi)) {
    const a = attrs(`<a ${match[1]}>`);
    const raw = String(a.href || '').trim();
    if (!raw || /^(?:javascript:|data:|mailto:|tel:)/i.test(raw)) continue;
    const url = normalizeInternalTarget(raw, base, origin);
    if (url) out.push(url);
  }
  return out;
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

function targetDepth(value) {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).length;
  } catch {
    return 99;
  }
}

export function selectInternalLinkTargets(sourcePages, canonicalUrl, maxTargets = 24) {
  if (!Number.isInteger(maxTargets) || maxTargets < 0 || maxTargets > 50) throw new Error('maxTargets must be an integer between 0 and 50.');
  if (maxTargets === 0) return [];
  const origin = new URL(canonicalUrl).origin;
  const counts = new Map();
  for (const page of sourcePages) {
    if (!page?.ok || !page.text) continue;
    const sourceUrl = page.url || page.requestedUrl;
    const seenOnPage = new Set();
    for (const target of internalTargets(page.text, sourceUrl, origin)) {
      const entry = counts.get(target) || { url: target, occurrences: 0, sourcePages: 0 };
      entry.occurrences += 1;
      if (!seenOnPage.has(target)) {
        entry.sourcePages += 1;
        seenOnPage.add(target);
      }
      counts.set(target, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.sourcePages - a.sourcePages || b.occurrences - a.occurrences || targetDepth(a.url) - targetDepth(b.url) || a.url.localeCompare(b.url))
    .slice(0, maxTargets);
}

function classifyTarget(probe, canonicalOrigin) {
  if (!probe) return { state: 'watch', reason: 'probe unavailable' };
  const status = probe.status ?? null;
  if (status === 404 || status === 410 || (status >= 500 && status < 600)) return { state: 'fail', reason: `HTTP ${status}` };
  if (status === null) return { state: 'watch', reason: probe.error || 'status unavailable' };
  if (status === 401 || status === 403 || status === 429 || (status >= 400 && status < 500)) return { state: 'watch', reason: `HTTP ${status}` };
  if (probe.redirected) {
    let finalOrigin = null;
    try { finalOrigin = new URL(probe.url).origin; } catch { /* no-op */ }
    return { state: 'watch', reason: finalOrigin && finalOrigin !== canonicalOrigin ? `redirects off-origin to ${probe.url}` : `redirects to ${probe.url}` };
  }
  if (status >= 200 && status < 300) return { state: 'pass', reason: `HTTP ${status}` };
  return { state: 'watch', reason: `HTTP ${status}` };
}

function buildCheck(rule, selected, probes, canonicalOrigin, sourceUnavailable) {
  if (!selected.length) {
    return {
      id: rule.id,
      priority: rule.priority,
      authority: rule.authority,
      status: 'not-applicable',
      message: sourceUnavailable
        ? 'No internal-link targets were selected because the bounded source-page fetch produced no usable HTML.'
        : 'No same-origin crawlable internal-link target was observed on the bounded priority source pages.',
      evidence: [],
      source: rule.source,
      ...(rule.additionalSources ? { additionalSources: rule.additionalSources } : {}),
      doesNotProve: rule.doesNotProve
    };
  }
  const reviewed = probes.map((probe, index) => ({
    ...selected[index],
    requestedUrl: probe?.requestedUrl || selected[index].url,
    finalUrl: probe?.url || null,
    status: probe?.status ?? null,
    redirected: Boolean(probe?.redirected),
    error: probe?.error || null,
    ...classifyTarget(probe, canonicalOrigin)
  }));
  const failed = reviewed.filter(item => item.state === 'fail');
  const watched = reviewed.filter(item => item.state === 'watch');
  let status = 'pass';
  let message = `${reviewed.length} bounded same-origin internal-link target(s) resolved successfully without an observed redirect or error response.`;
  if (failed.length) {
    status = 'fail';
    message = `${failed.length}/${reviewed.length} sampled internal-link target(s) resolve to 404/410/5xx responses; ${watched.length} additional target(s) need review.`;
  } else if (watched.length || sourceUnavailable) {
    status = 'watch';
    message = `${watched.length}/${reviewed.length} sampled internal-link target(s) redirect, require authorization/rate-limit handling, or could not be probed cleanly${sourceUnavailable ? '; some source pages were unavailable during link discovery' : ''}.`;
  }
  return {
    id: rule.id,
    priority: rule.priority,
    authority: rule.authority,
    status,
    message,
    evidence: reviewed.filter(item => item.state !== 'pass').map(item => item.url).slice(0, 20),
    source: rule.source,
    ...(rule.additionalSources ? { additionalSources: rule.additionalSources } : {}),
    doesNotProve: rule.doesNotProve,
    sampledTargets: reviewed
  };
}

export async function auditInternalLinkTargetHealth({
  canonicalUrl,
  cohortUrls,
  maxTargets = 24,
  concurrency = 4,
  timeoutMs = 8000,
  maxBytes = 256 * 1024,
  fetchImpl = fetch,
  resolveImpl
}) {
  const rule = loadRule();
  if (!Array.isArray(cohortUrls) || !cohortUrls.length) throw new Error('cohortUrls must contain at least one URL.');
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const sourcePages = await mapLimit(cohortUrls, concurrency, async url => {
    const response = await fetchPublicText(url, {
      ...network,
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
      userAgent: 'goose-internal-link-health/0.1'
    }).catch(error => ({ ok: false, status: null, url, text: null, error: String(error?.message ?? error) }));
    return { requestedUrl: url, ...response };
  });
  const sourceUnavailable = sourcePages.filter(page => !page.ok || !page.text).length;
  const selected = selectInternalLinkTargets(sourcePages, canonicalUrl, maxTargets);
  const probes = await mapLimit(selected, concurrency, async target => {
    try {
      return await probePublicHttpsUrl(target.url, {
        fetchImpl,
        ...(resolveImpl ? { resolveImpl } : {}),
        timeoutMs,
        accept: 'text/html, application/xhtml+xml, text/plain;q=0.8, */*;q=0.1',
        userAgent: 'goose-internal-link-health/0.1'
      });
    } catch (error) {
      return { ok: false, status: null, requestedUrl: target.url, url: target.url, redirected: false, error: String(error?.message ?? error) };
    }
  });
  const canonicalOrigin = new URL(canonicalUrl).origin;
  const check = buildCheck(rule, selected, probes, canonicalOrigin, sourceUnavailable);
  return {
    version: '0.1',
    maxTargets,
    sourcePagesRequested: cohortUrls.length,
    sourcePagesUnavailable: sourceUnavailable,
    candidateTargetsObserved: selectInternalLinkTargets(sourcePages, canonicalUrl, 50).length,
    selectedTargets: selected.length,
    selectionMethod: 'same-origin crawlable anchors from the bounded priority cohort; ranked by distinct source pages, occurrences, path depth and URL; capped before target probes',
    check
  };
}

export function mergeInternalLinkHealth(report, audit) {
  const checks = report.checks.slice();
  const index = checks.findIndex(item => item.id === RULE_ID);
  if (index >= 0) checks[index] = audit.check;
  else checks.push(audit.check);
  const counts = { pass: 0, fail: 0, watch: 0, 'not-applicable': 0 };
  let p0Failures = 0;
  for (const check of checks) {
    counts[check.status] = (counts[check.status] || 0) + 1;
    if (check.priority === 'P0' && check.status === 'fail') p0Failures += 1;
  }
  return {
    ...report,
    checks,
    summary: {
      ...report.summary,
      counts,
      p0Failures,
      state: p0Failures ? 'blocked' : (counts.watch || counts.fail ? 'review' : 'clean')
    },
    internalLinkTargetAudit: {
      version: audit.version,
      maxTargets: audit.maxTargets,
      sourcePagesRequested: audit.sourcePagesRequested,
      sourcePagesUnavailable: audit.sourcePagesUnavailable,
      candidateTargetsObserved: audit.candidateTargetsObserved,
      selectedTargets: audit.selectedTargets,
      selectionMethod: audit.selectionMethod
    }
  };
}
