import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSource,
  buildRelease,
  releaseCsv,
  releaseHtml,
  indexHtml,
  methodologyHtml,
  releaseIndex,
  buildFiles
} from './build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(fs.readFileSync(path.join(here, 'releases', '2026-09-05-foundation', 'source.json'), 'utf8'));

assert.equal(validateSource(source), source);
const release = buildRelease(source);

assert.equal(release.scope.independentSites, 20);
assert.equal(release.scope.decisionCases, 100);
assert.equal(release.scope.representativeOfWeb, false);
assert.equal(release.scope.ownerControlledReferencesExcluded, true);
assert.equal(release.derived.llmsAwareAccuracyPct, 89);
assert.equal(release.derived.resolverUnionAccuracyPct, 86);
assert.equal(release.derived.unionVsLlmsAwarePercentagePointDelta, -3);
assert.equal(release.derived.resolverUnionImprovementFromHistoricalPercentagePoints, 5);
assert.equal(release.derived.mismatchRatePct, 14);
assert.equal(release.derived.regretRatePct, 6);
assert.equal(release.derived.uniquelyCorrectRatePct, 0);
assert.equal(release.guardrails.noReadinessScore, true);
assert.equal(release.guardrails.noAdoptionInference, true);
assert.equal(release.guardrails.noRankingInference, true);
assert.equal(release.guardrails.frozenEvidenceIsNotSilentlyRewritten, true);

const csv = releaseCsv(release);
assert.match(csv, /^metric,value,unit,scope,evidence_date/m);
assert.match(csv, /llms_aware_correct,89/);
assert.match(csv, /resolver_union_correct,86/);
assert.match(csv, /resolver_regret,6/);
assert.match(csv, /resolver_uniquely_correct,0/);

const releasePage = releaseHtml(release);
assert.match(releasePage, /20 independently owned documentation sites/i);
assert.match(releasePage, /not presented as a representative census of the web/i);
assert.match(releasePage, /llms-aware/);
assert.match(releasePage, /resolver-union/);
assert.match(releasePage, /86\/100/);
assert.match(releasePage, /89\/100/);
assert.match(releasePage, /rel="describedby" type="application\/json"/);
assert.match(releasePage, /application\/ld\+json/);

const landing = indexHtml(release);
assert.match(landing, /State of the Agentic Web/);
assert.match(landing, /frozen, reproducible observations/i);
assert.match(landing, /89%/);
assert.match(landing, /86%/);

const methodology = methodologyHtml(release);
assert.match(methodology, /not representative of the public web/i);
assert.match(methodology, /Ground truth is manually reviewed public publisher\/protocol evidence/i);
assert.match(methodology, /Owner-controlled reference sites are excluded/i);
assert.match(methodology, /Frozen releases are immutable/i);

const index = releaseIndex(release);
assert.equal(index.releases.length, 1);
assert.equal(index.releases[0].id, '2026-09-05-foundation');
assert.equal(index.releases[0].representativeOfWeb, false);
assert.match(index.historyPolicy, /append-only/i);

const files = buildFiles(source);
assert.equal(files.size, 6);
const paths = [...files.keys()].map(file => file.replaceAll('\\', '/'));
for (const suffix of [
  '/docs/research/state-of-agentic-web/index.html',
  '/docs/research/state-of-agentic-web/methodology.html',
  '/docs/research/state-of-agentic-web/releases/index.json',
  '/docs/research/state-of-agentic-web/releases/2026-09-05-foundation.html',
  '/docs/research/state-of-agentic-web/releases/2026-09-05-foundation.json',
  '/docs/research/state-of-agentic-web/releases/2026-09-05-foundation.csv'
]) assert.ok(paths.some(file => file.endsWith(suffix)), `missing generated output ${suffix}`);

console.log('PASS State of the Agentic Web foundation release is reproducible, explicitly non-representative, keeps negative decision-quality evidence visible, and produces JSON/CSV/HTML outputs');
