import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSiteFocusReportFromPages, formatSiteFocusReport } from '../lib/site-focus.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const base = 'https://dkharlanau.github.io/agent-ready-web-profile/';
const samples = [
  ['index.html', base],
  ['site-focus.html', `${base}site-focus.html`],
  ['discoverability.html', `${base}discoverability.html`],
  ['growth/index.html', `${base}growth/`],
  ['trust/index.html', `${base}trust/`],
  ['answers/index.html', `${base}answers/`],
  ['concepts/index.html', `${base}concepts/`],
  ['observatory/index.html', `${base}observatory/`]
];

const pages = samples.filter(([file]) => fs.existsSync(path.join(docs, file))).map(([file, url]) => ({
  url,
  html: fs.readFileSync(path.join(docs, file), 'utf8'),
  status: 200
}));

if (pages.length < 6) throw new Error(`Expected at least 6 Goose dogfood pages, found ${pages.length}.`);
const report = buildSiteFocusReportFromPages(pages, { canonicalUrl: base, discovery: { mode: 'dogfood-curated', files: samples.map(([file]) => `docs/${file}`) } });

if (!report.guardrails.noOpaqueScore) throw new Error('Dogfood report lost the no-score guardrail.');
if (report.pageContracts.some(page => ['REMOVE', 'SPLIT'].includes(page.decision))) throw new Error('Dogfood emitted a destructive automatic disposition.');

console.log(formatSiteFocusReport(report));
console.log('\nDOGFOOD_JSON');
console.log(JSON.stringify({ metrics: report.metrics, dispositions: report.dispositions, findings: report.siteFindings.map(item => item.id) }, null, 2));