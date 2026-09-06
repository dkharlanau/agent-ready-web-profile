/** Optional publisher evidence inventory. No network calls, trust score or ranking claim. */
import { createHash } from 'node:crypto';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const https = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
};
export const safeRelativePath = value => text(value) && !/[:\\\x00]/.test(value)
  && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..');

export function jsonLdNodes(html) {
  const nodes = [];
  for (const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const value = JSON.parse(match[1]);
    nodes.push(...(Array.isArray(value) ? value : Array.isArray(value?.['@graph']) ? value['@graph'] : [value]));
  }
  return nodes;
}

/** readText is an injected synchronous, repository-scoped reader. Returned hashes cover observed bytes only. */
export function auditMaturity(profile, { readText } = {}) {
  const errors = [], review = [], files = new Map();
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const read = file => {
    if (!safeRelativePath(file)) { errors.push(`Unsafe or missing repository path: ${String(file)}`); return null; }
    if (files.has(file)) return files.get(file).content;
    try {
      const value = readText(file);
      if (typeof value !== 'string' || !value.trim()) throw new Error('empty or non-text file');
      const bytes = Buffer.from(value, 'utf8');
      if (bytes.length > 5_000_000) throw new Error('file exceeds 5 MB inventory limit');
      files.set(file, { content: value, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      return value;
    } catch (error) { errors.push(`${file}: ${error.message}`); return null; }
  };
  const json = file => {
    const value = read(file);
    if (value === null) return null;
    try { return JSON.parse(value); } catch { errors.push(`${file}: invalid JSON`); return null; }
  };
  const doi = (value, label) => {
    if (!object(value)) { errors.push(`${label}: explicit DOI state is required`); return; }
    require(['not-issued', 'reserved', 'issued'].includes(value.state), `${label}: invalid DOI state`);
    if (value.state === 'not-issued') require(value.value === null, `${label}: unissued DOI must be null`);
    else {
      require(typeof value.value === 'string' && /^10\.\d{4,9}\/\S+$/i.test(value.value), `${label}: invalid DOI syntax`);
      if (value.state === 'issued') {
        require(https(value.recordUrl), `${label}: issued DOI needs the actual repository record URL`);
        require(typeof value.verifiedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.verifiedAt) && !Number.isNaN(Date.parse(value.verifiedAt)) && new Date(value.verifiedAt).toISOString().slice(0, 10) === value.verifiedAt, `${label}: issued DOI needs a dated review`);
        require(https(value.metadataEvidence), `${label}: issued DOI needs issuer metadata evidence`);
      }
    }
    review.push(`${label}: ${value.state}; confirm publication, resolution, object identity and version with the issuer before making a public DOI claim.`);
  };
  if (!object(profile)) return { valid: false, scope: 'static-evidence-inventory', errors: ['Profile must be an object'], review, files: [] };
  require(profile.schemaVersion === '1.0', 'Unsupported maturity profile schemaVersion');
  require(https(profile.site), 'site must be an HTTPS canonical URL');
  require(text(profile.stage), 'stage must state the actual project stage');
  const identity = object(profile.identity) ? profile.identity : {};
  const graph = json(identity.graph);
  const nodes = Array.isArray(graph?.['@graph']) ? graph['@graph'] : [];
  require(nodes.length > 0, 'Identity graph must contain @graph nodes');
  const ids = nodes.map(node => node?.['@id']);
  require(ids.every(https), 'Graph entity IDs must be absolute HTTPS identifiers');
  require(new Set(ids).size === ids.length, 'Duplicate graph entity IDs');
  const byId = new Map(nodes.filter(object).map(node => [node['@id'], node]));
  for (const field of ['subjectId', 'ownerId', 'websiteId']) require(byId.has(identity[field]), `Missing identity entity: ${field}`);
  const owner = byId.get(identity.ownerId);
  require(['Person', 'Organization'].includes(owner?.['@type']) && text(owner?.name), 'Owner must be a named Person or Organization');
  require(byId.get(identity.websiteId)?.['@type'] === 'WebSite', 'websiteId must reference a WebSite');
  require(byId.get(identity.websiteId)?.url === profile.site, 'WebSite URL must match profile.site');
  review.push('Identity: sameAs, authorship, organization status and visible-page parity need human review; graph consistency is not authority.');

  require(object(profile.policies), 'policies must be an object of repository paths');
  for (const [name, file] of Object.entries(object(profile.policies) ? profile.policies : {})) {
    require(text(name), 'Policy name must not be empty'); read(file);
  }
  require(Array.isArray(profile.datasets), 'datasets must be an array; use [] when no genuine dataset exists');
  const datasetIds = new Set();
  for (const item of Array.isArray(profile.datasets) ? profile.datasets : []) {
    if (!object(item)) { errors.push('Dataset entry must be an object'); continue; }
    const label = text(item.id) ? item.id : 'unnamed dataset';
    require(!datasetIds.has(item.id), `${label}: duplicate dataset entry`); datasetIds.add(item.id);
    const entity = byId.get(item.id);
    require(entity?.['@type'] === 'Dataset', `${label}: must reference an existing Dataset entity`);
    require(text(item.limitations), `${label}: limitations are required`);
    require(https(item.license) && entity?.license === item.license, `${label}: graph/license mismatch`);
    const distribution = read(item.distribution);
    if (typeof item.distribution === 'string' && item.distribution.endsWith('.json') && distribution !== null) json(item.distribution);
    const html = read(item.landingPage);
    if (html !== null) {
      try {
        const leaf = jsonLdNodes(html).find(node => node?.['@id'] === item.id && node?.['@type'] === 'Dataset');
        require(Boolean(leaf), `${label}: missing Dataset with stable @id on the landing page`);
        require(text(leaf?.name) && text(leaf?.description), `${label}: landing markup needs name and description`);
        require(typeof leaf?.description === 'string' && leaf.description.length >= 50 && leaf.description.length <= 5000, `${label}: Dataset description must contain 50 to 5000 characters`);
        require(leaf?.name === entity?.name, `${label}: graph/landing name mismatch`);
        require(leaf?.license === item.license, `${label}: landing/license mismatch`);
        require(leaf?.creator?.['@id'] === identity.ownerId, `${label}: missing canonical creator`);
        require(leaf?.url === entity?.url, `${label}: graph/landing URL mismatch`);
        const downloads = Array.isArray(leaf?.distribution) ? leaf.distribution : [leaf?.distribution];
        const expected = Array.isArray(entity?.distribution) ? entity.distribution : [entity?.distribution];
        require(downloads.some(d => d?.['@type'] === 'DataDownload' && https(d.contentUrl) && text(d.encodingFormat) && expected.some(e => e?.contentUrl === d.contentUrl)), `${label}: missing matching typed DataDownload`);
      } catch { errors.push(`${label}: invalid landing-page JSON-LD`); }
    }
    doi(item.doi, label);
  }
  if (object(profile.citation)) {
    const cff = read(profile.citation.file);
    doi(profile.citation.doi, 'Software citation');
    if (profile.citation.doi?.state === 'not-issued' && cff !== null) require(!/^doi:\s*\S+/mi.test(cff), 'CITATION.cff claims an unissued DOI');
  }
  if (object(profile.analytics)) {
    const plan = json(profile.analytics.plan);
    if (profile.analytics.instrumentationSource !== undefined) read(profile.analytics.instrumentationSource);
    require(plan?.schemaVersion === '1.0', 'Measurement plan schemaVersion must be 1.0');
    require(plan?.unknownIsZero === false, 'Unknown measurements must not become zero');
    require(plan?.publicExport === 'aggregate-only', 'Public analytics exports must be aggregate-only');
    require(plan?.personalDataAllowed === false, 'Measurement plan must prohibit personal data');
    require(Array.isArray(plan?.metrics) && plan.metrics.length > 0, 'Measurement plan needs metric definitions');
    const metricIds = new Set();
    for (const metric of Array.isArray(plan?.metrics) ? plan.metrics : []) {
      require(object(metric) && text(metric.id) && !metricIds.has(metric.id), 'Metric IDs must be unique and nonempty'); metricIds.add(metric?.id);
      require(text(metric?.definition) && text(metric?.source) && text(metric?.grain) && text(metric?.limitation), 'Each metric needs definition, source, grain and limitation');
      if (metric?.status === 'not-measured') require(metric.baseline === null, `${metric.id}: unmeasured baseline must be null`);
    }
    review.push('Analytics: definitions do not deploy instrumentation. Verify consent/revocation, minimized payloads, actual collection, coverage and owner-side exports in a browser and the provider account.');
  }
  return { valid: errors.length === 0, scope: 'static-evidence-inventory-not-certification', errors, review,
    files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, value]) => ({ path, bytes: value.bytes, sha256: value.sha256 })) };
}
