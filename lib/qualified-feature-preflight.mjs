// Explicitly conditional, local checks for *real* media and approved commerce.
// These inspect owner-supplied facts. No network writes or claims of eligibility,
// publisher rights, Google rich results, ChatGPT onboarding or outcome impact.
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const https=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}};
const text=v=>typeof v==='string'&&v.trim().length>0&&!/^(?:unknown|null|n\/a)$/i.test(v.trim());
const allowedCounters=new Set(['WatchAction','LikeAction','CommentAction','ShareAction']);
function dataError(issues,code,reason,row=null){issues.push({code,reason,...(row==null?{}:{row})});}
function factsVersion(f){if(!isRecord(f)||f.version!=='0.1'||!https(f.canonicalUrl))throw Error('Owner media facts need version 0.1 and a canonical HTTPS URL.');}

export function reviewVideoObject({ownerFacts,videoJsonld}){
  factsVersion(ownerFacts);
  if(ownerFacts.published===false)return{
    kind:'video-evidence-preflight',state:'not-applicable',issues:[],watch:[],
    ownerPublished:false,rankingsEstablished:false,sourceAuthenticated:false
  };
  if(ownerFacts.published!==true)return{
    kind:'video-evidence-preflight',state:'needs-owner-publication-confirmation',issues:[],watch:[],
    ownerPublished:false,rankingsEstablished:false,sourceAuthenticated:false
  };
  const issues=[],watch=[];
  if(!isRecord(videoJsonld)||!([].concat(videoJsonld['@type']||[])).includes('VideoObject'))
    dataError(issues,'video-object-required','Owner-published video requires a real VideoObject node.');
  if(!text(videoJsonld?.name)||!text(videoJsonld?.description))
    dataError(issues,'video-text','Real video title and factual description are required.');
  if(!https(videoJsonld?.thumbnailUrl) && !(Array.isArray(videoJsonld?.thumbnailUrl)
    &&videoJsonld.thumbnailUrl.length&&videoJsonld.thumbnailUrl.every(https)))
    dataError(issues,'thumbnail','Use a real public thumbnail with an absolute HTTPS URL.');
  if(!https(videoJsonld?.contentUrl)&&!https(videoJsonld?.embedUrl))
    dataError(issues,'video-url','Real playable or embeddable video URL must exist.');
  if(!text(videoJsonld?.uploadDate)||!Number.isFinite(Date.parse(videoJsonld.uploadDate)))
    dataError(issues,'upload-date','A real publication timestamp is required.');
  const creator=videoJsonld?.creator??videoJsonld?.author;
  const name=typeof creator==='string'?creator:creator?.name;
  if(!text(ownerFacts.approvedPublicCreator)||name!==ownerFacts.approvedPublicCreator)
    dataError(issues,'creator-identity','Creator/author must match an actual owner-approved visible public attribution.');
  if(ownerFacts.licensedForPublication!==true)
    dataError(issues,'rights','Published media must have explicit owner-confirmed use rights.');
  const verified=ownerFacts.verifiedInteractions||{};
  const raw=videoJsonld?.interactionStatistic;
  const counts=raw==null?[]:Array.isArray(raw)?raw:[raw];
  for(const count of counts){
    const type=String(count?.interactionType?.['@type']||'').replace(/^https?:\/\/schema.org\//,'');
    if(count?.['@type']!=='InteractionCounter'||!allowedCounters.has(type)){
      dataError(issues,'interaction-kind','Only provider-supported video interaction types and InteractionCounter can be used.');continue;
    }
    if(!Number.isSafeInteger(count.userInteractionCount)||count.userInteractionCount<0)
      dataError(issues,'interaction-count','Do not invent, round or turn missing interaction counts into zero.');
    else if(verified[type]!==count.userInteractionCount)
      dataError(issues,'interaction-unverified','The published count must equal a dated, owner-verified count for this video.');
  }
  const segments=videoJsonld?.hasPart==null?[]:Array.isArray(videoJsonld.hasPart)?videoJsonld.hasPart:[videoJsonld.hasPart];
  let previous=-1;
  for(const clip of segments){
    if(clip?.['@type']!=='Clip'||!text(clip.name)||!Number.isFinite(clip.startOffset)||clip.startOffset<0||clip.startOffset<=previous||!https(clip.url)){
      dataError(issues,'clip-invalid','Each key moment needs a real ordered offset, meaningful label and playable HTTPS target.');
      continue;
    }
    previous=clip.startOffset;
    if(ownerFacts.durationSeconds!=null&&clip.startOffset>=ownerFacts.durationSeconds)
      dataError(issues,'clip-after-end','A key moment cannot start after the owner-declared video duration.');
    const hosts=new Set((ownerFacts.approvedClipHosts||[]).filter(x=>typeof x==='string'));
    hosts.add(new URL(ownerFacts.canonicalUrl).hostname);
    if(!hosts.has(new URL(clip.url).hostname))
      dataError(issues,'clip-unknown-host','Clip target host must be verified by the media owner.');
  }
  if(!counts.length)watch.push('No real video interaction counts were supplied. Omission is preferable to invented metrics.');
  watch.push('Test actual playable media, rights, accessibility, captions and rich result eligibility separately; JSON-LD cannot verify playback.');
  return{
    version:'0.1',kind:'video-evidence-preflight',state:issues.length?'needs-correction':'owner-fact-preflight-ready',
    issues,watch,countsChecked:counts.length,keyMomentsChecked:segments.length,
    ownerPublished:true,rankingsEstablished:false,sourceAuthenticated:false,
    ownerSignoffStillRequired:true
  };
}

const FIELDS=['item_id','title','description','url','brand','seller_name','image_url','availability','price'];
const availability=new Set(['in_stock','out_of_stock','pre_order','backorder','unknown']);
const money=v=>{
  const match=typeof v==='string'&&v.match(/^(\d+(?:\.\d{1,2})?)\s+([A-Z]{3})$/);
  return match?{amount:Number(match[1]),currency:match[2]}:null;
};
function gtinValid(v){
  if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v))return false;
  let sum=0,mult=3;
  for(let i=v.length-2;i>=0;i--){sum+=Number(v[i])*mult;mult=mult===3?1:3;}
  return (10-sum%10)%10===Number(v.at(-1));
}
export function reviewStableCommerceFeed({partner,products}){
  if(!isRecord(partner)||partner.version!=='0.1'||partner.feedVersion!=='stable'||!https(partner.site)
    ||typeof partner.feedAccessApproved!=='boolean'
    ||typeof partner.adsAccessApproved!=='boolean'
    ||typeof partner.checkoutApproved!=='boolean')
    throw Error('Stable partner facts v0.1 and explicit separate feed, ads and checkout access flags are required.');
  if(!Array.isArray(products)||products.length>5000)throw Error('Bounded locally owned product records array required.');
  const problems=[],watch=[];
  const ids=new Set(),offerIds=new Set(),variants=new Map();
  const origin=new URL(partner.site).origin;
  products.forEach((row,i)=>{
    if(!isRecord(row)){dataError(problems,'invalid-row','Product record must be an object.',i);return;}
    for(const field of FIELDS)if(!text(row[field]))dataError(problems,'required-field:'+field,'Missing or placeholder stable feed value.',i);
    if(text(row.item_id)){
      if(ids.has(row.item_id))dataError(problems,'duplicate-item-id','Stable item_id must not be reused for another purchasable item.',i);
      ids.add(row.item_id);
    }
    if(text(row.title)&&row.title.length>150)dataError(problems,'title-length','Product title exceeds stable documented display length.',i);
    if(text(row.description)&&row.description.length>5000)dataError(problems,'description-length','Product description exceeds stable documented length.',i);
    if(!https(row.url)||new URL(row.url).origin!==origin)dataError(problems,'product-url','Product must link to an authorized public HTTPS site.',i);
    if(!https(row.image_url))dataError(problems,'image-url','Use a public HTTPS product image (CDN may differ).',i);
    if(!availability.has(row.availability))dataError(problems,'availability','Use documented availability, including explicit unknown when needed.',i);
    const price=money(row.price);
    if(!price||!(price.amount>0))dataError(problems,'price','Use a positive price and ISO currency, verified against current seller truth.',i);
    if(row.sale_price!=null){
      const sale=money(row.sale_price);
      if(!price||!sale||sale.currency!==price.currency||!(sale.amount>0)||sale.amount>=price.amount)
        dataError(problems,'sale-price','Sale price must be positive, same currency and below regular price.',i);
    }
    if(row.sale_price_effective_date&&!row.sale_price)
      dataError(problems,'sale-period','Sale date metadata requires an actual sale price; it does not schedule price updates.',i);
    if(row.gtin!=null&&(!text(row.gtin)||!gtinValid(row.gtin)))
      dataError(problems,'gtin','Only use assigned GTINs with supported length and valid check digit.',i);
    if(row.listing_has_variations===true){
      if(!text(row.group_id)||row.group_id===row.item_id||!isRecord(row.variant_dict)
        ||!Object.keys(row.variant_dict).length
        ||Object.entries(row.variant_dict).some(([k,v])=>!text(k)||!text(v)))
        dataError(problems,'variant-identity','Variants need a distinct stable group_id and actual nonempty selected options.',i);
      else{
        const key=JSON.stringify([row.group_id,Object.entries(row.variant_dict).sort()]);
        if(variants.has(key))dataError(problems,'duplicate-variant','Two rows claim the same group and selected options.',i);
        variants.set(key,row.item_id);
      }
    }
    if(row.offer_id!=null){
      if(!text(row.offer_id)||offerIds.has(row.offer_id))dataError(problems,'duplicate-offer-id','Offer IDs must be stable, nonempty and unique.',i);
      offerIds.add(row.offer_id);
    }
    if(row.is_ads_eligible===true&&!partner.adsAccessApproved)
      dataError(problems,'ads-not-authorized','Ads flags do not grant paid Ads feed access.',i);
    if(row.is_eligible_checkout===true&&(!partner.checkoutApproved||row.is_eligible_search===false))
      dataError(problems,'checkout-not-authorized','Checkout requires separate approval and search eligibility.',i);
  });
  if(!partner.feedAccessApproved)watch.push('Partner feed approval not verified: local review only, no upload or feed publication.');
  watch.push('Compare each row to real current price, image, stock, seller and available offers; this local validation cannot prove those facts.');
  watch.push('Sale windows and expiration metadata do not schedule actual price or stock changes.');
  return{
    version:'0.1',kind:'openai-acp-stable-feed-preflight',
    state:problems.length?'needs-correction':partner.feedAccessApproved?'owner-review-ready':'partner-approval-required',
    rowsReviewed:products.length,problems,watch,
    partnerApprovedOwnerDeclared:partner.feedAccessApproved,
    adsApprovedOwnerDeclared:partner.adsAccessApproved,
    checkoutApprovedOwnerDeclared:partner.checkoutApproved,
    uploaded:false,submitted:false,advertised:false,rankingsEstablished:false,
    note:'Supported Stable file upload semantics only; Draft and Google-compatible feed modes are not inferred.'
  };
}
