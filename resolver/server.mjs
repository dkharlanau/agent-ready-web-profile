import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';
import { resolveSite, explainResolvedSite, planResolvedSite } from '../lib/resolver.mjs';
import { resolveMany } from '../lib/resolver-batch.mjs';
import { reconcileMcpRuntime } from '../lib/mcp-runtime.mjs';
import { searchResolvedFederated } from '../router/resolved-federated.mjs';

const asText = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });

const server = new McpServer({ name: 'arwp-site-resolver', version: '0.2.0' });

server.registerTool('resolve_site', {
  description: 'Resolve a public HTTPS website into one evidence-backed service map across ARWP, ordinary web discovery, agents.txt/json, RFC 8288/9727/9728, A2A, Agent Skills and experimental MCP discovery. Source authority and conflicts are preserved.',
  inputSchema: z.object({ url: z.string().url() })
}, async ({ url }) => asText(await resolveSite(url)));

server.registerTool('resolve_sites', {
  description: 'Resolve a bounded batch of public HTTPS websites. Per-site failures are isolated, global concurrency is bounded, and the same origin is never resolved concurrently within the batch.',
  inputSchema: z.object({
    urls: z.array(z.string().url()).min(1).max(25),
    concurrency: z.number().int().min(1).max(8).default(4)
  })
}, async ({ urls, concurrency }) => asText(await resolveMany(urls, { concurrency })));

server.registerTool('search_resolved_sites', {
  description: 'Resolve multiple public sites and search only their supported static JSON/JSONL/NDJSON retrieval indexes. The tool never invents generic OpenAPI, MCP or A2A operations and preserves source/discovery provenance.',
  inputSchema: z.object({
    query: z.string().min(2),
    sites: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      url: z.string().url()
    })).min(1).max(20),
    limit: z.number().int().min(1).max(50).default(10),
    limit_per_site: z.number().int().min(1).max(10).default(3),
    concurrency: z.number().int().min(1).max(8).default(4)
  })
}, async ({ query, sites, limit, limit_per_site, concurrency }) => asText(await searchResolvedFederated(query, {
  sites,
  limit,
  limitPerSite: limit_per_site,
  concurrency
})));

server.registerTool('verify_mcp_runtime', {
  description: 'Opt-in runtime reconciliation for remote MCP interfaces discovered on a site. Modern endpoints are probed with server/discover; legacy endpoints use initialize plus notifications/initialized. No MCP tools are invoked and no credentials discovered from metadata are sent automatically.',
  inputSchema: z.object({
    url: z.string().url(),
    max_endpoints: z.number().int().min(1).max(4).default(4)
  })
}, async ({ url, max_endpoints }) => {
  const resolution = await resolveSite(url);
  return asText({
    canonicalUrl: resolution.canonicalUrl,
    staticConflicts: resolution.conflicts,
    runtime: await reconcileMcpRuntime(resolution, { maxEndpoints: max_endpoints })
  });
});

server.registerTool('explain_site', {
  description: 'Explain the resolved machine/agent-facing interfaces of a public website in human-readable terms, including source conflicts and recommended interfaces.',
  inputSchema: z.object({ url: z.string().url() })
}, async ({ url }) => asText(explainResolvedSite(await resolveSite(url))));

server.registerTool('plan_site_interface', {
  description: 'Choose the best resolved interface for a concrete intent while returning fallbacks and preserving the evidence source. This is deterministic routing, not a quality score.',
  inputSchema: z.object({
    url: z.string().url(),
    intent: z.enum(['read', 'search', 'structured', 'tools', 'agent'])
  })
}, async ({ url, intent }) => {
  const resolution = await resolveSite(url);
  return asText({ canonicalUrl: resolution.canonicalUrl, plan: planResolvedSite(resolution, intent), conflicts: resolution.conflicts });
});

const transport = new StdioServerTransport();
await server.connect(transport);
