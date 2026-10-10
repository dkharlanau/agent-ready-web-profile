import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewEditorialParity } from '../lib/editorial-parity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contract={
  version:'0.1',canonicalUrl:'https://example.com/article/',
  requiredVisibleFacts:['Not released yet','Try one small exercise'],
  forbiddenClaims:['guaranteed 10x growth','Download now'],
  approvedMetadataClaims:['one exercise'],
  mustRemainUnavailable:true,
  productOfferVerified:false
};
const source=[
  '<!doctype html><html><head><title>Try one exercise</title>',
  '<meta content="Try one exercise, no outcome promise" name="description">',
  '<link href="https://example.com/article/" rel="canonical">',
  '<script type="application/ld+json">{"@context":"https://schema.org",',
  '"@graph":[{"@type":"Article","name":"Try one exercise",',
  '"description":"Try one exercise"}]}</script>',
  '</head><body><main><h1>One useful step</h1>',
  '<p>Not released yet. Try one small exercise.</p>',
  '<p>As a worked example, the change is a possibility, not a result.</p>',
  '</main></body></html>'
].join('');
const good=reviewEditorialParity({html:source,contract});
assert.equal(good.state,'no-observed-contract-violation',JSON.stringify(good));
assert.deepEqual(good.fail,[]);
assert.deepEqual(good.review,[]);
assert.equal(good.ownerSignoffStillRequired,true);
assert.equal(good.rankingImpactEstablished,false);
assert.equal(good.sourceTruthVerified,false);
const metadataNumber=source.replace('no outcome promise','98% improvement');
const numeric=reviewEditorialParity({html:metadataNumber,contract});
assert.equal(numeric.state,'review-needed');
assert(numeric.review.some(x=>x.id==='metadata-number-needs-proof'));
assert.equal(numeric.fail.length,0,'unsourced numeric metadata is a human review warning, not fabricated certainty');
const misleading=source.replace('no outcome promise','guaranteed 10x growth');
assert.equal(reviewEditorialParity({html:misleading,contract}).state,'fail');
assert(reviewEditorialParity({html:misleading,contract}).fail.some(x=>x.id==='disallowed-claim'));
const fakeDownload=source.replace('Try one exercise, no outcome promise','Download now');
assert(reviewEditorialParity({html:fakeDownload,contract}).fail.some(x=>x.id==='unreleased-product-claim'));
const ownerRequired=reviewEditorialParity({html:source,contract:{...contract,requiredVisibleFacts:['Approved public production download']}});
assert(ownerRequired.fail.some(x=>x.id==='approved-fact-not-visible'));
const wrongCanonical=source.replace('https://example.com/article/','https://other.example/article/');
assert(reviewEditorialParity({html:wrongCanonical,contract}).fail.some(x=>x.id==='canonical-mismatch'));
const jsonBad=source.replace('"@type":"Article"','"@type":INVALID');
assert(reviewEditorialParity({html:jsonBad,contract}).fail.some(x=>x.id==='invalid-jsonld'));
const offers=source.replace('"@type":"Article"','"@type":"Offer"');
assert(reviewEditorialParity({html:offers,contract}).review.some(x=>x.id==='offer-needs-proof'));
const noMain=source.replace(/<main>/,'<section>').replace(/<\/main>/,'</section>');
assert(reviewEditorialParity({html:noMain,contract}).fail.some(x=>x.id==='reader-structure'));
assert.throws(()=>reviewEditorialParity({html:source,contract:{}}),/owner-reviewed editorial contract/);
assert.throws(()=>reviewEditorialParity({html:source,contract:{...contract,canonicalUrl:'http://example.com/article/'}}),/owner-reviewed editorial contract/);
const kit=fs.readFileSync(path.join(root,'templates/growth/original-evidence-review.md'),'utf8');
for(const term of ['Existing canonical page','Frozen experiment','Deployment','Baseline','Control','Negative result',
'Alternative cause','Reader','Practitioner','Skeptic','keep/revise/continue','unknown'])
 assert(kit.toLowerCase().includes(term.toLowerCase()),'Evidence kit missing '+term);
assert(!kit.includes('2026-10-10 + 23% organic growth'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'goose-editorial-'));
try{
 const html=path.join(tmp,'page.html'),json=path.join(tmp,'facts.json'),output=path.join(tmp,'review.json');
 fs.writeFileSync(html,source);fs.writeFileSync(json,JSON.stringify(contract));
 const run=(...x)=>spawnSync(process.execPath,[path.join(root,'bin/arwp-editorial.mjs'),...x],{encoding:'utf8',cwd:root});
 let result=run('--html='+html,'--contract='+json,'--json','--output='+output);
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).state,'no-observed-contract-violation');
 assert.equal(JSON.parse(fs.readFileSync(output,'utf8')).ownerSignoffStillRequired,true);
 result=run('--html='+html,'--contract='+json,'--output='+output);
 assert.equal(result.status,2,'a private existing review must not be overwritten');
 fs.writeFileSync(html,misleading);
 result=run('--html='+html,'--contract='+json,'--json');
 assert.equal(result.status,1);
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log('PASS owner-approved editorial metadata preflight, no fake outcome scores, private CLI and original evidence kit');
