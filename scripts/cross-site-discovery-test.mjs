import assert from 'node:assert/strict';
import {reviewCrossSiteRelations,formatCrossSiteDiscoveryMarkdown} from '../lib/cross-site-discovery.mjs';

const a='https://alpha.example.test/',b='https://beta.example.test/';
const t='2026-01-01T10:00:00Z';
const page=(url,body='',extra={})=>({requestedUrl:url,url,ok:true,status:200,contentType:'text/html',observedAt:t,html:`<!doctype html><html lang="en"><head><link rel="canonical" href="${url}"></head><body>${body}</body></html>`,...extra});
const rel=(extra={})=>({id:'practice',sourceSite:'alpha',targetSite:'beta',sourceUrl:a+'guide',targetUrl:b+'practice',locale:'en',anchor:'Try the practice',job:'Apply one idea',...extra});
const setup=(body='',options={})=>({sites:[{id:'alpha',canonicalUrl:a,pages:[page(a+'guide',body,options.source)]},{id:'beta',canonicalUrl:b,pages:[page(b+'practice','',options.target)]}],relations:[rel()],...options.input});

{
 const r=reviewCrossSiteRelations(setup('<main><a href="https://beta.example.test/practice#try">Try it</a></main>'));
 assert.equal(r.rows[0].link.status,'observed_in_raw_html');assert.equal(r.rows[0].link.anchor,'Try it');assert.equal(r.rows[0].link.fragment,'#try');
 assert.equal(r.rows[0].source.status,'canonical-owner');assert.equal(r.rows[0].target.status,'canonical-owner');assert.equal(r.rows[0].source.observedAt,t);assert.match(r.rows[0].source.htmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(r.rows[0].editorialStatus,'proposed');
}
{
 const r=reviewCrossSiteRelations(setup('<script>const a="<a href=\"https://beta.example.test/practice\">fake</a>";</script><!-- <a href="https://beta.example.test/practice">fake</a> --><template><a href="https://beta.example.test/practice">fake</a></template>'));
 assert.equal(r.rows[0].link.status,'not_seen_in_bounded_raw_html');
}
{
 const r=reviewCrossSiteRelations(setup('<base href="https://beta.example.test/"><a href="practice?x=1&amp;y=2">Target</a>',{input:{relations:[rel({targetUrl:b+'practice?x=1&y=2'})]}}));
 assert.equal(r.rows[0].link.status,'observed_in_raw_html');
}
{
 const r=reviewCrossSiteRelations(setup('<a href="/one">One</a><a href="https://beta.example.test/practice">Target</a>',{input:{maxAnchors:1}}));
 assert.equal(r.rows[0].link.status,'unknown');
 const unknown=reviewCrossSiteRelations(setup('<a href="https://beta.example.test/&unknown;">Unparseable</a>'));
 assert.equal(unknown.rows[0].link.status,'unknown');
 const svg=reviewCrossSiteRelations(setup('<svg><a href="https://beta.example.test/practice"><text>Target</text></a></svg>'));
 assert.equal(svg.rows[0].link.status,'unknown');
}
{
 const changed=page(b+'practice','',{html:`<html><head><link rel="canonical" href="${b}elsewhere"></head><body></body></html>`});
 const input=setup();input.sites[1].pages=[changed];const r=reviewCrossSiteRelations(input);assert.equal(r.rows[0].target.status,'canonical-alias');assert.equal(r.rows[0].target.canonical,b+'elsewhere');
 input.sites[1].pages=[];assert.equal(reviewCrossSiteRelations(input).rows[0].target.status,'not_sampled');
 input.sites[0].pages=[page(a+'guide','',{ok:false,status:503,html:null})];assert.equal(reviewCrossSiteRelations(input).rows[0].link.status,'unknown');
}
{
 const r=reviewCrossSiteRelations(setup(`<div data-example="<a href='https://beta.example.test/practice'>fake</a>">Example</div>`));
 assert.equal(r.rows[0].link.status,'not_seen_in_bounded_raw_html','markup inside an attribute is not an anchor');
 const text=formatCrossSiteDiscoveryMarkdown(r);assert.match(text,/flowchart LR/);assert.match(text,/proposed/);assert.match(text,/not_seen_in_bounded_raw_html/);assert.match(text,/2026-01-01T10:00:00Z/);
}
{
 const input=setup();input.sites[1].pages=[page(b+'practice','',{html:'<html><head></head><body>Practice</body></html>'})];
 assert.equal(reviewCrossSiteRelations(input).rows[0].target.status,'canonical_unverified');
}
assert.throws(()=>reviewCrossSiteRelations(setup('',{source:{ok:true,status:503}})),/Invalid saved page observation/);
assert.throws(()=>reviewCrossSiteRelations(setup('',{source:{contentType:null}})),/Invalid saved page observation/);
assert.throws(()=>reviewCrossSiteRelations(setup('',{input:{relations:[rel(),rel()]}})),/Invalid editorial relation/);
assert.throws(()=>reviewCrossSiteRelations(setup('',{input:{relations:[rel({targetSite:'alpha'})]}})),/Invalid editorial relation/);
assert.throws(()=>reviewCrossSiteRelations(setup('',{input:{relations:[rel({targetUrl:'https://elsewhere.example.test/'})]}})),/Invalid editorial relation/);
console.log('Cross-site discovery review tests passed');
