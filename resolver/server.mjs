import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';
import { resolveSite, explainResolvedSite, planResolvedSite } from '../lib/resolver.mjs';

const asText = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });

const server = new McpServer({ name: 'arwp-site-resolver', version: '0.2.0' });

server.registerTool('resolve_site', {
  description: 'Resolve a public HTTPS website into one evidence-backed service map across ARWP, ordinary web discovery, agents.txt/json, RFC 9727/9728, A2A, Agent Skills and experimental MCP discovery. Source authority and conflicts are preserved.',
  inputSchema: z.object({ url: z.string().url() })
}, async ({ url }) => asText(await resolveSite(url)));

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
