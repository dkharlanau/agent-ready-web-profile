import { fetchPublicText } from './public-fetch.mjs';

const TYPES = {
  Person:'Person', Organization:'Organization', Corporation:'Organization', LocalBusiness:'Organization',
  Product:'Product', ProductGroup:'Product',
  SoftwareApplication:'Software', WebApplication:'Software', MobileApplication:'Software',
  Service:'Service', Dataset:'Dataset', DefinedTerm:'DefinedTerm',
  Article:'Article', TechArticle:'Article', BlogPosting:'Article', NewsArticle:'Article', ScholarlyArticle:'Article'
};
const RELS = ['about','author','brand','creator','hasPart','inDefinedTermSet','isPartOf','isRelatedTo','itemOffered','mainEntity','maintainer','mentions','organizer','provider','publisher','subjectOf','workFeatured'];
const REQUIRED = {
  Article:[['author','P1','Article-family entity has no explicit author relation.']],
  Dataset:[['creator|publisher','P1','Dataset has neither creator nor publisher relation.'],['license','P1','Dataset has no explicit license.']],
  DefinedTerm:[['inDefinedTermSet','P2','DefinedTerm is not linked to a DefinedTermSet.']],
  Event:[['startDate','P1','Event-family entity has no startDate.'],['location','P1','Event-family entity has no location or VirtualLocation.']],
  Service:[['provider','P1','Service has no explicit provider relation.']],
  Software:[['maintainer|author|provider','P2','Software entity is not linked to a maintainer, author, or provider.']]
};

const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const norm = v => String(v || '').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim().toLowerCase();
const visible = html => norm(String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));

function attrs(tag) {
  const out={}; const body=String(tag||'').replace(/^<\/?[A-Za-z0-9:-]+\s*/i,'').replace(/\/?\s*>$/,'');
  const re=/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g; let m;
  while((m=re.exec(body))) out[m[1].toLowerCase()]=m[2]??m[3]??m[4]??'';
  return out;
}
function resolve(v,base){ if(typeof v!=='string'||!v.trim()) return null; try{return new URL(v,base).href}catch{return null} }
function baseId(v){ try{const u=new URL(v);u.hash='';return u.href}catch{return null} }
function samePage(a,b){ if(!a||!b)return false; try{const x=new URL(a),y=new URL(b);x.hash='';y.hash='';const p=u=>u.pathname==='/'?'/':u.pathname.replace(/\/+$/,'');return x.origin===y.origin&&p(x)===p(y)&&x.search===y.search}catch{return false} }
function canonical(html,fallback){
  for(const tag of String(html||'').match(/<link\b[^>]*>/gi)??[]){const a=attrs(tag);if(String(a.rel||'').toLowerCase().split(/\s+/).includes('canonical')&&a.href){const u=resolve(a.href,fallback);if(u)return u}}
  return fallback;
}
function blocks(html){
  const out=[]; const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while((m=re.exec(String(html||'')))){const a=attrs(`<script ${m[1]}>`);if(String(a.type||'').toLowerCase()!=='application/ld+json')continue;try{out.push({value:JSON.parse(m[2])})}catch(e){out.push({error:e.message})}}
  return out;
}
function nodes(v){ if(!v||typeof v!=='object')return[];if(Array.isArray(v))return v.flatMap(nodes);return Array.isArray(v['@graph'])?v['@graph'].filter(x=>x&&typeof x==='object'):[v] }
function family(types){ for(const t of types){if(TYPES[t])return TYPES[t];if(/Event$/.test(t))return'Event'}return null }
function refs(v,base){return arr(v).map(x=>typeof x==='string'?resolve(x,base):x&&typeof x==='object'?resolve(x['@id']||x.url,base):null).filter(Boolean)}
function relations(node,base){return RELS.flatMap(k=>refs(node[k],base).map(target=>({relation:k,target})))}
function has(node,key){return key.split('|').some(k=>node[k]!=null&&arr(node[k]).length)}
function observe(page){
  const c=canonical(page.html,page.url), text=visible(page.html), parseErrors=[], jsonLdNodes=[];
  for(const b of blocks(page.html)){if(b.error)parseErrors.push(b.error);else jsonLdNodes.push(...nodes(b.value))}
  return {...page,canonicalUrl:c,visibleText:text,parseErrors,jsonLdNodes};
}
function gap(id,priority,e,problem,recommendation){return{id,priority,family:e.family,entityId:e.id,entityName:e.name,problem,recommendation,evidence:e.sourcePages}}

function build(pages,{canonicalUrl=pages[0]?.canonicalUrl||null,source='provided-pages'}={}){
  const raw=[], allIds=new Set(), mainByPage=new Map();
  for(const p of pages){
    const main=new Set();
    for(const n of p.jsonLdNodes){const id=resolve(n['@id']||n.url,p.canonicalUrl);if(id)allIds.add(id);refs(n.mainEntity,p.canonicalUrl).forEach(x=>main.add(x))}
    mainByPage.set(p.canonicalUrl,main);
    let anon=0;
    for(const n of p.jsonLdNodes){
      const types=arr(n['@type']).map(String), f=family(types); if(!f)continue;
      const declaredUrl=resolve(n.url,p.canonicalUrl), stable=resolve(n['@id'],p.canonicalUrl), id=stable||declaredUrl||`${p.canonicalUrl}#arwp-anonymous-${f.toLowerCase()}-${++anon}`;
      const name=typeof n.name==='string'?n.name.trim():null;
      raw.push({id,family:f,types,node:n,name,stableId:Boolean(stable),declaredUrl,page:p.canonicalUrl,visibleName:Boolean(name&&p.visibleText.includes(norm(name))),relations:relations(n,p.canonicalUrl)});
    }
  }
  const merged=new Map();
  for(const x of raw){
    const e=merged.get(x.id)||{id:x.id,family:x.family,types:new Set(),names:new Set(),declaredUrls:new Set(),sourcePages:new Set(),observations:[],relations:[],stableId:false,properties:{}};
    x.types.forEach(t=>e.types.add(t)); if(x.name)e.names.add(x.name);if(x.declaredUrl)e.declaredUrls.add(x.declaredUrl);e.sourcePages.add(x.page);e.observations.push(x);e.relations.push(...x.relations);e.stableId||=x.stableId;Object.assign(e.properties,x.node);merged.set(x.id,e);
  }
  const entities=[...merged.values()].map(e=>{
    const name=[...e.names][0]||null, declaredUrls=[...e.declaredUrls], sourcePages=[...e.sourcePages];
    const inbound=raw.flatMap(s=>s.relations.filter(r=>r.target===e.id||r.target===baseId(e.id)).map(r=>({relation:r.relation,source:s.id})));
    const pageObserved=e.observations.some(o=>o.visibleName) || [...mainByPage.values()].some(set=>set.has(e.id)||set.has(baseId(e.id)));
    return {id:e.id,family:e.family,types:[...e.types],name,name,nameVariants:[...e.names],stableId:e.stableId,declaredUrls,sourcePages,visibleNameParity:e.observations.some(o=>o.visibleName),entityPageObserved:pageObserved,relations:e.relations,relationKeys:[...new Set(e.relations.map(r=>r.relation))],inboundRelations:inbound,properties:e.properties};
  });
  const gaps=[];
  for(const e of entities){
    if(!e.stableId)gaps.push(gap(`stable-id:${e.id}`,'P1',e,'Entity is described without a stable absolute @id.','Assign one canonical absolute @id and reuse it across pages.'));
    if(!e.visibleNameParity)gaps.push(gap(`visible-parity:${e.id}`,'P1',e,'Entity name exists in structured data but not in visible text on an observed page.','Ground the entity in visible first-party content or remove unsupported machine-only facts.'));
    if(!e.entityPageObserved)gaps.push(gap(`entity-page:${e.id}`,'P1',e,'No observed useful page visibly describes this entity.','Reuse an existing useful route or create a real entity page; do not create a thin page only for markup.'));
    for(const [key,p,msg] of REQUIRED[e.family]||[])if(!has(e.properties,key))gaps.push(gap(`property:${e.family.toLowerCase()}:${key}:${e.id}`,p,e,msg,`Add ${key.replace('|',' or ')} only when the fact is known and grounded.`));
    if(!e.relations.length&&!e.inboundRelations.length)gaps.push(gap(`orphan:${e.id}`,'P2',e,'Entity is structurally isolated from the other observed entities.','Add truthful relations such as author, provider, publisher, about, isPartOf, inDefinedTermSet, or isRelatedTo.'));
    if(new Set(e.nameVariants.map(norm).filter(Boolean)).size>1)gaps.push(gap(`identity-conflict:${e.id}`,'P1',e,'The same @id has conflicting primary names.','Resolve identity drift before adding more structured data.'));
  }
  const siteOrigin=canonicalUrl?new URL(canonicalUrl).origin:null;let totalRelations=0,unresolvedInternal=0;
  for(const e of entities)for(const r of e.relations){totalRelations++;try{const u=new URL(r.target);if(siteOrigin&&u.origin===siteOrigin&&!allIds.has(r.target)&&!allIds.has(baseId(r.target)))unresolvedInternal++}catch{}}
  const order={P0:0,P1:1,P2:2,P3:3};gaps.sort((a,b)=>(order[a.priority]??9)-(order[b.priority]??9)||a.id.localeCompare(b.id));
  const families={};entities.forEach(e=>families[e.family]=(families[e.family]||0)+1);
  const parseErrors=pages.flatMap(p=>p.parseErrors.map(error=>({page:p.canonicalUrl,error})));
  return {
    reportVersion:'0.1',generatedAt:new Date().toISOString(),canonicalUrl,scope:'bounded-observed-entity-graph-not-ranking-score',source,
    pages:pages.map(p=>({url:p.url,canonicalUrl:p.canonicalUrl,status:p.status??200,jsonLdNodes:p.jsonLdNodes.length,parseErrors:p.parseErrors.length})),
    entityFamilies:families,entities:entities.map(({properties,...e})=>e),gaps,
    summary:{pagesObserved:pages.length,entitiesObserved:entities.length,familiesObserved:Object.keys(families).length,stableIds:{observed:entities.filter(e=>e.stableId).length,total:entities.length},entityPages:{observed:entities.filter(e=>e.entityPageObserved).length,total:entities.length},visibleNameParity:{observed:entities.filter(e=>e.visibleNameParity).length,total:entities.length},relations:{observed:totalRelations,unresolvedInternal},gaps:gaps.reduce((a,g)=>(a[g.priority]=(a[g.priority]||0)+1,a),{P0:0,P1:0,P2:0,P3:0}),jsonLdParseErrors:parseErrors.length},
    parseErrors,guardrails:{noRankingPromise:true,noUniversalSchemaBundle:true,visibleFactsBeforeMetadata:true,missingEntityTypeIsNotAutomaticallyAGap:true,noThinEntityPages:true,noInventedRatingsReviewsPricesPeopleEventsOrCredentials:true},
    doesNotProve:['search ranking or rich-result eligibility','AI citation or recommendation inclusion','identity authority outside observed first-party pages','completeness beyond the bounded crawl','business legitimacy, trustworthiness, or conversion impact']
  };
}
function scope(input){const u=new URL(input);u.hash='';u.search='';let pathPrefix=u.pathname;if(!pathPrefix.endsWith('/'))pathPrefix=pathPrefix.slice(0,pathPrefix.lastIndexOf('/')+1)||'/';return{origin:u.origin,pathPrefix}}
function links(html,base,s){const out=new Set();for(const tag of String(html||'').match(/<a\b[^>]*>/gi)??[]){const a=attrs(tag);if(!a.href)continue;const u=resolve(a.href,base);if(!u)continue;const x=new URL(u);x.hash='';if(x.protocol==='https:'&&x.origin===s.origin&&x.pathname.startsWith(s.pathPrefix))out.add(x.href)}return[...out]}
function sitemapUrls(xml,base){return[...String(xml||'').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(m=>resolve(m[1].trim(),base)).filter(Boolean)}
function priority(u){const x=u.toLowerCase(),t=['/about','/author','/team','/product','/software','/service','/dataset','/data','/event','/glossary','/concept','/article','/blog','/research'];const i=t.findIndex(k=>x.includes(k));return i<0?100:i}

export async function analyzeEntityGraphSite(input,{timeoutMs=8000,maxBytes=256*1024,maxPages=12,fetchImpl=fetch,resolveImpl}={}){
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>50)throw new Error('maxPages must be an integer between 1 and 50.');
  const start=new URL(input);if(start.protocol!=='https:')throw new Error('Entity graph analysis requires a public HTTPS URL.');
  const s=scope(start.href),net={timeoutMs,maxBytes,fetchImpl,...(resolveImpl?{resolveImpl}:{})};
  const home=await fetchPublicText(start.href,{...net,accept:'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',userAgent:'arwp-entities/0.1'});
  if(!home.ok||!home.text)throw new Error(`Unable to fetch start page: HTTP ${home.status??'unknown'}`);
  const homeObs=observe({url:home.url,html:home.text,status:home.status}),candidates=new Set([home.url,...links(home.text,home.url,s)]);
  const sitemapUrl=new URL('sitemap.xml',s.origin+s.pathPrefix).href;
  const sm=await fetchPublicText(sitemapUrl,{...net,accept:'application/xml, text/xml;q=0.9, */*;q=0.1',userAgent:'arwp-entities/0.1'}).catch(()=>null);
  if(sm?.ok&&sm.text)for(const u of sitemapUrls(sm.text,sitemapUrl)){const x=new URL(u);if(x.origin===s.origin&&x.pathname.startsWith(s.pathPrefix))candidates.add(x.href)}
  const selected=[...candidates].sort((a,b)=>priority(a)-priority(b)||a.localeCompare(b)).slice(0,maxPages),pages=[homeObs];
  for(const u of selected){if(samePage(u,home.url))continue;const f=await fetchPublicText(u,{...net,accept:'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',userAgent:'arwp-entities/0.1'}).catch(()=>null);if(f?.ok&&f.text&&/html|xhtml/i.test(String(f.contentType||'text/html')))pages.push(observe({url:f.url||u,html:f.text,status:f.status}));if(pages.length>=maxPages)break}
  const report=build(pages,{canonicalUrl:homeObs.canonicalUrl,source:'bounded-public-crawl'});report.discovery={startUrl:input,scope:s,sitemap:sm?.ok?sitemapUrl:null,candidateUrls:candidates.size,selectedUrls:selected.length,maxPages,maxBytesPerPage:maxBytes,timeoutMs};return report;
}
export function analyzeEntityGraphPages(pages,options={}){if(!Array.isArray(pages)||!pages.length)throw new Error('pages must be a non-empty array.');return build(pages.map(p=>{if(!p?.url||typeof p.html!=='string')throw new Error('Each page requires url and html.');return observe({url:p.url,html:p.html,status:p.status??200})}),options)}
export function formatEntityGapReport(r){const l=[`Entity Graph Gap Report — ${r.canonicalUrl}`,`Scope: ${r.scope}`,`Pages observed: ${r.summary.pagesObserved}`,`Entities: ${r.summary.entitiesObserved} across ${r.summary.familiesObserved} families`,`Stable IDs: ${r.summary.stableIds.observed}/${r.summary.stableIds.total}`,`Visible-name parity: ${r.summary.visibleNameParity.observed}/${r.summary.visibleNameParity.total}`,`Entity pages: ${r.summary.entityPages.observed}/${r.summary.entityPages.total}`,`Relations: ${r.summary.relations.observed} observed; ${r.summary.relations.unresolvedInternal} unresolved internal`,`Gaps: P0 ${r.summary.gaps.P0}, P1 ${r.summary.gaps.P1}, P2 ${r.summary.gaps.P2}, P3 ${r.summary.gaps.P3}`];for(const g of r.gaps)l.push(`${g.priority} ${g.family} ${g.entityName||g.entityId||''} — ${g.problem}`,`  Fix: ${g.recommendation}`);if(!r.gaps.length)l.push('No structural entity-graph gaps were observed in the bounded scope.');l.push('Guardrail: this is observed structural evidence, not a ranking, rich-result, trust, or citation score.');return l.join('\n')}
