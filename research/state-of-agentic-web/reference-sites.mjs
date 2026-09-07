import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultFile = path.join(here, 'reference-sites.json');
const BASELINE_CLASSES = new Set(['existing-site', 'new-site']);

export function loadReferenceSites(file = defaultFile) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function validateReferenceSites(cohort = loadReferenceSites()) {
  const errors = [];
  if (cohort?.version !== '0.1') errors.push('reference cohort version must be 0.1');
  if (cohort?.aggregatePolicy?.ownerControlled !== true) errors.push('ownerControlled must be true');
  if (cohort?.aggregatePolicy?.includedInIndependentAggregate !== false) errors.push('owner references must be excluded from the independent aggregate');
  if (cohort?.aggregatePolicy?.comparisonOnly !== true) errors.push('reference cohort must remain comparison-only');
  if (!Array.isArray(cohort?.sites) || cohort.sites.length === 0) errors.push('reference cohort must contain sites');

  const ids = new Set();
  const urls = new Set();
  const repos = new Set();
  for (const site of cohort?.sites || []) {
    if (!site?.id || ids.has(site.id)) errors.push(`duplicate or missing site id: ${site?.id ?? '<missing>'}`);
    ids.add(site?.id);
    if (!/^https:\/\//.test(site?.canonicalUrl || '') || urls.has(site.canonicalUrl)) errors.push(`invalid or duplicate canonicalUrl for ${site?.id}`);
    urls.add(site?.canonicalUrl);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(site?.repository || '') || repos.has(site.repository)) errors.push(`invalid or duplicate repository for ${site?.id}`);
    repos.add(site?.repository);
    if (!BASELINE_CLASSES.has(site?.baselineClass)) errors.push(`invalid baselineClass for ${site?.id}`);
    if (site?.baselineClass === 'new-site' && !/^\d{4}-\d{2}-\d{2}$/.test(site?.firstPublicEvidenceAt || '')) errors.push(`new-site ${site?.id} requires firstPublicEvidenceAt`);
  }

  return { valid: errors.length === 0, errors };
}

export function buildReferenceSummary(cohort = loadReferenceSites()) {
  const validation = validateReferenceSites(cohort);
  if (!validation.valid) throw new Error(`Invalid owner reference cohort:\n- ${validation.errors.join('\n- ')}`);
  const byBaselineClass = {};
  for (const site of cohort.sites) byBaselineClass[site.baselineClass] = (byBaselineClass[site.baselineClass] || 0) + 1;
  return {
    version: cohort.version,
    reviewedAt: cohort.reviewedAt,
    sites: cohort.sites.length,
    byBaselineClass,
    independentAggregateSites: 0,
    ownerControlled: true,
    comparisonOnly: true,
    newSites: cohort.sites.filter(site => site.baselineClass === 'new-site').map(site => ({
      id: site.id,
      canonicalUrl: site.canonicalUrl,
      firstPublicEvidenceAt: site.firstPublicEvidenceAt
    }))
  };
}
