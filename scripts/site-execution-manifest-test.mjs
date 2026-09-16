import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SURFACE_STATES } from '../lib/surface-integrity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const manifestPath = 'registry/site-execution-manifest.json';
const schemaPath = 'schema/site-execution-manifest.schema.json';
const auditPath = 'registry/comprehensive-site-audit.json';
const skillIndexPath = 'skills/index.json';

for (const relativePath of [manifestPath, schemaPath, auditPath, skillIndexPath, 'lib/surface-integrity.mjs']) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `site execution dependency must exist: ${relativePath}`);
}

const manifest = readJson(manifestPath);
const schema = readJson(schemaPath);
const audit = readJson(auditPath);
const skillIndex = readJson(skillIndexPath);

assert.equal(manifest.version, '0.1');
assert.equal(manifest.defaultOrchestrator, 'arwp-prepare-site');
assert.equal(manifest.sources.auditDomains, auditPath);
assert.equal(manifest.sources.skillIndex, skillIndexPath);
assert.equal(manifest.sources.surfaceIntegrityEngine, 'lib/surface-integrity.mjs');
assert.equal(manifest.sources.surfaceIntegritySchema, 'schema/surface-integrity-contract.schema.json');
assert.deepEqual(manifest.statusVocabulary, [...SURFACE_STATES], 'site execution states must reuse Surface Integrity vocabulary exactly');
assert.deepEqual(manifest.applicabilityVocabulary, ['required', 'optional', 'not-applicable', 'unknown']);
assert.deepEqual(manifest.evidenceClasses, ['deterministic', 'heuristic', 'runtime', 'owner-platform']);
assert.ok(manifest.principles.some(value => /check is not a skill boundary/i.test(value)), 'manifest must preserve check != skill boundary');
assert.ok(manifest.principles.some(value => /Surface Integrity/i.test(value)), 'manifest must require final Surface Integrity reconciliation');

const expectedStages = ['inspect', 'inventory', 'applicability', 'execute', 'repair', 'verify', 're-audit', 'surface-integrity', 'receipt'];
assert.deepEqual(manifest.stages.map(stage => stage.id), expectedStages, 'site execution stage order changed; review orchestration intentionally');
for (const stage of manifest.stages) {
  assert.equal(stage.required, true, `execution stage ${stage.id} must remain required`);
  assert.ok(stage.outputs?.length, `execution stage ${stage.id} must declare outputs`);
}

const moduleIds = manifest.modules.map(module => module.id);
assert.equal(new Set(moduleIds).size, moduleIds.length, 'execution module IDs must be unique');
assert.ok(manifest.modules.length >= 10, 'site execution must remain multi-domain rather than collapsing into one generic pass');

const auditDomainIds = (audit.auditDomains || []).map(domain => domain.id);
const ownership = new Map(auditDomainIds.map(id => [id, []]));
const indexedSkillNames = new Set((skillIndex.skills || []).map(skill => skill.name));
assert.ok(indexedSkillNames.has(manifest.defaultOrchestrator), 'default orchestrator must exist in skills/index.json');

for (const module of manifest.modules) {
  assert.equal(module.defaultExecutor, manifest.defaultOrchestrator, `${module.id} must default to the site orchestrator`);
  assert.ok(module.auditDomains?.length, `${module.id} must own at least one audit domain`);
  assert.ok(module.evidenceClasses?.length, `${module.id} must declare evidence classes`);
  for (const evidenceClass of module.evidenceClasses) {
    assert.ok(manifest.evidenceClasses.includes(evidenceClass), `${module.id} uses unknown evidence class ${evidenceClass}`);
  }
  for (const domainId of module.auditDomains) {
    assert.ok(ownership.has(domainId), `${module.id} references unknown audit domain ${domainId}`);
    ownership.get(domainId).push(module.id);
  }
  for (const skill of module.specialistSkills || []) {
    assert.ok(indexedSkillNames.has(skill), `${module.id} references missing specialist skill ${skill}`);
    assert.notEqual(skill, manifest.defaultOrchestrator, `${module.id} must not list the orchestrator as a specialist`);
  }
}

for (const [domainId, owners] of ownership) {
  assert.equal(owners.length, 1, `audit domain ${domainId} must have exactly one execution-module owner, found: ${owners.join(', ') || 'none'}`);
}

for (const requiredField of ['moduleId', 'applicability', 'reason', 'state', 'evidenceClasses', 'evidence', 'findings', 'verification', 'remediation']) {
  assert.ok(manifest.applicabilityMatrix.requiredFields.includes(requiredField), `applicability matrix must retain ${requiredField}`);
}
for (const phrase of ['every module has a row', 'not-applicable', 'specialist output contributes evidence']) {
  assert.ok(manifest.applicabilityMatrix.fullClaimRules.some(value => value.includes(phrase)), `full-claim rules must retain: ${phrase}`);
}

for (const stageId of ['execute', 'repair', 'verify', 're-audit', 'surface-integrity']) {
  assert.ok(manifest.repairLoop.sequence.includes(stageId), `repair loop must retain ${stageId}`);
}
assert.ok(manifest.repairLoop.repeatWhen.some(value => /fail\/missing\/stale\/incomplete/i.test(value)), 'repair loop must repeat on resolvable blocking states');
assert.ok(manifest.completion.requires.some(value => /applicability matrix/i.test(value)), 'completion must require the applicability matrix');
assert.ok(manifest.completion.requires.some(value => /Surface Integrity/i.test(value)), 'completion must require Surface Integrity');
assert.ok(manifest.completion.forbids.some(value => /silently skipped modules/i.test(value)), 'completion must forbid silent module omission');

assert.equal(schema.properties?.version?.const, manifest.version, 'manifest schema version must match manifest version');
for (const field of ['stages', 'modules', 'skillPolicy', 'applicabilityMatrix', 'repairLoop', 'completion']) {
  assert.ok(schema.required?.includes(field), `manifest schema must require ${field}`);
}
assert.equal(schema.properties?.defaultOrchestrator?.const, manifest.defaultOrchestrator, 'schema must pin the default orchestrator');

assert.equal(manifest.conditionalPacks.source, `${auditPath}#/conditionalPacks`);
assert.ok(manifest.skillPolicy.createNewSkillOnlyWhen?.length >= 3, 'skill creation must have explicit gates');
assert.ok(manifest.skillPolicy.doNotCreateSkillFor?.some(value => /checklist item/i.test(value)), 'skill policy must reject checklist-item skills');
assert.match(manifest.skillPolicy.compositionRule, /Add a skill only when the reusable workflow itself is a product boundary/i);

console.log(`PASS site execution manifest: ${manifest.modules.length} modules own ${auditDomainIds.length} audit domains with ${indexedSkillNames.size} indexed skills and explicit applicability/repair/Surface Integrity gates`);
