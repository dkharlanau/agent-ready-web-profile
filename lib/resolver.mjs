import { lookup as dnsLookup } from 'node:dns/promises';
import { scanSite } from './scanner.mjs';
import { validateProfile } from './validator.mjs';
import { fetchPublicJson, fetchPublicText } from './public-fetch.mjs';
import { fetchPublicHead, adaptHttpDiscovery } from './http-discovery.mjs';
import {
  emptyInterfaces,
  mergeInterfaces,
  dedupeInterfaces,
  sourceRecord,
  adaptArwpProfile,
  parseAgentsTxt,
  adaptAgentsJson,
  adaptApiCatalog,
  adaptProtectedResource,
  adaptA2aCard,
  adaptAgentSkillsIndex,
  adaptMcpServerCard,
  adaptAiCatalog
} from './resolver-adapters.mjs';

function makeSourceId(type, index = 0) {
  return `${type}:${index}`;
}

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

function publicEndpoint(item) {
  return item?.url && /^https:\/\//i.test(item.url) ? normalizeUrl(item.url) : null;
}

function setFrom(items) {
  return new Set(items.map(publicEndpoint).filter(Boolean));
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function agentsPairConflicts(sourceInterfaces) {
  const txt = sourceInterfaces.get('agents-txt:0');
  const json = sourceInterfaces.get('agents-json:0');
  if (!txt || !json) return [];
  const conflicts = [];
  const mappings = [
    ['tools', 'MCP'],
    ['skills', 'Agent Skills'],
    ['agents', 'A2A'],
    ['browserTools', 'WebMCP']
  ];
  for (const [group, label] of mappings) {
    const left = setFrom(txt[group] || []);
    const right = setFrom(json[group] || []);
    if (left.size || right.size) {
      if (!sameSet(left, right)) conflicts.push({
        kind: 'source-mismatch',
        severity: 'warning',
        capability: label,
        sources: ['agents-txt:0', 'agents-json:0'],
        values: { agentsTxt: [...left], agentsJson: [...right] },
        message: `${label} declarations differ between agents.txt and agents.json.`
      });
    }
  }
  return conflicts;
}

function mcpCardConflicts(interfaces) {
  const declared = interfaces.tools.filter(item => item.protocol === 'MCP' && item.kind !== 'mcp-server-card').map(publicEndpoint).filter(Boolean);
  const cardEndpoints = interfaces.tools.filter(item => item.kind === 'mcp-server-card').map(publicEndpoint).filter(Boolean);
  if (declared.length !== 1 || !cardEndpoints.length) return [];
  const expected = declared[0];
  const mismatches = cardEndpoints.filter(url => url !== expected);
  if (!mismatches.length) return [];
  return [{
    kind: 'mcp-endpoint-mismatch',
    severity: 'warning',
    capability: 'MCP',
    values: { declared: expected, serverCards: cardEndpoints },
    message: 'MCP endpoint declared by site metadata differs from an experimental MCP Server Card endpoint.'
  }];
}

function identityConflicts(identityEvidence) {
  const canonicals = new Map();
  for (const item of identityEvidence) {
    const canonical = normalizeUrl(item.canonicalUrl);
    if (!canonical) continue;
    if (!canonicals.has(canonical)) canonicals.set(canonical, []);
    canonicals.get(canonical).push(item.sourceId);
  }
  if (canonicals.size <= 1) return [];
  return [{
    kind: 'identity-mismatch',
    severity: 'warning',
    capability: 'identity',
    values: Object.fromEntries(canonicals),
    message: 'Discovery sources disagree about the canonical site URL.'
  }];
}

function scorePlan(item, intent) {
  const sourceBoost = item.sourceAuthority === 'ietf-standard' || item.sourceAuthority === 'upstream-standard' ? 4 : item.sourceAuthority === 'project-profile' ? 3 : 1;
  if (intent === 'read') {
    if (item.kind === 'llms') return 100 + sourceBoost;
    if (item.kind === 'markdown-negotiated' || item.kind === 'markdown-alternate') return 90 + sourceBoost;
    if (item.kind === 'feed') return 80 + sourceBoost;
    if (item.kind === 'catalog') return 55 + sourceBoost;
    if (item.kind === 'html' || item.protocol === 'HTML') return 50 + sourceBoost;
  }
  if (intent === 'search') {
    if (item.kind === 'search') return 110 + sourceBoost;
    if (item.kind === 'index') return 100 + sourceBoost;
    if (item.protocol === 'OpenAPI') return 60 + sourceBoost;
  }
  if (intent === 'structured') {
    if (item.protocol === 'OpenAPI' || item.kind === 'api-description') return 110 + sourceBoost;
    if (item.kind === 'api-endpoint') return 90 + sourceBoost;
    if (item.kind === 'schema') return 80 + sourceBoost;
    if (item.kind === 'distribution') return 70 + sourceBoost;
  }
  if (intent === 'tools') {
    if (item.protocol === 'MCP' && item.transport === 'streamable-http') return 120 + sourceBoost;
    if (item.protocol === 'MCP') return 95 + sourceBoost;
    if (item.protocol === 'WebMCP') return 70 + sourceBoost;
  }
  if (intent === 'agent') {
    if (item.protocol === 'A2A') return 120 + sourceBoost;
  }
  return 0;
}

function attachAuthority(interfaces, sourceMap) {
  for (const values of Object.values(interfaces)) {
    for (const item of values) {
      if (!item.sourceAuthority) item.sourceAuthority = sourceMap.get(item.sourceId)?.authority || 'unknown';
    }
  }
}

export function planResolvedSite(resolution, intent) {
  const normalizedIntent = String(intent || '').toLowerCase();
  if (!['read', 'search', 'structured', 'tools', 'agent'].includes(normalizedIntent)) throw new Error(`Unsupported intent: ${intent}`);
  const candidateGroups = {
    read: ['content', 'data'],
    search: ['retrieval', 'apis'],
    structured: ['apis', 'data'],
    tools: ['tools', 'browserTools'],
    agent: ['agents']
  };
  const candidates = candidateGroups[normalizedIntent]
    .flatMap(group => resolution.interfaces[group] || [])
    .map(item => ({ ...item, score: scorePlan(item, normalizedIntent) }))
    .filter(item => item.score > 0 && item.url)
    .sort((a, b) => b.score - a.score || String(a.url).localeCompare(String(b.url)));
  return {
    intent: normalizedIntent,
    selected: candidates[0] || null,
    fallbacks: candidates.slice(1, 5),
    reason: candidates[0] ? `Selected ${candidates[0].kind || candidates[0].protocol} from ${candidates[0].sourceAuthority} evidence.` : `No suitable ${normalizedIntent} interface was resolved.`
  };
}

export function explainResolvedSite(resolution) {
  const counts = Object.fromEntries(Object.entries(resolution.interfaces).map(([key, values]) => [key, values.length]));
  const lines = [
    `${resolution.identity.name || new URL(resolution.canonicalUrl).hostname}`,
    `Canonical: ${resolution.canonicalUrl}`,
    `Evidence: ${resolution.summary.sourcesResolved}/${resolution.summary.sourcesAttempted} discovery sources resolved; ${resolution.conflicts.length} conflict(s).`,
    ''
  ];
  const labels = {
    content: 'Content', data: 'Data', retrieval: 'Retrieval', apis: 'APIs', tools: 'Tools', skills: 'Skills', agents: 'Agents', browserTools: 'Browser tools', auth: 'Auth', trust: 'Trust'
  };
  for (const [group, label] of Object.entries(labels)) if (counts[group]) lines.push(`${label}: ${counts[group]}`);
  if (resolution.conflicts.length) {
    lines.push('', 'Conflicts:');
    for (const conflict of resolution.conflicts) lines.push(`- ${conflict.message}`);
  }
  lines.push('', 'Recommended interfaces:');
  for (const intent of ['read', 'search', 'structured', 'tools', 'agent']) {
    const plan = planResolvedSite(resolution, intent);
    lines.push(`- ${intent}: ${plan.selected?.url || 'none'}${plan.selected ? ` (${plan.selected.protocol || plan.selected.kind})` : ''}`);
  }
  return lines.join('\n');
}

async function tryJson(url, type, sourceIndex, state, options, adapt) {
  const id = makeSourceId(type, sourceIndex);
  state.attempted += 1;
  try {
    const fetched = await fetchPublicJson(url, options);
    if (!fetched.ok) {
      state.sources.push(sourceRecord(id, type, fetched.url || url, fetched.parseError ? 'invalid' : 'not-found', { httpStatus: fetched.status, issue: fetched.parseError || null }));
      return null;
    }
    const adapted = adapt(fetched.json, id, fetched.url);
    state.sources.push(sourceRecord(id, type, fetched.url, 'resolved', { authority: adapted.authority, contentType: fetched.contentType }));
    state.resolved += 1;
    state.sourceInterfaces.set(id, adapted.interfaces || emptyInterfaces());
    mergeInterfaces(state.interfaces, adapted.interfaces || emptyInterfaces());
    if (adapted.identity) state.identityEvidence.push({ sourceId: id, ...adapted.identity });
    return { ...adapted, fetched };
  } catch (error) {
    state.sources.push(sourceRecord(id, type, url, 'error', { issue: String(error?.message || error) }));
    return null;
  }
}

async function tryText(url, type, sourceIndex, state, options, adapt) {
  const id = makeSourceId(type, sourceIndex);
  state.attempted += 1;
  try {
    const fetched = await fetchPublicText(url, options);
    if (!fetched.ok) {
      state.sources.push(sourceRecord(id, type, fetched.url || url, 'not-found', { httpStatus: fetched.status }));
      return null;
    }
    const adapted = adapt(fetched.text, id, fetched.url);
    state.sources.push(sourceRecord(id, type, fetched.url, 'resolved', { authority: adapted.authority, contentType: fetched.contentType }));
    state.resolved += 1;
    state.sourceInterfaces.set(id, adapted.interfaces || emptyInterfaces());
    mergeInterfaces(state.interfaces, adapted.interfaces || emptyInterfaces());
    return { ...adapted, fetched };
  } catch (error) {
    state.sources.push(sourceRecord(id, type, url, 'error', { issue: String(error?.message || error) }));
    return null;
  }
}

export async function resolveSite(input, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = 8000,
  maxBytes = 512 * 1024
} = {}) {
  const scan = await scanSite(input, { fetchImpl, resolveImpl, timeoutMs, maxBytes });
  const origin = new URL(scan.canonicalUrl).origin;
  const metrics = { requests: 0, bytes: 0 };
  const options = { fetchImpl, resolveImpl, timeoutMs, maxBytes, metrics };
  const state = {
    attempted: 0,
    resolved: 0,
    sources: [],
    interfaces: emptyInterfaces(),
    sourceInterfaces: new Map(),
    identityEvidence: [{ sourceId: 'homepage', canonicalUrl: scan.canonicalUrl, name: scan.identity.name, description: scan.identity.description }]
  };

  for (const item of scan.evidence) {
    const group = item.key === 'web.llms' || item.key === 'web.sitemap' || item.key === 'web.feed' ? 'content' : null;
    if (group) state.interfaces[group].push({ sourceId: 'homepage-scan', kind: item.key.replace('web.', ''), url: item.url, protocol: item.key === 'web.llms' ? 'llms.txt' : undefined, sourceAuthority: 'observed-web' });
  }

  let httpDiscovery = null;
  const httpHeadId = 'http-head:0';
  state.attempted += 1;
  try {
    const head = await fetchPublicHead(scan.canonicalUrl, { fetchImpl, resolveImpl, timeoutMs, metrics });
    if (head.ok) {
      httpDiscovery = adaptHttpDiscovery(head, httpHeadId);
      state.sources.push(sourceRecord(httpHeadId, 'http-head', head.url, 'resolved', { authority: 'observed-web', contentType: head.contentType }));
      state.resolved += 1;
      state.sourceInterfaces.set(httpHeadId, httpDiscovery.interfaces);
      mergeInterfaces(state.interfaces, httpDiscovery.interfaces);
    } else {
      state.sources.push(sourceRecord(httpHeadId, 'http-head', head.url, 'not-found', { httpStatus: head.status }));
    }
  } catch (error) {
    state.sources.push(sourceRecord(httpHeadId, 'http-head', scan.canonicalUrl, 'error', { issue: String(error?.message || error) }));
  }

  const arwpProfileUrls = [...new Set([
    scan.existingProfile?.url,
    ...(httpDiscovery?.arwpProfiles || [])
  ].filter(Boolean))].slice(0, 3);
  for (let index = 0; index < arwpProfileUrls.length; index += 1) {
    await tryJson(arwpProfileUrls[index], index === 0 ? 'arwp-profile' : 'arwp-profile-link', index === 0 ? 0 : index - 1, state, options, (payload, id) => {
      const validation = validateProfile(payload);
      if (!validation.valid) throw new Error('ARWP profile failed schema validation.');
      return adaptArwpProfile(payload, id);
    });
  }

  const agentsJson = await tryJson(new URL('/agents.json', origin).href, 'agents-json', 0, state, options, adaptAgentsJson);
  const agentsTxt = await tryText(new URL('/agents.txt', origin).href, 'agents-txt', 0, state, { ...options, accept: 'text/plain, */*;q=0.1' }, (text, id, url) => parseAgentsTxt(text, id, url));
  if (agentsTxt?.jsonUrl && normalizeUrl(agentsTxt.jsonUrl) !== normalizeUrl(new URL('/agents.json', origin).href) && !agentsJson?.fetched?.ok) {
    await tryJson(agentsTxt.jsonUrl, 'agents-json-pointer', 0, state, options, adaptAgentsJson);
  }

  const conventionalApiCatalog = new URL('/.well-known/api-catalog', origin).href;
  await tryJson(conventionalApiCatalog, 'api-catalog', 0, state, { ...options, accept: 'application/linkset+json, application/json;q=0.9, */*;q=0.1' }, adaptApiCatalog);
  const linkedCatalogs = [...new Set(httpDiscovery?.apiCatalogs || [])]
    .filter(url => normalizeUrl(url) !== normalizeUrl(conventionalApiCatalog))
    .slice(0, 4);
  for (let index = 0; index < linkedCatalogs.length; index += 1) {
    await tryJson(linkedCatalogs[index], 'api-catalog-link', index, state, { ...options, accept: 'application/linkset+json, application/json;q=0.9, */*;q=0.1' }, adaptApiCatalog);
  }

  await tryJson(new URL('/.well-known/oauth-protected-resource', origin).href, 'oauth-protected-resource', 0, state, options, (payload, id, url) => adaptProtectedResource(payload, id, url));
  await tryJson(new URL('/.well-known/agent-card.json', origin).href, 'a2a-agent-card', 0, state, options, (payload, id, url) => adaptA2aCard(payload, id, url));
  await tryJson(new URL('/.well-known/agent-skills/index.json', origin).href, 'agent-skills-index', 0, state, options, (payload, id, url) => adaptAgentSkillsIndex(payload, id, url));

  const aiCatalog = await tryJson(new URL('/.well-known/ai-catalog.json', origin).href, 'mcp-ai-catalog', 0, state, options, (payload, id) => ({ interfaces: emptyInterfaces(), ...adaptAiCatalog(payload, id) }));
  if (aiCatalog?.cards?.length) {
    let cardIndex = 0;
    for (const card of aiCatalog.cards.slice(0, 8)) {
      if (card.data) {
        const id = makeSourceId('mcp-server-card-inline', cardIndex++);
        const adapted = adaptMcpServerCard(card.data, id, aiCatalog.fetched.url);
        state.sources.push(sourceRecord(id, 'mcp-server-card-inline', aiCatalog.fetched.url, 'resolved', { authority: adapted.authority, identifier: card.identifier }));
        state.resolved += 1;
        state.attempted += 1;
        state.sourceInterfaces.set(id, adapted.interfaces);
        mergeInterfaces(state.interfaces, adapted.interfaces);
      } else if (card.url) {
        await tryJson(card.url, 'mcp-server-card', cardIndex++, state, { ...options, accept: 'application/mcp-server-card+json, application/json;q=0.9, */*;q=0.1' }, (payload, id, url) => adaptMcpServerCard(payload, id, url));
      }
    }
  }

  const knownMcpEndpoints = state.interfaces.tools.filter(item => item.protocol === 'MCP' && item.kind === 'mcp' && item.transport === 'streamable-http').map(item => item.url).filter(Boolean);
  let fallbackCardIndex = 0;
  for (const endpoint of [...new Set(knownMcpEndpoints)].slice(0, 4)) {
    const cardUrl = `${endpoint.replace(/\/$/, '')}/server-card`;
    if (state.sources.some(source => normalizeUrl(source.url) === normalizeUrl(cardUrl))) continue;
    await tryJson(cardUrl, 'mcp-server-card-fallback', fallbackCardIndex++, state, { ...options, accept: 'application/mcp-server-card+json, application/json;q=0.9, */*;q=0.1' }, (payload, id, url) => adaptMcpServerCard(payload, id, url));
  }

  const sourceMap = new Map(state.sources.map(source => [source.id, source]));
  attachAuthority(state.interfaces, sourceMap);
  dedupeInterfaces(state.interfaces);
  const conflicts = [
    ...identityConflicts(state.identityEvidence),
    ...agentsPairConflicts(state.sourceInterfaces),
    ...mcpCardConflicts(state.interfaces)
  ];

  const resolvedIdentity = state.identityEvidence.find(item => item.sourceId?.startsWith('arwp-profile')) || state.identityEvidence.find(item => item.sourceId === 'agents-json:0') || state.identityEvidence[0];
  const resolution = {
    resolverVersion: '0.1',
    target: input,
    canonicalUrl: scan.canonicalUrl,
    identity: {
      name: resolvedIdentity?.name || scan.identity.name,
      description: resolvedIdentity?.description || scan.identity.description,
      canonicalUrl: resolvedIdentity?.canonicalUrl || scan.canonicalUrl
    },
    interfaces: state.interfaces,
    sources: state.sources,
    conflicts,
    metrics: {
      resolverRequests: metrics.requests,
      resolverBytes: metrics.bytes,
      note: 'Counts resolver discovery fetches after the bounded base-site scan; scanner requests are reported separately by scanner tooling.'
    },
    summary: {
      sourcesAttempted: state.attempted,
      sourcesResolved: state.resolved,
      interfacesResolved: Object.values(state.interfaces).reduce((total, values) => total + values.length, 0),
      conflicts: conflicts.length
    },
    upstreamStatus: {
      'RFC8288 HTTP Link': 'ietf-standard',
      'RFC9727': 'ietf-standard',
      'RFC9728': 'ietf-standard',
      'A2A': 'upstream-standard',
      'Agent Skills': 'upstream-convention',
      'agents.txt/json': 'community-convention',
      'MCP Server Card / AI Catalog': 'experimental-upstream'
    }
  };
  resolution.plans = Object.fromEntries(['read', 'search', 'structured', 'tools', 'agent'].map(intent => [intent, planResolvedSite(resolution, intent)]));
  return resolution;
}
