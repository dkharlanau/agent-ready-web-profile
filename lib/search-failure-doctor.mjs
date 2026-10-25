/**
 * One-action Search failure triage over existing bounded Technical Integrity
 * evidence and optional, explicitly owner-supplied observations.
 *
 * This is not a ranking estimator, a Google API adapter or an experiment truth
 * store. Unknown, preliminary and synthetic observations never become zeros.
 */

export const SEARCH_FAILURE_DOCTOR_VERSION = '0.1';
export const REPAIR_RECEIPT_MAX_AGE_DAYS = 7;
export const PUBLICATION_POLICY_MAX_AGE_DAYS = 7;
export const SEARCH_EVIDENCE_MAX_AGE_DAYS = 30;

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object.');
  }
  return value;
}

function siteKey(value) {
  if (typeof value !== 'string') throw new Error('An HTTPS site URL is required.');
  let url;
  try { url = new URL(value); } catch { throw new Error('An absolute HTTPS site URL is required.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Site identity must be an HTTPS URL without credentials, query or fragment.');
  }
  const pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url.origin + pathname;
}

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(Date.parse(value + 'T00:00:00Z'))
    || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be a valid YYYY-MM-DD date.');
  }
  return value;
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + ' must be a non-negative safe integer.');
  }
  return value;
}

function optionalText(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 256) {
    throw new Error(label + ' must be a short non-empty string or null.');
  }
  return value.trim();
}

function repairStamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error(label + ' requires an actual ISO timestamp.');
  validDate(value.slice(0,10),label);return value;
}

// Reuse policy for today's diagnosis, not a provider crawl/reporting deadline.
function evidenceAge(observedAt, { provided, now, maxAgeDays, calendarDate = false } = {}) {
  const result = { state: provided ? 'undated' : 'not-provided', observedAt: observedAt ?? null, ageDays: null };
  if (!provided || observedAt == null) return result;
  let age;
  if (calendarDate) {
    // Search Console dates use Pacific time; they are not UTC collection times.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(now));
    const part = type => parts.find(value => value.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    age = (Date.parse(today + 'T00:00:00Z') - Date.parse(observedAt + 'T00:00:00Z')) / 86400000;
  } else age = (Date.parse(now) - Date.parse(observedAt)) / 86400000;
  result.ageDays = age;
  result.state = age < (calendarDate ? 0 : -5 / 1440) ? 'future'
    : age > maxAgeDays ? 'stale' : 'current';
  return result;
}

function technicalFindingMove(check, technicalOrigin) {
  const primary = move('review-technical-finding', 'publicEligibility',
    (technicalOrigin === 'live' ? 'The bounded live audit flagged ' : 'The supplied bounded technical report flagged ') + check.id + ' (' + check.priority + ').',
    'Confirm that the finding applies to an important published page before repairing its exact source.',
    'Re-run the bounded check on the final deployed page, without expanding the audit into a ranking claim.',
    'Optional technical findings may be less useful than an actual audience or content problem.', technicalOrigin === 'live' ? 'live-bounded-public-audit' : 'supplied-technical-report');
  primary.checkId = check.id;
  return primary;
}
function repairCheck(raw) {
  const c = record(raw,'repair check');
  if (typeof c.id !== 'string' || !/^[a-z][a-z0-9_.-]{0,63}$/.test(c.id)
    || c.exitCode !== null && (!Number.isInteger(c.exitCode) || c.exitCode < 0 || c.exitCode > 255)
    || c.signal !== null && (typeof c.signal !== 'string' || !/^SIG[A-Z0-9]{1,20}$/.test(c.signal))
    || typeof c.logSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(c.logSha256)
    || typeof c.commandSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(c.commandSha256)) throw new Error('Invalid repair check identity, exit, interruption or command/log digest.');
  repairStamp(c.completedAt,'repair check completedAt');return c;
}
function validateRepair(raw) {
  const r=record(raw,'repair'),b=record(r.baseline,'repair.baseline');
  if(r.version!=='0.1'||typeof r.sourceRef!=='string'||!/^[a-f0-9]{40}$/.test(r.sourceRef)
    ||typeof b.sourceRef!=='string'||!/^[a-f0-9]{40}$/.test(b.sourceRef)||typeof b.sourceDirty!=='boolean'
    ||!Array.isArray(r.requiredChecks)||!r.requiredChecks.length||r.requiredChecks.length>12
    ||new Set(r.requiredChecks.map(c=>c?.id)).size!==r.requiredChecks.length||r.requiredChecks.some(c=>!c||typeof c.id!=='string'||!/^[a-z][a-z0-9_.-]{0,63}$/.test(c.id)||!/^[a-f0-9]{64}$/.test(c.commandSha256??''))) throw new Error('Invalid repair source or required-check contract.');
  const before=repairCheck(b.check);if(!r.requiredChecks.some(c=>c.id===before.id))throw new Error('Baseline repair check is outside the required-check contract.');
  if(r.candidate!==undefined){
    const c=record(r.candidate,'repair.candidate');
    if(typeof c.baseRef!=='string'||!/^[a-f0-9]{40}$/.test(c.baseRef)||typeof c.patchSha256!=='string'||!/^[a-f0-9]{64}$/.test(c.patchSha256)
      ||!Array.isArray(c.checks)||c.checks.length>r.requiredChecks.length||new Set(c.checks.map(x=>x.id)).size!==c.checks.length)throw new Error('Invalid repair candidate binding or check scope.');
    for(const check of c.checks){repairCheck(check);if(!r.requiredChecks.some(c=>c.id===check.id))throw new Error('Candidate check is outside the required-check contract.');}
  }
  return r;
}
export function assessRepairReceipt(raw,{expectedRef=null,now=new Date().toISOString()}={}){
  const r=validateRepair(raw),before=r.baseline.check,c=r.candidate;
  repairStamp(now,'repair assessment time');
  const result={state:'unknown',evidenceClass:'owner-supplied-unverified-check-receipt',sourceRef:r.sourceRef,evaluatedAt:now,maxAgeDays:REPAIR_RECEIPT_MAX_AGE_DAYS,
    baselineAt:before.completedAt,candidateAt:c?.checks.map(x=>x.completedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)??null,
    requiredChecks:r.requiredChecks.length,returnedChecks:c?.checks.length??0,automaticRepair:false,automaticPublication:false,searchEffect:'not_measured'};
  const times=[before.completedAt,...(c?.checks.map(x=>x.completedAt)??[])];
  if(times.some(t=>Date.parse(t)>Date.parse(now)+300000)){result.state='future_check_date';return result;}
  if((Date.parse(now)-Date.parse(before.completedAt))/86400000>REPAIR_RECEIPT_MAX_AGE_DAYS){result.state='stale_baseline';return result;}
  if(r.sourceRef!==r.baseline.sourceRef||expectedRef&&expectedRef!==r.sourceRef||r.baseline.sourceDirty){result.state='unmatched_or_dirty_baseline';return result;}
  if([before,...(c?.checks??[])].some(check=>r.requiredChecks.find(required=>required.id===check.id).commandSha256!==check.commandSha256)){result.state='unmatched_check_contract';return result;}
  if(before.signal!==null||before.exitCode===null){result.state='interrupted_baseline';return result;}
  if(before.exitCode===0){result.state='failure_not_reproduced';return result;}
  if(!c){result.state='reported_failed_baseline';return result;}
  if(c.baseRef!==r.baseline.sourceRef){result.state='unmatched_candidate';return result;}
  if(c.checks.some(x=>Date.parse(x.completedAt)<Date.parse(before.completedAt))){result.state='candidate_predates_baseline';return result;}
  if(c.checks.length!==r.requiredChecks.length){result.state='incomplete_candidate_checks';return result;}
  if(c.checks.some(x=>x.exitCode!==0||x.signal!==null)){result.state='failed_or_interrupted_candidate';return result;}
  result.state='reported_local_candidate';return result;
}

function validatePropertyScope(property, site) {
  const selected = new URL(site);
  const raw = property.trim();
  if (raw.startsWith('sc-domain:')) {
    const domain = raw.slice('sc-domain:'.length).toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes('.')
      || !(selected.hostname.toLowerCase() === domain || selected.hostname.toLowerCase().endsWith('.' + domain))) {
      throw new Error('Search Console domain property does not cover this site.');
    }
    return;
  }
  let prefix;
  try { prefix = new URL(raw); } catch { throw new Error('Invalid Search Console property: use sc-domain:host or an HTTPS URL prefix.'); }
  if (prefix.protocol !== 'https:' || prefix.username || prefix.password || prefix.search || prefix.hash
    || prefix.origin !== selected.origin || !site.startsWith(prefix.href)) {
    throw new Error('Search Console URL-prefix property does not cover this site.');
  }
}

function validatePublicationPolicy(raw,site) {
  const policy=record(raw,'publicationPolicy'),base=new URL(site);
  if(policy.version!=='0.1'||!/^[a-f0-9]{40}$/.test(policy.sourceRef??'')||
    !Array.isArray(policy.pages)||!policy.pages.length||policy.pages.length>100)throw new Error('Invalid publication policy source or bounded page list.');
  repairStamp(policy.observedAt,'publication policy observation');
  const seen=new Set();
  for(const page of policy.pages){
    const row=record(page,'publication policy page');let url;
    try{url=new URL(row.url);}catch{throw new Error('Invalid publication policy URL.');}
    if(url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||url.search||url.hash||
      !url.pathname.startsWith(base.pathname)||url.href!==row.url||row.url.length>2048||seen.has(row.url)||
      row.indexing!=='excluded'||!['archive','draft','utility','duplicate','review_hold'].includes(row.basis))throw new Error('Invalid or out-of-scope exact publication exclusion.');
    seen.add(row.url);
  }
  return policy;
}

/** Owner-declared context for review, never authorization or an audit exemption. */
export function assessPublicationPolicy(raw,{site,technical=null,expectedRef=null,now=new Date().toISOString()}={}){
  const policy=validatePublicationPolicy(raw,siteKey(site));repairStamp(now,'publication policy assessment');
  const result={state:'not_matched',evidenceClass:'owner-supplied-unverified-publication-policy',sourceRef:policy.sourceRef,
    observedAt:policy.observedAt,maxAgeDays:PUBLICATION_POLICY_MAX_AGE_DAYS,matchedUrls:[],automaticExemption:false};
  const age=(Date.parse(now)-Date.parse(policy.observedAt))/86400000;
  if(age< -5/1440){result.state='future_policy';return result;}
  if(age>PUBLICATION_POLICY_MAX_AGE_DAYS){result.state='stale_policy';return result;}
  if(expectedRef&&expectedRef!==policy.sourceRef){result.state='source_mismatch';return result;}
  const checks=technical?.checks??[],index=checks.find(c=>c.id==='search-indexability'&&c.priority==='P0'&&c.status==='fail');
  if(!index||checks.filter(c=>c.id==='search-indexability').length!==1||checks.some(c=>c.priority==='P0'&&c.status==='fail'&&c.id!=='search-indexability')||
    !Array.isArray(index.evidence)||!index.evidence.length||index.evidence.some(u=>typeof u!=='string'))return result;
  const pages=technical?.pages;
  if(!Array.isArray(pages))return result;
  for(const url of new Set(index.evidence)){
    const matched=pages.filter(p=>p.url===url);
    if(matched.length!==1||matched[0].noindex!==true||matched[0].ok!==true||matched[0].status!==200||matched[0].redirected===true||
      !policy.pages.some(p=>p.url===url))return result;
  }
  // Every hard sampled URL must be represented in the finding; incomplete
  // evidence cannot mask another status/access failure on the same cohort.
  const hard=pages.filter(p=>p.noindex===true||p.status!==null&&p.status!==undefined&&(p.status<200||p.status>=300));
  if(hard.length!==new Set(index.evidence).size||hard.some(p=>!index.evidence.includes(p.url)))return result;
  result.state=expectedRef?'exact_url_context':'unbound_revision_context';result.matchedUrls=[...new Set(index.evidence)].sort();
  return result;
}

function validateOwner(raw, site) {
  if (!raw) return null;
  const owner = record(raw, 'Owner evidence');
  if (owner.version !== '0.1' || !['owner-supplied', 'synthetic'].includes(owner.dataStatus)) {
    throw new Error('Owner evidence requires version 0.1 and dataStatus owner-supplied or synthetic.');
  }
  if (siteKey(owner.site) !== site) throw new Error('Owner evidence site does not match the selected site.');
  if(owner.repair!==undefined)validateRepair(owner.repair);
  if(owner.publicationPolicy!==undefined)validatePublicationPolicy(owner.publicationPolicy,site);
  if (owner.deployment !== undefined) {
    const d = record(owner.deployment, 'deployment');
    optionalText(d.expectedRef, 'deployment.expectedRef');
    optionalText(d.liveRef, 'deployment.liveRef');
    if (d.deployedOn != null) validDate(d.deployedOn, 'deployment.deployedOn');
  }
  if (owner.indexing !== undefined) {
    const i = record(owner.indexing, 'indexing');
    if (i.observedAt != null) repairStamp(i.observedAt, 'indexing.observedAt');
    count(i.inspectedApprovedUrls, 'indexing.inspectedApprovedUrls');
    count(i.indexedApprovedUrls, 'indexing.indexedApprovedUrls');
    if (i.indexedApprovedUrls > i.inspectedApprovedUrls) {
      throw new Error('Indexed inspected URLs cannot exceed inspected URLs.');
    }
  }
  if (owner.search !== undefined) {
    const s = record(owner.search, 'search');
    if (s.provider !== 'google-search-console' || s.scope !== 'property' || s.searchType !== 'web'
      || !['final', 'preliminary'].includes(s.dataState)) {
      throw new Error('Search evidence must identify Google Web Search property totals and final/preliminary state.');
    }
    optionalText(s.property, 'search.property');
    if (!s.property) throw new Error('search.property is required.');
    validatePropertyScope(s.property, site);
    validDate(s.startDate, 'search.startDate');
    validDate(s.endDate, 'search.endDate');
    if (s.endDate < s.startDate) throw new Error('Search endDate must not precede startDate.');
    count(s.impressions, 'search.impressions');
    count(s.clicks, 'search.clicks');
    if (s.clicks > s.impressions) throw new Error('Search clicks cannot exceed impressions.');
  }
  return owner;
}

function validateTechnical(raw, site) {
  if (!raw) return null;
  const report = record(raw, 'Technical report');
  if (siteKey(report.canonicalUrl) !== site) throw new Error('Technical report site does not match the selected site.');
  if (report.generatedAt != null) repairStamp(report.generatedAt, 'Technical report generatedAt');
  if (!Array.isArray(report.checks)) throw new Error('Technical report requires the checks array.');
  for (const check of report.checks) {
    record(check, 'Technical check');
    if (typeof check.id !== 'string' || !['P0', 'P1', 'P2'].includes(check.priority)
      || !['pass', 'fail', 'watch', 'not-applicable'].includes(check.status)) {
      throw new Error('Technical check requires an id, priority and known status.');
    }
  }
  return report;
}

function move(code, stage, why, action, verify, hold, evidenceClass) {
  return { code, stage, why, action, verify, hold, evidenceClass };
}

export function diagnoseSearchFailure({ site, technical = null, owner = null, technicalOrigin = 'provided', now = new Date().toISOString(), maxEvidenceAgeDays = SEARCH_EVIDENCE_MAX_AGE_DAYS } = {}) {
  if (!['provided', 'live'].includes(technicalOrigin)) throw new Error('Unknown technical evidence origin.');
  if (technicalOrigin === 'live' && !technical) throw new Error('Live origin requires an actual technical report.');
  repairStamp(now, 'Diagnosis time');
  if (!Number.isInteger(maxEvidenceAgeDays) || maxEvidenceAgeDays < 1 || maxEvidenceAgeDays > 365) {
    throw new Error('maxEvidenceAgeDays must be an integer in 1-365.');
  }
  const selected = siteKey(site || technical?.canonicalUrl || owner?.site);
  const report = validateTechnical(technical, selected);
  const supplied = validateOwner(owner, selected);
  const observations = supplied?.dataStatus === 'owner-supplied' ? supplied : null;
  const deployment = observations?.deployment || null;
  const indexing = observations?.indexing || null;
  const hasIndexingSample = Boolean(indexing && indexing.inspectedApprovedUrls > 0);
  const search = observations?.search || null;
  const ageOptions = { now, maxAgeDays: maxEvidenceAgeDays };
  const evidenceFreshness = {
    evaluatedAt: now,
    maxAgeDays: maxEvidenceAgeDays,
    policy: 'project-reuse-limit-not-provider-latency',
    technical: evidenceAge(report?.generatedAt ?? (report && technicalOrigin === 'live' ? now : null), { ...ageOptions, provided: Boolean(report) }),
    indexing: indexing && !hasIndexingSample
      ? { state: 'no-sample', observedAt: indexing.observedAt ?? null, ageDays: null }
      : evidenceAge(indexing?.observedAt, { ...ageOptions, provided: hasIndexingSample }),
    search: evidenceAge(search?.endDate, { ...ageOptions, provided: Boolean(search), calendarDate: true })
  };
  const usableTechnical = evidenceFreshness.technical.state === 'current';
  const usableIndexing = hasIndexingSample && evidenceFreshness.indexing.state === 'current';
  const refreshEvidence = ['technical', 'indexing', 'search']
    .filter(key => ['stale', 'future', 'undated'].includes(evidenceFreshness[key].state));
  const repair=observations?.repair?assessRepairReceipt(observations.repair,{expectedRef:deployment?.expectedRef??null,now}):null;
  const publicationPolicy=observations?.publicationPolicy?assessPublicationPolicy(observations.publicationPolicy,
    {site:selected,technical:usableTechnical?report:null,expectedRef:deployment?.expectedRef??null,now}):null;

  const observedIssues = (report?.checks || [])
    .filter(check => check.status === 'fail')
    .sort((a, b) => ['P0', 'P1', 'P2'].indexOf(a.priority) - ['P0', 'P1', 'P2'].indexOf(b.priority));
  const issues = usableTechnical ? observedIssues : [];
  const p0 = issues.find(check => check.priority === 'P0');
  const observedP0 = observedIssues.find(check => check.priority === 'P0');
  const warnings = (report?.checks || []).filter(check => check.status === 'watch');

  const revisionMismatch = !!(deployment?.expectedRef && deployment?.liveRef
    && deployment.expectedRef !== deployment.liveRef);
  const deployedOn = deployment?.deployedOn || null;
  const reportPredatesDeployment = !!(search && deployedOn && search.endDate < deployedOn);
  const reportCrossesDeployment = !!(search && deployedOn && search.startDate <= deployedOn && search.endDate >= deployedOn);
  const observedFinalSearch = !!(search && search.dataState === 'final' && !reportPredatesDeployment && !reportCrossesDeployment);
  const usableSearch = observedFinalSearch && evidenceFreshness.search.state === 'current';

  const observedStages = {
    localRepair:repair?.state??'not_provided',
    publication: revisionMismatch ? 'owner-reported-mismatch'
      : deployment?.expectedRef && deployment.liveRef ? 'owner-reported-match' : 'unknown',
    publicEligibility: !report ? 'unknown' : observedP0 ? 'bounded-failure'
      : warnings.length ? 'bounded-review' : 'no-bounded-p0-failure',
    indexing: !indexing || indexing.inspectedApprovedUrls === 0 ? 'unknown'
      : indexing.indexedApprovedUrls === 0 ? 'none-in-inspected-sample'
      : indexing.indexedApprovedUrls < indexing.inspectedApprovedUrls ? 'partial-inspected-sample' : 'all-in-inspected-sample',
    exposure: !search ? 'unknown'
      : reportPredatesDeployment ? 'predeployment-evidence'
      : reportCrossesDeployment ? 'mixed-deployment-window'
      : search.dataState !== 'final' ? 'preliminary-unknown'
      : search.impressions === 0 ? 'zero-reported-property-impressions' : 'reported-property-impressions',
    visitsFromSearch: !observedFinalSearch ? 'unknown'
      : search.clicks === 0 ? 'zero-reported-property-clicks' : 'reported-property-clicks'
  };
  const stages = { ...observedStages };
  const freshnessStage = key => evidenceFreshness[key].state === 'stale'
    ? 'historical-evidence' : evidenceFreshness[key].state + '-evidence';
  if (report && !usableTechnical) stages.publicEligibility = freshnessStage('technical');
  if (hasIndexingSample && !usableIndexing) stages.indexing = freshnessStage('indexing');
  if (search && evidenceFreshness.search.state !== 'current') stages.exposure = freshnessStage('search');
  if (!usableSearch) stages.visitsFromSearch = 'unknown';

  const unknowns = [];
  if (!report) unknowns.push('Public HTTP, robots and canonical eligibility have not been inspected.');
  if (!deployment?.expectedRef || !deployment?.liveRef) {
    unknowns.push('Exact expected versus live production revision is not established.');
  }
  if (!indexing || indexing.inspectedApprovedUrls === 0) {
    unknowns.push('Owner URL Inspection evidence for approved representative pages is missing.');
  }
  if (!search) unknowns.push('Final property-scoped Google Web Search impressions and clicks are unavailable.');
  if (search?.dataState === 'preliminary') unknowns.push('Search counts are preliminary and cannot support a final-period diagnosis.');
  if (reportPredatesDeployment) unknowns.push('The Search report ends before the declared deployment date; it cannot evaluate that deployment.');
  if (reportCrossesDeployment) unknowns.push('The Search reporting window crosses the declared deployment date; use a separate final post-deployment window.');
  if (report && technicalOrigin === 'provided') unknowns.push('The locally supplied technical report has not been independently authenticated.');
  if (supplied?.dataStatus === 'synthetic') unknowns.push('Synthetic example data are excluded from every outcome decision.');
  if (report && warnings.length) unknowns.push('Bounded WATCH findings need context; WATCH does not mean an indexing failure.');
  if(repair)unknowns.push('Repair log digests and source/check declarations are owner-supplied metadata; this tool does not authenticate or execute them. A local candidate is not a live release or Search outcome.');
  if(publicationPolicy)unknowns.push('Publication exclusions are owner-supplied source-policy context, not authenticated approval. Verify the exact source and current public response; the technical FAIL and unknown indexing/outcomes remain unchanged.');
  for (const key of refreshEvidence) {
    const evidence = evidenceFreshness[key];
    unknowns.push(`${key} evidence is ${evidence.state}${evidence.observedAt ? ' (' + evidence.observedAt + ')' : ''}; it is retained as an observation but cannot establish the current stage. Recollect it without rewriting the original date.`);
  }

  let primary;
  if (revisionMismatch) {
    primary = move('verify-live-revision', 'publication',
      'The owner-provided expected and live revision identifiers disagree.',
      'Check the live deployment against the intended release. Resolve the mismatch before changing page content.',
      'Record the exact observed production revision and its deployed date, then repeat the affected check.',
      'A Git commit or merged pull request alone does not prove a site was deployed.', 'owner-supplied');
  } else if(publicationPolicy&&['exact_url_context','unbound_revision_context'].includes(publicationPolicy.state)){
    primary=move('review-publication-policy','publicEligibility','The sampled noindex URLs match the declared exact archive/draft/utility/duplicate/review exclusion context.',
      'Verify that these exclusions still match the current publication decision and source revision. Preserve them while choosing an approved indexable cohort; do not remove noindex to increase the KPI.',
      'Check the same exact URL, source policy and final HTTP/meta response. Establish the live revision and separate approved pages from intentionally excluded pages.',
      'Declared policy is not an audit PASS, authenticated approval, publication authority or an explanation of historical Search movement.',
      'owner-supplied-unverified-publication-policy');primary.checkId='search-indexability';
  } else if (p0) {
    primary = move('review-technical-blocker', 'publicEligibility',
      (technicalOrigin === 'live' ? 'The bounded live audit flagged ' : 'The supplied bounded technical report flagged ') + p0.id + ' (' + p0.priority + ').',
      'Inspect the final HTTP response and owning source for this exact finding; correct it only if the page is intended to be public and indexable.',
      'Re-run the same check on the actual deployed page and preserve its request/response evidence.',
      'A failed bounded check is not proof of Google deindexing or a ranking cause.', technicalOrigin === 'live' ? 'live-bounded-public-audit' : 'supplied-technical-report');
    primary.checkId = p0.id;
  } else if(repair?.state==='reported_local_candidate'){
    primary=move('review-local-repair','publication','The owner reports a reproduced failing baseline and passing required checks for a local patch.',
      'Review the canonical source diff and actual baseline/post-check logs, then follow the separately authorized release workflow.',
      'Verify the released artifact/revision separately; only then collect independently dated index and Search observations.',
      'Declared digests and passing local checks do not authenticate logs, authorize publication or establish Search improvement.','owner-supplied-unverified-check-receipt');
  } else if(repair&&repair.state!=='failure_not_reproduced'){
    primary=move('establish-repair-baseline','implementation','The repair receipt state is '+repair.state+'.',
      'Reproduce the configured project check on the exact clean source revision and retain its actual command, timestamp, interruption and log digest before changing code.',
      'Identify the canonical owner of a reproduced defect; after one scoped correction, rerun every unchanged required check.',
      'Missing, stale, mismatched, incomplete or interrupted evidence is not a confirmed repairable defect. Preserve it; do not weaken tests or overwrite source dates.','owner-supplied-unverified-check-receipt');
  } else if (usableIndexing && indexing.inspectedApprovedUrls > 0
    && indexing.indexedApprovedUrls < indexing.inspectedApprovedUrls) {
    primary = move('review-indexing-sample', 'indexing',
      'Owner-provided URL Inspection shows ' + indexing.indexedApprovedUrls + ' indexed of '
        + indexing.inspectedApprovedUrls + ' inspected approved URLs.',
      'Open URL Inspection exclusion reasons for the affected approved pages, distinguish canonical/deduplication from unwanted noindex, and repair only confirmed defects.',
      'Inspect the same URLs again after a documented deployment; retain missing and unchanged results.',
      'A small inspected sample is not the sitewide indexed-page count.', 'owner-supplied');
  } else if (refreshEvidence.length && issues.length) {
    // Old owner observations must not suppress an independently current repair.
    primary = technicalFindingMove(issues[0], technicalOrigin);
  } else if (refreshEvidence.length) {
    primary = move('refresh-evidence', 'evidence',
      'The available ' + refreshEvidence.join(', ') + ' evidence is stale, future-dated or undated for this diagnosis.',
      'Collect a current bounded technical check or dated owner observation for the affected stage before choosing an optional content change.',
      'Preserve the old evidence as a baseline; record the actual observation date, same-site scope and final reporting window on the replacement.',
      'The reuse limit is a project policy, not a Google indexing deadline. Changing a timestamp does not refresh an observation.',
      'historical-or-undated-evidence');
  } else if (usableSearch && search.impressions === 0) {
    if (!usableIndexing || indexing.inspectedApprovedUrls === 0) {
      primary = move('collect-indexing-evidence', 'indexing',
        'The final owner-provided property report contains zero impressions, but indexing evidence is missing.',
        'Inspect a small set of important approved pages in Search Console before rewriting content or adding URLs.',
        'Record each exact page, reported indexing state and reason; check property and date scope.',
        'Zero impressions do not prove that the site is blocked, penalized or has zero demand.', 'owner-supplied');
    } else {
      primary = move('review-query-fit', 'exposure',
        'The owner-provided final Google Web Search property report contains zero impressions in its stated period.',
        'Review one important indexed page, its user question and a distinct useful answer; check the correct Search property and query context.',
        'Compare the same property, search type and final periods after an exact deployed change.',
        'Do not manufacture keyword demand, mass-publish query variants or infer an AI citation outcome.', 'owner-supplied');
    }
  } else if (usableSearch && search.impressions > 0 && search.clicks === 0) {
    primary = move('review-selection-evidence', 'visitsFromSearch',
      'The final property report has impressions but no recorded clicks in the selected period.',
      'Inspect real joint query-and-page evidence and the actual result title/snippet for one existing page before changing it.',
      'Use the same property, segment and comparable final periods; note small denominators and alternate query intent.',
      'No clicks alone do not prove a broken title, a fixed CTR target or missing conversions.', 'owner-supplied');
  } else if (issues.length) {
    primary = technicalFindingMove(issues[0], technicalOrigin);
  } else if (usableSearch && search.clicks > 0) {
    primary = move('define-useful-outcome', 'usefulAction',
      'The owner-provided final Search report shows visits, but not whether visitors achieved the site goal.',
      'Choose one useful next action on an existing page and establish a real owner-side measure of its completion.',
      'Review actual use alongside Search visibility, without treating one as proof that it caused the other.',
      'Search clicks are not purchases, signups, task completions or conversion evidence.', 'owner-supplied');
  } else {
    primary = move('establish-evidence', 'publication',
      'The available evidence cannot establish the first broken stage.',
      report ? 'Check representative approved pages with owner URL Inspection and collect the same-property final Search report.'
        : 'Run a bounded public Technical Integrity audit, then obtain URL Inspection and final Search observations for the same site.',
      'Record the exact live revision, checked URLs, property, dates and missing evidence before choosing a site change.',
      'Do not treat an inconclusive crawl, synthetic fixture, missing export or preliminary report as zero visibility.', 'unknown');
  }

  return {
    version: SEARCH_FAILURE_DOCTOR_VERSION,
    site: selected,
    primary,
    stages,
    observedStages,
    evidenceFreshness,
    repair,
    publicationPolicy,
    unknowns,
    sourceState: {
      technical: report ? (technicalOrigin === 'live' ? 'live-bounded-public-audit' : 'supplied-unverified-technical') : 'not-provided',
      owner: observations ? 'owner-supplied-unverified' : supplied ? 'synthetic-excluded' : 'not-provided',
      googleSearchPeriod: usableSearch ? { startDate: search.startDate, endDate: search.endDate, searchType: 'web' } : null
    },
    guardrails: {
      noCompositeScore: true,
      noRankingOrCitationPromise: true,
      ownerClaimsAreNotIndependentlyVerified: true,
      boundedAuditIsNotIndexingProof: true,
      noAutomaticSiteMutation: true,
      localChecksAreNotSearchOutcomes: true,
      missingDataRemainUnknown: true
    }
  };
}

export function formatSearchFailureDiagnosis(result) {
  const lines = [
    'Goose Search Failure Doctor — ' + result.site,
    '',
    'Start here: ' + result.primary.action,
    'Why: ' + result.primary.why,
    'Check it: ' + result.primary.verify,
    'When not to do it: ' + result.primary.hold,
    'Evidence: ' + result.primary.evidenceClass,
    ...(result.evidenceFreshness ? [
      'Diagnosis evaluated at: ' + result.evidenceFreshness.evaluatedAt,
      'Evidence reuse: ' + result.evidenceFreshness.maxAgeDays + ' days (project policy, not provider latency)'
    ] : []),
    '',
    result.evidenceFreshness ? 'Current diagnosis stages:' : 'Recorded stages (freshness not recorded):'
  ];
  for (const [key, state] of Object.entries(result.stages)) lines.push('  ' + key + ': ' + state);
  if (result.unknowns.length) {
    lines.push('', 'Still unknown:');
    for (const unknown of result.unknowns) lines.push('  - ' + unknown);
  }
  lines.push('', 'This is a scoped triage decision, not a ranking score or proof of Search improvement.');
  return lines.join('\n');
}
