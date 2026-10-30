import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeInternalDiscoveryFromPages } from '../lib/internal-discovery.mjs';
import { reviewIntentGraph, formatIntentGraphReview } from '../lib/intent-graph-review.mjs';

const root = 'https://example.test/';
const page = (url, body, options = {}) => ({requestedUrl:url,url,ok:true,status:200,contentType:'text/html',headers:{},html:`<html><body>${body}</body></html>`,...options});
const report = analyzeInternalDiscoveryFromPages({canonicalUrl:root,generatedAt:'2026-10-30T00:00:00Z',pages:[
  page(root,'<main><a href="/guide">Guide</a></main>'),
  page(root+'guide','<main>Guide</main>'),
  page(root+'alias','<main>Alias</main>',{html:`<html><head><link rel="canonical" href="${root}guide"></head><body>Alias</body></html>`}),
  page(root+'capped','<main><a href="/guide">Guide</a><a href="/other">Other</a></main>',{maxLinksPerPage:1})
]});
const rel = (from,to,kind='do') => ({from,to,locale:'en',kind,label:'Useful next step',reason:'The task continues here.'});
const graph = {version:'1',site:root,relations:[
  rel(root,root+'guide'), rel(root+'guide',root+'outside','verify'),
  rel(root+'capped',root+'outside'), rel(root+'outside',root+'guide'),
  rel(root+'guide',root+'alias')
]};
const reviewed=reviewIntentGraph(graph,report);
assert.deepEqual(reviewed.rows.map(r=>r.observation),['observed-link','not-observed-from-sampled-source','unknown','unknown','not-observed-from-sampled-source']);
assert.deepEqual(reviewed.rows[0].observedClasses,['contextual']);
assert.equal(reviewed.rows[1].targetState,'out-of-cohort');
assert.equal(reviewed.rows[4].targetState,'canonical-alias');
assert.match(formatIntentGraphReview(graph,report),/does not establish its semantic meaning/);
const hostile = structuredClone(graph);
hostile.relations[0].label='<script>*unsafe*</script>';
assert.match(formatIntentGraphReview(hostile,report),/&lt;script&gt;&#42;unsafe&#42;&lt;\/script&gt;/);
for (const mutate of [
  x=>x.site='https://other.example.test/',
  x=>x.relations[0].to='https://other.example.test/path',
  x=>x.relations[0].to=x.relations[0].from,
  x=>x.relations[0].to=root+'guide#fragment',
  x=>x.relations[0].from='https://user:secret@example.test/',
  x=>x.relations[0].locale='en_us',
  x=>x.relations[0].kind='invented',
  x=>x.relations[0].extra=true,
  x=>x.relations.push({...x.relations[0]})
]) {const x=structuredClone(graph);mutate(x);assert.throws(()=>reviewIntentGraph(x,report));}
assert.throws(()=>reviewIntentGraph(graph,{}),/Invalid internal discovery report/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arwp-relation-review-'));
try {
 const input=path.join(dir,'input.json'), saved=path.join(dir,'report.json'), output=path.join(dir,'review.md');
 fs.writeFileSync(input,JSON.stringify(graph));fs.writeFileSync(saved,JSON.stringify(report));
 const run=()=>spawnSync(process.execPath,['bin/arwp-internal-discovery.mjs','relations',input,saved,`--output=${output}`],{encoding:'utf8'});
 assert.equal(run().status,0); assert.match(fs.readFileSync(output,'utf8'),/not-observed-from-sampled-source/);
 assert.notEqual(run().status,0,'an existing file is never overwritten');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
console.log('PASS intent graph review: proposals, bounded observations, unknowns, input validation and non-overwriting CLI');
