import { readProfileSource } from './verifier.mjs';

async function fetchText(url, { fetchImpl, timeoutMs, accept }) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`Protocol artifact must use HTTPS: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(parsed.href, { headers: { Accept: accept }, redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!String(response.url || parsed.href).startsWith('https://')) throw new Error('Final URL is not HTTPS.');
    return { text: await response.text(), url: response.url || parsed.href, contentType: response.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timer);
  }
}

function parseSimpleFrontmatter(markdown) {
  const match = String(markdown).match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return null;
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    values[pair[1]] = pair[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function result(kind, name, status, details = {}) {
  return { kind, name, status, ...details };
}

export async function checkProtocolArtifacts(profileSource, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const { profile, source } = await readProfileSource(profileSource, { fetchImpl, timeoutMs });
  const checks = [];

  for (const skill of profile.agentSkills?.skills || []) {
    try {
      const fetched = await fetchText(skill.url, { fetchImpl, timeoutMs, accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1' });
      const frontmatter = parseSimpleFrontmatter(fetched.text);
      if (!frontmatter) checks.push(result('agent-skill', skill.name, 'fail', { url: fetched.url, issue: 'SKILL.md frontmatter is missing.' }));
      else if (!frontmatter.name || !frontmatter.description) checks.push(result('agent-skill', skill.name, 'fail', { url: fetched.url, issue: 'SKILL.md frontmatter must include name and description.' }));
      else if (frontmatter.name !== skill.name) checks.push(result('agent-skill', skill.name, 'warning', { url: fetched.url, issue: `Profile name ${skill.name} differs from SKILL.md name ${frontmatter.name}.` }));
      else checks.push(result('agent-skill', skill.name, 'pass', { url: fetched.url, observed: { name: frontmatter.name, description: frontmatter.description } }));
    } catch (error) {
      checks.push(result('agent-skill', skill.name, 'fail', { url: skill.url, issue: String(error?.message || error) }));
    }
  }

  for (const server of profile.mcp?.servers || []) {
    if (server.registry) {
      try {
        const fetched = await fetchText(server.registry, { fetchImpl, timeoutMs, accept: 'application/json, */*;q=0.1' });
        const payload = JSON.parse(fetched.text);
        const registryName = payload?.server?.name || payload?.name || payload?.server?.server?.name || null;
        checks.push(result('mcp-registry', server.name, registryName && registryName !== server.name ? 'warning' : 'pass', {
          url: fetched.url,
          ...(registryName && registryName !== server.name ? { issue: `Registry name ${registryName} differs from profile server name ${server.name}.` } : {})
        }));
      } catch (error) {
        checks.push(result('mcp-registry', server.name, 'fail', { url: server.registry, issue: String(error?.message || error) }));
      }
    } else {
      checks.push(result('mcp-runtime', server.name, 'not-assessed', {
        url: server.url || server.source || server.documentation || null,
        issue: server.transport === 'stdio'
          ? 'Local stdio protocol behavior requires launching the package and is outside this artifact-only check.'
          : 'Remote MCP protocol behavior requires an MCP initialize/session check; URL reachability alone is not treated as conformance.'
      }));
    }
  }

  if (profile.a2a?.agentCard) {
    try {
      const fetched = await fetchText(profile.a2a.agentCard, { fetchImpl, timeoutMs, accept: 'application/json, */*;q=0.1' });
      const card = JSON.parse(fetched.text);
      const issues = [];
      if (!card.name) issues.push('Agent Card name is missing.');
      if (!card.url && !card.supportedInterfaces?.length) issues.push('Agent Card has no obvious callable interface URL.');
      if (!Array.isArray(card.skills) || !card.skills.length) issues.push('Agent Card skills are missing or empty.');
      checks.push(result('a2a-agent-card', card.name || 'agent-card', issues.length ? 'warning' : 'pass', { url: fetched.url, issues }));
    } catch (error) {
      checks.push(result('a2a-agent-card', 'agent-card', 'fail', { url: profile.a2a.agentCard, issue: String(error?.message || error) }));
    }
  }

  if (profile.agentWeb?.webmcp) {
    checks.push(result('webmcp-runtime', 'WebMCP', 'not-assessed', {
      issue: 'WebMCP requires browser/runtime inspection. Static HTML or documentation presence is not treated as runtime conformance.'
    }));
  }

  const summary = checks.reduce((out, check) => {
    out[check.status] = (out[check.status] || 0) + 1;
    return out;
  }, { pass: 0, warning: 0, fail: 0, 'not-assessed': 0 });

  return {
    source,
    scope: 'Artifact-level protocol checks. This report does not claim full upstream runtime conformance for MCP, WebMCP or A2A.',
    checks,
    summary,
    valid: summary.fail === 0
  };
}
