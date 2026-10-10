import { summarizeControlledCohort } from './controlled-cohort.mjs';

// Compare only the same frozen URLs and the same two observed reports. This
// analysis is deliberately *not* the source of experiment status or a causal
// outcome/GO decision. The canonical Controlled Cohort remains unchanged.
const FINGERPRINT = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const KNOWN_STATES = new Set([
  'indexed', 'discovered-not-indexed', 'crawled-not-indexed',
  'unknown-to-google', 'blocked-robots', 'blocked-noindex',
  'fetch-problem', 'other-excluded', 'unresolved', 'not-inspected'
]);
const INCONCLUSIVE = new Set(['not-inspected', 'unresolved']);
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

function checkReview(cohort, report, label) {
  if (!isObject(report)
      || report.version !== '0.1'
      || report.kind !== 'cohort-url-index-observation'
      || report.cohortId !== cohort.id
      || report.site !== cohort.site
      || report.productionGate !== 'ready'
      || report.noOutcomeDecision !== true
      || report.indexedVersionNotLiveTest !== true) {
    throw new Error(label + ' must be a ready, descriptive indexed-version review of the same frozen cohort and site.');
  }
  if (!FINGERPRINT.test(report.pageMapFingerprint || '')) {
    throw new Error(label + ' lacks the complete frozen canonical page-map fingerprint; regenerate the report with this version of Goose.');
  }
  if (!SHA.test(report.frozenImplementationRef || '')
      || report.frozenImplementationRef !== cohort.measurementGate.implementationRef
      || report.observedProductionRefClaim !== cohort.measurementGate.productionRef) {
    throw new Error(label + ' disagrees with the frozen source/live implementation refs.');
  }
  const timestamp = Date.parse(report.observedAt);
  if (!Number.isFinite(timestamp) || !/^\d{4}-\d{2}-\d{2}T/.test(report.observedAt)) {
    throw new Error(label + ' requires a dated owner observation timestamp.');
  }
  if (!['recovery-inspection-v1', 'search-observe-v1'].includes(report.sourceFormat)) {
    throw new Error(label + ' has an unsupported URL Inspection source format.');
  }
  if (!['declared-inspection-snapshot', 'live_sitemap', 'priority_queue'].includes(report.inspectionScope)) {
    throw new Error(label + ' has no bounded inspection scope.');
  }
  const summary = summarizeControlledCohort(cohort);
  if (!isObject(report.frozen) ||
      report.frozen.treatment !== summary.treatmentCount ||
      report.frozen.control !== summary.controlCount ||
      report.frozen.searchQueries !== summary.queryCount) {
    throw new Error(label + ' changed the number of frozen treatment, controls or search queries.');
  }
  if (!Array.isArray(report.members) || report.members.length !== summary.treatmentCount + summary.controlCount) {
    throw new Error(label + ' must include exactly one entry for every frozen member.');
  }
  const frozen = new Map([
    ...cohort.treatment.map(m => [m.id, { entity: m.entity, group: 'treatment' }]),
    ...cohort.control.map(m => [m.id, { entity: m.entity, group: 'control' }])
  ]);
  const out = new Map();
  for (const member of report.members) {
    if (!isObject(member) || !frozen.has(member.id) || out.has(member.id)) {
      throw new Error(label + ' includes duplicate or unknown member IDs.');
    }
    const expected = frozen.get(member.id);
    if (member.entity !== expected.entity || member.group !== expected.group ||
        !KNOWN_STATES.has(member.state)) {
      throw new Error(label + ' altered a frozen entity/group or supplied an unsupported state.');
    }
    if (member.state === 'not-inspected' && member.coverageState !== null) {
      throw new Error(label + ' gave an uninspected URL an observed coverage state.');
    }
    out.set(member.id, member);
  }
  return { timestamp, members: out };
}

function groupComparison(cohort, prior, later, group) {
  const frozen = group === 'treatment' ? cohort.treatment : cohort.control;
  const ids = {
    becameIndexed: [], ceasedIndexed: [], remainedIndexed: [],
    remainedNotIndexed: [], unpairedOrUnresolved: [],
    currentIndexedWithoutVerifiedLaterCrawl: []
  };
  const stateTransitions = {};
  let beforeIndexedComparable = 0, afterIndexedComparable = 0;
  const observedTransitions = [];
  for (const frozenMember of frozen) {
    const before = prior.get(frozenMember.id), after = later.get(frozenMember.id);
    if (INCONCLUSIVE.has(before.state) || INCONCLUSIVE.has(after.state)) {
      ids.unpairedOrUnresolved.push(frozenMember.id);
      continue;
    }
    const direction = before.state + ' -> ' + after.state;
    stateTransitions[direction] = (stateTransitions[direction] || 0) + 1;
    observedTransitions.push({
      id: frozenMember.id,
      from: before.state,
      to: after.state
    });
    if (before.state === 'indexed') beforeIndexedComparable++;
    if (after.state === 'indexed') afterIndexedComparable++;
    const label = before.state === 'indexed'
      ? (after.state === 'indexed' ? 'remainedIndexed' : 'ceasedIndexed')
      : (after.state === 'indexed' ? 'becameIndexed' : 'remainedNotIndexed');
    ids[label].push(frozenMember.id);
    if (after.state === 'indexed' && after.lastCrawlNotAfterDeployment) {
      ids.currentIndexedWithoutVerifiedLaterCrawl.push(frozenMember.id);
    }
  }
  return {
    frozenMembers: frozen.length,
    comparableMembers: observedTransitions.length,
    unpairedOrUnresolvedMembers: ids.unpairedOrUnresolved.length,
    beforeIndexedComparable,
    afterIndexedComparable,
    netIndexedChangeOnComparableMembers: afterIndexedComparable - beforeIndexedComparable,
    stateTransitions,
    observedTransitions,
    memberIds: ids,
    // Never infer a cohort-wide indexed share when a priority queue omits URLs.
    entireFrozenGroupComparable: observedTransitions.length === frozen.length
  };
}

export function compareCohortIndexObservations(cohort, before, after) {
  // Validate the canonical state before comparing derived, potentially untrusted reports.
  const summary = summarizeControlledCohort(cohort);
  if (cohort.measurementGate.state !== 'ready' ||
      !['ready-to-observe', 'observing', 'reviewed'].includes(cohort.status)) {
    throw new Error('The canonical frozen cohort is on measurement HOLD.');
  }
  const earlier = checkReview(cohort, before, 'Before review');
  const later = checkReview(cohort, after, 'After review');
  if (earlier.timestamp >= later.timestamp) {
    throw new Error('After review must have a strictly later observation timestamp.');
  }
  if (before.pageMapFingerprint !== after.pageMapFingerprint) {
    throw new Error('Page-map fingerprints differ: do not compare different URL assignments for the same frozen member IDs.');
  }
  if (before.deploymentDateClaim !== after.deploymentDateClaim ||
      before.observedProductionRefClaim !== after.observedProductionRefClaim) {
    throw new Error('Production/deployment claims differ; independently reconcile treatment drift before comparing.');
  }

  const treatment = groupComparison(cohort, earlier.members, later.members, 'treatment');
  const control = groupComparison(cohort, earlier.members, later.members, 'control');
  const totalComparable = treatment.comparableMembers + control.comparableMembers;
  const total = summary.treatmentCount + summary.controlCount;

  return {
    version: '0.1',
    kind: 'cohort-index-longitudinal-review',
    cohortId: cohort.id,
    site: cohort.site,
    reportBasis: 'same-frozen-canonical-urls-only',
    sourceEvidenceAuthenticated: false,
    pageMapFingerprint: before.pageMapFingerprint,
    frozenImplementationRef: cohort.measurementGate.implementationRef,
    observedProductionRefClaim: before.observedProductionRefClaim,
    deploymentDateClaim: before.deploymentDateClaim,
    before: { observedAt: before.observedAt, sourceFormat: before.sourceFormat, inspectionScope: before.inspectionScope },
    after: { observedAt: after.observedAt, sourceFormat: after.sourceFormat, inspectionScope: after.inspectionScope },
    comparableMembers: totalComparable,
    unpairedOrUnresolvedMembers: total - totalComparable,
    entireFrozenCohortComparable: totalComparable === total,
    treatment,
    control,
    nextActions: [
      totalComparable < total
        ? 'Some frozen pages were not inspected in both snapshots or had unresolved results. Restrict conclusions to the explicitly comparable pages and preserve missing states.'
        : 'The same frozen member URLs have observations at both dates; this supports a bounded change-in-index-state observation, not a growth claim.',
      'Recheck crawl timestamps against each release: indexed status need not mean that the new treatment content was seen.',
      'Combine separate final owner Web Search page/query windows, unchanged controls and actual useful actions before any keep/revise/stop decision.'
    ],
    noOutcomeDecision: true,
    causalImpactEstablished: false,
    limitations: [
      'A change in indexed-state classifications is not evidence of more impressions, non-brand demand, citations, traffic or useful visits.',
      'Even full-matched URL Inspection reports cannot identify which code, content or external factor caused the observed change.',
      'Only members inspected and conclusively classified in BOTH snapshots enter transition counts; missing is never treated as zero.',
      'Treatment and control changes must not be converted to an effect estimate or a statistical claim without a reviewed experiment design and comparable owner outcome evidence.',
      'The page-map fingerprint proves that local comparisons used the same URL mapping, not that URLs or snapshots were authenticated live by Goose.',
      'Source reports remain owner-supplied; do not publish their raw URL, query, credential or private page-map data.'
    ]
  };
}
