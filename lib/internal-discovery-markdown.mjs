import { validateInternalDiscoveryReport } from './internal-discovery.mjs';

// Treat observed text as data, including when a report comes from an untrusted site.
function text(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ').replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')
    .replace(/[*_`\\|]/g, c => `&#${c.charCodeAt(0)};`);
}

function link(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Graph URLs must use HTTPS.');
  const href = url.href.replace(/[<>]/g, c => encodeURIComponent(c));
  return `[${text(value)}](<${href}>)`;
}

/** Render a validated observation, not a sitewide or published content graph. */
export function formatInternalDiscoveryMarkdown(report) {
  const validation = validateInternalDiscoveryReport(report);
  if (!validation.valid) throw new Error(`Invalid internal discovery report: ${validation.errors.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ')}`);

  const s = report.summary;
  const ambiguousRobots = report.nodes.filter(n => n.evidence.includes('x-robots-tag-scope-ambiguous')).length;
  const owners = [...new Set(report.nodes.filter(n => n.nodeClass === 'canonical-owner').map(n => n.url))].sort();
  const ownerSet = new Set(owners);
  const groups = new Map(owners.map(url => [url, new Map()]));
  for (const edge of report.edges) {
    if (edge.targetState !== 'canonical-owner' || edge.from === edge.to || !ownerSet.has(edge.from) || !ownerSet.has(edge.to)) continue;
    const targets = groups.get(edge.from);
    if (!targets.has(edge.to)) targets.set(edge.to, new Map());
    // The report has at most one retained edge per source/target/class.
    // Preserve that observed label with its class; do not infer a relation.
    if (!targets.get(edge.to).has(edge.linkClass)) targets.get(edge.to).set(edge.linkClass, edge.anchorText);
  }

  const lines = [
    '# Internal discovery map', '',
    `Site: ${link(report.canonicalUrl)}  `,
    `Observed: ${text(report.generatedAt)}  `,
    `Cohort: ${s.reviewedPages} reviewed pages, ${s.canonicalOwners} observed canonical owners  `,
    `Selection: ${text(report.cohort.selectionMethod)}`, '',
    '> This map covers a bounded raw-HTML sample, not the whole site. Link classes are structural heuristics; they do not establish rendered visibility, indexing or ranking.', '',
    `Within the sample: ${s.ownerEdges} owner-to-owner edges; ${s.outOfCohortInternalEdges} edges lead outside the sample; ${s.unknownNodes} pages are unknown.`,
    `Inbound gap evaluation: **${s.gapEvaluationState}** within the observed cohort; ${s.truncatedPages} pages reached the link-observation cap.`, '',
    ...(ambiguousRobots ? [`${ambiguousRobots} sampled page(s) have ambiguous crawler-specific indexing headers. Their owner state is unknown; review the original response headers.`, ''] : []),
    '## Observed links between owners', '',
    'Each arrow represents an observed crawlable link. Classes describe HTML placement. For each class, the first retained anchor is shown as an observation, not a semantic relation; text beyond 160 characters is truncated.', ''
  ];
  if (!owners.length) lines.push('No canonical owners were observed.', '');
  for (const owner of owners) {
    lines.push(`### ${link(owner)}`, '');
    const targets = [...groups.get(owner)].sort(([a], [b]) => a.localeCompare(b));
    if (!targets.length) lines.push('No links to another sampled owner were observed.', '');
    else {
      for (const [target, classes] of targets) {
        const observed = [...classes].sort(([a], [b]) => a.localeCompare(b)).map(([kind, anchor]) => {
          if (typeof anchor !== 'string' || !anchor.trim()) return `${text(kind)} (anchor not recorded)`;
          const characters = Array.from(anchor.trim());
          const label = characters.slice(0, 160).join('') + (characters.length > 160 ? '…' : '');
          return `${text(kind)} (anchor: “${text(label)}”)`;
        });
        lines.push(`- → ${link(target)} — ${observed.join(', ')}`);
      }
      lines.push('');
    }
  }
  lines.push('## Review candidates', '', 'These are prompts to verify, not confirmed sitewide defects.', '');
  if (!report.actions.length) lines.push('No review actions were emitted for this sample.', '');
  else for (const item of report.actions) lines.push(`- **${text(item.priority)} · ${text(item.title)}:** ${link(item.url)} — ${text(item.reason)}`);
  if (report.actions.length) lines.push('');
  const otherNodes = report.nodes.filter(n => n.nodeClass !== 'canonical-owner');
  lines.push('## Other sampled states', '');
  if (!otherNodes.length) lines.push('No aliases, non-indexable states or unknown pages were recorded in this sample.', '');
  else {
    for (const node of otherNodes) lines.push(`- ${link(node.requestedUrl)} — ${text(node.nodeClass)}`);
    lines.push('');
  }
  lines.push('This file may contain owner observations. Review its contents and disclosure policy before sharing or publishing.', '');
  return lines.join('\n');
}
