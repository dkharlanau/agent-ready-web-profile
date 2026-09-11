import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublicText } from './public-fetch.mjs';
import { siteGate } from './site-gate.mjs';
import { robotsRootAccess } from './site-audit.mjs';

export const TECHNICAL_INTEGRITY_VERSION = '0.2';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const rulesPath = path.join(root, 'registry', 'technical-integrity-rules.json');

export function loadTechnicalIntegrityRules() {
  return JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
}

function attrs(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[\w:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function normalizeUrl(value, base = null) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function mediaType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function isHtmlType(value) {
  return ['text/html', 'application/xhtml+xml'].includes(mediaType(value));
}

function headHtml(html) {
  return String(html || '').match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
}

function bodyHtml(html) {
  return String(html || '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || String(html || '');
}

function mainHtml(html) {
  const text = String(html || '');
  return text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || bodyHtml(text);
}

function cleanText(html) {
  return String(html || '')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaDirectives(html, agent = 'robots') {
  const out = new Set();
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    if (String(a.name || '').toLowerCase() !== agent.toLowerCase()) continue;
    for (const token of String(a.content || '').toLowerCase().split(/[,;]/).map(v => v.trim()).filter(Boolean)) out.add(token);
  }
  return out;
}

function headerDirectives(headers, agent = null) {
  const out = new Set();
  const raw = String(headers?.xRobotsTag || '');
  if (!raw) return out;
  for (let token of raw.toLowerCase().split(/[,;]/).map(v => v.trim()).filter(Boolean)) {
    const scoped = token.match(/^([a-z0-9_-]+)\s*:\s*(.+)$/i);
    if (scoped && ['googlebot', 'bingbot'].includes(scoped[1])) {
      if (!agent || scoped[1] !== agent.toLowerCase()) continue;
      token = scoped[2].trim();
    }
    out.add(token);
  }
  return out;
}

function combinedDirectives(page, agent, htmlLike) {
  const meta = htmlLike
    ? [...metaDirectives(page.html, 'robots'), ...metaDirectives(page.html, agent)]
    : [];
  return new Set([...meta, ...headerDirectives(page.headers, agent)]);
}

function genericDirectives(page, htmlLike) {
  const meta = htmlLike ? [...metaDirectives(page.html, 'robots')] : [];
  return new Set([...meta, ...headerDirectives(page.headers)]);
}

function snippetBlocked(directives) {
  if (directives.has('nosnippet')) return true;
  for (const token of directives) {
    const match = token.match(/^max-snippet\s*:\s*(-?\d+)$/i);
    if (match && Number(match[1]) === 0) return true;
  }
  return false;
}

function canonicalSignals(html, base) {
  const head = headHtml(html);
  const headCanonicals = [];
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes('canonical')) continue;
    headCanonicals.push({ raw: a.href || '', url: a.href ? normalizeUrl(a.href, base) : null });
  }
  const allCount = (String(html || '').match(/<link\b[^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/gi) || []).length;
  return {
    headCanonicals,
    canonical: headCanonicals.find(item => item.url)?.url || null,
    invalidCount: headCanonicals.filter(item => !item.url).length,
    outsideHeadCount: Math.max(0, allCount - headCanonicals.length)
  };
}

function hreflangSignals(html, base) {
  const out = [];
  for (const tag of headHtml(html).match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes('alternate') || !a.hreflang) continue;
    out.push({
      hreflang: String(a.hreflang).trim().toLowerCase(),
      rawHref: a.href || '',
      url: a.href ? normalizeUrl(a.href, base) : null
    });
  }
  return out;
}

function linkSignals(html, base) {
  const result = { anchors: 0, hrefAnchors: 0, crawlableAnchors: 0, internalCrawlable: 0, pseudoLinks: 0, badExamples: [] };
  const origin = new URL(base).origin;
  for (const match of String(html || '').matchAll(/<a\b([^>]*)>/gi)) {
    result.anchors += 1;
    const a = attrs(`<a ${match[1]}>`);
    const raw = String(a.href || '').trim();
    if (!raw) {
      result.pseudoLinks += 1;
      if (result.badExamples.length < 5) result.badExamples.push('<a> without href');
      continue;
    }
    result.hrefAnchors += 1;
    if (/^(?:javascript:|data:)/i.test(raw)) {
      result.pseudoLinks += 1;
      if (result.badExamples.length < 5) result.badExamples.push(raw.slice(0, 100));
      continue;
    }
    let parsed;
    try { parsed = new URL(raw, base); } catch { parsed = null; }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) continue;
    result.crawlableAnchors += 1;
    if (parsed.origin === origin) result.internalCrawlable += 1;
  }
  return result;
}

function titleSignal(html) {
  return cleanText(headHtml(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
}

function h1Signal(html) {
  return cleanText(String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}

function shingleSet(text, size = 5) {
  const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const set = new Set();
  for (let i = 0; i <= words.length - size; i += 1) set.add(words.slice(i, i + size).join(' '));
  return { set, words: words.length };
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const item of smaller) if (larger.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
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
    if ((name === 'allow' || name === 'disallow') && agents.length) rules.push({ type: name, path: value });
  }
  flush();
  return groups;
}

function escapeRegex(value) {
  return String(value).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function robotsRuleMatch(rulePath, target) {
  if (!rulePath) return false;
  const anchoredEnd = rulePath.endsWith('$');
  const body = anchoredEnd ? rulePath.slice(0, -1) : rulePath;
  const regexBody = body.split('*').map(escapeRegex).join('.*');
  try {
    return new RegExp(`^${regexBody}${anchoredEnd ? '$' : ''}`).test(target);
  } catch {
    return false;
  }
}

function robotsRuleSpecificity(rulePath) {
  return String(rulePath || '').replace(/\*/g, '').replace(/\$$/, '').length;
}

export function robotsPathAccess(text, userAgent, value) {
  if (!String(text || '').trim()) return { status: 'unknown', reason: 'robots.txt unavailable or empty', matchedRule: null };
  let parsed;
  try { parsed = new URL(value); } catch { return { status: 'unknown', reason: 'invalid URL', matchedRule: null }; }
  const token = String(userAgent || '').toLowerCase();
  const groups = parseRobotsGroups(text);
  const exact = groups.filter(group => group.agents.includes(token));
  const applicable = exact.length ? exact : groups.filter(group => group.agents.includes('*'));
  if (!applicable.length) return { status: 'allowed', reason: 'no applicable user-agent group observed', matchedRule: null };
  const target = `${parsed.pathname}${parsed.search}` || '/';
  const matches = applicable
    .flatMap(group => group.rules)
    .filter(rule => rule.path && robotsRuleMatch(rule.path, target))
    .map(rule => ({ ...rule, specificity: robotsRuleSpecificity(rule.path) }))
    .sort((a, b) => b.specificity - a.specificity || (a.type === 'allow' ? -1 : 1));
  if (!matches.length) return { status: 'allowed', reason: 'no matching path rule observed', matchedRule: null };
  const winner = matches[0];
  return {
    status: winner.type === 'disallow' ? 'blocked' : 'allowed',
    reason: `${winner.type}: ${winner.path} is the most specific sampled rule`,
    matchedRule: { type: winner.type, path: winner.path, specificity: winner.specificity }
  };
}

function observePage(page) {
  const finalUrl = normalizeUrl(page.url || page.requestedUrl) || page.url || page.requestedUrl;
  const fetchLimitExceeded = /response exceeds maxbytes/i.test(String(page.error || ''));
  if (!page.ok || page.html === null || page.html === undefined) {
    return {
      requestedUrl: page.requestedUrl,
      url: finalUrl,
      ok: false,
      status: page.status ?? null,
      contentType: page.contentType || null,
      fetchLimitExceeded,
      fetchBudgetBytes: page.fetchBudgetBytes ?? null,
      error: page.error || null
    };
  }
  const htmlLike = isHtmlType(page.contentType);
  const canonical = htmlLike ? canonicalSignals(page.html, finalUrl) : { headCanonicals: [], canonical: null, invalidCount: 0, outsideHeadCount: 0 };
  const generic = genericDirectives(page, htmlLike);
  const googleDirectives = combinedDirectives(page, 'googlebot', htmlLike);
  const bingDirectives = combinedDirectives(page, 'bingbot', htmlLike);
  const text = htmlLike ? cleanText(mainHtml(page.html)) : String(page.html || '').replace(/\s+/g, ' ').trim();
  const links = htmlLike ? linkSignals(page.html, finalUrl) : { anchors: 0, hrefAnchors: 0, crawlableAnchors: 0, internalCrawlable: 0, pseudoLinks: 0, badExamples: [] };
  const hreflang = htmlLike ? hreflangSignals(page.html, finalUrl) : [];
  const dataNosnippetCount = htmlLike ? (String(page.html).match(/\bdata-nosnippet\b/gi) || []).length : 0;
  const scriptCount = htmlLike ? (String(page.html).match(/<script\b/gi) || []).length : 0;
  const h1Count = htmlLike ? (String(page.html).match(/<h1\b/gi) || []).length : 0;
  return {
    requestedUrl: page.requestedUrl,
    url: finalUrl,
    ok: true,
    status: page.status,
    redirected: normalizeUrl(page.requestedUrl) !== normalizeUrl(finalUrl),
    contentType: page.contentType || null,
    isHtml: htmlLike,
    bytes: page.bytes ?? null,
    fetchBudgetBytes: page.fetchBudgetBytes ?? null,
    fetchLimitExceeded: false,
    title: htmlLike ? titleSignal(page.html) : null,
    h1Count,
    h1Text: htmlLike ? h1Signal(page.html) : null,
    canonical: canonical.canonical,
    canonicalDeclarations: canonical.headCanonicals.length,
    invalidCanonicalDeclarations: canonical.invalidCount,
    canonicalOutsideHead: canonical.outsideHeadCount,
    genericDirectives: [...generic].sort(),
    googleDirectives: [...googleDirectives].sort(),
    bingDirectives: [...bingDirectives].sort(),
    genericNoindex: generic.has('noindex'),
    noindex: googleDirectives.has('noindex'),
    googleSnippetBlocked: snippetBlocked(googleDirectives),
    bingSnippetBlocked: snippetBlocked(bingDirectives),
    bingNoarchive: bingDirectives.has('noarchive'),
    bingNocache: bingDirectives.has('nocache'),
    dataNosnippetCount,
    textChars: text.length,
    textWords: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    scriptCount,
    links,
    hreflang,
    metaRefresh: htmlLike && /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/i.test(String(page.html)),
    _text: text
  };
}

function finding(rule, status, message, evidence = [], details = {}) {
  return {
    id: rule.id,
    priority: rule.priority,
    authority: rule.authority,
    status,
    message,
    evidence: [...new Set(evidence.filter(Boolean))].slice(0, 20),
    source: rule.source,
    ...(rule.additionalSources ? { additionalSources: rule.additionalSources } : {}),
    doesNotProve: rule.doesNotProve,
    ...details
  };
}

function robotsFinding(rule, robots) {
  const status = robots?.status ?? null;
  if (robots?.ok) {
    const access = robotsRootAccess(robots.text, 'Googlebot');
    if (access.status === 'blocked') return finding(rule, 'fail', `robots.txt is reachable but Googlebot appears root-blocked: ${access.reason}.`, [robots.url]);
    return finding(rule, 'pass', `robots.txt is reachable and no root-wide Googlebot block was observed (${access.reason}).`, [robots.url]);
  }
  if (status >= 400 && status < 500 && status !== 429) {
    return finding(rule, 'pass', `robots.txt returned HTTP ${status}. Google documents 4xx responses other than 429 as no crawl restrictions; this is not a Googlebot block.`, [robots.url]);
  }
  if (status === 429 || (status >= 500 && status < 600)) {
    return finding(rule, 'fail', `robots.txt returned HTTP ${status}. Google treats 429/5xx as a server-error state that can temporarily suppress crawling or reuse cached robots rules.`, [robots.url]);
  }
  return finding(rule, 'watch', 'robots.txt fetch state could not be established safely; Google treats network/DNS fetch failures as server errors, so inspect this explicitly.', [robots?.url]);
}

function priorityRobotsFinding(rule, pages, robots) {
  if (!robots?.ok) return finding(rule, 'watch', 'Path-specific Googlebot access could not be evaluated because robots.txt was not fetched successfully.', [robots?.url]);
  const blocked = [];
  for (const page of pages) {
    const access = robotsPathAccess(robots.text, 'Googlebot', page.url || page.requestedUrl);
    if (access.status === 'blocked') blocked.push({ url: page.url || page.requestedUrl, access });
  }
  if (blocked.length) {
    return finding(rule, 'fail', `${blocked.length}/${pages.length} sampled priority URL(s) are blocked by a path-specific Googlebot robots rule even though the site root may be allowed.`, blocked.map(item => item.url), { blocked: blocked.slice(0, 20) });
  }
  return finding(rule, 'pass', `No path-specific Googlebot robots block was observed across ${pages.length} sampled priority URL(s).`, pages.map(page => page.url || page.requestedUrl));
}

function indexabilityFinding(rule, pages) {
  const hard = pages.filter(page => (page.status !== null && (page.status < 200 || page.status >= 300)) || page.noindex);
  const unknown = pages.filter(page => !page.ok && page.status === null);
  if (hard.length) {
    return finding(rule, 'fail', `${hard.length}/${pages.length} sampled priority page(s) expose a known non-success response and/or noindex.`, hard.map(page => page.url || page.requestedUrl));
  }
  if (unknown.length) {
    return finding(rule, 'watch', `${unknown.length}/${pages.length} sampled priority page(s) could not be fully inspected by the bounded audit, so indexability remains unknown rather than failed.`, unknown.map(page => page.url || page.requestedUrl), { unknownCount: unknown.length });
  }
  return finding(rule, 'pass', `${pages.length}/${pages.length} sampled priority pages returned success and no Google noindex directive was observed.`, pages.map(page => page.url));
}

function snippetFinding(rule, pages) {
  const blocked = pages.filter(page => page.ok && page.googleSnippetBlocked);
  if (blocked.length) return finding(rule, 'fail', `${blocked.length}/${pages.length} sampled priority page(s) expose nosnippet or max-snippet:0, which blocks Google snippet eligibility required for supporting-link eligibility in AI Overviews/AI Mode.`, blocked.map(page => page.url));
  const scoped = pages.filter(page => page.ok && page.dataNosnippetCount > 0);
  const unknown = pages.filter(page => !page.ok && page.status === null);
  if (scoped.length) return finding(rule, 'watch', `${scoped.length} sampled page(s) use data-nosnippet. This can be intentional, but review whether important answer/evidence text is excluded from snippets.`, scoped.map(page => page.url));
  if (unknown.length) return finding(rule, 'watch', `Snippet eligibility could not be inspected on ${unknown.length} bounded-fetch page(s); no snippet block was observed on the remaining sampled pages.`, unknown.map(page => page.url || page.requestedUrl));
  return finding(rule, 'pass', 'No sampled priority page exposed nosnippet, max-snippet:0, or data-nosnippet.', pages.filter(page => page.ok).map(page => page.url));
}

function canonicalFinding(rule, pages) {
  const htmlPages = pages.filter(item => item.ok && item.isHtml);
  if (!htmlPages.length) return finding(rule, 'not-applicable', 'No successfully fetched HTML page was available for canonical-link review.');
  const hard = [];
  const review = [];
  for (const page of htmlPages) {
    if (page.invalidCanonicalDeclarations) hard.push(`${page.url}: invalid canonical URL`);
    if (page.canonicalDeclarations > 1) hard.push(`${page.url}: ${page.canonicalDeclarations} canonical declarations in head`);
    if (page.canonicalOutsideHead) hard.push(`${page.url}: canonical declaration outside head`);
    if (!page.canonical) review.push(`${page.url}: no valid head canonical`);
    else if (normalizeUrl(page.canonical) !== normalizeUrl(page.url)) review.push(`${page.url}: canonical -> ${page.canonical}`);
    if (page.metaRefresh) review.push(`${page.url}: meta refresh observed`);
  }
  if (hard.length) return finding(rule, 'fail', hard.slice(0, 8).join('; '), htmlPages.map(page => page.url), { issueCount: hard.length, reviewCount: review.length });
  if (review.length) return finding(rule, 'watch', review.slice(0, 8).join('; '), htmlPages.map(page => page.url), { reviewCount: review.length });
  return finding(rule, 'pass', 'Each successful sampled HTML page exposes one valid head canonical matching its observed final URL; non-HTML resources are not forced to carry HTML canonical markup.', htmlPages.map(page => page.url));
}

function collisionFinding(rule, pages) {
  const clusters = new Map();
  for (const page of pages.filter(item => item.ok && item.isHtml && item.canonical)) {
    const key = normalizeUrl(page.canonical);
    const urls = clusters.get(key) || [];
    urls.push(page.url);
    clusters.set(key, urls);
  }
  const collisions = [...clusters.entries()].filter(([, urls]) => new Set(urls).size > 1);
  if (collisions.length) {
    return finding(rule, 'watch', `${collisions.length} sampled canonical cluster(s) contain multiple distinct priority HTML URLs. Confirm consolidation is intentional rather than route duplication.`, collisions.flatMap(([canonical, urls]) => [canonical, ...urls]).slice(0, 20), { collisionCount: collisions.length });
  }
  return finding(rule, 'pass', 'No duplicate canonical target was observed across the successfully fetched HTML priority cohort.', pages.filter(page => page.ok && page.isHtml).map(page => page.url));
}

function retrievalFootprintFinding(rule, pages) {
  const exceeded = pages.filter(page => page.fetchLimitExceeded);
  if (exceeded.length) {
    const budgets = [...new Set(exceeded.map(page => page.fetchBudgetBytes).filter(Boolean))];
    const budgetText = budgets.length === 1 ? ` (${budgets[0]} byte audit cap)` : '';
    return finding(rule, 'watch', `${exceeded.length}/${pages.length} sampled priority document(s) exceeded Goose's bounded public fetch budget${budgetText}. This is a retrieval-footprint signal, not an indexability failure.`, exceeded.map(page => page.url || page.requestedUrl), { exceededCount: exceeded.length, auditBudgets: budgets });
  }
  return finding(rule, 'pass', 'No sampled priority document exceeded the configured Goose bounded-fetch budget.', pages.map(page => page.url || page.requestedUrl));
}

function soft404Finding(rule, pages) {
  const candidates = [];
  const errorLike = /\b(?:404|page not found|not found|does not exist|doesn't exist|nothing here|page unavailable)\b/i;
  for (const page of pages.filter(item => item.ok && item.status >= 200 && item.status < 300)) {
    const signal = `${page.title || ''} ${page.h1Text || ''} ${String(page._text || '').slice(0, 280)}`;
    if (page.textWords < 250 && errorLike.test(signal)) candidates.push(page);
  }
  if (candidates.length) return finding(rule, 'watch', `${candidates.length}/${pages.length} successful sampled page(s) look error-like or missing-content-like in their title/H1/leading text. Verify rendered content and correct HTTP status before treating them as healthy Search pages.`, candidates.map(page => page.url));
  return finding(rule, 'pass', 'No successful sampled page matched the bounded soft-404 suspicion heuristic.', pages.filter(page => page.ok).map(page => page.url));
}

function linkFinding(rule, pages) {
  const htmlPages = pages.filter(page => page.ok && page.isHtml);
  if (!htmlPages.length) return finding(rule, 'not-applicable', 'No successfully fetched HTML page was available for anchor-markup review.');
  const risky = htmlPages.filter(page => page.links?.anchors > 0 && page.links.pseudoLinks > 0);
  const noInternal = htmlPages.filter(page => page.links?.anchors > 0 && page.links.internalCrawlable === 0);
  if (risky.length || noInternal.length) {
    const messages = [];
    if (risky.length) messages.push(`${risky.length} page(s) contain href-less or javascript/data pseudo-links`);
    if (noInternal.length) messages.push(`${noInternal.length} page(s) expose anchors but no crawlable same-origin href in raw HTML`);
    return finding(rule, 'watch', `${messages.join('; ')}. Review only important discovery/navigation paths; this bounded check does not require every interactive control to be a link.`, [...risky, ...noInternal].map(page => page.url));
  }
  return finding(rule, 'pass', 'No obvious href-less/javascript anchor problem was observed on sampled HTML pages, and pages with anchors expose crawlable same-origin hrefs.', htmlPages.map(page => page.url));
}

function textualFinding(rule, pages) {
  const available = pages.filter(page => page.ok);
  if (!available.length) return finding(rule, 'watch', 'No successfully fetched priority document was available for textual-content review.');
  const shellRisk = available.filter(page => page.isHtml && page.textWords < 80 && page.scriptCount >= 3);
  const empty = available.filter(page => page.textWords < 20);
  if (empty.length) return finding(rule, 'watch', `${empty.length}/${pages.length} sampled page(s) expose fewer than 20 meaningful text words. Verify rendered content and critical text availability with provider/browser tooling.`, empty.map(page => page.url));
  if (shellRisk.length) return finding(rule, 'watch', `${shellRisk.length}/${pages.length} sampled HTML page(s) expose fewer than 80 raw-text words while loading at least 3 scripts. This is a JS-shell risk signal, not proof that rendered content is unavailable.`, shellRisk.map(page => page.url));
  return finding(rule, 'pass', 'No sampled page matched the bounded empty-content or thin-raw-HTML/script-shell risk heuristic.', available.map(page => page.url));
}

function hreflangFinding(rule, pages) {
  const htmlPages = pages.filter(page => page.ok && page.isHtml);
  const withHreflang = htmlPages.filter(page => page.hreflang?.length);
  if (!withHreflang.length) return finding(rule, 'not-applicable', 'No hreflang annotations were observed in the successfully fetched HTML cohort.');
  const byUrl = new Map(htmlPages.map(page => [normalizeUrl(page.url), page]));
  const issues = [];
  for (const page of withHreflang) {
    const valid = page.hreflang.filter(item => item.url);
    if (valid.length !== page.hreflang.length) issues.push(`${page.url}: malformed/missing hreflang href`);
    if (!valid.some(item => normalizeUrl(item.url) === normalizeUrl(page.url))) issues.push(`${page.url}: hreflang cluster has no self reference`);
    for (const alt of valid) {
      const target = byUrl.get(normalizeUrl(alt.url));
      if (!target || normalizeUrl(target.url) === normalizeUrl(page.url)) continue;
      const reciprocal = (target.hreflang || []).some(item => item.url && normalizeUrl(item.url) === normalizeUrl(page.url));
      if (!reciprocal) issues.push(`${page.url}: sampled alternate ${target.url} does not link back`);
    }
  }
  if (issues.length) return finding(rule, 'watch', issues.slice(0, 10).join('; '), withHreflang.map(page => page.url), { issueCount: issues.length });
  return finding(rule, 'pass', `${withHreflang.length} sampled HTML page(s) use hreflang with valid self references and reciprocal links for alternate targets that were also inside the sampled cohort.`, withHreflang.map(page => page.url));
}

function bingFinding(rule, pages) {
  const restricted = pages.filter(page => page.ok && (page.bingSnippetBlocked || page.bingNoarchive || page.bingNocache || page.dataNosnippetCount > 0));
  if (restricted.length) {
    return finding(rule, 'watch', `${restricted.length}/${pages.length} sampled page(s) use preview/usage controls that Bing documents as potentially limiting captions, Copilot citation depth, or grounding use. Keep them when intentional; review them when Microsoft AI visibility is desired.`, restricted.map(page => page.url));
  }
  return finding(rule, 'pass', 'No sampled priority page exposed NOSNIPPET, NOCACHE, NOARCHIVE, or data-nosnippet controls relevant to Bing grounding/citation depth.', pages.filter(page => page.ok).map(page => page.url));
}

function duplicateFinding(rule, pages) {
  const ready = pages.filter(page => page.ok && page._text).map(page => ({ ...page, shingles: shingleSet(page._text) }));
  const pairs = [];
  for (let i = 0; i < ready.length; i += 1) {
    for (let j = i + 1; j < ready.length; j += 1) {
      if (ready[i].shingles.words < 150 || ready[j].shingles.words < 150) continue;
      const similarity = jaccard(ready[i].shingles.set, ready[j].shingles.set);
      if (similarity >= 0.92) pairs.push({ a: ready[i].url, b: ready[j].url, similarity });
    }
  }
  const titleMap = new Map();
  for (const page of ready.filter(item => item.isHtml)) if (page.title) {
    const key = page.title.toLowerCase();
    const urls = titleMap.get(key) || [];
    urls.push(page.url);
    titleMap.set(key, urls);
  }
  const duplicateTitles = [...titleMap.entries()].filter(([, urls]) => urls.length > 1);
  if (pairs.length || duplicateTitles.length) {
    return finding(rule, 'watch', `Near-duplicate review: ${pairs.length} content pair(s) at >=0.92 five-word-shingle similarity and ${duplicateTitles.length} repeated HTML title cluster(s). This is a route/template risk signal, not a spam verdict.`, [
      ...pairs.flatMap(pair => [pair.a, pair.b]),
      ...duplicateTitles.flatMap(([, urls]) => urls)
    ], { nearDuplicatePairs: pairs, duplicateTitleClusters: duplicateTitles.length });
  }
  return finding(rule, 'pass', 'No >=0.92 near-duplicate content pair or repeated non-empty HTML title cluster was observed in the sampled priority cohort.', ready.map(page => page.url));
}

function openaiFinding(rule, pages, robots) {
  if (robots?.ok) {
    const root = robotsRootAccess(robots.text, 'OAI-SearchBot');
    const gpt = robotsRootAccess(robots.text, 'GPTBot');
    const pagePolicies = pages.map(page => ({
      page,
      access: robotsPathAccess(robots.text, 'OAI-SearchBot', page.url || page.requestedUrl)
    }));
    const blockedPaths = pagePolicies.filter(item => item.access.status === 'blocked');
    const unreadableNoindex = pagePolicies.filter(item => item.page.ok && item.page.genericNoindex && item.access.status === 'blocked');
    const readableNoindex = pagePolicies.filter(item => item.page.ok && item.page.genericNoindex && item.access.status !== 'blocked');

    if (unreadableNoindex.length) {
      return finding(
        rule,
        'watch',
        `${unreadableNoindex.length}/${pages.length} sampled priority URL(s) expose a generic noindex directive while OAI-SearchBot is blocked from the same URL. OpenAI says the crawler must be allowed to crawl a page to read noindex; robots blocking alone is not proof that a learned URL/title cannot surface in ChatGPT Atlas. GPTBot=${gpt.status}; training policy remains separate.`,
        [robots.url, ...unreadableNoindex.map(item => item.page.url || item.page.requestedUrl)],
        { unreadableNoindexCount: unreadableNoindex.length, gptBotStatus: gpt.status }
      );
    }
    if (blockedPaths.length) {
      return finding(
        rule,
        'watch',
        `${blockedPaths.length}/${pages.length} sampled priority URL(s) appear blocked for OAI-SearchBot. This conflicts with ChatGPT summary/snippet discovery when visibility is intended, and OpenAI says robots blocking alone does not prove URL/title suppression; use readable noindex when suppression is the actual goal. GPTBot=${gpt.status}; Search discovery and training policy remain separate.`,
        [robots.url, ...blockedPaths.map(item => item.page.url || item.page.requestedUrl)],
        { blockedPathCount: blockedPaths.length, gptBotStatus: gpt.status }
      );
    }
    if (root.status === 'blocked') {
      return finding(rule, 'watch', `OAI-SearchBot appears root-blocked while GPTBot=${gpt.status}. This can be intentional, but it conflicts with a goal of inclusion in ChatGPT summaries/snippets. OpenAI also says robots blocking alone is not URL/title suppression evidence.`, [robots.url], { gptBotStatus: gpt.status });
    }
    if (readableNoindex.length) {
      return finding(
        rule,
        'pass',
        `${readableNoindex.length}/${pages.length} sampled priority URL(s) expose generic noindex while remaining crawlable to OAI-SearchBot, so the documented ChatGPT link/title suppression directive is readable in the bounded sample. GPTBot=${gpt.status}; this does not prove universal suppression, and training policy remains separate.`,
        [robots.url, ...readableNoindex.map(item => item.page.url)],
        { readableNoindexCount: readableNoindex.length, gptBotStatus: gpt.status }
      );
    }
    return finding(rule, 'pass', `No root-wide or sampled path-specific OAI-SearchBot block was observed. GPTBot=${gpt.status}; Search discovery and training policy remain separate.`, [robots.url], { gptBotStatus: gpt.status });
  }
  return finding(rule, 'watch', 'No readable robots.txt policy was observed for OpenAI. This is not treated as an explicit OAI-SearchBot block, but provider-specific fetch behavior is not inferred from Google robots error semantics.', [robots?.url, ...pages.slice(0, 2).map(page => page.url)]);
}

export function analyzeTechnicalIntegrityFromPages({
  canonicalUrl,
  pages,
  robots,
  generatedAt = new Date().toISOString(),
  cohort = null,
  registry = loadTechnicalIntegrityRules()
}) {
  const observed = pages.map(observePage);
  const byDetector = {
    'google-robots-fetch-state': rule => robotsFinding(rule, robots),
    'google-priority-url-robots-access': rule => priorityRobotsFinding(rule, observed, robots),
    'search-indexability': rule => indexabilityFinding(rule, observed),
    'google-ai-snippet-eligibility': rule => snippetFinding(rule, observed),
    'canonical-final-consistency': rule => canonicalFinding(rule, observed),
    'canonical-collision': rule => collisionFinding(rule, observed),
    'bounded-retrieval-footprint': rule => retrievalFootprintFinding(rule, observed),
    'soft-404-suspect': rule => soft404Finding(rule, observed),
    'crawlable-internal-link-markup': rule => linkFinding(rule, observed),
    'critical-content-textual': rule => textualFinding(rule, observed),
    'hreflang-cluster-integrity': rule => hreflangFinding(rule, observed),
    'bing-grounding-preview-controls': rule => bingFinding(rule, observed),
    'near-duplicate-priority-pages': rule => duplicateFinding(rule, observed),
    'openai-search-crawl-policy': rule => openaiFinding(rule, observed, robots)
  };
  const checks = registry.rules.map(rule => {
    const detector = byDetector[rule.detector];
    return detector
      ? detector(rule)
      : finding(rule, 'watch', `No executable detector is registered for ${rule.detector}.`);
  });
  const counts = { pass: 0, fail: 0, watch: 0, 'not-applicable': 0 };
  let p0Failures = 0;
  for (const check of checks) {
    counts[check.status] = (counts[check.status] || 0) + 1;
    if (check.priority === 'P0' && check.status === 'fail') p0Failures += 1;
  }
  return {
    version: TECHNICAL_INTEGRITY_VERSION,
    rulesVersion: registry.version,
    generatedAt,
    canonicalUrl,
    scope: 'Bounded public technical Search/AI integrity audit. It reports source-backed blockers and review signals without a composite score and without claiming indexing, ranking, citation, referral, or conversion outcomes.',
    cohort: cohort || {
      selectedPages: observed.length,
      urls: observed.map(page => page.url || page.requestedUrl)
    },
    summary: {
      counts,
      p0Failures,
      state: p0Failures ? 'blocked' : (counts.watch ? 'review' : 'clean')
    },
    robots: {
      url: robots?.url || null,
      ok: Boolean(robots?.ok),
      status: robots?.status ?? null
    },
    pages: observed.map(page => {
      const copy = { ...page };
      delete copy._text;
      return copy;
    }),
    checks,
    guardrails: {
      noCompositeScore: true,
      noRankingPromise: true,
      noCitationPromise: true,
      boundedSampleNotSiteWideProof: true,
      boundedFetchFailureIsNotIndexabilityFailure: true,
      nonHtmlDoesNotRequireHtmlCanonical: true,
      watchIsNotFailure: true,
      derivedHeuristicsAreNotPlatformRequirements: true
    },
    registry: 'registry/technical-integrity-rules.json'
  };
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

export async function technicalIntegrity(input, {
  maxPages = 20,
  concurrency = 4,
  timeoutMs = 8000,
  maxBytes = 512 * 1024,
  fetchImpl = fetch,
  resolveImpl
} = {}) {
  const gate = await siteGate(input, { maxPages, concurrency, timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) });
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const robotsUrl = new URL('/robots.txt', gate.canonicalUrl).href;
  const robotsResponse = await fetchPublicText(robotsUrl, {
    ...network,
    accept: 'text/plain, */*;q=0.1',
    userAgent: 'goose-technical-integrity/0.2'
  }).catch(error => ({ ok: false, status: null, url: robotsUrl, text: '', error: String(error.message ?? error) }));
  const robots = {
    url: robotsUrl,
    ok: Boolean(robotsResponse?.ok),
    status: robotsResponse?.status ?? null,
    text: robotsResponse?.ok ? robotsResponse.text : '',
    error: robotsResponse?.error || null
  };
  const pages = await mapLimit(gate.cohort.urls, concurrency, async url => {
    const response = await fetchPublicText(url, {
      ...network,
      accept: 'text/html, application/xhtml+xml;q=0.9, text/markdown;q=0.8, text/plain;q=0.7, */*;q=0.1',
      userAgent: 'goose-technical-integrity/0.2'
    }).catch(error => ({ ok: false, status: null, url, text: null, headers: {}, error: String(error.message ?? error) }));
    return {
      requestedUrl: url,
      url: response?.url || url,
      ok: Boolean(response?.ok),
      status: response?.status ?? null,
      contentType: response?.contentType || null,
      headers: response?.headers || {},
      bytes: response?.bytes ?? null,
      fetchBudgetBytes: maxBytes,
      html: response?.text ?? null,
      error: response?.error || null
    };
  });
  return analyzeTechnicalIntegrityFromPages({
    canonicalUrl: gate.canonicalUrl,
    pages,
    robots,
    cohort: {
      id: gate.cohort.id,
      digestSha256: gate.cohort.digestSha256,
      selectedPages: gate.cohort.selectedPages,
      selectionMethod: gate.cohort.selectionMethod,
      urls: gate.cohort.urls
    }
  });
}

export function formatTechnicalIntegrityReport(report) {
  const lines = [
    `Goose Technical Integrity v${report.version} — ${report.canonicalUrl}`,
    `State: ${report.summary.state}; P0 failures=${report.summary.p0Failures}; pass=${report.summary.counts.pass}; watch=${report.summary.counts.watch}`,
    `Cohort: ${report.cohort.selectedPages} page(s)${report.cohort.id ? `, ${report.cohort.id}` : ''}`,
    'No composite Search/AI score.',
    ''
  ];
  for (const check of report.checks) {
    lines.push(`${check.priority} ${check.status.toUpperCase().padEnd(14)} ${check.id} — ${check.message}`);
  }
  lines.push('', 'FAIL means a source-backed technical blocker was observed in the bounded sample. WATCH means review is warranted, not that Search/AI performance is broken.');
  return lines.join('\n');
}
