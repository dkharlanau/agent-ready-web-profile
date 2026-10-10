import assert from 'node:assert/strict';
import { formatGrowthActionForReader, readableGrowthAction } from '../lib/growth-readable.mjs';
import { buildGrowthPlanFromObservations, formatGrowthPlan } from '../lib/growth-profile.mjs';

const examples = [
  { id: 'growth:non-commodity-review', title: 'Check useful work', lane: 'editorial', priority: 'P1', reason: 'Human-only', status: 'manual' },
  { id: 'growth:entity-identity', title: 'Identity', lane: 'identity', priority: 'P1', reason: 'No schema', status: 'recommended' },
  { id: 'growth:preferred-source-acquisition', title: 'Source follow', lane: 'citation', priority: 'P2', reason: 'Repeat readers', status: 'opportunity', source: 'https://example.com/source' },
  { id: 'growth:bing-ai-citation-measurement', title: 'Bing owner evidence', lane: 'measurement', priority: 'P1', reason: 'Owner report required', status: 'external-owner-data' },
  { id: 'growth:cloudflare-content-signals', title: 'Use policy', lane: 'ai-access', priority: 'P2', reason: 'Policy owner needed' },
  { id: 'audit:robots', title: 'Public page access', lane: 'eligibility', priority: 'P0', reason: 'Inconclusive', status: 'warn', evidence: [] }
];
for(const item of examples){
  const advice=readableGrowthAction(item);
  for(const key of ['firstStep','verify','hold'])assert.ok(advice[key].length>=55, item.id+' lacks useful '+key);
  const formatted=formatGrowthActionForReader(item);
  assert.match(formatted,/Start here:/);
  assert.match(formatted,/Check it:/);
  assert.match(formatted,/When not to do it:/);
  assert.match(formatted,/Why this came up:/);
  assert.ok(formatted.includes(item.title));
}
assert.match(readableGrowthAction(examples[1]).hold,/invent|private|unverified/);
assert.match(readableGrowthAction(examples[2]).hold,/subdirectory/);
assert.match(readableGrowthAction(examples[3]).hold,/unknown rather than zero/);
assert.match(readableGrowthAction(examples[4]).firstStep,/publisher/i);
assert.match(readableGrowthAction(examples[5]).firstStep,/published version/);
assert.throws(()=>readableGrowthAction({id:'missing'}),/complete growth action/);
assert.doesNotMatch(formatGrowthActionForReader(examples[0]),/Google Analytics|Google Tag Manager|universal ranking boost/i);

// The user-facing formatting must work on a complete real planner result,
// while preserving the original structured action IDs and evidence fields.
const plan=buildGrowthPlanFromObservations({
  audit:{canonicalUrl:'https://example.com/',checks:[]},
  homepage:{url:'https://example.com/',text:'<html><body><h1>A useful site</h1></body></html>'},
  robots:{text:'User-agent: *\nAllow: /'}
});
const beforeIds=plan.actions.map(a=>a.id);
const printed=formatGrowthPlan(plan);
assert.match(printed,/Start here: Pick one priority page/);
assert.match(printed,/When not to do it:/);
assert.match(printed,/Evidence: owner report required/);
assert.deepEqual(plan.actions.map(a=>a.id),beforeIds,'reader formatting must never reorder implementation actions');
console.log('PASS human-first Growth Profile advice with practical next step, proof check, applicability and unchanged machine actions');
