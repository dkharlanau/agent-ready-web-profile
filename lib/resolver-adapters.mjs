const AUTHORITY = {
  arwp: 'project-profile',
  agents: 'community-convention',
  rfc: 'ietf-standard',
  a2a: 'upstream-standard',
  mcpCard: 'experimental-upstream',
  agentSkills: 'upstream-convention'
};

const groups = ['content', 'data', 'retrieval', 'apis', 'tools', 'skills', 'agents', 'browserTools', 'auth', 'trust'];

export function emptyInterfaces() {
  return Object.fromEntries(groups.map(group => [group, []]));
}

function add(out, group, item) {
  if (!out[group]) out[group] = [];
  out[group].push(item);
}

function urlItem(url, sourceId, extra = {}) {
  return { url, sourceId, ...extra };
}

export function mergeInterfaces(target, incoming) {
  for (const group of groups) {
    for (const item of incoming[group] || []) add(target, group, item);
  }
  return target;
}

export function dedupeInterfaces(interfaces) {
  for (const group of groups) {
    const seen = new Set();
    interfaces[group] = (interfaces[group] || []).filter(item => {
      const key = `${item.protocol || ''}|${item.url || ''}|${item.name || ''}|${item.kind || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return interfaces;
}

export function sourceRecord(id, type, url, status, extra = {}) {
  return { id, type, url, status, ...extra };
}

export function adaptArwpProfile(profile, sourceId) {
  const out = emptyInterfaces();
  if (profile.web?.sitemap) add(out, 'content', urlItem(profile.web.sitemap, sourceId, { kind: 'sitemap', protocol: 'sitemap' }));
  if (profile.web?.llms) add(out, 'content', urlItem(profile.web.llms, sourceId, { kind: 'llms', protocol: 'llms.txt' }));
  for (const feed of profile.web?.feeds || []) add(out, 'content', urlItem(feed.url, sourceId, { kind: 'feed', mediaType: feed.mediaType, name: feed.title }));
  if (profile.data?.catalog) add(out, 'data', urlItem(profile.data.catalog, sourceId, { kind: 'catalog' }));
  if (profile.data?.schemas) add(out, 'data', urlItem(profile.data.schemas, sourceId, { kind: 'schema' }));
  if (profile.data?.openapi) add(out, 'apis', urlItem(profile.data.openapi, sourceId, { kind: 'openapi', protocol: 'OpenAPI' }));
  if (profile.data?.releases) add(out, 'data', urlItem(profile.data.releases, sourceId, { kind: 'releases' }));
  if (profile.data?.croissant) add(out, 'data', urlItem(profile.data.croissant, sourceId, { kind: 'croissant', protocol: 'Croissant' }));
  for (const item of profile.data?.distributions || []) add(out, 'data', urlItem(item.url, sourceId, { kind: item.role || 'distribution', mediaType: item.mediaType, name: item.name, description: item.description }));
  if (profile.retrieval?.search) add(out, 'retrieval', urlItem(profile.retrieval.search, sourceId, { kind: 'search' }));
  for (const item of profile.retrieval?.indexes || []) add(out, 'retrieval', urlItem(item.url, sourceId, { kind: 'index', name: item.name, mediaType: item.mediaType, format: item.format, description: item.description }));
  for (const skill of profile.agentSkills?.skills || []) add(out, 'skills', urlItem(skill.url, sourceId, { kind: 'skill', protocol: 'Agent Skills', name: skill.name, version: skill.version, description: skill.description }));
  if (profile.agentSkills?.catalog) add(out, 'skills', urlItem(profile.agentSkills.catalog, sourceId, { kind: 'catalog', protocol: 'Agent Skills' }));
  for (const page of profile.agentWeb?.webmcp?.pages || []) add(out, 'browserTools', urlItem(page, sourceId, { kind: 'webmcp-page', protocol: 'WebMCP' }));
  for (const server of profile.mcp?.servers || []) add(out, 'tools', urlItem(server.url || server.source || server.registry || server.documentation, sourceId, { kind: 'mcp', protocol: 'MCP', name: server.name, transport: server.transport, registry: server.registry, source: server.source, readOnly: server.readOnly }));
  if (profile.a2a?.agentCard) add(out, 'agents', urlItem(profile.a2a.agentCard, sourceId, { kind: 'agent-card', protocol: 'A2A' }));
  for (const key of ['license', 'citation', 'provenance', 'reviewPolicy', 'security']) if (profile.trust?.[key]) add(out, 'trust', urlItem(profile.trust[key], sourceId, { kind: key }));
  return { interfaces: out, identity: { id: profile.id, name: profile.name, description: profile.description, canonicalUrl: profile.canonicalUrl }, authority: AUTHORITY.arwp };
}

export function parseAgentsTxt(text, sourceId, baseUrl) {
  const out = emptyInterfaces();
  let jsonUrl = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const jsonMatch = line.match(/^#\s*JSON:\s*(\S+)/i);
    if (jsonMatch) {
      try { jsonUrl = new URL(jsonMatch[1], baseUrl).href; } catch { /* ignore */ }
      continue;
    }
    const pair = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.+)$/);
    if (!pair) continue;
    const key = pair[1].toLowerCase();
    const value = pair[2].trim();
    if (key === 'mcp') add(out, 'tools', urlItem(value, sourceId, { kind: 'mcp', protocol: 'MCP', transport: 'streamable-http' }));
    if (key === 'skills') add(out, 'skills', urlItem(value, sourceId, { kind: 'skill', protocol: 'Agent Skills' }));
    if (key === 'a2a') add(out, 'agents', urlItem(value, sourceId, { kind: 'agent-card', protocol: 'A2A' }));
    if (key === 'webmcp') add(out, 'browserTools', urlItem(value, sourceId, { kind: 'webmcp-page', protocol: 'WebMCP' }));
    if (key === 'authorization') add(out, 'auth', { sourceId, kind: 'authorization', protocol: value });
  }
  return { interfaces: out, jsonUrl, authority: AUTHORITY.agents };
}

export function adaptAgentsJson(payload, sourceId) {
  const out = emptyInterfaces();
  for (const server of payload?.mcp || []) add(out, 'tools', urlItem(server.url, sourceId, { kind: 'mcp', protocol: 'MCP', transport: server.type || 'streamable-http', description: server.description }));
  for (const skill of payload?.skills || []) add(out, 'skills', urlItem(skill.url, sourceId, { kind: 'skill', protocol: 'Agent Skills', description: skill.description }));
  for (const agent of payload?.a2a || []) add(out, 'agents', urlItem(agent.url, sourceId, { kind: 'agent-card', protocol: 'A2A', description: agent.description }));
  for (const page of payload?.webmcp || []) add(out, 'browserTools', urlItem(page.url, sourceId, { kind: 'webmcp-page', protocol: 'WebMCP', description: page.description }));
  if (payload?.authorization) add(out, 'auth', { sourceId, kind: 'authorization', protocol: (payload.authorization.protocols || []).join(',') || null, discovery: payload.authorization.discovery, identity: payload.authorization.identity });
  const unmappedBlocks = ['payments', 'ucp'].filter(key => payload?.[key] != null);
  return {
    interfaces: out,
    identity: payload?.site ? { name: payload.site.name, canonicalUrl: payload.site.url, description: payload.site.description } : null,
    authority: AUTHORITY.agents,
    unmappedBlocks
  };
}

function relationEntries(linksetItem, relation) {
  const value = linksetItem?.[relation];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function adaptApiCatalog(payload, sourceId) {
  const out = emptyInterfaces();
  for (const entry of payload?.linkset || []) {
    if (entry.anchor && /^https:\/\//i.test(entry.anchor)) add(out, 'apis', urlItem(entry.anchor, sourceId, { kind: 'api-endpoint', protocol: 'RFC9727' }));
    for (const item of relationEntries(entry, 'item')) if (item?.href) add(out, 'apis', urlItem(item.href, sourceId, { kind: 'api-endpoint', protocol: 'RFC9727' }));
    for (const item of relationEntries(entry, 'service-desc')) if (item?.href) add(out, 'apis', urlItem(item.href, sourceId, { kind: 'api-description', protocol: 'RFC9727', mediaType: item.type }));
    for (const item of relationEntries(entry, 'service-doc')) if (item?.href) add(out, 'apis', urlItem(item.href, sourceId, { kind: 'api-documentation', protocol: 'RFC9727', mediaType: item.type }));
    for (const item of relationEntries(entry, 'api-catalog')) if (item?.href) add(out, 'apis', urlItem(item.href, sourceId, { kind: 'api-catalog', protocol: 'RFC9727' }));
  }
  return { interfaces: out, authority: AUTHORITY.rfc };
}

export function adaptProtectedResource(payload, sourceId, sourceUrl) {
  const out = emptyInterfaces();
  add(out, 'auth', {
    sourceId,
    kind: 'oauth-protected-resource',
    protocol: 'RFC9728',
    url: sourceUrl,
    resource: payload?.resource || null,
    authorizationServers: payload?.authorization_servers || [],
    scopes: payload?.scopes_supported || [],
    bearerMethods: payload?.bearer_methods_supported || []
  });
  return { interfaces: out, authority: AUTHORITY.rfc };
}

export function adaptA2aCard(card, sourceId, sourceUrl) {
  const out = emptyInterfaces();
  const interfaces = card?.supportedInterfaces || card?.additionalInterfaces || [];
  const primaryLegacy = card?.url ? [{ url: card.url, protocolBinding: card.preferredTransport, protocolVersion: card.protocolVersion }] : [];
  const supported = interfaces.length ? interfaces : primaryLegacy;
  add(out, 'agents', {
    sourceId,
    kind: 'agent-card',
    protocol: 'A2A',
    url: sourceUrl,
    name: card?.name,
    description: card?.description,
    version: card?.version,
    supportedInterfaces: supported,
    skills: card?.skills || [],
    signaturesPresent: Array.isArray(card?.signatures) && card.signatures.length > 0
  });
  return { interfaces: out, authority: AUTHORITY.a2a };
}

export function adaptAgentSkillsIndex(payload, sourceId, sourceUrl) {
  const out = emptyInterfaces();
  for (const skill of payload?.skills || payload?.items || []) {
    if (!skill?.url) continue;
    add(out, 'skills', urlItem(skill.url, sourceId, { kind: skill.type || 'skill', protocol: 'Agent Skills', name: skill.name, description: skill.description, digest: skill.digest, catalogUrl: sourceUrl }));
  }
  return { interfaces: out, authority: AUTHORITY.agentSkills };
}

export function adaptMcpServerCard(card, sourceId, sourceUrl) {
  const out = emptyInterfaces();
  const remotes = Array.isArray(card?.remotes) ? card.remotes : [];
  for (const remote of remotes) {
    const endpoint = remote?.url || remote?.endpoint || remote?.transport?.endpoint;
    if (!endpoint) continue;
    add(out, 'tools', {
      sourceId,
      kind: 'mcp-server-card',
      protocol: 'MCP',
      url: endpoint,
      cardUrl: sourceUrl,
      name: card?.name,
      title: card?.title,
      description: card?.description,
      version: card?.version,
      transport: remote?.type || remote?.transport?.type || 'streamable-http',
      experimental: true
    });
  }
  return { interfaces: out, authority: AUTHORITY.mcpCard };
}

export function adaptAiCatalog(payload, sourceId) {
  const cards = [];
  for (const entry of payload?.entries || []) {
    if (entry?.type !== 'application/mcp-server-card+json') continue;
    cards.push({ identifier: entry.identifier || null, url: entry.url || null, data: entry.data || null });
  }
  return { cards, authority: AUTHORITY.mcpCard };
}
