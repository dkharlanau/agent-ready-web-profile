import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildSiteFocusReportFromPages, formatSiteFocusReport } from '../lib/site-focus-v2.mjs';
import { validateSiteFocusV3Profile } from '../lib/site-focus-v3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'examples', 'site-focus-v0.3.profile.json'), 'utf8'));
profile.experience.navigation.maxPrimaryItems = 3;

const profileValidation = validateSiteFocusV3Profile(profile);
assert.equal(profileValidation.valid, true, JSON.stringify(profileValidation.errors));

const invalid = structuredClone(profile);
invalid.homepage.primaryLane = 'missing-lane';
assert.equal(validateSiteFocusV3Profile(invalid).valid, false, 'homepage lane references must be validated');

const home = `<!doctype html><html><head><title>Decide what your site should own</title><meta name="description" content="Focused websites for owners who need a clear problem boundary, useful outcomes and evidence."><link rel="canonical" href="https://example.com/"></head><body><nav><a href="/focus/">Focus</a><a href="/improve/">Improve</a><a href="/evidence/">Evidence</a><a href="/about/">About</a></nav><h1>Choose the problems your useful specialist website should solve</h1><p>For website owners and maintainers. Define the audience, improve the site, preserve evidence and choose one bounded improvement.</p><a href="/focus/">Review the declared scope</a></body></html>`;
const focus = `<!doctype html><html><head><title>Site focus</title><meta name="description" content="Choose an explicit site purpose and problem boundary."><link rel="canonical" href="https://example.com/focus/"></head><body><h1>Site focus</h1><a href="/improve/">Choose an architecture change</a></body></html>`;
const improve = `<!doctype html><html><head><title>Improve site architecture</title><meta name="description" content="Turn scope into homepage and navigation changes."><link rel="canonical" href="https://example.com/improve/"></head><body><h1>Improve site architecture</h1><a href="/evidence/">Verify the change</a></body></html>`;
const evidence = `<!doctype html><html><head><title>Evidence</title><meta name="description" content="Keep implementation proof and outcome evidence separate."><link rel="canonical" href="https://example.com/evidence/"></head><body><h1>Evidence</h1><table><tr><td>Change</td><td>Result</td></tr></table></body></html>`;

const report = buildSiteFocusReportFromPages([
  { url: 'https://example.com/', html: home },
  { url: 'https://example.com/focus/', html: focus },
  { url: 'https://example.com/improve/', html: improve },
  { url: 'https://example.com/evidence/', html: evidence }
], { canonicalUrl: 'https://example.com/', focusProfile: profile, focusProfileSource: 'v0.3-fixture' });

assert.equal(report.version, '0.3');
assert.equal(report.intentVersion, '0.3');
assert.equal(report.declaredFocus.version, '0.3');
assert.equal(report.declaredFocus.source, 'v0.3-fixture');
assert.equal(report.experienceContract.homepage.primaryLane, 'decide');
assert.equal(report.experienceContract.homepage.laneStatus, 'aligned');
assert.equal(report.experienceContract.navigation.budget, 3);
assert.equal(report.experienceContract.navigation.observedPrimaryItems, 4);
assert.equal(report.experienceContract.navigation.status, 'over-budget');
assert.equal(report.experienceContract.performance.assessmentState, 'field-data-required');
assert.equal(report.experienceContract.performance.budget.lcpMsP75Max, 2500);
assert.equal(report.experienceContract.performance.budget.inpMsP75Max, 200);
assert.equal(report.experienceContract.performance.budget.clsP75Max, 0.1);
assert.equal(report.experienceContract.visual.assessmentState, 'owner-declared-not-static-quality-scored');
assert.equal(report.experienceContract.sources.length, 3);
assert.ok(report.siteFindings.some(item => item.id === 'primary-navigation-over-budget'));
assert.ok(report.transformationHandoff.candidates.some(item => item.action === 'reduce-or-restructure-primary-navigation'));
assert.equal(report.transformationHandoff.executable, false);
assert.equal(report.guardrails.performanceBudgetRequiresFieldEvidence, true);
assert.equal(report.guardrails.visualPrinciplesAreOwnerIntentNotQualityEvidence, true);
assert.equal(report.guardrails.noCompositeFocusExperienceScore, true);
assert.equal('score' in report, false);
assert.match(formatSiteFocusReport(report), /Site Focus v0\.3 experience contract/i);
assert.match(formatSiteFocusReport(report), /field-data-required/i);

const reportSchema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'site-focus-report-v0.3.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validateReport = ajv.compile(reportSchema);
assert.equal(validateReport(report), true, JSON.stringify(validateReport.errors));

console.log('PASS Site Focus v0.3 adds problem-lane, homepage, navigation, visual-intent and field-evidence performance contracts without producing a composite score or automatic production mutation');
