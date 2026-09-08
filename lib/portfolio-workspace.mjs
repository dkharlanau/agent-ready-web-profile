import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fetchPublicText } from './public-fetch.mjs';
import { validateProfile } from './validator.mjs';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'portfolio-workspace.schema.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanLines(value) {
  return String(value || '').split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean);
}

function safeRemote(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.username || parsed.password) {
      parsed.username = 'redacted';
      parsed.password = '';
    }
    return parsed.href;
  } catch {
    return text;
  }
}

async function exec(argv, options = {}) {
  const started = Date.now();
  try {
    const { stdout = '', stderr = '' } = await execFileAsync(argv[0], argv.slice(1), {
      cwd: options.cwd,
      timeout: options.timeoutMs || 15000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' }
    });
    return { ok: true, exitCode: 0, durationMs: Date.now() - started, stdout, stderr };
  } catch (error) {
    return {
      ok: false,
      exitCode: Number.isInteger(error?.code) ? error.code : null,
      signal: error?.signal || null,
      timedOut: Boolean(error?.killed && error?.signal),
      durationMs: Date.now() - started,
      stdout: String(error?.stdout || ''),
      stderr: String(error?.stderr || error?.message || '')
    };
  }
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

export function loadPortfolioWorkspace(file) {
  const absolute = path.resolve(file);
  return { file: absolute, directory: path.dirname(absolute), workspace: JSON.parse(fs.readFileSync(absolute, 'utf8')) };
}

export function validatePortfolioWorkspace(workspace) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const schemaValid = Boolean(validate(workspace));
  const semanticErrors = [];
  const ids = new Set();
  for (const site of workspace?.sites || []) {
    if (ids.has(site.id)) semanticErrors.push(`Duplicate site id: ${site.id}`);
    ids.add(site.id);
    const checkIds = new Set();
    for (const check of site.checks || []) {
      if (checkIds.has(check.id)) semanticErrors.push(`Duplicate check id for ${site.id}: ${check.id}`);
      checkIds.add(check.id);
    }
  }
  return { valid: schemaValid && semanticErrors.length === 0, errors: validate.errors || [], semanticErrors };
}

function checkoutPath(site, directory) {
  return path.isAbsolute(site.checkout) ? path.normalize(site.checkout) : path.resolve(directory, site.checkout);
}

async function gitState(checkout) {
  const inside = await exec(['git', 'rev-parse', '--is-inside-work-tree'], { cwd: checkout });
  if (!inside.ok || inside.stdout.trim() !== 'true') return { repository: false };
  const [head, branch, status, upstream, remote] = await Promise.all([
    exec(['git', 'rev-parse', 'HEAD'], { cwd: checkout }),
    exec(['git', 'branch', '--show-current'], { cwd: checkout }),
    exec(['git', 'status', '--porcelain=v1'], { cwd: checkout }),
    exec(['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd: checkout }),
    exec(['git', 'remote', 'get-url', 'origin'], { cwd: checkout })
  ]);
  let divergence = null;
  if (upstream.ok) {
    const counts = await exec(['git', 'rev-list', '--left-right', '--count', `HEAD...${upstream.stdout.trim()}`], { cwd: checkout });
    if (counts.ok) {
      const [ahead, behind] = counts.stdout.trim().split(/\s+/).map(Number);
      divergence = { ahead, behind };
    }
  }
  const statusLines = cleanLines(status.stdout);
  return {
    repository: true,
    head: head.ok ? head.stdout.trim() : null,
    branch: branch.ok ? branch.stdout.trim() || null : null,
    upstream: upstream.ok ? upstream.stdout.trim() : null,
    divergence,
    dirty: statusLines.length > 0,
    changedPaths: statusLines.map(line => line.slice(3)),
    statusSha256: sha256(statusLines.join('\n')),
    origin: remote.ok ? safeRemote(remote.stdout) : null
  };
}

async function inspectOne(site, directory) {
  const checkout = checkoutPath(site, directory);
  if (!fs.existsSync(checkout) || !fs.statSync(checkout).isDirectory()) {
    return { id: site.id, checkout, state: 'missing-checkout', git: null, profile: null, discovery: [], checksConfigured: (site.checks || []).length };
  }
  const git = await gitState(checkout);
  let profile = null;
  if (site.profilePath) {
    const file = path.resolve(checkout, site.profilePath);
    if (!file.startsWith(`${checkout}${path.sep}`)) throw new Error(`profilePath escapes checkout for ${site.id}`);
    if (!fs.existsSync(file)) profile = { path: site.profilePath, exists: false, valid: null, canonicalMatches: null };
    else {
      try {
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        const validation = validateProfile(value);
        profile = {
          path: site.profilePath, exists: true, valid: validation.valid,
          canonicalUrl: value.canonicalUrl || null,
          canonicalMatches: site.canonicalUrl ? value.canonicalUrl === site.canonicalUrl : null,
          errors: validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`),
          warnings: validation.warnings,
          sha256: sha256(fs.readFileSync(file))
        };
      } catch (error) {
        profile = { path: site.profilePath, exists: true, valid: false, canonicalMatches: null, errors: [error.message], warnings: [] };
      }
    }
  }
  const discovery = (site.discoveryFiles || []).map(relative => ({ path: relative, exists: fs.existsSync(path.resolve(checkout, relative)) }));
  let state = 'ready';
  if (!git.repository) state = 'not-git';
  else if (profile && (!profile.exists || !profile.valid || profile.canonicalMatches === false)) state = 'profile-attention';
  else if (discovery.some(item => !item.exists)) state = 'discovery-attention';
  else if (git.dirty) state = 'dirty-preserved';
  return { id: site.id, checkout, canonicalUrl: site.canonicalUrl || null, state, git, profile, discovery, checksConfigured: (site.checks || []).length };
}

function selectedSites(workspace, selected) {
  if (!selected?.length) return workspace.sites;
  const wanted = new Set(selected);
  const sites = workspace.sites.filter(site => wanted.has(site.id));
  const found = new Set(sites.map(site => site.id));
  const unknown = [...wanted].filter(id => !found.has(id));
  if (unknown.length) throw new Error(`Unknown portfolio site id(s): ${unknown.join(', ')}`);
  return sites;
}

function summarize(sites) {
  const byState = {};
  for (const site of sites) byState[site.state] = (byState[site.state] || 0) + 1;
  return { sites: sites.length, byState };
}

export async function inspectPortfolioWorkspace(loaded, options = {}) {
  const validation = validatePortfolioWorkspace(loaded.workspace);
  if (!validation.valid) throw new Error(`Invalid portfolio workspace: ${[...validation.semanticErrors, ...validation.errors.map(e => `${e.instancePath || '/'} ${e.message}`)].join('; ')}`);
  const sites = selectedSites(loaded.workspace, options.siteIds);
  const inspected = await mapLimit(sites, options.concurrency || 4, site => inspectOne(site, loaded.directory));
  return {
    version: '0.1', kind: 'portfolio-workspace-inspection', generatedAt: new Date().toISOString(),
    workspace: loaded.file, name: loaded.workspace.name, summary: summarize(inspected), sites: inspected,
    guardrails: { readOnlyInspection: true, dirtyWorkPreserved: true, remoteStateNotFetched: true, productionMutation: false },
    note: 'Git state and local files are current observations. They do not prove a commit, push, deployment, indexing or Search/AI outcome.'
  };
}

export async function verifyPortfolioWorkspace(loaded, options = {}) {
  const inspection = await inspectPortfolioWorkspace(loaded, options);
  const configById = new Map(loaded.workspace.sites.map(site => [site.id, site]));
  const runnableSites = [];
  const skipped = [];
  for (const observed of inspection.sites) {
    const site = configById.get(observed.id);
    if (!observed.git?.repository) {
      skipped.push({ siteId: site.id, reason: observed.state });
      continue;
    }
    if (observed.git.dirty && !options.allowDirty) {
      skipped.push({ siteId: site.id, reason: 'dirty-worktree-preserved', checks: (site.checks || []).map(item => item.id) });
      continue;
    }
    if ((site.checks || []).length) runnableSites.push({ site, observed, checks: site.checks });
  }
  const groupedChecks = await mapLimit(runnableSites, options.concurrency || 2, async item => {
    const results = [];
    for (const check of item.checks) {
      const cwd = path.resolve(item.observed.checkout, check.cwd || '.');
      const relativeCwd = path.relative(item.observed.checkout, cwd);
      if (relativeCwd.startsWith('..') || path.isAbsolute(relativeCwd)) throw new Error(`Check cwd escapes checkout for ${item.site.id}/${check.id}`);
      const before = await gitState(item.observed.checkout);
      const execution = await exec(check.argv, { cwd, timeoutMs: check.timeoutMs || options.timeoutMs || 120000 });
      const after = await gitState(item.observed.checkout);
      results.push({
        siteId: item.site.id, checkId: check.id, executable: check.argv[0],
        argumentCount: check.argv.length - 1, argvSha256: sha256(JSON.stringify(check.argv)), cwd: check.cwd || '.',
        status: execution.ok ? 'passed' : 'failed', exitCode: execution.exitCode, signal: execution.signal || null,
        timedOut: Boolean(execution.timedOut), durationMs: execution.durationMs,
        stdout: { bytes: Buffer.byteLength(execution.stdout), sha256: sha256(execution.stdout) },
        stderr: { bytes: Buffer.byteLength(execution.stderr), sha256: sha256(execution.stderr) },
        workingTreeChanged: before.statusSha256 !== after.statusSha256,
        beforeStatusSha256: before.statusSha256, afterStatusSha256: after.statusSha256
      });
    }
    return results;
  });
  const checks = groupedChecks.flat();
  const configured = loaded.workspace.sites.filter(site => !options.siteIds?.length || options.siteIds.includes(site.id)).reduce((count, site) => count + (site.checks || []).length, 0);
  return {
    version: '0.1', kind: 'portfolio-workspace-verification', generatedAt: new Date().toISOString(),
    workspace: loaded.file, inspection,
    summary: { configured, run: checks.length, passed: checks.filter(x => x.status === 'passed').length, failed: checks.filter(x => x.status === 'failed').length, skippedSites: skipped.length, workingTreeChanges: checks.filter(x => x.workingTreeChanged).length },
    checks, skipped,
    guardrails: { commandsUseArgumentArraysWithoutShell: true, checksSerializedPerCheckout: true, dirtySitesSkippedByDefault: !options.allowDirty, outputStoredAsHashesOnly: true, productionMutation: false },
    note: 'Passing configured checks is local verification only. Any command-caused working-tree change is reported and never cleaned automatically.'
  };
}

export async function verifyPortfolioLive(loaded, options = {}) {
  const validation = validatePortfolioWorkspace(loaded.workspace);
  if (!validation.valid) throw new Error('Invalid portfolio workspace. Run fleet-check first.');
  const sites = selectedSites(loaded.workspace, options.siteIds).filter(site => site.canonicalUrl);
  const fetchText = options.fetchText || fetchPublicText;
  const results = await mapLimit(sites, options.concurrency || 3, async site => {
    const profileUrl = new URL(site.publicProfilePath || 'ai/site-profile.json', site.canonicalUrl).href;
    try {
      const [home, remoteProfile] = await Promise.all([
        fetchText(site.canonicalUrl, { timeoutMs: options.timeoutMs || 8000, maxBytes: options.maxBytes || 524288 }),
        fetchText(profileUrl, { timeoutMs: options.timeoutMs || 8000, maxBytes: options.maxBytes || 524288 })
      ]);
      let profile = { ok: remoteProfile.ok, status: remoteProfile.status, url: remoteProfile.url, bytes: remoteProfile.bytes, sha256: remoteProfile.text ? sha256(remoteProfile.text) : null, valid: null, canonicalMatches: null };
      if (remoteProfile.ok && remoteProfile.text) {
        try {
          const value = JSON.parse(remoteProfile.text);
          profile.valid = validateProfile(value).valid;
          profile.canonicalMatches = value.canonicalUrl === site.canonicalUrl;
        } catch { profile.valid = false; }
      }
      const discoveryHref = site.publicProfilePath || 'ai/site-profile.json';
      const profileReferenceObserved = Boolean(home.text && (home.text.includes(discoveryHref) || home.text.includes(profileUrl)));
      return {
        id: site.id, state: home.ok && profile.ok && profile.valid && profile.canonicalMatches && profileReferenceObserved ? 'live-profile-valid' : 'live-attention',
        home: { ok: home.ok, status: home.status, url: home.url, bytes: home.bytes, sha256: home.text ? sha256(home.text) : null, profileReferenceObserved },
        profile
      };
    } catch (error) {
      return { id: site.id, state: 'unavailable', error: error.message, home: null, profile: null };
    }
  });
  return {
    version: '0.1', kind: 'portfolio-live-verification', generatedAt: new Date().toISOString(), workspace: loaded.file,
    summary: { ...summarize(results), failed: results.filter(site => site.state !== 'live-profile-valid').length }, sites: results,
    guardrails: { boundedPublicHttpsOnly: true, responseBodiesOmitted: true, ownerMetricsSeparate: true, productionMutation: false },
    note: 'Live HTTP and profile validity do not prove deployed commit identity, indexing, ranking, AI citation or business outcomes.'
  };
}

export function workspaceFromInventory(inventory, name = 'Imported website portfolio') {
  if (!Array.isArray(inventory?.sites) || !inventory.sites.length) throw new Error('Inventory must contain a non-empty sites array.');
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/portfolio-workspace.schema.json',
    version: '0.1', name,
    sites: inventory.sites.map(site => ({
      id: site.id,
      checkout: site.checkout,
      ...(site.site_url ? { canonicalUrl: site.site_url } : {}),
      ...(site.applied_profile_source || site.build?.profile_source || site.existing_profiles?.[0]?.path ? { profilePath: site.applied_profile_source || site.build?.profile_source || site.existing_profiles[0].path } : {}),
      publicProfilePath: site.build?.public_profile_path || 'ai/site-profile.json',
      discoveryFiles: [...new Set([...(site.agent_instruction_files || []), site.readme_source].filter(Boolean))],
      checks: []
    }))
  };
}

export function formatPortfolioWorkspace(result) {
  const siteCount = result.summary.sites ?? result.sites?.length ?? result.inspection?.summary?.sites ?? 0;
  const lines = [`${result.kind} — ${result.generatedAt}`, `Sites: ${siteCount}`];
  if (result.summary.byState) lines.push(`States: ${Object.entries(result.summary.byState).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  if (result.kind === 'portfolio-workspace-verification') lines.push(`Checks: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skippedSites} site(s) skipped`);
  lines.push('');
  for (const site of result.sites || result.inspection?.sites || []) lines.push(`${site.state.padEnd(22)} ${site.id}`);
  lines.push('', result.note);
  return lines.join('\n');
}
