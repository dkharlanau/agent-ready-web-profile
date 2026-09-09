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
const ptichiPath = path.join(root, 'knowledge', 'experiments', '2026-09-09-ptichi-cohort-freeze.json');
const ptichi = JSON.parse(fs.readFileSync(ptichiPath, 'utf8'));

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
