#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createPortfolioGrowthRun, diffPortfolioGrowthRuns, formatPortfolioGrowthRun } from '../lib/portfolio-growth-evidence.mjs';
import { loadPortfolioRegistry } from '../lib/portfolio-rollout.mjs';

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJson(file, value) { ensureDir(path.dirname(file)); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function safeExistingIndex(file) {
  if (!fs.existsSync(file)) return {
    version: '0.1',
    evidenceClass: 'owner-controlled-public-observation',
    runs: [],
    guardrails: {
      noIndependentAdoptionInference: true,
      ownerMetricsSeparate: true,
      noMissingMetricZeros: true,
      noRankingCausality: true
    }
  };
  const value = readJson(file);
  if (value?.version !== '0.1' || !Array.isArray(value.runs)) throw new Error(`Unsupported portfolio Growth index: ${file}`);
  return value;
}

function renderHtml(index) {
  const runs = index.runs.slice(0, 20).map(run => `<tr><td><a href="./runs/${run.runId}.json">${run.runId}</a></td><td>${run.captured}/${run.enabledSites}</td><td>${run.unavailable}</td><td>${run.diffFromPrevious ? `<a href="./diffs/${run.diffFromPrevious}.json">diff</a>` : 'baseline'}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="ARWP owner-controlled longitudinal Growth observations across registered portfolio sites, preserving public implementation state separately from owner Search and AI outcome evidence."><meta name="robots" content="index,follow,max-snippet:-1"><title>Portfolio Growth observations — ARWP</title><link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/research/portfolio-growth/"><link rel="describedby" type="application/json" href="./index.json"><link rel="stylesheet" href="../../citation.css"></head><body><header class="topbar"><a class="brand" href="../../"><span class="brand-mark">A/</span><span>ARWP</span></a><nav><a href="../../growth/">Growth</a><a href="../state-of-agentic-web/">Research</a><a href="../../evidence/receipts/">Evidence</a></nav></header><main class="cite-main shell"><section class="cite-hero"><p class="eyebrow">Longitudinal evidence · owner-controlled portfolio</p><h1>Public implementation observations over time.</h1><p class="cite-lead">ARWP periodically captures bounded Growth snapshots for registered owner-controlled sites. These observations track implementation state and failures. Search Console, Bing, referral and other owner outcome metrics remain separate evidence and are never filled with synthetic zeros.</p></section><section class="cite-card"><h2>Current state</h2><p>Runs: ${index.runs.length}. Latest: ${index.latestRunId || 'none'}.</p><table class="cite-table"><thead><tr><th>Run</th><th>Captured</th><th>Unavailable</th><th>Comparison</th></tr></thead><tbody>${runs || '<tr><td colspan="4">No runs captured yet.</td></tr>'}</tbody></table></section><section class="cite-grid"><article class="cite-card"><h2>What a run records</h2><ul><li>public Growth action/debt snapshot;</li><li>bounded vertical evidence coverage;</li><li>unavailable/failure cases;</li><li>explicit <code>awaiting-owner-measurement</code> state.</li></ul></article><article class="cite-card"><h2>What it does not prove</h2><p>This cohort is owner-controlled, not independent adoption evidence. Reduced implementation debt does not prove ranking, AI citation, traffic or conversion gains. Those outcomes require separate owner evidence and reviewed experiments.</p></article></section><p class="reuse-note"><a href="./index.json">Machine-readable run index</a> · <a href="../../GROWTH-LOOP.md">Growth methodology</a></p></main></body></html>\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const outputDir = path.resolve(optionValue(args, 'output-dir') || 'docs/research/portfolio-growth');
  const observedAt = optionValue(args, 'observed-at') || new Date().toISOString();
  const concurrencyRaw = optionValue(args, 'concurrency');
  const concurrency = concurrencyRaw ? Number(concurrencyRaw) : 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error('--concurrency must be an integer between 1 and 5.');
  const portfolio = loadPortfolioRegistry();
  const run = await createPortfolioGrowthRun(portfolio, { observedAt, concurrency });

  const runsDir = path.join(outputDir, 'runs');
  const diffsDir = path.join(outputDir, 'diffs');
  const indexFile = path.join(outputDir, 'index.json');
  ensureDir(runsDir);
  ensureDir(diffsDir);
  const runFile = path.join(runsDir, `${run.runId}.json`);
  if (fs.existsSync(runFile)) throw new Error(`Refusing to overwrite existing portfolio Growth run: ${run.runId}`);

  const index = safeExistingIndex(indexFile);
  const previousEntry = index.runs[0] || null;
  let diffId = null;
  if (previousEntry) {
    const previousFile = path.join(runsDir, `${previousEntry.runId}.json`);
    if (fs.existsSync(previousFile)) {
      const previous = readJson(previousFile);
      const diff = diffPortfolioGrowthRuns(previous, run);
      diffId = `${previous.runId}--${run.runId}`;
      writeJson(path.join(diffsDir, `${diffId}.json`), diff);
    }
  }
  writeJson(runFile, run);
  const nextEntry = {
    runId: run.runId,
    observedAt: run.observedAt,
    enabledSites: run.summary.enabledSites,
    captured: run.summary.captured,
    unavailable: run.summary.unavailable,
    awaitingOwnerMeasurement: run.summary.awaitingOwnerMeasurement,
    diffFromPrevious: diffId
  };
  index.runs = [nextEntry, ...index.runs.filter(item => item.runId !== run.runId)];
  index.latestRunId = run.runId;
  index.updatedAt = run.observedAt;
  writeJson(indexFile, index);
  fs.writeFileSync(path.join(outputDir, 'index.html'), renderHtml(index), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'llms.txt'), `# ARWP Portfolio Growth observations\n\nCanonical: https://dkharlanau.github.io/agent-ready-web-profile/research/portfolio-growth/\nIndex: https://dkharlanau.github.io/agent-ready-web-profile/research/portfolio-growth/index.json\n\nEvidence class: owner-controlled public observation. Runs preserve public implementation state and failures. Owner Search/AI outcome metrics remain separate and missing metrics are never converted to zero.\n`, 'utf8');

  process.stdout.write(`${formatPortfolioGrowthRun(run)}\n`);
  process.stdout.write(`WROTE ${runFile}\n`);
  if (diffId) process.stdout.write(`WROTE ${path.join(diffsDir, `${diffId}.json`)}\n`);
}

main().catch(error => {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
});
