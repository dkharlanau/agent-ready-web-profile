import { adaptArwpProfile, adaptAgentsJson, adaptApiCatalog, adaptA2aCard, adaptAgentSkillsIndex, adaptMcpServerCard, emptyInterfaces, mergeInterfaces, dedupeInterfaces } from '../lib/resolver-adapters.mjs';
import { planResolvedSite } from '../lib/resolver.mjs';

const jsonOutput = process.argv.includes('--json');

function withAuthority(interfaces, authority) {
  for (const values of Object.values(interfaces)) for (const item of values) item.sourceAuthority = authority;
  return interfaces;
}

function combine(...items) {
  const out = emptyInterfaces();
  for (const item of items) mergeInterfaces(out, item);
  return dedupeInterfaces(out);
}

function resolution(interfaces) {
  return { interfaces, canonicalUrl: 'https://fixture.example/', identity: { name: 'Fixture' }, conflicts: [], summary: {} };
}

const cases = [
  {
    name: 'publisher-maintained retrieval',
    intent: 'search',
    expected: 'https://fixture.example/search.json',
    surfaces: {
      html: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'html', url: 'https://fixture.example/', sourceAuthority: 'observed-web' }] }, 'observed-web'),
      llms: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'llms', protocol: 'llms.txt', url: 'https://fixture.example/llms.txt' }] }, 'observed-web'),
      arwp: withAuthority(adaptArwpProfile({ profileVersion: '0.1', id: 'fixture', name: 'Fixture', canonicalUrl: 'https://fixture.example/', description: 'x', retrieval: { indexes: [{ name: 'Search', url: 'https://fixture.example/search.json', mediaType: 'application/json', format: 'json' }] } }, 'arwp').interfaces, 'project-profile'),
      agents: emptyInterfaces(),
      upstream: emptyInterfaces()
    }
  },
  {
    name: 'cross-protocol MCP discovery',
    intent: 'tools',
    expected: 'https://fixture.example/mcp',
    surfaces: {
      html: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'html', url: 'https://fixture.example/' }] }, 'observed-web'),
      llms: emptyInterfaces(),
      arwp: emptyInterfaces(),
      agents: withAuthority(adaptAgentsJson({ version: '1.0', mcp: [{ url: 'https://fixture.example/mcp', type: 'streamable-http' }] }, 'agents').interfaces, 'community-convention'),
      upstream: withAuthority(adaptMcpServerCard({ name: 'com.example/fixture', version: '1.0.0', remotes: [{ url: 'https://fixture.example/mcp', type: 'streamable-http' }] }, 'card', 'https://fixture.example/mcp/server-card').interfaces, 'experimental-upstream')
    }
  },
  {
    name: 'IETF API catalog',
    intent: 'structured',
    expected: 'https://fixture.example/openapi.json',
    surfaces: {
      html: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'html', url: 'https://fixture.example/' }] }, 'observed-web'),
      llms: emptyInterfaces(),
      arwp: emptyInterfaces(),
      agents: emptyInterfaces(),
      upstream: withAuthority(adaptApiCatalog({ linkset: [{ anchor: 'https://fixture.example/api', 'service-desc': [{ href: 'https://fixture.example/openapi.json', type: 'application/json' }] }] }, 'rfc9727').interfaces, 'ietf-standard')
    }
  },
  {
    name: 'A2A native discovery',
    intent: 'agent',
    expected: 'https://fixture.example/.well-known/agent-card.json',
    surfaces: {
      html: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'html', url: 'https://fixture.example/' }] }, 'observed-web'),
      llms: emptyInterfaces(),
      arwp: emptyInterfaces(),
      agents: emptyInterfaces(),
      upstream: withAuthority(adaptA2aCard({ name: 'Fixture Agent', description: 'x', version: '1.0.0', supportedInterfaces: [{ url: 'https://fixture.example/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' }], skills: [] }, 'a2a', 'https://fixture.example/.well-known/agent-card.json').interfaces, 'upstream-standard')
    }
  },
  {
    name: 'service-consumption Agent Skill',
    intent: 'read',
    expected: 'https://fixture.example/llms.txt',
    surfaces: {
      html: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'html', url: 'https://fixture.example/' }] }, 'observed-web'),
      llms: withAuthority({ ...emptyInterfaces(), content: [{ kind: 'llms', protocol: 'llms.txt', url: 'https://fixture.example/llms.txt' }] }, 'observed-web'),
      arwp: emptyInterfaces(),
      agents: withAuthority(adaptAgentsJson({ version: '1.0', skills: [{ url: 'https://fixture.example/skills/use/SKILL.md' }] }, 'agents').interfaces, 'community-convention'),
      upstream: withAuthority(adaptAgentSkillsIndex({ skills: [{ name: 'use', type: 'skill-md', url: 'https://fixture.example/skills/use/SKILL.md', digest: `sha256:${'b'.repeat(64)}` }] }, 'skills-index', 'https://fixture.example/.well-known/agent-skills/index.json').interfaces, 'upstream-convention')
    }
  }
];

const strategyNames = ['html', 'llms', 'arwp', 'agents', 'upstream', 'resolver'];
const scores = Object.fromEntries(strategyNames.map(name => [name, { correct: 0, total: cases.length, details: [] }]));

for (const testCase of cases) {
  for (const strategy of strategyNames) {
    const interfaces = strategy === 'resolver'
      ? combine(testCase.surfaces.html, testCase.surfaces.llms, testCase.surfaces.arwp, testCase.surfaces.agents, testCase.surfaces.upstream)
      : testCase.surfaces[strategy];
    const plan = planResolvedSite(resolution(interfaces), testCase.intent);
    const selected = plan.selected?.url || null;
    const correct = selected === testCase.expected;
    if (correct) scores[strategy].correct += 1;
    scores[strategy].details.push({ case: testCase.name, intent: testCase.intent, expected: testCase.expected, selected, correct });
  }
}

const output = {
  kind: 'synthetic-regression-benchmark',
  warning: 'This benchmark is deterministic regression coverage over synthetic discovery fixtures. It is not evidence of real-world latency, token savings, ranking or adoption benefit.',
  cases: cases.length,
  strategies: Object.fromEntries(Object.entries(scores).map(([name, value]) => [name, { correct: value.correct, total: value.total, accuracy: value.correct / value.total }])),
  details: scores
};

if (jsonOutput) console.log(JSON.stringify(output, null, 2));
else {
  console.log('ARWP resolver synthetic regression benchmark');
  console.log(output.warning);
  for (const [name, value] of Object.entries(output.strategies)) console.log(`${name.padEnd(10)} ${value.correct}/${value.total} intent selections correct`);
}
