import { buildSiteImprovementPlan as buildBasePlan, formatSiteImprovementPlan as formatBasePlan } from './site-improvement.mjs';
import { analyzeSearchSurfaceSite } from './search-surface.mjs';

const PRIORITY = { P0:0, P1:1, P2:2, P3:3 };
const EVIDENCE = { 'grounded-first-party':0, 'direct-observation':1, 'source-backed':2, 'manual-review':3, advisory:4 };

function surfaceAction(item) {
  return {
    id:`surface:${item.id}`,
    sourceKind:'search-surface',
    priority:item.priority || 'P2',
    lane:item.lane || 'surface-architecture',
    title:item.title,
    reason:item.reason,
    evidenceClass:item.evidenceClass || 'direct-observation',
    evidence:item.evidence || [],
    target:item.target || null,
    proposal:item.proposal || null,
    verification:item.verification || ['Re-run ARWP Search Surface Blueprint after deployment.'],
    measurement:item.measurement || ['Preserve owner-side before/after evidence; checklist completion does not prove ranking causality.'],
    dependencies:[],
    sourceCheck:item.sourceCheck || null
  };
}

function order(a,b) {
  return (PRIORITY[a.priority]??9)-(PRIORITY[b.priority]??9)
    || (EVIDENCE[a.evidenceClass]??9)-(EVIDENCE[b.evidenceClass]??9)
    || Number(!a.proposal)-Number(!b.proposal)
    || a.id.localeCompare(b.id);
}

function dedupe(items) {
  const seen=new Set();
  return items.sort(order).filter(item=>{
    const target=item.target?.file||item.target?.url||item.target?.entityId||item.target?.surface||'';
    const key=`${item.lane}|${String(item.title).toLowerCase()}|${target}`;
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function select(items,maxActions) {
  const out=[];
  for(const priority of ['P0','P1','P2','P3']) {
    const group=items.filter(item=>item.priority===priority&&!out.includes(item));
    const lanes=new Set();
    for(const item of group) {
      if(out.length>=maxActions) break;
      if(lanes.has(item.lane)) continue;
      out.push(item); lanes.add(item.lane);
    }
    for(const item of group) {
      if(out.length>=maxActions) break;
      if(!out.includes(item)) out.push(item);
    }
    if(out.length>=maxActions) break;
  }
  return out;
}

export function mergeSearchSurfacePlan(base,surfaces,{maxActions=8}={}) {
  const candidates=dedupe([...base.actions.map(({order,...item})=>item),...surfaces.actions.map(surfaceAction)]);
  const selected=select(candidates,maxActions);
  return {
    ...base,
    summary:{
      candidates:candidates.length,
      selected:selected.length,
      suppressed:candidates.length-selected.length,
      byPriority:selected.reduce((a,x)=>(a[x.priority]=(a[x.priority]||0)+1,a),{}),
      byLane:selected.reduce((a,x)=>(a[x.lane]=(a[x.lane]||0)+1,a),{})
    },
    actions:selected.map((item,index)=>({order:index+1,...item})),
    sourceSummary:{...(base.sourceSummary||{}),searchSurfaceActions:surfaces.actions.length,searchSurfaceChecks:surfaces.registrySummary.checks,searchSurfacesObserved:surfaces.summary.surfacesObserved.length},
    searchSurface:{
      ruleset:surfaces.ruleset,
      siteKind:surfaces.siteKind,
      pagesObserved:surfaces.summary.pagesObserved,
      surfacesObserved:surfaces.summary.surfacesObserved,
      actions:surfaces.summary.actions,
      guardrails:surfaces.guardrails
    },
    prioritization:{...(base.prioritization||{}),method:'priority-then-evidence-then-actionability-with-lane-diversity-across-growth-entities-pages-and-search-surfaces',maxActions},
    guardrails:{...(base.guardrails||{}),conditionalPageSurfaces:true,newsAndRoadmapAreNotUniversalRequirements:true,schemaSemanticsDoNotImplyRichResults:true}
  };
}

export async function buildSiteImprovementPlan(input, options={}) {
  const maxActions=options.maxActions||8;
  const [base,surfaces]=await Promise.all([
    buildBasePlan(input,{...options,maxActions:25}),
    analyzeSearchSurfaceSite(input,{
      kind:options.siteKind||'auto',
      timeoutMs:options.timeoutMs||8000,
      maxBytes:options.maxBytes||256*1024,
      maxPages:options.maxPages||12,
      fetchImpl:options.fetchImpl||fetch,
      ...(options.resolveImpl?{resolveImpl:options.resolveImpl}:{})
    })
  ]);
  return mergeSearchSurfacePlan(base,surfaces,{maxActions});
}

export function formatSiteImprovementPlan(plan) {
  const body=formatBasePlan(plan);
  const kind=plan.searchSurface?.siteKind?.kind;
  const observed=plan.searchSurface?.surfacesObserved?.join(', ');
  return `${body}\n\nSearch Surface Blueprint: ${kind||'unknown'}; observed surfaces: ${observed||'none'}. Optional surfaces remain conditional.`;
}
