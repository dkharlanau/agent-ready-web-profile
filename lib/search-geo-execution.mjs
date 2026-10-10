import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// One status per researched opportunity, without elevating research to a live
// Search rule or inventing a target site's eligibility from a URL/hostname.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEFAULT_RESEARCH=path.join(root,'research/product/2026-10-10-search-geo-deep-run.json');
const DEFAULT_POLICY=path.join(root,'registry/search-geo-execution-policy.json');
const MODES=new Set(['local-review','owner-evidence','sandbox','watch-only','conditional-local','approved-program']);
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function loadSeoGeoExecutionSources({researchPath=DEFAULT_RESEARCH,policyPath=DEFAULT_POLICY}={}){
  return{research:JSON.parse(fs.readFileSync(researchPath,'utf8')),
    policy:JSON.parse(fs.readFileSync(policyPath,'utf8'))};
}
export function validateSeoGeoExecutionSources({research,policy}){
  if(!isRecord(research)||!Array.isArray(research.opportunities)||
    !isRecord(policy)||policy.version!=='0.1'||!Array.isArray(policy.records))
    throw Error('SEO/GEO execution policy and canonical research v0.1 are required.');
  const ids=new Map();
  for(const o of research.opportunities){
    if(!o.id||ids.has(o.id)||!['P0','P1','P2'].includes(o.priority))throw Error('Invalid/duplicate researched SEO/GEO opportunity ID.');
    ids.set(o.id,o);
  }
  const rows=new Map();
  for(const p of policy.records){
    if(!p.id||rows.has(p.id)||!ids.has(p.id)||!MODES.has(p.mode)
      ||p.priority!==ids.get(p.id).priority||!Array.isArray(p.requires)
      ||!p.requires.every(x=>typeof x==='string'&&/^([a-z][A-Za-z0-9]{2,59})$/.test(x))
      ||new Set(p.requires).size!==p.requires.length
      ||typeof p.existingTool!=='string'||p.existingTool.startsWith('/')||p.existingTool.includes('..'))
      throw Error('Unexpected execution mode, priority, duplicate ID, gate or tool path: '+String(p.id));
    rows.set(p.id,p);
  }
  if(rows.size!==ids.size)throw Error('All researched opportunities need exactly one policy with no extra features.');
  return{
    opportunityCount:ids.size,
    factKeys:[...new Set([...rows.values()].flatMap(p=>p.requires))].sort(),
    ids,rows
  };
}
export function compileSeoGeoExecution(ownerContext,{sources=loadSeoGeoExecutionSources()}={}){
  const contract=validateSeoGeoExecutionSources(sources);
  if(!isRecord(ownerContext)||ownerContext.version!=='0.1'
    ||typeof ownerContext.site!=='string'||!/^https:\/\//.test(ownerContext.site)
    ||!isRecord(ownerContext.facts)||typeof ownerContext.ownerReviewed!=='boolean')
    throw Error('An explicit v0.1 HTTPS owner context with ownerReviewed and boolean/null facts is required.');
  const site=new URL(ownerContext.site);
  if(site.username||site.password||site.search||site.hash)
    throw Error('The declared canonical site must not contain credentials, tracking queries or URL fragments.');
  const recognized=new Set(contract.factKeys);
  for(const [key,value] of Object.entries(ownerContext.facts)){
    if(!recognized.has(key)||!(value===true||value===false||value===null))
      throw Error('Unexpected or non-boolean owner fact: '+key);
  }
  const results=sources.research.opportunities.map(o=>{
    const policy=contract.rows.get(o.id);
    const falseGates=policy.requires.filter(k=>ownerContext.facts[k]===false);
    const unknownGates=policy.requires.filter(k=>ownerContext.facts[k]==null);
    const approvalFalse=falseGates.filter(k=>/Approved|Approval|Access$/.test(k));
    const blockedByApproval=policy.mode==='approved-program'&&approvalFalse.length>0
      &&falseGates.length===approvalFalse.length;
    const existingSourcePath=policy.existingTool;
    const sourcePresent=fs.existsSync(path.join(root,existingSourcePath));
    let executionState,reason;
    if(policy.mode==='watch-only'){
      executionState='watch-only';reason='A draft or emerging convention cannot be turned into a publisher requirement.';
    } else if(falseGates.length){
      executionState=blockedByApproval?'program-approval-not-granted':'not-applicable-to-declared-site';
      reason='An explicitly owner-declared prerequisite is false: '+falseGates.join(', ')+'.';
    } else if(unknownGates.length){
      executionState='awaiting-owner-facts';
      reason='Do not infer missing publisher eligibility or measurement access: '+unknownGates.join(', ')+'.';
    } else if(!sourcePresent){
      executionState='implementation-reference-missing';
      reason='The referenced existing documentation/tool is not available in the current checkout.';
    } else if(!ownerContext.ownerReviewed&&policy.requires.length){
      executionState='requires-owner-review';
      reason='Facts were supplied but the owner has not verified the applicability decision.';
    } else if(policy.mode==='local-review'){
      executionState='local-review-available';reason='Goose has a local review/tool entry point; this is not a completed site improvement.';
    } else if(policy.mode==='sandbox'){
      executionState='sandbox-only';reason='Experiment must be scoped to a real authorized browser/consumer and safety-evaluated.';
    } else if(policy.mode==='approved-program'){
      executionState='partner-approval-check';reason='Owner-declared program access permits a separate implementation review, not automatic feed publication.';
    } else if(policy.mode==='owner-evidence'){
      executionState='owner-evidence-review-ready';reason='Owner declares access; validate private provider data and exact scope before any outcome claim.';
    } else {
      executionState='eligible-for-bounded-implementation-review';reason='The owner-declared site prerequisites allow a small reviewed change, not automatic publication.';
    }
    return{
      id:o.id,priority:o.priority,title:o.title,mode:policy.mode,
      executionState,reason,requirements:policy.requires,
      existingOwnerPath:existingSourcePath,existingOwnerPathObserved:sourcePresent,
      firstStep:o.action,check:o.check,stop:o.skip,
      sourceUrls:o.primarySources,
      claimOfCompletedImplementation:false,claimOfSearchOutcome:false
    };
  });
  const stateCounts={};const byPriority={P0:0,P1:0,P2:0};
  for(const row of results){stateCounts[row.executionState]=(stateCounts[row.executionState]||0)+1;byPriority[row.priority]++;}
  return{
    version:'0.1',kind:'seo-geo-research-execution-plan',site:site.href,
    ownerReviewed:ownerContext.ownerReviewed,sourceResearch:sources.policy.source,
    summary:{total:results.length,byPriority,byExecutionState:stateCounts},
    opportunities:results,
    limits:[
      'This is a decision/eligibility plan for researched ideas; it is not an automatic change plan or ranking score.',
      'Unknown owner facts stay unknown. A true flag is an owner declaration, not independently verified provider access or permission.',
      'An existing tool means reusable code or docs exist; it is not proof that the target capability is deployed or that the site got more traffic.',
      'No third-party business, UGC, ads, video, local supplier or ACP program is activated without verified eligibility and separate permission.',
      'Site changes must use the existing repository-authority and exact deployment/evidence review gates.'
    ],
    noAutomaticTargetMutation:true,noRankingPromise:true,noInventedOwnerResults:true
  };
}
