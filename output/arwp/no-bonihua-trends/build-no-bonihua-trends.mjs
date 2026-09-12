import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const gscPath = path.resolve(repoRoot, 'gsc-2026-09-05.json');
const registryPath = path.resolve(repoRoot, 'seo-project-registry.json');
const outputJson = path.resolve(scriptDir, 'seo-no-bonihua-trends.artifact.json');
const outputCsv = path.resolve(scriptDir, 'seo-no-bonihua-trends.csv');
const outputMd = path.resolve(scriptDir, 'seo-no-bonihua-trends.md');

const gsc = JSON.parse(fs.readFileSync(gscPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')).projects;
const byProperty = new Map(gsc.results.map((row) => [row.property, row]));

const isBonihua = (value) => /bonihua/i.test(String(value));
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const toRows = (items) =>
  items
    .map((item) => {
      const row = byProperty.get(item.property) || { current: {}, previous: {} };
      const current = row.current || {};
      const previous = row.previous || {};
      const clicksCurrent = num(current.clicks, 0);
      const clicksPrevious = num(previous.clicks, 0);
      const impressionsCurrent = num(current.impressions, 0);
      const impressionsPrevious = num(previous.impressions, 0);
      const ctrCurrent = num(current.ctr, 0);
      const ctrPrevious = num(previous.ctr, 0);
      const positionCurrent = typeof current.position === 'number' ? current.position : null;
      const positionPrevious =
        typeof previous.position === 'number' ? previous.position : null;

      return {
        project: item.project,
        property: item.property,
        clicks_current: clicksCurrent,
        clicks_previous: clicksPrevious,
        clicks_delta: clicksCurrent - clicksPrevious,
        impressions_current: impressionsCurrent,
        impressions_previous: impressionsPrevious,
        impressions_delta: impressionsCurrent - impressionsPrevious,
        ctr_current: ctrCurrent,
        ctr_previous: ctrPrevious,
        ctr_delta: ctrCurrent - ctrPrevious,
        position_current: positionCurrent,
        position_previous: positionPrevious,
        position_delta:
          positionCurrent !== null && positionPrevious !== null
            ? positionCurrent - positionPrevious
            : null,
        current_has_rows: !!current.has_rows,
        previous_has_rows: !!previous.has_rows,
      };
    })
    .filter(Boolean);

const sortByCurrentClicks = (rows) =>
  [...rows].sort((a, b) => {
    if (b.clicks_current !== a.clicks_current) {
      return b.clicks_current - a.clicks_current;
    }
    return (a.project || '').localeCompare(b.project || '');
  });

const aggregate = (rows, label) => {
  const base = rows.reduce(
    (acc, row) => {
      acc.clicks_current += row.clicks_current;
      acc.clicks_previous += row.clicks_previous;
      acc.impressions_current += row.impressions_current;
      acc.impressions_previous += row.impressions_previous;

      if (row.impressions_current > 0 && row.position_current !== null) {
        acc.weightedPosCurrent += row.position_current * row.impressions_current;
        acc.imprPosCurrent += row.impressions_current;
      }
      if (row.impressions_previous > 0 && row.position_previous !== null) {
        acc.weightedPosPrevious += row.position_previous * row.impressions_previous;
        acc.imprPosPrevious += row.impressions_previous;
      }
      return acc;
    },
    {
      project: label,
      property: 'AGGREGATE',
      clicks_current: 0,
      clicks_previous: 0,
      impressions_current: 0,
      impressions_previous: 0,
      weightedPosCurrent: 0,
      weightedPosPrevious: 0,
      imprPosCurrent: 0,
      imprPosPrevious: 0,
    }
  );

  const ctrCurrent =
    base.impressions_current > 0
      ? base.clicks_current / base.impressions_current
      : 0;
  const ctrPrevious =
    base.impressions_previous > 0
      ? base.clicks_previous / base.impressions_previous
      : 0;
  const posCurrent = base.imprPosCurrent > 0 ? base.weightedPosCurrent / base.imprPosCurrent : null;
  const posPrevious = base.imprPosPrevious > 0 ? base.weightedPosPrevious / base.imprPosPrevious : null;

  return {
    project: label,
    property: 'AGGREGATE',
    clicks_current: base.clicks_current,
    clicks_previous: base.clicks_previous,
    clicks_delta: base.clicks_current - base.clicks_previous,
    impressions_current: base.impressions_current,
    impressions_previous: base.impressions_previous,
    impressions_delta: base.impressions_current - base.impressions_previous,
    ctr_current: ctrCurrent,
    ctr_previous: ctrPrevious,
    ctr_delta: ctrCurrent - ctrPrevious,
    position_current: posCurrent,
    position_previous: posPrevious,
    position_delta:
      posCurrent !== null && posPrevious !== null ? posCurrent - posPrevious : null,
  };
};

const trackedProjects = registry.filter(
  (entry) => !isBonihua(entry.project) && !isBonihua(entry.property)
);

const trackedRows = sortByCurrentClicks(toRows(trackedProjects));
const trackedProperties = new Set(trackedRows.map((row) => row.property));

const untrackedRows = gsc.results
  .filter((row) => !isBonihua(row.property) && !trackedProperties.has(row.property))
  .map((row) => ({
    project: `UNTRACKED: ${row.property}`,
    property: row.property,
    clicks_current: num((row.current || {}).clicks, 0),
    clicks_previous: num((row.previous || {}).clicks, 0),
    clicks_delta: num((row.current || {}).clicks, 0) - num((row.previous || {}).clicks, 0),
    impressions_current: num((row.current || {}).impressions, 0),
    impressions_previous: num((row.previous || {}).impressions, 0),
    impressions_delta:
      num((row.current || {}).impressions, 0) -
      num((row.previous || {}).impressions, 0),
    ctr_current: num((row.current || {}).ctr, 0),
    ctr_previous: num((row.previous || {}).ctr, 0),
    ctr_delta: num((row.current || {}).ctr, 0) - num((row.previous || {}).ctr, 0),
    position_current:
      typeof (row.current || {}).position === 'number'
        ? (row.current || {}).position
        : null,
    position_previous:
      typeof (row.previous || {}).position === 'number'
        ? (row.previous || {}).position
        : null,
    position_delta:
      typeof (row.current || {}).position === 'number' &&
      typeof (row.previous || {}).position === 'number'
        ? (row.current || {}).position - (row.previous || {}).position
        : null,
    current_has_rows: !!((row.current || {}).has_rows),
    previous_has_rows: !!((row.previous || {}).has_rows),
  }));

const allRows = sortByCurrentClicks([...trackedRows, ...untrackedRows]);
const trackedAggregate = aggregate(trackedRows, 'All tracked projects (Bonihua excluded)');
const allAggregate = aggregate(
  allRows,
  'All non-Bonihua GSC properties'
);

const topClicks = [...trackedRows]
  .sort((a, b) => b.clicks_delta - a.clicks_delta)
  .slice(0, 3);
const topImpressions = [...trackedRows]
  .sort((a, b) => b.impressions_delta - a.impressions_delta)
  .slice(0, 3);
const negative = trackedRows.filter(
  (row) => row.clicks_delta < 0 || row.impressions_delta < 0
);

const payload = {
  generated_at: new Date().toISOString(),
  source: {
    gsc_file: path.relative(repoRoot, gscPath),
    registry_file: path.relative(repoRoot, registryPath),
    window_current: gsc.windows.current,
    window_previous: gsc.windows.previous,
    data_state: 'final',
    search_type: 'web',
    timezone: gsc.timezone,
  },
  exclusion: {
    reason: 'exclude_bonihua',
    patterns: ['bonihua', 'sc-domain:bonihua', 'https://bonihua.com/'],
  },
  tracked_rows: trackedRows,
  untracked_rows: untrackedRows,
  all_rows: allRows,
  aggregates: {
    tracked_no_bonihua: trackedAggregate,
    all_no_bonihua: allAggregate,
  },
  highlights: {
    top_click_growth: topClicks,
    top_impression_growth: topImpressions,
    negative_trends: negative,
  },
};

const csvHeader = [
  'project',
  'property',
  'clicks_current',
  'clicks_previous',
  'clicks_delta',
  'impressions_current',
  'impressions_previous',
  'impressions_delta',
  'ctr_current',
  'ctr_previous',
  'ctr_delta',
  'position_current',
  'position_previous',
  'position_delta',
];

const esc = (value) => {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const csv = [
  csvHeader.join(','),
  ...allRows.map((row) =>
    [
      esc(row.project),
      esc(row.property),
      row.clicks_current,
      row.clicks_previous,
      row.clicks_delta,
      row.impressions_current,
      row.impressions_previous,
      row.impressions_delta,
      row.ctr_current.toFixed(6),
      row.ctr_previous.toFixed(6),
      row.ctr_delta.toFixed(6),
      row.position_current === null ? '' : row.position_current.toFixed(6),
      row.position_previous === null ? '' : row.position_previous.toFixed(6),
      row.position_delta === null ? '' : row.position_delta.toFixed(6),
    ].join(',')
  ),
].join('\n');

const mdLines = [
  '# SEO Trend Export (Bonihua excluded)',
  '',
  `- Scope: all projects with Bonihua removed`,
  `- Current window: ${gsc.windows.current[0]} → ${gsc.windows.current[1]}`,
  `- Previous window: ${gsc.windows.previous[0]} → ${gsc.windows.previous[1]}`,
  `- Excluded: ${payload.exclusion.patterns.join(', ')}`,
  '',
  '## Tracked projects',
  '',
  '| Project | Current clicks | Previous clicks | Δ clicks | Current impressions | Previous impressions | Δ impressions | CTR current | CTR previous | CTR delta | Position current | Position previous | Position delta |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...trackedRows.map((r) =>
    `| ${r.project} | ${r.clicks_current} | ${r.clicks_previous} | ${r.clicks_delta} | ${r.impressions_current} | ${r.impressions_previous} | ${r.impressions_delta} | ${(r.ctr_current * 100).toFixed(2)}% | ${(r.ctr_previous * 100).toFixed(2)}% | ${(r.ctr_delta >= 0 ? '+' : '')}${(r.ctr_delta * 100).toFixed(2)} p.p. | ${
      r.position_current === null ? 'n/a' : r.position_current.toFixed(2)
    } | ${r.position_previous === null ? 'n/a' : r.position_previous.toFixed(2)} | ${
      r.position_delta === null ? 'n/a' : `${r.position_delta >= 0 ? '+' : ''}${r.position_delta.toFixed(2)}`
    } |`
  ),
  '',
  '## Aggregate (tracked only)',
  `- Clicks: ${trackedAggregate.clicks_current} (prev ${trackedAggregate.clicks_previous}), delta ${trackedAggregate.clicks_delta}`,
  `- Impressions: ${trackedAggregate.impressions_current} (prev ${trackedAggregate.impressions_previous}), delta ${trackedAggregate.impressions_delta}`,
  `- CTR: ${(trackedAggregate.ctr_current * 100).toFixed(2)}% (prev ${(trackedAggregate.ctr_previous * 100).toFixed(2)}%)`,
  `- Avg position: ${trackedAggregate.position_current === null ? 'n/a' : trackedAggregate.position_current.toFixed(2)} (prev ${trackedAggregate.position_previous === null ? 'n/a' : trackedAggregate.position_previous.toFixed(2)})`,
  '',
  '## Untracked non-Bonihua GSC properties',
  ...untrackedRows.map((r) => `- ${r.project}: ${r.clicks_current}/${r.clicks_previous} clicks, ${r.impressions_current}/${r.impressions_previous} impressions`),
  '',
  '## Top growth',
  `- top clicks growth: ${topClicks.map((r) => `${r.project} (+${r.clicks_delta})`).join(', ')}`,
  `- top impressions growth: ${topImpressions.map((r) => `${r.project} (+${r.impressions_delta})`).join(', ')}`,
  `- negative trend rows: ${negative.length ? negative.map((r) => `${r.project} (${r.clicks_delta},${r.impressions_delta})`).join(', ') : 'none'}`,
  '',
  '## Update command',
  '',
  '```sh',
  'node output/arwp/no-bonihua-trends/build-no-bonihua-trends.mjs',
  '```',
  '',
  'This script reuses local files and rewrites these outputs:',
  '- seo-no-bonihua-trends.artifact.json',
  '- seo-no-bonihua-trends.csv',
  '- seo-no-bonihua-trends.md',
];

fs.writeFileSync(outputJson, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(outputCsv, `${csv}\n`);
fs.writeFileSync(outputMd, `${mdLines.join('\n')}\n`);

console.log(`wrote: ${outputJson}`);
console.log(`wrote: ${outputCsv}`);
console.log(`wrote: ${outputMd}`);
