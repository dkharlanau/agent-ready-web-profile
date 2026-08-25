import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';
import { DEFAULT_DIRECTORY_SOURCE, loadDirectory, searchFederated, selectSites } from './federated.mjs';

const asText = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const { directory, sourceUrl } = await loadDirectory(DEFAULT_DIRECTORY_SOURCE);

const server = new McpServer({ name: 'arwp-federated-router', version: '0.2.0' });

server.registerTool('list_arwp_sites', {
  description: 'List sites in the configured ARWP directory, optionally filtered by a declared capability.',
  inputSchema: z.object({
    capability: z.enum(['web', 'data', 'retrieval', 'openapi', 'agentSkills', 'webmcp', 'mcp', 'a2a', 'trust']).optional()
  })
}, async ({ capability }) => asText({
  directory: sourceUrl,
  sites: selectSites(directory, { capability }).map(site => ({
    id: site.id,
    name: site.name,
    category: site.category,
    canonicalUrl: site.canonicalUrl,
    profileUrl: site.profileUrl,
    capabilities: site.capabilities
  }))
}));

server.registerTool('search_arwp_sites', {
  description: 'Search declared retrieval indexes across multiple ARWP sites. Results keep their source site and index instead of merging canonical knowledge.',
  inputSchema: z.object({
    query: z.string().min(2),
    site_ids: z.array(z.string()).max(20).optional(),
    limit: z.number().int().min(1).max(50).default(10),
    limit_per_site: z.number().int().min(1).max(10).default(3)
  })
}, async ({ query, site_ids, limit, limit_per_site }) => asText(await searchFederated(query, {
  directorySource: DEFAULT_DIRECTORY_SOURCE,
  siteIds: site_ids || [],
  limit,
  limitPerSite: limit_per_site
})));

const transport = new StdioServerTransport();
await server.connect(transport);
