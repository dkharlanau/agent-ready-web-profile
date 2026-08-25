import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-package-test-'));
const packDir = path.join(tempRoot, 'pack');
const consumerDir = path.join(tempRoot, 'consumer');
fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(consumerDir, { recursive: true });

try {
  const rawPack = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  const [pack] = JSON.parse(rawPack);
  assert.equal(pack.name, 'agent-ready-web-profile');
  assert.equal(pack.version, '0.2.0');

  const paths = new Set(pack.files.map(file => file.path));
  for (const required of [
    'bin/arwp.mjs', 'lib/scanner.mjs', 'lib/health.mjs', 'lib/validator.mjs', 'lib/verifier.mjs',
    'schema/site-profile.schema.json', 'gateway/server.mjs', 'gateway/http-node.mjs',
    'scanner-service/handler.mjs', 'router/federated.mjs', 'router/server.mjs',
    'registry/sites.json', 'registry/directory.schema.json', 'server.json',
    'docs/USE-CASES.md', 'docs/ADOPTION.md', 'README.md', 'SPEC.md', 'LICENSE'
  ]) assert.ok(paths.has(required), `packed artifact is missing ${required}`);

  assert.equal(paths.has('scripts/scanner-test.mjs'), false, 'test scripts must not ship in the npm artifact');
  assert.equal(paths.has('examples/minimal.site-profile.json'), false, 'example fixtures must not inflate the npm artifact');

  const tarball = path.join(packDir, pack.filename);
  fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({ name: 'arwp-package-smoke-consumer', private: true }, null, 2));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });

  const installedRoot = path.join(consumerDir, 'node_modules', 'agent-ready-web-profile');
  const installedCli = path.join(installedRoot, 'bin', 'arwp.mjs');
  assert.ok(fs.existsSync(installedCli), 'installed CLI entrypoint is missing');
  assert.ok(fs.existsSync(path.join(consumerDir, 'node_modules', '.bin', 'arwp')), 'npm bin shim is missing');
  const installedPackage = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(installedPackage.mcpName, 'io.github.dkharlanau/agent-ready-web-profile');

  const version = execFileSync(process.execPath, [installedCli, '--version'], { cwd: consumerDir, encoding: 'utf8' }).trim();
  assert.equal(version, '0.2.0');

  const directoryOutput = execFileSync(process.execPath, [installedCli, 'directory', '--json'], { cwd: installedRoot, encoding: 'utf8' });
  const directory = JSON.parse(directoryOutput);
  assert.equal(directory.sites.length, 5, 'installed CLI must ship with the initial ARWP directory');

  const profilePath = path.join(consumerDir, 'site-profile.json');
  fs.writeFileSync(profilePath, JSON.stringify({
    profileVersion: '0.1', id: 'package-smoke-site', name: 'Package Smoke Site', canonicalUrl: 'https://example.com/',
    description: 'Minimal profile used to prove the installed npm package can find and execute its bundled schema.'
  }, null, 2));
  const validation = execFileSync(process.execPath, [installedCli, 'validate', profilePath], { cwd: consumerDir, encoding: 'utf8' });
  assert.match(validation, /PASS/);

  console.log(`PASS npm pack/install smoke test (${pack.filename}, ${pack.size} bytes packed)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
