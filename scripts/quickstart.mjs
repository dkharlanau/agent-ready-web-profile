import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'arwp.mjs');

function run(args, label) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${label} failed with exit code ${result.status}`);
  return result.stdout;
}

console.log('1/2 Validate the bundled minimal publisher profile');
const validation = run(['validate', 'examples/minimal.site-profile.json'], 'profile validation');
assert.match(validation, /^PASS /m);

console.log('\n2/2 Query the bundled directory for retrieval-capable sites');
const directoryOutput = run(['directory', '--capability=retrieval', '--json'], 'directory query');
const directory = JSON.parse(directoryOutput);
assert.ok(directory.sites.length > 0, 'the bundled directory should contain retrieval-capable reference sites');
assert.ok(directory.sites.every((site) => Boolean(site.capabilities?.retrieval)));

console.log(`\nQuickstart complete: validated one profile and found ${directory.sites.length} retrieval-capable reference sites.`);
