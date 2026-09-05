import assert from 'node:assert/strict';
import {
  DISCOVERY_SCOPES,
  targetScopeOf,
  classifyDiscoveryScope,
  annotateDiscoveryScopes,
  buildScopeDiagnostics
} from '../lib/resolver-scope.mjs';

assert.equal(targetScopeOf({ target: 'https://example.com/' }), 'root');
assert.equal(targetScopeOf({ target: 'https://example.com/docs/' }), 'path');
assert.equal(targetScopeOf({ target: 'https://example.com/docs' }), 'path');

const cases = [
  [{ sourceId: 'homepage-scan' }, DISCOVERY_SCOPES.TARGET_OBSERVED],
  [{ sourceId: 'http-head:0' }, DISCOVERY_SCOPES.TARGET_OBSERVED],
  [{ sourceId: 'path-llms:0' }, DISCOVERY_SCOPES.TARGET_PATH_PROBE],
  [{ sourceId: 'api-catalog:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'agents-json:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'agents-txt:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'oauth-protected-resource:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'a2a-agent-card:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'agent-skills-index:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'ard-catalog:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'ard-catalog-legacy:0' }, DISCOVERY_SCOPES.ROOT_CONVENTIONAL],
  [{ sourceId: 'api-catalog-link:1' }, DISCOVERY_SCOPES.TARGET_LINKED],
  [{ sourceId: 'ard-catalog-link:0' }, DISCOVERY_SCOPES.TARGET_LINKED],
  [{ sourceId: 'arwp-profile-link:0' }, DISCOVERY_SCOPES.TARGET_LINKED],
  [{ sourceId: 'agents-json-pointer:0' }, DISCOVERY_SCOPES.PUBLISHER_POINTER],
  [{ sourceId: 'arwp-profile:0' }, DISCOVERY_SCOPES.PUBLISHER_PROFILE_AMBIGUOUS],
  [{ sourceId: 'mcp-server-card-fallback:0' }, DISCOVERY_SCOPES.DERIVED_UNSPECIFIED],
  [{ sourceId: 'unknown:0' }, DISCOVERY_SCOPES.UNSPECIFIED]
];
for (const [item, expected] of cases) assert.equal(classifyDiscoveryScope(item), expected, `${item.sourceId} scope mismatch`);
assert.equal(classifyDiscoveryScope({ sourceId: 'agents-json:0', discoveryScope: 'explicit-test-scope' }), 'explicit-test-scope', 'explicit adapter scope must win over inference');

const resolution = {
  target: 'https://example.com/docs/',
  canonicalUrl: 'https://example.com/docs/',
  interfaces: {
    content: [
      { url: 'https://example.com/docs/', kind: 'html', protocol: 'HTML', sourceId: 'http-head:0', sourceAuthority: 'observed-web' },
      { url: 'https://example.com/docs/llms.txt', kind: 'llms', protocol: 'llms.txt', sourceId: 'path-llms:0', sourceAuthority: 'observed-web' }
    ],
    data: [
      { url: 'https://example.com/ai/site-profile.json', kind: 'distribution', sourceId: 'arwp-profile:0', sourceAuthority: 'project-profile' }
    ],
    retrieval: [],
    apis: [
      { url: 'https://example.com/openapi.json', kind: 'api-description', protocol: 'OpenAPI', sourceId: 'api-catalog:0', sourceAuthority: 'ietf-standard' },
      { url: 'https://example.com/docs/openapi.json', kind: 'api-description', protocol: 'OpenAPI', sourceId: 'api-catalog-link:0', sourceAuthority: 'ietf-standard' }
    ],
    tools: [
      { url: 'https://example.com/mcp', kind: 'mcp', protocol: 'MCP', sourceId: 'agents-json:0', sourceAuthority: 'community-convention' },
      { url: 'https://example.com/mcp/server-card', kind: 'mcp-server-card', protocol: 'MCP', sourceId: 'mcp-server-card-fallback:0', sourceAuthority: 'experimental-upstream' }
    ],
    skills: [
      { url: 'https://example.com/skills/x/SKILL.md', kind: 'skill', protocol: 'Agent Skills', sourceId: 'agent-skills-index:0', sourceAuthority: 'upstream-convention' }
    ],
    agents: [
      { url: 'https://example.com/a2a', kind: 'agent-endpoint', protocol: 'A2A', sourceId: 'a2a-agent-card:0', sourceAuthority: 'upstream-standard' }
    ],
    browserTools: [],
    auth: [
      { url: 'https://example.com/.well-known/oauth-protected-resource', kind: 'oauth-protected-resource', protocol: 'RFC9728', sourceId: 'oauth-protected-resource:0', sourceAuthority: 'ietf-standard' }
    ],
    trust: []
  }
};

annotateDiscoveryScopes(resolution);
assert.equal(resolution.interfaces.content[0].discoveryScope, DISCOVERY_SCOPES.TARGET_OBSERVED);
assert.equal(resolution.interfaces.content[1].discoveryScope, DISCOVERY_SCOPES.TARGET_PATH_PROBE);
assert.equal(resolution.interfaces.apis[0].discoveryScope, DISCOVERY_SCOPES.ROOT_CONVENTIONAL);
assert.equal(resolution.interfaces.apis[1].discoveryScope, DISCOVERY_SCOPES.TARGET_LINKED);
assert.match(resolution.interfaces.apis[0].discoveryScopeReason, /origin-root conventional location/i);

const diagnostics = buildScopeDiagnostics(resolution);
assert.equal(diagnostics.version, '0.1');
assert.equal(diagnostics.targetScope, 'path');
assert.equal(diagnostics.policyEffect, 'diagnostic-only');
assert.equal(diagnostics.summary.rootConventional, 4);
assert.equal(diagnostics.summary.targetLocal, 3);
assert.equal(diagnostics.summary.pathRiskCandidates, 4);
assert.equal(diagnostics.summary.ambiguousOrDerived, 2);
assert.ok(diagnostics.pathScopedRootConventionalEvidence.some(item => item.group === 'tools' && item.protocol === 'MCP'));
assert.ok(diagnostics.pathScopedRootConventionalEvidence.some(item => item.group === 'agents' && item.protocol === 'A2A'));
assert.ok(diagnostics.pathScopedRootConventionalEvidence.some(item => item.group === 'auth' && item.protocol === 'RFC9728'));
assert.ok(diagnostics.pathScopedRootConventionalEvidence.some(item => item.group === 'skills' && item.protocol === 'Agent Skills'));
assert.equal(diagnostics.pathScopedRootConventionalEvidence.some(item => item.url === 'https://example.com/openapi.json'), true);
assert.equal(diagnostics.pathScopedRootConventionalEvidence.some(item => item.url === 'https://example.com/docs/openapi.json'), false, 'explicit target-linked API must not be flagged as root leakage');
assert.ok(diagnostics.ambiguousOrDerivedEvidence.some(item => item.sourceId === 'arwp-profile:0'));
assert.ok(diagnostics.ambiguousOrDerivedEvidence.some(item => item.sourceId === 'mcp-server-card-fallback:0'));
assert.match(diagnostics.note, /does not add new eligibility or ranking behavior/i);

const rootDiagnostics = buildScopeDiagnostics({ ...resolution, target: 'https://example.com/', canonicalUrl: 'https://example.com/' });
assert.equal(rootDiagnostics.targetScope, 'root');
assert.equal(rootDiagnostics.pathScopedRootConventionalEvidence.length, 0, 'root target has no root-to-path leakage risk');

console.log('PASS Resolver scope diagnostics classify root conventional, target-linked, path-probe, ambiguous and derived evidence explicitly while remaining diagnostic-only');
