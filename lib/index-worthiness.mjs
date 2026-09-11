const DATA_SITE_TYPES = new Set(['data-site', 'research-dataset', 'large-knowledge-site']);
const STATUS = new Set(['pass', 'fail', 'unknown', 'not-applicable']);
const BASE_GATES = ['demand', 'uniqueValue', 'standaloneUtility', 'provenance', 'connectivity', 'canonicalIdentity', 'freshnessIntegrity'];

export const INDEX_WORTHINESS_VERSION = '1.0';

function normalizeGate(value, id) {
  const gate = value && typeof value === 'object' ? value : {};
  const status = STATUS.has(gate.status) ? gate.status : 'unknown';
  return {
    id,
    status,
    evidence: Array.isArray(gate.evidence) ? gate.evidence.map(String).filter(Boolean) : []
  };
}

function requiredGateIds(siteType) {
  return DATA_SITE_TYPES.has(siteType) ? [...BASE_GATES, 'entityDepth'] : BASE_GATES;
}

export function evaluateIndexWorthinessPage(page, siteType = 'general') {
  if (!page || typeof page !== 'object' || !page.url) throw new Error('Index Worthiness page requires url.');
  const required = requiredGateIds(siteType);
  const gates = Object.fromEntries(required.map(id => [id, normalizeGate(page.gates?.[id], id)]));
  if (!DATA_SITE_TYPES.has(siteType) && page.gates?.entityDepth) gates.entityDepth = normalizeGate(page.gates.entityDepth, 'entityDepth');

  const failed = Object.values(gates).filter(gate => gate.status === 'fail').map(gate => gate.id);
  const unresolved = Object.values(gates).filter(gate => gate.status === 'unknown').map(gate => gate.id);
  const exclusionFailure = failed.find(id => id === 'demand' || id === 'uniqueValue');

  let state = 'index-candidate';
  if (exclusionFailure) state = 'exclude-from-search-candidate';
  else if (failed.length) state = 'hold';
  else if (unresolved.length) state = 'review';

  const signals = [];
  if (page.generated === true && gates.uniqueValue?.status !== 'pass') signals.push('generated-without-unique-value-pass');
  if (page.variantOf) signals.push('declared-variant');
  if (page.variantOf && state === 'index-candidate') signals.push('variant-index-candidate-review-needed');

  return {
    url: String(page.url),
    generated: Boolean(page.generated),
    variantOf: page.variantOf ? String(page.variantOf) : null,
    state,
    sitemapEligible: state === 'index-candidate',
    failedGates: failed,
    unresolvedGates: unresolved,
    signals,
    gates
  };
}

export function buildIndexWorthinessReport(review) {
  if (!review || typeof review !== 'object') throw new Error('Index Worthiness review must be an object.');
  if (review.version !== INDEX_WORTHINESS_VERSION) throw new Error(`Index Worthiness review version must be ${INDEX_WORTHINESS_VERSION}.`);
  if (!review.site) throw new Error('Index Worthiness review requires site.');
  if (!Array.isArray(review.pages) || review.pages.length === 0) throw new Error('Index Worthiness review requires at least one page.');

  const siteType = review.siteType || 'general';
  if (![...DATA_SITE_TYPES, 'general'].includes(siteType)) throw new Error(`Unsupported siteType: ${siteType}`);

  const pages = review.pages.map(page => evaluateIndexWorthinessPage(page, siteType));
  const counts = Object.fromEntries(['index-candidate', 'review', 'hold', 'exclude-from-search-candidate'].map(state => [
    state,
    pages.filter(page => page.state === state).length
  ]));
  const generatedPages = pages.filter(page => page.generated);
  const variantPages = pages.filter(page => page.variantOf);

  return {
    version: INDEX_WORTHINESS_VERSION,
    site: String(review.site),
    siteType,
    reviewedAt: review.reviewedAt || null,
    methodology: 'non-composite publication gate',
    summary: {
      pages: pages.length,
      states: counts,
      sitemapEligiblePages: pages.filter(page => page.sitemapEligible).length
    },
    scaledContentSignals: {
      generatedPages: generatedPages.length,
      generatedWithoutUniqueValuePass: generatedPages.filter(page => page.gates.uniqueValue?.status !== 'pass').length,
      variantPages: variantPages.length,
      variantIndexCandidates: variantPages.filter(page => page.state === 'index-candidate').length
    },
    pages,
    guardrails: {
      noCompositeScore: true,
      sitemapIsCuratedIndexCohort: true,
      noAutomaticNoindexMutation: true,
      eligibilityIsNotRankingProof: true,
      demandCannotBeInferredFromUrlCount: true
    }
  };
}

export function formatIndexWorthinessReport(report) {
  const lines = [
    `ARWP Index Worthiness v${report.version} — ${report.site}`,
    `Site type: ${report.siteType}`,
    `Pages: ${report.summary.pages}; sitemap-eligible: ${report.summary.sitemapEligiblePages}`,
    `States: ${Object.entries(report.summary.states).map(([state, count]) => `${state}=${count}`).join(', ')}`,
    `Scaled-content signals: generated=${report.scaledContentSignals.generatedPages}, generated-without-unique-value-pass=${report.scaledContentSignals.generatedWithoutUniqueValuePass}, variants=${report.scaledContentSignals.variantPages}, variant-index-candidates=${report.scaledContentSignals.variantIndexCandidates}`,
    'No composite SEO/index-worthiness score.',
    ''
  ];
  for (const page of report.pages) {
    const reasons = [...page.failedGates.map(id => `fail:${id}`), ...page.unresolvedGates.map(id => `unknown:${id}`), ...page.signals];
    lines.push(`${page.state.toUpperCase()} ${page.url}${reasons.length ? ` — ${reasons.join(', ')}` : ''}`);
  }
  return lines.join('\n');
}
