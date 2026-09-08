#!/usr/bin/env node
// Local aggregation of reviewed observations, not a crawler, tracker or causal estimator.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const stages = ['discovered', 'independent_reuse', 'ai_citation', 'useful_action'];
const day = 86400000;
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
const text = x => typeof x === 'string' && x.trim().length > 0;
const assert = (ok, message) => { if (!ok) throw new Error(message); };
export function relayReport(input) {
  assert(['synthetic','reviewed-observations'].includes(input?.dataStatus), 'dataStatus must distinguish synthetic from reviewed observations');
  assert(input?.version === '1.0.0' && date(input.asOf), 'version 1.0.0 and asOf date required');
  assert(Number.isSafeInteger(input.windowDays) && input.windowDays > 0 && input.windowDays <= 366, 'windowDays must be 1..366');
  assert(Array.isArray(input.assets) && Array.isArray(input.observations), 'assets and observations required');
  const assets = new Map(), seen = new Set(), groups = new Map();
  for (const a of input.assets) {
    assert(text(a.id) && !assets.has(a.id) && text(a.braidNodeId), 'unique asset id and existing BraidGraph node reference required');
    assert(date(a.releasedAt) && a.releasedAt <= input.asOf, 'asset release must be a real date at or before asOf');
    assert(Array.isArray(a.coverage), 'asset coverage array required; use empty for unknown');
    for (const c of a.coverage) assert(stages.includes(c.stage) && date(c.from) && date(c.to) && c.from <= c.to && c.to <= input.asOf && text(c.evidenceRef), 'invalid coverage observation');
    assets.set(a.id, a);
  }
  const observations = [];
  for (const o of input.observations) {
    assert(text(o.id) && !seen.has(o.id), 'observation ids must be unique'); seen.add(o.id);
    const a = assets.get(o.assetId);
    assert(a && stages.includes(o.stage) && text(o.evidenceRef) && text(o.actorGroup), 'observation needs known asset, stage, actor group and evidence reference');
    assert(['owned','independent','paid','unknown'].includes(o.relationship), 'relationship must be explicit');
    assert(date(o.observedAt) && o.observedAt >= a.releasedAt && o.observedAt <= input.asOf, 'observation date outside release/asOf bounds');
    assert(o.stage !== 'ai_citation' || ['supported','unsupported','unreviewed'].includes(o.verdict), 'AI citation verdict required');
    if (groups.has(o.actorGroup)) assert(groups.get(o.actorGroup) === o.relationship, 'actor group has conflicting ownership classifications');
    groups.set(o.actorGroup,o.relationship);
    observations.push(o);
  }
  const report = { version:'1.0.0', dataStatus:input.dataStatus, asOf:input.asOf, windowDays:input.windowDays,
    scope:'reviewed-observation-summary-not-causal-attribution', stages:{},
    limits:['Coverage means the stated monitoring protocol, not exhaustive web coverage.', 'First observed lag is not time to indexing or actual first reuse.', 'Stages are parallel observations; they do not identify a user journey.', 'BraidGraph and evidence references are checked for presence only, not externally verified.'] };
  for (const stage of stages) {
    const eligible = [...assets.values()].filter(a => Date.parse(a.releasedAt)+input.windowDays*day <= Date.parse(input.asOf));
    // Require one full coverage interval; fragmented coverage is conservatively unknown.
    const covered = eligible.filter(a => a.coverage.some(c => c.stage === stage && c.from <= a.releasedAt && Date.parse(c.to) >= Date.parse(a.releasedAt)+input.windowDays*day));
    const ids = new Set(covered.map(a=>a.id)), dedup = new Map();
    for (const o of observations) {
      const a = assets.get(o.assetId), lag = (Date.parse(o.observedAt)-Date.parse(a.releasedAt))/day;
      if(o.stage !== stage || !ids.has(o.assetId) || lag >= input.windowDays) continue;
      if(stage === 'independent_reuse' && o.relationship !== 'independent') continue;
      // One reviewed artifact can be mirrored on many URLs. Reviewer supplies its stable evidenceRef.
      const key = JSON.stringify([o.assetId,o.actorGroup,o.evidenceRef]);
      if(dedup.has(key)) {
        const prior=dedup.get(key);
        assert(prior.verdict===o.verdict, 'duplicate evidence has conflicting verdicts');
        if(o.observedAt < prior.observedAt) dedup.set(key,o);
      } else dedup.set(key,o);
    }
    const rows=[...dedup.values()], observed=new Set(rows.map(o=>o.assetId));
    const independentGroups = new Set(rows.filter(o=>o.relationship==='independent').map(o=>o.actorGroup));
    const lags = covered.filter(a=>observed.has(a.id)).map(a=>Math.min(...rows.filter(o=>o.assetId===a.id).map(o=>(Date.parse(o.observedAt)-Date.parse(a.releasedAt))/day))).sort((a,b)=>a-b);
    const reviewed = rows.filter(o=>['supported','unsupported'].includes(o.verdict));
    report.stages[stage]={matureAssets:eligible.length,coveredAssets:covered.length,unknownCoverageAssets:eligible.length-covered.length,immatureAssets:assets.size-eligible.length,assetsWithObservation:observed.size,observedYield:covered.length?observed.size/covered.length:null,uniqueEvidence:rows.length,independentGroups:independentGroups.size,firstObservedLagDays:lags,fullyCoveredWithoutObservation:covered.length-observed.size};
    if(stage==='ai_citation') Object.assign(report.stages[stage], { reviewedCitations:reviewed.length, unreviewedCitations:rows.length-reviewed.length, supportedCitationRate:reviewed.length?reviewed.filter(o=>o.verdict==='supported').length/reviewed.length:null });
  }
  return report;
}
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  try {
    assert(process.argv.length===3, 'Usage: node evidence-relay.mjs reviewed-ledger.json');
    const file=process.argv[2]; assert(fs.statSync(file).size <= 5000000,'Ledger exceeds 5 MB');
    console.log(JSON.stringify(relayReport(JSON.parse(fs.readFileSync(file,'utf8'))),null,2));
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
