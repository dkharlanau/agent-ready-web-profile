import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildEntityRemediationManifest, scanRepositoryEntityEvidence, validateEntityRemediationManifest } from '../lib/entity-remediation.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-entity-remediation-'));
fs.mkdirSync(path.join(temp, 'source'), { recursive: true });
fs.mkdirSync(path.join(temp, 'public'), { recursive: true });

const datasetId = 'https://example.com/#dataset';
const articleId = 'https://example.com/#guide';
fs.writeFileSync(path.join(temp, 'source', 'facts.jsonld'), JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{
    '@id': datasetId,
    '@type': 'Dataset',
    name: 'Cases Dataset',
    creator: { '@id': 'https://example.com/#publisher' },
    license: 'https://creativecommons.org/licenses/by/4.0/'
  }]
}, null, 2));
fs.writeFileSync(path.join(temp, 'public', 'dataset.jsonld'), JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{ '@id': datasetId, '@type': 'Dataset', name: 'Cases Dataset' }]
}, null, 2));
fs.writeFileSync(path.join(temp, 'public', 'guide.jsonld'), JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{ '@id': articleId, '@type': 'TechArticle', name: 'Implementation Guide' }]
}, null, 2));
fs.writeFileSync(path.join(temp, 'public', 'dataset.html'), '<!doctype html><link rel="canonical" href="https://example.com/data/"><h1>Cases Dataset</h1>');

const report = {
  reportVersion: '0.1',
  generatedAt: '2026-09-07T00:00:00.000Z',
  canonicalUrl: 'https://example.com/',
  scope: 'bounded-observed-entity-graph-not-ranking-score',
  source: 'test-fixture',
  entities: [
    { id: datasetId, family: 'Dataset', name: 'Cases Dataset', declaredUrls: ['https://example.com/data/'], sourcePages: ['https://example.com/data/'] },
    { id: articleId, family: 'Article', name: 'Implementation Guide', declaredUrls: ['https://example.com/guide/'], sourcePages: ['https://example.com/guide/'] }
  ],
  gaps: [
    { id: `property:dataset:creator|publisher:${datasetId}`, priority: 'P1', family: 'Dataset', entityId: datasetId, entityName: 'Cases Dataset', problem: 'Dataset has neither creator nor publisher relation.', recommendation: 'Add creator or publisher only when grounded.' },
    { id: `property:dataset:license:${datasetId}`, priority: 'P1', family: 'Dataset', entityId: datasetId, entityName: 'Cases Dataset', problem: 'Dataset has no explicit license.', recommendation: 'Add license only when grounded.' },
    { id: `property:article:author:${articleId}`, priority: 'P1', family: 'Article', entityId: articleId, entityName: 'Implementation Guide', problem: 'Article has no author.', recommendation: 'Add author only when grounded.' },
    { id: `orphan:${datasetId}`, priority: 'P2', family: 'Dataset', entityId: datasetId, entityName: 'Cases Dataset', problem: 'Dataset is isolated.', recommendation: 'Add a truthful relation.' }
  ]
};

const before = crypto.createHash('sha256').update(fs.readFileSync(path.join(temp, 'public', 'dataset.jsonld'))).digest('hex');
const repo = scanRepositoryEntityEvidence(temp, { maxFiles: 50, maxFileBytes: 256 * 1024 });
assert.ok(repo.filesScanned >= 4);
assert.equal(repo.parseErrors.length, 0);

const manifest = buildEntityRemediationManifest(report, { repoRoot: temp, generatedAt: '2026-09-07T01:00:00.000Z' });
assert.equal(validateEntityRemediationManifest(manifest).valid, true);
assert.equal(manifest.guardrails.writesTargetRepository, false);
assert.equal(manifest.guardrails.appliesPatches, false);
assert.equal(manifest.summary.withPatch, 2);

const creator = manifest.items.find(item => item.gapId.includes('creator|publisher'));
assert.equal(creator.disposition, 'grounded-json-patch-proposal');
assert.equal(creator.proposal.type, 'json-patch');
assert.equal(creator.proposal.operations[0].op, 'add');
assert.equal(creator.proposal.operations[0].path, '/@graph/0/creator');
assert.deepEqual(creator.proposal.operations[0].value, { '@id': 'https://example.com/#publisher' });
assert.match(creator.target.file, /public\/dataset\.jsonld$/);
assert.ok(creator.evidence.some(evidence => /source\/facts\.jsonld$/.test(evidence.file)));

const license = manifest.items.find(item => item.gapId.includes(':license:'));
assert.equal(license.disposition, 'grounded-json-patch-proposal');
assert.equal(license.proposal.operations[0].value, 'https://creativecommons.org/licenses/by/4.0/');

const author = manifest.items.find(item => item.gapId.includes('article:author'));
assert.equal(author.disposition, 'missing-evidence-review');
assert.equal(author.proposal, undefined);
assert.ok(author.warnings.includes('no-grounded-first-party-value-observed'));

const orphan = manifest.items.find(item => item.gapId.startsWith('orphan:'));
assert.equal(orphan.disposition, 'verify-deployment');
assert.ok(orphan.evidence.some(evidence => evidence.property === 'creator'));

const after = crypto.createHash('sha256').update(fs.readFileSync(path.join(temp, 'public', 'dataset.jsonld'))).digest('hex');
assert.equal(after, before, 'remediation generation must not mutate repository files');

const noRepo = buildEntityRemediationManifest(report, { generatedAt: '2026-09-07T01:00:00.000Z' });
assert.equal(noRepo.summary.repository, null);
assert.equal(noRepo.summary.withPatch, 0);
assert.equal(noRepo.items.find(item => item.gapId.includes(':license:')).disposition, 'missing-evidence-review');

fs.rmSync(temp, { recursive: true, force: true });

const publishedReportPath = path.resolve('docs/entities/gaps/reference-report.json');
const publishedManifestPath = path.resolve('docs/entities/remediation/reference-manifest.json');
const publishedFixtureRoot = path.resolve('examples/entity-remediation');
if (fs.existsSync(publishedReportPath) && fs.existsSync(publishedManifestPath) && fs.existsSync(publishedFixtureRoot)) {
  const publishedReport = JSON.parse(fs.readFileSync(publishedReportPath, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(publishedManifestPath, 'utf8'));
  const reproduced = buildEntityRemediationManifest(publishedReport, { repoRoot: publishedFixtureRoot, generatedAt: expected.generatedAt });
  reproduced.repositoryEvidence.repoRoot = 'synthetic-reference-repository';
  assert.deepEqual(reproduced, expected, 'published remediation reference must reproduce from the shipped synthetic repository fixture');
}

console.log('PASS entity remediation grounds JSON patch proposals in first-party repository evidence, keeps missing facts manual, detects deployment drift, reproduces the published fixture, validates its manifest, and never writes target files');
