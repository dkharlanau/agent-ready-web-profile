import { createHash } from 'node:crypto';
import { fetchPublicText, mediaTypeOnly } from './public-fetch.mjs';
import { primarySourceText, sourceMarkup, sourceText } from './html-source.mjs';

const hash = text => createHash('sha256').update(String(text ?? '')).digest('hex');
const decode = text => String(text).replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {
  const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
}).replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const normalize = text => decode(sourceText(text)).normalize('NFKC').replace(/\s+/g, ' ').trim();
const absolute = (value, base) => {
  try { const u = new URL(value, base); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
};
function attributes(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = decode(sourceText(m[2] ?? m[3] ?? m[4]));
  return out;
}
export function extractRepresentation(html, url) {
  const markup = sourceMarkup(html);
  const links = [...markup.matchAll(/<a\b[^>]*>/gi)].map(m => absolute(attributes(m[0]).href, url)).filter(Boolean);
  let canonical = null;
  for (const m of markup.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    if (a.rel?.toLowerCase().split(/\s+/).includes('canonical')) canonical = absolute(a.href, url);
  }
  const blocks = [], errors = [];
  for (const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(m[1]).type?.toLowerCase() !== 'application/ld+json') continue;
    try { blocks.push(JSON.parse(m[2])); } catch { errors.push('Invalid HTML JSON-LD'); }
  }
  return { text: normalize(primarySourceText(html).text), canonical, links: [...new Set(links)], blocks, errors };
}
function entityIds(blocks) {
  const ids = new Set();
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    if (typeof value['@id'] === 'string') ids.add(value['@id']);
    Object.values(value).forEach(walk);
  }
  blocks.forEach(walk);
  return [...ids];
}
function entityDefinitions(blocks, id) {
  const definitions = new Set();
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    if (value['@id'] === id && Object.keys(value).some(key => key !== '@id' && key !== '@context')) definitions.add(JSON.stringify(stable(value)));
    Object.values(value).forEach(walk);
  };
  blocks.forEach(walk);
  return [...definitions];
}
function markdownRepresentation(markdown, url) {
  const blocks = [], errors = [];
  const body = String(markdown).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/```(?:json|jsonld|application\/ld\+json)\s*\n([\s\S]*?)```/gi, (_, raw) => {
    try { blocks.push(JSON.parse(raw)); } catch { errors.push('Invalid Markdown JSON block'); }
    return '';
  });
  const links = [...body.matchAll(/\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)].map(m => absolute(m[1], url)).filter(Boolean);
  return { text: normalize(body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[#>*-]+\s*/gm, '').replace(/[*_`]/g, '')), links, blocks, errors };
}
function receipt(value) {
  return value ? { url: value.url, requestedUrl: value.requestedUrl ?? value.url, canonicalBaseUrl: value.canonicalBaseUrl ?? null,
    requestedAt: value.requestedAt ?? null, observedAt: value.observedAt ?? null,
    ok: value.ok, status: value.status ?? null, contentType: value.contentType ?? null,
    bytes: value.bytes ?? null, sha256: typeof value.text === 'string' ? hash(value.text) : null,
    headers: Object.fromEntries(['vary', 'link', 'xRobotsTag', 'contentUsage', 'contentSignal', 'etag', 'lastModified']
      .filter(key => value.headers?.[key] != null).map(key => [key, value.headers[key]])), error: value.error ?? null } : null;
}
export function reviewRepresentations({ url, html, markdown, contract = {} }) {
  const checks = [];
  const add = (id, state, message) => checks.push({ id, state, message });
  const h = html?.ok && ['text/html', 'application/xhtml+xml'].includes(mediaTypeOnly(html.contentType)) ? extractRepresentation(html.text, html.canonicalBaseUrl || html.url || url) : null;
  const mdType = mediaTypeOnly(markdown?.contentType);
  const m = markdown?.ok && mdType === 'text/markdown' ? markdownRepresentation(markdown.text, markdown.canonicalBaseUrl || markdown.url || url) : null;
  if (!h) add('html', 'unknown', 'No successful complete HTML representation was captured.');
  if (!m) add('markdown', contract.markdownRequired === true && markdown?.status === 404 ? 'fail' : 'unknown', 'No text/markdown representation was captured; HTML fallback is not a Markdown defect or sitewide finding.');
  if (h) add('html-jsonld', h.errors.length ? 'fail' : 'pass', h.errors.length ? h.errors.join('; ') : 'Captured HTML JSON-LD parses.');
  if (m) add('markdown-json', m.errors.length ? 'fail' : 'pass', m.errors.length ? m.errors.join('; ') : 'Captured Markdown JSON blocks parse.');
  if (h && m) {
    if (h.canonical) {
      const headerCanonicals = [...String(markdown.headers?.link || '').matchAll(/<([^>]+)>\s*;\s*rel\s*=\s*"?canonical"?/gi)].map(match => absolute(match[1], url));
      add('canonical-link', m.links.includes(h.canonical) || headerCanonicals.includes(h.canonical) ? 'pass' : 'watch', 'Markdown should identify the HTML canonical through a link or HTTP Link relation.');
    }
    for (const [index, item] of (contract.requiredText || []).entries()) {
      if (!item || typeof item.text !== 'string' || !normalize(item.text)) throw Error('requiredText needs nonempty text and an evidence role.');
      const needle = normalize(item.text);
      const sourceHas = h.text.includes(needle), targetHas = m.text.includes(needle);
      add(`text:${index}:${item.role || 'content'}`, !sourceHas ? 'unknown' : targetHas ? 'pass' : 'fail',
        !sourceHas ? 'Expected text is absent from captured HTML; stale contract or source scope needs review.' : targetHas ? 'The declared source passage is retained.' : 'A declared source passage is absent from Markdown.');
    }
    for (const link of contract.requiredLinks || []) {
      const resolved = absolute(link, url);
      if (!resolved) throw Error('requiredLinks must resolve to HTTP(S) URLs.');
      add(`link:${hash(resolved).slice(0, 12)}`, !h.links.includes(resolved) ? 'unknown' : m.links.includes(resolved) ? 'pass' : 'fail', 'Check the declared evidence/continuation link against both captures.');
    }
    const sourceIds = entityIds(h.blocks), targetIds = entityIds(m.blocks);
    for (const id of contract.requiredEntityIds || []) {
      add(`entity:${hash(id).slice(0, 12)}`, !sourceIds.includes(id) ? 'unknown' : targetIds.includes(id) ? 'pass' : 'fail', 'Check the explicitly required JSON-LD identity; no new entity is inferred.');
      const source = entityDefinitions(h.blocks, id), target = entityDefinitions(m.blocks, id);
      if (source.length) add(`entity-facts:${hash(id).slice(0, 12)}`, source.length !== 1 || target.length > 1 ? 'unknown' : source[0] === target[0] ? 'pass' : 'fail', 'Exact declared JSON-LD definition comparison; ambiguous split definitions require review. This is not general RDF equivalence.');
    }
    if (!(contract.requiredText?.length || contract.requiredLinks?.length || contract.requiredEntityIds?.length)) add('parity-scope', 'watch', 'No explicit content contract supplied; successful delivery does not establish content or semantic parity.');
    if (html.url === markdown.url && !String(markdown.headers?.vary || '').toLowerCase().split(',').map(x => x.trim()).some(x => x === 'accept' || x === '*')) add('vary-accept', 'watch', 'Negotiated representations at one URL need cache separation; Vary: Accept was not observed.');
  }
  return { version: '0.1', kind: 'agent-representation-review', url, html: receipt(html), markdown: receipt(markdown), checks,
    state: checks.some(x => x.state === 'fail') ? 'fail' : checks.some(x => x.state === 'unknown') ? 'unknown' : checks.some(x => x.state === 'watch') ? 'watch' : 'pass',
    guardrails: { sourcePassagesOnly: true, semanticEquivalenceNotEstablished: true, noRankingOrCitationClaim: true, noRightsGrant: true, boundedSample: true } };
}
export function representationSurfaceObservation(review, expectationId) {
  return { expectationId, state: review.state === 'pass' ? 'present' : review.state === 'fail' ? 'incomplete' : 'not-assessed',
    evidence: [review.html?.sha256, review.markdown?.sha256].filter(Boolean).map(value => 'sha256:' + value),
    note: 'Bounded declared passages, links and entities only; no semantic-equivalence or Search outcome claim.' };
}
export async function captureRepresentations(page, options = {}) {
  const url = new URL(page.url);
  const markdownUrl = new URL(page.markdownUrl || page.url);
  if (url.origin !== markdownUrl.origin) throw Error('Markdown must belong to the same origin.');
  const capture = async (target, accept) => {
    const requestedAt = new Date().toISOString();
    try { return { ...await fetchPublicText(target, { ...options, accept, userAgent: 'goose-representations/0.1' }), requestedUrl: target, requestedAt, observedAt: new Date().toISOString() }; }
    catch (error) { return { url: target, ok: false, status: null, text: null, requestedAt, observedAt: new Date().toISOString(), error: error.message }; }
  };
  const [html, markdown] = await Promise.all([capture(url.href, 'text/html'), capture(markdownUrl.href, 'text/markdown')]);
  return { url: url.href, html, markdown, contract: page.contract || {} };
}
