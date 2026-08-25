import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { searchResolvedFederated } from '../router/resolved-federated.mjs';

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

function outputPathFromArgs(argv) {
  for (const arg of argv) {
    if (arg.startsWith('--output=')) return arg.slice('--output='.length);
  }
  const index = argv.indexOf('--output');
  return index >= 0 ? argv[index + 1] : null;
}

function validateCorpus(corpus) {
  if (!corpus || typeof corpus !== 'object' || !Array.isArray(corpus.sites) || !corpus.sites.length) {
    throw new Error('Federation corpus must contain a non-empty sites array.');
  }
  const ids = new Set();
  for (const site of corpus.sites) {
    if (!site?.id || ids.has(site.id)) throw new Error(`Federation corpus has a missing or duplicate id: ${site?.id || '<missing>'}`);
    ids.add(site.id);
    if (site.ownership !== 'independent') throw new Error(`${site.id}: federation benchmark only accepts ownership=independent.`);
    for (const [field, value] of [['url', site.url], ['expectedInterfaceUrl', site.expectedInterfaceUrl]]) {
      if (!value || new URL(value).protocol !== 'https:') throw new Error(`${site.id}: ${field} must be public HTTPS metadata.`);
    }
    if (!String(site.query || '').trim()) throw new Error(`${site.id}: query is required.`);
    if (!Array.isArray(site.evidence) || !site.evidence.length) throw new Error(`${site.id}: at least one evidence record is required.`);
    for (const evidence of site.evidence) {
      if (!evidence?.url || new URL(evidence.url).protocol !== 'https:' || !evidence.sourceType) throw new Error(`${site.id}: invalid evidence record.`);
    }
  }
}

const corpusUrl = new URL('./federation-corpus.json', import.meta.url);
const corpus = JSON.parse(await fs.readFile(corpusUrl, 'utf8'));
validateCorpus(corpus);

const sites = [];
for (const fixture of corpus.sites) {
  const started = performance.now();
  try {
    const result = await searchResolvedFederated(fixture.query, {
      sites: [{ id: fixture.id, name: fixture.name, url: fixture.url }],
      concurrency: 1,
      limit: 5,
      limitPerSite: 5
    });
    const expected = normalizeUrl(fixture.expectedInterfaceUrl);
    const expectedExecution = result.executed.find(item => normalizeUrl(item.interface.url) === expected) || null;
    sites.push({
      id: fixture.id,
      name: fixture.name,
      url: fixture.url,
      query: fixture.query,
      expectedInterfaceUrl: fixture.expectedInterfaceUrl,
      status: expectedExecution ? 'expected-interface-executed' : (result.executed.length ? 'different-interface-executed' : 'no-compatible-interface-executed'),
      executed: result.executed,
      hits: result.results.length,
      skipped: result.skipped,
      failures: result.failures,
      durationMs: Math.round(performance.now() - started)
    });
  } catch (error) {
    sites.push({
      id: fixture.id,
      name: fixture.name,
      url: fixture.url,
      query: fixture.query,
      expectedInterfaceUrl: fixture.expectedInterfaceUrl,
      status: 'resolution-or-execution-error',
      error: String(error?.message || error),
      executed: [],
      hits: 0,
      skipped: [],
      failures: [],
      durationMs: Math.round(performance.now() - started)
    });
  }
}

const expectedInterfacesExecuted = sites.filter(site => site.status === 'expected-interface-executed').length;
const sitesWithHits = sites.filter(site => site.hits > 0).length;
const report = {
  benchmarkVersion: '0.1',
  generatedAt: new Date().toISOString(),
  corpusVersion: corpus.corpusVersion,
  corpusReviewedAt: corpus.reviewedAt,
  independentSites: sites.length,
  expectedInterfacesExecuted,
  sitesWithHits,
  sites,
  methodology: {
    groundTruth: 'Expected feed URLs are manually reviewed from publisher/spec evidence in benchmarks/federation-corpus.json; Resolver output is not used as its own ground truth.',
    execution: 'Each site is resolved independently, then only the first supported static JSON/JSONL/NDJSON retrieval index or JSON Feed selected by resolver-backed federation is fetched.',
    interpretation: 'This is an interoperability smoke benchmark. A matching interface proves discovery and bounded execution for that observation; hit count is not an answer-quality metric.',
    failurePolicy: 'Third-party resolution or retrieval failures are recorded in the report and do not by themselves make the engineering workflow fail.'
  }
};

const outputPath = outputPathFromArgs(process.argv.slice(2));
if (outputPath) {
  await fs.mkdir(new URL('.', `file://${process.cwd().replace(/\\/g, '/')}/${outputPath}`).pathname.replace(/\/[^/]*$/, '') || '.', { recursive: true }).catch(() => {});
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`Independent federation sites: ${report.independentSites}`);
console.log(`Expected interfaces executed: ${report.expectedInterfacesExecuted}`);
console.log(`Sites with query hits: ${report.sitesWithHits}`);
for (const site of report.sites) {
  console.log(`${site.id}: ${site.status}; executed=${site.executed.length}; hits=${site.hits}; ${site.durationMs}ms`);
}
