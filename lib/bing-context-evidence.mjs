import { createHash } from 'node:crypto';

// Owner-normalized *provider-native* Bing AI Performance observations.
// This intentionally does NOT claim to parse arbitrary provider UI CSV headers,
// reconstruct exact prompts, identify partner AI surfaces or estimate search traffic.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z][a-z0-9._:-]{2,79}$/;
const HTTPS = /^https:\/\//i;
const DIRECTIONS = new Set(['query-to-page', 'page-to-query']);
const validDate = v => typeof v === 'string' && DATE.test(v)
  && Number.isFinite(Date.parse(v+'T00:00:00Z'))
  && new Date(v+'T00:00:00Z').toISOString().slice(0,10) === v;
const days = (a,b) => Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)+1;
const validTimestamp = v => typeof v==='string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const count = (v,label) => {
  if(!Number.isSafeInteger(v)||v<0)throw Error(label+' must be a nonnegative safe integer from provider evidence.');
  return v;
};
const optCount=(v,label)=>v==null?null:count(v,label);
function ids(items,label){
  if(!Array.isArray(items)||items.length>10000)throw Error(label+' must be a bounded array.');
  const seen=new Set();
  for(const item of items){
    if(!isRecord(item)||typeof item.id!=='string'||!ID.test(item.id)||seen.has(item.id))
      throw Error(label+' includes invalid/duplicate private IDs.');
    seen.add(item.id);
  }
  return seen;
}
function pageUrl(url,site){
  if(typeof url!=='string'||url.length>2048||!HTTPS.test(url))throw Error('Page URLs must be absolute HTTPS.');
  const p=new URL(url),owner=new URL(site);
  if(p.origin!==owner.origin||p.username||p.password||p.search||p.hash)
    throw Error('Cited page URL must match the owner site and be free of tracking/query fragments.');
  if(!p.pathname.startsWith(owner.pathname))throw Error('Cited page must stay within owner property prefix.');
  return p.href;
}
function fingerprintPages(site,pages){
  const pairs=pages.map(x=>[x.id,pageUrl(x.canonicalUrl,site)]).sort((a,b)=>a[0].localeCompare(b[0]));
  return createHash('sha256').update(JSON.stringify([site,pairs])).digest('hex');
}
function validated(source){
  if(!isRecord(source)||source.version!=='0.1'||source.provider!=='bing-webmaster-ai-performance'
    ||source.sourceClass!=='owner-normalized' ||source.sourceVerifiedByGoose!==false
    ||typeof source.site!=='string'||!HTTPS.test(source.site)||!validTimestamp(source.capturedAt)
    ||!isRecord(source.period)||!validDate(source.period.start)||!validDate(source.period.end)
    ||days(source.period.start,source.period.end)<1||days(source.period.start,source.period.end)>365
    ||!['owner-final','partial','unknown'].includes(source.period.dataState)
    ||!isRecord(source.guardrails)||source.guardrails.sampledNotComplete!==true
    ||source.guardrails.notRankingOrTraffic!==true)
    throw Error('Bing owner context v0.1 requires exact provider, dates, owner provenance and non-ranking guardrails.');
  if(Date.parse(source.capturedAt)<Date.parse(source.period.end+'T00:00:00Z'))
    throw Error('Bing observation cannot be captured before the period ends.');
  const queryIds=ids(source.queries,'queries');
  const pageIds=ids(source.pages,'pages');
  if(source.pages.length)for(const item of source.pages)pageUrl(item.canonicalUrl,source.site);
  const pageFinger=fingerprintPages(source.site,source.pages);
  if(!Array.isArray(source.queryContext)||source.queryContext.length>5000)
    throw Error('A bounded queryContext array is required.');
  const contextIds=new Set();
  for(const item of source.queryContext){
    if(!isRecord(item)||!queryIds.has(item.queryId)||contextIds.has(item.queryId))
      throw Error('Query context must link to one known queryId, with no duplicate context rows.');
    contextIds.add(item.queryId);
    if(item.intent!=null&&(typeof item.intent!=='string'||item.intent.length>120))throw Error('Intent must be a bounded provider label or null.');
    if(item.topicId!=null&&(!ID.test(item.topicId)||!source.topics?.some(t=>t.id===item.topicId)))
      throw Error('Topic IDs must resolve to explicitly owner-provided topic entries.');
    if(item.citationSharePercent!=null&&(!Number.isFinite(item.citationSharePercent)
      ||item.citationSharePercent<0||item.citationSharePercent>100))
      throw Error('Bing Citation Share must be a query-scoped percentage from 0 to 100, not traffic share.');
    optCount(item.citations,'Query-level citation count');
  }
  ids(source.topics||[],'topics');
  const observations=source.pageQueryObservations;
  if(!Array.isArray(observations)||observations.length>20000)
    throw Error('pageQueryObservations must be a bounded array of *filtered* provider projections.');
  const rowKeys=new Set();
  for(const row of observations){
    if(!isRecord(row)||!DIRECTIONS.has(row.direction)||!queryIds.has(row.queryId)||!pageIds.has(row.pageId))
      throw Error('Bing page/query mapping requires known query, page and filtered direction.');
    const filter= row.direction==='query-to-page'?row.filterQueryId:row.filterPageId;
    if(filter!==(row.direction==='query-to-page'?row.queryId:row.pageId))
      throw Error('Each Bing page/query mapping requires its actual matching UI-export filter.');
    count(row.citations,'Filtered mapping citation count');
    const key=JSON.stringify([row.direction,row.queryId,row.pageId]);
    if(rowKeys.has(key))throw Error('Duplicate filtered Bing page/query projection row.');
    rowKeys.add(key);
  }
  if(!Array.isArray(source.timeline)||source.timeline.length>370)throw Error('A bounded optional site citation timeline is required.');
  const timelineDays=new Set();
  for(const row of source.timeline){
    if(!isRecord(row)||!validDate(row.date)||row.date<source.period.start||row.date>source.period.end
      ||timelineDays.has(row.date))throw Error('Timeline dates must be unique and within the selected provider window.');
    count(row.citations,'Site timeline citation count');
    timelineDays.add(row.date);
  }
  if(source.queries.some(q=>Object.keys(q).some(k=>!['id'].includes(k)))
    || source.topics.some(t=>Object.keys(t).some(k=>!['id'].includes(k))))
    throw Error('Use opaque query/topic IDs in this portable evidence contract. Keep raw query/topic text in the private owner export.');
  return {queryIds,pageIds,pageFinger};
}

export function reviewBingContext(source){
  const v=validated(source);
  const context=source.queryContext.map(c=>({
    queryId:c.queryId,intent:c.intent||null,topicId:c.topicId||null,
    citationSharePercent:c.citationSharePercent??null,citations:c.citations??null
  }));
  const byDirection={ 'query-to-page':[], 'page-to-query':[] };
  for(const row of source.pageQueryObservations){
    byDirection[row.direction].push({queryId:row.queryId,pageId:row.pageId,citations:row.citations});
  }
  return{
    version:'0.1',kind:'bing-ai-owner-context-review',site:source.site,
    period:{...source.period},capturedAt:source.capturedAt,
    provider:'bing-webmaster-ai-performance',sourceAuthenticatedByGoose:false,
    pageMapFingerprint:v.pageFinger,
    queriesRegistered:v.queryIds.size,pagesRegistered:v.pageIds.size,
    context,filteredProjections:byDirection,
    siteCitationTimeline:source.timeline.map(x=>({date:x.date,citations:x.citations})),
    state:source.period.dataState==='owner-final'?'owner-declared-final':'provider-finality-unconfirmed',
    noOutcomeDecision:true,causalImpactEstablished:false,
    limitations:[
      'Bing grounding queries are grouped retrieval phrases, not exact user prompts or individual AI answers.',
      'The AI Performance report is sampled; reverse filters may produce different counts. Never sum the two filtered projections or infer missing citations as zero.',
      'Citation Share belongs to one grounding query and is not traffic, ranking, authority or a sitewide quality score.',
      'Intents and Topics are preview classifications and may be ambiguous or incorrect for specialized domains.',
      'Daily site citation totals are a different provider population from page/query projection rows.',
      'Source rows are owner-normalized and not authenticated by Goose; keep original exports and exact UI filters privately.'
    ]
  };
}
function checkReview(report,name){
  if(!isRecord(report)||report.kind!=='bing-ai-owner-context-review'||report.version!=='0.1'
    ||report.sourceAuthenticatedByGoose!==false||report.noOutcomeDecision!==true
    ||report.state!=='owner-declared-final'||!isRecord(report.period))
    throw Error(name+' needs a final, local descriptive Bing AI Context review.');
}
export function compareBingContext(before,after){
  checkReview(before,'Before');checkReview(after,'After');
  if(before.site!==after.site||before.pageMapFingerprint!==after.pageMapFingerprint)
    throw Error('Bing periods must have exactly the same site and owner-mapped pages.');
  if(days(before.period.start,before.period.end)!==days(after.period.start,after.period.end)
    ||before.period.end>=after.period.start)
    throw Error('Compare only equal-length nonoverlapping Bing owner windows.');
  const previous=new Map(before.context.map(x=>[x.queryId,x]));
  const later=new Map(after.context.map(x=>[x.queryId,x]));
  const intersection=[...previous.keys()].filter(id=>later.has(id));
  const queryRows=intersection.map(id=>{
    const a=previous.get(id),b=later.get(id);
    const haveShares=a.citationSharePercent!=null&&b.citationSharePercent!=null;
    return{
      queryId:id,beforeCitations:a.citations,afterCitations:b.citations,
      beforeSharePercent:a.citationSharePercent,afterSharePercent:b.citationSharePercent,
      citationSharePointChange:haveShares?Math.round((b.citationSharePercent-a.citationSharePercent)*1000)/1000:null,
      beforeIntent:a.intent,afterIntent:b.intent,
      beforeTopicId:a.topicId,afterTopicId:b.topicId
    };
  });
  return{
    version:'0.1',kind:'bing-ai-period-comparison',site:before.site,
    before:before.period,after:after.period,matchedQueryIds:intersection.length,
    missingBeforeQueryIds:[...later.keys()].filter(id=>!previous.has(id)),
    missingAfterQueryIds:[...previous.keys()].filter(id=>!later.has(id)),
    comparisons:queryRows,
    noOutcomeDecision:true,causalImpactEstablished:false,
    limitations:[
      'Query Citation Share point changes are provider observations for the identical owner query ID, not ranking, traffic or causal impact.',
      'Missing query rows are unknown, not verified zero; sampled query and page lists may differ across time.',
      'An intent/topic classification change can reflect preview model labeling drift rather than site content change.'
    ]
  };
}
