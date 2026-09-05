import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'search-agent-recommendations.json'), 'utf8'));
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const strictHttp = args.includes('--strict-http');
const maxReviewAgeDays = Number((args.find(arg => arg.startsWith('--max-review-age-days=')) || '').split('=')[1] || 45);

if (!Number.isFinite(maxReviewAgeDays) || maxReviewAgeDays <= 0) throw new Error('max review age must be a positive number of days');

function ageDays(date) {
  const reviewed = new Date(`${date}T00:00:00Z`);
  return Math.floor((Date.now() - reviewed.getTime()) / 86400000);
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'ARWP-recommendations-source-watch/0.1',
        accept: 'text/html, text/plain, application/json, application/xml;q=0.9, */*;q=0.1',
        range: 'bytes=0-4095'
      }
    });
    try { await response.body?.cancel?.(); } catch { /* no-op */ }
    return {
      url,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get('content-type') || null
    };
  } catch (error) {
    return { url, ok: false, status: null, finalUrl: null, error: String(error.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

const sourceRecords = [];
for (const rule of registry.rules) {
  const urls = [rule.source, ...(rule.additionalSources || [])];
  for (const url of urls) sourceRecords.push({ ruleId: rule.id, reviewedAt: rule.sourceReviewedAt, url });
}

const unique = new Map();
for (const item of sourceRecords) {
  const existing = unique.get(item.url);
  if (existing) existing.ruleIds.push(item.ruleId);
  else unique.set(item.url, { url: item.url, reviewedAt: item.reviewedAt, ruleIds: [item.ruleId] });
}

const results = [];
for (const item of unique.values()) {
  const reachability = await probe(item.url);
  results.push({
    ...item,
    reviewAgeDays: ageDays(item.reviewedAt),
    stale: ageDays(item.reviewedAt) > maxReviewAgeDays,
    reachability
  });
}

const summary = {
  ruleset: registry.ruleset,
  reviewedAt: registry.reviewedAt,
  sources: results.length,
  reachable: results.filter(item => item.reachability.ok).length,
  unreachable: results.filter(item => !item.reachability.ok).length,
  stale: results.filter(item => item.stale).length,
  maxReviewAgeDays
};

const report = {
  generatedAt: new Date().toISOString(),
  methodology: 'Reachability is an operational hint only. Source content still requires human/agent review before ARWP changes a rule. A redirect or HTTP success does not prove that the upstream guidance is unchanged.',
  summary,
  results
};

if (jsonOutput) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`ARWP recommendations source watch — ${registry.ruleset}`);
  for (const item of results) {
    const state = item.reachability.ok ? `HTTP ${item.reachability.status}` : `UNREACHABLE ${item.reachability.error || item.reachability.status || ''}`;
    console.log(`${item.stale ? 'STALE' : 'OK'} ${state} ${item.url} [${item.ruleIds.join(',')}] age=${item.reviewAgeDays}d`);
  }
  console.log(`Summary: ${summary.reachable}/${summary.sources} reachable, ${summary.stale} stale review(s).`);
}

if (summary.stale > 0 || (strictHttp && summary.unreachable > 0)) process.exit(1);
