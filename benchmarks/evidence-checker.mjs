import { probePublicHttpsUrl } from '../lib/public-fetch.mjs';

const INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];

function acceptedUrl(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.url === 'string') return value.url;
  return null;
}

export function collectFixtureTargets(fixture) {
  const targets = new Map();
  const add = (url, role, detail = null) => {
    if (!url) return;
    const normalized = new URL(url).href;
    const existing = targets.get(normalized) || { url: normalized, roles: [] };
    if (!existing.roles.some(item => item.role === role && item.detail === detail)) {
      existing.roles.push({ role, ...(detail ? { detail } : {}) });
    }
    targets.set(normalized, existing);
  };

  add(fixture.url, 'site');
  for (const evidence of fixture.evidence || []) add(evidence.url, 'evidence', evidence.sourceType || null);
  for (const intent of INTENTS) {
    for (const value of fixture.accepted?.[intent] || []) add(acceptedUrl(value), 'accepted-interface', intent);
  }

  return [...targets.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function reviewAgeDays(reviewedAt, now) {
  const reviewed = Date.parse(`${reviewedAt}T00:00:00Z`);
  if (!Number.isFinite(reviewed)) return null;
  return Math.max(0, Math.floor((now.getTime() - reviewed) / 86400000));
}

async function mapBounded(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

export async function runEvidenceChecks(fixtures, {
  probeImpl = probePublicHttpsUrl,
  concurrency = 4,
  reviewMaxAgeDays = 90,
  now = new Date()
} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error('concurrency must be an integer between 1 and 10');
  if (!Number.isInteger(reviewMaxAgeDays) || reviewMaxAgeDays < 1) throw new Error('reviewMaxAgeDays must be a positive integer');

  const independent = fixtures
    .filter(fixture => fixture.ownership === 'independent')
    .sort((a, b) => a.id.localeCompare(b.id));

  const work = [];
  for (const fixture of independent) {
    for (const target of collectFixtureTargets(fixture)) work.push({ fixture, target });
  }

  const checked = await mapBounded(work, concurrency, async ({ fixture, target }) => {
    try {
      const result = await probeImpl(target.url);
      return {
        fixtureId: fixture.id,
        url: target.url,
        roles: target.roles,
        status: result.ok ? 'reachable' : 'unreachable',
        httpStatus: result.status ?? null,
        finalUrl: result.url || target.url,
        redirected: Boolean(result.redirected || (result.url && result.url !== target.url)),
        contentType: result.contentType || null
      };
    } catch (error) {
      return {
        fixtureId: fixture.id,
        url: target.url,
        roles: target.roles,
        status: 'error',
        httpStatus: null,
        finalUrl: null,
        redirected: false,
        contentType: null,
        error: error?.message || String(error)
      };
    }
  });

  const byFixture = new Map(independent.map(fixture => [fixture.id, []]));
  for (const item of checked) byFixture.get(item.fixtureId)?.push(item);

  const sites = independent.map(fixture => {
    const ageDays = reviewAgeDays(fixture.reviewedAt, now);
    const checks = byFixture.get(fixture.id) || [];
    return {
      id: fixture.id,
      url: fixture.url,
      reviewedAt: fixture.reviewedAt,
      reviewAgeDays: ageDays,
      reviewStale: ageDays == null ? true : ageDays > reviewMaxAgeDays,
      targets: checks.length,
      reachable: checks.filter(item => item.status === 'reachable').length,
      unreachable: checks.filter(item => item.status === 'unreachable').length,
      errors: checks.filter(item => item.status === 'error').length,
      redirected: checks.filter(item => item.redirected).length,
      checks
    };
  });

  const totals = {
    independentFixtures: sites.length,
    targets: checked.length,
    reachable: checked.filter(item => item.status === 'reachable').length,
    unreachable: checked.filter(item => item.status === 'unreachable').length,
    errors: checked.filter(item => item.status === 'error').length,
    redirected: checked.filter(item => item.redirected).length,
    staleReviews: sites.filter(site => site.reviewStale).length
  };

  return {
    schemaVersion: '0.1',
    generatedAt: now.toISOString(),
    scope: 'Transport-level liveness only. Reachability does not re-confirm semantic ground truth or interface correctness.',
    reviewMaxAgeDays,
    totals,
    sites
  };
}
