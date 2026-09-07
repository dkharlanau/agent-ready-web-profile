import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-watch-package-'));
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
    'bin/arwp-watch.mjs',
    'lib/braid-watch.mjs',
    'schema/watch-targets.schema.json',
    'schema/watch-impact-bundle.schema.json',
    'docs/SIGNALBRAID-WATCH.md'
  ]) assert.ok(paths.has(required), `SignalBraid Watch npm surface is missing ${required}`);

  const tarball = path.join(packDir, pack.filename);
  fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({ name: 'watch-package-consumer', private: true }, null, 2));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const installedRoot = path.join(consumerDir, 'node_modules', 'agent-ready-web-profile');
  const installedPackage = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(installedPackage.bin['arwp-watch'], 'bin/arwp-watch.mjs');
  assert.equal(installedPackage.scripts.watch, 'node bin/arwp-watch.mjs');
  assert.match(installedPackage.scripts['test:watch'] || '', /braid-watch-test\.mjs/);
  assert.ok(fs.existsSync(path.join(consumerDir, 'node_modules', '.bin', 'arwp-watch')), 'npm bin shim arwp-watch is missing');

  const cli = path.join(installedRoot, 'bin', 'arwp-watch.mjs');
  const help = execFileSync(process.execPath, [cli, '--help'], { cwd: consumerDir, encoding: 'utf8' });
  assert.match(help, /review queues only/i);
  assert.match(help, /changed-since/);
  assert.match(help, /validate-bundle/);

  console.log(`PASS SignalBraid Watch npm package surface (${pack.filename})`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
