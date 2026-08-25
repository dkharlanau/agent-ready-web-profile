import assert from 'node:assert/strict';
import { createResolverSnapshot, diffResolverSnapshots } from '../lib/resolver-snapshot.mjs';

function resolution({ endpoint = 'https://example.com/mcp', conflict = false } = {}) {
  return {
    canonicalUrl: 'https://example.com/',
    identity: { name: 'Example', description: 'Example knowledge site', languages: ['en'] },
    sources: [
      { id: 'agents-json:0', type: 'agents-json', url: 'https://example.com/agents.json', status: 'resolved', authority: 'community-convention' },
      { id: 'api-catalog:0', type: 'api-catalog', url: 'https://example.com/.well-known/api-catalog', status: 'resolved', authority: 'ietf-standard' }
    ],
    interfaces: {
      content: [{ sourceId: 'homepage-scan', sourceAuthority: 'observed-web', kind: 'llms', protocol: 'llms.txt', url: 'https://example.com/llms.txt' }],
      data: [],
      retrieval: [{ sourceId: 'agents-json:0', sourceAuthority: 'community-convention', kind: 'search', url: 'https://example.com/search.json' }],
      apis: [{ sourceId: 'api-catalog:0', sourceAuthority: 'ietf-standard', kind: 'api-description', protocol: 'OpenAPI', url: 'https://example.com/openapi.json' }],
      tools: [{ sourceId: 'agents-json:0', sourceAuthority: 'community-convention', kind: 'mcp', protocol: 'MCP', transport: 'streamable-http', url: endpoint }],
      skills: [], agents: [], browserTools: [], auth: [], trust: []
    },
    conflicts: conflict ? [{ kind: 'mcp-endpoint-mismatch', severity: 'warning', capability: 'MCP', message: 'MCP endpoints disagree.' }] : [],
    summary: { sourcesAttempted: 2, sourcesResolved: 2, interfacesResolved: 4, conflicts: conflict ? 1 : 0, requests: 5, bytes: 2048 }
  };
}

const before = createResolverSnapshot(resolution(), { resolverVersion: '0.2.0', observedAt: '2026-08-25T20:00:00Z' });
const same = createResolverSnapshot(resolution(), { resolverVersion: '0.2.0', observedAt: '2026-08-25T21:00:00Z' });
assert.equal(before.snapshotVersion, '0.1');
assert.equal(before.interfaces.length, 4);
assert.equal(before.plans.tools.selected.url, 'https://example.com/mcp');
assert.equal(diffResolverSnapshots(before, same).hasDrift, false, 'observation time alone must not count as drift');

const after = createResolverSnapshot(resolution({ endpoint: 'https://example.com/mcp-v2', conflict: true }), { resolverVersion: '0.2.0', observedAt: '2026-08-25T22:00:00Z' });
const drift = diffResolverSnapshots(before, after);
assert.equal(drift.hasDrift, true);
assert.equal(drift.summary.interfacesAdded, 1);
assert.equal(drift.summary.interfacesRemoved, 1);
assert.equal(drift.summary.conflictsAdded, 1);
assert.equal(drift.summary.planChanges, 1);
assert.equal(drift.plans[0].intent, 'tools');

console.log('PASS resolver snapshots are bounded, reproducible and produce machine-readable drift reports');
