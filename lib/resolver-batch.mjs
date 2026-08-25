import { resolveSite } from './resolver.mjs';

const MAX_TARGETS = 100;
const MAX_CONCURRENCY = 10;

function normalizeTarget(value) {
  const raw = typeof value === 'string' ? value : value?.url || value?.canonicalUrl;
  if (!raw) throw new Error('Each batch target requires a URL.');
  const parsed = new URL(/^https?:\/\//i.test(String(raw)) ? String(raw) : `https://${raw}`);
  if (parsed.protocol !== 'https:') throw new Error(`Batch resolution is HTTPS-only: ${parsed.href}`);
  return {
    id: typeof value === 'object' && value?.id ? String(value.id) : parsed.hostname,
    name: typeof value === 'object' && value?.name ? String(value.name) : null,
    url: parsed.href,
    origin: parsed.origin
  };
}

export async function resolveMany(targets, {
  resolveImpl = resolveSite,
  concurrency = 4,
  resolveOptions = {}
} = {}) {
  if (!Array.isArray(targets) || !targets.length) throw new Error('resolveMany requires a non-empty targets array.');
  if (targets.length > MAX_TARGETS) throw new Error(`resolveMany supports at most ${MAX_TARGETS} targets per batch.`);
  const limit = Number(concurrency);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CONCURRENCY) throw new Error(`concurrency must be an integer between 1 and ${MAX_CONCURRENCY}.`);

  const normalized = targets.map(normalizeTarget);
  const results = new Array(normalized.length);
  const originTails = new Map();
  let cursor = 0;

  async function runTarget(target, index) {
    const previous = originTails.get(target.origin) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    originTails.set(target.origin, previous.catch(() => {}).then(() => gate));
    await previous.catch(() => {});

    const startedAt = Date.now();
    try {
      const resolution = await resolveImpl(target.url, resolveOptions);
      results[index] = {
        id: target.id,
        name: target.name,
        inputUrl: target.url,
        status: 'resolved',
        durationMs: Date.now() - startedAt,
        resolution
      };
    } catch (error) {
      results[index] = {
        id: target.id,
        name: target.name,
        inputUrl: target.url,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error: String(error?.message || error)
      };
    } finally {
      release();
    }
  }

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= normalized.length) return;
      await runTarget(normalized[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, normalized.length) }, () => worker()));

  const resolved = results.filter(item => item.status === 'resolved');
  return {
    batchVersion: '0.1',
    targets: normalized.length,
    results,
    summary: {
      resolved: resolved.length,
      failed: results.length - resolved.length,
      conflicts: resolved.reduce((sum, item) => sum + Number(item.resolution?.conflicts?.length || 0), 0),
      interfacesResolved: resolved.reduce((sum, item) => sum + Number(item.resolution?.summary?.interfacesResolved || 0), 0)
    }
  };
}
