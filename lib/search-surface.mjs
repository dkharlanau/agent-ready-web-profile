import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublicText } from './public-fetch.mjs';
import { analyzeSearchSurfacePages as analyzeSearchSurfacePagesCore, extractPageLinks } from './search-surface-core.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const registryPath=path.join(path.resolve(here,'..'),'registry','search-surface-blueprint.json');
export const SEARCH_SURFACE_VERSION='0.1';
export const SEARCH_SURFACE_RULESET='2026.09.07';
export function loadSearchSurfaceBlueprint(){const r=JSON.parse(fs.readFileSync(registryPath,'utf8'));if(r.version!==SEARCH_SURFACE_VERSION||r.ruleset!==SEARCH_SURFACE_RULESET)throw new Error(`Unsupported Search Surface Blueprint ${r.version}/${r.ruleset}`);return r}
function clean(v){try{const u=new URL(v);u.hash='';return u.href}catch{return null}}
function scopeFor(input){const u=new URL(input);u.hash='';u.search='';const pathPrefix=u.pathname.endsWith('/')?u.pathname:(u.pathname.slice(0,u.pathname.lastIndexOf('/')+1)||'/');return{origin:u.origin,pathPrefix}}
function sitemapUrls(xml,base){return[...String(xml||'').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(m=>{try{return clean(new URL(m[1].trim(),base).href)}catch{return null}}).filter(Boolean)}
function priority(u){const x=u.toLowerCase(),t=['/product','/software','/service','/docs','/updates','/news','/blog','/changelog','/release','/roadmap','/case-study','/evidence','/research','/dataset','/author','/maintainer','/about','/events','/compare','/trust'];const i=t.findIndex(k=>x.includes(k));return i<0?100:i}
export function analyzeSearchSurfacePages(input,options={}){return analyzeSearchSurfacePagesCore(input,{...options,registry:options.registry||loadSearchSurfaceBlueprint()})}
export async function analyzeSearchSurfaceSite(input,{kind='auto',timeoutMs=8000,maxBytes=512*1024,maxPages=20,fetchImpl=fetch,resolveImpl}={}){
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>50)throw new Error('maxPages must be an integer between 1 and 50.');const start=new URL(input);if(start.protocol!=='https:')throw new Error('Search Surface Blueprint requires a public HTTPS URL.');const scope=scopeFor(start.href),net={timeoutMs,maxBytes,fetchImpl,...(resolveImpl?{resolveImpl}:{})};
 const home=await fetchPublicText(start.href,{...net,accept:'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',userAgent:'arwp-surfaces/0.1'});if(!home.ok||!home.text)throw new Error(`Unable to fetch start page: HTTP ${home.status??'unknown'}`);
 const candidates=new Set([clean(home.url)]);for(const l of extractPageLinks(home.text,home.url)){const u=new URL(l.url);if(u.origin===scope.origin&&u.pathname.startsWith(scope.pathPrefix))candidates.add(l.url)}
 const sitemapUrl=new URL('sitemap.xml',scope.origin+scope.pathPrefix).href;const sm=await fetchPublicText(sitemapUrl,{...net,accept:'application/xml, text/xml;q=0.9, */*;q=0.1',userAgent:'arwp-surfaces/0.1'}).catch(()=>null);if(sm?.ok&&sm.text)for(const v of sitemapUrls(sm.text,sitemapUrl)){const u=new URL(v);if(u.origin===scope.origin&&u.pathname.startsWith(scope.pathPrefix))candidates.add(v)}
 const selected=[...candidates].filter(Boolean).sort((a,b)=>priority(a)-priority(b)||a.localeCompare(b)).slice(0,maxPages),pages=[{url:home.url,html:home.text,status:home.status}];for(const u of selected){if(clean(u)===clean(home.url))continue;const r=await fetchPublicText(u,{...net,accept:'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',userAgent:'arwp-surfaces/0.1'}).catch(()=>null);if(r?.ok&&r.text&&/html|xhtml/i.test(String(r.contentType||'text/html')))pages.push({url:r.url||u,html:r.text,status:r.status});if(pages.length>=maxPages)break}
 const report=analyzeSearchSurfacePagesCore(pages,{canonicalUrl:clean(home.url),kind,sitemapXml:sm?.ok?sm.text:null,sitemapUrl,registry:loadSearchSurfaceBlueprint()});report.discovery={startUrl:input,scope,sitemap:sm?.ok?sitemapUrl:null,candidates:candidates.size,selected:selected.length,maxPages,maxBytesPerPage:maxBytes,timeoutMs};return report
}
export function formatSearchSurfaceReport(r){const l=[`ARWP Search Surface Blueprint — ${r.canonicalUrl}`,`Site kind: ${r.siteKind.kind} (${r.siteKind.confidence})`,`Observed surfaces: ${r.summary.surfacesObserved.join(', ')||'none'}`,`Actions: ${r.summary.actions}; no universal score`,''];for(const x of r.actions){l.push(`${x.priority} [${x.lane}] ${x.title}`,`  ${x.reason}`)}l.push('','Roadmap, news, FAQ and other surfaces are conditional. Do not create thin pages merely to satisfy a checklist.');return l.join('\n')}
