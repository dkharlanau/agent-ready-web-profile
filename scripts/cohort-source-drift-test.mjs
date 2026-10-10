import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectCohortSourceDrift } from '../lib/cohort-source-drift.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = JSON.parse(fs.readFileSync(path.join(root,
  'knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-frozen-cohort-'));
const repository = path.join(temporary, 'checkout');
fs.mkdirSync(repository);
const git = (...args) => execFileSync('git', ['-C', repository, ...args], {
  encoding: 'utf8', timeout: 12000, stdio: ['ignore', 'pipe', 'pipe']
}).trim();
const write = (source, text) => {
  const destination = path.join(repository, source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, text, 'utf8');
};
const commit = (message) => {
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', message);
  return git('rev-parse', 'HEAD');
};

try {
  git('init', '-q', '-b', 'main');
  const cohort = structuredClone(original);
  const all = [...cohort.treatment, ...cohort.control];
  for (const member of all) write(member.source, 'Frozen ' + member.id + '\n');
  const frozen = commit('Frozen cohort source fixture');
  cohort.sourceEvidence.repositoryRef = frozen;
  cohort.measurementGate.implementationRef = frozen;
  cohort.measurementGate.productionRef = frozen;
  const initial = inspectCohortSourceDrift(cohort, { repoFolder: repository, afterRef: frozen });
  assert.equal(initial.summary.changedControls, 0);
  assert.equal(initial.summary.unchangedControls, 6);
  assert.equal(initial.summary.unchangedTreatments, 12);
  assert.equal(initial.reviewRequired, false, 'same committed source is not a source drift alert');
  assert.equal(initial.repositoryIdentity, 'no-origin-to-check');
  assert.equal(initial.publicationEvidence.state, 'not-provided');
  assert.deepEqual(initial.windows, []);
  assert.equal(initial.guardrails.sourceChangeIsNotLiveDeployment, true);

  for (const member of cohort.control.slice(1, 5)) write(member.source, 'Edited control ' + member.id + '\n');
  for (const member of cohort.treatment.filter(m => m.id !== 't10')) write(member.source, 'Edited treatment ' + member.id + '\n');
  write('content/not-in-cohort.md', 'Unrelated\n');
  const after = commit('Simulate later editorial changes');
  const diff = inspectCohortSourceDrift(cohort, { repoFolder: repository, afterRef: after });
  assert.equal(diff.summary.changedControls, 4);
  assert.equal(diff.summary.unchangedControls, 2);
  assert.equal(diff.summary.changedTreatments, 11);
  assert.equal(diff.summary.unchangedTreatments, 1);
  assert.equal(diff.reviewRequired, true);
  assert.equal(diff.windows.length, 0);
  assert.equal(diff.members.find(m => m.id === 'c02').state, 'source-changed');
  assert.equal(diff.members.find(m => m.id === 'c01').state, 'source-unchanged');
  assert.equal(diff.members.find(m => m.id === 't10').state, 'source-unchanged');
  assert.ok(diff.members.every(m => !('fileBody' in m)));
  assert.doesNotMatch(JSON.stringify(diff), new RegExp(temporary.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&')));
  assert.match(diff.nextAction, /dated observed publication receipts/);
  assert.equal(diff.measurementGateAtFreeze, 'ready');

  const events = {
    version: '0.1', cohortId: cohort.id, completeThrough: '2026-10-09',
    events: ['c02', 'c03', 'c04', 'c05'].map((id, index) => ({
      memberId: id,
      publishedOn: '2026-10-04',
      productionRef: after,
      kind: index === 1 ? 'redirect' : 'editorial',
      evidenceUrl: 'https://github.com/example/repository/pull/' + (10 + index)
    }))
  };
  const dated = inspectCohortSourceDrift(cohort, {
    repoFolder: repository, afterRef: after, deploymentDate: '2026-09-13', publicationEvents: events
  });
  assert.deepEqual(dated.windows.map(w => [w.days, w.startDate, w.endDate]), [
    [14, '2026-09-14', '2026-09-27'],
    [28, '2026-09-14', '2026-10-11'],
    [56, '2026-09-14', '2026-11-08']
  ]);
  assert.equal(dated.windows[0].interpretation, 'no-control-event-in-supplied-ledger');
  assert.equal(dated.windows[0].ownerLedgerState, 'owner-declared-through-window-end');
  assert.equal(dated.windows[1].interpretation, 'review-control-change');
  assert.equal(dated.windows[2].interpretation, 'review-control-change');
  assert.equal(dated.windows[1].ownerReportedControlEvents.length, 4);
  assert.equal(dated.windows[1].ownerLedgerState, 'partial-or-unbounded');
  assert.equal(dated.publicationEvidence.state, 'owner-declared-not-independently-authenticated');
  assert.equal(dated.publicationEvidence.recordedEvents, 4);
  assert.equal(dated.guardrails.noAutomaticCausalOutcome, true);
  assert.equal(dated.guardrails.frozenDesignUnmodified, true);
  assert.equal(cohort.control[1].id, 'c02', 'the frozen cohort must stay unchanged');

  const rejects = [
    [{...cohort, sourceEvidence: {...cohort.sourceEvidence, repositoryRef: '0'.repeat(40)}}, { repoFolder: repository, afterRef: after }],
    [cohort, {repoFolder: repository, afterRef: 'bad'}],
    [cohort, {repoFolder: repository, afterRef: after, publicationEvents: events}],
    [cohort, {repoFolder: repository, afterRef: after, deploymentDate:'2026-02-30'}],
    [cohort, {repoFolder: repository, afterRef: after, deploymentDate:'2026-09-13', publicationEvents: {...events, cohortId:'wrong'}}],
    [cohort, {repoFolder: repository, afterRef: after, deploymentDate:'2026-09-13', publicationEvents: {...events, completeThrough:'2026-10-03'}}],
    [cohort, {repoFolder: repository, afterRef: after, deploymentDate:'2026-09-13', publicationEvents: {...events, events: [...events.events, events.events[0]]}}],
    [cohort, {repoFolder: repository, afterRef: after, deploymentDate:'2026-09-13', publicationEvents: {...events, events:[{...events.events[0],memberId:'missing'}]}}],
    [cohort, {repoFolder: repository, afterRef: after, deploymentDate:'2026-09-13', publicationEvents: {...events, events:[{...events.events[0],evidenceUrl:'https://user:password@example.com'}]}}],
    [{...cohort, control: cohort.control.map((m, i) => i===0 ? {...m,source:'../outside'} : m)}, {repoFolder: repository,afterRef:after}]
  ];
  for (const [candidate, opts] of rejects) {
    assert.throws(() => inspectCohortSourceDrift(candidate, opts), Error,
      'invalid source, event, provenance or date must fail closed');
  }

  // A broken/missing checkout cannot be silently treated as an unchanged control.
  fs.rmSync(path.join(repository, cohort.control[0].source));
  const stillCommitted = inspectCohortSourceDrift(cohort, {repoFolder:repository,afterRef:after});
  assert.equal(stillCommitted.members.find(m => m.id === 'c01').state, 'source-unchanged',
    'uncommitted working-tree changes must never rewrite Git source comparison');
  git('remote', 'add', 'origin', 'https://github.com/someone/other-repo.git');
  assert.throws(() => inspectCohortSourceDrift(cohort, {repoFolder:repository,afterRef:after}),
    /origin disagrees/);
  git('remote', 'set-url', 'origin', 'git@github.com:dkharlanau/ptichi-site.git');
  const verifiedRepo = inspectCohortSourceDrift(cohort, {repoFolder:repository,afterRef:after});
  assert.equal(verifiedRepo.repositoryIdentity, 'github-origin-matches-cohort');

  // CLI: existing arwp-cohort command, no new package or orchestration layer.
  const fixturePath = path.join(temporary, 'cohort.json');
  const eventsPath = path.join(temporary, 'events.json');
  fs.writeFileSync(fixturePath, JSON.stringify(cohort));
  fs.writeFileSync(eventsPath, JSON.stringify(events));
  const cli = path.join(root, 'bin/arwp-cohort.mjs');
  const execute = (args) => spawnSync(process.execPath, [cli, 'source-drift', fixturePath, ...args], {
    cwd: root, encoding: 'utf8', timeout: 20000
  });
  const result = execute([
    '--repo=' + repository, '--after-ref=' + after,
    '--deployment-date=2026-09-13', '--events=' + eventsPath, '--json'
  ]);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.changedControls, 4);
  const clean = execute(['--repo=' + repository, '--after-ref=' + frozen, '--json']);
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(JSON.parse(clean.stdout).summary.unchangedControls, 6);
  const noRepo = execute(['--after-ref=' + after]);
  assert.equal(noRepo.status, 1);
  assert.match(noRepo.stderr, /requires --repo/);
  const help = spawnSync(process.execPath, [cli, '--help'], {encoding:'utf8',cwd:root});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /source-drift/);
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}

console.log('PASS frozen cohort source drift: 4/6 source controls, dated T14/T28/T56 review, provenance, strict fail-closed and CLI.');
