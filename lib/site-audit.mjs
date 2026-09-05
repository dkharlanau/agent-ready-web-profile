import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSite } from './scanner.mjs';
import { fetchPublicText } from './public-fetch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'search-agent-recommendations.json');

export const SEARCH_AGENT_RULESET = '2026.09';

export function loadRecommendationsRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function parseAttributes(tag) {
  const attrs = {};
  const body = String(tag || '').replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(body))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function htmlRobotsDirectives(html) {
  const directives = new Set();
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const name = String(attrs.name || '').toLowerCase();
    if (!['robots', 'googlebot'].includes(name)) continue;
    for (const token of String(attrs.content || '').toLowerCase().split(/[,;]/).map(value => value.trim()).filter(Boolean)) directives.add(token);
  }
  return directives;
}

function headerRobotsDirectives(headers) {
  const directives = new Set();
  const raw = headers?.xRobotsTag;
  if (!raw) return directives;
  for (const token of String(raw).toLowerCase().split(/[,;]/).map(value => value.trim()).filter(Boolean)) directives.add(token);
  return directives;
}

function combinedRobotsDirectives(homepage) {
  return new Set([...htmlRobotsDirectives(homepage?.text), ...headerRobotsDirectives(homepage?.headers)]);
}

function blocksSnippets(directives) {
  if (directives.has('nosnippet')) return true;
  for (const value of directives) {
    const match = value.match(/^max-snippet\s*:\s*(-?\d+)$/i);
    if (match && Number(match[1]) === 0) return true;
  }
  return false;
}

function parseRobotsGroups(text) {
  const groups = [];
  let agents = [];
  let rules = [];

  function flush() {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  }

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
    if (name === 'allow' || name === 'disallow') {
      if (agents.length) rules.push({ type: name, path: value });
    }
  }
  flush();
  return groups;
}

export function robotsRootAccess(text, userAgent) {
  if (!String(text || '').trim()) return { status: 'unknown', reason: 'robots.txt unavailable or empty' };
  const token = String(userAgent || '').toLowerCase();
  const groups = parseRobotsGroups(text);
  const exact = groups.filter(group => group.agents.includes(token));
  const applicable = exact.length ? exact : groups.filter(group => group.agents.includes('*'));
  if (!applicable.length) return { status: 'allowed', reason: 'no applicable root disallow rule observed' };

  const rules = applicable.flatMap(group => group.rules);
  const rootAllow = rules.some(rule => rule.type === 'allow' && rule.path === '/');
  const rootDisallow = rules.some(rule => rule.type === 'disallow' && rule.path === '/');
  if (rootDisallow && !rootAllow) return { status: 'blocked', reason: `root Disallow observed for ${exact.length ? userAgent : '*'}` };
  return { status: 'allowed', reason: rootAllow ? 'explicit root Allow observed' : 'no root-wide block observed' };
}

function preferredSourceSignals(html) {
  const text = String(html || '');
  const signals = [];
  if (/news\.google\.com\/swg\/js\/v1\/publisher\.(?:js|mjs)/i.test(text)) signals.push('preferred-source library');
  if (/google-add-preferred-source-btn/i.test(text)) signals.push('declarative preferred-source control');
  if (/google\.com\/preferences\/source\?q=/i.test(text)) signals.push('preferred-source content link');
  return signals;
}

function deepLinkSignals(html) {
  const text = String(html || '');
  const headingIds = (text.match(/<h[1-6]\b[^>]*\bid\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)/gi) ?? []).length;
  const suspicious = [];
  if (/location\.hash\s*=\s*(?:''|""|null)/i.test(text)) suspicious.push('page code appears to clear location.hash');
  if (/scrollTo\s*\(\s*0\s*,\s*0\s*\)/i.test(text) || /scrollTo\s*\(\s*\{[^}]*\btop\s*:\s*0/i.test(text)) suspicious.push('page code contains a forced top scroll pattern');
  return { headingIds, suspicious };
}

function sitemapSignals(text) {
  const values = [...String(text || '').matchAll(/<lastmod\b[^>]*>([^<]+)<\/lastmod>/gi)].map(match => match[1].trim());
  const valid = values.filter(value => !Number.isNaN(Date.parse(value))).length;
  return { count: values.length, valid };
}

function check(rule, status, message, evidence = []) {
  return {
    id: rule.id,
    title: rule.title,
    layer: rule.layer,
    priority: rule.priority,
    authority: rule.authority,
    upstreamStatus: rule.upstreamStatus,
    status,
    message,
    evidence,
    source: rule.source
  };
}

export function evaluateSiteObservations(observation, registry = loadRecommendationsRegistry()) {
  if (registry.ruleset !== SEARCH_AGENT_RULESET) throw new Error(`Unsupported recommendations ruleset: ${registry.ruleset}`);
  const rules = new Map(registry.rules.map(rule => [rule.id, rule]));
  const out = [];
  const homepage = observation.homepage || {};
  const robots = observation.robots || {};
  const sitemap = observation.sitemap || {};
  const scan = observation.scan || {};
  const directives = combinedRobotsDirectives(homepage);
  const googleAccess = robotsRootAccess(robots.text, 'Googlebot');
  const openaiAccess = robotsRootAccess(robots.text, 'OAI-SearchBot');

  const technicalRule = rules.get('google-search-technical-eligibility');
  if (technicalRule) {
    const issues = [];
    if (!homepage.ok || homepage.status !== 200) issues.push(`homepage HTTP status is ${homepage.status ?? 'unknown'}, not 200`);
    if (googleAccess.status === 'blocked') issues.push('Googlebot appears root-blocked by robots.txt');
    if (directives.has('noindex')) issues.push('noindex observed on the homepage');
    const status = issues.length ? 'fail' : googleAccess.status === 'unknown' ? 'warn' : 'pass';
    out.push(check(technicalRule, status, issues.join('; ') || (status === 'warn' ? 'HTTP/indexability look acceptable, but robots access could not be assessed.' : 'HTTP 200, no homepage noindex, and no root-wide Googlebot block observed.'), [
      ...(homepage.url ? [homepage.url] : []),
      ...(robots.url ? [robots.url] : [])
    ]));
  }

  const aiRule = rules.get('google-ai-search-eligibility');
  if (aiRule) {
    const issues = [];
    if (directives.has('noindex')) issues.push('noindex observed');
    if (blocksSnippets(directives)) issues.push('snippet-blocking directive observed');
    if (!homepage.ok || homepage.status !== 200) issues.push('homepage is not HTTP 200');
    const status = issues.length ? 'fail' : 'pass';
    out.push(check(aiRule, status, issues.join('; ') || 'No homepage noindex or snippet-blocking directive was observed; actual Google indexing remains external.'), homepage.url ? [homepage.url] : []));
  }

  const originalRule = rules.get('google-non-commodity-content');
  if (originalRule) out.push(check(originalRule, 'not-assessed', 'Originality and usefulness require content/evidence review; the static audit does not manufacture a quality score.'));

  const preferredRule = rules.get('google-preferred-sources');
  if (preferredRule) {
    const signals = preferredSourceSignals(homepage.text);
    out.push(check(preferredRule, signals.length ? 'pass' : 'warn', signals.length ? `Observed: ${signals.join(', ')}.` : 'No Google Preferred Sources control was observed on the audited page; this is an optional acquisition opportunity, not a ranking failure.', homepage.url ? [homepage.url] : []));
  }

  const deepRule = rules.get('google-read-more-deep-links');
  if (deepRule) {
    const deep = deepLinkSignals(homepage.text);
    const issues = [];
    if (!deep.headingIds) issues.push('no heading IDs observed in the audited HTML');
    issues.push(...deep.suspicious);
    out.push(check(deepRule, issues.length ? 'warn' : 'pass', issues.length ? issues.join('; ') : `${deep.headingIds} heading ID(s) observed with no obvious hash-clearing/forced-top-scroll pattern.`, homepage.url ? [homepage.url] : []));
  }

  const sitemapRule = rules.get('google-sitemap-lastmod');
  if (sitemapRule) {
    if (!sitemap.ok) out.push(check(sitemapRule, 'warn', 'No readable sitemap was available to inspect for lastmod freshness metadata.', sitemap.url ? [sitemap.url] : []));
    else {
      const fresh = sitemapSignals(sitemap.text);
      const status = fresh.count && fresh.count === fresh.valid ? 'pass' : 'warn';
      const message = !fresh.count
        ? 'Sitemap is reachable but no lastmod values were observed.'
        : fresh.count === fresh.valid
          ? `${fresh.count} syntactically parseable lastmod value(s) observed; semantic accuracy still requires publisher verification.`
          : `${fresh.valid}/${fresh.count} lastmod value(s) are syntactically parseable; semantic accuracy still requires publisher verification.`;
      out.push(check(sitemapRule, status, message, sitemap.url ? [sitemap.url] : []));
    }
  }

  const openaiRule = rules.get('openai-oai-searchbot-access');
  if (openaiRule) {
    const status = openaiAccess.status === 'blocked' ? 'fail' : openaiAccess.status === 'unknown' ? 'warn' : 'pass';
    out.push(check(openaiRule, status, openaiAccess.status === 'blocked' ? 'OAI-SearchBot appears root-blocked by robots.txt.' : openaiAccess.status === 'unknown' ? 'OAI-SearchBot access could not be assessed because robots.txt was unavailable.' : 'No root-wide OAI-SearchBot block was observed.', robots.url ? [robots.url] : []));
  }

  const indexNowRule = rules.get('indexnow-change-notification');
  if (indexNowRule) out.push(check(indexNowRule, 'not-assessed', 'IndexNow submission is a publisher/runtime configuration and cannot be proven from a normal page fetch without an explicit receipt or configuration declaration.'));

  for (const id of ['google-generative-ai-measurement', 'bing-ai-performance-measurement']) {
    const rule = rules.get(id);
    if (rule) out.push(check(rule, 'not-assessed', 'Requires authenticated site-owner analytics/export evidence; public crawling cannot infer these metrics.'));
  }

  for (const id of ['webmcp-runtime-tools', 'webmcp-evals-security']) {
    const rule = rules.get(id);
    if (rule) out.push(check(rule, 'not-assessed', 'Static HTTP audit intentionally does not claim WebMCP runtime conformance. Use browser/runtime eval evidence when available.'));
  }

  const aiprefRule = rules.get('aipref-content-usage');
  if (aiprefRule) {
    const header = homepage.headers?.contentUsage || null;
    const robotDirective = String(robots.text || '').match(/^\s*Content-Usage\s*:\s*(.+)$/im)?.[1]?.trim() || null;
    if (header || robotDirective) {
      out.push(check(aiprefRule, 'observed', `Observed draft Content-Usage preference${header && robotDirective ? 's' : ''}: ${[header && `HTTP=${header}`, robotDirective && `robots=${robotDirective}`].filter(Boolean).join('; ')}. This remains work-in-progress IETF syntax.`, [
        ...(homepage.url ? [homepage.url] : []),
        ...(robots.url ? [robots.url] : [])
      ]));
    } else out.push(check(aiprefRule, 'not-assessed', 'No draft Content-Usage signal was observed. Absence is not a failure because AIPREF remains an Internet-Draft.'));
  }

  const introRule = rules.get('w3c-introduction-layer-watch');
  if (introRule) out.push(check(introRule, 'watch', 'Tracked as upstream incubation only. ARWP should add an adapter if a concrete discoverable specification emerges instead of inventing a competing manifest.'));

  const profileRule = rules.get('arwp-profile-validity');
  if (profileRule) {
    if (!scan.existingProfile) out.push(check(profileRule, 'not-applicable', 'No ARWP publisher profile was observed; ARWP profile adoption is optional.'));
    else if (scan.existingProfile.valid) out.push(check(profileRule, 'pass', 'Observed ARWP publisher profile validates against the current project contract.', [scan.existingProfile.url]));
    else out.push(check(profileRule, 'fail', `Observed ARWP profile is invalid: ${(scan.existingProfile.errors || []).join('; ') || 'schema/semantic validation failed'}.`, [scan.existingProfile.url]));
  }

  const expected = registry.rules.map(rule => rule.id);
  const emitted = new Set(out.map(item => item.id));
  for (const id of expected) {
    if (emitted.has(id)) continue;
    const rule = rules.get(id);
    out.push(check(rule, 'not-assessed', 'No automated evaluator is implemented for this rule yet.'));
  }

  const summary = out.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    acc.layers[item.layer] ??= {};
    acc.layers[item.layer][item.status] = (acc.layers[item.layer][item.status] || 0) + 1;
    return acc;
  }, { layers: {} });

  return {
    auditVersion: '0.1',
    ruleset: registry.ruleset,
    reviewedAt: registry.reviewedAt,
    canonicalUrl: observation.canonicalUrl || scan.canonicalUrl || homepage.url || null,
    checks: out,
    summary,
    guardrail: registry.methodology.principle
  };
}

export async function auditSite(input, {
  timeoutMs = 8000,
  maxBytes = 512 * 1024,
  fetchImpl = fetch,
  resolveImpl
} = {}) {
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const scan = await scanSite(input, network);
  const homepage = await fetchPublicText(scan.finalUrl, {
    ...network,
    accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
    userAgent: 'arwp-audit/0.1'
  });

  let robots = { ok: false, text: null, url: scan.discovered.robots?.url || new URL('/robots.txt', scan.canonicalUrl).href };
  if (scan.discovered.robots?.url) {
    try {
      robots = await fetchPublicText(scan.discovered.robots.url, {
        ...network,
        maxBytes: Math.min(maxBytes, 128 * 1024),
        accept: 'text/plain, */*;q=0.1',
        userAgent: 'arwp-audit/0.1'
      });
    } catch (error) {
      robots = { ...robots, error: String(error.message ?? error) };
    }
  }

  let sitemap = { ok: false, text: null, url: scan.discovered.sitemap?.url || null };
  if (scan.discovered.sitemap?.url) {
    try {
      sitemap = await fetchPublicText(scan.discovered.sitemap.url, {
        ...network,
        maxBytes,
        accept: 'application/xml, text/xml, text/plain;q=0.9, */*;q=0.1',
        userAgent: 'arwp-audit/0.1'
      });
    } catch (error) {
      sitemap = { ...sitemap, error: String(error.message ?? error) };
    }
  }

  return evaluateSiteObservations({ canonicalUrl: scan.canonicalUrl, scan, homepage, robots, sitemap });
}

export function formatAuditReport(result) {
  const lines = [
    `ARWP Search + Agent audit — ruleset ${result.ruleset}`,
    `Canonical: ${result.canonicalUrl || 'unknown'}`,
    ''
  ];
  for (const item of result.checks) {
    lines.push(`${item.status.toUpperCase().padEnd(13)} ${item.layer.padEnd(11)} ${item.id} — ${item.message}`);
  }
  const statuses = ['pass', 'observed', 'warn', 'fail', 'not-assessed', 'not-applicable', 'watch'];
  lines.push('', `Summary: ${statuses.map(status => `${status}=${result.summary[status] || 0}`).join(', ')}`);
  lines.push(result.guardrail);
  return lines.join('\n');
}
