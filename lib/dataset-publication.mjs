import { fetchPublicText } from './public-fetch.mjs';

export const DATASET_PUBLICATION_VERSION = '0.1';

const DOI_RE = /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[\w.()/:;+-]+)(?=[\s"'<>\]}),]|$)/ig;
const DATA_EXT_RE = /\.(?:csv|tsv|json|jsonl|ndjson|parquet|arrow|zip|gz|tar|xlsx)(?:$|[?#])/i;

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function normalizeUrl(value, base) {
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
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
      // Invalid JSON-LD is simply unavailable evidence here.
    }
  }
  return out;
}

function types(node) {
  return arrays(node?.['@type']).map(value => String(value).toLowerCase());
}

function htmlLinks(html, base) {
  const links = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
    const url = normalizeUrl(match[1] || match[2] || match[3], base);
    if (url) links.push(url);
  }
  return [...new Set(links)];
}

function collectDois(...values) {
  const dois = new Set();
  for (const value of values.flat(Infinity)) {
    if (value == null) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    for (const match of text.matchAll(DOI_RE)) dois.add(match[1].replace(/[.,;:)]+$/g, ''));
  }
  return [...dois];
}

function hasText(text, regex) {
  return regex.test(String(text || ''));
}

function check(id, priority, status, title, evidence, note = null) {
  return { id, priority, status, title, evidence: [...new Set(evidence.filter(Boolean))], ...(note ? { note } : {}) };
}

export function analyzeDatasetPublication({
  canonicalUrl,
  html = '',
  citationText = '',
  datasetMetadataText = '',
  manifestText = ''
}) {
  const base = new URL(canonicalUrl).href;
  const nodes = jsonLdNodes(html);
  const datasetNodes = nodes.filter(node => types(node).includes('dataset'));
  const links = htmlLinks(html, base);
  const dataLinks = links.filter(url => DATA_EXT_RE.test(url) || /\/data(?:set)?\//i.test(new URL(url).pathname));

  let metadataObjects = [];
  for (const text of [datasetMetadataText, manifestText]) {
    try {
      const parsed = JSON.parse(String(text || ''));
      metadataObjects.push(parsed);
      if (Array.isArray(parsed?.['@graph'])) metadataObjects.push(...parsed['@graph']);
    } catch {}
  }
  const metadataDatasets = metadataObjects.filter(node => node && typeof node === 'object' && types(node).includes('dataset'));
  const allDatasetNodes = [...datasetNodes, ...metadataDatasets];

  const cffDataset = /(^|\n)type:\s*["']?dataset["']?\s*($|\n)/i.test(citationText);
  const corpusSignal = allDatasetNodes.length > 0 || dataLinks.length >= 2 || cffDataset;
  const doiCandidates = collectDois(
    citationText,
    datasetMetadataText,
    manifestText,
    links,
    allDatasetNodes.flatMap(node => [node.identifier, node.sameAs, node.citation, node.url])
  );
  const doiUrls = [...new Set([
    ...links.filter(url => /https?:\/\/(?:dx\.)?doi\.org\/10\./i.test(url)),
    ...doiCandidates.map(doi => `https://doi.org/${doi}`)
  ])];
  const zenodoLinks = links.filter(url => /https?:\/\/(?:www\.)?zenodo\.org\/(?:records?|record)\//i.test(url));

  const versions = [...new Set([
    ...allDatasetNodes.flatMap(node => arrays(node.version)).map(String),
    ...[...String(citationText).matchAll(/(^|\n)version:\s*["']?([^\n"']+)/ig)].map(match => match[2].trim())
  ].filter(Boolean))];
  const licenses = [...new Set([
    ...allDatasetNodes.flatMap(node => arrays(node.license)).map(value => typeof value === 'string' ? value : JSON.stringify(value)),
    ...[...String(citationText).matchAll(/(^|\n)license:\s*["']?([^\n"']+)/ig)].map(match => match[2].trim()),
    ...links.filter(url => /license|creativecommons\.org|spdx\.org/i.test(url))
  ].filter(Boolean))];
  const distributions = [...new Set([
    ...dataLinks,
    ...allDatasetNodes.flatMap(node => arrays(node.distribution)).flatMap(item => {
      if (typeof item === 'string') return [normalizeUrl(item, base) || item];
      if (!item || typeof item !== 'object') return [];
      return [item.contentUrl, item.url].map(value => value && (normalizeUrl(value, base) || String(value))).filter(Boolean);
    })
  ])];
  const methodologyLinks = links.filter(url => /method|provenance|sampling|limitations?|data[-_]?dictionary/i.test(url));
  const methodologyText = hasText(html, /methodology|methods|provenance|sampling|limitations?/i)
    || hasText(datasetMetadataText, /methodology|provenance|sampling|limitations?/i)
    || hasText(manifestText, /methodology|provenance|sampling|limitations?/i);
  const checksumSignal = hasText(manifestText, /sha-?256|sha256|checksum|content-digest/i)
    || hasText(datasetMetadataText, /sha-?256|sha256|checksum|content-digest/i);

  if (!corpusSignal) {
    return {
      version: DATASET_PUBLICATION_VERSION,
      canonicalUrl: base,
      applicability: 'not-observed',
      status: 'not-applicable-or-undetected',
      checks: [],
      evidence: { datasetNodes: 0, dataLinks: [] },
      recommendations: [],
      limitations: ['A bounded page audit cannot prove that an unlinked repository corpus does not exist. Repository inspection may still activate the dataset module.']
    };
  }

  const checks = [
    check('dataset-canonical-metadata', 'P1', allDatasetNodes.length ? 'pass' : 'warn', 'Publish canonical Dataset metadata', allDatasetNodes.flatMap(node => arrays(node.url).map(String)), 'Prefer a stable human landing page plus Schema.org Dataset JSON-LD; Croissant/DCAT can complement it when appropriate.'),
    check('dataset-version', 'P1', versions.length ? 'pass' : 'warn', 'Version the dataset release', versions.map(value => `version:${value}`)),
    check('dataset-license', 'P1', licenses.length ? 'pass' : 'warn', 'Publish explicit reuse rights', licenses),
    check('dataset-methodology', 'P1', methodologyLinks.length || methodologyText ? 'pass' : 'warn', 'Publish methodology, provenance and limitations', methodologyLinks),
    check('dataset-distributions', 'P1', distributions.length ? 'pass' : 'warn', 'Expose stable dataset distributions', distributions),
    check('dataset-release-integrity', 'P2', checksumSignal ? 'pass' : 'warn', 'Freeze cited release bytes and publish checksums', checksumSignal ? ['checksum/digest metadata observed'] : []),
    check('dataset-persistent-identifier', 'P1', doiCandidates.length || zenodoLinks.length ? 'pass' : 'fail', 'Publish the dataset release through an external archive and expose its DOI', [...doiUrls, ...zenodoLinks], 'A DOI is a citation/version identity signal, not a Search ranking factor. Do not invent a DOI before the archive actually issues one.')
  ];

  const recommendations = checks
    .filter(item => item.status === 'warn' || item.status === 'fail')
    .map(item => ({ id: `dataset:${item.id}`, priority: item.priority, title: item.title, reason: item.note || 'Required evidence was not observed.' }));

  return {
    version: DATASET_PUBLICATION_VERSION,
    canonicalUrl: base,
    applicability: 'dataset-bearing',
    status: doiCandidates.length || zenodoLinks.length ? 'citable-dataset-observed' : 'dataset-doi-missing',
    checks,
    evidence: {
      datasetNodes: allDatasetNodes.length,
      cffDataset,
      dataLinks: distributions.slice(0, 20),
      versions,
      licenses,
      doiCandidates,
      doiUrls,
      zenodoLinks,
      methodologyLinks,
      checksumSignal
    },
    recommendations,
    limitations: [
      'Observed DOI syntax is not, by itself, proof that the DOI resolves to the intended immutable dataset release.',
      'A DOI does not imply quality, endorsement, Search ranking impact or AI citation.',
      'The module applies only when a site has a genuine reusable corpus or research dataset; do not manufacture a thin dataset to satisfy the profile.'
    ]
  };
}

async function optional(url, options, accept = 'text/plain, application/json;q=0.9, text/html;q=0.8, */*;q=0.1') {
  try {
    return await fetchPublicText(url, { ...options, accept, userAgent: 'arwp-dataset-publication/0.1' });
  } catch (error) {
    return { ok: false, url, text: '', issue: String(error?.message || error) };
  }
}

export async function auditDatasetPublication(input, options = {}) {
  const network = {
    fetchImpl: options.fetchImpl || fetch,
    ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
    timeoutMs: options.timeoutMs || 8000,
    maxBytes: options.maxBytes || 512 * 1024
  };
  const entry = options.entryPage || await optional(input, network, 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1');
  const canonicalUrl = normalizeUrl(entry?.url || input, input) || normalizeUrl(input, input);
  if (!entry?.ok || !canonicalUrl) throw new Error(`Dataset publication audit could not read ${input}: ${entry?.issue || 'entry page unavailable'}`);
  const base = canonicalUrl.endsWith('/') ? canonicalUrl : `${canonicalUrl}/`;
  const candidates = {
    citation: new URL('CITATION.cff', base).href,
    datasetMetadata: new URL('data/dataset.jsonld', base).href,
    datasetMetadataAlt: new URL('dataset.jsonld', base).href,
    manifest: new URL('data/dataset-publication.json', base).href,
    manifestAlt: new URL('dataset/manifest.json', base).href
  };
  const injected = options.resources || {};
  const citation = injected.citation || await optional(candidates.citation, network);
  const metadataA = injected.datasetMetadata || await optional(candidates.datasetMetadata, network, 'application/ld+json, application/json;q=0.9, */*;q=0.1');
  const metadataB = metadataA.ok ? { ok: false, text: '' } : (injected.datasetMetadataAlt || await optional(candidates.datasetMetadataAlt, network, 'application/ld+json, application/json;q=0.9, */*;q=0.1'));
  const manifestA = injected.manifest || await optional(candidates.manifest, network, 'application/json, */*;q=0.1');
  const manifestB = manifestA.ok ? { ok: false, text: '' } : (injected.manifestAlt || await optional(candidates.manifestAlt, network, 'application/json, */*;q=0.1'));

  const report = analyzeDatasetPublication({
    canonicalUrl,
    html: entry.text,
    citationText: citation.ok ? citation.text : '',
    datasetMetadataText: metadataA.ok ? metadataA.text : metadataB.ok ? metadataB.text : '',
    manifestText: manifestA.ok ? manifestA.text : manifestB.ok ? manifestB.text : ''
  });
  report.probed = {
    citation: { url: candidates.citation, observed: Boolean(citation.ok) },
    datasetMetadata: { url: metadataA.ok ? candidates.datasetMetadata : candidates.datasetMetadataAlt, observed: Boolean(metadataA.ok || metadataB.ok) },
    manifest: { url: manifestA.ok ? candidates.manifest : candidates.manifestAlt, observed: Boolean(manifestA.ok || manifestB.ok) }
  };
  return report;
}

export function formatDatasetPublicationReport(report) {
  const lines = [
    `ARWP dataset publication audit: ${report.canonicalUrl}`,
    `Applicability: ${report.applicability}`,
    `Status: ${report.status}`
  ];
  for (const item of report.checks || []) lines.push(`${item.status.toUpperCase().padEnd(4)} ${item.priority} ${item.id} — ${item.title}`);
  if (report.recommendations?.length) {
    lines.push('', 'Recommended:');
    for (const item of report.recommendations) lines.push(`- ${item.priority} ${item.title}`);
  }
  lines.push('', 'DOI publication is a durable citation/provenance mechanism, not a ranking guarantee.');
  return lines.join('\n');
}
