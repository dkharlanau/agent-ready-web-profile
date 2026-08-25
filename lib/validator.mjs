import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'site-profile.schema.json');

export function loadSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function loadProfile(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

export function createValidator() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    allowUnionTypes: false
  });
  addFormats(ajv);
  return ajv.compile(loadSchema());
}

export function semanticWarnings(profile) {
  const warnings = [];

  if (profile.web?.llms && !profile.web.llms.includes('llms.txt')) {
    warnings.push('web.llms does not look like an llms.txt URL.');
  }

  if (profile.agentWeb?.webmcp?.enabled === false && profile.agentWeb.webmcp.pages?.length) {
    warnings.push('WebMCP pages are declared while webmcp.enabled is false.');
  }

  if (profile.a2a?.agentCard && !profile.a2a.agentCard.includes('agent-card.json')) {
    warnings.push('a2a.agentCard does not look like an A2A Agent Card URL.');
  }

  for (const server of profile.mcp?.servers ?? []) {
    if (server.transport === 'stdio' && !server.package) {
      warnings.push(`MCP server ${server.name} uses stdio but does not declare package/install metadata.`);
    }
    if (server.transport === 'streamable-http' && !server.url) {
      warnings.push(`MCP server ${server.name} uses streamable-http but has no URL.`);
    }
  }

  const capabilityKeys = ['web', 'data', 'retrieval', 'agentWeb', 'mcp', 'a2a'];
  if (!capabilityKeys.some((key) => profile[key])) {
    warnings.push('The profile declares identity only and no discoverable capability group.');
  }

  return warnings;
}

export function validateProfile(profile) {
  const validate = createValidator();
  const valid = validate(profile);
  return {
    valid: Boolean(valid),
    errors: validate.errors ?? [],
    warnings: semanticWarnings(profile)
  };
}

export function formatAjvError(error) {
  const location = error.instancePath || '/';
  return `${location} ${error.message}`;
}
