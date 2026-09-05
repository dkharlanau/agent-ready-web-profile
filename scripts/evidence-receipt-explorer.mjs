import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyEvidenceReceipt } from '../lib/evidence-receipt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'evidence', 'receipts');
const recordsDir = path.join(outDir, 'records');
const catalogPath = path.join(recordsDir, 'catalog.json');

function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadCatalog() {
  if (!fs.existsSync(catalogPath)) return { version: '0.1', records: {} };
  const catalog = readJson(catalogPath);
  if (catalog?.version !== '0.1' || !catalog.records || typeof catalog.records !== 'object') {
    throw new Error('Receipt explorer catalog must be version 0.1 with a records object.');
  }
  return catalog;
}

function recordFiles() {
  if (!fs.existsSync(recordsDir)) return [];
  return fs.readdirSync(recordsDir)
    .filter(name => name.endsWith('.receipt.json'))
    .sort();
}

function publicRecordUrl(name) {
  return `https://dkharlanau.github.io/agent-ready-web-profile/evidence/receipts/records/${encodeURIComponent(name)}`;
}

function publicPageUrl(slug) {
  return `https://dkharlanau.github.io/agent-ready-web-profile/evidence/receipts/${encodeURIComponent(slug)}.html`;
}

function compactRecord(fileName, receipt, meta = {}) {
  const slug = fileName.replace(/\.receipt\.json$/, '');
  return {
    slug,
    receiptId: receipt.receiptId,
    title: meta.title || `Evidence Receipt ${receipt.receiptId.slice(-12)}`,
    evidenceClass: meta.evidenceClass || 'unclassified',
    observedAt: receipt.observedAt,
    target: receipt.target,
    canonicalUrl: receipt.canonicalUrl,
    toolVersion: receipt.toolVersion,
    resolverVersion: receipt.resolverVersion,
    decisionPolicyVersion: receipt.decisionPolicyVersion || null,
    payloadDigest: receipt.digests.payload,
    summary: receipt.evidenceSummary,
    workflowRun: meta.workflowRun || null,
    notes: meta.notes || null,
    recordUrl: publicRecordUrl(fileName),
    htmlUrl: publicPageUrl(slug)
  };
}

function receiptPage(row, receipt) {
  const sourceRows = receipt.sources.map(source => `<tr><td>${html(source.type || source.id)}</td><td>${html(source.status)}</td><td>${html(source.authority || 'unknown')}</td><td><a href="${html(source.url)}">${html(source.url)}</a></td></tr>`).join('');
  const plans = Object.values(receipt.plans).map(plan => `<tr><td>${html(plan.intent)}</td><td>${html(plan.outcome)}</td><td>${plan.selected?.url ? `<a href="${html(plan.selected.url)}">${html(plan.selected.protocol || plan.selected.kind || plan.selected.url)}</a>` : 'none'}</td><td>${html(plan.reason || '')}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="ARWP Evidence Receipt ${html(row.receiptId)}: immutable Resolver observation with SHA-256 integrity verification."><title>${html(row.title)}</title><link rel="canonical" href="${html(row.htmlUrl)}"><link rel="describedby" type="application/json" href="./records/${html(row.slug)}.receipt.json"><link rel="stylesheet" href="../../citation.css"></head><body><main class="cite-main shell"><header class="cite-hero"><p class="eyebrow">Evidence / ${html(row.evidenceClass)}</p><h1>${html(row.title)}</h1><p class="cite-lead">A specific ARWP Resolver observation. The receipt payload is integrity-protected; it is not a publisher endorsement, authorization decision or trust certificate.</p><div class="cite-meta"><span>${html(row.observedAt)}</span><span>tool ${html(row.toolVersion)}</span><span>${html(row.evidenceClass)}</span></div></header><section class="cite-card"><h2>Integrity</h2><table class="cite-table"><tbody><tr><th>Receipt ID</th><td><code>${html(row.receiptId)}</code></td></tr><tr><th>Payload digest</th><td><code>${html(row.payloadDigest)}</code></td></tr><tr><th>Target</th><td><a href="${html(row.canonicalUrl)}">${html(row.canonicalUrl)}</a></td></tr><tr><th>Sources</th><td>${row.summary.sourcesResolved}/${row.summary.sourcesAttempted} resolved</td></tr><tr><th>Interfaces</th><td>${row.summary.interfacesResolved}</td></tr><tr><th>Conflicts</th><td>${row.summary.conflicts}</td></tr></tbody></table><p><a href="./records/${html(row.slug)}.receipt.json">Raw immutable receipt JSON →</a></p></section><section class="cite-card"><h2>Intent plans</h2><table class="cite-table"><thead><tr><th>Intent</th><th>Outcome</th><th>Selected</th><th>Reason</th></tr></thead><tbody>${plans}</tbody></table></section><section class="cite-card"><h2>Source evidence</h2><table class="cite-table"><thead><tr><th>Type</th><th>Status</th><th>Authority</th><th>URL</th></tr></thead><tbody>${sourceRows}</tbody></table></section><p class="reuse-note">Receipt history is append-only. A newer observation supersedes operational relevance but does not rewrite this record.</p></main></body></html>`;
}

function indexPage(rows) {
  const cards = rows.map(row => `<a class="term-card" href="./${html(row.slug)}.html"><strong>${html(row.title)}</strong><span>${html(row.observedAt)} · ${html(row.evidenceClass)} · ${row.summary.sourcesResolved}/${row.summary.sourcesAttempted} sources · ${row.summary.conflicts} conflict(s)</span></a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Append-only ARWP Evidence Receipt explorer: integrity-verified Resolver observations with provenance and explicit trust boundaries."><title>ARWP Evidence Receipts</title><link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/evidence/receipts/"><link rel="describedby" type="application/json" href="./index.json"><link rel="stylesheet" href="../../citation.css"></head><body><main class="cite-main shell"><header class="cite-hero"><p class="eyebrow">ARWP Evidence</p><h1>Evidence Receipts</h1><p class="cite-lead">Append-only, integrity-verified observations produced by ARWP Resolver runs. A receipt records what ARWP observed at one time; it does not make the observed site an ARWP adopter and does not certify trust or authorization.</p></header><section class="cite-card"><h2>Published observations</h2><div class="term-grid">${cards || '<p>No receipts published yet.</p>'}</div></section><p class="reuse-note">Machine-readable index: <a href="./index.json">index.json</a>. Receipt JSON is immutable after publication.</p></main></body></html>`;
}

export function buildExplorer() {
  fs.mkdirSync(recordsDir, { recursive: true });
  const catalog = loadCatalog();
  const rows = [];
  for (const fileName of recordFiles()) {
    const receipt = readJson(path.join(recordsDir, fileName));
    const verification = verifyEvidenceReceipt(receipt);
    if (!verification.valid) throw new Error(`${fileName}: invalid receipt: ${verification.issues.join(' ')}`);
    const meta = catalog.records[fileName] || {};
    const row = compactRecord(fileName, receipt, meta);
    rows.push(row);
    fs.writeFileSync(path.join(outDir, `${row.slug}.html`), `${receiptPage(row, receipt)}\n`);
  }
  rows.sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.receiptId.localeCompare(b.receiptId));
  const index = {
    version: '0.1',
    canonicalUrl: 'https://dkharlanau.github.io/agent-ready-web-profile/evidence/receipts/',
    semantics: 'Append-only ARWP Resolver observations. Receipt integrity does not imply publisher endorsement, authorization or trustworthiness.',
    records: rows
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'index.html'), `${indexPage(rows)}\n`);
  return index;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = buildExplorer();
  console.log(`Built Evidence Receipt explorer with ${index.records.length} record(s).`);
}
