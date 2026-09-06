import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inspector = path.join(root, 'skills', 'arwp-prepare-site', 'scripts', 'inspect-repo.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-skill-inspect-'));

try {
  fs.mkdirSync(path.join(temp, 'public', 'ai'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'app'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({
    private: true,
    scripts: { build: 'next build', lint: 'next lint' },
    dependencies: { next: '^16.0.0' }
  }, null, 2));
  fs.writeFileSync(path.join(temp, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(temp, 'next.config.mjs'), 'export default {};\n');
  fs.writeFileSync(path.join(temp, 'public', 'robots.txt'), 'User-agent: *\nAllow: /\n');
  fs.writeFileSync(path.join(temp, 'public', 'llms.txt'), '# Example\n');
  fs.writeFileSync(path.join(temp, 'public', 'ai', 'site-profile.json'), '{}\n');

  const output = execFileSync(process.execPath, [inspector, temp], { encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(report.inspectorVersion, '0.1');
  assert.ok(report.frameworks.includes('next'));
  assert.ok(report.publicRoots.includes('public'));
  assert.ok(report.sourceHints.includes('app'));
  assert.ok(report.configs.includes('next.config.mjs'));
  assert.ok(report.observedSurfaces.includes('public/robots.txt'));
  assert.ok(report.observedSurfaces.includes('public/llms.txt'));
  assert.ok(report.observedSurfaces.includes('public/ai/site-profile.json'));
  assert.equal(report.packageManagerHints.npm, true);
  assert.equal(report.buildCommands.find(x => x.name === 'build')?.command, 'npm run build');
  assert.equal(report.boundaries.networkUsed, false);
  assert.equal(report.boundaries.secretsRead, false);
  assert.deepEqual(report.boundaries.fileContentsRead, ['package.json']);
  assert.match(report.nextStep, /source-of-truth/i);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('PASS arwp-prepare-site repository inspector detects stack/public surfaces without network or secret reads');
