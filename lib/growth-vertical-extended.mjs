import { fetchPublicText } from './public-fetch.mjs';
import { analyzeVerticalEvidenceSite } from './growth-vertical-site.mjs';
import { loadGrowthVerticalRegistry, verticalEvidenceActions } from './growth-vertical-evidence.mjs';
import { parseOwnerDataReceipt } from './growth-owner-data.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export const VERTICAL_OWNER_REQUIREMENTS = Object.freeze({
  'growth:vertical:commerce-feed-freshness': Object.freeze({
    provider: 'google-merchant-center',
    kind: 'product-page-data-parity',
    evidenceType: 'owner-state',
    statuses: Object.freeze(['verified']),
    value: 'aligned',
    maxAgeDays: 7,
    collection: Object.freeze({
      mode: 'ui-or-owner-export',
      surface: 'Merchant Center > Products/data sources/diagnostics plus current landing-page facts',
      source: 'https://support.google.com/merchants/answer/12157888',
      reviewedAt: '2026-09-07',
      automation: 'owner-verification-required',
      note: 'Verify current price/availability/product-data parity. Merchant automatic updates are not a replacement for regular accurate product-data updates.'
    })
  }),
  'growth:vertical:local-business-owner-profile': Object.freeze({
    provider: 'google-business-profile',
    kind: 'profile-site-parity',
    evidenceType: 'owner-state',
    statuses: Object.freeze(['verified']),
    value: 'consistent',
    maxAgeDays: 30,
    collection: Object.freeze({
      mode: 'authenticated-ui',
      surface: 'Google Business Profile > Edit profile',
      source: 'https://support.google.com/business/answer/3038177',
      reviewedAt: '2026-09-07',
      automation: 'owner-ui-verification-required',
      note: 'Verify real-world name, address/service area, hours and category against the owned site. Do not infer authenticated profile state from public crawl output.'
    })
  })
});

function summarize(checks) {
  return checks.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

function registryCheck(vertical, id) {
  return loadGrowthVerticalRegistry().verticals?.[vertical]?.checks?.find(item => item.id === id) || null;
}

function parseUcp(text) {
  try {
    const payload = JSON.parse(String(text || ''));
    const ucp = payload?.ucp;
    if (!ucp || typeof ucp !== 'object' || Array.isArray(ucp) || typeof ucp.version !== 'string' || !ucp.version.trim()) {
      return { valid: false, issue: 'missing-ucp-version' };
    }
    const services = ucp.services && typeof ucp.services === 'object' && !Array.isArray(ucp.services) ? Object.keys(ucp.services) : [];
    const capabilities = Array.isArray(ucp.capabilities)
      ? ucp.capabilities.map(item => typeof item === 'string' ? item : item?.name).filter(value => typeof value === 'string' && value.trim())
      : [];
    if (!services.length && !capabilities.length) return { valid: false, issue: 'no-services-or-capabilities' };
    return { valid: true, version: ucp.version.trim(), services, capabilities };
  } catch {
    return { valid: false, issue: 'invalid-json' };
  }
}

async function optionalUcp(canonicalUrl, options = {}) {
  if (options.ucp) return options.ucp;
  const url = `${new URL(canonicalUrl).origin}/.well-known/ucp`;
  try {
    return await fetchPublicText(url, {
      fetchImpl: options.fetchImpl || fetch,
      ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
      timeoutMs: options.timeoutMs || 8000,
      maxBytes: Math.min(options.maxBytes || 256 * 1024, 256 * 1024),
      accept: 'application/json, text/plain;q=0.5, */*;q=0.1',
      userAgent: 'arwp-commerce-ucp/0.1'
    });
  } catch (error) {
    return { ok: false, url, status: null, issue: String(error?.message || error), text: null };
  }
}

function applyUcpObservation(report, ucpResponse) {
  const definition = registryCheck('commerce', 'commerce-ucp-discovery');
  if (!definition) return report;
  const url = ucpResponse?.url || `${new URL(report.canonicalUrl).origin}/.well-known/ucp`;
  let check;
  let observation;
  if (ucpResponse?.ok && typeof ucpResponse.text === 'string') {
    const parsed = parseUcp(ucpResponse.text);
    if (parsed.valid) {
      check = {
        id: definition.id,
        priority: definition.priority,
        title: definition.title,
        status: 'observed',
        reason: `Observed a valid UCP discovery manifest with version ${parsed.version}, ${parsed.services.length} service(s) and ${parsed.capabilities.length} capability declaration(s). Discovery evidence does not authorize or invoke checkout.`,
        evidence: [url],
        expectedEvidence: definition.evidence,
        source: definition.source || null,
        observedOn: [url],
        surfaceObservations: 1
      };
      observation = { url, status: 'observed', version: parsed.version, services: parsed.services, capabilities: parsed.capabilities };
    } else {
      check = {
        id: definition.id,
        priority: definition.priority,
        title: definition.title,
        status: 'partial',
        reason: `A response was observed at /.well-known/ucp but it did not meet ARWP's bounded discovery-shape check (${parsed.issue}). Do not invoke endpoints from malformed discovery metadata.`,
        evidence: [url],
        expectedEvidence: definition.evidence,
        source: definition.source || null,
        observedOn: [url],
        surfaceObservations: 1
      };
      observation = { url, status: 'partial', issue: parsed.issue };
    }
  } else if (ucpResponse?.status === 404) {
    check = {
      id: definition.id,
      priority: definition.priority,
      title: definition.title,
      status: 'not-applicable-or-not-observed',
      reason: 'No UCP discovery manifest was observed at the standard origin-level path. UCP is optional and ordinary commerce sites must not be told to implement it merely to satisfy ARWP.',
      evidence: [url],
      expectedEvidence: definition.evidence,
      source: definition.source || null,
      observedOn: [url],
      surfaceObservations: 1
    };
    observation = { url, status: 'not-observed', httpStatus: 404 };
  } else {
    check = {
      id: definition.id,
      priority: definition.priority,
      title: definition.title,
      status: 'unavailable',
      reason: `UCP discovery could not be assessed safely${ucpResponse?.issue ? `: ${ucpResponse.issue}` : ''}. Unavailable evidence is not absence.`,
      evidence: [],
      expectedEvidence: definition.evidence,
      source: definition.source || null,
      observedOn: [],
      surfaceObservations: 0
    };
    observation = { url, status: 'unavailable', issue: ucpResponse?.issue || null };
  }

  const checks = [...report.checks.filter(item => item.id !== definition.id), check];
  return {
    ...report,
    summary: summarize(checks),
    checks,
    ucpDiscovery: observation,
    limitations: [
      ...(report.limitations || []),
      'UCP discovery checks only the manifest shape and never invokes commerce capabilities, checkout or payment handlers.'
    ]
  };
}

export async function analyzeVerticalEvidenceSiteExtended(input, options = {}) {
  const report = await analyzeVerticalEvidenceSite(input, options);
  if (report.vertical !== 'commerce' || !report.canonicalUrl) return report;
  const ucp = await optionalUcp(report.canonicalUrl, options);
  return applyUcpObservation(report, ucp);
}

export function verticalOwnerActions(report) {
  if (!report || !Array.isArray(report.checks)) return [];
  const out = [];
  for (const check of report.checks) {
    const actionId = `growth:vertical:${check.id}`;
    const requirement = VERTICAL_OWNER_REQUIREMENTS[actionId];
    if (!requirement || check.status !== 'external-owner-data') continue;
    out.push({
      id: actionId,
      priority: check.priority,
      lane: `vertical:${report.vertical}`,
      title: check.title,
      status: 'external-owner-data',
      reason: check.reason,
      source: requirement.collection.source,
      implementation: {
        vertical: report.vertical,
        surface: requirement.collection.surface,
        expectedEvidence: check.expectedEvidence,
        note: requirement.collection.note
      },
      ownerDataCollection: {
        provider: requirement.provider,
        evidenceType: requirement.evidenceType,
        kind: requirement.kind,
        mode: requirement.collection.mode,
        surface: requirement.collection.surface,
        source: requirement.collection.source,
        reviewedAt: requirement.collection.reviewedAt,
        automation: requirement.collection.automation,
        requiredValue: requirement.value
      },
      evidence: []
    });
  }
  return out;
}

export function allVerticalActions(report) {
  return [...verticalEvidenceActions(report), ...verticalOwnerActions(report)];
}

function recordCanResolve(action, record, requirement, now) {
  if (!action || action.status !== 'external-owner-data' || !record || !requirement) return false;
  if (record.actionId !== action.id || record.provider !== requirement.provider || record.kind !== requirement.kind || record.evidenceType !== requirement.evidenceType) return false;
  if (!requirement.statuses.includes(record.status)) return false;
  if (Object.prototype.hasOwnProperty.call(requirement, 'value') && record.value !== requirement.value) return false;
  const age = new Date(now).getTime() - Date.parse(record.observedAt);
  return Number.isFinite(age) && age >= -DAY_MS && age <= requirement.maxAgeDays * DAY_MS;
}

export function applyVerticalOwnerDataEvidence(actions, localOwnerData, { canonicalUrl, now = new Date() } = {}) {
  const parsed = parseOwnerDataReceipt(localOwnerData, { canonicalUrl, now });
  const records = new Map(parsed.valid ? parsed.records.map(record => [record.actionId, record]) : []);
  const evidence = [];
  const remaining = [];
  for (const action of actions) {
    const requirement = VERTICAL_OWNER_REQUIREMENTS[action.id];
    const record = records.get(action.id);
    if (!recordCanResolve(action, record, requirement, now)) {
      remaining.push(action);
      continue;
    }
    evidence.push({
      actionId: action.id,
      provider: record.provider,
      kind: record.kind,
      evidenceType: record.evidenceType,
      status: record.status,
      value: record.value,
      observedAt: record.observedAt,
      dataThrough: record.dataThrough,
      summary: record.summary,
      scope: record.scope,
      evidence: record.evidence,
      sourceDigest: record.sourceDigest,
      evidenceClass: 'owner-data',
      independentEvidence: false,
      rankingImpactClaimed: false,
      crossSurfaceInference: false
    });
  }
  return {
    actions: remaining,
    evidence,
    observation: {
      url: parsed.url,
      ok: parsed.ok,
      observed: parsed.observed,
      valid: parsed.valid,
      evidenceClass: parsed.evidenceClass,
      recordCount: parsed.recordCount,
      matchedActionIds: evidence.map(item => item.actionId),
      unmatchedVerticalRecordIds: parsed.valid
        ? parsed.records.map(item => item.actionId).filter(id => VERTICAL_OWNER_REQUIREMENTS[id] && !evidence.some(item => item.actionId === id))
        : [],
      issues: parsed.issues
    }
  };
}
