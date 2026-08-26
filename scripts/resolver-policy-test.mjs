import assert from 'node:assert/strict';
import { isEphemeralSignedUrl, planResolvedSite } from '../lib/resolver.mjs';

function resolution(canonicalUrl, interfaces = {}) {
  return {
    target: canonicalUrl,
    canonicalUrl,
    identity: { name: 'Policy fixture' },
    sources: [],
    conflicts: [],
    summary: { sourcesResolved: 0, sourcesAttempted: 0 },
    interfaces: {
      content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: [],
      ...interfaces
    }
  };
}

const genericOpenApi = {
  sourceId: 'api-catalog:0',
  sourceAuthority: 'ietf-standard',
  discoveryScope: 'root-conventional',
  kind: 'api-description',
  protocol: 'OpenAPI',
  url: 'https://example.com/openapi.json'
};

const root = resolution('https://example.com/', { apis: [genericOpenApi] });
const rootSearch = planResolvedSite(root, 'search');
assert.equal(rootSearch.selected, null);
assert.equal(rootSearch.outcome, 'insufficient-evidence');
assert.equal(rootSearch.rejected[0].reason, 'search-semantics-not-declared');
assert.equal(planResolvedSite(root, 'structured').selected.url, 'https://example.com/openapi.json');

const docs = resolution('https://example.com/docs/', { apis: [genericOpenApi] });
const scopedStructured = planResolvedSite(docs, 'structured');
assert.equal(scopedStructured.selected, null);
assert.equal(scopedStructured.outcome, 'insufficient-evidence');
assert.equal(scopedStructured.rejected[0].reason, 'root-scope-not-target-scope');

const linkedOpenApi = { ...genericOpenApi, sourceId: 'api-catalog-link:0', discoveryScope: 'target-linked' };
const linkedStructured = planResolvedSite(resolution('https://example.com/docs/', { apis: [linkedOpenApi] }), 'structured');
assert.equal(linkedStructured.outcome, 'selected');
assert.equal(linkedStructured.selected.url, 'https://example.com/openapi.json');

const signedOpenApi = {
  ...linkedOpenApi,
  url: 'https://bucket.s3.amazonaws.com/openapi.json?X-Amz-Credential=abc&X-Amz-Expires=300&X-Amz-Signature=deadbeef'
};
const signedPlan = planResolvedSite(resolution('https://example.com/docs/', { apis: [signedOpenApi] }), 'structured');
assert.equal(signedPlan.selected, null);
assert.equal(signedPlan.outcome, 'insufficient-evidence');
assert.equal(signedPlan.rejected[0].reason, 'unstable-signed-url');
assert.equal(isEphemeralSignedUrl(signedOpenApi.url), true);
assert.equal(isEphemeralSignedUrl('https://example.com/api?q=test&sig=stable-identifier'), false);

const searchIndex = {
  sourceId: 'arwp-profile:0',
  sourceAuthority: 'project-profile',
  kind: 'index',
  protocol: 'JSON',
  url: 'https://example.com/search.json'
};
assert.equal(planResolvedSite(resolution('https://example.com/docs/', { retrieval: [searchIndex] }), 'search').selected.url, 'https://example.com/search.json');

const a2a = {
  sourceId: 'a2a-agent-card:0',
  sourceAuthority: 'upstream-standard',
  kind: 'agent-endpoint',
  protocol: 'A2A',
  url: 'https://example.com/a2a',
  agentCardUrl: 'https://example.com/.well-known/agent-card.json'
};
assert.equal(planResolvedSite(resolution('https://example.com/', { agents: [a2a] }), 'agent').selected.url, 'https://example.com/a2a');

console.log('PASS Resolver policy applies eligibility before ranking, rejects generic OpenAPI search semantics, path-scope leakage and expiring signed URLs');
