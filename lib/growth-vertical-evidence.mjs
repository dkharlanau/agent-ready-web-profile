import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const verticalRegistryPath = path.join(root, 'registry', 'growth-verticals.json');

export const VERTICAL_EVIDENCE_VERSION = '0.1';

export function loadGrowthVerticalRegistry() {
  return JSON.parse(fs.readFileSync(verticalRegistryPath, 'utf8'));
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
      // Invalid JSON-LD remains unavailable evidence rather than crashing a growth audit.
    }
  }
  return out;
}

function typeNames(node) {
  return arrays(node?.['@type']).map(value => String(value).toLowerCase());
}

function hasType(node, types) {
  const wanted = new Set(arrays(types).map(value => String(value).toLowerCase()));
  return typeNames(node).some(value => wanted.has(value));
}

function textContent(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function linkRecords(html, canonicalUrl) {
  const out = [];
  const seen = new Set();
  const base = new URL(canonicalUrl);
  for (const match of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = match[1] || match[2] || match[3] || '';
    if (!raw || /^(?:javascript:|mailto:|tel:|data:)/i.test(raw)) continue;
    let url;
    try { url = new URL(raw, base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    url.hash = '';
    const href = url.href;
    if (seen.has(href)) continue;
    seen.add(href);
    const text = String(match[4] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({
      url: href,
      sameOrigin: url.origin === base.origin,
      path: `${url.pathname}${url.search}`.toLowerCase(),
      text: text.toLowerCase()
    });
  }
  return out;
}

function matchingLinks(links, patterns, { sameOrigin = null } = {}) {
  return links.filter(link => {
    if (sameOrigin != null && link.sameOrigin !== sameOrigin) return false;
    const haystack = `${link.path} ${link.text}`;
    return patterns.some(pattern => pattern.test(haystack));
  });
}

function urls(links, max = 8) {
  return [...new Set(links.map(item => item.url))].slice(0, max);
}

function checkResult(definition, status, reason, evidence = [], extra = {}) {
  return {
    id: definition.id,
    priority: definition.priority,
    title: definition.title,
    status,
    reason,
    evidence: [...new Set(evidence)].slice(0, 12),
    expectedEvidence: definition.evidence,
    ...extra
  };
}

function findDefinition(verticalRegistry, vertical, id) {
  return verticalRegistry.verticals?.[vertical]?.checks?.find(item => item.id === id);
}

function softwareEvidence(context, registry) {
  const { nodes, links } = context;
  const softwareNodes = nodes.filter(node => hasType(node, ['SoftwareApplication', 'WebApplication']));
  const releaseLinks = matchingLinks(links, [/\bchangelog\b/i, /\brelease(?:s|[-_ ]?notes?)?\b/i, /\bversion(?:s|history)?\b/i, /\bupdates?\b/i], { sameOrigin: true });
  const docsLinks = matchingLinks(links, [/\bdocs?(?:umentation)?\b/i, /\bguide\b/i, /\bmanual\b/i, /\bquickstart\b/i, /\btutorials?\b/i], { sameOrigin: true });
  const exampleLinks = matchingLinks(links, [/\bexamples?\b/i, /\bdemos?\b/i, /\bsamples?\b/i], { sameOrigin: true });
  const supportLinks = matchingLinks(links, [/\bsupport\b/i, /\bhelp\b/i, /\btrust\b/i, /\bsecurity\b/i, /\bstatus\b/i], { sameOrigin: true });
  const agentLinks = matchingLinks(links, [/\bopenapi\b/i, /\bapi\b/i, /\bmcp\b/i, /\ba2a\b/i, /\bagents?(?:\.txt|\.json)?\b/i, /\bsite-profile\b/i, /\bskills?\b/i, /\.well-known\//i]);
  const versionValues = softwareNodes.flatMap(node => [node.softwareVersion, node.version]).filter(Boolean).map(String);

  const identity = findDefinition(registry, 'software-product', 'software-product-identity');
  const release = findDefinition(registry, 'software-product', 'software-product-release-history');
  const docsSupport = findDefinition(registry, 'software-product', 'software-product-docs-support');
  const agents = findDefinition(registry, 'software-product', 'software-product-agent-interfaces');
  return [
    checkResult(
      identity,
      softwareNodes.length ? 'observed' : 'not-observed',
      softwareNodes.length
        ? `${softwareNodes.length} SoftwareApplication/WebApplication node(s) were observed on the audited entry page.`
        : 'No SoftwareApplication/WebApplication JSON-LD was observed on the audited entry page. This does not prove the product lacks a canonical identity elsewhere.',
      softwareNodes.flatMap(node => arrays(node.url).filter(value => typeof value === 'string'))
    ),
    checkResult(
      release,
      releaseLinks.length ? 'observed' : versionValues.length ? 'partial' : 'not-observed',
      releaseLinks.length
        ? `Observed ${releaseLinks.length} crawlable release/change-history link(s) from the audited entry page.`
        : versionValues.length
          ? `Observed software version metadata (${versionValues.join(', ')}), but no crawlable release/change-history link from the audited entry page.`
          : 'No software version metadata or crawlable release/change-history link was observed on the audited entry page.',
      [...urls(releaseLinks), ...versionValues.map(value => `version:${value}`)]
    ),
    checkResult(
      docsSupport,
      (docsLinks.length || exampleLinks.length) && supportLinks.length ? 'observed' : (docsLinks.length || exampleLinks.length || supportLinks.length) ? 'partial' : 'not-observed',
      `Entry-page links observed: docs=${docsLinks.length}, examples=${exampleLinks.length}, support/trust=${supportLinks.length}.`,
      urls([...docsLinks, ...exampleLinks, ...supportLinks])
    ),
    checkResult(
      agents,
      agentLinks.length ? 'observed' : 'not-applicable-or-not-observed',
      agentLinks.length
        ? `Observed ${agentLinks.length} API/agent-facing declaration or documentation link(s). Presence is only discovery evidence; runtime capability and authorization remain separate.`
        : 'No API/agent-facing declaration was observed on the audited entry page. ARWP does not recommend inventing one when the product has no such capability.',
      urls(agentLinks)
    )
  ];
}

function researchEvidence(context, registry) {
  const { nodes, links, text } = context;
  const datasetNodes = nodes.filter(node => hasType(node, 'Dataset'));
  const methodologyLinks = matchingLinks(links, [/\bmethod(?:ology|s)?\b/i, /\bprovenance\b/i, /\blimitations?\b/i, /\bsampling\b/i, /\bdata[-_ ]?dictionary\b/i, /\bmethods?\b/i], { sameOrigin: true });
  const citationLinks = matchingLinks(links, [/\bcitation\b/i, /\bcite\b/i, /\bdoi\b/i, /\bzenodo\b/i, /\bcitation\.cff\b/i]);
  const licenseLinks = matchingLinks(links, [/\blicen[cs]e\b/i, /creativecommons\.org/i]);
  const versionLinks = matchingLinks(links, [/\brelease(?:s)?\b/i, /\bversions?\b/i, /\bhistory\b/i, /\bchangelog\b/i], { sameOrigin: true });
  const accessLinks = links.filter(link => /\.(?:csv|json|jsonl|parquet|tsv|zip|tar|gz|xlsx)(?:$|\?)/i.test(link.path) || /\bdownload\b|\bdataset\b|\bdata[-_ ]?api\b|\/api\//i.test(`${link.path} ${link.text}`));
  const datasetLicenses = datasetNodes.flatMap(node => arrays(node.license)).filter(Boolean).map(String);
  const datasetVersions = datasetNodes.flatMap(node => [node.version, node.identifier]).filter(Boolean).map(value => typeof value === 'object' ? JSON.stringify(value) : String(value));
  const methodologyText = /\b(methodology|methods|sampling|provenance|limitations?)\b/i.test(text);
  const citationText = /\b(citation|cite this|doi)\b/i.test(text);

  const identity = findDefinition(registry, 'research-dataset', 'research-dataset-identity');
  const methods = findDefinition(registry, 'research-dataset', 'research-dataset-methodology-provenance');
  const citation = findDefinition(registry, 'research-dataset', 'research-dataset-citation-license');
  const access = findDefinition(registry, 'research-dataset', 'research-dataset-access');
  const citationPresent = citationLinks.length || citationText;
  const licensePresent = licenseLinks.length || datasetLicenses.length;
  const versionPresent = versionLinks.length || datasetVersions.length;
  const citationParts = [citationPresent, licensePresent, versionPresent].filter(Boolean).length;
  return [
    checkResult(
      identity,
      datasetNodes.length ? 'observed' : 'not-observed',
      datasetNodes.length
        ? `${datasetNodes.length} Dataset JSON-LD node(s) were observed on the audited entry page.`
        : 'No Dataset JSON-LD was observed on the audited entry page. This does not prove a dataset-specific landing page does not exist elsewhere.',
      datasetNodes.flatMap(node => arrays(node.url).filter(value => typeof value === 'string'))
    ),
    checkResult(
      methods,
      methodologyLinks.length && methodologyText ? 'observed' : (methodologyLinks.length || methodologyText) ? 'partial' : 'not-observed',
      `Methodology/provenance evidence: ${methodologyLinks.length} matching link(s); entry-page methodology text signal=${methodologyText ? 'yes' : 'no'}.`,
      urls(methodologyLinks)
    ),
    checkResult(
      citation,
      citationParts === 3 ? 'observed' : citationParts ? 'partial' : 'not-observed',
      `Citation/license/version evidence observed: citation=${citationPresent ? 'yes' : 'no'}, license=${licensePresent ? 'yes' : 'no'}, version/history=${versionPresent ? 'yes' : 'no'}.`,
      [...urls([...citationLinks, ...licenseLinks, ...versionLinks]), ...datasetLicenses.map(value => `license:${value}`), ...datasetVersions.map(value => `version:${value}`)]
    ),
    checkResult(
      access,
      accessLinks.length ? 'observed' : 'not-observed',
      accessLinks.length
        ? `Observed ${accessLinks.length} public download/API/data link(s) from the audited entry page.`
        : 'No public download/API/data link was observed on the audited entry page. Restricted datasets should remain explicitly restricted rather than being made public for this check.',
      urls(accessLinks)
    )
  ];
}

function documentationEvidence(context, registry) {
  const { links, text, html } = context;
  const versionLinks = matchingLinks(links, [/\bversions?\b/i, /\breleases?\b/i, /\bchangelog\b/i, /\bsupported\b/i], { sameOrigin: true });
  const deepLinks = links.filter(link => link.sameOrigin && new URL(link.url).pathname.replace(/\/+$/, '') !== new URL(context.canonicalUrl).pathname.replace(/\/+$/, ''));
  const exampleLinks = matchingLinks(links, [/\bexamples?\b/i, /\bquickstart\b/i, /\btutorials?\b/i, /\bsamples?\b/i, /\bdemos?\b/i], { sameOrigin: true });
  const hasCode = /<(?:pre|code)\b/i.test(html);
  const versionText = /\bversion\s+v?\d|\bcurrent\s+version\b|\bsupported\s+versions?\b/i.test(text);
  const defs = registry.verticals.documentation.checks;
  return [
    checkResult(defs[0], versionLinks.length ? 'observed' : versionText ? 'partial' : 'not-observed', `Version/freshness evidence: links=${versionLinks.length}, visible version signal=${versionText ? 'yes' : 'no'}.`, urls(versionLinks)),
    checkResult(defs[1], deepLinks.length >= 3 ? 'observed' : deepLinks.length ? 'partial' : 'not-observed', `Observed ${deepLinks.length} same-origin non-root crawlable link(s) from the audited documentation entry page.`, urls(deepLinks)),
    checkResult(defs[2], exampleLinks.length || hasCode ? 'observed' : 'not-observed', `Examples evidence: matching links=${exampleLinks.length}, inline code/pre signal=${hasCode ? 'yes' : 'no'}.`, urls(exampleLinks))
  ];
}

function editorialEvidence(context, registry) {
  const { nodes, links } = context;
  const articles = nodes.filter(node => hasType(node, ['Article', 'NewsArticle', 'BlogPosting']));
  const authorComplete = articles.length && articles.every(node => arrays(node.author).some(author => typeof author === 'object' && (author.url || author.sameAs)));
  const datesComplete = articles.length && articles.every(node => node.datePublished && node.dateModified);
  const evidenceLinks = matchingLinks(links, [/\bsource(?:s)?\b/i, /\bmethod(?:ology|s)?\b/i, /\bdata\b/i, /\bevidence\b/i, /\bdocuments?\b/i]);
  const media = /<(?:img|video|figure)\b/i.test(context.html);
  const defs = registry.verticals.editorial.checks;
  return [
    checkResult(defs[0], authorComplete ? 'observed' : articles.length ? 'partial' : 'manual', authorComplete ? 'Article author identity URLs/sameAs were observed.' : articles.length ? 'Article-like structured data exists, but complete stable author identity references were not observed for every article node.' : 'No Article-like JSON-LD was observed on the audited entry page; visible bylines still require page-level review.'),
    checkResult(defs[1], datesComplete ? 'observed' : articles.length ? 'partial' : 'manual', datesComplete ? 'datePublished and dateModified were observed on every Article-like node.' : articles.length ? 'Article-like structured data exists, but publication/update dates are incomplete.' : 'No Article-like structured dates were observed on the audited entry page.'),
    checkResult(defs[2], evidenceLinks.length && media ? 'observed' : 'manual', evidenceLinks.length && media ? `Observed evidence/source links (${evidenceLinks.length}) plus original-media candidates on the entry page.` : 'First-hand/original evidence quality cannot be safely inferred from the entry page alone; keep this as editorial review.', urls(evidenceLinks))
  ];
}

function commerceEvidence(context, registry) {
  const { nodes, links } = context;
  const products = nodes.filter(node => hasType(node, 'Product'));
  const offers = nodes.filter(node => hasType(node, 'Offer'));
  const policyLinks = matchingLinks(links, [/\bshipping\b/i, /\bdelivery\b/i, /\breturns?\b/i, /\brefund\b/i, /\bseller\b/i, /\bcontact\b/i, /\babout\b/i], { sameOrigin: true });
  const defs = registry.verticals.commerce.checks;
  return [
    checkResult(defs[0], products.length || offers.length ? 'partial' : 'manual', products.length || offers.length ? `Observed Product=${products.length}, Offer=${offers.length} structured nodes. Visible-vs-structured price/inventory parity still requires page-level comparison.` : 'No Product/Offer JSON-LD was observed on the audited entry page; product-page parity remains a scoped page-level check.'),
    checkResult(defs[1], 'external-owner-data', 'Merchant/feed freshness and inventory state require authenticated owner/feed evidence and are not inferred from public crawling.'),
    checkResult(defs[2], policyLinks.length >= 2 ? 'observed' : policyLinks.length ? 'partial' : 'not-observed', `Observed ${policyLinks.length} shipping/returns/seller/contact policy link(s) from the audited entry page.`, urls(policyLinks))
  ];
}

function localBusinessEvidence(context, registry) {
  const { nodes, links, html } = context;
  const locals = nodes.filter(node => hasType(node, 'LocalBusiness'));
  const complete = locals.some(node => node.name && node.address && (node.telephone || node.openingHours || node.openingHoursSpecification));
  const locationLinks = matchingLinks(links, [/\blocation\b/i, /\bdirections?\b/i, /\bcontact\b/i, /\bservices?\b/i, /\bvisit\b/i, /\bmap\b/i], { sameOrigin: true });
  const media = /<(?:img|figure|video)\b/i.test(html);
  const defs = registry.verticals['local-business'].checks;
  return [
    checkResult(defs[0], complete ? 'observed' : locals.length ? 'partial' : 'not-observed', complete ? 'Observed a LocalBusiness node with name, address and contact/hours evidence.' : locals.length ? 'LocalBusiness structured data exists but canonical address/contact/hours evidence is incomplete.' : 'No LocalBusiness JSON-LD was observed on the audited entry page.'),
    checkResult(defs[1], 'external-owner-data', 'External business-profile category/address/hours/status require authenticated owner-side evidence.'),
    checkResult(defs[2], locationLinks.length && media ? 'observed' : 'manual', locationLinks.length && media ? `Observed ${locationLinks.length} location/service link(s) plus media candidates.` : 'Truthful local-service/location evidence and doorway-page risk require scoped human review.', urls(locationLinks))
  ];
}

function generalEvidence(context, registry) {
  const { nodes, links } = context;
  const identityNodes = nodes.filter(node => hasType(node, ['WebSite', 'Organization', 'Person']));
  const deepLinks = links.filter(link => link.sameOrigin && new URL(link.url).pathname.replace(/\/+$/, '') !== new URL(context.canonicalUrl).pathname.replace(/\/+$/, ''));
  const defs = registry.verticals.general.checks;
  return [
    checkResult(defs[0], identityNodes.length ? 'observed' : 'not-observed', identityNodes.length ? `Observed ${identityNodes.length} WebSite/Organization/Person identity node(s).` : 'No WebSite/Organization/Person JSON-LD was observed on the audited entry page.'),
    checkResult(defs[1], deepLinks.length >= 3 ? 'observed' : deepLinks.length ? 'partial' : 'not-observed', `Observed ${deepLinks.length} same-origin non-root crawlable link(s) from the audited entry page.`, urls(deepLinks)),
    checkResult(defs[2], 'manual', 'Truthful material-update freshness and Search/AI outcome measurement remain separate manual/owner-data evidence classes.')
  ];
}

export function analyzeVerticalEvidence({ vertical = 'general', canonicalUrl, html, registry = loadGrowthVerticalRegistry() }) {
  const selected = registry.verticals?.[vertical];
  if (!selected) throw new Error(`Unknown Growth vertical: ${vertical}`);
  const context = {
    vertical,
    canonicalUrl,
    html: String(html || ''),
    text: textContent(html),
    nodes: jsonLdNodes(html),
    links: linkRecords(html, canonicalUrl)
  };
  let checks;
  if (vertical === 'software-product') checks = softwareEvidence(context, registry);
  else if (vertical === 'research-dataset') checks = researchEvidence(context, registry);
  else if (vertical === 'documentation') checks = documentationEvidence(context, registry);
  else if (vertical === 'editorial') checks = editorialEvidence(context, registry);
  else if (vertical === 'commerce') checks = commerceEvidence(context, registry);
  else if (vertical === 'local-business') checks = localBusinessEvidence(context, registry);
  else checks = generalEvidence(context, registry);

  const summary = checks.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    version: VERTICAL_EVIDENCE_VERSION,
    registryVersion: registry.version,
    vertical,
    coverage: 'audited-entry-page-public-evidence',
    summary,
    checks,
    limitations: [
      'Not observed on the audited entry page is not proof of site-wide absence.',
      'Public metadata and links are evidence, not authorization, runtime conformance or ranking impact.',
      'Authenticated platform/feed/business-profile state remains owner-side evidence.'
    ]
  };
}

export function verticalEvidenceActions(report) {
  if (!report || !Array.isArray(report.checks)) return [];
  const activeVerticals = new Set(['software-product', 'research-dataset', 'documentation']);
  if (!activeVerticals.has(report.vertical)) return [];
  const actions = [];
  for (const check of report.checks) {
    if (!['partial', 'not-observed'].includes(check.status)) continue;
    actions.push({
      id: `growth:vertical:${check.id}`,
      priority: check.priority,
      lane: `vertical:${report.vertical}`,
      title: check.title,
      status: check.status === 'partial' ? 'review' : 'recommended',
      reason: `${check.reason} Entry-page evidence is partial by design; verify the relevant canonical surface before changing content or markup.`,
      source: null,
      implementation: {
        vertical: report.vertical,
        expectedEvidence: check.expectedEvidence,
        note: 'Implement only when this check truthfully applies. Do not create thin pages, fake structured data or unsupported agent interfaces to make the diagnostic pass.'
      },
      evidence: check.evidence
    });
  }
  return actions;
}
