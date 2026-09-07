export const SEMANTIC_INDEX_VERSION = '0.1';

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function typeIncludes(node, type) {
  return asArray(node?.['@type']).includes(type);
}

function httpsUrl(value, label, { stripHash = true } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be an absolute URL.`); }
  if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);
  if (stripHash) url.hash = '';
  return url.href;
}

function pageId(url) {
  return `${httpsUrl(url, 'page canonicalUrl')}#page`;
}

function ref(id) {
  return { '@id': id };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findWebsite(graph) {
  const sites = graph.filter(node => typeIncludes(node, 'WebSite'));
  if (sites.length !== 1) throw new Error(`entity catalog must contain exactly one WebSite node; observed ${sites.length}.`);
  const site = sites[0];
  if (!site['@id']) throw new Error('WebSite node must have @id.');
  const id = httpsUrl(site['@id'], 'WebSite @id', { stripHash: false });
  const url = httpsUrl(site.url, 'WebSite url');
  return { ...site, '@id': id, url };
}

function canonicalPages(pageManifest, includeUnindexed) {
  if (!pageManifest || !Array.isArray(pageManifest.pages)) throw new Error('page manifest must contain pages[].');
  const seen = new Set();
  const pages = [];
  for (const page of pageManifest.pages) {
    if (!includeUnindexed && page.index === false) continue;
    if (!page.canonicalUrl) throw new Error(`page ${page.id || '<unknown>'} is missing canonicalUrl.`);
    const canonicalUrl = httpsUrl(page.canonicalUrl, `page ${page.id || '<unknown>'} canonicalUrl`);
    if (seen.has(canonicalUrl)) throw new Error(`duplicate canonical page URL: ${canonicalUrl}`);
    seen.add(canonicalUrl);
    pages.push({ ...page, canonicalUrl });
  }
  return pages;
}

function buildPageNode(page, websiteId) {
  const node = {
    '@id': pageId(page.canonicalUrl),
    '@type': page.pageType || 'WebPage',
    url: page.canonicalUrl,
    name: page.title || page.id || page.canonicalUrl,
    isPartOf: ref(websiteId)
  };
  if (page.mainEntity) node.mainEntity = ref(page.mainEntity);
  if (page.id) node.identifier = page.id;
  return node;
}

export function buildSemanticIndex(pageManifest, entityCatalog, { includeUnindexed = false } = {}) {
  if (!entityCatalog || entityCatalog['@context'] !== 'https://schema.org' || !Array.isArray(entityCatalog['@graph'])) {
    throw new Error('entity catalog must be Schema.org JSON-LD with @graph[].');
  }
  const entities = clone(entityCatalog['@graph']);
  const website = findWebsite(entities);
  const pages = canonicalPages(pageManifest, includeUnindexed);
  const entityIds = new Set(entities.map(node => node?.['@id']).filter(Boolean));

  for (const page of pages) {
    if (!page.mainEntity) continue;
    if (String(page.mainEntity).startsWith(website.url) && !entityIds.has(page.mainEntity)) {
      throw new Error(`page ${page.id || page.canonicalUrl} references missing internal mainEntity ${page.mainEntity}.`);
    }
  }

  const pageNodes = pages.map(page => buildPageNode(page, website['@id']));
  const indexUrl = new URL('semantic-index.jsonld', website.url).href;
  const listId = `${indexUrl}#pages`;
  const list = {
    '@id': listId,
    '@type': 'ItemList',
    name: `${website.name || 'Site'} canonical page index`,
    numberOfItems: pageNodes.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: pageNodes.map((page, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: ref(page['@id'])
    }))
  };
  const semanticIndex = {
    '@id': indexUrl,
    '@type': 'CreativeWork',
    name: `${website.name || 'Site'} semantic index`,
    description: 'Optional aggregate JSON-LD map of canonical pages and reusable site entities. It complements canonical HTML and page-local structured data; it is not a ranking declaration.',
    url: indexUrl,
    encodingFormat: 'application/ld+json',
    isPartOf: ref(website['@id']),
    mainEntity: ref(listId)
  };
  if (website.about?.['@id']) semanticIndex.about = ref(website.about['@id']);

  const result = {
    '@context': 'https://schema.org',
    '@graph': [...entities, semanticIndex, list, ...pageNodes]
  };
  const validation = validateSemanticIndex(result);
  if (!validation.valid) throw new Error(`generated semantic index is invalid: ${validation.issues.join('; ')}`);
  return result;
}

export function validateSemanticIndex(value) {
  const issues = [];
  if (!value || value['@context'] !== 'https://schema.org' || !Array.isArray(value['@graph'])) {
    return { valid: false, issues: ['expected Schema.org JSON-LD with @graph[]'], counts: { nodes: 0, pages: 0, entities: 0 } };
  }
  const graph = value['@graph'];
  const ids = new Set();
  const duplicates = new Set();
  for (const node of graph) {
    const id = node?.['@id'];
    if (!id) continue;
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
    if (String(id).startsWith('http://')) issues.push(`non-HTTPS @id: ${id}`);
  }
  for (const id of duplicates) issues.push(`duplicate @id: ${id}`);

  const websites = graph.filter(node => typeIncludes(node, 'WebSite'));
  if (websites.length !== 1) issues.push(`expected exactly one WebSite; observed ${websites.length}`);
  const websiteId = websites[0]?.['@id'] || null;
  const websiteUrl = websites[0]?.url || null;
  const pageNodes = graph.filter(node => typeof node?.['@id'] === 'string' && node['@id'].endsWith('#page'));
  const itemLists = graph.filter(node => typeIncludes(node, 'ItemList') && String(node?.['@id'] || '').endsWith('#pages'));
  if (itemLists.length !== 1) issues.push(`expected exactly one page ItemList; observed ${itemLists.length}`);

  const pageIds = new Set(pageNodes.map(node => node['@id']));
  for (const page of pageNodes) {
    if (!page.url || !String(page.url).startsWith('https://')) issues.push(`page node missing HTTPS url: ${page['@id']}`);
    if (websiteId && page.isPartOf?.['@id'] !== websiteId) issues.push(`page node has inconsistent isPartOf: ${page['@id']}`);
    const mainEntity = page.mainEntity?.['@id'];
    if (mainEntity && websiteUrl && String(mainEntity).startsWith(websiteUrl) && !ids.has(mainEntity)) issues.push(`missing internal mainEntity node: ${mainEntity}`);
  }

  const list = itemLists[0];
  if (list) {
    const items = Array.isArray(list.itemListElement) ? list.itemListElement : [];
    if (list.numberOfItems !== items.length) issues.push('ItemList numberOfItems does not match itemListElement length.');
    items.forEach((item, index) => {
      if (item.position !== index + 1) issues.push(`ItemList position mismatch at ${index + 1}.`);
      const target = item.item?.['@id'];
      if (!target || !pageIds.has(target)) issues.push(`ItemList references unknown page node: ${target || '<missing>'}`);
    });
    if (items.length !== pageNodes.length) issues.push(`ItemList/page-node count mismatch: ${items.length}/${pageNodes.length}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    counts: {
      nodes: graph.length,
      pages: pageNodes.length,
      entities: graph.length - pageNodes.length - itemLists.length - 1
    }
  };
}

export function semanticIndexSummary(value) {
  const result = validateSemanticIndex(value);
  return {
    version: SEMANTIC_INDEX_VERSION,
    ...result,
    guardrails: {
      optionalAggregateSurface: true,
      canonicalHtmlRemainsPrimary: true,
      pageLocalMarkupStillRequiredWhereUseful: true,
      noRankingOrDiscoveryPromise: true,
      noSyntheticFactsOrFreshness: true
    }
  };
}
