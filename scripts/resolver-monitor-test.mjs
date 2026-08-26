import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runResolverMonitor } from '../lib/resolver-monitor.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-monitor-'));
const snapshotDir = path.join(temp, 'snapshots');
const evidenceDir = path.join(temp, 'evidence');
let generation = 1;

function resolution(url) {
  const interfaces = { content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: [] };
  if (generation === 1) interfaces.tools.push({ sourceId: 'agents-json:0', sourceAuthority: 'community-convention', kind: 'mcp', protocol: 'MCP', transport: 'streamable-http', url: `${new URL(url).origin}/mcp` });
  return {
    canonicalUrl: url,
    identity: { name: 'Monitored Site' },
    sources: [{ id: 'agents-json:0', type: 'agents-json', url: `${new URL(url).origin}/agents.json`, status: 'resolved', authority: 'community-convention' }],
    interfaces,
    conflicts: generation === 3 ? [{ kind: 'fixture-conflict', severity: 'warning', capability: 'MCP', message: 'Fixture conflict.' }] : [],
    summary: { sourcesAttempted: 1, sourcesResolved: 1, interfacesResolved: interfaces.tools.length, conflicts: generation === 3 ? 1 : 0 }
  };
}

const resolveImpl = async url => resolution(url);
const config = {
  version: '0.1',
  sites: [{ id: 'site', name: 'Site', url: 'https://monitor.example/' }],
  failOn: ['interface-removed', 'conflict-added']
};

try {
  let report = await runResolverMonitor(config, { snapshotDir, evidenceDir, resolverVersion: '0.2.0', resolveImpl, observedAt: '2026-08-25T20:00:00Z' });
  assert.equal(report.summary.baselineCreated, 1);
  assert.equal(report.summary.evidenceWritten, 0);
  assert.equal(report.shouldFail, false);
  assert.equal(report.notification.level, 'ok');
  assert.equal(report.notification.sites.length, 0);
  assert.ok(fs.existsSync(path.join(snapshotDir, 'site.json')));

  report = await runResolverMonitor(config, { snapshotDir, evidenceDir, resolverVersion: '0.2.0', resolveImpl, observedAt: '2026-08-25T21:00:00Z' });
  assert.equal(report.summary.stable, 1);
  assert.equal(report.summary.evidenceWritten, 0);
  assert.equal(report.shouldFail, false);

  generation = 2;
  report = await runResolverMonitor(config, { snapshotDir, evidenceDir, resolverVersion: '0.2.0', resolveImpl, observedAt: '2026-08-25T22:00:00Z' });
  assert.equal(report.summary.drifted, 1);
  assert.equal(report.summary.evidenceWritten, 1);
  assert.equal(report.shouldFail, true);
  assert.ok(report.triggered.includes('interface-removed'));
  assert.equal(report.notification.level, 'alert');
  assert.equal(report.notification.sites[0].id, 'site');
  assert.equal(report.notification.sites[0].drift, undefined, 'notification summary must not embed full drift snapshots');
  assert.ok(report.sites[0].evidenceFile);
  assert.ok(fs.existsSync(report.sites[0].evidenceFile));
  const evidence = JSON.parse(fs.readFileSync(report.sites[0].evidenceFile, 'utf8'));
  assert.equal(evidence.evidenceVersion, '0.1');
  assert.equal(evidence.site.id, 'site');
  assert.equal(evidence.beforeSnapshot.interfaces.length, 1);
  assert.equal(evidence.afterSnapshot.interfaces.length, 0);
  assert.equal(evidence.drift.summary.interfacesRemoved, 1);
  assert.deepEqual(evidence.classes, ['interface-removed', 'plan-changed']);

  generation = 3;
  report = await runResolverMonitor(config, { snapshotDir, evidenceDir, resolverVersion: '0.2.0', resolveImpl, observedAt: '2026-08-25T23:00:00Z' });
  assert.equal(report.shouldFail, true);
  assert.equal(report.summary.evidenceWritten, 1);
  assert.ok(report.triggered.includes('conflict-added'));

  let migrationTarget = 'https://migration.example/.well-known/api-catalog';
  const migrationResolve = async url => ({
    canonicalUrl: url,
    identity: { name: 'Migration Site' },
    sources: [{ id: 'api-catalog:0', type: 'api-catalog', url: migrationTarget, status: 'resolved', authority: 'ietf-standard' }],
    interfaces: { content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: [] },
    conflicts: [],
    summary: { sourcesAttempted: 1, sourcesResolved: 1, interfacesResolved: 0, conflicts: 0 }
  });
  const migrationDir = path.join(temp, 'migration-snapshots');
  const migrationConfig = {
    version: '0.1',
    sites: [{ id: 'migration', url: 'https://migration.example/' }],
    failOn: ['source-removed']
  };

  await runResolverMonitor(migrationConfig, { snapshotDir: migrationDir, resolverVersion: '0.2.0', resolveImpl: migrationResolve, observedAt: '2026-08-26T00:00:00Z' });
  migrationTarget = 'https://migration.example/catalog/v2';
  report = await runResolverMonitor(migrationConfig, { snapshotDir: migrationDir, resolverVersion: '0.2.0', resolveImpl: migrationResolve, observedAt: '2026-08-26T01:00:00Z' });
  assert.equal(report.shouldFail, false, 'evidenced redirect-target migration must not trigger source-removed');
  assert.ok(report.sites[0].classes.includes('source-migrated'));
  assert.ok(!report.sites[0].classes.includes('source-removed'));

  migrationTarget = 'https://migration.example/catalog/v3';
  report = await runResolverMonitor({ ...migrationConfig, failOn: ['source-migrated'] }, { snapshotDir: migrationDir, resolverVersion: '0.2.0', resolveImpl: migrationResolve, observedAt: '2026-08-26T02:00:00Z' });
  assert.equal(report.shouldFail, true);
  assert.ok(report.triggered.includes('source-migrated'));
  assert.ok(report.notification.text.includes('source-migrated'));

  let interfaceTarget = 'https://interface-migration.example/mcp';
  const interfaceMigrationResolve = async url => ({
    canonicalUrl: url,
    identity: { name: 'Interface Migration Site' },
    sources: [{ id: 'agents-json:0', type: 'agents-json', url: `${new URL(url).origin}/agents.json`, status: 'resolved', authority: 'community-convention' }],
    interfaces: {
      content: [], data: [], retrieval: [], apis: [],
      tools: [{ sourceId: 'agents-json:0', sourceAuthority: 'community-convention', kind: 'mcp', protocol: 'MCP', transport: 'streamable-http', url: interfaceTarget }],
      skills: [], agents: [], browserTools: [], auth: [], trust: []
    },
    conflicts: [],
    summary: { sourcesAttempted: 1, sourcesResolved: 1, interfacesResolved: 1, conflicts: 0 }
  });
  const interfaceMigrationDir = path.join(temp, 'interface-migration-snapshots');
  const interfaceMigrationConfig = {
    version: '0.1',
    sites: [{ id: 'interface-migration', url: 'https://interface-migration.example/' }],
    failOn: ['interface-removed']
  };

  await runResolverMonitor(interfaceMigrationConfig, { snapshotDir: interfaceMigrationDir, resolverVersion: '0.2.0', resolveImpl: interfaceMigrationResolve, observedAt: '2026-08-26T02:30:00Z' });
  interfaceTarget = 'https://interface-migration.example/mcp/v2';
  report = await runResolverMonitor(interfaceMigrationConfig, { snapshotDir: interfaceMigrationDir, resolverVersion: '0.2.0', resolveImpl: interfaceMigrationResolve, observedAt: '2026-08-26T03:00:00Z' });
  assert.equal(report.summary.drifted, 1);
  assert.equal(report.sites[0].drift.summary.interfaceMigrations, 1);
  assert.equal(report.sites[0].drift.summary.hardInterfacesRemoved, 0);
  assert.equal(report.shouldFail, false, 'URL-only interface migration must not trigger interface-removed');
  assert.ok(!report.sites[0].classes.includes('interface-removed'));
  assert.ok(report.sites[0].classes.includes('plan-changed'));

  console.log('PASS resolver monitor archives drift evidence and separates source/interface migrations from hard disappearance alerts');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
