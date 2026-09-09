import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'controlled-cohort.schema.json');

export function loadControlledCohortSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function createControlledCohortValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(loadControlledCohortSchema());
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateControlledCohort(cohort) {
  const validate = createControlledCohortValidator();
  const schemaValid = Boolean(validate(cohort));
  const semanticErrors = [];
  const warnings = [];

  const treatment = cohort?.treatment || [];
  const control = cohort?.control || [];
  const allMembers = [...treatment, ...control];

  for (const id of duplicates(allMembers.map(member => member.id))) {
    semanticErrors.push(`Duplicate cohort member id: ${id}`);
  }
  for (const entity of duplicates(allMembers.map(member => member.entity))) {
    semanticErrors.push(`Entity appears more than once across treatment/control: ${entity}`);
  }
  for (const source of duplicates(allMembers.map(member => member.source))) {
    semanticErrors.push(`Source appears more than once across treatment/control: ${source}`);
  }

  const memberEntities = new Set(allMembers.map(member => member.entity));
  const queryIds = (cohort?.queryPanel?.queries || []).map(query => query.id);
  for (const id of duplicates(queryIds)) semanticErrors.push(`Duplicate query id: ${id}`);

  for (const query of cohort?.queryPanel?.queries || []) {
    for (const entity of query.targetEntities || []) {
      if (!memberEntities.has(entity)) {
        semanticErrors.push(`Query ${query.id} targets entity outside frozen treatment/control: ${entity}`);
      }
    }
  }

  const windows = cohort?.observationWindowsDays || [];
  for (let index = 1; index < windows.length; index += 1) {
    if (windows[index] <= windows[index - 1]) {
      semanticErrors.push('observationWindowsDays must be strictly increasing.');
      break;
    }
  }

  const gate = cohort?.measurementGate;
  if (gate?.state === 'ready') {
    if (!gate.productionRef) semanticErrors.push('Ready measurement gate requires productionRef.');
    if (gate.productionRef && gate.productionRef !== gate.implementationRef) {
      semanticErrors.push('Ready measurement gate requires productionRef to match implementationRef.');
    }
  }
  if (['ready-to-observe', 'observing'].includes(cohort?.status) && gate?.state !== 'ready') {
    semanticErrors.push(`${cohort.status} status requires measurementGate.state=ready.`);
  }
  if (cohort?.status === 'measurement-hold' && gate?.state !== 'hold') {
    semanticErrors.push('measurement-hold status requires measurementGate.state=hold.');
  }
  if (cohort?.sourceEvidence?.repositoryRef && gate?.implementationRef && cohort.sourceEvidence.repositoryRef !== gate.implementationRef) {
    semanticErrors.push('sourceEvidence.repositoryRef must equal measurementGate.implementationRef for a frozen implementation cohort.');
  }

  if (gate?.state === 'hold' && gate?.productionRef && gate.productionRef === gate.implementationRef) {
    warnings.push('Measurement gate is HOLD even though productionRef matches implementationRef; preserve HOLD only when another documented gate remains.');
  }
  if (treatment.length < 10 || control.length < 5) {
    warnings.push('Small cohort: interpret directional outcomes cautiously and preserve raw page/query evidence.');
  }

  return {
    valid: schemaValid && semanticErrors.length === 0,
    errors: validate.errors ?? [],
    semanticErrors,
    warnings
  };
}

export function evaluateMeasurementGate(cohort, observedProductionRef) {
  const validation = validateControlledCohort(cohort);
  if (!validation.valid) throw new Error('Cannot evaluate measurement gate for an invalid controlled cohort.');
  if (typeof observedProductionRef !== 'string' || !/^[a-f0-9]{40}$/.test(observedProductionRef)) {
    throw new Error('observedProductionRef must be an exact 40-character lowercase Git commit SHA.');
  }

  const implementationRef = cohort.measurementGate.implementationRef;
  const ready = observedProductionRef === implementationRef;
  return {
    cohortId: cohort.id,
    implementationRef,
    observedProductionRef,
    ready,
    nextState: ready ? 'ready-to-observe' : 'measurement-hold',
    observationClockMayStart: ready,
    reason: ready
      ? 'Observed production ref matches the frozen implementation ref. The declared observation windows may start from the independently verified deployment time.'
      : 'Observed production ref does not match the frozen implementation ref. Keep the cohort on HOLD and do not attribute live outcomes to the treatment.'
  };
}

export function summarizeControlledCohort(cohort) {
  const validation = validateControlledCohort(cohort);
  if (!validation.valid) {
    const messages = [
      ...validation.semanticErrors,
      ...validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`)
    ];
    throw new Error(`Invalid controlled cohort: ${messages.join('; ')}`);
  }

  const targetedEntities = new Set();
  for (const query of cohort.queryPanel.queries) {
    for (const entity of query.targetEntities) targetedEntities.add(entity);
  }

  return {
    version: cohort.version,
    id: cohort.id,
    site: cohort.site,
    repository: cohort.repository,
    frozenAt: cohort.frozenAt,
    status: cohort.status,
    treatmentCount: cohort.treatment.length,
    controlCount: cohort.control.length,
    queryCount: cohort.queryPanel.queries.length,
    queryTargetEntityCount: targetedEntities.size,
    measurementGate: cohort.measurementGate.state,
    implementationRef: cohort.measurementGate.implementationRef,
    productionRef: cohort.measurementGate.productionRef ?? null,
    observationWindowsDays: cohort.observationWindowsDays,
    warnings: validation.warnings
  };
}

export function formatControlledCohortSummary(summary) {
  return [
    `Goose Controlled Cohort ${summary.version}`,
    `ID: ${summary.id}`,
    `Site: ${summary.site}`,
    `Status: ${summary.status}`,
    `Treatment/control: ${summary.treatmentCount}/${summary.controlCount}`,
    `Frozen queries: ${summary.queryCount} targeting ${summary.queryTargetEntityCount} entities`,
    `Measurement gate: ${summary.measurementGate}`,
    `Implementation: ${summary.implementationRef}`,
    `Production: ${summary.productionRef || 'unknown'}`,
    `Windows: ${summary.observationWindowsDays.join(', ')} days`
  ].join('\n');
}
