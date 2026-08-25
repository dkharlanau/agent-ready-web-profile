#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { validateProfile } from '../lib/validator.mjs';
import { parseIndexText, searchRecords, findRecord } from './lib.mjs';

const PROFILE_SOURCE = process.env.ARWP_PROFILE || path.resolve(process.cwd(), 'ai', 'site-profile.json');
const CACHE_TTL_MS = Number(process.env.ARWP_CACHE_TTL_MS || 300000);
const MAX_BYTES = Number(process.env.ARWP_MAX_BYTES || 2 * 1024 * 1024);
const cache = new Map();

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

async function loadProfile() {
  let profile;
  let sourceUrl = null;

  if (isHttp(PROFILE_SOURCE)) {
    const response = await fetch(PROFILE_SOURCE, {
      headers: { Accept: 'application/json' },
      redirect: 'follow'
    });
    if (!response.ok) {
      throw new Error(`Unable to fetch ARWP profile: HTTP ${response.status}`);
    }
    profile = await response.json();
    sourceUrl = response.url;
  } else {
    const file = path.resolve(PROFILE_SOURCE);
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

function allowedOrigins(profile, sourceUrl) {
  const allowed = new Set([new URL(profile.canonicalUrl).origin]);
  if (sourceUrl?.startsWith('http')) allowed.add(new URL(sourceUrl).origin);
  for (const value of String(process.env.ARWP_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)) {
    allowed.add(new URL(value).origin);
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

async function fetchText(url, allowed) {
  assertAllowedUrl(url, allowed);
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.text;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, application/x-ndjson, application/jsonl, text/plain, text/markdown, application/xml;q=0.8, */*;q=0.1'
    },
    redirect: 'follow'
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  assertAllowedUrl(response.url, allowed);

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > MAX_BYTES) {
    throw new Error(`Resource exceeds ARWP_MAX_BYTES (${MAX_BYTES}): ${url}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`Resource exceeds ARWP_MAX_BYTES (${MAX_BYTES}): ${url}`);
  }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  cache.set(url, { time: Date.now(), text });
  return text;
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

async function loadIndex(index, allowed) {
  const text = await fetchText(index.url, allowed);
  return parseIndexText(text, index.format);
}

async function prepareContext() {
  const { profile, sourceUrl, warnings } = await loadProfile();
  return {
    profile,
    sourceUrl,
    warnings,
    allowed: allowedOrigins(profile, sourceUrl),
    resources: collectResources(profile),
    indexes: retrievalIndexes(profile)
  };
}

function createServer(context) {
  const { profile, sourceUrl, warnings, allowed, resources, indexes } = context;
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
      description: 'List public web, data, retrieval and trust resources declared by the ARWP profile. Listing does not fetch them.',
      inputSchema: z.object({
        prefix: z.string().optional().describe('Optional key prefix such as data, retrieval, web or trust.')
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
      description: 'Fetch one explicitly declared same-origin public resource by ARWP resource key. Arbitrary URLs are not accepted.',
      inputSchema: z.object({
        key: z.string().min(1),
        max_chars: z.number().int().min(100).max(100000).default(20000)
      })
    },
    async ({ key, max_chars }) => {
      const resource = resources.get(key);
      if (!resource) return asText({ found: false, key, available: [...resources.keys()] });
      const text = await fetchText(resource.url, allowed);
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
      const records = await loadIndex(selected, allowed);
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
      const records = await loadIndex(selected, allowed);
      const record = findRecord(records, id);
      return asText(record ? { found: true, index: selected, record } : { found: false, id, index: selected });
    }
  );

  return server;
}

const context = await prepareContext();
void serveStdio(() => createServer(context));
console.error(`ARWP MCP gateway running on stdio with profile ${PROFILE_SOURCE}`);
