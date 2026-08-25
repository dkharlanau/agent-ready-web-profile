import fs from 'node:fs';
import path from 'node:path';
import { validateProfile, formatAjvError } from './validator.mjs';

function isHttp(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function expectedMedia(key, declaredMediaType) {
  if (declaredMediaType) return [declaredMediaType];
  if (key === 'web.sitemap') return ['application/xml', 'text/xml', 'application/rss+xml', 'text/plain'];
  if (key === 'web.robots') return ['text/plain'];
  if (key === 'web.llms') return ['text/plain', 'text/markdown'];
  if (key === 'web.markdownIndex') return ['application/json', 'text/markdown', 'text/plain'];
  if (key === 'data.openapi') return ['application/json', 'application/yaml', 'text/yaml', 'application/x-yaml'];
  if (key.startsWith('data.') || key.startsWith('retrieval.')) return ['application/json', 'application/x-ndjson', 'application/jsonl', 'text/plain', 'text/html'];
  if (key.startsWith('agentSkills.')) return ['text/markdown', 'text/plain', 'application/json', 'text/html'];
  if (key.startsWith('trust.')) return ['text/html', 'text/plain', 'text/markdown', 'application/json'];
  return [];
}

export function collectDeclaredUrls(profile) {
  const items = [];
  const add = (key, url, meta = {}) => {
    if (!url) return;
    items.push({ key, url, expectedMediaTypes: expectedMedia(key, meta.mediaType), ...meta });
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
    add(`data.distributions.${index}`, item.url, { mediaType: item.mediaType, name: item.name, role: item.role });
  }

  add('retrieval.search', profile.retrieval?.search);
  add('retrieval.abstention', profile.retrieval?.abstention);
  for (const [index, item] of (profile.retrieval?.indexes ?? []).entries()) {
    add(`retrieval.indexes.${index}`, item.url, { mediaType: item.mediaType, name: item.name, format: item.format });
  }

  add('agentSkills.catalog', profile.agentSkills?.catalog);
  add('agentSkills.specification', profile.agentSkills?.specification);
  for (const [index, skill] of (profile.agentSkills?.skills ?? []).entries()) {
    add(`agentSkills.skills.${index}.url`, skill.url, { name: skill.name, mediaType: 'text/markdown' });
    add(`agentSkills.skills.${index}.source`, skill.source, { name: skill.name });
  }

  for (const [index, page] of (profile.agentWeb?.webmcp?.pages ?? []).entries()) {
    add(`agentWeb.webmcp.pages.${index}`, page);
  }
  add('agentWeb.webmcp.documentation', profile.agentWeb?.webmcp?.documentation);

  for (const [index, server] of (profile.mcp?.servers ?? []).entries()) {
    if (server.url) add(`mcp.servers.${index}.url`, server.url, { transport: server.transport, name: server.name });
    if (server.source) add(`mcp.servers.${index}.source`, server.source, { transport: server.transport, name: server.name });
    if (server.registry) add(`mcp.servers.${index}.registry`, server.registry, { name: server.name });
    if (server.documentation) add(`mcp.servers.${index}.documentation`, server.documentation, { name: server.name });
  }

  add('a2a.agentCard', profile.a2a?.agentCard, { mediaType: 'application/json' });
  add('identity.aliases', profile.identity?.aliases);
  for (const key of ['license', 'citation', 'provenance', 'reviewPolicy', 'security']) {
    add(`trust.${key}`, profile.trust?.[key]);
  }

  return items;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function mediaTypeOnly(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function mediaMatches(actual, expected) {
  if (!expected.length || !actual) return true;
  const normalized = mediaTypeOnly(actual);
  return expected.some(item => normalized === mediaTypeOnly(item));
}

async function probeResource(item, { fetchImpl, timeoutMs }) {
  const started = Date.now();
  let response;
  let method = 'HEAD';

  try {
    response = await fetchWithTimeout(fetchImpl, item.url, { method: 'HEAD' }, timeoutMs);
    if ([405, 501].includes(response.status)) {
      method = 'GET';
      response = await fetchWithTimeout(fetchImpl, item.url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' }
      }, timeoutMs);
    }
  } catch (error) {
    return {
      ...item,
      status: 'fail',
      error: error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(error?.message ?? error),
      elapsedMs: Date.now() - started
    };
  }

  const contentType = response.headers?.get?.('content-type') ?? null;
  const finalUrl = response.url || item.url;
  const issues = [];

  if (response.status < 200 || response.status >= 400) issues.push(`HTTP ${response.status}`);
  if (!String(finalUrl).startsWith('https://')) issues.push('final URL is not HTTPS');
  if (!contentType) issues.push('missing Content-Type');
  else if (!mediaMatches(contentType, item.expectedMediaTypes)) issues.push(`unexpected Content-Type ${contentType}`);

  const hardFailure = response.status < 200 || response.status >= 400 || !String(finalUrl).startsWith('https://');

  try {
    await response.body?.cancel?.();
  } catch {
    // No-op: probing should not fail only because the response body cannot be cancelled.
  }

  return {
    ...item,
    status: hardFailure ? 'fail' : (issues.length ? 'warn' : 'pass'),
    httpStatus: response.status,
    method,
    finalUrl,
    contentType,
    issues,
    elapsedMs: Date.now() - started
  };
}

export async function readProfileSource(source, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (isHttp(source)) {
    const response = await fetchWithTimeout(fetchImpl, source, { method: 'GET', headers: { Accept: 'application/json' } }, timeoutMs);
    if (!response.ok) throw new Error(`Unable to fetch profile: HTTP ${response.status}`);
    const text = await response.text();
    return { profile: JSON.parse(text), source: response.url || source };
  }

  const file = path.resolve(source);
  return { profile: JSON.parse(fs.readFileSync(file, 'utf8')), source: file };
}

export async function verifyProfileSource(source, {
  fetchImpl = fetch,
  timeoutMs = 8000,
  concurrency = 6
} = {}) {
  const { profile, source: resolvedSource } = await readProfileSource(source, { fetchImpl, timeoutMs });
  const validation = validateProfile(profile);

  if (!validation.valid) {
    return {
      valid: false,
      source: resolvedSource,
      schemaErrors: validation.errors.map(formatAjvError),
      warnings: validation.warnings,
      resources: [],
      summary: { pass: 0, warn: 0, fail: 0, total: 0 }
    };
  }

  const declared = collectDeclaredUrls(profile);
  const resources = new Array(declared.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= declared.length) return;
      resources[index] = await probeResource(declared[index], { fetchImpl, timeoutMs });
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, declared.length || 1)) }, () => worker()));

  const summary = resources.reduce((acc, item) => {
    acc[item.status] += 1;
    acc.total += 1;
    return acc;
  }, { pass: 0, warn: 0, fail: 0, total: 0 });

  return {
    valid: summary.fail === 0,
    profileValid: true,
    source: resolvedSource,
    profileId: profile.id,
    warnings: validation.warnings,
    resources,
    summary
  };
}
