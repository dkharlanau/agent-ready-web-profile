import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-change-receipt-package-'));
const packDir = path.join(tempRoot, 'pack');
const consumerDir = path.join(tempRoot, 'consumer');
fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(consumerDir, { recursive: true });

try {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }));
  const paths = new Set(pack.files.map(file => file.path));
  for (const required of [
    'bin/arwp-change-receipt.mjs',
    'lib/change-receipt.mjs',
    'lib/change-receipt-braid.mjs',
    'lib/change-receipt-adapters.mjs',
    'lib/change-receipt-transition.mjs',
    'schema/change-receipt.schema.json',
    'docs/CHANGE-RECEIPTS.md'
  ]) assert.ok(paths.has(required), `Change Receipt npm surface is missing ${required}`);

  const tarball = path.join(packDir, pack.filename);
  fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({ name: 'change-receipt-package-consumer', private: true }, null, 2));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const installedRoot = path.join(consumerDir, 'node_modules', 'agent-ready-web-profile');
  const installedPackage = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(installedPackage.bin['arwp-change-receipt'], 'bin/arwp-change-receipt.mjs');
  assert.equal(installedPackage.scripts['change-receipt'], 'node bin/arwp-change-receipt.mjs');
  assert.equal(installedPackage.scripts['test:change-receipt'].includes('scripts/change-receipt-test.mjs'), true);
  assert.ok(fs.existsSync(path.join(consumerDir, 'node_modules', '.bin', 'arwp-change-receipt')), 'npm bin shim arwp-change-receipt is missing');
  assert.ok(fs.existsSync(path.join(installedRoot, 'lib', 'change-receipt-transition.mjs')), 'transition hardening helper must ship in npm package');

  const cli = path.join(installedRoot, 'bin', 'arwp-change-receipt.mjs');
  const help = execFileSync(process.execPath, [cli, '--help'], { cwd: consumerDir, encoding: 'utf8' });
  assert.match(help, /immutable evidence snapshots/i);
  assert.match(help, /verify-revision/);
  assert.match(help, /inspect-transition/);
  assert.match(help, /mergeCommitSha/);
  assert.match(help, /braid-report/);

  console.log(`PASS Change Receipt npm package surface (${pack.filename})`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
