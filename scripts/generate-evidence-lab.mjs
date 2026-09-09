#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cohortPath = path.join(root, 'knowledge', 'experiments', '2026-09-09-ptichi-cohort-freeze.json');
const externalEvidencePath = path.join(root, 'knowledge', 'research', '2026-09-09-external-evidence-winner-loop.json');
const outputDir = path.join(root, 'docs', 'evidence-lab');
const htmlPath = path.join(outputDir, 'index.html');
const jsonPath = path.join(outputDir, 'index.json');
const check = process.argv.includes('--check');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function evidenceClassCounts(records) {
  const counts = {};
  for (const record of records) counts[record.class] = (counts[record.class] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function shortSha(value) {
  return value ? value.slice(0, 8) : 'unknown';
}

function statusLabel(status) {
  return status.replaceAll('-', ' ').toUpperCase();
}

function buildModel() {
  const cohortRaw = fs.readFileSync(cohortPath, 'utf8');
  const researchRaw = fs.readFileSync(externalEvidencePath, 'utf8');
  const cohort = JSON.parse(cohortRaw);
  const external = JSON.parse(researchRaw);
  const classCounts = evidenceClassCounts(external.records || []);
  const treatmentEntities = cohort.treatment.map(item => item.entity);
  const controlEntities = cohort.control.map(item => item.entity);

  return {
    version: '0.1',
    generatedAt: cohort.frozenAt,
    product: 'Goose',
    technicalCore: 'Agent-Ready Web Profile (ARWP)',
    labState: {
      activeControlledExperiments: 1,
      measuredPositiveExperiments: 0,
      measuredNeutralExperiments: 0,
      measuredNegativeExperiments: 0,
      note: 'The first controlled cohort is frozen but measurement is on hold until verified production matches the frozen implementation ref.'
    },
    firstExperiment: {
      id: cohort.id,
      site: cohort.site,
      repository: cohort.repository,
      status: cohort.status,
      frozenAt: cohort.frozenAt,
      treatmentCount: cohort.treatment.length,
      controlCount: cohort.control.length,
      queryCount: cohort.queryPanel.queries.length,
      querySurface: cohort.queryPanel.surface,
      locale: cohort.queryPanel.locale,
      observationWindowsDays: cohort.observationWindowsDays,
      implementationRef: cohort.measurementGate.implementationRef,
      productionRef: cohort.measurementGate.productionRef,
      productionGate: cohort.measurementGate.state,
      productionParity: cohort.measurementGate.productionRef === cohort.measurementGate.implementationRef,
      gateReason: cohort.measurementGate.reason,
      treatmentEntities,
      controlEntities,
      queryPanel: cohort.queryPanel.queries.map(query => ({ id: query.id, text: query.text, targetEntities: query.targetEntities })),
      outcomes: cohort.outcomes,
      decisionRules: cohort.decisionRules
    },
    externalEvidence: {
      reviewedAt: external.reviewed_at,
      recordCount: (external.records || []).length,
      classCounts,
      sourceClasses: external.source_classes,
      promotionPolicy: external.promotion_policy,
      records: (external.records || []).map(record => ({
        id: record.id,
        class: record.class,
        publisher: record.publisher,
        title: record.title,
        publishedOrUpdated: record.published_or_updated,
        url: record.url,
        finding: record.finding,
        useInGoose: record.use_in_goose,
        causalStrength: record.causal_strength,
        caveat: record.caveat
      }))
    },
    learningSystem: [
      {
        id: 'external-evidence',
        label: 'External evidence',
        purpose: 'Separate provider requirements from independent observations and expert experiments.'
      },
      {
        id: 'winner-observatory',
        label: 'Winner Observatory',
        purpose: 'Track entrants, drops, top-10 persistence and citation persistence for frozen query cohorts.'
      },
      {
        id: 'controlled-cohorts',
        label: 'Controlled cohorts',
        purpose: 'Freeze treatment, controls and queries before outcomes are visible, then block measurement until production parity.'
      },
      {
        id: 'recommendation-review',
        label: 'Recommendation review',
        purpose: 'Move advice through fresh, review-due, challenged, contradicted and retire-candidate states without silent registry mutation.'
      }
    ],
    evidenceStages: [
      { id: 'implementation', label: 'Implementation', question: 'Did the repository change exist and pass checks?' },
      { id: 'deployment', label: 'Deployment', question: 'Is that exact implementation live?' },
      { id: 'exposure', label: 'Exposure', question: 'Did Search/AI systems expose the page?' },
      { id: 'citation', label: 'Citation', question: 'Was the page cited, and did the citation persist?' },
      { id: 'visit', label: 'Visit', question: 'Did identifiable traffic arrive?' },
      { id: 'task', label: 'Useful action', question: 'Did the visit lead to a relevant product action?' }
    ],
    sourceDigests: {
      controlledCohortSha256: sha256(cohortRaw),
      externalEvidenceSha256: sha256(researchRaw)
    },
    links: {
      controlledCohorts: '../CONTROLLED-COHORTS.md',
      winnerObservatory: '../WINNER-OBSERVATORY.md',
      recommendationReview: '../RECOMMENDATION-REVIEW.md',
      evidenceWinnerLab: '../EVIDENCE-WINNER-LAB.md',
      growthLoop: '../growth/',
      patterns: '../discoverability.html',
      github: 'https://github.com/dkharlanau/agent-ready-web-profile'
    },
    guardrails: {
      rankingGuarantee: false,
      citationGuarantee: false,
      causalityInferredFromObservation: false,
      missingEvidenceBecomesZero: false,
      neutralAndNegativeResultsPreserved: true
    }
  };
}

function buildHtml(model) {
  const exp = model.firstExperiment;
  const classCards = Object.entries(model.externalEvidence.classCounts)
    .map(([key, count]) => `<article><span>${escapeHtml(key)}</span><strong>${count}</strong><p>${escapeHtml(model.externalEvidence.sourceClasses?.[key] || 'Reviewed evidence class.')}</p></article>`)
    .join('\n');
  const systemCards = model.learningSystem
    .map((item, index) => `<article><span class="lab-step">0${index + 1}</span><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.purpose)}</p></article>`)
    .join('\n');
  const stageCards = model.evidenceStages
    .map((item, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.question)}</p></article>`)
    .join('\n');
  const queries = exp.queryPanel
    .map(query => `<li><code>${escapeHtml(query.id)}</code><span>${escapeHtml(query.text)}</span></li>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Goose Evidence Lab shows what the project is testing, what is on hold, which evidence classes support recommendations, and which outcomes are still unknown.">
  <meta name="theme-color" content="#eff600">
  <meta property="og:title" content="Goose Evidence Lab — Evidence before advice">
  <meta property="og:description" content="Live experiment state, Winner Observatory, controlled cohorts and recommendation review — including holds, neutral evidence and failures.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://dkharlanau.github.io/agent-ready-web-profile/evidence-lab/">
  <title>Goose Evidence Lab — Evidence before advice</title>
  <link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/evidence-lab/">
  <link rel="describedby" type="application/json" href="./index.json">
  <link rel="stylesheet" href="../arwp.css">
  <link rel="preload" href="../media/cite-goose/inter-tight-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../cite-goose.css">
</head>
<body class="evidence-lab-page">
  <a class="skip" href="#main">Skip to content</a>
  <header class="goose-header">
    <a class="goose-brand" href="../"><strong>Goose</strong><span>AGENT-READY<br>WEB PROFILE</span></a>
    <nav aria-label="Primary"><a href="../site-focus.html">Focus</a><a href="../discoverability.html">Patterns</a><a href="../growth/">Growth Loop</a><a aria-current="page" href="./">Evidence Lab</a><a href="${model.links.github}">GitHub</a></nav>
  </header>

  <main id="main">
    <section class="lab-hero goose-shell">
      <p class="eyebrow">GOOSE EVIDENCE LAB / ${escapeHtml(model.generatedAt.slice(0, 10))}</p>
      <div class="lab-hero-grid">
        <div><h1>Evidence<br>before advice.</h1></div>
        <div class="lab-hero-note"><p>Goose does not turn every SEO or AI-search observation into a rule. This lab keeps provider guidance, independent research, winning pages, owned-site experiments and counter-evidence separate.</p><p><strong>Current truth:</strong> the first Ptichi cohort is frozen, but measurement is on hold. No ranking or citation result is claimed yet.</p></div>
      </div>
      <dl class="lab-stats">
        <div><dt>External records</dt><dd>${model.externalEvidence.recordCount}</dd></div>
        <div><dt>Treatment</dt><dd>${exp.treatmentCount}</dd></div>
        <div><dt>Controls</dt><dd>${exp.controlCount}</dd></div>
        <div><dt>Frozen queries</dt><dd>${exp.queryCount}</dd></div>
        <div><dt>Measured wins</dt><dd>0</dd></div>
      </dl>
    </section>

    <section class="lab-live">
      <div class="goose-shell">
        <div class="lab-section-head"><div><p class="eyebrow">LIVE EXPERIMENT / PTI-DA-001</p><h2>Do not start the clock yet.</h2></div><span class="lab-status lab-status-hold">${statusLabel(exp.status)}</span></div>
        <div class="lab-gate-grid">
          <article><span>IMPLEMENTATION</span><strong>${shortSha(exp.implementationRef)}</strong><p>Frozen repository state containing the treatment.</p></article>
          <article><span>PRODUCTION</span><strong>${shortSha(exp.productionRef)}</strong><p>Last preserved live deployment receipt.</p></article>
          <article class="lab-gate-result"><span>GATE</span><strong>HOLD</strong><p>The refs do not match. Search/AI outcomes cannot yet be attributed to the treatment.</p></article>
        </div>
        <p class="lab-explanation">${escapeHtml(exp.gateReason)}</p>
        <div class="lab-cohort-grid"><div><h3>${exp.treatmentCount} treatment entities</h3><p>Existing useful Ptichi pages only. No indexable pages were manufactured to reach a generic sample size.</p></div><div><h3>${exp.controlCount} unchanged controls</h3><p>Comparable published entities stay outside the treatment during the first observation window unless a correctness fix is required.</p></div><div><h3>${exp.observationWindowsDays.join(' / ')} days</h3><p>The observation windows begin only after independently verified production parity.</p></div></div>
        <details class="lab-query-panel"><summary>View the frozen ${exp.queryCount}-query panel</summary><ol>${queries}</ol></details>
      </div>
    </section>

    <section class="goose-shell lab-section">
      <div class="lab-section-head"><div><p class="eyebrow">LEARNING SYSTEM</p><h2>Observe. Challenge. Retire.</h2></div><p>Adding recommendations is easy. Goose is designed to also weaken or remove them when evidence changes.</p></div>
      <div class="lab-system-grid">${systemCards}</div>
    </section>

    <section class="lab-dark">
      <div class="goose-shell lab-section">
        <div class="lab-section-head"><div><p class="eyebrow">EVIDENCE IS NOT ONE SCORE</p><h2>Keep the stages apart.</h2></div><p>A passing implementation is not a deployment, a deployment is not exposure, and a citation is not a useful visit.</p></div>
        <div class="lab-stage-grid">${stageCards}</div>
      </div>
    </section>

    <section class="goose-shell lab-section">
      <div class="lab-section-head"><div><p class="eyebrow">EXTERNAL EVIDENCE / REVIEWED ${escapeHtml(model.externalEvidence.reviewedAt)}</p><h2>${model.externalEvidence.recordCount} records. Different jobs.</h2></div><p>Official platform documentation is strongest for provider requirements and controls. Observational studies and expert experiments can generate hypotheses, but they do not expose hidden ranking weights.</p></div>
      <div class="lab-class-grid">${classCards}</div>
      <p class="lab-source-note">Machine-readable source digests: cohort <code>${model.sourceDigests.controlledCohortSha256}</code> · research <code>${model.sourceDigests.externalEvidenceSha256}</code>.</p>
    </section>

    <section class="lab-review">
      <div class="goose-shell">
        <p class="eyebrow">RECOMMENDATION LIFECYCLE</p>
        <h2>Advice can decay.</h2>
        <div class="lab-lifecycle"><span>fresh</span><b>→</b><span>review-due</span><b>→</b><span>challenged</span><b>→</b><span>contradicted</span><b>→</b><span>retire-candidate</span></div>
        <p>Source age, provider changes, winner counterexamples and owned-site negative evidence can all create review attention. No event silently rewrites the recommendation registry.</p>
      </div>
    </section>

    <section class="goose-shell lab-section lab-links">
      <div><p class="eyebrow">INSPECT THE METHOD</p><h2>Read the evidence, not the badge.</h2></div>
      <div class="lab-link-grid">
        <a href="./index.json"><strong>Machine-readable Lab</strong><span>Current lab state, source classes, cohort and query panel →</span></a>
        <a href="../CONTROLLED-COHORTS.md"><strong>Controlled Cohorts</strong><span>Freeze + production-gate contract →</span></a>
        <a href="../WINNER-OBSERVATORY.md"><strong>Winner Observatory</strong><span>Entrants, drops and persistence →</span></a>
        <a href="../RECOMMENDATION-REVIEW.md"><strong>Recommendation Review</strong><span>Challenge and retirement queue →</span></a>
      </div>
    </section>
  </main>

  <footer class="goose-footer goose-shell"><a class="goose-brand" href="../"><strong>Goose</strong><span>AGENT-READY<br>WEB PROFILE</span></a><p>Evidence-backed website growth. No ranking or citation guarantee.</p><a href="${model.links.github}">GitHub</a></footer>
</body>
</html>
`;
}

function render() {
  const model = buildModel();
  const json = `${JSON.stringify(model, null, 2)}\n`;
  const html = buildHtml(model);
  return { json, html };
}

function ensure(file, expected) {
  if (!fs.existsSync(file)) throw new Error(`Missing generated file: ${path.relative(root, file)}`);
  const current = fs.readFileSync(file, 'utf8');
  if (current !== expected) throw new Error(`Generated output is stale: ${path.relative(root, file)}. Run node scripts/generate-evidence-lab.mjs`);
}

const outputs = render();
if (check) {
  ensure(jsonPath, outputs.json);
  ensure(htmlPath, outputs.html);
  console.log('PASS Goose Evidence Lab outputs are current');
} else {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, outputs.json, 'utf8');
  fs.writeFileSync(htmlPath, outputs.html, 'utf8');
  console.log(`WROTE ${path.relative(root, htmlPath)}`);
  console.log(`WROTE ${path.relative(root, jsonPath)}`);
}
