import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const cohort = JSON.parse(fs.readFileSync(path.join(root, 'knowledge', 'experiments', '2026-09-09-ptichi-cohort-freeze.json'), 'utf8'));
const external = JSON.parse(fs.readFileSync(path.join(root, 'knowledge', 'research', '2026-09-09-external-evidence-winner-loop.json'), 'utf8'));
const lab = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'evidence-lab', 'index.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'docs', 'evidence-lab', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'docs', 'evidence-lab', 'evidence-lab.css'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'docs', 'sitemap.xml'), 'utf8');

assert.equal(lab.product, 'Goose');
assert.equal(lab.technicalCore, 'Agent-Ready Web Profile (ARWP)');
assert.equal(lab.firstExperiment.id, cohort.id);
assert.equal(lab.firstExperiment.status, cohort.status);
assert.equal(lab.firstExperiment.treatmentCount, cohort.treatment.length);
assert.equal(lab.firstExperiment.controlCount, cohort.control.length);
assert.equal(lab.firstExperiment.queryCount, cohort.queryPanel.queries.length);
assert.equal(lab.firstExperiment.implementationRef, cohort.measurementGate.implementationRef);
assert.equal(lab.firstExperiment.productionRef, cohort.measurementGate.productionRef);
assert.equal(lab.firstExperiment.productionGate, cohort.measurementGate.state);
assert.equal(lab.firstExperiment.productionParity, false);
assert.deepEqual(
  lab.firstExperiment.queryPanel.map(item => ({ id: item.id, text: item.text, targetEntities: item.targetEntities })),
  cohort.queryPanel.queries.map(item => ({ id: item.id, text: item.text, targetEntities: item.targetEntities }))
);

const expectedClassCounts = {};
for (const record of external.records) expectedClassCounts[record.class] = (expectedClassCounts[record.class] || 0) + 1;
assert.equal(lab.externalEvidence.reviewedAt, external.reviewed_at);
assert.equal(lab.externalEvidence.recordCount, external.records.length);
assert.deepEqual(lab.externalEvidence.classCounts, {
  'official-platform': expectedClassCounts['official-platform'],
  'large-sample-observational': expectedClassCounts['large-sample-observational'],
  'individual-experiment': expectedClassCounts['individual-experiment']
});

assert.match(html, /<title>Goose Evidence Lab — Evidence before advice<\/title>/);
assert.match(html, /<strong>Goose<\/strong>/);
assert.doesNotMatch(html, /Goose/);
assert.match(html, /MEASUREMENT HOLD/);
assert.match(html, new RegExp(cohort.measurementGate.implementationRef.slice(0, 8)));
assert.match(html, new RegExp(cohort.measurementGate.productionRef.slice(0, 8)));
assert.match(html, /Measured wins<\/dt><dd>0<\/dd>/);
assert.match(html, /evidence-lab\.css/);
assert.match(css, /\.lab-status-hold/);
assert.match(css, /@media\(max-width:700px\)/);
assert.match(sitemap, /\/evidence-lab\//);

for (const query of cohort.queryPanel.queries) {
  assert.match(html, new RegExp(query.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.equal(lab.guardrails.rankingGuarantee, false);
assert.equal(lab.guardrails.citationGuarantee, false);
assert.equal(lab.guardrails.causalityInferredFromObservation, false);
assert.equal(lab.guardrails.missingEvidenceBecomesZero, false);
assert.equal(lab.guardrails.neutralAndNegativeResultsPreserved, true);

console.log('PASS evidence-lab-test');
