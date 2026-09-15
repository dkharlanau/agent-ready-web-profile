import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateMeasurementGate,
  summarizeControlledCohort,
  validateControlledCohort
} from '../lib/controlled-cohort.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'knowledge', 'experiments', name), 'utf8'));
}

const ptichi = load('2026-09-09-ptichi-cohort-freeze.json');
const ptichiR2 = load('2026-09-15-ptichi-cohort-refreeze-r2.json');

const validation = validateControlledCohort(ptichi);
assert.equal(validation.valid, true, JSON.stringify(validation, null, 2));
assert.equal(validation.warnings.length, 0);

const summary = summarizeControlledCohort(ptichi);
assert.equal(summary.treatmentCount, 12);
assert.equal(summary.controlCount, 6);
assert.equal(summary.queryCount, 12);
assert.equal(summary.measurementGate, 'hold');
assert.equal(summary.implementationRef, 'fc34374963fbcdb4fb44488ed804d505c25892c7');
assert.equal(summary.productionRef, 'bff8360b06f1b31724c8273607678b418d369cb5');

const staleGate = evaluateMeasurementGate(ptichi, 'bff8360b06f1b31724c8273607678b418d369cb5');
assert.equal(staleGate.ready, false);
assert.equal(staleGate.nextState, 'measurement-hold');
assert.equal(staleGate.observationClockMayStart, false);

const readyGate = evaluateMeasurementGate(ptichi, ptichi.measurementGate.implementationRef);
assert.equal(readyGate.ready, true);
assert.equal(readyGate.nextState, 'ready-to-observe');
assert.equal(readyGate.observationClockMayStart, true);

const r2Validation = validateControlledCohort(ptichiR2);
assert.equal(r2Validation.valid, true, JSON.stringify(r2Validation, null, 2));
assert.equal(r2Validation.warnings.length, 0);

const r2Summary = summarizeControlledCohort(ptichiR2);
assert.equal(r2Summary.status, 'ready-to-observe');
assert.equal(r2Summary.treatmentCount, ptichi.treatment.length);
assert.equal(r2Summary.controlCount, ptichi.control.length);
assert.equal(r2Summary.queryCount, ptichi.queryPanel.queries.length);
assert.equal(r2Summary.measurementGate, 'ready');
assert.equal(r2Summary.implementationRef, '13b49e9a5faa9256b5bbded049caf33327abc240');
assert.equal(r2Summary.productionRef, r2Summary.implementationRef);

assert.deepEqual(
  ptichiR2.treatment.map(({ entity, source }) => ({ entity, source })),
  ptichi.treatment.map(({ entity, source }) => ({ entity, source }))
);
assert.deepEqual(
  ptichiR2.control.map(({ entity, source }) => ({ entity, source })),
  ptichi.control.map(({ entity, source }) => ({ entity, source }))
);
assert.deepEqual(
  ptichiR2.queryPanel.queries.map(({ id, text, targetEntities }) => ({ id, text, targetEntities })),
  ptichi.queryPanel.queries.map(({ id, text, targetEntities }) => ({ id, text, targetEntities }))
);

const r2Gate = evaluateMeasurementGate(ptichiR2, ptichiR2.measurementGate.productionRef);
assert.equal(r2Gate.ready, true);
assert.equal(r2Gate.nextState, 'ready-to-observe');
assert.equal(r2Gate.observationClockMayStart, true);

const overlap = structuredClone(ptichi);
overlap.control[0].entity = overlap.treatment[0].entity;
assert.equal(validateControlledCohort(overlap).valid, false);
assert.ok(validateControlledCohort(overlap).semanticErrors.some(error => error.includes('Entity appears more than once')));

const queryMutation = structuredClone(ptichi);
queryMutation.queryPanel.queries[0].targetEntities = ['entity.not.in.cohort'];
assert.equal(validateControlledCohort(queryMutation).valid, false);
assert.ok(validateControlledCohort(queryMutation).semanticErrors.some(error => error.includes('outside frozen treatment/control')));

const badReady = structuredClone(ptichi);
badReady.status = 'ready-to-observe';
badReady.measurementGate.state = 'ready';
badReady.measurementGate.productionRef = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
assert.equal(validateControlledCohort(badReady).valid, false);
assert.ok(validateControlledCohort(badReady).semanticErrors.some(error => error.includes('productionRef to match implementationRef')));

const unsorted = structuredClone(ptichi);
unsorted.observationWindowsDays = [28, 14, 56];
assert.equal(validateControlledCohort(unsorted).valid, false);

assert.throws(() => evaluateMeasurementGate(ptichi, 'short-sha'), /40-character/);

console.log('PASS controlled-cohort-test');
