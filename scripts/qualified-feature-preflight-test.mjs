import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewVideoObject,reviewStableCommerceFeed } from '../lib/qualified-feature-preflight.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const video={
  ownerFacts:{
    version:'0.1',canonicalUrl:'https://example.com/watch',
    published:true,approvedPublicCreator:'Example Editorial',
    licensedForPublication:true,durationSeconds:90,
    verifiedInteractions:{WatchAction:12},
    approvedClipHosts:['example.com']
  },
  videoJsonld:{
    '@context':'https://schema.org','@type':'VideoObject',
    name:'A real demonstration',description:'An actual, limited demonstration',
    thumbnailUrl:'https://cdn.example.com/real-image.jpg',
    embedUrl:'https://example.com/watch/player',uploadDate:'2026-09-10T12:00:00Z',
    creator:{'@type':'Organization',name:'Example Editorial'},
    interactionStatistic:{
      '@type':'InteractionCounter',interactionType:{'@type':'WatchAction'},userInteractionCount:12
    },
    hasPart:[
      {'@type':'Clip',name:'Start here',startOffset:10,url:'https://example.com/watch?t=10'},
      {'@type':'Clip',name:'Second step',startOffset:35,url:'https://example.com/watch?t=35'}
    ]
  }
};
const good=reviewVideoObject(video);
assert.equal(good.state,'owner-fact-preflight-ready',JSON.stringify(good));
assert.equal(good.issues.length,0);
assert.equal(good.countsChecked,1);
assert.equal(good.keyMomentsChecked,2);
assert.equal(good.rankingsEstablished,false);
assert.equal(good.sourceAuthenticated,false);
const bad=fn=>{const x=structuredClone(video);fn(x);return x;};
assert.equal(reviewVideoObject(bad(x=>{x.ownerFacts.published=false;})).state,'not-applicable');
assert.equal(reviewVideoObject(bad(x=>{x.ownerFacts.published=null;})).state,'needs-owner-publication-confirmation');
assert(reviewVideoObject(bad(x=>{x.videoJsonld.creator.name='Fictional reviewer';})).issues.some(p=>p.code==='creator-identity'));
assert(reviewVideoObject(bad(x=>{x.videoJsonld.interactionStatistic.userInteractionCount=300;})).issues.some(p=>p.code==='interaction-unverified'));
assert(reviewVideoObject(bad(x=>{x.videoJsonld.interactionStatistic.interactionType['@type']='RatingAction';})).issues.some(p=>p.code==='interaction-kind'));
assert(reviewVideoObject(bad(x=>{x.videoJsonld.hasPart[1].startOffset=4;})).issues.some(p=>p.code==='clip-invalid'));
assert(reviewVideoObject(bad(x=>{x.videoJsonld.hasPart[1].url='https://unapproved.example/foo';})).issues.some(p=>p.code==='clip-unknown-host'));
assert(reviewVideoObject(bad(x=>{x.ownerFacts.licensedForPublication=false;})).issues.some(p=>p.code==='rights'));
assert(reviewVideoObject(bad(x=>{x.videoJsonld.thumbnailUrl=null;})).issues.some(p=>p.code==='thumbnail'));
const noCounts=reviewVideoObject(bad(x=>{delete x.videoJsonld.interactionStatistic;}));
assert.equal(noCounts.state,'owner-fact-preflight-ready');
assert(noCounts.watch.some(x=>/omission is preferable/i.test(x)),'unknown counters should be omitted');

const product={
 item_id:'MUG-350-BLUE',title:'Ceramic mug blue',
 description:'A genuine glazed mug for a fictional test, not a production offer.',
 url:'https://example.com/products/mug-blue',
 brand:'FictionalBrand',seller_name:'Example Shop',
 image_url:'https://cdn.example.com/mug-blue.jpg',
 availability:'in_stock',price:'18.00 USD'
};
const feed={
 partner:{version:'0.1',feedVersion:'stable',site:'https://example.com/',
  feedAccessApproved:false,adsAccessApproved:false,checkoutApproved:false},
 products:[product]
};
const refused=reviewStableCommerceFeed(feed);
assert.equal(refused.state,'partner-approval-required',JSON.stringify(refused));
assert.equal(refused.rowsReviewed,1);
assert.equal(refused.problems.length,0);
assert.equal(refused.uploaded,false);
assert.equal(refused.advertised,false);
assert.equal(refused.rankingsEstablished,false);
const approved=structuredClone(feed);approved.partner.feedAccessApproved=true;
assert.equal(reviewStableCommerceFeed(approved).state,'owner-review-ready','explicit declared feed access is still not a submitted feed');
const invalid=fn=>{const x=structuredClone(feed);fn(x);return x;};
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].item_id='unknown';})).problems.some(p=>p.code==='required-field:item_id'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products.push({...product});})).problems.some(p=>p.code==='duplicate-item-id'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].price='-1 USD';})).problems.some(p=>p.code==='price'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].sale_price='20.00 USD';})).problems.some(p=>p.code==='sale-price'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].availability='coming_soon';})).problems.some(p=>p.code==='availability'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].url='https://other.example.com/product';})).problems.some(p=>p.code==='product-url'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].listing_has_variations=true;})).problems.some(p=>p.code==='variant-identity'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].is_ads_eligible=true;})).problems.some(p=>p.code==='ads-not-authorized'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].is_eligible_checkout=true;})).problems.some(p=>p.code==='checkout-not-authorized'));
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].gtin='12345678';})).problems.some(p=>p.code==='gtin'));
assert.throws(()=>reviewStableCommerceFeed(invalid(x=>{x.partner.feedVersion='draft';})),/Stable partner facts/);
const variant=invalid(x=>{
 x.partner.feedAccessApproved=true;
 x.products=[
  {...product,item_id:'MUG-BLUE',group_id:'MUG',listing_has_variations:true,variant_dict:{color:'Blue'},offer_id:'SHOP-MUG-BLUE'},
  {...product,item_id:'MUG-GREEN',group_id:'MUG',listing_has_variations:true,variant_dict:{color:'Green'},offer_id:'SHOP-MUG-GREEN',url:'https://example.com/products/mug-green'}
 ];
});
assert.equal(reviewStableCommerceFeed(variant).state,'owner-review-ready');
assert(reviewStableCommerceFeed(invalid(x=>{x.products[0].sale_price_effective_date='2026-10-01/2026-10-10';})).problems.some(p=>p.code==='sale-period'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'goose-qualified-'));
try{
 const videoFile=path.join(tmp,'video.json'),feedFile=path.join(tmp,'feed.json'),out=path.join(tmp,'review.json');
 fs.writeFileSync(videoFile,JSON.stringify(video));fs.writeFileSync(feedFile,JSON.stringify(feed));
 const cmd=path.join(root,'bin/arwp-qualified-review.mjs');
 const run=(...a)=>spawnSync(process.execPath,[cmd,...a],{cwd:root,encoding:'utf8'});
 let result=run('--kind=video','--input='+videoFile,'--json','--output='+out);
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).countsChecked,1);
 result=run('--kind=commerce','--input='+feedFile,'--json');
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).state,'partner-approval-required');
 result=run('--kind=video','--input='+videoFile,'--output='+out);
 assert.equal(result.status,2,'local owner result must not be overwritten');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log('PASS conditional VideoObject factual credit/counters/chapters and approval-gated OpenAI Stable merchant feed preflight');
