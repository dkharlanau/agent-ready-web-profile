import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSite } from './site-audit.mjs';
import { fetchPublicText } from './public-fetch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'growth-opportunities.json');

export const GROWTH_PROFILE_VERSION = '0.1';

export function loadGrowthRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function jsonLdNodes(html) {
  const out = [];
  for (const match of String(html || '').matchAll(/<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const payload = JSON.parse(match[1]);
      const queue = arrays(payload);
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        out.push(item);
        if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
      }
    } catch {
      // Invalid JSON-LD is treated as absent by this heuristic layer; audit should not crash.
    }
  }
  return out;
}

function typeNames(node) {
  return arrays(node?.['@type']).map(value => String(value).toLowerCase());
}

function hasType(node, names) {
  const wanted = new Set(arrays(names).map(value => String(value).toLowerCase()));
  return typeNames(node).some(value => wanted.has(value));
}

function sameAsCount(node) {
  return arrays(node?.sameAs).filter(value => typeof value === 'string' && /^https:\/\//i.test(value)).length;
}

function entitySignals(nodes) {
  const entities = nodes.filter(node => hasType(node, ['Organization', 'Person', 'ProfilePage']));
  const primary = entities.find(node => hasType(node, 'Organization')) || entities.find(node => hasType(node, 'ProfilePage')) || entities[0] || null;
  return {
    present: Boolean(primary),
    types: [...new Set(entities.flatMap(typeNames))],
    sameAs: primary ? sameAsCount(primary) : 0,
    hasUrl: Boolean(primary?.url || primary?.mainEntity?.url),
    hasName: Boolean(primary?.name || primary?.mainEntity?.name),
    hasLogoOrImage: Boolean(primary?.logo || primary?.image || primary?.mainEntity?.image)
  };
}

function articleSignals(nodes) {
  const articles = nodes.filter(node => hasType(node, ['Article', 'NewsArticle', 'BlogPosting']));
  return {
    count: articles.length,
    missingAuthor: articles.filter(node => !node.author).length,
    missingAuthorIdentity: articles.filter(node => {
      const authors = arrays(node.author);
      return authors.length && authors.every(author => typeof author !== 'object' || (!author.url && !author.sameAs));
    }).length,
    missingDatePublished: articles.filter(node => !node.datePublished).length,
    missingDateModified: articles.filter(node => !node.dateModified).length
  };
}

function mediaSignals(html) {
  const text = String(html || '');
  return {
    images: (text.match(/<img\b/gi) || []).length,
    videos: (text.match(/<(?:video|iframe)\b[^>]*(?:youtube|vimeo|video)/gi) || []).length,
    openGraphImage: /<meta\b[^>]*property\s*=\s*(?:"og:image"|'og:image'|og:image)[^>]*>/i.test(text)
  };
}

function faqSignals(nodes) {
  return { faqPage: nodes.some(node => hasType(node, 'FAQPage')) };
}

export function parseContentSignal(text) {
  const line = String(text || '').match(/^\s*Content-Signal\s*:\s*(.+)$/im)?.[1]?.trim() || null;
  if (!line) return { observed: false, raw: null, values: {} };
  const values = {};
  for (const token of line.split(',').map(value => value.trim()).filter(Boolean)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    values[token.slice(0, eq).trim().toLowerCase()] = token.slice(eq + 1).trim().toLowerCase();
  }
  return { observed: true, raw: line, values };
}

function priorityRank(priority) {
  return ({ P0: 0, 'P0-when-targeted': 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 9);
}

function action({ id, priority, lane, title, reason, status = 'recommended', source = null, implementation = null, evidence = [] }) {
  return { id, priority, lane, title, status, reason, source, implementation, evidence };
}

function auditActions(audit) {
  const out = [];
  for (const item of audit?.checks || []) {
    if (item.status === 'pass' || item.status === 'observed' || item.status === 'not-applicable' || item.status === 'watch') continue;
    const required = String(item.priority || '').startsWith('required');
    const priority = item.status === 'fail' && required ? 'P0' : item.status === 'fail' ? 'P1' : required ? 'P1' : 'P2';
    out.push(action({
      id: `audit:${item.id}`,
      priority,
      lane: item.layer || 'eligibility',
      title: item.title,
      reason: item.message,
      status: item.status,
      source: item.source,
      evidence: item.evidence || []
    }));
  }
  return out;
}

function contentSignalAction(signal, canonicalUrl, source) {
  if (!signal.observed) {
    return action({
      id: 'growth:cloudflare-content-signals',
      priority: 'P2',
      lane: 'ai-access',
      title: 'Declare AI search/reference use separately from model training where compatible',
      reason: 'No Cloudflare Content-Signal directive was observed. This is optional and provider-specific, but it can make search/AI-input/training intent explicit for compatible crawlers.',
      source,
      implementation: {
        file: '/robots.txt',
        suggestedPolicy: 'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
        note: 'Use only if this reflects the publisher’s actual policy. This is not a Google ranking signal.'
      },
      evidence: [`${new URL(canonicalUrl).origin}/robots.txt`]
    });
  }
  const blocks = [];
  if (signal.values.search === 'no') blocks.push('search=no');
  if (signal.values['ai-input'] === 'no') blocks.push('ai-input=no');
  if (!blocks.length) return null;
  return action({
    id: 'growth:cloudflare-content-signals',
    priority: 'P1',
    lane: 'ai-access',
    title: 'Review Content-Signal restrictions against the site’s AI visibility goal',
    reason: `Observed ${blocks.join(', ')}. Compatible crawlers may treat these as restrictions for search indexing or real-time AI input.`,
    source,
    implementation: {
      file: '/robots.txt',
      note: 'Do not change policy merely for visibility; align it with the publisher’s rights and distribution intent.'
    }
  });
}

export function buildGrowthPlanFromObservations({ audit, homepage, robots, registry = loadGrowthRegistry() }) {
  const canonicalUrl = audit?.canonicalUrl || homepage?.url;
  if (!canonicalUrl) throw new Error('Growth planning requires a canonical URL.');
  const nodes = jsonLdNodes(homepage?.text);
  const entity = entitySignals(nodes);
  const article = articleSignals(nodes);
  const media = mediaSignals(homepage?.text);
  const faq = faqSignals(nodes);
  const contentSignal = parseContentSignal(robots?.text);
  const opportunities = new Map(registry.opportunities.map(item => [item.id, item]));
  const actions = auditActions(audit);

  const contentSignalRule = opportunities.get('cloudflare-content-signals');
  const csa = contentSignalAction(contentSignal, canonicalUrl, contentSignalRule?.source || null);
  if (csa) actions.push(csa);

  const identityRule = opportunities.get('google-entity-identity');
  if (!entity.present) {
    actions.push(action({
      id: 'growth:entity-identity', priority: 'P1', lane: 'entity-identity', title: 'Publish a canonical Organization/Person identity graph',
      reason: 'No Organization, Person or ProfilePage JSON-LD was observed on the audited page. A coherent entity identity helps search systems understand who operates or authors the site.',
      source: identityRule?.source,
      implementation: { template: 'templates/growth/organization.jsonld', placement: 'homepage or canonical About page' }
    }));
  } else if (!entity.sameAs) {
    actions.push(action({
      id: 'growth:entity-sameas', priority: 'P2', lane: 'entity-identity', title: 'Connect the site entity to authoritative external profiles',
      reason: 'Entity structured data exists, but no valid sameAs URLs were observed on the primary entity heuristic.',
      source: identityRule?.source,
      implementation: { field: 'sameAs', note: 'Link only real authoritative profiles; do not manufacture mentions.' }
    }));
  }

  const whoRule = opportunities.get('google-who-how-why');
  if (article.count && (article.missingAuthor || article.missingAuthorIdentity)) {
    actions.push(action({
      id: 'growth:article-authorship', priority: 'P1', lane: 'content-quality', title: 'Make article authorship resolvable',
      reason: `${article.count} Article-like JSON-LD node(s) observed; ${article.missingAuthor} missing author and ${article.missingAuthorIdentity} lack an author URL/sameAs identity link.`,
      source: whoRule?.source,
      implementation: { template: 'templates/growth/article.jsonld', note: 'Use accurate bylines and author/profile URLs where readers would expect them.' }
    }));
  }

  const dateRule = opportunities.get('google-publication-dates');
  if (article.count && (article.missingDatePublished || article.missingDateModified)) {
    actions.push(action({
      id: 'growth:article-dates', priority: 'P1', lane: 'freshness', title: 'Align visible and structured publication/update dates',
      reason: `${article.count} Article-like JSON-LD node(s) observed; ${article.missingDatePublished} missing datePublished and ${article.missingDateModified} missing dateModified.`,
      source: dateRule?.source,
      implementation: { template: 'templates/growth/article.jsonld', note: 'Only update dateModified after a real significant change and keep visible/structured dates consistent.' }
    }));
  }

  const mediaRule = opportunities.get('google-multiformat-content');
  if (!media.images && !media.videos && !media.openGraphImage) {
    actions.push(action({
      id: 'growth:multiformat', priority: 'P2', lane: 'citation', title: 'Add relevant original visual evidence to important pages',
      reason: 'No image/video/og:image signal was observed on the audited page. Where useful, original diagrams, screenshots, charts or video can create additional Search discovery surfaces.',
      source: mediaRule?.source,
      implementation: { note: 'Do not add decorative media solely for SEO. Prefer evidence-bearing visuals with useful alt text/captions.' }
    }));
  }

  const faqRule = opportunities.get('google-faq-rich-result-deprecated');
  if (faq.faqPage) {
    actions.push(action({
      id: 'growth:faq-deprecation', priority: 'P2', lane: 'governance', title: 'Do not rely on FAQPage markup as a current Google rich-result tactic',
      reason: 'FAQPage JSON-LD was observed, while Google deprecated FAQ rich results in May 2026. Keep the markup only for a real semantic/consumer use case.',
      source: faqRule?.source,
      status: 'review'
    }));
  }

  const qualityRule = opportunities.get('google-non-commodity-evidence');
  actions.push(action({
    id: 'growth:non-commodity-review', priority: 'P1', lane: 'content-quality', title: 'Run the non-commodity content review on priority landing/article pages',
    reason: 'Originality, first-hand expertise, evidence and usefulness cannot be honestly inferred from a homepage fetch. This remains a required human editorial review for growth-critical pages.',
    source: qualityRule?.source,
    status: 'manual',
    implementation: { template: 'templates/growth/content-quality-checklist.md' }
  }));

  const repRule = opportunities.get('google-site-reputation-abuse');
  actions.push(action({
    id: 'growth:site-reputation-policy', priority: 'P1', lane: 'governance', title: 'Keep third-party content within the site’s real editorial purpose',
    reason: 'A crawler cannot determine commercial/control relationships reliably. Review sponsored, partner, white-label and third-party sections so they are not published primarily to exploit host reputation.',
    source: repRule?.source,
    status: 'manual'
  }));

  for (const id of ['google-generative-ai-measurement-global', 'bing-ai-citation-measurement', 'google-platform-properties']) {
    const item = opportunities.get(id);
    if (!item) continue;
    actions.push(action({
      id: `growth:${id}`,
      priority: item.priority,
      lane: item.lane,
      title: item.title,
      reason: 'Requires authenticated owner-side measurement and therefore cannot be inferred from public crawling.',
      source: item.source,
      status: 'external-owner-data'
    }));
  }

  const preferred = opportunities.get('google-preferred-sources-acquisition');
  const domain = new URL(canonicalUrl).hostname;
  actions.push(action({
    id: 'growth:preferred-source-acquisition', priority: 'P2', lane: 'citation', title: 'Add a Preferred Sources CTA when the site has repeat readers',
    reason: 'This can increase prominence for users who explicitly select the domain as a preferred source in supported Google surfaces.',
    source: preferred?.source,
    status: 'opportunity',
    implementation: { url: `https://www.google.com/preferences/source?q=${domain}`, template: 'templates/growth/preferred-source.html' }
  }));

  const deduped = [...new Map(actions.map(item => [item.id, item])).values()]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.lane.localeCompare(b.lane) || a.id.localeCompare(b.id));
  const summary = deduped.reduce((acc, item) => {
    acc.byPriority[item.priority] = (acc.byPriority[item.priority] || 0) + 1;
    acc.byLane[item.lane] = (acc.byLane[item.lane] || 0) + 1;
    return acc;
  }, { totalActions: deduped.length, byPriority: {}, byLane: {} });

  return {
    growthProfileVersion: GROWTH_PROFILE_VERSION,
    profile: registry.profile,
    reviewedAt: registry.reviewedAt,
    canonicalUrl,
    goal: registry.goal,
    summary,
    observations: { entity, article, media, faq, contentSignal },
    actions: deduped,
    recommendedSurfaces: [
      '/robots.txt', '/sitemap.xml', 'canonical About/author identity page', 'Organization/Person JSON-LD',
      'Article JSON-LD where applicable', 'stable heading fragment IDs', 'Search Console + Bing Webmaster Tools measurement'
    ],
    guardrails: registry.guardrails,
    note: 'ARWP Growth Profile prioritizes observable blockers and source-backed opportunities. It does not predict or guarantee ranking, citation, recommendation, traffic or conversion outcomes.'
  };
}

export async function buildGrowthPlan(input, { timeoutMs = 8000, maxBytes = 512 * 1024, fetchImpl = fetch, resolveImpl } = {}) {
  const audit = await auditSite(input, { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) });
  const canonical = new URL(audit.canonicalUrl);
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const homepage = await fetchPublicText(canonical.href, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-growth/0.1' });
  const robots = await fetchPublicText(new URL('/robots.txt', canonical.origin).href, { ...network, accept: 'text/plain, */*;q=0.1', userAgent: 'arwp-growth/0.1' });
  return buildGrowthPlanFromObservations({ audit, homepage, robots });
}

export function formatGrowthPlan(plan) {
  const lines = [
    `ARWP Growth Profile ${plan.profile}`,
    `Target: ${plan.canonicalUrl}`,
    `Actions: ${plan.summary.totalActions}`,
    ''
  ];
  let current = null;
  for (const item of plan.actions) {
    if (item.priority !== current) {
      current = item.priority;
      lines.push(`${current}`);
    }
    lines.push(`- [${item.lane}] ${item.title}`);
    lines.push(`  ${item.reason}`);
    if (item.implementation?.file) lines.push(`  File: ${item.implementation.file}`);
    if (item.implementation?.url) lines.push(`  URL: ${item.implementation.url}`);
    if (item.source) lines.push(`  Source: ${item.source}`);
  }
  lines.push('', plan.note);
  return lines.join('\n');
}
