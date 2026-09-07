import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-improvement-package-'));
const packDir = path.join(temp, 'pack');
const consumer = path.join(temp, 'consumer');
fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(consumer, { recursive: true });

try {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], { encoding: 'utf8' }));
  const paths = new Set(pack.files.map(file => file.path));
  for (const required of [
    'bin/arwp-entities.mjs', 'bin/arwp-entity-remediation.mjs', 'bin/arwp-improve.mjs',
    'lib/entity-gap.mjs', 'lib/entity-remediation.mjs', 'lib/site-improvement.mjs',
    'schema/entity-gap-report.schema.json', 'schema/entity-remediation-manifest.schema.json', 'schema/site-improvement-plan.schema.json',
    'docs/ENTITY-GRAPH-GAP-REPORT.md', 'docs/ENTITY-GRAPH-REMEDIATION.md', 'docs/SITE-IMPROVEMENT-PLAN.md'
  ]) assert.ok(paths.has(required), `packed artifact is missing ${required}`);

  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'arwp-improvement-consumer', private: true }, null, 2));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(packDir, pack.filename)], { cwd: consumer, stdio: 'pipe' });
  const installed = path.join(consumer, 'node_modules', 'agent-ready-web-profile');
  for (const bin of ['arwp-entities', 'arwp-entity-remediation', 'arwp-improve']) {
    assert.ok(fs.existsSync(path.join(consumer, 'node_modules', '.bin', bin)), `npm bin shim is missing ${bin}`);
  }
  for (const [file, expected] of [
    ['bin/arwp-entities.mjs', /Entity Graph Gap Report/i],
    ['bin/arwp-entity-remediation.mjs', /proposal-only/i],
    ['bin/arwp-improve.mjs', /Site Improvement Plan/i]
  ]) {
    const help = execFileSync(process.execPath, [path.join(installed, file), '--help'], { encoding: 'utf8' });
    assert.match(help, expected);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.entities, 'node bin/arwp-entities.mjs');
  assert.equal(pkg.scripts['entity-remediation'], 'node bin/arwp-entity-remediation.mjs');
  assert.equal(pkg.scripts.improve, 'node bin/arwp-improve.mjs');
  console.log(`PASS improvement npm package surface (${pack.filename})`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
