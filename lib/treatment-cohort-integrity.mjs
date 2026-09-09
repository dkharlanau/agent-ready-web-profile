import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateSiteStateGraph } from './repository-mapper.mjs';

export const TREATMENT_COHORT_INTEGRITY_VERSION = '0.1';
export const TREATMENT_COHORT_MAX_URLS = 50000;

const DOC_SOURCE = 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/docs/TREATMENT-COHORT-INTEGRITY.md';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'treatment-cohort-integrity.schema.json');

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateTreatmentCohortIntegrityReport(report) {
  const validate = validator();
  const valid = Boolean(validate(report));
  return { valid, errors: validate.errors || [] };
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function sameSite(before, after) {
  if (before.site.origin !== after.site.origin || before.site.basePath !== after.site.basePath) {
    throw new Error('Site State Graphs must describe the same site origin and basePath.');
  }
  if (before.repository.fullName !== after.repository.fullName) {
    throw new Error('Site State Graphs must describe the same repository.');
  }
}

function pathInScope(urlValue, site) {
  const url = new URL(urlValue);
  if (url.origin !== new URL(site.origin).origin) return false;
  const raw = String(site.basePath || '/');
  if (raw === '/') return true;
  const base = raw.endsWith('/') ? raw : `${raw}/`;
  const exact = base.slice(0, -1);
  return url.pathname === exact || url.pathname.startsWith(base);
}

function normalizedTreatment(values, site) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const url = normalizeUrl(raw);
    if (!url) throw new Error(`Treatment URL must be an absolute credential-free HTTPS URL: ${String(raw).slice(0, 200)}`);
    if (!pathInScope(url, site)) throw new Error(`Treatment URL is outside the Site State Graph scope: ${url}`);
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  if (out.length > TREATMENT_COHORT_MAX_URLS) throw new Error(`Treatment cohort exceeds ${TREATMENT_COHORT_MAX_URLS} URLs.`);
  return out.sort();
}

function graphUrlIndex(graph) {
  const index = new Map();
  for (const route of graph.routes || []) {
    const url = route.url ? normalizeUrl(route.url) : null;
    if (!url) continue;
    const list = index.get(url) || [];
    list.push(route);
    index.set(url, list);
  }
  return index;
}

function routeInputEvidence(graph, route) {
  if (!route || route.state !== 'resolved' || !route.ownerPath) {
    return { coverage: 'unavailable', ownerPath: route?.ownerPath || null, ownerSha256: null, digest: null, inputs: new Map(), reasons: ['route-owner-unresolved'] };
  }
  const files = new Map((graph.files || []).map(file => [file.path, file]));
  const paths = new Set([route.ownerPath, ...(route.buildPath || [])]);
  const reasons = [];
  for (const claim of graph.ownership || []) {
    if (claim.routePath !== route.routePath) continue;
    if (claim.state === 'resolved' && claim.ownerPath) paths.add(claim.ownerPath);
    else if (claim.state !== 'resolved') reasons.push(`ownership-${claim.surfaceType}:${claim.state}`);
  }
  const sorted = [...paths].sort();
  const inputs = new Map();
  for (const pathname of sorted) {
    const file = files.get(pathname);
    if (!file) {
      reasons.push(`missing-input:${pathname}`);
      continue;
    }
    inputs.set(pathname, file.sha256);
  }
  const owner = files.get(route.ownerPath) || null;
  if (!owner) reasons.push(`missing-owner:${route.ownerPath}`);
  if (reasons.length) {
    return {
      coverage: 'partial',
      ownerPath: route.ownerPath,
      ownerSha256: owner?.sha256 || null,
      digest: null,
      inputs,
      reasons: [...new Set(reasons)]
    };
  }
  const material = [...inputs.entries()].map(([pathname, sha]) => `${pathname}\n${sha}`).join('\n--\n');
  return {
    coverage: 'complete',
    ownerPath: route.ownerPath,
    ownerSha256: owner.sha256,
    digest: digest(material),
    inputs,
    reasons: []
  };
}

function changedInputPaths(left, right) {
  const paths = [...new Set([...left.inputs.keys(), ...right.inputs.keys()])].sort();
  return paths.filter(pathname => left.inputs.get(pathname) !== right.inputs.get(pathname));
}

function routeState(route) {
  return route?.state || 'absent';
}

function preview(values, limit = 20) {
  return { values: values.slice(0, limit), truncated: values.length > limit };
}

function aggregateAction(kind, priority, urls, reason, verification) {
  const shown = preview(urls, 20);
  return {
    id: `treatment-cohort:${kind}`,
    priority,
    status: 'review',
    kind,
    count: urls.length,
    urlsPreview: shown.values,
    urlsPreviewTruncated: shown.truncated,
    reason,
    verification,
    source: DOC_SOURCE,
    doesNotProve: 'Treatment-cohort alignment does not prove that the implementation caused ranking, citation, recommendation, referral, conversion or other outcome movement.'
  };
}

export function compareTreatmentCohortIntegrity(before, after, options = {}) {
  const beforeValidation = validateSiteStateGraph(before);
  const afterValidation = validateSiteStateGraph(after);
  if (!beforeValidation.valid) throw new Error(`Invalid before Site State Graph: ${beforeValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  if (!afterValidation.valid) throw new Error(`Invalid after Site State Graph: ${afterValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  sameSite(before, after);

  const treatmentUrls = normalizedTreatment(options.treatmentUrls || [], before.site);
  const treatmentSet = new Set(treatmentUrls);
  const beforeIndex = graphUrlIndex(before);
  const afterIndex = graphUrlIndex(after);
  const urlSet = new Set([...beforeIndex.keys(), ...afterIndex.keys(), ...treatmentUrls]);
  if (urlSet.size > TREATMENT_COHORT_MAX_URLS) throw new Error(`Treatment Cohort Integrity comparison exceeds ${TREATMENT_COHORT_MAX_URLS} URLs.`);

  const mappingBasisState = before.adapter.id === after.adapter.id
    && before.adapter.version === after.adapter.version
    && before.repository.siteRoot === after.repository.siteRoot
    ? 'same'
    : 'changed';

  const routes = [];
  for (const url of [...urlSet].sort()) {
    const beforeMatches = beforeIndex.get(url) || [];
    const afterMatches = afterIndex.get(url) || [];
    const beforeRoute = beforeMatches.length === 1 ? beforeMatches[0] : null;
    const afterRoute = afterMatches.length === 1 ? afterMatches[0] : null;
    const declaredTreatment = treatmentSet.has(url);

    if (mappingBasisState === 'changed') {
      routes.push({
        url,
        state: 'unknown',
        declaredTreatment,
        beforeRouteState: beforeMatches.length > 1 ? 'ambiguous' : routeState(beforeRoute),
        afterRouteState: afterMatches.length > 1 ? 'ambiguous' : routeState(afterRoute),
        beforeOwnerPath: beforeRoute?.ownerPath || null,
        afterOwnerPath: afterRoute?.ownerPath || null,
        beforeInputDigestSha256: null,
        afterInputDigestSha256: null,
        ownerChanged: null,
        mappedInputsChanged: null,
        changedInputCount: 0,
        changedInputPreview: [],
        changedInputPreviewTruncated: false,
        confidence: 'low',
        reason: 'Repository Mapper adapter or siteRoot changed between snapshots; overlapping route input evidence is not compared across a changed mapping basis.'
      });
      continue;
    }

    if (beforeMatches.length > 1 || afterMatches.length > 1) {
      routes.push({
        url,
        state: 'unknown',
        declaredTreatment,
        beforeRouteState: beforeMatches.length > 1 ? 'ambiguous' : routeState(beforeRoute),
        afterRouteState: afterMatches.length > 1 ? 'ambiguous' : routeState(afterRoute),
        beforeOwnerPath: beforeRoute?.ownerPath || null,
        afterOwnerPath: afterRoute?.ownerPath || null,
        beforeInputDigestSha256: null,
        afterInputDigestSha256: null,
        ownerChanged: null,
        mappedInputsChanged: null,
        changedInputCount: 0,
        changedInputPreview: [],
        changedInputPreviewTruncated: false,
        confidence: 'low',
        reason: 'More than one mapped route exposes this normalized URL in at least one snapshot; the engine refuses to choose an owner.'
      });
      continue;
    }

    if (!beforeRoute && !afterRoute) {
      routes.push({
        url,
        state: 'unknown',
        declaredTreatment,
        beforeRouteState: 'absent',
        afterRouteState: 'absent',
        beforeOwnerPath: null,
        afterOwnerPath: null,
        beforeInputDigestSha256: null,
        afterInputDigestSha256: null,
        ownerChanged: null,
        mappedInputsChanged: null,
        changedInputCount: 0,
        changedInputPreview: [],
        changedInputPreviewTruncated: false,
        confidence: 'low',
        reason: 'Declared treatment URL is absent from both Site State Graph snapshots.'
      });
      continue;
    }

    if (!beforeRoute) {
      const right = routeInputEvidence(after, afterRoute);
      const state = afterRoute.state === 'resolved' && right.coverage === 'complete' ? 'added' : 'unknown';
      routes.push({
        url,
        state,
        declaredTreatment,
        beforeRouteState: 'absent',
        afterRouteState: afterRoute.state,
        beforeOwnerPath: null,
        afterOwnerPath: afterRoute.ownerPath || null,
        beforeInputDigestSha256: null,
        afterInputDigestSha256: right.digest,
        ownerChanged: null,
        mappedInputsChanged: null,
        changedInputCount: 0,
        changedInputPreview: [],
        changedInputPreviewTruncated: false,
        confidence: state === 'added' ? 'high' : 'low',
        reason: state === 'added'
          ? 'URL is represented by a complete resolved route only in the after Site State Graph.'
          : 'URL appears only after, but its route/input ownership is incomplete or unresolved.'
      });
      continue;
    }

    if (!afterRoute) {
      const left = routeInputEvidence(before, beforeRoute);
      const state = beforeRoute.state === 'resolved' && left.coverage === 'complete' ? 'removed' : 'unknown';
      routes.push({
        url,
        state,
        declaredTreatment,
        beforeRouteState: beforeRoute.state,
        afterRouteState: 'absent',
        beforeOwnerPath: beforeRoute.ownerPath || null,
        afterOwnerPath: null,
        beforeInputDigestSha256: left.digest,
        afterInputDigestSha256: null,
        ownerChanged: null,
        mappedInputsChanged: null,
        changedInputCount: 0,
        changedInputPreview: [],
        changedInputPreviewTruncated: false,
        confidence: state === 'removed' ? 'high' : 'low',
        reason: state === 'removed'
          ? 'URL is represented by a complete resolved route only in the before Site State Graph.'
          : 'URL disappears after, but its before route/input ownership is incomplete or unresolved.'
      });
      continue;
    }

    const left = routeInputEvidence(before, beforeRoute);
    const right = routeInputEvidence(after, afterRoute);
    if (beforeRoute.state !== 'resolved' || afterRoute.state !== 'resolved' || left.coverage !== 'complete' || right.coverage !== 'complete') {
      routes.push({
        url,
        state: 'unknown',
        declaredTreatment,
        beforeRouteState: beforeRoute.state,
        afterRouteState: afterRoute.state,
        beforeOwnerPath: beforeRoute.ownerPath || null,
        afterOwnerPath: afterRoute.ownerPath || null,
        beforeInputDigestSha256: left.digest,
        afterInputDigestSha256: right.digest,
        ownerChanged: null,
        mappedInputsChanged: null,
        changedInputCount: 0,
        changedInputPreview: [],
        changedInputPreviewTruncated: false,
        confidence: 'low',
        reason: 'Both revisions need one resolved route with complete mapped document/build/surface-owner inputs; incomplete evidence remains unknown.'
      });
      continue;
    }

    const ownerChanged = left.ownerPath !== right.ownerPath || left.ownerSha256 !== right.ownerSha256;
    const mappedInputsChanged = left.digest !== right.digest;
    const changedPaths = changedInputPaths(left, right);
    const state = ownerChanged || mappedInputsChanged ? 'changed' : 'unchanged';
    routes.push({
      url,
      state,
      declaredTreatment,
      beforeRouteState: beforeRoute.state,
      afterRouteState: afterRoute.state,
      beforeOwnerPath: left.ownerPath,
      afterOwnerPath: right.ownerPath,
      beforeInputDigestSha256: left.digest,
      afterInputDigestSha256: right.digest,
      ownerChanged,
      mappedInputsChanged,
      changedInputCount: changedPaths.length,
      changedInputPreview: changedPaths.slice(0, 50),
      changedInputPreviewTruncated: changedPaths.length > 50,
      confidence: 'high',
      reason: state === 'changed'
        ? 'At least one completely mapped route document/build/surface-owner input changed between Site State Graph revisions.'
        : 'All completely mapped route document/build/surface-owner inputs are byte-identical between Site State Graph revisions.'
    });
  }

  const sameCommit = Boolean(before.repository.baseCommitSha)
    && before.repository.baseCommitSha === after.repository.baseCommitSha;
  const sameCommitDriftUrls = [];
  if (mappingBasisState === 'same' && sameCommit) {
    for (const item of routes) {
      if (!['changed', 'added', 'removed'].includes(item.state)) continue;
      sameCommitDriftUrls.push(item.url);
      item.state = 'unknown';
      item.confidence = 'low';
      item.reason = 'Mapped route inputs differ even though both Site State Graphs claim the same immutable baseCommitSha. Dirty, stale or inconsistent snapshots cannot establish revision-bound treatment scope.';
    }
  }

  const byUrl = new Map(routes.map(item => [item.url, item]));
  const actualChangedUrls = routes.filter(item => ['changed', 'added', 'removed'].includes(item.state)).map(item => item.url);
  const declaredChangedUrls = treatmentUrls.filter(url => ['changed', 'added', 'removed'].includes(byUrl.get(url)?.state));
  const declaredUnchangedUrls = treatmentUrls.filter(url => byUrl.get(url)?.state === 'unchanged');
  const declaredUnknownUrls = treatmentUrls.filter(url => !byUrl.get(url) || byUrl.get(url).state === 'unknown');
  const changedOutsideTreatmentUrls = treatmentUrls.length
    ? actualChangedUrls.filter(url => !treatmentSet.has(url))
    : [];

  const actions = [];
  if (mappingBasisState === 'changed' && urlSet.size) {
    actions.push(aggregateAction(
      'mapping-basis-changed', 'P1', [...urlSet].sort(),
      'Repository Mapper adapter or siteRoot changed between the compared snapshots, so route-level treatment scope fails closed instead of mixing two mapping bases.',
      'Compile comparable Site State Graphs with the same adapter/siteRoot or review the migration as a separate implementation event rather than a controlled route cohort.'
    ));
  }
  if (sameCommitDriftUrls.length) {
    actions.push(aggregateAction(
      'same-commit-drift', 'P1', sameCommitDriftUrls,
      'The same immutable repository commit is associated with different mapped route inputs across the two snapshots.',
      'Regenerate both Site State Graphs from explicit committed revisions or record the working-tree state separately. Do not treat dirty/stale same-commit drift as a reproducible treatment implementation.'
    ));
  }
  if (declaredUnchangedUrls.length) {
    actions.push(aggregateAction(
      'declared-treatment-unchanged', 'P1', declaredUnchangedUrls,
      'One or more declared treatment URLs have byte-identical completely mapped route inputs across the compared revisions.',
      'Verify the intended implementation actually reached these canonical routes. If treatment happened through an unmapped runtime source, improve the evidence model; otherwise remove unchanged URLs from the treatment claim.'
    ));
  }
  if (declaredUnknownUrls.length) {
    actions.push(aggregateAction(
      'declared-treatment-unknown', 'P1', declaredUnknownUrls,
      'Implementation change for one or more declared treatment URLs cannot be established from comparable complete Site State Graph evidence.',
      'Resolve route/source ownership or collect runtime/build evidence before treating these URLs as implemented treatment.'
    ));
  }
  if (changedOutsideTreatmentUrls.length) {
    actions.push(aggregateAction(
      'changed-outside-treatment', 'P1', changedOutsideTreatmentUrls,
      'Mapped implementation changes affect canonical routes outside the declared treatment cohort, which may contaminate a route-scoped before/after interpretation.',
      'Review shared layout/data/template changes and either expand the treatment cohort, isolate the change, or mark the experiment as contaminated before interpreting owner-side outcome movement.'
    ));
  }

  const count = state => routes.filter(item => item.state === state).length;
  const report = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/treatment-cohort-integrity.schema.json',
    version: TREATMENT_COHORT_INTEGRITY_VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    site: { origin: before.site.origin, basePath: before.site.basePath },
    repository: {
      fullName: before.repository.fullName,
      beforeRef: before.repository.baseRef,
      beforeCommitSha: before.repository.baseCommitSha,
      afterRef: after.repository.baseRef,
      afterCommitSha: after.repository.baseCommitSha
    },
    mappingBasis: {
      state: mappingBasisState,
      beforeAdapter: `${before.adapter.id}@${before.adapter.version}`,
      afterAdapter: `${after.adapter.id}@${after.adapter.version}`,
      beforeSiteRoot: before.repository.siteRoot,
      afterSiteRoot: after.repository.siteRoot
    },
    treatment: {
      state: treatmentUrls.length ? 'declared' : 'not-declared',
      declaredUrls: treatmentUrls
    },
    summary: {
      urls: routes.length,
      comparable: routes.filter(item => ['changed', 'unchanged'].includes(item.state)).length,
      changed: count('changed'),
      unchanged: count('unchanged'),
      added: count('added'),
      removed: count('removed'),
      unknown: count('unknown'),
      declared: treatmentUrls.length,
      declaredChanged: declaredChangedUrls.length,
      declaredUnchanged: declaredUnchangedUrls.length,
      declaredUnknown: declaredUnknownUrls.length,
      changedOutsideTreatment: changedOutsideTreatmentUrls.length,
      actualChangedCohort: actualChangedUrls.length
    },
    routes,
    findings: {
      actualChangedUrls,
      declaredChangedUrls,
      declaredUnchangedUrls,
      declaredUnknownUrls,
      changedOutsideTreatmentUrls
    },
    actions,
    sources: [DOC_SOURCE],
    guardrails: {
      noCausalityInference: true,
      noRankingPromise: true,
      digestChangeNotVisibleChangeProof: true,
      digestEqualityNotRenderedEqualityProof: true,
      sharedInputsCanExpandCohort: true,
      unknownRemainsUnknown: true,
      mappingBasisChangesFailClosed: true,
      noCompositeScore: true
    }
  };

  const validation = validateTreatmentCohortIntegrityReport(report);
  if (!validation.valid) {
    throw new Error(`Generated Treatment Cohort Integrity report is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  return report;
}

export function formatTreatmentCohortIntegrityReport(report) {
  const s = report.summary;
  const lines = [
    `Goose Treatment Cohort Integrity v${report.version} — ${report.site.origin}${report.site.basePath === '/' ? '/' : report.site.basePath}`,
    `Actual changed cohort=${s.actualChangedCohort}; comparable=${s.comparable}/${s.urls}; changed=${s.changed}; added=${s.added}; removed=${s.removed}; unknown=${s.unknown}`,
    `Declared=${s.declared}; matched change=${s.declaredChanged}; unchanged treatment=${s.declaredUnchanged}; unknown treatment=${s.declaredUnknown}; changed outside treatment=${s.changedOutsideTreatment}`,
    `Mapping basis=${report.mappingBasis.state}; no treatment, SEO, ranking or causality score.`,
    ''
  ];
  for (const action of report.actions) lines.push(`${action.priority} REVIEW ${action.kind} — ${action.count} URL(s)`);
  lines.push('', 'Route-input change constrains implementation scope only. Visible significance and Search/AI/business outcomes remain separate evidence.');
  return lines.join('\n');
}
