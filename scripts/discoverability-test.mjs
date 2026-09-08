import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadCorpus, validateCorpus, validateCorpusMappings, loadDiscoverabilityRegistries, searchTactics, createAdoptionPlan, validateEditorialReceipt, validateCorpusVersioning, validateReleaseBytes, loadPreviousDiscoverabilityRelease, corpusFingerprint, DISCOVERABILITY_RELEASES } from '../lib/discoverability.mjs';

const corpus = loadCorpus();
for (const tactic of corpus.tactics) if (tactic.review.reviewed_at !== null) assert.ok(Array.isArray(tactic.review.support) && tactic.review.support.length > 0, `${tactic.id}: shipped individual reviews expose a public source locator and bounded support note.`);
if (process.argv.includes('--site')) {
  const published = new URL('../docs/knowledge/discoverability-corpus.json', import.meta.url);
  assert.deepEqual(JSON.parse(fs.readFileSync(published, 'utf8')), corpus, 'Publish the actual current corpus in the Pages artifact. Run build:discoverability after corpus changes.');
  const page = fs.readFileSync(new URL('../docs/discoverability.html', import.meta.url), 'utf8');
  for (const tactic of corpus.tactics) assert.ok(page.includes(`id="${tactic.id}"`), `${tactic.id} must be accessible without client-side data fetching.`);
  for (const source of corpus.sources) assert.ok(page.includes(`id="source-${source.id}"`), `Source anchor missing: ${source.id}`);
  for (const name of ['article', 'comparison']) {
    const receipt = JSON.parse(fs.readFileSync(new URL(`../examples/editorial/${name}.receipt.json`, import.meta.url), 'utf8'));
    assert.equal(validateEditorialReceipt(receipt).valid, true);
    const html = fs.readFileSync(new URL(`../docs/examples/editorial/${name}.html`, import.meta.url), 'utf8');
    assert.ok(/noindex/.test(html), 'Fictional examples remain explicitly excluded from indexing.');
    for (const claim of receipt.claims) assert.ok(html.includes(`id="${claim.anchor}"`), `${name}: claim anchor ${claim.anchor} is absent from emitted HTML.`);
  }
}
assert.ok(corpus.tactics.length > 100, 'The product needs a substantive corpus, not a small checklist.');
for (const category of corpus.categories) assert.ok(corpus.tactics.some(t => t.category === category.id));
const first = corpus.tactics[0];
const selection = searchTactics(corpus, { search: first.id, limit: 1 });
assert.equal(selection.tactics[0].id, first.id);
assert.deepEqual(new Set(selection.sources.map(s => s.id)), new Set(first.source_ids));
for (const level of ['documented', 'inferred', 'experimental']) {
  const result = searchTactics(corpus, { evidence: level, limit: 500 });
  assert.ok(result.tactics.every(t => t.evidence_level === level));
}
assert.throws(() => searchTactics(corpus, { category: 'missing-category' }), /Unknown category/);
assert.throws(() => searchTactics(corpus, { limit: 1.5 }), /integer/);
assert.equal(searchTactics(corpus, { search: 'unfindable-string-8932' }).total, 0);
for (const mutate of [c => { c.tactics[0].source_ids = ['missing']; }, c => { c.tactics.push(c.tactics[0]); }, c => { c.sources[0].checked_at = '2026-02-30'; }]) {
  const changed = structuredClone(corpus); mutate(changed); assert.equal(validateCorpus(changed).valid, false);
}
assert.equal(validateCorpus(null).valid, false);
assert.equal(validateCorpus({ categories: 'bad' }).valid, false);
assert.equal(validateCorpus({ version: '1', updated_at: '2026-09-08', categories: [], sources: [], tactics: [] }).valid, false);

const registries = loadDiscoverabilityRegistries();
assert.equal(validateCorpusMappings(corpus, registries).valid, true);
const previousRelease = loadPreviousDiscoverabilityRelease(corpus.previous_release);
const legacyBytes = fs.readFileSync(new URL('../knowledge/releases/v1.1.0.json', import.meta.url));
const legacyRelease = validateReleaseBytes(legacyBytes, { version: '1.1.0', path: 'knowledge/releases/v1.1.0.json', sha256: DISCOVERABILITY_RELEASES['1.1.0'] });
assert.equal(legacyRelease.valid, true);
assert.equal(legacyRelease.corpus.tactics.length, 144, 'The immutable 1.1.0 baseline has 144 published patterns.');
for (const prior of legacyRelease.corpus.tactics) {
  const current = corpus.tactics.find(t => t.id === prior.id);
  assert.ok(current, `Preserve the published stable ID ${prior.id}; new patterns are welcome.`);
  if (corpus.previous_release.version === '1.1.0') for (const field of ['evidence_level', 'growth_hypothesis_ids', 'recommendation_rule_ids']) assert.deepEqual(current[field], prior[field], `${prior.id}: passport adoption must preserve its existing native evidence class and routing.`);
}
const baseline = corpus.tactics.find(t => t.id === 'arwp-measurement-baseline');
assert.ok(baseline.growth_hypothesis_ids.includes('platform-ai-measurement'));
assert.ok(baseline.recommendation_rule_ids.includes('google-generative-ai-measurement'));
assert.ok(baseline.source_ids.includes('google-generative-ai-report'), 'Dedicated owner-side reporting must have its own current primary source.');
assert.ok(corpus.tactics.find(t => t.id === 'arwp-access-searchbot').growth_hypothesis_ids.includes('chatgpt-search-access'));
assert.ok(corpus.tactics.find(t => t.id === 'arwp-retrieval-stable-fragments').recommendation_rule_ids.includes('google-read-more-deep-links'));
assert.deepEqual(corpus.tactics.find(t => t.id === 'arwp-evidence-evidence-attrs').recommendation_rule_ids, [], 'Private evidence attributes must not be promoted into a platform recommendation.');
for (const mutate of [
  c => { c.tactics[0].growth_hypothesis_ids = ['invented-hypothesis']; },
  c => { c.tactics[0].recommendation_rule_ids = ['invented-rule']; },
  c => { c.tactics[0].growth_hypothesis_ids = []; },
  c => { c.tactics[0].recommendation_rule_ids = null; },
  c => { c.tactics[0].growth_hypothesis_ids.push(c.tactics[0].growth_hypothesis_ids[0]); }
]) {
  const changed = structuredClone(corpus); mutate(changed);
  assert.equal(validateCorpusMappings(changed).valid, false);
}
const removedHypothesis = structuredClone(registries);
removedHypothesis.hypotheses.hypotheses = removedHypothesis.hypotheses.hypotheses.filter(h => h.id !== 'search-foundation-first');
assert.equal(validateCorpusMappings(corpus, removedHypothesis).valid, false, 'Native registry removal must break stale corpus routing rather than silently continue.');
const measured = searchTactics(corpus, { hypothesis: 'platform-ai-measurement', rule: 'google-generative-ai-measurement', limit: 500 });
assert.ok(measured.tactics.some(t => t.id === baseline.id));
assert.ok(measured.tactics.every(t => t.growth_hypothesis_ids.includes('platform-ai-measurement') && t.recommendation_rule_ids.includes('google-generative-ai-measurement')));
assert.throws(() => searchTactics(corpus, { hypothesis: 'invented' }), /Unknown growth hypothesis/);
assert.throws(() => searchTactics(corpus, { rule: 'invented' }), /Unknown recommendation rule/);

const config = { site_url: 'https://example.com/project/', audience: 'Maintainers', useful_action: 'Run the example', tactic_ids: [first.id], page_urls: ['https://example.com/project/guide/'] };
const plan = createAdoptionPlan(config, corpus);
assert.equal(plan.stage, 'planned');
assert.equal(plan.deployed_at, null);
assert.equal(plan.baseline.search, 'not_measured');
assert.match(plan.corpus_sha256, /^[a-f0-9]{64}$/);
assert.equal(plan.tasks[0].status, 'planned');
assert.equal(plan.tactic_versions[first.id], first.pattern_version);
assert.deepEqual(plan.tasks[0].review, first.review);
assert.deepEqual(plan.tasks[0].lifecycle, first.lifecycle);
assert.equal(plan.growth_loop.kind, 'practice-selection');
assert.deepEqual(plan.growth_loop.hypothesis_ids, first.growth_hypothesis_ids);
assert.deepEqual(plan.growth_loop.recommendation_rule_ids, first.recommendation_rule_ids);
const priorStep = first.implementation[0];
plan.tasks[0].implementation[0] = 'An owner edits their selected task.';
assert.equal(first.implementation[0], priorStep, 'Editing a plan must not mutate the canonical corpus used by subsequent plans.');
assert.throws(() => createAdoptionPlan({ ...config, tactic_ids: ['unknown'] }, corpus), /Unknown tactic/);
assert.throws(() => createAdoptionPlan({ ...config, tactic_ids: [first.id, first.id] }, corpus), /unique/);
for (const url of ['https://example.com/project-other/', 'https://other.example/project/', 'http://example.com/project/']) assert.throws(() => createAdoptionPlan({ ...config, page_urls: [url] }, corpus));
assert.throws(() => createAdoptionPlan({ ...config, site_url: 'https://user:secret@example.com/' }, corpus));

const pinnedConfig = { ...config, corpus_version: corpus.version, corpus_sha256: corpusFingerprint(corpus), tactic_versions: { [first.id]: first.pattern_version } };
assert.equal(createAdoptionPlan(pinnedConfig, corpus).corpus_sha256, corpusFingerprint(corpus));
for (const pins of [
  { corpus_version: previousRelease.version }, { corpus_version: null }, { corpus_version: '01.2.0' },
  { corpus_sha256: '0'.repeat(64) }, { corpus_sha256: null },
  { tactic_versions: {} }, { tactic_versions: [] }, { tactic_versions: null },
  { tactic_versions: { [first.id]: '0.0.1' } },
  { tactic_versions: { [first.id]: first.pattern_version, invented: '1.0.0' } }
]) assert.throws(() => createAdoptionPlan({ ...config, ...pins }, corpus), /pin|tactic_versions/);

const historyBytes = fs.readFileSync(new URL(`../${corpus.previous_release.path}`, import.meta.url));
assert.equal(validateReleaseBytes(historyBytes, corpus.previous_release).valid, true);
assert.equal(corpus.previous_release.sha256, DISCOVERABILITY_RELEASES[corpus.previous_release.version]);
assert.equal(validateReleaseBytes(Buffer.concat([historyBytes, Buffer.from('\n')]), corpus.previous_release).valid, false, 'Even a byte-only change to a released artifact violates its historical checksum.');
assert.equal(validateReleaseBytes(historyBytes, { ...corpus.previous_release, sha256: '0'.repeat(64) }).valid, false, 'A caller cannot replace the code-reviewed checksum anchor.');
assert.throws(() => loadPreviousDiscoverabilityRelease({ ...corpus.previous_release, path: '../package.json' }), /path/);
const missingHistory = structuredClone(corpus); missingHistory.previous_release.version = '9.9.9';
assert.equal(validateCorpus(missingHistory).valid, false);

const nextVersion = (version, kind) => {
  const [major, minor, patch] = version.split('.').map(Number);
  return kind === 'major' ? `${major + 1}.0.0` : kind === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
};
const changedPattern = structuredClone(corpus);
changedPattern.version = nextVersion(corpus.version, 'minor');
changedPattern.tactics[0].implementation.push('A newly required implementation step.');
assert.ok(validateCorpusVersioning(changedPattern, corpus).errors.some(e => /minor pattern_version bump/.test(e)), 'Changing the actual instructions with an unchanged version must fail.');
changedPattern.tactics[0].pattern_version = nextVersion(first.pattern_version, 'patch');
assert.equal(validateCorpusVersioning(changedPattern, corpus).valid, false, 'An operational change needs more than a review-only patch.');
changedPattern.tactics[0].pattern_version = nextVersion(first.pattern_version, 'minor');
assert.equal(validateCorpusVersioning(changedPattern, corpus).valid, true, 'A compatible instruction addition plus corresponding pattern and corpus minor bumps is accepted.');
changedPattern.version = corpus.version;
assert.ok(validateCorpusVersioning(changedPattern, corpus).errors.some(e => /Corpus version requires/.test(e)));

const addedPattern = structuredClone(corpus);
addedPattern.version = nextVersion(corpus.version, 'minor');
addedPattern.tactics.push({ ...structuredClone(first), id: 'arwp-test-new-pattern', title: 'Distinct new pattern', pattern_version: '1.0.0', review: { reviewed_at: corpus.updated_at, scope: 'source-support-and-implementation', method: 'agent-assisted' } });
assert.equal(validateCorpusVersioning(addedPattern, corpus).valid, true, 'Release validation permits new stable IDs; it does not enforce a frozen 144-item inventory.');
addedPattern.version = nextVersion(corpus.version, 'patch');
assert.equal(validateCorpusVersioning(addedPattern, corpus).valid, false, 'Adding a new pattern requires a corpus minor version.');
addedPattern.version = nextVersion(corpus.version, 'minor');
addedPattern.tactics.at(-1).review = { reviewed_at: null, scope: 'not-individually-reviewed', method: null };
assert.ok(validateCorpusVersioning(addedPattern, corpus).errors.some(e => /newly published pattern needs/.test(e)), 'The legacy unknown-review allowance does not justify publishing unreviewed new guidance.');

const changedReview = structuredClone(corpus);
changedReview.version = nextVersion(corpus.version, 'patch');
changedReview.tactics[0].review = first.review.reviewed_at === null
  ? { reviewed_at: corpus.updated_at, scope: 'source-support-and-implementation', method: 'agent-assisted' }
  : { reviewed_at: null, scope: 'not-individually-reviewed', method: null };
assert.ok(validateCorpusVersioning(changedReview, corpus).errors.some(e => /patch pattern_version bump/.test(e)));
changedReview.tactics[0].pattern_version = nextVersion(first.pattern_version, 'patch');
assert.equal(validateCorpusVersioning(changedReview, corpus).valid, true);

const retired = structuredClone(corpus);
retired.version = nextVersion(corpus.version, 'major');
retired.tactics[0].pattern_version = nextVersion(first.pattern_version, 'major');
retired.tactics[0].lifecycle = { status: 'retired', replacement_ids: [corpus.tactics[1].id], reason: 'The former implementation is superseded.' };
assert.equal(validateCorpusVersioning(retired, corpus).valid, true);
assert.throws(() => createAdoptionPlan(config, retired), /retired/);
retired.tactics.shift();
assert.ok(validateCorpusVersioning(retired, corpus).errors.some(e => /stable IDs/.test(e)), 'Major releases still retain retired IDs and their explanation.');

for (const mutate of [
  c => { c.tactics[0].review = { reviewed_at: '2026-02-30', scope: 'source-support-and-implementation', method: 'agent-assisted' }; },
  c => { c.tactics[0].review = { reviewed_at: '2099-01-01', scope: 'source-support-and-implementation', method: 'agent-assisted' }; },
  c => { c.tactics[0].review = { reviewed_at: null, scope: 'source-support-and-implementation', method: 'human' }; },
  c => { c.tactics[0].review = { reviewed_at: corpus.updated_at, scope: 'source-support-and-implementation', method: 'agent-assisted', support: [{ source_id: 'unknown', locator: 'Section', note: 'Bounded support.' }] }; },
  c => { c.tactics[0].review = { reviewed_at: corpus.updated_at, scope: 'source-support-and-implementation', method: 'agent-assisted', support: [{ source_id: first.source_ids[0], locator: '', note: 'Bounded support.' }] }; },
  c => { c.tactics[0].review = { reviewed_at: null, scope: 'not-individually-reviewed', method: null, support: [] }; },
  c => { c.tactics[0].pattern_version = '1.01.0'; },
  c => { c.sources[0].upstream = { kind: 'living-document', version: 'latest' }; },
  c => { c.sources[0].upstream = { kind: 'versioned-release', version: null }; },
  c => { c.sources[0].upstream = { kind: 'versioned-release', version: 'latest' }; },
  c => { c.tactics[0].lifecycle = { status: 'retired', replacement_ids: ['unknown'], reason: 'Superseded.' }; }
]) { const changed = structuredClone(corpus); mutate(changed); assert.equal(validateCorpus(changed).valid, false); }
const cyclic = structuredClone(corpus);
for (const [index, replacement] of [[0, 1], [1, 0]]) cyclic.tactics[index].lifecycle = { status: 'retired', replacement_ids: [cyclic.tactics[replacement].id], reason: 'Superseded.' };
assert.ok(validateCorpus(cyclic).errors.some(e => /cycle/.test(e)));
const foreignSupport = structuredClone(corpus);
foreignSupport.tactics[0].review = { reviewed_at: corpus.updated_at, scope: 'source-support-and-implementation', method: 'agent-assisted', support: [{ source_id: corpus.sources.find(s => !first.source_ids.includes(s.id)).id, locator: 'Section', note: 'Support from an unrelated source.' }] };
assert.ok(validateCorpus(foreignSupport).errors.some(e => /referenced source_id/.test(e)), 'A source existing elsewhere in the catalog is not automatically support for this pattern.');
const duplicateSupport = structuredClone(corpus);
const trace = { source_id: first.source_ids[0], locator: 'A relevant section', note: 'The bounded source statement.' };
duplicateSupport.tactics[0].review = { reviewed_at: corpus.updated_at, scope: 'source-support-and-implementation', method: 'agent-assisted', support: [trace, trace] };
assert.ok(validateCorpus(duplicateSupport).errors.some(e => /duplicate review support/.test(e)));
const sourceDrift = structuredClone(corpus);
sourceDrift.version = nextVersion(corpus.version, 'minor');
sourceDrift.sources.find(s => s.id === first.source_ids[0]).notes += ' A materially changed source support boundary.';
assert.ok(validateCorpusVersioning(sourceDrift, corpus).errors.some(e => e.startsWith(`${first.id}:`) && /minor/.test(e)), 'A changed supporting source cannot silently retain dependent pattern versions.');

const receipt = {
  page_url: 'https://example.com/guide/', reviewed_at: '2026-09-08', audience: 'Maintainers', question: 'How do I check a claim?',
  direct_answer: 'Attach a source with its scope.', original_contribution: 'A worked trace from sentence to source.', useful_action: 'Check one source.',
  sources: [{ id: 's1', url: 'https://example.org/source', checked_at: '2026-09-08', support: 'The cited section states the requirement.' }],
  claims: [{ id: 'c1', text: 'A checkable factual claim.', anchor: 'claim-one', evidence_level: 'documented', source_ids: ['s1'] }]
};
assert.equal(validateEditorialReceipt(receipt).valid, true);
assert.equal(validateEditorialReceipt({ ...receipt, claims: [{ ...receipt.claims[0], source_ids: ['missing'] }] }).valid, false);
assert.equal(validateEditorialReceipt({ ...receipt, comparison: { criteria: ['Cost'], methodology: 'Same workload', as_of: '2026-09-08', products: [{ name: 'A' }, { name: 'B' }] } }).valid, false);
assert.equal(validateEditorialReceipt(null).valid, false);

const cli = new URL('../bin/arwp.mjs', import.meta.url).pathname;
const queried = JSON.parse(execFileSync(process.execPath, [cli, 'discoverability', '--search', first.id, '--json'], { encoding: 'utf8' }));
assert.ok(queried.tactics.some(t => t.id === first.id));
const routed = JSON.parse(execFileSync(process.execPath, [cli, 'discoverability', '--hypothesis=platform-ai-measurement', '--rule=google-generative-ai-measurement', '--json'], { encoding: 'utf8' }));
assert.ok(routed.tactics.some(t => t.id === baseline.id));
const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
assert.match(help, /arwp audit <https:\/\/site.example>/, 'Keep the existing source-backed live audit command.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-discoverability-'));
try {
  const source = path.join(temp, 'adoption.json'); const output = path.join(temp, 'plan.json');
  fs.writeFileSync(source, JSON.stringify(config));
  execFileSync(process.execPath, [cli, 'adoption-plan', source, `--output=${output}`]);
  const original = fs.readFileSync(output, 'utf8');
  assert.equal(spawnSync(process.execPath, [cli, 'adoption-plan', source, `--output=${output}`]).status, 2);
  assert.equal(fs.readFileSync(output, 'utf8'), original, 'Existing plans must survive accidental reruns.');
  fs.writeFileSync(source, JSON.stringify({ ...pinnedConfig, corpus_version: previousRelease.version }));
  const rejectedOutput = path.join(temp, 'stale-plan.json');
  const rejected = spawnSync(process.execPath, [cli, 'adoption-plan', source, `--output=${rejectedOutput}`], { encoding: 'utf8' });
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /corpus_version/);
  assert.equal(fs.existsSync(rejectedOutput), false, 'A stale version pin fails before creating an output artifact.');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log(`PASS discoverability: ${corpus.tactics.length} tactics, native registry mappings, explicit selection, unmeasured outcomes and CLI overwrite protection${process.argv.includes('--site') ? ', with published corpus and editorial artifacts' : ' (add --site for published artifact checks)'}`);
