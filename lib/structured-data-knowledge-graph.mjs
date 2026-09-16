import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchPublicText } from './public-fetch.mjs';

const registryPath = fileURLToPath(new URL('../registry/structured-data-knowledge-graph.json', import.meta.url));
const CONTRACT = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const norm = value => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const visibleText = html => norm(String(html || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' '));

function attrs(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function resolve(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { return new URL(value, base).href; } catch { return null; }
}

function canonical(html, fallback) {
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    if (String(a.rel || '').toLowerCase().split(/\s+/).includes('canonical') && a.href) {
      const resolved = resolve(a.href, fallback);
      if (resolved) return resolved;
    }
  }
  return fallback;
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const a = attrs(`<script ${match[1]}>`);
    if (String(a.type || '').toLowerCase() !== 'application/ld+json') continue;
    try {
      out.push({ value: JSON.parse(match[2]) });
    } catch (error) {
      out.push({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  return out;
}

function typeList(node) {
  return arr(node?.['@type']).map(String).filter(Boolean);
}

const families = new Map();
for (const family of CONTRACT.entityFamilies) {
  for (const type of family.types) families.set(type, family);
}

const relationProperties = new Set(CONTRACT.relationshipChecks.map(item => item.property));
for (const family of CONTRACT.entityFamilies) {
  for (const relation of family.relations || []) relationProperties.add(relation.property);
}
for (const property of ['about', 'author', 'brand', 'creator', 'hasPart', 'inDefinedTermSet', 'isPartOf', 'isRelatedTo', 'itemOffered', 'mainEntity', 'maintainer', 'mentions', 'organizer', 'provider', 'publisher', 'subjectOf', 'workFeatured']) relationProperties.add(property);

function familyFor(node) {
  for (const type of typeList(node)) {
    const family = families.get(type);
    if (family) return family;
  }
  return null;
}

function hasExpression(node, expression) {
  return String(expression).split('|').some(property => {
    const value = node?.[property];
    return value != null && arr(value).length > 0;
  });
}

function referencedId(value, base) {
  if (typeof value === 'string') return resolve(value, base);
  if (!value || typeof value !== 'object') return null;
  return resolve(value['@id'] || value.url, base);
}

function collectTypedNodes(value, base, state, parent = null, property = null) {
  if (Array.isArray(value)) {
    for (const item of value) collectTypedNodes(item, base, state, parent, property);
    return;
  }
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value['@graph'])) {
    for (const item of value['@graph']) collectTypedNodes(item, base, state, null, null);
    for (const [key, child] of Object.entries(value)) {
      if (key !== '@graph' && key !== '@context') collectTypedNodes(child, base, state, parent, key);
    }
    return;
  }

  const types = typeList(value);
  let current = parent;
  if (types.length) {
    const explicitId = resolve(value['@id'], base);
    const declaredUrl = resolve(value.url, base);
    const id = explicitId || declaredUrl || `${base}#arwp-anonymous-${++state.anonymous}`;
    current = {
      id,
      explicitId,
      declaredUrl,
      types,
      node: value,
      family: familyFor(value),
      page: base,
      parentId: parent?.id || null,
      parentProperty: property || null
    };
    state.nodes.push(current);
  }

  for (const [key, child] of Object.entries(value)) {
    if (['@context', '@graph', '@type', '@id'].includes(key)) continue;
    if (child && typeof child === 'object') collectTypedNodes(child, base, state, current, key);
  }
}

function nodeRelations(node, base) {
  const out = [];
  for (const property of relationProperties) {
    for (const value of arr(node.node[property])) {
      const target = referencedId(value, base);
      const targetTypes = value && typeof value === 'object' ? typeList(value) : [];
      if (target || targetTypes.length) out.push({ property, target, targetTypes });
    }
  }
  return out;
}

function gap(priority, code, entity, problem, recommendation, page) {
  return {
    priority,
    code,
    entityId: entity?.id || null,
    entityTypes: entity?.types || [],
    family: entity?.family?.id || null,
    page: page || entity?.page || null,
    problem,
    recommendation
  };
}

function analyzeObservedPages(observedPages) {
  const nodes = observedPages.flatMap(page => page.nodes);
  const byId = new Map();
  for (const node of nodes) {
    if (!byId.has(node.id)) byId.set(node.id, []);
    byId.get(node.id).push(node);
  }

  const gaps = [];
  for (const page of observedPages) {
    for (const error of page.parseErrors) {
      gaps.push(gap('P0', 'json-ld-parse-error', null, `JSON-LD could not be parsed: ${error}`, 'Fix the malformed JSON-LD before evaluating graph completeness.', page.canonicalUrl));
    }
  }

  const visibleFamilies = new Set(['site', 'organization', 'local-business', 'place', 'service', 'offer-catalog', 'product', 'product-group', 'dataset', 'data-catalog', 'article', 'event', 'term', 'term-set']);

  for (const node of nodes) {
    const family = node.family;
    if (!family) continue;

    if (family.stableIdentity === 'required-for-arwp-maturity' && !node.explicitId) {
      gaps.push(gap('P1', 'stable-id-missing', node, `${node.types.join('/')} is a reusable first-class entity without an explicit stable @id.`, 'Assign one absolute canonical @id and reuse it for the same entity across pages.'));
    }

    for (const expression of family.coreProperties || []) {
      if (!hasExpression(node.node, expression)) {
        gaps.push(gap('P1', `core-property-missing:${expression}`, node, `${node.types.join('/')} is missing the ARWP core property ${expression}.`, `Add ${expression.replace('|', ' or ')} only when the fact is known and grounded.`));
      }
    }

    const name = typeof node.node.name === 'string' ? node.node.name.trim() : typeof node.node.headline === 'string' ? node.node.headline.trim() : '';
    if (name && visibleFamilies.has(family.id)) {
      const page = observedPages.find(item => item.canonicalUrl === node.page);
      if (page && !page.visible.includes(norm(name))) {
        gaps.push(gap('P1', 'visible-name-parity', node, `Structured-data name/headline "${name}" is not visible on the observed page.`, 'Align the visible first-party entity name with structured data or remove unsupported machine-only facts.'));
      }
    }
  }

  for (const [id, sameIdNodes] of byId) {
    if (!id || sameIdNodes.length < 2) continue;
    const names = new Set(sameIdNodes.map(node => norm(node.node.name || node.node.headline)).filter(Boolean));
    const typeSignatures = new Set(sameIdNodes.map(node => [...node.types].sort().join('|')));
    if (names.size > 1 || typeSignatures.size > 1) {
      gaps.push(gap('P0', 'conflicting-reused-id', sameIdNodes[0], `The same @id is reused with conflicting names or types: ${id}`, 'Resolve the identity conflict before adding more structured data.'));
    }
  }

  const observedIds = new Set(nodes.map(node => node.id));
  for (const node of nodes) {
    for (const relation of nodeRelations(node, node.page)) {
      if (!relation.target) continue;
      try {
        const targetUrl = new URL(relation.target);
        const pageUrl = new URL(node.page);
        if (targetUrl.origin === pageUrl.origin && !observedIds.has(relation.target)) {
          gaps.push(gap('P2', `unresolved-internal-relation:${relation.property}`, node, `${relation.property} points to an internal entity @id that was not observed in the supplied pages: ${relation.target}`, 'Ensure the referenced entity is emitted with the same stable @id on an appropriate canonical page.'));
        }
      } catch {
        // Resolution failures are handled by the source value being unusable rather than guessed.
      }
    }
  }

  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  gaps.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || a.code.localeCompare(b.code));
  const familyCounts = {};
  for (const node of nodes) {
    if (node.family) familyCounts[node.family.id] = (familyCounts[node.family.id] || 0) + 1;
  }

  return {
    reportVersion: '0.1',
    contractVersion: CONTRACT.version,
    scope: 'observed-structured-data-knowledge-graph-not-search-score',
    pages: observedPages.map(page => ({
      url: page.url,
      canonicalUrl: page.canonicalUrl,
      jsonLdBlocks: page.jsonLdBlocks,
      typedNodes: page.nodes.length,
      parseErrors: page.parseErrors.length
    })),
    entityFamilies: familyCounts,
    entities: nodes.map(node => ({
      id: node.id,
      explicitStableId: Boolean(node.explicitId),
      types: node.types,
      family: node.family?.id || null,
      page: node.page,
      relations: nodeRelations(node, node.page)
    })),
    gaps,
    summary: {
      pagesObserved: observedPages.length,
      entitiesObserved: nodes.length,
      familiesObserved: Object.keys(familyCounts).length,
      parseErrors: observedPages.reduce((sum, page) => sum + page.parseErrors.length, 0),
      gaps: gaps.reduce((acc, item) => {
        acc[item.priority] = (acc[item.priority] || 0) + 1;
        return acc;
      }, { P0: 0, P1: 0, P2: 0, P3: 0 })
    },
    guardrails: {
      noUniversalSchemaBundle: true,
      noRichResultPromise: true,
      noInventedOwnerFacts: true,
      visibleFactsBeforeMetadata: true,
      providerEligibilitySeparate: true,
      mapEmbedDoesNotSubstituteForPlaceSemantics: true
    },
    doesNotProve: [
      'Google or Bing rich-result eligibility',
      'indexing or ranking',
      'Knowledge Panel inclusion',
      'AI citation or recommendation inclusion',
      'whole-site completeness beyond the supplied/observed pages',
      'business legitimacy or commercial outcomes'
    ]
  };
}

export function analyzeStructuredDataPages(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('pages must be a non-empty array.');
  const observedPages = pages.map(page => {
    if (!page?.url || typeof page.html !== 'string') throw new Error('Each page requires url and html.');
    const canonicalUrl = canonical(page.html, page.url);
    const state = { nodes: [], anonymous: 0 };
    const parseErrors = [];
    const blocks = jsonLdBlocks(page.html);
    for (const block of blocks) {
      if (block.error) parseErrors.push(block.error);
      else collectTypedNodes(block.value, canonicalUrl, state);
    }
    return {
      url: page.url,
      canonicalUrl,
      visible: visibleText(page.html),
      jsonLdBlocks: blocks.length,
      parseErrors,
      nodes: state.nodes
    };
  });
  return analyzeObservedPages(observedPages);
}

export function analyzeStructuredDataHtml(html, { url = 'https://example.invalid/' } = {}) {
  return analyzeStructuredDataPages([{ url, html }]);
}

export async function analyzeStructuredDataUrl(input, { timeoutMs = 8000, maxBytes = 512 * 1024, fetchImpl = fetch, resolveImpl } = {}) {
  const url = new URL(input);
  if (url.protocol !== 'https:') throw new Error('Structured-data analysis requires a public HTTPS URL.');
  const fetched = await fetchPublicText(url.href, {
    timeoutMs,
    maxBytes,
    fetchImpl,
    ...(resolveImpl ? { resolveImpl } : {}),
    accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
    userAgent: 'arwp-structured-data/0.1'
  });
  if (!fetched.ok || !fetched.text) throw new Error(`Unable to fetch page: HTTP ${fetched.status ?? 'unknown'}`);
  const report = analyzeStructuredDataPages([{ url: fetched.url || url.href, html: fetched.text }]);
  report.discovery = { input: url.href, finalUrl: fetched.url || url.href, timeoutMs, maxBytes };
  return report;
}

export function formatStructuredDataReport(report) {
  const lines = [
    `Structured Data & Knowledge Graph — ${report.pages[0]?.canonicalUrl || 'unknown'}`,
    `Scope: ${report.scope}`,
    `Pages observed: ${report.summary.pagesObserved}`,
    `Entities observed: ${report.summary.entitiesObserved}`,
    `Families observed: ${report.summary.familiesObserved}`,
    `Gaps: P0 ${report.summary.gaps.P0}, P1 ${report.summary.gaps.P1}, P2 ${report.summary.gaps.P2}, P3 ${report.summary.gaps.P3}`
  ];
  for (const item of report.gaps.slice(0, 30)) lines.push(`- ${item.priority} ${item.code}: ${item.problem}`);
  if (report.gaps.length > 30) lines.push(`- ... ${report.gaps.length - 30} more gaps omitted from text output`);
  lines.push('This is a structured-data graph audit, not a ranking, rich-result, Knowledge Panel or AI-citation score.');
  return lines.join('\n');
}

export { CONTRACT as structuredDataKnowledgeGraphContract };
