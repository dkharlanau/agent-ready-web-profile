// Bounded owner-fact check of built HTML. Not an AI-writing detector,
// independent source verification, or a Search ranking prediction.
const clean=value=>String(value??'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&quot;|&#34;/gi,'"').replace(/&apos;|&#39;/gi,"'")
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').normalize('NFKC').replace(/\s+/g,' ').trim();
const norm=value=>clean(value).toLowerCase();
const isRecord=v=>v&&typeof v==='object'&&!Array.isArray(v);
function attr(tag){
  const out={},re=/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
  let m;while((m=re.exec(tag.replace(/^<\w+\s*/,'').replace(/\/?\s*>$/,''))))out[m[1].toLowerCase()]=m[2]??m[3]??m[4]??'';
  return out;
}
function visibleText(src){
  return clean(src.replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(?:script|style|svg|template|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|svg|template|noscript)>/gi,' ')
    .replace(/<[^>]*>/g,' '));
}
function tags(html,name){return [...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(m=>attr(m[0]));}
function tagBody(html,name){
  const m=html.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)<\\/'+name+'>','i'));
  return m?visibleText(m[1]):'';
}
function jsonLd(html){
  const nodes=[];let invalid=0;
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if((attr('<script '+m[1]+'>').type||'').toLowerCase()!=='application/ld+json')continue;
    try{
      const queue=[JSON.parse(m[2])];
      while(queue.length){const item=queue.shift();
        if(Array.isArray(item)){queue.push(...item);continue;}
        if(!isRecord(item))continue;
        nodes.push(item);if(Array.isArray(item['@graph']))queue.push(...item['@graph']);
      }
    }catch{invalid++;}
  }
  return {nodes,invalid};
}
function sameCanonical(a,b){try{
  const x=new URL(a),y=new URL(b);
  return x.protocol==='https:'&&y.protocol==='https:'&&x.origin===y.origin
    &&(x.pathname.replace(/\/+$/,'')||'/')===(y.pathname.replace(/\/+$/,'')||'/')
    &&!x.search&&!y.search&&!x.hash&&!y.hash;
}catch{return false;}}
const numbers=text=>[...new Set((String(text).match(/(?:[$€£]\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*%)/g)||[]).map(norm))];

export function reviewEditorialParity({html,contract}){
  if(typeof html!=='string'||html.length>2_000_000)throw Error('Bounded built HTML under 2 MB is required.');
  if(!isRecord(contract)||contract.version!=='0.1'||!sameCanonical(contract.canonicalUrl,contract.canonicalUrl)
    ||!['requiredVisibleFacts','forbiddenClaims','approvedMetadataClaims'].every(k=>
      Array.isArray(contract[k])&&contract[k].every(x=>typeof x==='string'&&x.trim().length>=3&&x.length<=280)))
    throw Error('An explicit owner-reviewed editorial contract v0.1 with canonical URL and three claim arrays is required.');
  const main=html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0]||'';
  const visible=visibleText(main);
  const metas={};for(const a of tags(html,'meta')){const key=(a.name||a.property||'').toLowerCase();if(key&&a.content&&!metas[key])metas[key]=clean(a.content);}
  const canonical=tags(html,'link').find(a=>(a.rel||'').toLowerCase().split(/\s+/).includes('canonical'))?.href||null;
  const ld=jsonLd(html),title=tagBody(html,'title'),h1=tagBody(html,'h1');
  const published=[title,metas.description,metas['og:title'],metas['og:description'],
    metas['twitter:title'],metas['twitter:description'],...ld.nodes.flatMap(n=>[n.name,n.headline,n.description])].filter(x=>typeof x==='string');
  const publicClaims=norm(published.join(' ')),visibleNorm=norm(visible);
  const fail=[],review=[];
  const add=(into,id,why)=>into.push({id,why});
  if(!main||!h1)add(fail,'reader-structure','Expected a visible main region and H1 in the built page.');
  if(!canonical)add(review,'missing-canonical','Confirm the source of the final public canonical URL.');
  else if(!sameCanonical(canonical,contract.canonicalUrl))add(fail,'canonical-mismatch','The built canonical disagrees with the owner-approved public URL.');
  if(!metas.description)add(review,'missing-description','No built meta description was observed.');
  if(ld.invalid)add(fail,'invalid-jsonld',ld.invalid+' JSON-LD block(s) do not parse.');
  for(const phrase of contract.requiredVisibleFacts)if(!visibleNorm.includes(norm(phrase)))
    add(fail,'approved-fact-not-visible','The approved statement was not visible: '+phrase);
  for(const phrase of contract.forbiddenClaims)if(visibleNorm.includes(norm(phrase))||publicClaims.includes(norm(phrase)))
    add(fail,'disallowed-claim','An owner-disallowed claim appears in visible text or metadata: '+phrase);
  for(const phrase of contract.approvedMetadataClaims)if(!publicClaims.includes(norm(phrase)))
    add(review,'approved-metadata-not-observed','Approved metadata phrase was not observed: '+phrase);
  const visibleNums=new Set(numbers(visible));
  for(const value of numbers(published.join(' ')))if(!visibleNums.has(value))
    add(review,'metadata-number-needs-proof','A number in metadata is not visible in main content: '+value);
  if(ld.nodes.some(n=>n['@type']==='Offer'||n.offers)&&contract.productOfferVerified!==true)
    add(review,'offer-needs-proof','A structured Offer was found; check real price, availability and product ownership.');
  if(contract.mustRemainUnavailable===true&&/\b(download now|install now|available for download|buy now)\b/i.test([visible,...published].join(' ')))
    add(fail,'unreleased-product-claim','Availability claim contradicts the owner-declared unreleased product.');
  return{
    version:'0.1',kind:'owner-editorial-parity-preflight',canonicalUrl:contract.canonicalUrl,
    title:title||null,h1:h1||null,visibleFactsChecked:contract.requiredVisibleFacts.length,
    forbiddenClaimsChecked:contract.forbiddenClaims.length,approvedMetadataClaimsChecked:contract.approvedMetadataClaims.length,
    fail,review,state:fail.length?'fail':review.length?'review-needed':'no-observed-contract-violation',
    ownerSignoffStillRequired:true,rankingImpactEstablished:false,sourceTruthVerified:false,
    limits:[
      'An owner-authored contract is an assertion, not independent evidence.',
      'Metadata paraphrases and numbers are suggestions for editorial review, not automatic proof that the text is false.',
      'This cannot infer real rights, publication, product availability, external Search performance or reader benefit.'
    ]
  };
}
