import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
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

function sourceText(document) {
  // This is source-text screening, not a rendered visibility calculation.
  // A real HTML parser preserves nesting and quoted attribute boundaries.
  const stack = [[document, false]], pieces = [], hiddenPieces = [];
  const excluded = new Set(['head', 'script', 'style', 'template', 'noscript']);
  while (stack.length) {
    const [node, parentHidden] = stack.pop();
    if (node.nodeName === '#text') { (parentHidden ? hiddenPieces : pieces).push(node.value); continue; }
    if (excluded.has(node.tagName)) continue;
    const hidden = parentHidden || Boolean(node.attrs?.some(attr => attr.name === 'hidden'));
    if (node.childNodes) for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push([node.childNodes[i], hidden]);
  }
  return { eligible: norm(pieces.join(' ')), hidden: norm(hiddenPieces.join(' ')) };
}

function resolve(value, base) {
  if (typeof value !== 'string') return null;
  try { return base == null ? new URL(value).href : new URL(value, base).href; } catch { return null; }
}

function resolveId(value, base) {
  if (typeof value === 'string' && /^_:\S+$/.test(value)) return value;
  return resolve(value, base);
}

function* htmlElements(document, tagName) {
  const stack = [document];
  while (stack.length) {
    const node = stack.pop();
    // Template contents are a separate inert fragment. noscript is conditional
    // on scripting and is excluded from this bounded source observation.
    if (node.tagName === 'template' || node.tagName === 'noscript') continue;
    if (node.tagName === tagName && node.namespaceURI === 'http://www.w3.org/1999/xhtml') yield node;
    if (node.childNodes) for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
  }
}

function elementAttributes(node) {
  return Object.fromEntries((node.attrs || []).filter(attr => !attr.namespace).map(attr => [attr.name, attr.value]));
}

function documentBase(document, url) {
  for (const node of htmlElements(document, 'base')) {
    const a = elementAttributes(node);
    // The first base with href controls the document even if it is invalid.
    if (Object.hasOwn(a, 'href')) {
      const candidate = resolve(a.href, url);
      return candidate && !/^(?:data|javascript):/i.test(candidate) ? candidate : url;
    }
  }
  return url;
}

function canonical(document, documentUrl, base) {
  for (const node of htmlElements(document, 'link')) {
    const a = elementAttributes(node);
    if (String(a.rel || '').toLowerCase().split(/\s+/).includes('canonical') && a.href) {
      const resolved = resolve(a.href, base);
      if (resolved) return resolved;
    }
  }
  return documentUrl;
}

function contextBase(context, base, documentBaseUrl) {
  if (Array.isArray(context)) return context.reduce((current, item) => contextBase(item, current, documentBaseUrl), base);
  if (context === null) return documentBaseUrl;
  if (context && typeof context === 'object' && Object.hasOwn(context, '@base')) {
    return context['@base'] === null ? null : resolve(context['@base'], base);
  }
  return base;
}

// This is deliberately narrower than JSON-LD expansion: only carry Schema.org
// through context additions that cannot redefine literal property names.
function simpleSchemaContext(context, inherited) {
  if (Array.isArray(context)) return context.reduce((current, item) => simpleSchemaContext(item, current), inherited);
  if (context === null) return null;
  if (typeof context === 'string') return inherited !== false && /^https?:\/\/schema\.org\/?$/.test(context);
  if (!context || typeof context !== 'object') return false;
  const safeKeys = new Set(['@base', '@language', '@direction', '@version', '@vocab']);
  if (Object.keys(context).some(key => !safeKeys.has(key))) return false;
  if (Object.hasOwn(context, '@vocab')) return inherited !== false && typeof context['@vocab'] === 'string' && /^https?:\/\/schema\.org\/$/.test(context['@vocab']);
  return inherited;
}

function jsonLdBlocks(document) {
  const out = [];
  const stack = [document];
  while (stack.length) {
    const node = stack.pop();
    // Templates and noscript have conditional or inert contents, not active
    // source script elements. Hidden elements can contain active data blocks.
    if (node.tagName === 'template' || node.tagName === 'noscript') continue;
    if (node.tagName === 'script') {
      const type = node.attrs?.find(attr => attr.name === 'type')?.value.trim().toLowerCase();
      if (type === 'application/ld+json') {
        const text = (node.childNodes || []).filter(child => child.nodeName === '#text').map(child => child.value).join('');
        try {
          out.push({ value: JSON.parse(text) });
        } catch (error) {
          out.push({ error: error instanceof Error ? error.message : String(error) });
        }
      }
      continue;
    }
    if (node.childNodes) for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
  }
  return out;
}

function typeList(node) {
  return arr(node?.['@type']).map(String).filter(Boolean);
}

// Within a recognized Schema.org context, accept its absolute type IRIs as
// well as literal type names. This is not general JSON-LD context expansion.
const schemaTypeName = type => type.replace(/^https?:\/\/schema\.org\//, '');

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
    const family = families.get(schemaTypeName(type));
    if (family) return family;
  }
  return null;
}

function hasExpression(node, expression) {
  // JSON-LD drops null array entries. Preserve all non-null scalars and
  // objects: deciding their meaning or validity requires context expansion.
  const hasNonNullValue = value => Array.isArray(value) ? value.some(hasNonNullValue) : value != null;
  return String(expression).split('|').some(property => {
    const value = node?.[property];
    return hasNonNullValue(value);
  });
}

function referencedId(value, base, documentBaseUrl) {
  if (!value || typeof value !== 'object') return null;
  if (Object.hasOwn(value, '@context')) base = contextBase(value['@context'], base, documentBaseUrl);
  return value['@id'] != null ? resolveId(value['@id'], base) : null;
}

function collectTypedNodes(value, base, state, parent = null, property = null, namedGraph = false, schemaContext = null, atRoot = true, uncertainGraphScope = false) {
  if (Array.isArray(value)) {
    for (const item of value) collectTypedNodes(item, base, state, parent, property, namedGraph, schemaContext, false, uncertainGraphScope);
    return;
  }
  if (!value || typeof value !== 'object') {
    if (schemaContext !== true) state.blockNeedsExpansion = true;
    return;
  }

  if (Object.hasOwn(value, '@context')) {
    base = contextBase(value['@context'], base, state.documentBase);
    schemaContext = simpleSchemaContext(value['@context'], schemaContext);
  }
  // Count the whole script block when any object falls outside our bounded
  // context model. This includes objects whose @type is itself aliased and
  // therefore never appears in the typed-node inventory.
  if (schemaContext !== true) state.blockNeedsExpansion = true;

  if (value['@graph'] && typeof value['@graph'] === 'object') {
    const inNamedGraph = namedGraph || Boolean(value['@id']);
    // Only a root graph-only object is certainly the default graph. Nested
    // anonymous graph objects have their own scope even without an @id.
    const rootDefault = atRoot && Object.keys(value).every(key => key === '@graph' || key === '@context');
    const uncertain = uncertainGraphScope || !rootDefault;
    for (const item of arr(value['@graph'])) collectTypedNodes(item, base, state, null, null, inNamedGraph, schemaContext, false, uncertain);
    for (const [key, child] of Object.entries(value)) {
      if (key !== '@graph' && key !== '@context') collectTypedNodes(child, base, state, parent, key, namedGraph, schemaContext, false, uncertain);
    }
    return;
  }

  const types = typeList(value);
  const fragmentId = resolveId(value['@id'], base);
  // Core-property checks can use same-document fragments in the default graph,
  // including untyped descriptions. A named graph must not fill the default graph.
  if (fragmentId && !namedGraph && schemaContext) {
    if (!state.fragments.has(fragmentId)) state.fragments.set(fragmentId, []);
    state.fragments.get(fragmentId).push(value);
  }
  let current = parent;
  if (types.length) {
    const explicitId = resolveId(value['@id'], base);
    const declaredUrl = schemaContext === true ? resolve(value.url, base) : null;
    const id = explicitId || declaredUrl || `${state.documentUrl}#arwp-anonymous-${++state.anonymous}`;
    current = {
      id,
      explicitId,
      declaredUrl,
      types,
      node: value,
      // Literal terms cannot be treated as Schema.org when the active context
      // is absent, custom, or contains mappings we do not expand.
      family: schemaContext === true ? familyFor(value) : null,
      page: state.page,
      documentUrl: state.documentUrl,
      documentBase: state.documentBase,
      base,
      parentId: parent?.id || null,
      parentProperty: property || null,
      namedGraph,
      schemaContext,
      uncertainGraphScope,
      // A nested typed identity link is not a complete entity definition.
      // Keep its assertion, but do not demand owner facts on the reference.
      identityReference: Boolean(parent && explicitId && Object.keys(value)
        .every(key => ['@context', '@type', '@id'].includes(key)))
    };
    state.nodes.push(current);
  }

  for (const [key, child] of Object.entries(value)) {
    if (['@context', '@graph', '@type', '@id'].includes(key)) continue;
    if (child && typeof child === 'object') collectTypedNodes(child, base, state, current, key, namedGraph, schemaContext, false, uncertainGraphScope);
  }
}

function nodeRelations(node) {
  if (node.schemaContext !== true) return [];
  const out = [];
  for (const property of relationProperties) {
    for (const value of arr(node.node[property])) {
      // A string is not automatically an IRI. A context may coerce it to
      // @id, but this bounded extractor does not expand arbitrary contexts.
      if (typeof value === 'string') {
        out.push({ property, target: null, targetTypes: [], interpretation: 'unexpanded-string' });
        continue;
      }
      const target = referencedId(value, node.base, node.documentBase);
      const targetTypes = value && typeof value === 'object' ? typeList(value) : [];
      if (value && typeof value === 'object' && !Object.hasOwn(value, '@id') && typeof value.url === 'string') {
        const base = Object.hasOwn(value, '@context') ? contextBase(value['@context'], node.base, node.documentBase) : node.base;
        out.push({ property, target: null, targetTypes, interpretation: 'embedded-node-without-id', declaredUrl: resolve(value.url, base) });
        continue;
      }
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

function declaredNames(node) {
  const label = item => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item['@value'] !== 'string') return null;
    const allowed = ['@value', '@language', '@type', '@direction', '@index'];
    if (Object.keys(item).some(key => !allowed.includes(key)) || ('@language' in item && '@type' in item)) return null;
    if (['@language', '@type', '@direction', '@index'].some(key => key in item && typeof item[key] !== 'string')) return null;
    return item['@value'];
  };
  const labels = value => new Set(arr(value).map(label).filter(item => item !== null)
    .map(norm).filter(Boolean));
  return {
    primary: labels(node.name || node.headline),
    aliases: labels(node.alternateName)
  };
}

function namesDisagree(left, right) {
  if (!left.primary.size || !right.primary.size) return false;
  // An alias must explicitly name the other primary label. A shared vague alias,
  // a substring or a similar spelling cannot establish that correspondence.
  for (const name of left.primary) {
    if (right.primary.has(name) || right.aliases.has(name)) return false;
  }
  for (const name of right.primary) {
    if (left.aliases.has(name)) return false;
  }
  return true;
}

function analyzeObservedPages(observedPages) {
  const nodes = observedPages.flatMap(page => page.nodes);
  const byId = new Map();
  const pageByNode = new Map(observedPages.flatMap(page => page.nodes.map(node => [node, page])));
  const identityKey = (id, node) => id.startsWith('_:')
    ? `${observedPages.indexOf(pageByNode.get(node))}\u0000${id}` : id;
  const reportedCoreGaps = new Set();
  const reportedVisibleNames = new Map();
  for (const node of nodes) {
    if (!node.explicitId || node.schemaContext !== true) continue;
    // A url property is not an @id. Blank-node labels are scoped to one HTML
    // document, even when another supplied page repeats the same spelling.
    const key = identityKey(node.explicitId, node);
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(node);
  }

  const gaps = [];
  for (const page of observedPages) {
    for (const error of page.parseErrors) {
      gaps.push(gap('P0', 'json-ld-parse-error', null, `JSON-LD could not be parsed: ${error}`, 'Fix the malformed JSON-LD before evaluating graph completeness.', page.canonicalUrl));
    }
  }

  const visibleFamilies = new Set(['site', 'organization', 'local-business', 'place', 'service', 'offer-catalog', 'product', 'product-group', 'dataset', 'data-catalog', 'article', 'event', 'term', 'term-set']);
  const addVisibleNameFinding = (priority, code, node, name, problem, recommendation) => {
    // Collapse only the same assertion on the same observed document in the
    // default graph. Keep separate names, types, documents and named graphs.
    const mergeable = node.explicitId && !node.explicitId.startsWith('_:') && !node.namedGraph && !node.uncertainGraphScope && node.schemaContext === true;
    const key = mergeable ? JSON.stringify([observedPages.indexOf(pageByNode.get(node)),node.explicitId,node.family.id,node.types,name,code]) : null;
    const previous = key && reportedVisibleNames.get(key);
    if (previous) { previous.occurrences = (previous.occurrences || 1) + 1; return; }
    const finding = gap(priority, code, node, problem, recommendation);
    if (key) reportedVisibleNames.set(key, finding);
    gaps.push(finding);
  };

  for (const node of nodes) {
    const family = node.family;
    if (!family || node.identityReference) continue;

    if (family.stableIdentity === 'required-for-arwp-maturity' && !node.explicitId) {
      gaps.push(gap('P1', 'stable-id-missing', node, `${node.types.join('/')} is a reusable first-class entity without an explicit stable @id.`, 'Assign one absolute canonical @id and reuse it for the same entity across pages.'));
    }

    for (const expression of family.coreProperties || []) {
      const page = pageByNode.get(node);
      const fragments = node.explicitId && !node.namedGraph && node.schemaContext
        ? page.fragments.get(node.explicitId) || [node.node] : [node.node];
      const gapKey = `${observedPages.indexOf(page)}\u0000${node.id}\u0000${family.id}\u0000${expression}${node.namedGraph || !node.schemaContext ? `\u0000${page.nodes.indexOf(node)}` : ''}`;
      if (!fragments.some(fragment => hasExpression(fragment, expression)) && !reportedCoreGaps.has(gapKey)) {
        reportedCoreGaps.add(gapKey);
        const finding = gap('P1', `core-property-missing:${expression}`, node, `${node.types.join('/')} is missing the ARWP core property ${expression} on this page.`, `Review the page-local description; add ${expression.replace('|', ' or ')} only when the fact is known and grounded.`);
        // Evidence elsewhere does not fill a page-local finding. Only point
        // to explicitly typed, same-family default-graph descriptions that
        // directly contain the property; blank nodes are document-scoped.
        if (node.explicitId && !node.explicitId.startsWith('_:') && !node.namedGraph && node.schemaContext === true) {
          const peers = byId.get(identityKey(node.explicitId, node)) || [];
          const sources = [...new Set(peers.filter(peer => peer.documentUrl !== node.documentUrl && !peer.namedGraph &&
            !peer.identityReference && peer.schemaContext === true && peer.family?.id === family.id &&
            hasExpression(peer.node, expression)).map(peer => peer.documentUrl))].sort();
          if (sources.length) finding.propertyObservedOnOtherDocuments = sources;
        }
        gaps.push(finding);
      }
    }

    const name = typeof node.node.name === 'string' ? node.node.name.trim() : typeof node.node.headline === 'string' ? node.node.headline.trim() : '';
    if (name && visibleFamilies.has(family.id)) {
      const page = pageByNode.get(node);
      if (page && !page.visible.eligible.includes(norm(name))) {
        if (page.visible.hidden.includes(norm(name))) {
          addVisibleNameFinding('P2', 'visible-name-render-review', node, name, `Structured-data name/headline "${name}" appears only in hidden-designated source text within this bounded check.`, 'Inspect the rendered page: streaming, CSS or JavaScript may reveal the text. Do not treat a hidden source fragment as proof that the fact is invisible.');
        } else {
          addVisibleNameFinding('P1', 'visible-name-parity', node, name, `Structured-data name/headline "${name}" was not found as a literal text match in the eligible source text of the observed page.`, 'Review the rendered entity, context and supported aliases. Adjust the label or markup only if the represented fact is inaccurate or misleading; different wording alone is not a confirmed contradiction.');
        }
      }
    }
  }

  for (const sameIdNodes of byId.values()) {
    if (sameIdNodes.length < 2) continue;
    const id = sameIdNodes[0].explicitId;
    const names = sameIdNodes.map(node => declaredNames(node.node));
    const nameConflict = names.some((left, i) => names.slice(i + 1)
      .some(right => namesDisagree(left, right)));
    const typeSignatures = new Set(sameIdNodes.map(node => [...new Set(node.types.map(schemaTypeName))].sort().join('|')));
    if (nameConflict) {
      gaps.push(gap('P1', 'reused-id-name-review', sameIdNodes[0], `The same @id has different primary names without an explicit connection: ${id}`, 'Review the real entity, language and aliases. Different names may be valid labels for one entity; correct the markup only if the identity is actually inconsistent.'));
    }
    if (typeSignatures.size > 1) {
      gaps.push(gap('P1', 'reused-id-type-review', sameIdNodes[0], `The same @id has different type assertions across observed nodes: ${id}`, 'Review whether all asserted types describe the same real entity. JSON-LD permits multiple types; differing type sets alone do not establish a conflict.'));
    }
  }

  const observedIds = new Set(nodes.filter(node => node.explicitId && !node.identityReference).map(node => identityKey(node.explicitId, node)));
  for (const node of nodes) {
    for (const relation of nodeRelations(node)) {
      if (!relation.target) continue;
      try {
        const targetUrl = new URL(relation.target);
        const pageUrl = new URL(node.documentUrl);
        if (targetUrl.origin === pageUrl.origin && !observedIds.has(identityKey(relation.target, node))) {
          gaps.push(gap('P2', `unresolved-internal-relation:${relation.property}`, node, `${relation.property} points to an internal entity @id that was not observed in the supplied pages: ${relation.target}`, 'Review the referenced entity on its appropriate canonical page. Its absence from this sample does not prove it is missing; change markup only if the identity is actually missing or inconsistent.'));
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
      unexpandedContextBlocks: page.unexpandedContextBlocks,
      typedNodes: page.nodes.length,
      unexpandedContextNodes: page.nodes.filter(node => node.schemaContext !== true).length,
      parseErrors: page.parseErrors.length
    })),
    entityFamilies: familyCounts,
    entities: nodes.map(node => ({
      id: node.id,
      explicitStableId: Boolean(node.explicitId),
      observationRole: node.identityReference ? 'identity-reference' : 'definition',
      types: node.types,
      family: node.family?.id || null,
      contextInterpretation: node.schemaContext === true ? 'schema-org-literal-terms' : 'unexpanded',
      page: node.page,
      relations: nodeRelations(node)
    })),
    gaps,
    summary: {
      pagesObserved: observedPages.length,
      entitiesObserved: nodes.length,
      unexpandedContextBlocks: observedPages.reduce((sum, page) => sum + page.unexpandedContextBlocks, 0),
      unexpandedContextNodes: nodes.filter(node => node.schemaContext !== true).length,
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
      'interpretation or completeness of nodes whose JSON-LD context was not expanded',
      'business legitimacy or commercial outcomes'
    ]
  };
}

export function analyzeStructuredDataPages(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('pages must be a non-empty array.');
  const observedPages = pages.map(page => {
    if (!page?.url || typeof page.html !== 'string') throw new Error('Each page requires url and html.');
    const document = parse(page.html);
    const base = documentBase(document, page.url);
    const canonicalUrl = canonical(document, page.url, base);
    const state = { nodes: [], fragments: new Map(), anonymous: 0,
      documentUrl: page.url, documentBase: base, page: canonicalUrl };
    const parseErrors = [];
    const blocks = jsonLdBlocks(document);
    let unexpandedContextBlocks = 0;
    for (const block of blocks) {
      if (block.error) parseErrors.push(block.error);
      else {
        state.blockNeedsExpansion = block.value === null || typeof block.value !== 'object';
        collectTypedNodes(block.value, base, state);
        if (state.blockNeedsExpansion) unexpandedContextBlocks++;
      }
    }
    return {
      url: page.url,
      canonicalUrl,
      visible: sourceText(document),
      jsonLdBlocks: blocks.length,
      unexpandedContextBlocks,
      parseErrors,
      fragments: state.fragments,
      nodes: state.nodes
    };
  });
  return analyzeObservedPages(observedPages);
}

export function analyzeStructuredDataHtml(html, { url = 'https://example.invalid/' } = {}) {
  return analyzeStructuredDataPages([{ url, html }]);
}

export async function analyzeStructuredDataUrls(inputs, { timeoutMs = 8000, maxBytes = 512 * 1024, fetchImpl = fetch, resolveImpl } = {}) {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 5) throw new Error('Supply between 1 and 5 public HTTPS URLs.');
  const urls = inputs.map(input => {
    const url = new URL(input);
    if (url.protocol !== 'https:') throw new Error('Structured-data analysis requires a public HTTPS URL.');
    url.hash = '';
    return url.href;
  });
  if (new Set(urls).size !== urls.length) throw new Error('Duplicate structured-data input URLs are not allowed.');
  const pages = [], observed = [], finals = new Set();
  // Fetch serially: every page passes the existing public-host, redirect,
  // response-size and timeout checks. Do not emit a partial graph on failure.
  for (const input of urls) {
    const fetched = await fetchPublicText(input, {
      timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}),
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
      userAgent: 'arwp-structured-data/0.1'
    });
    if (!fetched.ok || !fetched.text) throw new Error(`Unable to fetch page: HTTP ${fetched.status ?? 'unknown'}`);
    const final = new URL(fetched.url || input);
    final.hash = '';
    const finalUrl = final.href;
    if (finals.has(finalUrl)) throw new Error('Multiple inputs resolved to the same final URL.');
    finals.add(finalUrl);
    pages.push({ url: finalUrl, html: fetched.text });
    observed.push({ input, finalUrl });
  }
  const report = analyzeStructuredDataPages(pages);
  report.discovery = { pages: observed, timeoutMs, maxBytes };
  return report;
}

export async function analyzeStructuredDataUrl(input, options = {}) {
  const report = await analyzeStructuredDataUrls([input], options);
  const { pages, timeoutMs, maxBytes } = report.discovery;
  report.discovery = { ...pages[0], timeoutMs, maxBytes };
  return report;
}

export function formatStructuredDataReport(report) {
  const lines = [
    `Structured Data & Knowledge Graph — ${report.pages[0]?.canonicalUrl || 'unknown'}`,
    `Scope: ${report.scope}`,
    `Pages observed: ${report.summary.pagesObserved}`,
    `Entities observed: ${report.summary.entitiesObserved}`,
    `JSON-LD blocks with unexpanded context: ${report.summary.unexpandedContextBlocks ?? 'unknown'}`,
    `Nodes with unexpanded context: ${report.summary.unexpandedContextNodes ?? 'unknown'}`,
    `Families observed: ${report.summary.familiesObserved}`,
    `Gaps: P0 ${report.summary.gaps.P0}, P1 ${report.summary.gaps.P1}, P2 ${report.summary.gaps.P2}, P3 ${report.summary.gaps.P3}`
  ];
  if (report.summary.unexpandedContextBlocks > 0) {
    lines.push('Context interpretation is incomplete; a low gap count does not establish graph completeness.');
  }
  for (const item of report.gaps.slice(0, 30)) {
    lines.push(`- ${item.priority} ${item.code}: ${item.problem}`);
    if (Number.isInteger(item.occurrences) && item.occurrences > 1) lines.push(`  Repeated identical assertions in this document: ${item.occurrences}.`);
    if (item.propertyObservedOnOtherDocuments?.length) lines.push(`  Same entity and property observed on another sampled document: ${item.propertyObservedOnOtherDocuments.map(url => String(url).replace(/\s+/g, ' ')).join(', ')}. This does not fill the page-local finding.`);
  }
  if (report.gaps.length > 30) lines.push(`- ... ${report.gaps.length - 30} more gaps omitted from text output`);
  lines.push('This is a structured-data graph audit, not a ranking, rich-result, Knowledge Panel or AI-citation score.');
  return lines.join('\n');
}

export { CONTRACT as structuredDataKnowledgeGraphContract };
