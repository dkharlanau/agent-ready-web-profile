import { resolveSite as resolveSiteCore } from './resolver-core.mjs';

const INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];

function normalizeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return String(value);
  }
}

function sourceBoost(item) {
  if (item.sourceAuthority === 'ietf-standard' || item.sourceAuthority === 'upstream-standard') return 4;
  if (item.sourceAuthority === 'project-profile') return 3;
  return 1;
}

function scorePlan(item, intent) {
  const boost = sourceBoost(item);
  if (intent === 'read') {
    if (item.kind === 'llms') return 100 + boost;
    if (item.kind === 'markdown-negotiated' || item.kind === 'markdown-alternate') return 90 + boost;
    if (item.kind === 'feed') return 80 + boost;
    if (item.kind === 'catalog') return 55 + boost;
    if (item.kind === 'html' || item.protocol === 'HTML') return 50 + boost;
  }
  if (intent === 'search') {
    if (item.kind === 'search') return 110 + boost;
    if (item.kind === 'index') return 100 + boost;
    // An API description is not a search operation. MCP/OpenAPI search requires
    // explicit operation semantics and is therefore not inferred here.
  }
  if (intent === 'structured') {
    if (item.protocol === 'OpenAPI' || item.kind === 'api-description') return 110 + boost;
    if (item.kind === 'api-endpoint') return 90 + boost;
    if (item.kind === 'schema') return 80 + boost;
    if (item.kind === 'distribution') return 70 + boost;
  }
  if (intent === 'tools') {
    if (item.protocol === 'MCP' && item.transport === 'streamable-http') return 120 + boost;
    if (item.protocol === 'MCP') return 95 + boost;
    if (item.protocol === 'WebMCP') return 70 + boost;
  }
  if (intent === 'agent' && item.protocol === 'A2A') return 120 + boost;
  return 0;
}

function isPathScopedTarget(resolution) {
  try {
    const target = new URL(resolution?.target || resolution?.canonicalUrl);
    return Boolean(target.pathname && target.pathname !== '/');
  } catch {
    return false;
  }
}

function queryKeys(url) {
  try {
    return new Set([...new URL(url).searchParams.keys()].map(key => key.toLowerCase()));
  } catch {
    return new Set();
  }
}

export function isEphemeralSignedUrl(url) {
  const keys = queryKeys(url);
  const has = key => keys.has(key);
  const aws = has('x-amz-signature') && (has('x-amz-expires') || has('x-amz-credential'));
  const google = has('x-goog-signature') && (has('x-goog-expires') || has('x-goog-credential'));
  const azure = has('sig') && has('se') && (has('sp') || has('sv'));
  const genericSignature = (has('signature') || has('sig')) && (has('expires') || has('expiry') || has('expiration'));
  return aws || google || azure || genericSignature;
}

function inferredDiscoveryScope(item) {
  if (item.discoveryScope) return item.discoveryScope;
  const sourceId = String(item.sourceId || '');
  if (sourceId === 'api-catalog:0') return 'root-conventional';
  if (sourceId === 'a2a-agent-card:0') return 'root-conventional';
  if (sourceId.startsWith('api-catalog-link:')) return 'target-linked';
  if (sourceId === 'path-llms:0') return 'target-path-probe';
  if (sourceId === 'homepage-scan' || sourceId === 'http-head:0') return 'target-observed';
  return 'unspecified';
}

function annotateScopes(resolution) {
  for (const items of Object.values(resolution.interfaces || {})) {
    for (const item of items) item.discoveryScope = inferredDiscoveryScope(item);
  }
  return resolution;
}

export function candidateEligibility(item, intent, resolution) {
  if (!item?.url) return { eligible: false, reason: 'missing-url' };

  if (isEphemeralSignedUrl(item.url)) {
    return {
      eligible: false,
      reason: 'unstable-signed-url',
      detail: 'The discovered URL appears to be an expiring signed URL. It is preserved as evidence but is not a durable default route.'
    };
  }

  if (intent === 'search' && item.protocol === 'OpenAPI') {
    return {
      eligible: false,
      reason: 'search-semantics-not-declared',
      detail: 'OpenAPI describes an API but does not by itself prove a search/retrieval operation.'
    };
  }

  if (intent === 'structured' && isPathScopedTarget(resolution) && inferredDiscoveryScope(item) === 'root-conventional') {
    return {
      eligible: false,
      reason: 'root-scope-not-target-scope',
      detail: 'A conventional root-wide API catalog is preserved as site evidence but is not automatically assigned to a path-scoped target.'
    };
  }

  if (intent === 'agent' && isPathScopedTarget(resolution) && inferredDiscoveryScope(item) === 'root-conventional') {
    return {
      eligible: false,
      reason: 'root-scope-not-target-scope',
      detail: 'A conventional root-wide A2A Agent Card is preserved as origin evidence but is not automatically assigned to a path-scoped target without target-scoped corroboration.'
    };
  }

  return { eligible: true, reason: null };
}

function candidateGroups(intent) {
  return {
    read: ['content', 'data'],
    search: ['retrieval', 'apis'],
    structured: ['apis', 'data'],
    tools: ['tools', 'browserTools'],
    agent: ['agents']
  }[intent];
}

function rejectionSummary(item) {
  return {
    url: item.url || null,
    protocol: item.protocol || null,
    kind: item.kind || null,
    sourceId: item.sourceId || null,
    sourceAuthority: item.sourceAuthority || null,
    discoveryScope: inferredDiscoveryScope(item),
    reason: item.rejectionReason || null
  };
}

export function planResolvedSite(resolution, intent) {
  const normalizedIntent = String(intent || '').toLowerCase();
  if (!INTENTS.includes(normalizedIntent)) throw new Error(`Unsupported intent: ${intent}`);

  const evaluated = candidateGroups(normalizedIntent)
    .flatMap(group => resolution.interfaces?.[group] || [])
    .filter(item => item?.url)
    .map(item => {
      const eligibility = candidateEligibility(item, normalizedIntent, resolution);
      return {
        ...item,
        discoveryScope: inferredDiscoveryScope(item),
        score: scorePlan(item, normalizedIntent),
        eligible: eligibility.eligible,
        rejectionReason: eligibility.reason,
        rejectionDetail: eligibility.detail || null
      };
    });

  const candidates = evaluated
    .filter(item => item.eligible && item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.url).localeCompare(String(b.url)));

  const rejected = evaluated
    .filter(item => !item.eligible)
    .sort((a, b) => b.score - a.score || String(a.url).localeCompare(String(b.url)))
    .slice(0, 5)
    .map(rejectionSummary);

  const selected = candidates[0] || null;
  const outcome = selected ? 'selected' : rejected.length ? 'insufficient-evidence' : 'none';
  const reason = selected
    ? `Selected ${selected.kind || selected.protocol} from ${selected.sourceAuthority} evidence after eligibility checks.`
    : rejected.length
      ? `No eligible ${normalizedIntent} interface remained after policy checks; ${rejected.length} discovered candidate(s) were rejected.`
      : `No suitable ${normalizedIntent} interface was resolved.`;

  return {
    intent: normalizedIntent,
    outcome,
    selected,
    fallbacks: candidates.slice(1, 5),
    rejected,
    reason
  };
}

export function explainResolvedSite(resolution) {
  const counts = Object.fromEntries(Object.entries(resolution.interfaces || {}).map(([key, values]) => [key, values.length]));
  const lines = [
    `${resolution.identity?.name || new URL(resolution.canonicalUrl).hostname}`,
    `Canonical: ${resolution.canonicalUrl}`,
    `Evidence: ${resolution.summary?.sourcesResolved ?? 0}/${resolution.summary?.sourcesAttempted ?? 0} discovery sources resolved; ${resolution.conflicts?.length ?? 0} conflict(s).`,
    ''
  ];
  const labels = {
    content: 'Content', data: 'Data', retrieval: 'Retrieval', apis: 'APIs', tools: 'Tools', skills: 'Skills', agents: 'Agents', browserTools: 'Browser tools', auth: 'Auth', trust: 'Trust'
  };
  for (const [group, label] of Object.entries(labels)) if (counts[group]) lines.push(`${label}: ${counts[group]}`);
  if (resolution.conflicts?.length) {
    lines.push('', 'Conflicts:');
    for (const conflict of resolution.conflicts) lines.push(`- ${conflict.message}`);
  }
  lines.push('', 'Recommended interfaces:');
  for (const intent of INTENTS) {
    const plan = planResolvedSite(resolution, intent);
    const suffix = plan.selected ? ` (${plan.selected.protocol || plan.selected.kind})` : plan.outcome !== 'none' ? ` [${plan.outcome}]` : '';
    lines.push(`- ${intent}: ${plan.selected?.url || 'none'}${suffix}`);
  }
  return lines.join('\n');
}

export async function resolveSite(input, options = {}) {
  const resolution = annotateScopes(await resolveSiteCore(input, options));
  resolution.decisionPolicyVersion = '0.1';
  resolution.plans = Object.fromEntries(INTENTS.map(intent => [intent, planResolvedSite(resolution, intent)]));
  return resolution;
}

export { DEFAULT_RESOLVER_MAX_BYTES } from './resolver-core.mjs';