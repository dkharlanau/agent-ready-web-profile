import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { validateProfile } from '../lib/validator.mjs';
import { parseIndexText, searchRecords, findRecord } from './lib.mjs';

export const DEFAULT_PROFILE_SOURCE = process.env.ARWP_PROFILE || path.resolve(process.cwd(), 'ai', 'site-profile.json');

const asText = value => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }]
});

function isHttp(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function inferFormat(index) {
  if (index.format) return index.format;
  const source = `${index.url || ''} ${index.mediaType || ''}`.toLowerCase();
  if (source.includes('ndjson') || source.endsWith('.ndjson')) return 'ndjson';
  if (source.includes('jsonl') || source.endsWith('.jsonl')) return 'jsonl';
  return 'json';
}

async function loadProfile(profileSource, fetchImpl) {
  let profile;
  let sourceUrl = null;

  if (isHttp(profileSource)) {
    const response = await fetchImpl(profileSource, {
      headers: { Accept: 'application/json' },
      redirect: 'follow'
    });
    if (!response.ok) {
      throw new Error(`Unable to fetch ARWP profile: HTTP ${response.status}`);
    }
    profile = await response.json();
    sourceUrl = response.url;
  } else {
    const file = path.resolve(profileSource);
    if (!fs.existsSync(file)) {
      throw new Error(`ARWP profile not found: ${file}. Set ARWP_PROFILE to a local file or HTTPS URL.`);
    }
    profile = JSON.parse(fs.readFileSync(file, 'utf8'));
    sourceUrl = pathToFileURL(file).href;
  }

  const validation = validateProfile(profile);
  if (!validation.valid) {
    const details = validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`ARWP profile is invalid: ${details}`);
  }

  return { profile, sourceUrl, warnings: validation.warnings };
}

function createAllowedOrigins(profile, sourceUrl, extras = []) {
  const allowed = new Set([new URL(profile.canonicalUrl).origin]);
  if (sourceUrl?.startsWith('http')) allowed.add(new URL(sourceUrl).origin);

  const configured = [
    ...String(process.env.ARWP_ALLOWED_ORIGINS || '').split(','),
    ...extras
  ].map(value => String(value).trim()).filter(Boolean);

  for (const value of configured) {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new Error(`ARWP_ALLOWED_ORIGINS must contain HTTPS origins only: ${value}`);
    }
    allowed.add(parsed.origin);
  }
  return allowed;
}

function assertAllowedUrl(url, allowed) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`Only HTTPS resources are allowed: ${url}`);
  if (parsed.username || parsed.password) throw new Error('Resource URLs containing credentials are not allowed.');
  if (!allowed.has(parsed.origin)) {
    throw new Error(`Cross-origin resource blocked: ${parsed.origin}. Add it explicitly with ARWP_ALLOWED_ORIGINS.`);
  }
  return parsed;
}

function collectResources(profile) {
  const resources = new Map();
  const add = (key, url, meta = {}) => {
    if (url) resources.set(key, { key, url, ...meta });
  };

  add('web.sitemap', profile.web?.sitemap);
  add('web.robots', profile.web?.robots);
  add('web.llms', profile.web?.llms);
  add('web.markdownIndex', profile.web?.markdownIndex);
  for (const [index, feed] of (profile.web?.feeds ?? []).entries()) {
    add(`web.feeds.${index}`, feed.url, { mediaType: feed.mediaType, title: feed.title });
  }

  add('data.catalog', profile.data?.catalog);
  add('data.schemas', profile.data?.schemas);
  add('data.openapi', profile.data?.openapi);
  add('data.releases', profile.data?.releases);
  add('data.croissant', profile.data?.croissant);
  for (const [index, item] of (profile.data?.distributions ?? []).entries()) {
    add(`data.distributions.${index}`, item.url, {
      name: item.name,
      mediaType: item.mediaType,
      role: item.role,
      description: item.description
    });
  }

  add('retrieval.search', profile.retrieval?.search);
  add('retrieval.abstention', profile.retrieval?.abstention);
  for (const [index, item] of (profile.retrieval?.indexes ?? []).entries()) {
    add(`retrieval.indexes.${index}`, item.url, {
      name: item.name,
      mediaType: item.mediaType,
      format: inferFormat(item),
      description: item.description
    });
  }

  add('agentSkills.catalog', profile.agentSkills?.catalog);
  add('agentSkills.specification', profile.agentSkills?.specification);
  for (const [index, skill] of (profile.agentSkills?.skills ?? []).entries()) {
    add(`agentSkills.skills.${index}.url`, skill.url, {
      name: skill.name,
      version: skill.version,
      description: skill.description
    });
    add(`agentSkills.skills.${index}.source`, skill.source, { name: skill.name });
  }

  for (const [index, page] of (profile.agentWeb?.webmcp?.pages ?? []).entries()) {
    add(`agentWeb.webmcp.pages.${index}`, page);
  }
  add('agentWeb.webmcp.documentation', profile.agentWeb?.webmcp?.documentation);

  for (const [index, server] of (profile.mcp?.servers ?? []).entries()) {
    add(`mcp.servers.${index}.url`, server.url, { name: server.name, transport: server.transport });
    add(`mcp.servers.${index}.source`, server.source, { name: server.name, transport: server.transport });
    add(`mcp.servers.${index}.registry`, server.registry, { name: server.name });
    add(`mcp.servers.${index}.documentation`, server.documentation, { name: server.name });
  }

  add('a2a.agentCard', profile.a2a?.agentCard);
  add('identity.aliases', profile.identity?.aliases);

  for (const key of ['license', 'citation', 'provenance', 'reviewPolicy', 'security']) {
    add(`trust.${key}`, profile.trust?.[key]);
  }

  return resources;
}

function retrievalIndexes(profile) {
  return (profile.retrieval?.indexes ?? []).map((item, index) => ({
    key: `retrieval.indexes.${index}`,
    name: item.name,
    url: item.url,
    mediaType: item.mediaType,
    format: inferFormat(item),
    description: item.description
  }));
}

function selectIndex(indexes, requested) {
  if (!indexes.length) throw new Error('The ARWP profile declares no retrieval indexes.');
  if (!requested) return indexes[0];
  const wanted = String(requested).toLocaleLowerCase();
  const selected = indexes.find(item => item.key.toLocaleLowerCase() === wanted || item.name.toLocaleLowerCase() === wanted);
  if (!selected) throw new Error(`Unknown retrieval index: ${requested}`);
  return selected;
}

export async function prepareGatewayContext({
  profileSource = DEFAULT_PROFILE_SOURCE,
  fetchImpl = fetch,
  cacheTtlMs = Number(process.env.ARWP_CACHE_TTL_MS || 300000),
  maxBytes = Number(process.env.ARWP_MAX_BYTES || 2 * 1024 * 1024),
  extraAllowedOrigins = []
} = {}) {
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0) throw new Error('cacheTtlMs must be a non-negative number.');
  if (!Number.isFinite(maxBytes) || maxBytes < 1024) throw new Error('maxBytes must be at least 1024.');

  const { profile, sourceUrl, warnings } = await loadProfile(profileSource, fetchImpl);
  const allowed = createAllowedOrigins(profile, sourceUrl, extraAllowedOrigins);
  const cache = new Map();

  async function fetchText(url) {
    assertAllowedUrl(url, allowed);
    const cached = cache.get(url);
    if (cached && Date.now() - cached.time < cacheTtlMs) return cached.text;

    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json, application/x-ndjson, application/jsonl, text/plain, text/markdown, application/xml;q=0.8, */*;q=0.1'
      },
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
    assertAllowedUrl(response.url, allowed);

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength && declaredLength > maxBytes) {
      throw new Error(`Resource exceeds maxBytes (${maxBytes}): ${url}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error(`Resource exceeds maxBytes (${maxBytes}): ${url}`);
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    cache.set(url, { time: Date.now(), text });
    return text;
  }

  return {
    profile,
    profileSource,
    sourceUrl,
    warnings,
    allowed,
    resources: collectResources(profile),
    indexes: retrievalIndexes(profile),
    fetchText
  };
}

export function createGatewayServer(context) {
  const { profile, sourceUrl, warnings, resources, indexes, fetchText } = context;
  const server = new McpServer({
    name: `arwp-gateway-${profile.id}`,
    version: '0.1.0'
  });

  server.registerTool(
    'get_site_profile',
    {
      description: 'Return the validated Agent-Ready Web Profile that configures this read-only gateway.',
      inputSchema: z.object({})
    },
    async () => asText({ source: sourceUrl, warnings, profile })
  );

  server.registerTool(
    'list_declared_resources',
    {
      description: 'List public web, data, retrieval, Agent Skills, integration and trust resources declared by the ARWP profile. Listing does not fetch them.',
      inputSchema: z.object({
        prefix: z.string().optional().describe('Optional key prefix such as data, retrieval, agentSkills, mcp, web or trust.')
      })
    },
    async ({ prefix }) => {
      const all = [...resources.values()];
      const filtered = prefix ? all.filter(item => item.key.startsWith(prefix)) : all;
      return asText({ resources: filtered });
    }
  );

  server.registerTool(
    'fetch_declared_resource',
    {
      description: 'Fetch one explicitly declared allowed-origin public resource by ARWP resource key. Arbitrary URLs are not accepted.',
      inputSchema: z.object({
        key: z.string().min(1),
        max_chars: z.number().int().min(100).max(100000).default(20000)
      })
    },
    async ({ key, max_chars }) => {
      const resource = resources.get(key);
      if (!resource) return asText({ found: false, key, available: [...resources.keys()] });
      const text = await fetchText(resource.url);
      return asText({
        found: true,
        resource,
        truncated: text.length > max_chars,
        content: text.slice(0, max_chars)
      });
    }
  );

  server.registerTool(
    'search_retrieval',
    {
      description: 'Run a deterministic lexical search over a declared JSON/JSONL/NDJSON retrieval index. This gateway does not invent domain semantics.',
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(20).default(5),
        index: z.string().optional().describe('Optional index name or ARWP resource key.')
      })
    },
    async ({ query, limit, index }) => {
      const selected = selectIndex(indexes, index);
      const records = parseIndexText(await fetchText(selected.url), selected.format);
      return asText({
        query,
        index: selected,
        count: records.length,
        results: searchRecords(records, query, limit)
      });
    }
  );

  server.registerTool(
    'get_record',
    {
      description: 'Get one record by stable ID, alias, slug or URL from a declared retrieval index. Returns found:false instead of fabricating a record.',
      inputSchema: z.object({
        id: z.string().min(1),
        index: z.string().optional().describe('Optional index name or ARWP resource key.')
      })
    },
    async ({ id, index }) => {
      const selected = selectIndex(indexes, index);
      const records = parseIndexText(await fetchText(selected.url), selected.format);
      const record = findRecord(records, id);
      return asText(record ? { found: true, index: selected, record } : { found: false, id, index: selected });
    }
  );

  return server;
}
