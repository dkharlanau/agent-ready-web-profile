import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildSiteFocusReportFromPages, analyzeSiteFocusRepository, formatSiteFocusReport } from '../lib/site-focus-v2.mjs';
import { validateSiteFocusProfile } from '../lib/site-focus-intent.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = {
  version: '0.2',
  canonicalUrl: 'https://example.com/',
  thesis: {
    primaryProblem: 'Speakers need practical voice rehearsal for clearer expressive speech.',
    primaryAudience: 'People practicing a speaking voice.',
    usefulOutcome: 'Choose a bounded exercise and rehearse it with useful evidence.',
    distinctEvidence: 'Worked drills, measurement examples and research sources.',
    primaryAction: 'Start a voice practice session.'
  },
  scope: {
    in: ['voice practice', 'speech rehearsal'],
    adjacent: ['research evidence', 'technical reference'],
    out: ['mechanical keyboard collecting']
  },
  problemLanes: [
    { id: 'practice', label: 'Practice', job: 'Rehearse a speaking skill.' },
    { id: 'understand', label: 'Understand', job: 'Understand why a practice may help.' }
  ],
  primaryNavigation: ['/practice/', '/science/', '/about/'],
  routeRules: [
    { match: { path: '/' }, role: 'problem-commercial', scope: 'IN', lane: 'practice' },
    { match: { pathPrefix: '/practice' }, role: 'problem-commercial', scope: 'IN', lane: 'practice' },
    { match: { pathPrefix: '/science' }, role: 'proof-portfolio', scope: 'ADJACENT', lane: 'understand' },
    { match: { pathPrefix: '/reference' }, role: 'technical-reference', scope: 'ADJACENT', lane: 'understand' },
    { match: { pathPrefix: '/random' }, role: 'proof-portfolio', scope: 'OUT', lane: null }
  ],
  locales: { default: 'en', prefixes: { ru: '/ru', de: '/de' } }
};

assert.equal(validateSiteFocusProfile(profile).valid, true);

const home = `<!doctype html><html><head><title>Voice practice — Ptichi</title><meta name="description" content="Practical rehearsal for clearer expressive speech."><link rel="canonical" href="https://example.com/"></head><body><nav><a href="/practice/">Practice</a><a href="/science/">Science</a><a href="/about/">About</a><a href="/extra/">Extra</a></nav><h1>Practice a clearer speaking voice</h1><a href="/practice/">Start practice</a></body></html>`;
const practice = `<!doctype html><html><head><title>Voice practice drills</title><meta name="description" content="Voice rehearsal drills for clear speech."><link rel="canonical" href="https://example.com/practice/"></head><body><h1>Voice practice drills</h1><a href="/practice/session/">Start session</a></body></html>`;
const ruPractice = `<!doctype html><html><head><title>Voice practice drills</title><meta name="description" content="Voice rehearsal drills for clear speech."><link rel="canonical" href="https://example.com/ru/practice/"></head><body><h1>Voice practice drills</h1><a href="/ru/practice/session/">Start session</a></body></html>`;
const science = `<!doctype html><html><head><title>Acoustic evidence library</title><meta name="description" content="Studies, measurements and source notes."><link rel="canonical" href="https://example.com/science/"></head><body><h1>Acoustic evidence library</h1><table><tr><td>Study</td><td>Result</td></tr></table><a href="/practice/">Use an exercise</a></body></html>`;
const reference = `<!doctype html><html><head><title>Protocol and dataset reference</title><meta name="description" content="JSON schema, API and dataset reference for implementers."><link rel="canonical" href="https://example.com/reference/"></head><body><h1>Protocol reference</h1><pre>{}</pre><a href="/practice/">View practice</a></body></html>`;
const random = `<!doctype html><html><head><title>Vintage mechanical keyboards</title><meta name="description" content="Rare switches and keycaps."><link rel="canonical" href="https://example.com/random/"></head><body><h1>Vintage mechanical keyboards</h1></body></html>`;

const report = buildSiteFocusReportFromPages([
  { url: 'https://example.com/', html: home },
  { url: 'https://example.com/practice/', html: practice },
  { url: 'https://example.com/ru/practice/', html: ruPractice },
  { url: 'https://example.com/science/', html: science },
  { url: 'https://example.com/reference/', html: reference },
  { url: 'https://example.com/random/', html: random }
], { canonicalUrl: 'https://example.com/', focusProfile: profile, focusProfileSource: 'fixture' });

assert.equal(report.version, '0.2');
assert.equal(report.declaredFocus.source, 'fixture');
assert.equal(report.guardrails.routeFamiliesAreNotProblemTerritories, true);
assert.equal(report.guardrails.transformationHandoffIsProposalOnly, true);
assert.equal('score' in report, false);
assert.ok(report.metrics.localeEquivalentDuplicatePairsSuppressed >= 1, 'localized equivalent pair should be suppressed from merge candidates');
assert.ok(!report.duplicateIntentClusters.some(pair => pair.urls.includes('https://example.com/practice/') && pair.urls.includes('https://example.com/ru/practice/')));
assert.ok(report.pageContracts.find(page => page.url === 'https://example.com/ru/practice/').decision !== 'MERGE');
assert.equal(report.pageContracts.find(page => page.url === 'https://example.com/science/').declaredRole, 'proof-portfolio');
assert.equal(report.pageContracts.find(page => page.url === 'https://example.com/reference/').declaredRole, 'technical-reference');
assert.equal(report.pageContracts.find(page => page.url === 'https://example.com/random/').declaredScope, 'OUT');
assert.equal(report.pageContracts.find(page => page.url === 'https://example.com/random/').decision, 'DEFER');
assert.equal(report.pageContracts.find(page => page.url === 'https://example.com/random/').confidence, 'declared-high');
assert.ok(report.siteFindings.some(item => item.id === 'undeclared-primary-navigation'));
assert.ok(!report.siteFindings.some(item => item.id === 'many-route-territories'), 'route families must not be interpreted as problem territories once declared intent is available');
assert.equal(report.transformationHandoff.mode, 'proposal-only');
assert.equal(report.transformationHandoff.executable, false);
assert.equal(report.transformationHandoff.destructiveOperationsAllowed, false);
assert.ok(report.transformationHandoff.candidates.some(item => item.sourceDecision === 'DEFER'));
assert.match(formatSiteFocusReport(report), /Declared ↔ observed thesis/i);
assert.match(formatSiteFocusReport(report), /proposal-only/i);

const reportSchema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'site-focus-report-v0.2.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validateReport = ajv.compile(reportSchema);
assert.equal(validateReport(report), true, JSON.stringify(validateReport.errors));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-focus-v2-'));
try {
  fs.mkdirSync(path.join(tmp, '.arwp'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'practice'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs', 'science'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.arwp', 'site-focus.json'), JSON.stringify(profile, null, 2));
  fs.writeFileSync(path.join(tmp, 'docs', 'index.html'), home);
  fs.writeFileSync(path.join(tmp, 'docs', 'practice', 'index.html'), practice);
  fs.writeFileSync(path.join(tmp, 'docs', 'science', 'index.html'), science);
  const local = analyzeSiteFocusRepository('https://example.com/', tmp, { maxPages: 10 });
  assert.equal(local.version, '0.2');
  assert.ok(local.declaredFocus.source.endsWith(path.join('.arwp', 'site-focus.json')));
  assert.ok(local.pageContracts.every(page => page.file));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('PASS Site Focus v0.2 compares declared intent with observed structure, assigns route roles, suppresses locale-equivalent merge noise and emits proposal-only transformation handoff candidates');
