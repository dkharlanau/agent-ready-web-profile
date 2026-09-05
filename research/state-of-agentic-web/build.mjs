import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const sourcePath = path.join(here, 'releases', '2026-09-05-foundation', 'source.json');
const outputRoot = path.join(root, 'docs', 'research', 'state-of-agentic-web');
const releaseId = '2026-09-05-foundation';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function percent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export function validateSource(source) {
  assert(source?.releaseVersion === '0.1', 'releaseVersion must be 0.1');
  assert(source.releaseId === releaseId, `releaseId must be ${releaseId}`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt), 'publishedAt must be YYYY-MM-DD');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.evidenceDate), 'evidenceDate must be YYYY-MM-DD');

  const scope = source.scope || {};
  assert(Number.isInteger(scope.independentSites) && scope.independentSites > 0, 'independentSites must be positive');
  assert(Array.isArray(scope.intents) && scope.intents.length > 0, 'intents must be non-empty');
  assert(scope.intentsPerSite === scope.intents.length, 'intentsPerSite must equal intents.length');
  assert(scope.decisionCases === scope.independentSites * scope.intentsPerSite, 'decisionCases must equal independentSites * intentsPerSite');
  assert(scope.representativeOfWeb === false, 'foundation release must not claim web representativeness');
  assert(scope.ownerControlledReferencesExcluded === true, 'owner-controlled references must be excluded');

  const strategies = source.decisionQuality?.strategies || {};
  for (const name of ['llms-aware', 'resolver-union']) {
    const strategy = strategies[name];
    assert(strategy && strategy.total === scope.decisionCases, `${name}.total must equal decisionCases`);
    assert(Number.isInteger(strategy.correct) && strategy.correct >= 0 && strategy.correct <= strategy.total, `${name}.correct is invalid`);
  }

  const union = source.decisionQuality?.resolverUnion || {};
  for (const key of ['mismatches', 'overSelection', 'discoveryGaps', 'selectionGaps', 'resolutionFailures', 'regret', 'uniquelyCorrect']) {
    assert(Number.isInteger(union[key]) && union[key] >= 0, `resolverUnion.${key} must be a non-negative integer`);
  }
  assert(union.mismatches === union.overSelection + union.discoveryGaps + union.selectionGaps + union.resolutionFailures, 'resolver-union mismatch taxonomy must sum to mismatches');
  assert(union.regret <= scope.decisionCases, 'regret cannot exceed decisionCases');
  assert(union.uniquelyCorrect <= scope.decisionCases, 'uniquelyCorrect cannot exceed decisionCases');

  const historical = source.decisionQuality?.historicalBaseline || {};
  assert(Number.isInteger(historical.resolverUnionCorrect), 'historical resolverUnionCorrect is required');
  assert(historical.resolverUnionCorrect <= strategies['resolver-union'].correct, 'historical baseline must not exceed current recorded union result for this release');

  assert(Array.isArray(source.interpretation) && source.interpretation.length >= 3, 'interpretation must contain at least three statements');
  assert(Array.isArray(source.limitations) && source.limitations.length >= 4, 'limitations must contain at least four statements');
  assert(Array.isArray(source.sources) && source.sources.length >= 2, 'at least two sources are required');
  for (const item of source.sources) assert(/^https:\/\//.test(item.url), 'source URLs must be HTTPS');
  return source;
}

export function buildRelease(source) {
  validateSource(source);
  const strategies = source.decisionQuality.strategies;
  const union = source.decisionQuality.resolverUnion;
  const historical = source.decisionQuality.historicalBaseline;
  const total = source.scope.decisionCases;

  return {
    ...source,
    derived: {
      llmsAwareAccuracyPct: percent(strategies['llms-aware'].correct, strategies['llms-aware'].total),
      resolverUnionAccuracyPct: percent(strategies['resolver-union'].correct, strategies['resolver-union'].total),
      unionVsLlmsAwarePercentagePointDelta: strategies['resolver-union'].correct - strategies['llms-aware'].correct,
      resolverUnionImprovementFromHistoricalPercentagePoints: strategies['resolver-union'].correct - historical.resolverUnionCorrect,
      mismatchRatePct: percent(union.mismatches, total),
      overSelectionRatePct: percent(union.overSelection, total),
      discoveryGapRatePct: percent(union.discoveryGaps, total),
      selectionGapRatePct: percent(union.selectionGaps, total),
      regretRatePct: percent(union.regret, total),
      uniquelyCorrectRatePct: percent(union.uniquelyCorrect, total)
    },
    guardrails: {
      noReadinessScore: true,
      noAdoptionInference: true,
      noRankingInference: true,
      noCausalityInference: true,
      frozenEvidenceIsNotSilentlyRewritten: true
    }
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function releaseCsv(release) {
  const rows = [
    ['metric', 'value', 'unit', 'scope', 'evidence_date'],
    ['independent_sites', release.scope.independentSites, 'sites', release.scope.cohort, release.evidenceDate],
    ['decision_cases', release.scope.decisionCases, 'intent decisions', release.scope.cohort, release.evidenceDate],
    ['llms_aware_correct', release.decisionQuality.strategies['llms-aware'].correct, 'decisions', '100 reviewed decisions', release.evidenceDate],
    ['resolver_union_correct', release.decisionQuality.strategies['resolver-union'].correct, 'decisions', '100 reviewed decisions', release.evidenceDate],
    ['resolver_union_mismatches', release.decisionQuality.resolverUnion.mismatches, 'decisions', 'resolver-union', release.evidenceDate],
    ['resolver_union_over_selection', release.decisionQuality.resolverUnion.overSelection, 'decisions', 'resolver-union', release.evidenceDate],
    ['resolver_union_discovery_gaps', release.decisionQuality.resolverUnion.discoveryGaps, 'decisions', 'resolver-union', release.evidenceDate],
    ['resolver_union_selection_gaps', release.decisionQuality.resolverUnion.selectionGaps, 'decisions', 'resolver-union', release.evidenceDate],
    ['resolver_union_resolution_failures', release.decisionQuality.resolverUnion.resolutionFailures, 'decisions', 'resolver-union', release.evidenceDate],
    ['resolver_regret', release.decisionQuality.resolverUnion.regret, 'decisions', 'resolver-union vs simpler strategies', release.evidenceDate],
    ['resolver_uniquely_correct', release.decisionQuality.resolverUnion.uniquelyCorrect, 'decisions', 'resolver-union', release.evidenceDate],
    ['historical_resolver_union_correct', release.decisionQuality.historicalBaseline.resolverUnionCorrect, 'decisions', 'historical frozen baseline', release.decisionQuality.historicalBaseline.evidenceDate]
  ];
  return `${rows.map(row => row.map(csvEscape).join(',')).join('\n')}\n`;
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sourceLinks(release) {
  return release.sources.map(item => `<li><a href="${htmlEscape(item.url)}">${htmlEscape(item.type)}</a> — ${htmlEscape(item.description)}</li>`).join('');
}

export function releaseHtml(release) {
  const llms = release.decisionQuality.strategies['llms-aware'].correct;
  const union = release.decisionQuality.strategies['resolver-union'].correct;
  const d = release.derived;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="First reproducible ARWP State of the Agentic Web foundation release: 20 independent sites, 100 reviewed intent decisions, decision quality, regret and explicit sample limitations.">
<title>State of the Agentic Web — Foundation Release</title>
<link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.html">
<link rel="describedby" type="application/json" href="./${release.releaseId}.json"><link rel="alternate" type="text/csv" href="./${release.releaseId}.csv"><link rel="license" href="https://creativecommons.org/licenses/by/4.0/"><link rel="stylesheet" href="../../../citation.css">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: release.title,
    datePublished: release.publishedAt,
    dateModified: release.publishedAt,
    description: 'A frozen engineering research release derived from the reviewed independent ARWP Resolver corpus. It is not a representative survey of the public web.',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    url: `https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.html`,
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.json` },
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.csv` }
    ]
  })}</script>
<style>.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric{border:1px solid #d8ddd6;border-radius:14px;padding:18px}.metric strong{display:block;font-size:2rem}.bars{display:grid;gap:12px}.bar{display:grid;grid-template-columns:150px 1fr 55px;gap:10px;align-items:center}.track{height:16px;background:#e7e9e5;border-radius:999px;overflow:hidden}.fill{height:100%;background:#151714;border-radius:999px}.warning-box{border-left:4px solid #151714;padding:12px 16px;background:#f4f5f2}</style>
</head><body><main class="cite-main shell">
<header class="cite-hero"><p class="eyebrow">Research / ${htmlEscape(release.publishedAt)} / foundation</p><h1>${htmlEscape(release.title)}</h1><p class="cite-lead">A frozen baseline for ARWP decision-quality research. The release contains <strong>${release.scope.independentSites} independently owned documentation sites</strong> and <strong>${release.scope.decisionCases} manually reviewed intent decisions</strong>. It is deliberately not presented as a representative census of the web.</p><div class="cite-meta"><span>Evidence ${htmlEscape(release.evidenceDate)}</span><span>${release.scope.independentSites} independent sites</span><span>CC BY 4.0 research text/data</span></div></header>
<div class="warning-box"><strong>Boundary:</strong> this release measures Resolver decision quality on a reviewed engineering corpus. It does not measure ARWP adoption, overall web readiness, search ranking or AI citation performance.</div>
<section class="cite-card"><h2>Headline result</h2><div class="metric-grid"><div class="metric"><span>llms-aware</span><strong>${llms}/100</strong><small>best simpler strategy</small></div><div class="metric"><span>resolver-union</span><strong>${union}/100</strong><small>${d.unionVsLlmsAwarePercentagePointDelta} percentage points vs llms-aware</small></div><div class="metric"><span>resolver regret</span><strong>${release.decisionQuality.resolverUnion.regret}</strong><small>simpler strategy correct, union wrong</small></div><div class="metric"><span>uniquely correct union</span><strong>${release.decisionQuality.resolverUnion.uniquelyCorrect}</strong><small>on this frozen corpus</small></div></div></section>
<section class="cite-card"><h2>Decision quality</h2><div class="bars"><div class="bar"><span>llms-aware</span><div class="track"><div class="fill" style="width:${d.llmsAwareAccuracyPct}%"></div></div><strong>${d.llmsAwareAccuracyPct}%</strong></div><div class="bar"><span>resolver-union</span><div class="track"><div class="fill" style="width:${d.resolverUnionAccuracyPct}%"></div></div><strong>${d.resolverUnionAccuracyPct}%</strong></div></div><p>The general OpenAPI search-eligibility correction moved resolver-union from ${release.decisionQuality.historicalBaseline.resolverUnionCorrect}/100 to ${union}/100 without editing the reviewed ground truth. The union still trails llms-aware, so ARWP does not treat discovery breadth alone as progress.</p></section>
<section class="cite-grid"><article class="cite-card"><h2>Union mismatch taxonomy</h2><table class="cite-table"><tbody><tr><th>Mismatches</th><td>${release.decisionQuality.resolverUnion.mismatches}</td></tr><tr><th>Over-selection</th><td>${release.decisionQuality.resolverUnion.overSelection}</td></tr><tr><th>Discovery gaps</th><td>${release.decisionQuality.resolverUnion.discoveryGaps}</td></tr><tr><th>Selection gaps</th><td>${release.decisionQuality.resolverUnion.selectionGaps}</td></tr><tr><th>Resolution failures</th><td>${release.decisionQuality.resolverUnion.resolutionFailures}</td></tr></tbody></table></article><article class="cite-card"><h2>Interpretation</h2><ul class="cite-list">${release.interpretation.map(item => `<li>${htmlEscape(item)}</li>`).join('')}</ul></article></section>
<section class="cite-card"><h2>Limitations</h2><ul class="cite-list">${release.limitations.map(item => `<li>${htmlEscape(item)}</li>`).join('')}</ul></section>
<section class="cite-card"><h2>Primary project evidence</h2><ul class="cite-list">${sourceLinks(release)}</ul><p><a href="../methodology.html">Research methodology →</a> · <a href="./${release.releaseId}.json">JSON</a> · <a href="./${release.releaseId}.csv">CSV</a></p></section>
<p class="reuse-note">Frozen release. Historical evidence is superseded by new releases, never silently rewritten.</p>
</main></body></html>`;
}

export function indexHtml(release) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="ARWP State of the Agentic Web: reproducible frozen research releases on agent-facing web interfaces, Resolver decision quality and evidence boundaries."><title>State of the Agentic Web — ARWP Research</title><link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/"><link rel="describedby" type="application/json" href="./releases/index.json"><link rel="stylesheet" href="../../citation.css"></head><body><main class="cite-main shell"><header class="cite-hero"><p class="eyebrow">ARWP Research</p><h1>State of the Agentic Web</h1><p class="cite-lead">Frozen, reproducible observations about the interfaces websites expose to agents and the decisions an interoperability Resolver makes from that evidence. Releases separate engineering samples from adoption claims and retain negative results.</p></header><section class="cite-card"><h2>Latest release</h2><p><strong>${htmlEscape(release.title)}</strong> — published ${htmlEscape(release.publishedAt)}, evidence ${htmlEscape(release.evidenceDate)}.</p><p>${release.scope.independentSites} independent sites · ${release.scope.decisionCases} reviewed intent decisions · llms-aware ${release.derived.llmsAwareAccuracyPct}% · resolver-union ${release.derived.resolverUnionAccuracyPct}%.</p><p><a href="./releases/${release.releaseId}.html">Open release →</a> · <a href="./methodology.html">Methodology</a> · <a href="./releases/index.json">Release index JSON</a></p></section><section class="cite-card"><h2>What this project will measure next</h2><ul class="cite-list"><li>prevalence of observable web/agent discovery surfaces by explicit sampling stratum;</li><li>ARD, API Catalog, A2A, Skills, MCP and ordinary-web evidence without treating absence as failure when a layer is not applicable;</li><li>Resolver regret, ambiguity and network cost alongside accuracy;</li><li>runtime/browser evidence in a separate cohort when a reproducible runner exists.</li></ul></section></main></body></html>`;
}

export function methodologyHtml(release) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Methodology and guardrails for ARWP State of the Agentic Web research releases."><title>State of the Agentic Web — Methodology</title><link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/methodology.html"><link rel="stylesheet" href="../../citation.css"></head><body><main class="cite-main shell"><header class="cite-hero"><p class="eyebrow">Research methodology</p><h1>State of the Agentic Web</h1><p class="cite-lead">The research program separates observation, reviewed ground truth, runtime evidence and external visibility metrics so one type of evidence cannot silently stand in for another.</p></header><section class="cite-card"><h2>Foundation cohort</h2><p>The first release reuses the frozen reviewed Resolver benchmark cohort: ${release.scope.independentSites} independently owned documentation sites and ${release.scope.intentsPerSite} reviewed intents per site. The cohort was selected for engineering decision-quality work and is <strong>not representative of the public web</strong>.</p></section><section class="cite-card"><h2>Rules</h2><ul class="cite-list"><li>Owner-controlled reference sites are excluded from independent aggregates.</li><li>Ground truth is manually reviewed public publisher/protocol evidence and is never generated from Resolver output.</li><li>Negative results, regret and no-gain experiments remain publishable evidence.</li><li>Frozen releases are immutable; later review creates a new release/supersession record.</li><li>Live capability drift is not retroactively rewritten into old observations.</li><li>Static metadata is not runtime conformance, authorization or trust.</li><li>Convenience samples are never described as representative adoption statistics.</li><li>Search/citation/referral movements are observations unless causal evidence exists.</li></ul></section><section class="cite-card"><h2>Next-stage sampling</h2><p>Broader releases should define strata before collecting URLs: documentation, developer/API portals, public knowledge bases, datasets/research sites and agent-native sites. Per-stratum denominators and known sampling bias must be published with the data.</p></section><section class="cite-card"><h2>Source of record</h2><p>The engineering benchmark methodology remains <a href="https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/BENCHMARK.md">docs/BENCHMARK.md</a>. The State of the Agentic Web layer packages selected observations into citation-ready frozen research releases; it does not replace the benchmark source data.</p></section></main></body></html>`;
}

export function releaseIndex(release) {
  return {
    version: '0.1',
    title: 'ARWP State of the Agentic Web release index',
    historyPolicy: 'Releases are append-only. A later review creates a new release or explicit supersession record instead of rewriting a frozen release.',
    releases: [{
      id: release.releaseId,
      publishedAt: release.publishedAt,
      evidenceDate: release.evidenceDate,
      status: 'foundation',
      representativeOfWeb: false,
      html: `https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.html`,
      json: `https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.json`,
      csv: `https://dkharlanau.github.io/agent-ready-web-profile/research/state-of-agentic-web/releases/${release.releaseId}.csv`
    }]
  };
}

export function buildFiles(source) {
  const release = buildRelease(source);
  return new Map([
    [path.join(outputRoot, 'releases', `${release.releaseId}.json`), `${JSON.stringify(release, null, 2)}\n`],
    [path.join(outputRoot, 'releases', `${release.releaseId}.csv`), releaseCsv(release)],
    [path.join(outputRoot, 'releases', `${release.releaseId}.html`), `${releaseHtml(release)}\n`],
    [path.join(outputRoot, 'releases', 'index.json'), `${JSON.stringify(releaseIndex(release), null, 2)}\n`],
    [path.join(outputRoot, 'index.html'), `${indexHtml(release)}\n`],
    [path.join(outputRoot, 'methodology.html'), `${methodologyHtml(release)}\n`]
  ]);
}

export function writeFiles(source) {
  const files = buildFiles(source);
  for (const [file, content] of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const files = writeFiles(source);
  for (const file of files.keys()) console.log(path.relative(root, file));
}
