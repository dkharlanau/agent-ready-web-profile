import { validateInternalDiscoveryReport } from './internal-discovery.mjs';

const kinds = new Set(['learn', 'do', 'verify', 'prerequisite', 'alternative']);
const allowedKeys = (value, keys, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${name}: unknown field ${key}.`);
};
const string = (value, name, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${name} must be a non-empty single-line string of at most ${max} characters.`);
  return value;
};
function url(value, name) {
  string(value, name, 2048);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be an absolute HTTPS URL.`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.href !== value) throw new Error(`${name} must be a normalized HTTPS URL without credentials or fragment.`);
  return parsed;
}
function locale(value) {
  string(value, 'locale', 80);
  try {
    const canonical = Intl.getCanonicalLocales(value);
    if (canonical.length !== 1 || canonical[0] !== value) throw new Error();
  } catch { throw new Error('locale must be a canonical BCP 47 language tag.'); }
  return value;
}

/** Compare explicitly proposed relationships with a saved, bounded HTML observation.
 * This does not validate semantic relevance, editorial review, current live state or target eligibility. */
export function reviewIntentGraph(graph, report) {
  const validation = validateInternalDiscoveryReport(report);
  if (!validation.valid) throw new Error('Invalid internal discovery report.');
  allowedKeys(graph, ['version', 'site', 'relations'], 'graph');
  if (graph.version !== '1') throw new Error('graph.version must be "1".');
  const site = url(graph.site, 'site');
  if (site.href !== new URL(report.canonicalUrl).href) throw new Error('graph.site must match the report canonicalUrl.');
  if (!Array.isArray(graph.relations) || graph.relations.length > 1000) throw new Error('relations must be an array of at most 1000 entries.');
  const keys = new Set();
  const rows = graph.relations.map((item, index) => {
    const name = `relations[${index}]`;
    allowedKeys(item, ['from', 'to', 'locale', 'kind', 'label', 'reason'], name);
    const from = url(item.from, `${name}.from`);
    const to = url(item.to, `${name}.to`);
    if (from.origin !== site.origin || to.origin !== site.origin || from.href === to.href) throw new Error(`${name} must connect two distinct same-origin URLs.`);
    locale(item.locale);
    if (!kinds.has(item.kind)) throw new Error(`${name}.kind is unsupported.`);
    string(item.label, `${name}.label`, 160);
    string(item.reason, `${name}.reason`, 1000);
    const key = JSON.stringify([item.from, item.to, item.locale, item.kind]);
    if (keys.has(key)) throw new Error(`${name} duplicates an existing relationship.`);
    keys.add(key);
    const nodeFor = target => report.nodes.find(n => n.requestedUrl === target) || report.nodes.find(n => n.nodeClass === 'canonical-owner' && n.url === target);
    const source = nodeFor(item.from);
    const target = nodeFor(item.to);
    const sourceState = source?.nodeClass || 'out-of-cohort';
    const targetState = target?.nodeClass || 'out-of-cohort';
    const matching = sourceState === 'canonical-owner' ? report.edges.filter(e => e.from === item.from && e.to === item.to && e.crawlable && e.sameOrigin) : [];
    let observation = 'unknown';
    if (matching.length) observation = 'observed-link';
    else if (sourceState === 'canonical-owner' && !source.evidence.some(e => e.startsWith('internal-anchor-observation-capped-at:'))) observation = 'not-observed-from-sampled-source';
    return { ...item, sourceState, targetState, observation, observedClasses: [...new Set(matching.map(e => e.linkClass))].sort() };
  });
  return { version: '1', site: graph.site, observedAt: report.generatedAt, selectionMethod: report.cohort.selectionMethod, rows };
}

function escape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\[\]*_`\\|]/g, c => `&#${c.charCodeAt(0)};`);
}
function link(value) { return `[${escape(value)}](<${value.replace(/[<>]/g, c => encodeURIComponent(c))}>)`; }

export function formatIntentGraphReview(graph, report) {
  const review = reviewIntentGraph(graph, report);
  const lines = [
    '# Proposed intent relationships: review', '',
    `Site: ${link(review.site)}  `,
    `HTML observation: ${escape(review.observedAt)}  `,
    `Selection: ${escape(review.selectionMethod)}`, '',
    '> Relationships and labels are supplied proposals. An observed link does not establish its semantic meaning, usefulness, visibility or current live state. A missing sampled edge is not proof of a sitewide gap. This file does not authorize publication.', '',
    'Review the source and destination, locale, relevance and product behavior before using a proposal. An out-of-cohort or non-owner destination is not validated by this report.', ''
  ];
  if (!review.rows.length) lines.push('No relationships supplied.', '');
  for (const row of review.rows) {
    lines.push(`## ${escape(row.label)}`, '',
      `- From: ${link(row.from)} (${escape(row.sourceState)})`,
      `- To: ${link(row.to)} (${escape(row.targetState)})`,
      `- Intended job: ${escape(row.kind)} · locale: ${escape(row.locale)}`,
      `- Reason supplied: ${escape(row.reason)}`,
      `- Bounded HTML observation: **${escape(row.observation)}**${row.observedClasses.length ? ` (${row.observedClasses.map(escape).join(', ')})` : ''}`, '');
  }
  lines.push('Review sharing permissions: the input and report may contain private owner evidence.', '');
  return lines.join('\n');
}
