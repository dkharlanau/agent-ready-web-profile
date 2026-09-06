const OWNER_DATA_VERSION = '0.1';
const OWNER_DATA_EVIDENCE_CLASS = 'owner-data';
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONAL_ACTION_IDS = new Set(['growth:google-platform-properties']);

export const OWNER_DATA_ACTION_REQUIREMENTS = Object.freeze({
  'growth:google-generative-ai-measurement-global': Object.freeze({
    provider: 'google-search-console',
    kind: 'generative-ai-performance',
    evidenceType: 'measurement',
    statuses: Object.freeze(['observed', 'verified']),
    maxAgeDays: 45
  }),
  'growth:bing-ai-citation-measurement': Object.freeze({
    provider: 'bing-webmaster-tools',
    kind: 'ai-performance',
    evidenceType: 'measurement',
    statuses: Object.freeze(['observed', 'verified']),
    maxAgeDays: 45
  }),
  'growth:google-platform-properties': Object.freeze({
    provider: 'google-search-console',
    kind: 'platform-property-performance',
    evidenceType: 'measurement',
    statuses: Object.freeze(['observed', 'verified']),
    maxAgeDays: 45
  }),
  'trend-owner:google-generative-ai-control-global': Object.freeze({
    provider: 'google-search-console',
    kind: 'generative-ai-inclusion-control',
    evidenceType: 'owner-state',
    statuses: Object.freeze(['verified']),
    maxAgeDays: 30,
    value: 'included'
  })
});

function summarize(actions) {
  return actions.reduce((acc, item) => {
    acc.totalActions += 1;
    acc.byPriority[item.priority] = (acc.byPriority[item.priority] || 0) + 1;
    acc.byLane[item.lane] = (acc.byLane[item.lane] || 0) + 1;
    return acc;
  }, { totalActions: 0, byPriority: {}, byLane: {} });
}

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return null;
  }
}

function isHttpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validDateTime(value) {
  return typeof value === 'string' && value.length >= 20 && !Number.isNaN(Date.parse(value));
}

function validSlug(value) {
  return /^[a-z0-9][a-z0-9._-]*$/.test(String(value || ''));
}

function validActionId(value) {
  return /^(?:growth|trend-owner|observation):[a-z0-9._:-]+$/i.test(String(value || ''));
}

function validDigest(value) {
  return value == null || /^sha256:[a-f0-9]{64}$/.test(String(value));
}

export function parseOwnerDataReceipt(localOwnerData, { canonicalUrl, now = new Date() } = {}) {
  const base = {
    url: localOwnerData?.url || null,
    ok: Boolean(localOwnerData?.ok),
    observed: Boolean(localOwnerData?.ok && String(localOwnerData?.text || '').trim()),
    valid: false,
    evidenceClass: null,
    recordCount: 0,
    records: [],
    issues: []
  };
  if (!base.observed) return base;

  let payload;
  try { payload = JSON.parse(localOwnerData.text); }
  catch {
    return { ...base, issues: ['invalid-json'] };
  }

  const issues = [];
  if (payload?.version !== OWNER_DATA_VERSION) issues.push('unsupported-version');
  if (payload?.evidenceClass !== OWNER_DATA_EVIDENCE_CLASS) issues.push('evidence-class-must-be-owner-data');
  if (!isHttpsUrl(payload?.site)) issues.push('site-must-be-https');
  if (canonicalUrl && normalizedUrl(payload?.site) !== normalizedUrl(canonicalUrl)) issues.push('site-does-not-match-canonical');
  if (!validDateTime(payload?.generatedAt)) issues.push('generatedAt-must-be-date-time');
  if (payload?.guardrails?.notIndependentEvidence !== true) issues.push('not-independent-evidence-guardrail-missing');
  if (payload?.guardrails?.noRankingClaim !== true) issues.push('no-ranking-claim-guardrail-missing');
  if (payload?.guardrails?.noCrossSurfaceInference !== true) issues.push('no-cross-surface-inference-guardrail-missing');
  if (payload?.guardrails?.noProviderInference !== true) issues.push('no-provider-inference-guardrail-missing');
  if (payload?.guardrails?.sensitiveDataOmitted !== true) issues.push('sensitive-data-omitted-guardrail-missing');
  if (!Array.isArray(payload?.records) || !payload.records.length) issues.push('records-required');

  const nowMs = new Date(now).getTime();
  if (validDateTime(payload?.generatedAt) && Date.parse(payload.generatedAt) > nowMs + MAX_FUTURE_SKEW_MS) {
    issues.push('generatedAt-future');
  }

  const records = [];
  for (const [index, record] of (payload?.records || []).entries()) {
    const prefix = `records[${index}]`;
    const recordIssues = [];
    if (!validActionId(record?.actionId)) recordIssues.push(`${prefix}.actionId`);
    if (!['measurement', 'owner-state'].includes(record?.evidenceType)) recordIssues.push(`${prefix}.evidenceType`);
    if (!validSlug(record?.provider)) recordIssues.push(`${prefix}.provider`);
    if (!validSlug(record?.kind)) recordIssues.push(`${prefix}.kind`);
    if (!['observed', 'verified', 'not-applicable'].includes(record?.status)) recordIssues.push(`${prefix}.status`);
    if (!validDateTime(record?.observedAt)) recordIssues.push(`${prefix}.observedAt`);
    else if (Date.parse(record.observedAt) > nowMs + MAX_FUTURE_SKEW_MS) recordIssues.push(`${prefix}.observedAt-future`);
    if (record?.dataThrough != null && !validDate(record.dataThrough)) recordIssues.push(`${prefix}.dataThrough`);
    if (!String(record?.summary || '').trim()) recordIssues.push(`${prefix}.summary`);
    if (!Array.isArray(record?.scope) || !record.scope.length || !record.scope.every(isHttpsUrl)) recordIssues.push(`${prefix}.scope`);
    if (!Array.isArray(record?.evidence) || !record.evidence.length || !record.evidence.every(isHttpsUrl)) recordIssues.push(`${prefix}.evidence`);
    if (!validDigest(record?.sourceDigest)) recordIssues.push(`${prefix}.sourceDigest`);
    issues.push(...recordIssues);

    if (!recordIssues.length) {
      records.push({
        actionId: record.actionId,
        evidenceType: record.evidenceType,
        provider: record.provider,
        kind: record.kind,
        status: record.status,
        observedAt: record.observedAt,
        dataThrough: record.dataThrough || null,
        summary: record.summary.trim(),
        scope: [...new Set(record.scope)],
        evidence: [...new Set(record.evidence)],
        ...(Object.prototype.hasOwnProperty.call(record, 'value') ? { value: record.value } : {}),
        sourceDigest: record.sourceDigest || null
      });
    }
  }

  const duplicateActionIds = records.map(item => item.actionId).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateActionIds.length) issues.push(`duplicate-action-record:${[...new Set(duplicateActionIds)].join(',')}`);

  return {
    ...base,
    valid: issues.length === 0 && records.length > 0,
    evidenceClass: payload?.evidenceClass || null,
    recordCount: records.length,
    records,
    issues
  };
}

function recordCanResolve(action, record, now) {
  if (!action || action.status !== 'external-owner-data') return false;
  const requirement = OWNER_DATA_ACTION_REQUIREMENTS[action.id];
  if (!requirement || !record || record.actionId !== action.id) return false;
  if (record.provider !== requirement.provider || record.kind !== requirement.kind || record.evidenceType !== requirement.evidenceType) return false;
  if (!requirement.statuses.includes(record.status)) return false;
  if (Object.prototype.hasOwnProperty.call(requirement, 'value') && record.value !== requirement.value) return false;

  const ageMs = new Date(now).getTime() - Date.parse(record.observedAt);
  if (!Number.isFinite(ageMs) || ageMs < -MAX_FUTURE_SKEW_MS) return false;
  if (ageMs > requirement.maxAgeDays * 24 * 60 * 60 * 1000) return false;
  return true;
}

function optionalize(item) {
  if (!DEFAULT_OPTIONAL_ACTION_IDS.has(item.id) || item.status === 'opportunity') return item;
  return {
    ...item,
    status: 'opportunity',
    reason: `${item.reason} Treat this as conditional: it applies only when the publisher actually operates a supported Instagram, TikTok, X or YouTube account/channel and wants that channel measured as a Search Console platform property.`
  };
}

export function applyOwnerDataEvidence(plan, localOwnerData = null, { canonicalUrl, now = new Date() } = {}) {
  if (!plan || !Array.isArray(plan.actions)) throw new Error('A Growth Profile plan with actions is required.');

  const classifiedActions = plan.actions.map(optionalize);
  const optionalActions = classifiedActions.filter(item => item.status === 'opportunity');
  let actions = classifiedActions.filter(item => item.status !== 'opportunity');
  const parsed = parseOwnerDataReceipt(localOwnerData, { canonicalUrl: canonicalUrl || plan.canonicalUrl, now });

  const recordsByAction = new Map(parsed.valid ? parsed.records.map(record => [record.actionId, record]) : []);
  const ownerDataEvidence = [];
  actions = actions.filter(action => {
    const record = recordsByAction.get(action.id);
    if (!recordCanResolve(action, record, now)) return true;
    ownerDataEvidence.push({
      actionId: action.id,
      evidenceType: record.evidenceType,
      provider: record.provider,
      kind: record.kind,
      status: record.status,
      observedAt: record.observedAt,
      dataThrough: record.dataThrough,
      summary: record.summary,
      scope: record.scope,
      evidence: record.evidence,
      ...(Object.prototype.hasOwnProperty.call(record, 'value') ? { value: record.value } : {}),
      sourceDigest: record.sourceDigest,
      evidenceClass: OWNER_DATA_EVIDENCE_CLASS,
      independentEvidence: false,
      rankingImpactClaimed: false,
      crossSurfaceInference: false
    });
    return false;
  });

  const matchedActionIds = ownerDataEvidence.map(item => item.actionId);
  const matched = new Set(matchedActionIds);
  const unmatchedRecordIds = parsed.valid ? parsed.records.map(item => item.actionId).filter(id => !matched.has(id)) : [];
  const opportunities = [...new Map([...(plan.opportunities || []), ...optionalActions].map(item => [item.id, item])).values()];

  return {
    ...plan,
    summary: summarize(actions),
    observations: {
      ...(plan.observations || {}),
      ownerData: {
        url: parsed.url,
        ok: parsed.ok,
        observed: parsed.observed,
        valid: parsed.valid,
        evidenceClass: parsed.evidenceClass,
        recordCount: parsed.recordCount,
        matchedActionIds,
        unmatchedRecordIds,
        issues: parsed.issues
      }
    },
    ownerDataEvidence,
    opportunities,
    actions,
    refinements: {
      ...(plan.refinements || {}),
      ownerDataReceiptsApplied: ownerDataEvidence.length,
      ownerDataEvidenceIsIndependent: false,
      ownerDataCrossSurfaceInference: false,
      optionalOpportunitiesSeparated: optionalActions.length,
      conditionalPlatformPropertiesDefaultOptional: true,
      ownerDataNote: 'Owner-side evidence resolves only exact external-owner-data actions with matching provider, measurement/control kind, status, value where required, and freshness. Ordinary Search Console performance cannot stand in for generative AI reporting, Bing AI citations, social/video platform properties, or authenticated inclusion controls. Search Console platform properties remain an optional opportunity unless a publisher actually operates a supported social/video account or channel.'
    }
  };
}
