import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  inspectPortfolioWorkspace,
  loadPortfolioWorkspace,
  validatePortfolioWorkspace,
  verifyPortfolioLive,
  verifyPortfolioWorkspace,
  workspaceFromInventory
} from '../lib/portfolio-workspace.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-fleet-'));
const clean = path.join(temp, 'clean');
const dirty = path.join(temp, 'dirty');

function profile(canonicalUrl) {
  return {
    profileVersion: '0.1', id: canonicalUrl.includes('clean') ? 'clean-site' : 'dirty-site',
    name: 'Fleet test site', canonicalUrl,
    description: 'A deterministic local fixture for portfolio workspace verification.',
    web: { sitemap: new URL('sitemap.xml', canonicalUrl).href }
  };
}

function createRepo(directory, canonicalUrl) {
  fs.mkdirSync(path.join(directory, 'ai'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'ai', 'site-profile.json'), `${JSON.stringify(profile(canonicalUrl), null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'index.html'), '<link rel="alternate" type="application/json" href="./ai/site-profile.json">\n');
  execFileSync('git', ['init', '-q'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', 'fleet@example.invalid'], { cwd: directory });
  execFileSync('git', ['config', 'user.name', 'Fleet Test'], { cwd: directory });
  execFileSync('git', ['add', '.'], { cwd: directory });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: directory });
}

try {
  createRepo(clean, 'https://clean.example/');
  createRepo(dirty, 'https://dirty.example/');
  fs.writeFileSync(path.join(dirty, 'foreign.txt'), 'preserve me\n');
  const workspacePath = path.join(temp, 'portfolio.json');
  const workspace = {
    version: '0.1', name: 'Fleet fixture', sites: [
      {
        id: 'clean', checkout: clean, canonicalUrl: 'https://clean.example/', profilePath: 'ai/site-profile.json',
        publicProfilePath: 'ai/site-profile.json', discoveryFiles: ['index.html'],
        checks: [
          { id: 'write-order', argv: [process.execPath, '-e', "require('fs').writeFileSync('order.txt','one')"], timeoutMs: 5000 },
          { id: 'read-order', argv: [process.execPath, '-e', "if(require('fs').readFileSync('order.txt','utf8')!=='one')process.exit(9)"], timeoutMs: 5000 }
        ]
      },
      {
        id: 'dirty', checkout: dirty, canonicalUrl: 'https://dirty.example/', profilePath: 'ai/site-profile.json',
        publicProfilePath: 'ai/site-profile.json', discoveryFiles: ['index.html'],
        checks: [{ id: 'must-skip', argv: [process.execPath, '-e', 'process.exit(9)'], timeoutMs: 5000 }]
      }
    ]
  };
  fs.writeFileSync(workspacePath, `${JSON.stringify(workspace, null, 2)}\n`);
  assert.equal(validatePortfolioWorkspace(workspace).valid, true);
  const loaded = loadPortfolioWorkspace(workspacePath);
  const inspection = await inspectPortfolioWorkspace(loaded, { concurrency: 2 });
  assert.equal(inspection.summary.sites, 2);
  assert.equal(inspection.sites.find(site => site.id === 'clean').state, 'ready');
  assert.equal(inspection.sites.find(site => site.id === 'dirty').state, 'dirty-preserved');
  assert.equal(inspection.sites.find(site => site.id === 'clean').profile.valid, true);

  const verification = await verifyPortfolioWorkspace(loaded, { concurrency: 2 });
  assert.equal(verification.summary.run, 2);
  assert.equal(verification.summary.passed, 2);
  assert.equal(verification.summary.failed, 0);
  assert.equal(verification.guardrails.checksSerializedPerCheckout, true);
  assert.deepEqual(verification.checks.map(check => check.checkId), ['write-order', 'read-order']);
  assert.equal(verification.skipped[0].reason, 'dirty-worktree-preserved');
  assert.equal(fs.readFileSync(path.join(dirty, 'foreign.txt'), 'utf8'), 'preserve me\n');

  const fetchText = async url => {
    const canonical = url.includes('clean') ? 'https://clean.example/' : 'https://dirty.example/';
    if (url.endsWith('site-profile.json')) return { ok: true, status: 200, url, bytes: 200, text: JSON.stringify(profile(canonical)) };
    return { ok: true, status: 200, url, bytes: 80, text: '<link rel="alternate" href="ai/site-profile.json">' };
  };
  const live = await verifyPortfolioLive(loaded, { concurrency: 2, fetchText });
  assert.equal(live.summary.byState['live-profile-valid'], 2);
  assert.ok(live.sites.every(site => site.home.profileReferenceObserved));

  const imported = workspaceFromInventory({ sites: [{ id: 'one', checkout: clean, site_url: 'https://clean.example/', build: { profile_source: 'ai/site-profile.json', public_profile_path: 'ai/site-profile.json' }, readme_source: 'README.md' }] }, 'Imported');
  assert.equal(validatePortfolioWorkspace(imported).valid, true);
  assert.equal(imported.sites[0].checks.length, 0);
  assert.equal(imported.sites[0].profilePath, 'ai/site-profile.json');

  const duplicate = structuredClone(workspace);
  duplicate.sites[1].id = 'clean';
  assert.equal(validatePortfolioWorkspace(duplicate).valid, false);
  console.log('PASS portfolio workspace validates, preserves dirty work, serializes reviewed checks per checkout without a shell, verifies bounded live profiles and imports an existing inventory');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
