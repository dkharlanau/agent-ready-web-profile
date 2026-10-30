/** Bounded cross-origin link observations and editorial proposals, not a ranking model. */
import {createHash} from 'node:crypto';
import {analyzeInternalDiscoveryFromPages} from './internal-discovery.mjs';
import {sourceMarkup,sourceText} from './html-source.mjs';

const idOk=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
const stamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
function pageUrl(value){
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash)return null;return u.href;}catch{return null;}
}
function attrs(tag){
  const out=new Map(),body=tag.replace(/^<[a-z][a-z0-9:-]*\b/i,'').replace(/\/?>$/,'');
  const re=/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;let match;
  while((match=re.exec(body))){const name=match[1].toLowerCase();if(out.has(name))return null;out.set(name,match[2]??match[3]??match[4]??'');}
  return out;
}
function decodeAttribute(value){
  let valid=true;
  const result=value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,(all,key)=>{
    const table={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
    if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);if(!n||n>0x10ffff||n>=0xd800&&n<=0xdfff){valid=false;return all;}return String.fromCodePoint(n);}
    if(Object.hasOwn(table,key.toLowerCase()))return table[key.toLowerCase()];valid=false;return all;
  });
  const remainder=value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,'');
  if(/&(?:#|[a-z])/i.test(remainder))valid=false;
  return valid?result:null;
}
function scanAnchors(html,url,maxAnchors){
  const markup=sourceMarkup(html),tags=()=>/<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9:-]*\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi;
  let base=url,count=0,partial=(html.match(/<svg\b[\s\S]*?<\/svg>/gi)||[]).some(svg=>/<a\b/i.test(svg)),baseSeen=false,match;const links=[];
  const bases=tags();
  while((match=bases.exec(markup))){
    if(!/^<base\b/i.test(match[0]))continue;
    const a=attrs(match[0]);if(!a){partial=true;continue;}
    if(!baseSeen&&a.has('href')){baseSeen=true;const decoded=decodeAttribute(a.get('href'));try{if(decoded===null)throw Error();base=new URL(decoded,url).href;}catch{partial=true;base=null;}}
  }
  const tokens=tags();
  while((match=tokens.exec(markup))){
    const tag=match[0];if(!/^<a\b/i.test(tag))continue;
    if(++count>maxAnchors){partial=true;break;}
    const a=attrs(tag);if(!a){partial=true;continue;}
    if(!a.has('href'))continue;
    const raw=decodeAttribute(a.get('href'));if(raw===null){partial=true;continue;}
    let dest;try{if(!base&&!/^[a-z][a-z0-9+.-]*:/i.test(raw))throw Error();dest=new URL(raw,base||url);}catch{partial=true;continue;}
    if(!['http:','https:'].includes(dest.protocol)||dest.username||dest.password)continue;
    const fragment=dest.hash||null;dest.hash='';
    const close=markup.toLowerCase().indexOf('</a',tokens.lastIndex);
    const anchor=close<0?null:sourceText(markup.slice(tokens.lastIndex,close)).slice(0,500)||null;
    links.push({url:dest.href,fragment,anchor});
  }
  return {links,partial};
}

/** Input pages are caller-supplied saved responses. This function performs no fetch. */
export function reviewCrossSiteRelations({sites,relations,maxAnchors=1000}){
  if(!Array.isArray(sites)||!sites.length||sites.length>8||!Array.isArray(relations)||relations.length>300||!Number.isInteger(maxAnchors)||maxAnchors<1||maxAnchors>5000)throw Error('Invalid bounded cross-site input');
  const byId=new Map(),origins=new Set();let pageCount=0,totalBytes=0;
  for(const site of sites){
    const root=pageUrl(site?.canonicalUrl);if(!idOk(site?.id)||!root||new URL(root).pathname!=='/'||new URL(root).search||byId.has(site.id)||origins.has(new URL(root).origin)||!Array.isArray(site.pages)||site.pages.length>50)throw Error('Invalid cross-site project');
    origins.add(new URL(root).origin);pageCount+=site.pages.length;if(pageCount>200)throw Error('Too many observed pages');
    const pages=new Map();
    for(const p of site.pages){const url=pageUrl(p?.requestedUrl);if(!url||new URL(url).origin!==new URL(root).origin||pages.has(url)||!stamp(p.observedAt)||typeof p.ok!=='boolean'||p.ok&&(!pageUrl(p.url)||!Number.isInteger(p.status)||p.status<200||p.status>=300||typeof p.contentType!=='string'||!p.contentType.trim())||p.html!==null&&typeof p.html!=='string'||p.ok&&typeof p.html!=='string'||typeof p.html==='string'&&Buffer.byteLength(p.html)>4*1024*1024)throw Error('Invalid saved page observation');totalBytes+=typeof p.html==='string'?Buffer.byteLength(p.html):0;if(totalBytes>64*1024*1024)throw Error('Saved HTML byte budget exceeded');pages.set(url,p);}
    const nodes=site.pages.length?analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:site.pages}).nodes:[];
    byId.set(site.id,{root,pages,nodes:new Map(nodes.map(n=>[n.requestedUrl,n]))});
  }
  const seen=new Set(),rows=[];
  for(const relation of relations){
    const from=byId.get(relation?.sourceSite),to=byId.get(relation?.targetSite),source=pageUrl(relation?.sourceUrl),target=pageUrl(relation?.targetUrl);
    if(!idOk(relation?.id)||seen.has(relation.id)||!from||!to||from===to||!source||!target||new URL(source).origin!==new URL(from.root).origin||new URL(target).origin!==new URL(to.root).origin||typeof relation.locale!=='string'||!/^([a-z]{2,3})(?:-[a-z0-9]{2,8})*$/i.test(relation.locale)||typeof relation.anchor!=='string'||!relation.anchor.trim()||/[\u0000-\u001f\u007f]/.test(relation.anchor)||relation.anchor.length>160||typeof relation.job!=='string'||!relation.job.trim()||/[\u0000-\u001f\u007f]/.test(relation.job)||relation.job.length>300)throw Error('Invalid editorial relation');
    seen.add(relation.id);
    const sourcePage=from.pages.get(source),targetPage=to.pages.get(target),sourceNode=from.nodes.get(source),targetNode=to.nodes.get(target);
    const describe=(page,node)=>page?{status:node?.nodeClass==='canonical-owner'&&!node.canonical?'canonical_unverified':node?.nodeClass??'unknown',canonical:node?.canonical??null,observedAt:page.observedAt,htmlSha256:typeof page.html==='string'?createHash('sha256').update(page.html).digest('hex'):null}:{status:'not_sampled',canonical:null,observedAt:null,htmlSha256:null};
    const sourceEvidence=describe(sourcePage,sourceNode),targetEvidence=describe(targetPage,targetNode);
    let link={status:'unknown',anchor:null,fragment:null};
    if(sourceNode?.nodeClass==='canonical-owner'&&sourcePage?.ok){
      const scan=scanAnchors(sourcePage.html,source,maxAnchors),found=scan.links.find(l=>l.url===target);
      link=found?{status:'observed_in_raw_html',anchor:found.anchor,fragment:found.fragment}:{status:scan.partial?'unknown':'not_seen_in_bounded_raw_html',anchor:null,fragment:null};
    }
    rows.push({id:relation.id,sourceSite:relation.sourceSite,targetSite:relation.targetSite,sourceUrl:source,targetUrl:target,locale:relation.locale,proposedAnchor:relation.anchor,job:relation.job,source:sourceEvidence,target:targetEvidence,link,editorialStatus:'proposed'});
  }
  return {schema:'cross-site-discovery-review/v1',rows,scope:'Caller-supplied bounded raw HTML; proposed semantic fit and locale require review. Link observation does not establish rendered visibility, indexing, ranking or user outcomes.'};
}

/** Render a bounded preview; the rows retain all caller-supplied proposals. */
export function formatCrossSiteDiscoveryMarkdown(review){
  if(review?.schema!=='cross-site-discovery-review/v1'||!Array.isArray(review.rows)||review.rows.length>300)throw Error('Invalid cross-site review');
  const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\|`\[\]])/g,'\\$1').replace(/[\r\n]+/g,' ');
  const urls=[],node=url=>{let i=urls.indexOf(url);if(i<0){i=urls.length;urls.push(url);}return `N${i+1}`;};
  const edges=review.rows.slice(0,40).map(r=>{
    if(pageUrl(r.sourceUrl)!==r.sourceUrl||pageUrl(r.targetUrl)!==r.targetUrl||!['observed_in_raw_html','not_seen_in_bounded_raw_html','unknown'].includes(r.link?.status))throw Error('Invalid cross-site review row');
    return `  ${node(r.sourceUrl)} -->|${r.link.status==='observed_in_raw_html'?'observed + proposed':'proposed'}| ${node(r.targetUrl)}`;
  });
  const lines=['# Cross-site discovery review','','Proposals and bounded raw HTML observations; no link is applied.','',`Showing ${edges.length} of ${review.rows.length} proposed relations in the graph.`,'','```mermaid','flowchart LR',...urls.map((_,i)=>`  N${i+1}["N${i+1}"]`),...edges,'```','',...urls.map((url,i)=>`- **N${i+1}** · <${url}>`),'','| Relation | Locale | Proposed anchor | Reader job | Captured link | Source / target evidence |','| --- | --- | --- | --- | --- | --- |'];
  for(const r of review.rows){
    const evidence=x=>`${escape(x.status)} · ${escape(x.observedAt??'unmeasured')} · ${escape(x.htmlSha256??'no hash')}`;
    lines.push(`| ${escape(r.id)} | ${escape(r.locale)} | ${escape(r.proposedAnchor)} | ${escape(r.job)} | ${escape(r.link.status)}${r.link.anchor?' · '+escape(r.link.anchor):''}${r.link.fragment?' · '+escape(r.link.fragment):''} | ${evidence(r.source)} / ${evidence(r.target)} |`);
  }
  lines.push('','Static observations do not establish rendered visibility, indexing, rankings, referral traffic or user outcomes. Unknown and out-of-sample states are not missing links.','');return lines.join('\n');
}
