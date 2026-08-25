import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkProtocolArtifacts } from '../lib/protocol-checks.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-protocol-'));
try {
  const profilePath = path.join(temp, 'profile.json');
  fs.writeFileSync(profilePath, JSON.stringify({
    profileVersion: '0.1', id: 'protocol-test', name: 'Protocol Test', canonicalUrl: 'https://example.com/', description: 'Protocol check fixture.',
    agentSkills: { skills: [{ name: 'example-skill', url: 'https://example.com/SKILL.md', description: 'Example skill for tests.' }] },
    mcp: { servers: [{ name: 'local-test', transport: 'stdio', source: 'https://github.com/example/repo', readOnly: true }] },
    a2a: { agentCard: 'https://example.com/.well-known/agent-card.json' }
  }, null, 2));

  const fetchImpl = async url => {
    if (String(url).endsWith('/SKILL.md')) return new Response('---\nname: example-skill\ndescription: Example skill\n---\n# Instructions\n', { status: 200, headers: { 'content-type': 'text/markdown' } });
    if (String(url).endsWith('/agent-card.json')) return new Response(JSON.stringify({ name: 'Example Agent', url: 'https://example.com/a2a', skills: [{ id: 'search', name: 'Search' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('not found', { status: 404 });
  };

  const report = await checkProtocolArtifacts(profilePath, { fetchImpl });
  assert.equal(report.valid, true);
  assert.equal(report.summary.pass, 2);
  assert.equal(report.summary['not-assessed'], 1);
  assert.equal(report.checks.find(check => check.kind === 'agent-skill').status, 'pass');
  assert.equal(report.checks.find(check => check.kind === 'mcp-runtime').status, 'not-assessed');
  assert.match(report.scope, /does not claim full upstream runtime conformance/i);

  console.log('PASS protocol checks validate inspectable artifacts without upgrading untested runtimes to conformance');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
