import assert from 'node:assert/strict';
import { loadProfile, validateProfile } from '../lib/validator.mjs';

const examples = [
  'examples/minimal.site-profile.json',
  'examples/knowledge-site.site-profile.json'
];

for (const file of examples) {
  const result = validateProfile(loadProfile(file));
  assert.equal(result.valid, true, `${file} should validate: ${JSON.stringify(result.errors)}`);
}

const missingRequired = loadProfile('examples/minimal.site-profile.json');
delete missingRequired.canonicalUrl;
assert.equal(validateProfile(missingRequired).valid, false, 'Missing canonicalUrl must fail validation.');

const falseRemoteMcp = loadProfile('examples/minimal.site-profile.json');
falseRemoteMcp.mcp = {
  servers: [
    {
      name: 'example/server',
      transport: 'streamable-http'
    }
  ]
};
assert.equal(validateProfile(falseRemoteMcp).valid, false, 'streamable-http MCP must declare a URL.');

const falseWebMcp = loadProfile('examples/minimal.site-profile.json');
falseWebMcp.agentWeb = {
  webmcp: {
    enabled: true
  }
};
assert.equal(validateProfile(falseWebMcp).valid, false, 'Enabled WebMCP must declare at least one page.');

console.log(`PASS ${examples.length} valid examples and 3 negative contract tests`);
