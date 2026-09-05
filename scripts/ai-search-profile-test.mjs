import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createAiSearchProfileStarter,
  planAiSearchProfile,
  validateAiSearchProfile
} from '../lib/ai-search-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'ai', 'ai-search-profile.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'ai', 'ai-search-profile.json'), 'utf8'));

assert.deepEqual(published, source, 'GitHub Pages AI Search Profile must match the canonical repository profile');

const selfValidation = validateAiSearchProfile(source);
assert.equal(selfValidation.valid, true, JSON.stringify(selfValidation.errors, null, 2));
assert.equal(source.guardrails.noReadinessScore, true);
assert.equal(source.modules.originalResearch.status, 'active');
assert.equal(source.modules.protocolObservatory.status, 'active');
assert.equal(source.modules.protocolObservatory.url, 'https://dkharlanau.github.io/agent-ready-web-profile/observatory/');
assert.deepEqual(source.modules.protocolObservatory.machineReadable, ['https://dkharlanau.github.io/agent-ready-web-profile/observatory/protocols.json']);
assert.equal(source.modules.claimsRegistry.status, 'active');
assert.equal(source.surfaces.claimsIndex.status, 'active');
assert.equal(source.surfaces.claimsIndex.url, 'https://dkharlanau.github.io/agent-ready-web-profile/evidence/claims/index.json');
assert.ok(source.modules.claimsRegistry.machineReadable.includes('https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/claim.schema.json'));
assert.equal(source.modules.evidenceReceipts.status, 'planned', 'claims must not imply replayable evidence receipts are already implemented');
assert.equal(source.modules.crawlerMatrix.status, 'active');
assert.equal(source.modules.crawlerMatrix.url, 'https://dkharlanau.github.io/agent-ready-web-profile/crawler-matrix/');
assert.ok(source.modules.crawlerMatrix.machineReadable.includes('https://dkharlanau.github.io/agent-ready-web-profile/crawler-matrix/crawlers.json'));
assert.equal(source.modules.trustCenter.status, 'active');
assert.equal(source.surfaces.trustCenter.status, 'active');
assert.equal(source.surfaces.trustCenter.url, 'https://dkharlanau.github.io/agent-ready-web-profile/trust/');
assert.equal(source.modules.correctionsLedger.status, 'active');
assert.equal(source.surfaces.correctionsLedger.url, 'https://dkharlanau.github.io/agent-ready-web-profile/trust/corrections.json');
assert.equal(source.modules.softwareProvenance.status, 'planned', 'configured future attestations must remain planned until an attested published artifact exists');
assert.equal(source.modules.persistentIdentifiers.status, 'planned', 'DOI must remain planned until an external provider issues one');
assert.equal(source.modules.externalTrustSignals.status, 'active', 'successful published OpenSSF result should promote the external trust signal');
assert.match(source.modules.externalTrustSignals.notes, /33974701872/);
assert.equal(source.surfaces.history.status, 'active');
assert.equal(source.modules.openReuseAssets.status, 'active');
assert.equal(source.surfaces.pressKit.status, 'active');
assert.equal(source.surfaces.reuseRights.url, 'https://dkharlanau.github.io/agent-ready-web-profile/media/rights.json');
assert.equal(source.modules.answerPages.status, 'active');
assert.equal(source.modules.comparisonPages.status, 'active');
assert.equal(source.modules.conceptDefinitions.status, 'active');
assert.ok(source.modules.answerPages.machineReadable.includes('https://dkharlanau.github.io/agent-ready-web-profile/citation-index.json'));
assert.equal(source.vocabulary.every(item => item.status === 'active'), true);

const citationIndex = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'citation-index.json'), 'utf8'));
assert.equal(citationIndex.license, 'CC-BY-4.0');
assert.ok(citationIndex.items.some(item => item.id === 'concept-resolver-regret'));
assert.ok(citationIndex.items.some(item => item.id === 'compare-static-runtime'));
assert.ok(citationIndex.items.some(item => item.id === 'ARWP-CLAIM-0001' && item.status === 'verified'));
assert.ok(citationIndex.items.some(item => item.id === 'ARWP-CLAIM-0002' && item.status === 'verified'));

const observatoryPath = path.join(root, 'docs', 'observatory', 'protocols.json');
const firstFrozenObservatoryPath = path.join(root, 'docs', 'observatory', 'history', '2026-09-05.json');
const revisedFrozenObservatoryPath = path.join(root, 'docs', 'observatory', 'history', '2026-09-05-r2.json');
const observatoryHistoryPath = path.join(root, 'docs', 'observatory', 'history', 'index.json');
for (const file of [observatoryPath, firstFrozenObservatoryPath, revisedFrozenObservatoryPath, observatoryHistoryPath, path.join(root, 'docs', 'observatory', 'index.html')]) {
  assert.ok(fs.existsSync(file), `missing observatory file: ${path.relative(root, file)}`);
}
const observatory = JSON.parse(fs.readFileSync(observatoryPath, 'utf8'));
const firstFrozenObservatory = JSON.parse(fs.readFileSync(firstFrozenObservatoryPath, 'utf8'));
const revisedFrozenObservatory = JSON.parse(fs.readFileSync(revisedFrozenObservatoryPath, 'utf8'));
const observatoryHistory = JSON.parse(fs.readFileSync(observatoryHistoryPath, 'utf8'));
assert.equal(observatory.snapshotDate, '2026-09-05');
assert.equal(observatory.snapshotRevision, 'r2');
assert.equal(observatory.mechanisms.length, 16);
assert.equal(observatory.methodology.noAdoptionInference, true);
assert.equal(observatory.methodology.noReadinessScore, true);
assert.equal(firstFrozenObservatory.mechanisms.length, 10, 'the first observatory snapshot must remain immutable');
assert.equal(firstFrozenObservatory.snapshotRevision, undefined, 'the original snapshot remains the pre-revision historical record');
assert.deepEqual(revisedFrozenObservatory, observatory, 'r2 frozen snapshot must equal the current published observatory at creation time');
assert.equal(observatoryHistory.snapshots[0].revision, 'r2');
assert.equal(observatoryHistory.snapshots[0].mechanisms, 16);
assert.equal(observatoryHistory.snapshots[1].revision, 'r1');
assert.equal(observatoryHistory.snapshots[1].mechanisms, 10);

const mechanism = id => observatory.mechanisms.find(item => item.id === id);
assert.equal(mechanism('a2a').currentVersion, '1.0.0');
assert.match(mechanism('mcp').currentVersion, /2026-07-28/);
assert.equal(mechanism('ucp-commerce').currentVersion, 'v2026-08-25');
assert.equal(mechanism('webmcp').arwpSupport.staticDiscovery, 'not-assessed-as-runtime');
assert.equal(mechanism('acp-commerce').arwpSupport.staticDiscovery, 'watchlist-no-adapter');
assert.equal(mechanism('ucp-commerce').arwpSupport.staticDiscovery, 'watchlist-no-adapter');
assert.match(mechanism('agent-skills').notes, /core public specification defines the SKILL\.md format/i);
assert.equal(mechanism('ard').currentVersion, 'v0.9 draft; ai-catalog specVersion 1.0');
assert.equal(mechanism('ard').arwpSupport.staticDiscovery, 'partial-ai-catalog-support');
assert.match(mechanism('ard').notes, /site-first/i);
assert.equal(mechanism('dns-aid').currentVersion, 'draft-mozleywilliams-dnsop-dnsaid-02');
assert.equal(mechanism('web-bot-auth').currentVersion, 'draft-meunier-webbotauth-httpsig-protocol-02');
assert.equal(mechanism('aipref').currentVersion, 'draft-ietf-aipref-attach-05');
assert.ok(mechanism('aipref').discovery.includes('Content-Usage HTTP response header'));
assert.equal(mechanism('nlweb').arwpSupport.staticDiscovery, 'watchlist-no-direct-adapter');
assert.equal(mechanism('auth-md').authority, 'community-open-protocol');

const claimsIndex = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'evidence', 'claims', 'index.json'), 'utf8'));
assert.equal(claimsIndex.claims.length, 2);
assert.equal(claimsIndex.claims.every(item => item.status === 'verified'), true);
assert.match(claimsIndex.historyPolicy, /not silently rewritten/i);

const crawlerMatrix = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'crawler-matrix', 'crawlers.json'), 'utf8'));
assert.equal(crawlerMatrix.entries.length, 10);
assert.equal(crawlerMatrix.methodology.conflictsStayVisible, true);

const trust = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'trust', 'trust.json'), 'utf8'));
const corrections = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'trust', 'corrections.json'), 'utf8'));
assert.equal(trust.status, 'active-development');
assert.equal(trust.reviewModel.primarySourcesPreferred, true);
assert.equal(trust.reviewModel.correctionsVisible, true);
assert.equal(trust.softwareSupplyChain.githubArtifactAttestation.status, 'configured-for-next-npm-publish');
assert.equal(trust.softwareSupplyChain.sbomAttestation.status, 'configured-for-next-npm-publish');
assert.equal(trust.softwareSupplyChain.sbomAttestation.format, 'CycloneDX');
assert.equal(trust.softwareSupplyChain.mcpPublisherDependency.status, 'version-and-digest-pinned');
assert.equal(trust.softwareSupplyChain.mcpPublisherDependency.version, 'v1.8.1');
assert.equal(trust.persistentIdentifiers.doi.status, 'prepared-not-issued');
assert.equal(trust.softwareSupplyChain.openSSFScorecard.status, 'configured');
assert.equal(trust.softwareSupplyChain.openSSFScorecard.resultStatus, 'observed-success');
assert.equal(trust.softwareSupplyChain.openSSFScorecard.workflowRun, 'https://github.com/dkharlanau/agent-ready-web-profile/actions/runs/33974701872');
assert.equal(trust.softwareSupplyChain.openSSFScorecard.publishedResults, true);
assert.equal(trust.softwareSupplyChain.openSSFScorecard.uploadedToCodeScanning, true);
assert.equal(corrections.entries.length, 0);
assert.equal(corrections.policy.historicalRecordsAreNotSilentlyRewritten, true);
assert.match(corrections.notes.join(' '), /81\/100 to 86\/100/);

const starter = createAiSearchProfileStarter('https://example.com/docs/', {
  name: 'Example Docs',
  languages: ['en', 'de'],
  canonicalLanguage: 'en'
});
const starterValidation = validateAiSearchProfile(starter);
assert.equal(starterValidation.valid, true, JSON.stringify(starterValidation.errors, null, 2));
assert.equal(starter.site.canonicalUrl, 'https://example.com/docs/');
assert.equal(starter.surfaces.entityHome.status, 'active');
assert.equal(starter.surfaces.siteProfile.status, 'planned');
assert.equal(starter.surfaces.siteProfile.url, 'https://example.com/docs/ai/site-profile.json');
assert.equal(starter.surfaces.robots.url, 'https://example.com/robots.txt');
assert.equal(starter.surfaces.pressKit.url, 'https://example.com/docs/media/');
assert.equal(starter.surfaces.reuseRights.url, 'https://example.com/docs/media/rights.json');
assert.equal(starter.surfaces.trustCenter.url, 'https://example.com/docs/trust/');
assert.equal(starter.surfaces.correctionsLedger.url, 'https://example.com/docs/trust/corrections.json');
assert.equal(starter.modules.openReuseAssets.priority, 'P1');
assert.equal(starter.modules.claimsRegistry.status, 'planned');
assert.equal(starter.modules.crawlerMatrix.status, 'planned');
assert.equal(starter.modules.trustCenter.status, 'planned');
assert.equal(starter.modules.softwareProvenance.status, 'planned');
assert.equal(starter.modules.persistentIdentifiers.status, 'planned');
assert.equal(starter.modules.externalTrustSignals.status, 'planned');
assert.equal(starter.surfaces.claimsIndex.status, 'planned');
assert.equal(Object.values(starter.modules).every(module => module.status === 'planned'), true);

const plan = planAiSearchProfile(starter);
assert.equal(plan.valid, true);
assert.equal(plan.summary.active, 0);
assert.equal(plan.summary.planned, 21);
assert.equal(plan.summary.nextPriority, 'P0');
assert.deepEqual(plan.next.filter(item => item.priority === 'P0').map(item => item.key).sort(), ['answerPages', 'originalResearch', 'protocolObservatory', 'trustCenter']);
for (const expected of ['claimsRegistry', 'crawlerMatrix', 'correctionsLedger', 'openReuseAssets', 'persistentIdentifiers', 'softwareProvenance']) {
  assert.ok(plan.next.some(item => item.key === expected && item.priority === 'P1'), `starter plan must include P1 ${expected}`);
}
assert.ok(plan.next.some(item => item.key === 'externalTrustSignals' && item.priority === 'P2'));

const invalid = structuredClone(starter);
invalid.guardrails.noReadinessScore = false;
assert.equal(validateAiSearchProfile(invalid).valid, false, 'guardrails must not permit readiness-score mode');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-ai-search-'));
const output = path.join(temp, 'profile.json');
const cli = path.join(root, 'bin', 'arwp-ai-search.mjs');
const init = spawnSync(process.execPath, [cli, 'init', 'https://example.org/', '--name=Example Org', '--languages=en,ru', `--output=${output}`], { encoding: 'utf8' });
assert.equal(init.status, 0, init.stderr || init.stdout);
assert.ok(fs.existsSync(output));
const generated = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.deepEqual(generated.site.languages, ['en', 'ru']);
assert.equal(generated.modules.openReuseAssets.status, 'planned');
assert.equal(generated.modules.protocolObservatory.status, 'planned');
assert.equal(generated.modules.claimsRegistry.status, 'planned');
assert.equal(generated.modules.crawlerMatrix.status, 'planned');
assert.equal(generated.modules.trustCenter.status, 'planned');
assert.equal(generated.modules.persistentIdentifiers.status, 'planned');

const validate = spawnSync(process.execPath, [cli, 'validate', output], { encoding: 'utf8' });
assert.equal(validate.status, 0, validate.stderr || validate.stdout);
assert.match(validate.stdout, /PASS/);

const planned = spawnSync(process.execPath, [cli, 'plan', output], { encoding: 'utf8' });
assert.equal(planned.status, 0, planned.stderr || planned.stdout);
assert.match(planned.stdout, /P0 originalResearch/);
assert.match(planned.stdout, /P0 protocolObservatory/);
assert.match(planned.stdout, /P0 trustCenter/);
assert.match(planned.stdout, /P1 claimsRegistry/);
assert.match(planned.stdout, /P1 crawlerMatrix/);
assert.match(planned.stdout, /P1 correctionsLedger/);
assert.match(planned.stdout, /P1 persistentIdentifiers/);
assert.match(planned.stdout, /P1 softwareProvenance/);
assert.match(planned.stdout, /P2 externalTrustSignals/);

console.log('PASS AI Search & Citation Profile validates current observatory research while preserving immutable historical snapshots and evidence guardrails');