import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadSitePatternCatalogs } from '../lib/site-pattern-graph.mjs';
import {
  loadSitePatternDetectorRegistry,
  selectSitePatternDetectors,
  validateSitePatternDetectorRegistry
} from '../lib/site-pattern-detectors.mjs';

const catalogs = loadSitePatternCatalogs(process.cwd());
const registry = loadSitePatternDetectorRegistry(process.cwd());
const schema = JSON.parse(fs.readFileSync('schema/site-pattern-detector-registry-v0.1.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

assert.equal(validateSchema(registry), true, JSON.stringify(validateSchema.errors, null, 2));
const valid = validateSitePatternDetectorRegistry(registry, catalogs);
assert.equal(valid.valid, true, valid.errors.join('\n'));
assert.ok(valid.summary.deterministic >= 1);
assert.ok(valid.summary.heuristic >= 1);
assert.ok(valid.summary.candidateOnly >= 1);
assert.ok(valid.summary.verdictCapable >= 1);

const antiCandidates = selectSitePatternDetectors(registry, { kind: 'anti-pattern', authority: 'candidate' });
assert.ok(antiCandidates.returned >= 3);
assert.ok(antiCandidates.detectors.every(row => row.allowedVerdicts.length === 1 && row.allowedVerdicts[0] === 'unknown'));
assert.match(antiCandidates.scope, /do not establish pattern presence or absence/i);

const magic = registry.detectors.find(row => row.id === 'spd_magic_agent_file_candidate');
assert.ok(magic, 'magic-file candidate detector must exist');
const unsafeHeuristic = structuredClone(registry);
const unsafe = unsafeHeuristic.detectors.find(row => row.id === 'spd_magic_agent_file_candidate');
unsafe.authority = 'verdict';
unsafe.allowedVerdicts = ['present', 'absent'];
assert.equal(validateSchema(unsafeHeuristic), false, 'schema must reject heuristic verdict authority');
assert.equal(validateSitePatternDetectorRegistry(unsafeHeuristic, catalogs).valid, false);

const manualReview = structuredClone(registry);
const manualMagic = manualReview.detectors.find(row => row.id === 'spd_magic_agent_file_candidate');
manualMagic.mode = 'manual-assisted';
manualMagic.authority = 'verdict';
manualMagic.allowedVerdicts = ['present', 'absent', 'unknown'];
manualMagic.reviewGate = 'manual';
assert.equal(validateSchema(manualReview), true, JSON.stringify(validateSchema.errors, null, 2));
assert.equal(validateSitePatternDetectorRegistry(manualReview, catalogs).valid, true, validateSitePatternDetectorRegistry(manualReview, catalogs).errors.join('\n'));

const wrongPattern = structuredClone(registry);
wrongPattern.detectors[0].pattern.id = 'does-not-exist';
assert.equal(validateSitePatternDetectorRegistry(wrongPattern, catalogs).valid, false);

const wrongVersion = structuredClone(registry);
wrongVersion.detectors[0].pattern.version = '99.0.0';
assert.equal(validateSitePatternDetectorRegistry(wrongVersion, catalogs).valid, false);

console.log('PASS Site Pattern Detector Registry v0.1 schema, catalog binding, candidate authority limits and manual anti-pattern gate');
