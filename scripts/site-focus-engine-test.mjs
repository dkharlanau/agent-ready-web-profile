import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSiteFocusReportFromPages, analyzeSiteFocusRepository, formatSiteFocusReport } from '../lib/site-focus.mjs';

const home = `<!doctype html><html><head><title>Bird voice training — Ptichi</title><meta name="description" content="Voice practice for speakers who want clearer, more expressive speech."><link rel="canonical" href="https://example.com/"></head><body><nav><a href="/practice/">Practice</a><a href="/science/">Science</a><a href="/schema/">Schema</a><a href="/mcp/">MCP</a><a href="/api/">API</a><a href="/random/">Random</a></nav><h1>Train a clearer, more expressive speaking voice.</h1><p>Practice with evidence-backed exercises.</p><a href="/practice/">Start practice</a></body></html>`;
const practice = `<!doctype html><html><head><title>Voice practice drills — Ptichi</title><meta name="description" content="Practical speaking voice drills for volume, articulation and expression."><link rel="canonical" href="https://example.com/practice/"></head><body><h1>Voice practice drills</h1><p>Worked exercise examples and research sources.</p><a href="https://doi.org/10.1000/example">Source</a><a href="/practice/session/">Start a session</a></body></html>`;
const practiceDuplicate = `<!doctype html><html><head><title>Voice practice drills and exercises — Ptichi</title><meta name="description" content="Speaking voice practice drills for articulation, expression and volume."><link rel="canonical" href="https://example.com/practice-exercises/"></head><body><h1>Voice practice drills and exercises</h1><p>Examples.</p><a href="/practice/">View drills</a></body></html>`;
const science = `<!doctype html><html><head><title>Voice training research — Ptichi</title><meta name="description" content="Research and evidence behind speaking voice training."><link rel="canonical" href="https://example.com/science/"></head><body><h1>Voice training research</h1><table><tr><th>Study</th><th>Finding</th></tr><tr><td>A</td><td>B</td></tr></table><a href="/practice/">Use the exercises</a></body></html>`;
const random = `<!doctype html><html><head><title>Vintage mechanical keyboards collection</title><meta name="description" content="A personal gallery of rare mechanical keyboards."><link rel="canonical" href="https://example.com/random/"></head><body><h1>Vintage mechanical keyboards</h1><p>Switches and keycaps.</p></body></html>`;

const report = buildSiteFocusReportFromPages([
  { url: 'https://example.com/', html: home },
  { url: 'https://example.com/practice/', html: practice },
  { url: 'https://example.com/practice-exercises/', html: practiceDuplicate },
  { url: 'https://example.com/science/', html: science },
  { url: 'https://example.com/random/', html: random }
], { canonicalUrl: 'https://example.com/' });

assert.equal(report.version, '0.1');
assert.equal(report.guardrails.noOpaqueScore, true);
assert.equal('score' in report, false, 'Site Focus must not emit one opaque score');
assert.equal(report.metrics.pagesObserved, 5);
assert.equal(report.metrics.primaryNavDestinations, 6);
assert.ok(report.siteFindings.some(item => item.id === 'wide-primary-navigation'));
assert.ok(report.siteFindings.some(item => item.id === 'technology-led-navigation'));
assert.ok(report.duplicateIntentClusters.length >= 1, 'similar practice pages should be surfaced for merge review');
assert.ok(report.outOfScopeCandidates.includes('https://example.com/random/'), 'off-thesis keyboard page should be a review candidate');
assert.ok(report.pagesWithoutUsefulAction.includes('https://example.com/random/'));
assert.ok(report.pageContracts.some(item => item.url === 'https://example.com/random/' && item.decision === 'DEFER'));
assert.ok(report.pageContracts.some(item => item.decision === 'MERGE'));
assert.ok(report.pageContracts.every(item => !['REMOVE', 'SPLIT'].includes(item.decision)));
assert.match(report.scope, /not evidence that a page should rank, be cited, be removed or be split/i);
assert.match(formatSiteFocusReport(report), /No focus\/readiness\/ranking score/i);
assert.match(formatSiteFocusReport(report), /REMOVE and SPLIT are never automatic/i);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-focus-'));
try {
  const docs = path.join(tmp, 'docs');
  fs.mkdirSync(path.join(docs, 'practice'), { recursive: true });
  fs.mkdirSync(path.join(docs, 'science'), { recursive: true });
  fs.writeFileSync(path.join(docs, 'index.html'), home);
  fs.writeFileSync(path.join(docs, 'practice', 'index.html'), practice);
  fs.writeFileSync(path.join(docs, 'science', 'index.html'), science);
  const local = analyzeSiteFocusRepository('https://example.com/', tmp, { maxPages: 10 });
  assert.equal(local.discovery.mode, 'repository');
  assert.equal(local.metrics.pagesObserved, 3);
  assert.ok(local.pageContracts.every(item => item.file));
  assert.ok(local.pageContracts.some(item => item.file === 'docs/index.html'));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('PASS Site Focus engine exposes page contracts, breadth/duplicate/orphan/scope diagnostics and bounded review dispositions without a universal score or automatic destructive decisions');