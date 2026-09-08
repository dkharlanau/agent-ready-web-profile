import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadCorpus, validateCorpus, validateCorpusMappings, loadDiscoverabilityRegistries, searchTactics, createAdoptionPlan, validateEditorialReceipt } from '../lib/discoverability.mjs';

const corpus = loadCorpus();
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
assert.equal(corpus.tactics.length, 144, 'Preserve all existing portable tactic IDs.');
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
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log(`PASS discoverability: ${corpus.tactics.length} tactics, native registry mappings, explicit selection, unmeasured outcomes and CLI overwrite protection${process.argv.includes('--site') ? ', with published corpus and editorial artifacts' : ' (add --site for published artifact checks)'}`);
