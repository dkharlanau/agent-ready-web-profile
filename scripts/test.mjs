import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadProfile, validateProfile } from '../lib/validator.mjs';

const referenceDir = path.resolve('examples/reference');
const referenceProfiles = fs.readdirSync(referenceDir)
  .filter(name => name.endsWith('.site-profile.json'))
  .sort()
  .map(name => path.join('examples/reference', name));

const examples = [
  'examples/minimal.site-profile.json',
  'examples/knowledge-site.site-profile.json',
  ...referenceProfiles
];

for (const file of examples) {
  const result = validateProfile(loadProfile(file));
  assert.equal(result.valid, true, `${file} should validate: ${JSON.stringify(result.errors)}`);
}

assert.equal(referenceProfiles.length, 5, 'The v0.1 reference suite should contain five real-site profiles.');

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

const falseStdioMcp = loadProfile('examples/minimal.site-profile.json');
falseStdioMcp.mcp = {
  servers: [
    {
      name: 'example/local-server',
      transport: 'stdio'
    }
  ]
};
assert.equal(validateProfile(falseStdioMcp).valid, false, 'stdio MCP must declare package or source metadata.');

const sourceBackedStdioMcp = loadProfile('examples/minimal.site-profile.json');
sourceBackedStdioMcp.mcp = {
  servers: [
    {
      name: 'example-source-server',
      transport: 'stdio',
      source: 'https://github.com/example/knowledge/tree/main/mcp/server',
      readOnly: true
    }
  ]
};
assert.equal(validateProfile(sourceBackedStdioMcp).valid, true, 'stdio MCP may be declared through a public source URL.');

const falseWebMcp = loadProfile('examples/minimal.site-profile.json');
falseWebMcp.agentWeb = {
  webmcp: {
    enabled: true
  }
};
assert.equal(validateProfile(falseWebMcp).valid, false, 'Enabled WebMCP must declare at least one page.');

const falseSkillName = loadProfile('examples/minimal.site-profile.json');
falseSkillName.agentSkills = {
  skills: [
    {
      name: 'Bad_Skill_Name',
      url: 'https://example.com/skills/bad/SKILL.md'
    }
  ]
};
assert.equal(validateProfile(falseSkillName).valid, false, 'Agent Skill names must follow the lowercase hyphenated naming contract.');

console.log(`PASS ${examples.length} profiles (${referenceProfiles.length} real references) and 6 negative/conditional contract tests`);
