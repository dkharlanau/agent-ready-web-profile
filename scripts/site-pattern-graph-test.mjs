import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  buildPatternLearningSignals,
  buildSitePatternActions,
  loadSitePatternCatalogs,
  loadSitePatternMap,
  summarizePatternPortfolio,
  validateSitePatternMap
} from '../lib/site-pattern-graph.mjs';

const catalogs = loadSitePatternCatalogs(process.cwd());
const practice = catalogs.discoverability.tactics[0];
const anti = catalogs.antiPatterns.anti_patterns[0];
assert.ok(practice?.id && anti?.id, 'canonical catalogs need at least one practice and anti-pattern');

const schema = JSON.parse(fs.readFileSync('schema/site-pattern-map-v0.1.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const schemaCheck = value => {
  const valid = validateSchema(value);
  return { valid, errors: valid ? [] : validateSchema.errors.map(row => `${row.instancePath || '/'} ${row.message}`) };
};

const now = '2026-09-09T06:00:00Z';
const evidence = summary => [{ type: 'manual-review', locator: 'fixture', observedAt: now, summary }];
const map = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-pattern-map-v0.1.schema.json',
  version: '0.1',
  generatedAt: now,
  site: { canonicalUrl: 'https://example.com/', repository: 'example/site', siteFocusPath: '.arwp/site-focus.json', siteFocusVersion: '0.3' },
  catalogs: {
    discoverability: { version: catalogs.discoverability.version, path: 'knowledge/discoverability-corpus.json' },
    antiPatterns: { version: catalogs.antiPatterns.version, path: 'knowledge/research/anti-patterns.json' }
  },
  coverage: { mode: 'sample', routesKnown: null, routesObserved: 1, note: 'Fixture observes one route only.' },
  instances: [
    {
      id: 'spi_practice_fixture',
      kind: 'practice',
      pattern: { id: practice.id, version: practice.pattern_version ?? '1.0.0' },
      target: { scope: 'route', value: '/' },
      applicability: 'applicable',
      verdict: 'present',
      basis: 'manual-reviewed',
      evidence: evidence('Practice observed in fixture.'),
      falsePositiveBoundaryReviewed: false,
      remediation: { state: 'none' },
      outcomes: []
    },
    {
      id: 'spi_anti_fixture',
      kind: 'anti-pattern',
      pattern: { id: anti.id, version: anti.version },
      target: { scope: 'route', value: '/' },
      applicability: 'applicable',
      verdict: 'absent',
      basis: 'manual-reviewed',
      evidence: evidence('Reviewer checked the catalog boundary and did not observe this anti-pattern on the fixture route.'),
      falsePositiveBoundaryReviewed: true,
      remediation: { state: 'none' },
      outcomes: []
    },
    {
      id: 'spi_candidate_fixture',
      kind: 'practice',
      pattern: { id: practice.id, version: practice.pattern_version ?? '1.0.0' },
      target: { scope: 'page-type', value: 'article' },
      applicability: 'unknown',
      verdict: 'unknown',
      basis: 'heuristic-candidate',
      evidence: [],
      falsePositiveBoundaryReviewed: false,
      remediation: { state: 'none' },
      outcomes: []
    }
  ],
  relations: [
    { from: 'spi_practice_fixture', to: 'spi_candidate_fixture', type: 'prerequisite-for', rationale: 'The observed foundation is reviewed before the candidate is considered.' }
  ],
  knownUnknowns: ['Search ranking and AI citation outcomes are not measured by this fixture.']
};

const fixtureSchema = schemaCheck(map);
assert.equal(fixtureSchema.valid, true, fixtureSchema.errors.join('\n'));
const valid = validateSitePatternMap(map, catalogs);
assert.equal(valid.valid, true, valid.errors.join('\n'));
assert.equal(valid.summary.practicePresent, 1);
assert.equal(valid.summary.antiPatternAbsent, 1);
assert.equal(valid.summary.unknown, 1);
assert.ok(valid.fingerprint.startsWith('sha256:'));
assert.equal(buildSitePatternActions(map).filter(row => row.action === 'review').length, 1);

const heuristicVerdict = structuredClone(map);
heuristicVerdict.instances[2].verdict = 'present';
heuristicVerdict.instances[2].evidence = evidence('A heuristic string match.');
assert.equal(validateSitePatternMap(heuristicVerdict, catalogs).valid, false);
assert.ok(validateSitePatternMap(heuristicVerdict, catalogs).errors.some(error => error.includes('heuristic candidates')));

const automatedAnti = structuredClone(map);
automatedAnti.instances[1].verdict = 'present';
automatedAnti.instances[1].basis = 'deterministic';
assert.equal(validateSitePatternMap(automatedAnti, catalogs).valid, false);
assert.ok(validateSitePatternMap(automatedAnti, catalogs).errors.some(error => error.includes('manual-required')));

const brokenRelation = structuredClone(map);
brokenRelation.relations[0].to = 'spi_missing';
assert.equal(validateSitePatternMap(brokenRelation, catalogs).valid, false);

const causalOutcome = structuredClone(map);
causalOutcome.instances[0].outcomes = [{ metric: 'traffic', before: 10, after: 20, observationWindow: '7d before/after', source: 'fixture', interpretation: 'Descriptive only.', causalClaim: true }];
assert.equal(schemaCheck(causalOutcome).valid, false, 'schema must reject causalClaim=true');
assert.equal(validateSitePatternMap(causalOutcome, catalogs).valid, false);
assert.ok(validateSitePatternMap(causalOutcome, catalogs).errors.some(error => error.includes('causalClaim')));

const portfolio = summarizePatternPortfolio([map, structuredClone(map)]);
assert.equal(portfolio.sites.length, 1);
assert.equal(portfolio.patterns.find(row => row.patternId === anti.id).absent, 2);
assert.match(portfolio.scope, /not causal evidence/i);

const observedA = structuredClone(map);
const observedB = structuredClone(map);
observedA.site.canonicalUrl = 'https://alpha.example/';
observedB.site.canonicalUrl = 'https://beta.example/';
for (const candidate of [observedA, observedB]) {
  candidate.instances[0].verdict = 'absent';
  candidate.instances[0].evidence = evidence('Applicable practice reviewed as absent on the sampled route.');
  candidate.instances[1].verdict = 'present';
  candidate.instances[1].evidence = evidence('Anti-pattern confirmed after false-positive boundary review.');
  candidate.instances[1].remediation = { state: 'verified', action: 'Applied bounded correction.', receiptId: `sfr_${candidate.site.canonicalUrl.includes('alpha') ? 'alpha' : 'beta'}_fixture` };
}
const learning = buildPatternLearningSignals([observedA, observedB]);
assert.equal(learning.sitesObserved, 2);
assert.match(learning.scope, /do not infer ranking factors/i);
assert.ok(learning.signals.some(row => row.type === 'repeated-practice-gap' && row.patternId === practice.id));
assert.ok(learning.signals.some(row => row.type === 'evidence-gap' && row.patternId === practice.id));
assert.ok(learning.signals.some(row => row.type === 'repeated-anti-pattern' && row.patternId === anti.id));
assert.ok(learning.signals.some(row => row.type === 'measurement-debt' && row.patternId === anti.id));
assert.ok(learning.signals.every(row => row.causalClaim === false));
assert.throws(() => buildPatternLearningSignals([observedA], { minRepeat: 1 }), /minRepeat/);

for (const file of ['docs/examples/site-pattern-map-v0.1.json', '.arwp/site-pattern-map.json']) {
  if (!fs.existsSync(file)) continue;
  const candidate = loadSitePatternMap(file);
  const candidateSchema = schemaCheck(candidate);
  assert.equal(candidateSchema.valid, true, `${file} schema invalid:\n${candidateSchema.errors.join('\n')}`);
  const candidateResult = validateSitePatternMap(candidate, loadSitePatternCatalogs(process.cwd(), candidate));
  assert.equal(candidateResult.valid, true, `${file} runtime invalid:\n${candidateResult.errors.join('\n')}`);
}

console.log('PASS Site Pattern Graph v0.1 schema/runtime invariants, catalog binding, manual anti-pattern boundary, non-causal outcomes, portfolio aggregation and learning signals');
