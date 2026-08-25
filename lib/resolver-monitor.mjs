import fs from 'node:fs';
import path from 'node:path';
import { resolveMany } from './resolver-batch.mjs';
import { createResolverSnapshot, diffResolverSnapshots } from './resolver-snapshot.mjs';

const FAIL_CLASSES = new Set([
  'any', 'identity', 'source-removed', 'interface-removed', 'conflict-added', 'plan-changed', 'resolution-failed'
]);

function safeId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) throw new Error(`Invalid monitor site id: ${value}`);
  return id;
}

function normalizeConfig(config) {
  if (!config || config.version !== '0.1' || !Array.isArray(config.sites) || !config.sites.length) {
    throw new Error('Resolver monitor config requires version "0.1" and a non-empty sites array.');
  }
  const seen = new Set();
  const sites = config.sites.map(site => {
    const id = safeId(site.id);
    if (seen.has(id)) throw new Error(`Duplicate monitor site id: ${id}`);
    seen.add(id);
    const parsed = new URL(site.url);
    if (parsed.protocol !== 'https:') throw new Error(`Monitor site ${id} must use HTTPS.`);
    return { id, name: site.name ? String(site.name) : id, url: parsed.href };
  });
  const failOn = [...new Set(config.failOn || [])].map(String);
  for (const item of failOn) if (!FAIL_CLASSES.has(item)) throw new Error(`Unsupported monitor failOn class: ${item}`);
  return { version: '0.1', sites, failOn };
}

function driftClasses(drift) {
  if (!drift?.hasDrift) return [];
  const classes = ['any'];
  if (drift.summary.identityChanged) classes.push('identity');
  if (drift.summary.sourcesRemoved) classes.push('source-removed');
  if (drift.summary.interfacesRemoved) classes.push('interface-removed');
  if (drift.summary.conflictsAdded) classes.push('conflict-added');
  if (drift.summary.planChanges) classes.push('plan-changed');
  return classes;
}

export async function runResolverMonitor(configInput, {
  snapshotDir,
  resolverVersion = 'unknown',
  concurrency = 4,
  resolveImpl,
  resolveOptions = {},
  writeSnapshots = true,
  observedAt = new Date().toISOString()
} = {}) {
  const config = normalizeConfig(configInput);
  if (!snapshotDir) throw new Error('Resolver monitor requires snapshotDir.');
  const dir = path.resolve(snapshotDir);
  if (writeSnapshots) fs.mkdirSync(dir, { recursive: true });

  const batch = await resolveMany(config.sites, { resolveImpl, concurrency, resolveOptions });
  const sites = [];
  const triggered = new Set();

  for (const result of batch.results) {
    const file = path.join(dir, `${safeId(result.id)}.json`);
    if (result.status === 'failed') {
      const classes = ['resolution-failed'];
      if (config.failOn.includes('resolution-failed') || config.failOn.includes('any')) for (const value of classes) triggered.add(value);
      sites.push({ id: result.id, name: result.name, url: result.inputUrl, status: 'resolution-failed', error: result.error, classes });
      continue;
    }

    const snapshot = createResolverSnapshot(result.resolution, { resolverVersion, observedAt });
    let previous = null;
    let drift = null;
    if (fs.existsSync(file)) {
      previous = JSON.parse(fs.readFileSync(file, 'utf8'));
      drift = diffResolverSnapshots(previous, snapshot);
    }
    if (writeSnapshots) fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    const classes = driftClasses(drift);
    for (const value of classes) if (config.failOn.includes(value) || config.failOn.includes('any')) triggered.add(value);
    sites.push({
      id: result.id,
      name: result.name,
      url: result.inputUrl,
      canonicalUrl: result.resolution.canonicalUrl,
      status: previous ? (drift.hasDrift ? 'drift' : 'stable') : 'baseline-created',
      snapshotFile: file,
      classes,
      drift
    });
  }

  return {
    monitorVersion: '0.1',
    observedAt,
    resolverVersion,
    snapshotDir: dir,
    writeSnapshots,
    failOn: config.failOn,
    shouldFail: triggered.size > 0,
    triggered: [...triggered].sort(),
    summary: {
      sites: sites.length,
      baselineCreated: sites.filter(site => site.status === 'baseline-created').length,
      stable: sites.filter(site => site.status === 'stable').length,
      drifted: sites.filter(site => site.status === 'drift').length,
      resolutionFailed: sites.filter(site => site.status === 'resolution-failed').length
    },
    sites
  };
}

export { FAIL_CLASSES };
