import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directoryPath = path.join(root, 'registry', 'sites.json');
const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));

const capabilities = ['web', 'data', 'retrieval', 'openapi', 'agentSkills', 'webmcp', 'mcp', 'a2a', 'trust'];
const counts = Object.fromEntries(capabilities.map(name => [name, 0]));
const transportCounts = { local: 0, remote: 0, 'local+remote': 0 };

for (const site of directory.sites || []) {
  for (const name of capabilities) {
    if (site.capabilities?.[name]) counts[name] += 1;
  }
  const transport = site.capabilities?.mcp;
  if (typeof transport === 'string' && transportCounts[transport] != null) transportCounts[transport] += 1;
}

const stats = {
  version: directory.version,
  updatedAt: directory.updatedAt,
  source: 'registry/sites.json',
  privacy: 'Aggregate counts derived from the public directory only. No visitor, scan or user tracking is collected.',
  sites: directory.sites?.length || 0,
  capabilities: counts,
  mcpTransports: transportCounts
};

for (const target of [path.join(root, 'registry', 'stats.json'), path.join(root, 'docs', 'stats.json')]) {
  fs.writeFileSync(target, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
}
console.log(`Generated aggregate ARWP directory statistics for ${stats.sites} sites.`);
