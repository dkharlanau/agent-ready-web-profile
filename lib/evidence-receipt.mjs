import { createHash } from 'node:crypto';

export const EVIDENCE_RECEIPT_VERSION = '0.1';
export const EVIDENCE_RECEIPT_DIGEST_ALGORITHM = 'sha256';
const INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function jsonSafe(value) {
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (object(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) if (item !== undefined) out[key] = jsonSafe(item);
    return out;
  }
  if (typeof value === 'bigint') return value.toString();
  if (Number.isNaN(value) || value === Infinity || value === -Infinity) return null;
  return value;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (object(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = canonicalValue(value[key]);
    }
    return out;
  }
  return jsonSafe(value);
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Digest(value) {
  return `sha256:${createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex')}`;
}

function compactInterface(item) {
  if (!object(item)) return null;
  const fields = [
    'url', 'protocol', 'kind', 'name', 'description', 'mediaType', 'transport',
    'sourceId', 'sourceAuthority', 'discoveryScope', 'identifier', 'version',
    'artifactProtocol', 'discoveryProtocol', 'readOnly', 'inline', 'score',
    'eligible', 'rejectionReason', 'rejectionDetail'
  ];
  const out = {};
  for (const key of fields) if (item[key] !== undefined && item[key] !== null) out[key] = jsonSafe(item[key]);
  if (Array.isArray(item.capabilities) && item.capabilities.length) out.capabilities = jsonSafe(item.capabilities);
  if (Array.isArray(item.tags) && item.tags.length) out.tags = jsonSafe(item.tags);
  if (item.context != null) out.context = jsonSafe(item.context);
  if (object(item.extensionTerms) && Object.keys(item.extensionTerms).length) out.extensionTerms = jsonSafe(item.extensionTerms);
  if (object(item.unknownTerms) && Object.keys(item.unknownTerms).length) out.unknownTerms = jsonSafe(item.unknownTerms);
  return out;
}

function compactPlan(plan, intent) {
  const value = object(plan) ? plan : {};
  return {
    intent,
    outcome: value.outcome || (value.selected ? 'selected' : 'none'),
    selected: compactInterface(value.selected),
    fallbacks: (Array.isArray(value.fallbacks) ? value.fallbacks : []).slice(0, 5).map(compactInterface).filter(Boolean),
    rejected: (Array.isArray(value.rejected) ? value.rejected : []).slice(0, 10).map(compactInterface).filter(Boolean),
    reason: typeof value.reason === 'string' ? value.reason : null
  };
}

function compactSource(source) {
  if (!object(source)) return null;
  const fields = ['id', 'type', 'url', 'status', 'authority', 'httpStatus', 'contentType', 'issue', 'identifier', 'discoveredVia'];
  const out = {};
  for (const key of fields) if (source[key] !== undefined && source[key] !== null) out[key] = jsonSafe(source[key]);
  return out;
}

function sortStable(items) {
  return [...items].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
}

function isoInstant(value) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('observedAt must be a valid date/time.');
  return date.toISOString();
}

function payloadForDigest(receipt) {
  const payload = jsonSafe(receipt);
  delete payload.receiptId;
  delete payload.digests;
  return payload;
}

export function validateEvidenceReceipt(receipt) {
  const issues = [];
  if (!object(receipt)) return { valid: false, issues: ['Receipt must be an object.'] };
  if (receipt.receiptVersion !== EVIDENCE_RECEIPT_VERSION) issues.push(`receiptVersion must be ${EVIDENCE_RECEIPT_VERSION}.`);
  if (typeof receipt.target !== 'string' || !receipt.target) issues.push('target is required.');
  if (typeof receipt.canonicalUrl !== 'string' || !receipt.canonicalUrl) issues.push('canonicalUrl is required.');
  if (typeof receipt.observedAt !== 'string' || Number.isNaN(Date.parse(receipt.observedAt))) issues.push('observedAt must be an ISO date/time string.');
  if (typeof receipt.toolVersion !== 'string' || !receipt.toolVersion) issues.push('toolVersion is required.');
  if (typeof receipt.resolverVersion !== 'string' || !receipt.resolverVersion) issues.push('resolverVersion is required.');
  if (!Array.isArray(receipt.sources)) issues.push('sources must be an array.');
  if (!object(receipt.plans)) issues.push('plans must be an object.');
  else for (const intent of INTENTS) if (!object(receipt.plans[intent])) issues.push(`plans.${intent} is required.`);
  if (!Array.isArray(receipt.conflicts)) issues.push('conflicts must be an array.');
  if (!object(receipt.boundaries)) issues.push('boundaries must be an object.');
  if (!object(receipt.digests) || typeof receipt.digests.payload !== 'string') issues.push('digests.payload is required.');
  if (typeof receipt.receiptId !== 'string' || !receipt.receiptId.startsWith('urn:sha256:')) issues.push('receiptId must use urn:sha256:.');
  return { valid: issues.length === 0, issues };
}

export function createEvidenceReceipt(resolution, {
  observedAt = null,
  toolVersion = '0.2.0',
  producer = 'ARWP Resolver'
} = {}) {
  if (!object(resolution)) throw new Error('A Resolver resolution object is required.');
  const target = resolution.target || resolution.canonicalUrl;
  if (typeof target !== 'string' || !target) throw new Error('Resolution target/canonicalUrl is required.');
  const canonicalUrl = resolution.canonicalUrl || resolution.identity?.canonicalUrl || target;
  const sourceRows = (Array.isArray(resolution.sources) ? resolution.sources : []).map(compactSource).filter(Boolean);
  const plans = {};
  for (const intent of INTENTS) plans[intent] = compactPlan(resolution.plans?.[intent], intent);
  const conflicts = sortStable((Array.isArray(resolution.conflicts) ? resolution.conflicts : []).map(jsonSafe));

  const receipt = {
    receiptVersion: EVIDENCE_RECEIPT_VERSION,
    producer,
    target,
    canonicalUrl,
    observedAt: isoInstant(observedAt),
    toolVersion,
    resolverVersion: String(resolution.resolverVersion || 'unknown'),
    decisionPolicyVersion: resolution.decisionPolicyVersion ? String(resolution.decisionPolicyVersion) : null,
    identity: object(resolution.identity) ? jsonSafe(resolution.identity) : null,
    evidenceSummary: {
      sourcesAttempted: Number(resolution.summary?.sourcesAttempted || 0),
      sourcesResolved: Number(resolution.summary?.sourcesResolved || 0),
      interfacesResolved: Number(resolution.summary?.interfacesResolved || 0),
      conflicts: conflicts.length
    },
    sources: sortStable(sourceRows),
    plans,
    conflicts,
    metrics: object(resolution.metrics) ? jsonSafe(resolution.metrics) : {},
    upstreamStatus: object(resolution.upstreamStatus) ? jsonSafe(resolution.upstreamStatus) : {},
    artifactDigests: [],
    boundaries: {
      receiptIsResolverObservation: true,
      receiptIsPublisherManifest: false,
      receiptIsTrustCertificate: false,
      metadataGrantsAuthorization: false,
      sourceBodyDigestsCaptured: false,
      note: 'receipt payload integrity is covered; source-body digests are not claimed unless future fetch instrumentation records them explicitly.'
    }
  };

  const digest = sha256Digest(payloadForDigest(receipt));
  receipt.digests = {
    algorithm: EVIDENCE_RECEIPT_DIGEST_ALGORITHM,
    canonicalization: 'ARWP canonical JSON v0.1: object keys sorted recursively; array order preserved; UTF-8 JSON without insignificant whitespace',
    payload: digest
  };
  receipt.receiptId = `urn:sha256:${digest.slice('sha256:'.length)}`;

  const validation = validateEvidenceReceipt(receipt);
  if (!validation.valid) throw new Error(`Generated invalid evidence receipt: ${validation.issues.join(' ')}`);
  return receipt;
}

export function verifyEvidenceReceipt(receipt) {
  const validation = validateEvidenceReceipt(receipt);
  if (!validation.valid) return { valid: false, integrity: false, issues: validation.issues, expectedDigest: null, actualDigest: receipt?.digests?.payload || null };
  const expectedDigest = sha256Digest(payloadForDigest(receipt));
  const expectedId = `urn:sha256:${expectedDigest.slice('sha256:'.length)}`;
  const issues = [];
  if (receipt.digests.algorithm !== EVIDENCE_RECEIPT_DIGEST_ALGORITHM) issues.push(`Unsupported digest algorithm: ${receipt.digests.algorithm}`);
  if (receipt.digests.payload !== expectedDigest) issues.push('Receipt payload digest does not match canonical content.');
  if (receipt.receiptId !== expectedId) issues.push('receiptId does not match canonical payload digest.');
  return {
    valid: issues.length === 0,
    integrity: issues.length === 0,
    issues,
    expectedDigest,
    actualDigest: receipt.digests.payload,
    expectedReceiptId: expectedId,
    actualReceiptId: receipt.receiptId
  };
}
