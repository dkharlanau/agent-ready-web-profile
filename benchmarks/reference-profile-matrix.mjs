#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(HERE, 'corpus');
const DEFAULT_OUTPUT = path.join(process.cwd(), 'benchmark-results', 'reference-profile-matrix.json');

function argValue(name) {
  const prefix = `${name}=`;
  const exact = process.argv.indexOf(name);
  if (exact >= 0) return process.argv[exact + 1] || null;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

export function summarizeModules(modules = {}) {
  const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));
  const counts = { active: 0, planned: 0, notApplicable: 0, other: 0 };
  const p1Planned = [];
  const statuses = {};

  for (const [name, module] of entries) {
    const status = module?.status || 'unknown';
    statuses[name] = {
      status,
      priority: module?.priority || null,
      url: module?.url || null,
    };
    if (status === 'active') counts.active += 1;
    else if (status === 'planned') counts.planned += 1;
    else if (status === 'not-applicable') counts.notApplicable += 1;
    else counts.other += 1;

    if (status === 'planned' && module?.priority === 'P1') p1Planned.push(name);
  }

  return {
    totalModules: entries.length,
    counts,
    p1Planned: p1Planned.sort(),
    modules: statuses,
  };
}

async function fetchJson(url, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          accept: 'application/json',
          'cache-control': 'no-cache',
          'user-agent': 'arwp-reference-profile-matrix/1.0',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

async function main() {
  const output = path.resolve(argValue('--output') || DEFAULT_OUTPUT);
  const files = (await fs.readdir(CORPUS_DIR))
    .filter((file) => /^reference-.*\.json$/.test(file))
    .sort();

  const results = [];
  for (const file of files) {
    const fixture = JSON.parse(await fs.readFile(path.join(CORPUS_DIR, file), 'utf8'));
    if (fixture.ownership !== 'project-reference') continue;

    const profileUrl = new URL('ai/ai-search-profile.json', fixture.url).href;
    try {
      const profile = await fetchJson(profileUrl);
      const summary = summarizeModules(profile.modules || {});
      results.push({
        id: fixture.id,
        url: fixture.url,
        reviewedAt: fixture.reviewedAt,
        profileUrl,
        status: 'resolved',
        profileVersion: profile.profileVersion || null,
        ...summary,
      });
    } catch (error) {
      results.push({
        id: fixture.id,
        url: fixture.url,
        reviewedAt: fixture.reviewedAt,
        profileUrl,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const aggregate = results.reduce((acc, site) => {
    if (site.status !== 'resolved') return acc;
    acc.sitesResolved += 1;
    acc.totalModules += site.totalModules || 0;
    for (const key of ['active', 'planned', 'notApplicable', 'other']) {
      acc.counts[key] += site.counts?.[key] || 0;
    }
    return acc;
  }, {
    sitesResolved: 0,
    totalModules: 0,
    counts: { active: 0, planned: 0, notApplicable: 0, other: 0 },
  });

  const report = {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    ownership: 'project-reference',
    evidencePolicy: 'Owner-controlled profile-state inventory only. Module counts are descriptive and are not a readiness, ranking, trust, adoption or quality score.',
    sites: results.length,
    failedSites: results.filter((site) => site.status !== 'resolved').length,
    aggregate,
    results,
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${output}`);
  console.log(`Resolved ${aggregate.sitesResolved}/${results.length} project-reference profiles.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
