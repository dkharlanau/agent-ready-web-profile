import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewBingContext, compareBingContext } from '../lib/bing-context-evidence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base={
  version:'0.1',provider:'bing-webmaster-ai-performance',sourceClass:'owner-normalized',
  sourceVerifiedByGoose:false,site:'https://example.com/',capturedAt:'2026-10-03T10:00:00Z',
  period:{start:'2026-09-01',end:'2026-09-30',dataState:'owner-final'},
  guardrails:{sampledNotComplete:true,notRankingOrTraffic:true},
  queries:[{id:'q01'},{id:'q02'},{id:'q03'}],
  topics:[{id:'topic01'},{id:'topic02'}],
  pages:[{id:'page01',canonicalUrl:'https://example.com/guides/one'},{id:'page02',canonicalUrl:'https://example.com/guides/two'}],
  queryContext:[
    {queryId:'q01',intent:'Research',topicId:'topic01',citationSharePercent:12.5,citations:14},
    {queryId:'q02',intent:'Learn and Solve',topicId:'topic02',citationSharePercent:null,citations:null}
  ],
  pageQueryObservations:[
    {direction:'query-to-page',filterQueryId:'q01',queryId:'q01',pageId:'page01',citations:8},
    {direction:'page-to-query',filterPageId:'page01',queryId:'q01',pageId:'page01',citations:7},
    {direction:'query-to-page',filterQueryId:'q01',queryId:'q01',pageId:'page02',citations:2}
  ],
  timeline:[{date:'2026-09-02',citations:1},{date:'2026-09-25',citations:8}]
};
const review=reviewBingContext(base);
assert.equal(review.state,'owner-declared-final');
assert.equal(review.siteCitationTimeline.length,2);
assert.equal(review.queriesRegistered,3);
assert.equal(review.pagesRegistered,2);
assert.equal(review.context[0].citationSharePercent,12.5);
assert.equal(review.context[1].citationSharePercent,null,'missing query share must not turn to zero');
assert.equal(review.context[1].citations,null,'missing citations remain unknown');
assert.equal(review.filteredProjections['query-to-page'].length,2);
assert.equal(review.filteredProjections['page-to-query'].length,1);
assert.equal(review.filteredProjections['query-to-page'][0].citations,8);
assert.equal(review.filteredProjections['page-to-query'][0].citations,7,'opposite filter counts must not be overwritten or averaged');
assert.equal(review.noOutcomeDecision,true);
assert.equal(review.causalImpactEstablished,false);
assert.equal(review.sourceAuthenticatedByGoose,false);
assert.match(review.pageMapFingerprint,/^[a-f0-9]{64}$/);
assert(!JSON.stringify(review).includes('https://example.com/guides/one'),'raw page map may not leak into derived results');

const next=structuredClone(base);
next.capturedAt='2026-11-02T10:00:00Z';
next.period={start:'2026-10-01',end:'2026-10-30',dataState:'owner-final'};
next.queryContext=[
  {queryId:'q01',intent:'Research',topicId:'topic02',citationSharePercent:15,citations:11},
  {queryId:'q03',intent:'Commercial',topicId:null,citationSharePercent:0,citations:0}
];
next.timeline=[{date:'2026-10-02',citations:1}];
const later=reviewBingContext(next);
const comparison=compareBingContext(review,later);
assert.equal(comparison.matchedQueryIds,1);
assert.deepEqual(comparison.missingBeforeQueryIds,['q03']);
assert.deepEqual(comparison.missingAfterQueryIds,['q02']);
assert.equal(comparison.comparisons[0].citationSharePointChange,2.5);
assert.equal(comparison.comparisons[0].beforeCitations,14);
assert.equal(comparison.comparisons[0].afterCitations,11);
assert.equal(comparison.comparisons[0].beforeTopicId,'topic01');
assert.equal(comparison.comparisons[0].afterTopicId,'topic02');
assert.equal(comparison.noOutcomeDecision,true);
assert.equal(comparison.causalImpactEstablished,false);

const edit=fn=>{const x=structuredClone(base);fn(x);return x;};
assert.throws(()=>reviewBingContext(edit(x=>{x.provider='google';})),/provider/);
assert.throws(()=>reviewBingContext(edit(x=>{x.guardrails.sampledNotComplete=false;})),/guardrails/);
assert.throws(()=>reviewBingContext(edit(x=>{x.queries.push({id:'q01'});})),/duplicate/);
assert.throws(()=>reviewBingContext(edit(x=>{x.queryContext[0].citationSharePercent=120;})),/Citation Share/);
assert.throws(()=>reviewBingContext(edit(x=>{x.queryContext[0].citationSharePercent=-0.2;})),/Citation Share/);
assert.throws(()=>reviewBingContext(edit(x=>{x.queryContext[0].queryId='unknown';})),/one known queryId/);
assert.throws(()=>reviewBingContext(edit(x=>{x.pageQueryObservations[0].filterQueryId='q02';})),/actual matching UI-export filter/);
assert.throws(()=>reviewBingContext(edit(x=>{x.pageQueryObservations.push({...x.pageQueryObservations[0]});})),/Duplicate filtered/);
assert.throws(()=>reviewBingContext(edit(x=>{x.pageQueryObservations[0].citations=-3;})),/nonnegative safe integer/);
assert.throws(()=>reviewBingContext(edit(x=>{x.pages[0].canonicalUrl='https://other.example.com/';})),/owner site/);
assert.throws(()=>reviewBingContext(edit(x=>{x.queries[0].phrase='private query text';})),/opaque query/);
assert.throws(()=>reviewBingContext(edit(x=>{x.topics[0].label='private full topic';})),/opaque query/);
assert.throws(()=>reviewBingContext(edit(x=>{x.timeline[0].date='2026-08-30';})),/within selected/);
assert.throws(()=>reviewBingContext(edit(x=>{x.period.dataState='raw';})),/non-ranking guardrails/);
assert.throws(()=>compareBingContext(review,{...later,site:'https://other.com/'}),/same site/);
assert.throws(()=>compareBingContext(later,review),/nonoverlapping/);
assert.throws(()=>compareBingContext(review,{...later,period:{...later.period,end:'2026-10-29'}}),/equal-length/);
const partial=reviewBingContext(edit(x=>{x.period.dataState='partial';}));
assert.equal(partial.state,'provider-finality-unconfirmed');
assert.throws(()=>compareBingContext(partial,later),/final/);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'goose-bing-'));
try {
 const input=path.join(tmp,'owner-private.json'),before=path.join(tmp,'review-before.json'),
  after=path.join(tmp,'review-after.json'),out=path.join(tmp,'comparison.json');
 fs.writeFileSync(input,JSON.stringify(base));fs.writeFileSync(before,JSON.stringify(review));fs.writeFileSync(after,JSON.stringify(later));
 const cli=path.join(root,'bin/arwp-bing.mjs');
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',cwd:root});
 let r=run('inspect','--input='+input,'--json');
 assert.equal(r.status,0,r.stderr);
 assert.equal(JSON.parse(r.stdout).context.length,2);
 r=run('compare','--before='+before,'--after='+after,'--output='+out,'--json');
 assert.equal(r.status,0,r.stderr);
 assert.equal(JSON.parse(r.stdout).matchedQueryIds,1);
 r=run('compare','--before='+before,'--after='+after,'--output='+out);
 assert.equal(r.status,2,'private evidence must not be overwritten');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
console.log('PASS Bing AI provider-native query/topic/intent/Citation Share/filter scope, private outputs, no fabricated visibility score, comparison gates');
