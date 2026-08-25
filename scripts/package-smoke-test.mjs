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
    'lib/public-fetch.mjs', 'lib/http-discovery.mjs', 'lib/mcp-runtime.mjs', 'lib/a2a-signature.mjs',
    'lib/resolver-adapters.mjs', 'lib/resolver.mjs', 'lib/resolver-snapshot.mjs', 'lib/resolver-batch.mjs', 'lib/resolver-monitor.mjs', 'resolver/server.mjs',
    'schema/site-profile.schema.json', 'gateway/server.mjs', 'gateway/http-node.mjs',
    'scanner-service/handler.mjs', 'router/federated.mjs', 'router/resolved-federated.mjs', 'router/server.mjs',
    'monitor/runner.mjs', 'monitor/config.schema.json', 'monitor/example.config.json',
    'registry/sites.json', 'registry/directory.schema.json', 'server.json',
    'benchmarks/external-runner.mjs', 'benchmarks/corpus/fixture.schema.json',
    'docs/USE-CASES.md', 'docs/ADOPTION.md', 'docs/RESOLVER.md', 'docs/BENCHMARK.md',
    'README.md', 'SPEC.md', 'LICENSE'
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
  assert.equal(installedPackage.scripts['resolver:mcp'], 'node resolver/server.mjs');
  assert.equal(installedPackage.scripts['benchmark:external'], 'node benchmarks/external-runner.mjs');
  assert.equal(installedPackage.scripts['monitor:resolver'], 'node monitor/runner.mjs');

  const installedServer = JSON.parse(fs.readFileSync(path.join(installedRoot, 'server.json'), 'utf8'));
  assert.equal(installedServer.name, installedPackage.mcpName);
  assert.equal(installedServer.title, 'ARWP Site Resolver');
  assert.equal(installedServer.packages?.[0]?.identifier, 'agent-ready-web-profile');
  assert.equal(installedServer.packages?.[0]?.version, installedPackage.version);
  assert.equal(installedServer.packages?.[0]?.packageArguments?.[0]?.value, 'resolver-mcp');
  assert.equal(installedServer.packages?.[0]?.environmentVariables, undefined, 'primary Resolver package must not require ARWP_PROFILE');

  const version = execFileSync(process.execPath, [installedCli, '--version'], { cwd: consumerDir, encoding: 'utf8' }).trim();
  assert.equal(version, '0.2.0');
  const help = execFileSync(process.execPath, [installedCli, '--help'], { cwd: consumerDir, encoding: 'utf8' });
  for (const expected of ['arwp resolve', 'arwp resolve-many', 'arwp plan', 'arwp snapshot', 'arwp drift', 'arwp resolver-mcp']) assert.match(help, new RegExp(expected.replace('-', '\\-')));

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
