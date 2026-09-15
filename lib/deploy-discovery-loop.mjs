import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSearchArtifact } from './search-build-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(here, '..', 'registry', 'deploy-discovery-loop-practices.json');

export const DEPLOY_DISCOVERY_LOOP_VERSION = '0.1';

export function loadDeployDiscoveryLoopRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function decodeEntities(value) {
  return String(value).replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[\da-f]+);/gi, token => {
    const named = {
      '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' '
    };
    const lower = token.toLowerCase();
    if (named[lower] != null) return named[lower];
    const code = lower.startsWith('&#x') ? parseInt(lower.slice(3, -1), 16) : parseInt(lower.slice(2, -1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
  });
}

export function visibleTextDigest(html) {
  const document = String(html || '');
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? document;
  const stripped = body
    .replace(/<(?:script|style|template|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|template|svg)\s*>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(stripped).replace(/\s+/g, ' ').trim();
  return sha256(text);
}

function normalizeSite(value) {
  const url = new URL(String(value || '').trim());
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('site must be HTTP(S)');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function underSite(candidate, site) {
  try {
    const target = new URL(candidate);
    const root = new URL(site);
    return target.origin === root.origin && (target.pathname === root.pathname.slice(0, -1) || target.pathname.startsWith(root.pathname));
  } catch {
    return false;
  }
}

function stableSignals(signals = {}) {
  return {
    titles: signals.titles || [],
    descriptions: signals.descriptions || [],
    canonicals: signals.canonicals || [],
    noindex: Boolean(signals.noindex),
    ogUrls: signals.ogUrls || [],
    invalidJsonLd: Number(signals.invalidJsonLd || 0),
    jsonLdCount: Number(signals.jsonLdCount || 0),
    jsonLdDigests: signals.jsonLdDigests || []
  };
}

function signalDigest(page) {
  return sha256(JSON.stringify(stableSignals(page?.signals)));
}

function pageMap(report, artifactRoot) {
  const root = path.resolve(artifactRoot);
  const map = new Map();
  for (const page of report.pages || []) {
    if (page.errorRoute) continue;
    const file = path.join(root, page.file);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    map.set(page.publicUrl, {
      url: page.publicUrl,
      file: page.file,
      artifactSha256: page.sha256,
      visibleTextSha256: visibleTextDigest(html),
      searchSurfaceSha256: signalDigest(page)
    });
  }
  return map;
}

function normalizeRemovedStatus(input) {
  if (!input) return new Map();
  const rows = Array.isArray(input)
    ? input
    : Object.entries(input).map(([url, status]) => ({ url, status }));
  const out = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const url = String(row.url || '').trim();
    const status = Number(row.status);
    if (!url || !Number.isInteger(status)) continue;
    out.set(url, status);
  }
  return out;
}

function validateLiveReport(afterReport, liveReport) {
  const evidence = [];
  const failures = [];
  const watches = [];
  if (!afterReport.pass) failures.push('after-artifact-search-build-gate-failed');
  if (!liveReport) {
    watches.push('live-parity-report-missing');
    return { state: 'watch', pass: false, failures, watches, evidence };
  }
  if (liveReport.site !== afterReport.site) failures.push('live-site-mismatch');
  if (liveReport.coverage !== 'complete-index-cohort') failures.push('live-parity-not-complete-index-cohort');
  if (liveReport.revision?.state !== 'pass') failures.push('live-revision-parity-not-pass');
  if (liveReport.pass !== true) failures.push('live-search-parity-not-pass');
  if (afterReport.sourceSha && liveReport.revision?.sourceSha && afterReport.sourceSha.toLowerCase() !== liveReport.revision.sourceSha.toLowerCase()) {
    failures.push('artifact-source-sha-live-source-sha-mismatch');
  }
  if (afterReport.sourceSha && liveReport.revision?.deployedSha && afterReport.sourceSha.toLowerCase() !== liveReport.revision.deployedSha.toLowerCase()) {
    failures.push('artifact-source-sha-deployed-sha-mismatch');
  }
  if (afterReport.sourceSha) evidence.push(`sourceSha=${afterReport.sourceSha}`);
  if (liveReport.revision?.deployedSha) evidence.push(`deployedSha=${liveReport.revision.deployedSha}`);
  return {
    state: failures.length ? 'fail' : 'pass',
    pass: failures.length === 0,
    failures,
    watches,
    evidence
  };
}

function compareArtifacts(beforeReport, afterReport, beforeRoot, afterRoot, removedStatus) {
  const before = beforeReport ? pageMap(beforeReport, beforeRoot) : new Map();
  const after = pageMap(afterReport, afterRoot);
  const beforeCohort = new Set(beforeReport?.pageFindings?.map(item => item.url) || []);
  const afterCohort = new Set(afterReport.pageFindings?.map(item => item.url) || []);
  const added = [];
  const updated = [];
  const artifactOnlyChanged = [];
  const removed = [];
  const unchanged = [];

  for (const url of [...afterCohort].sort()) {
    const current = after.get(url);
    const previous = before.get(url);
    if (!beforeCohort.has(url) || !previous) {
      added.push({ url, reason: 'canonical-added', evidence: current || null });
      continue;
    }
    const searchChanged = current.searchSurfaceSha256 !== previous.searchSurfaceSha256;
    const visibleChanged = current.visibleTextSha256 !== previous.visibleTextSha256;
    const artifactChanged = current.artifactSha256 !== previous.artifactSha256;
    if (searchChanged || visibleChanged) {
      updated.push({
        url,
        reason: searchChanged && visibleChanged ? 'search-and-visible-content-updated' : searchChanged ? 'search-surface-updated' : 'visible-content-updated',
        searchChanged,
        visibleChanged,
        before: previous,
        after: current
      });
    } else if (artifactChanged) {
      artifactOnlyChanged.push({
        url,
        reason: 'artifact-byte-change-without-visible-or-search-change',
        beforeArtifactSha256: previous.artifactSha256,
        afterArtifactSha256: current.artifactSha256
      });
    } else {
      unchanged.push(url);
    }
  }

  for (const url of [...beforeCohort].sort()) {
    if (afterCohort.has(url)) continue;
    const status = removedStatus.get(url) ?? null;
    removed.push({
      url,
      status,
      verifiedGone: status === 404 || status === 410,
      reason: status === 404 || status === 410 ? `removed-live-http-${status}` : 'removed-without-live-404-or-410-evidence'
    });
  }

  return { added, updated, artifactOnlyChanged, removed, unchanged };
}

function verifyChangedUrlsExact(liveReport, urls) {
  if (!urls.length) return { state: 'not-applicable', pass: true, entries: [], failures: [], watches: [] };
  if (!liveReport) {
    return {
      state: 'watch', pass: false, entries: [], failures: [],
      watches: urls.map(url => `${url}:changed-url-live-report-missing`)
    };
  }
  const liveByUrl = new Map((liveReport.pages || []).map(page => [page.url, page]));
  const entries = urls.map(url => {
    const page = liveByUrl.get(url);
    if (!page) return { url, state: 'watch', issue: 'changed-url-not-in-live-parity-report' };
    if (page.state !== 'pass') return { url, state: 'fail', issue: 'changed-url-live-search-parity-failed' };
    if (!page.localSha256 || !page.liveSha256) return { url, state: 'watch', issue: 'changed-url-byte-parity-unavailable' };
    if (page.localSha256 !== page.liveSha256) return { url, state: 'fail', issue: 'changed-url-live-byte-drift' };
    return { url, state: 'pass', issue: null, localSha256: page.localSha256, liveSha256: page.liveSha256 };
  });
  const failures = entries.filter(item => item.state === 'fail').map(item => `${item.url}:${item.issue}`);
  const watches = entries.filter(item => item.state === 'watch').map(item => `${item.url}:${item.issue}`);
  return {
    state: failures.length ? 'fail' : watches.length ? 'watch' : 'pass',
    pass: failures.length === 0 && watches.length === 0,
    entries,
    failures,
    watches
  };
}

function homepageFeedDiscovery(afterReport, artifactRoot) {
  const root = path.resolve(artifactRoot);
  const homepage = (afterReport.pages || []).find(page => page.publicUrl === afterReport.site && !page.errorRoute);
  if (!homepage) return { state: 'watch', feeds: [], issues: ['homepage-artifact-not-found'] };
  const file = path.join(root, homepage.file);
  if (!fs.existsSync(file)) return { state: 'watch', feeds: [], issues: ['homepage-file-not-found'] };
  const html = fs.readFileSync(file, 'utf8');
  const feeds = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)?.slice(1).find(Boolean) || '';
    const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)?.slice(1).find(Boolean) || '';
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)?.slice(1).find(Boolean) || '';
    if (!rel.toLowerCase().split(/\s+/).includes('alternate')) continue;
    if (!/(?:application|text)\/(?:rss\+xml|atom\+xml|xml)/i.test(type)) continue;
    if (!href) continue;
    let url;
    try { url = new URL(href, afterReport.site).href; } catch { continue; }
    const inside = underSite(url, afterReport.site);
    let artifactPresent = false;
    if (inside) {
      const siteUrl = new URL(afterReport.site);
      const feedUrl = new URL(url);
      const relative = decodeURIComponent(feedUrl.pathname.slice(siteUrl.pathname.length)).replace(/^\/+/, '');
      if (relative) artifactPresent = fs.existsSync(path.join(root, relative));
    }
    feeds.push({ url, type, underSite: inside, artifactPresent });
  }
  const issues = feeds.flatMap(feed => [
    ...(feed.underSite ? [] : [`feed-outside-site:${feed.url}`]),
    ...(feed.underSite && !feed.artifactPresent ? [`advertised-feed-missing-artifact:${feed.url}`] : [])
  ]);
  return {
    state: issues.some(issue => issue.startsWith('advertised-feed-missing-artifact:')) ? 'fail' : feeds.length ? 'pass' : 'watch',
    feeds,
    issues: feeds.length ? issues : ['feed-autodiscovery-not-observed']
  };
}

function ownerEvidenceQueue({ site, diff, indexNowReady, sitemapUrl }) {
  const changedUrls = [...new Set([
    ...diff.added.map(item => item.url),
    ...diff.updated.map(item => item.url),
    ...diff.removed.map(item => item.url)
  ])];
  return [
    {
      id: 'owner:google-sitemap-processing', provider: 'google-search-console', state: 'owner-data-required',
      scope: [sitemapUrl],
      instruction: 'Review the sitemap processing state and errors in Search Console after the verified release. Sitemap submission is a hint, not indexing proof.'
    },
    {
      id: 'owner:google-search-performance', provider: 'google-search-console', state: 'owner-data-required',
      scope: changedUrls,
      instruction: 'Compare query/page Search performance for the changed canonical cohort after an appropriate observation window; preserve neutral/negative movement and do not attribute causality automatically.'
    },
    {
      id: 'owner:google-generative-ai-performance', provider: 'google-search-console-generative-ai', state: 'owner-data-required',
      scope: changedUrls,
      instruction: 'Where the property has sufficient data, review Generative AI Search/Discover visibility for the changed cohort. Absence of data is not a technical failure.'
    },
    {
      id: 'owner:bing-indexnow-receipt', provider: 'indexnow', state: indexNowReady.length ? 'action-ready' : 'not-applicable',
      scope: indexNowReady,
      instruction: indexNowReady.length
        ? 'Use the existing arwp-indexnow helper with this ready URL set only after key/host ownership is configured. Retain the submission receipt; acceptance is not indexing proof.'
        : 'No evidence-backed changed URL is ready for IndexNow submission.'
    },
    {
      id: 'owner:bing-sitemap-processing', provider: 'bing-webmaster-tools', state: 'owner-data-required',
      scope: [sitemapUrl],
      instruction: 'Review sitemap processing/coverage in Bing Webmaster Tools separately from IndexNow notification evidence.'
    },
    {
      id: 'owner:bing-ai-performance', provider: 'bing-webmaster-ai-performance', state: 'owner-data-required',
      scope: changedUrls,
      instruction: 'Review citations, cited pages and grounding-query evidence for the changed cohort when available; preserve it as provider-native outcome evidence.'
    },
    {
      id: 'owner:referral-outcomes', provider: 'referral-analytics', state: 'owner-data-required',
      scope: changedUrls,
      instruction: 'Review Search/AI referrals and downstream task/conversion outcomes for the changed cohort without treating correlation as causation.'
    }
  ];
}

export function planDeployDiscovery({
  site,
  beforeArtifactRoot = null,
  afterArtifactRoot,
  liveReport = null,
  sourceSha = null,
  removedStatus = null,
  registry = loadDeployDiscoveryLoopRegistry()
} = {}) {
  if (!afterArtifactRoot) throw new Error('afterArtifactRoot is required');
  const canonicalSite = normalizeSite(site);
  const beforeReport = beforeArtifactRoot
    ? compileSearchArtifact({ artifactRoot: beforeArtifactRoot, site: canonicalSite })
    : null;
  const afterReport = compileSearchArtifact({ artifactRoot: afterArtifactRoot, site: canonicalSite, sourceSha });
  const deployment = validateLiveReport(afterReport, liveReport);
  const removedMap = normalizeRemovedStatus(removedStatus);
  const diff = compareArtifacts(beforeReport, afterReport, beforeArtifactRoot, afterArtifactRoot, removedMap);
  const changedCandidateUrls = [...new Set([
    ...diff.added.map(item => item.url),
    ...diff.updated.map(item => item.url)
  ])].sort();
  const changedLiveEvidence = verifyChangedUrlsExact(liveReport, changedCandidateUrls);
  const exactChangedUrls = changedLiveEvidence.entries.filter(item => item.state === 'pass').map(item => item.url);
  const verifiedRemoved = diff.removed.filter(item => item.verifiedGone).map(item => item.url);
  const readyUrls = deployment.pass ? [...new Set([...exactChangedUrls, ...verifiedRemoved])].sort() : [];
  const blockedCandidates = deployment.pass
    ? changedLiveEvidence.entries.filter(item => item.state !== 'pass').map(item => item.url).sort()
    : [...new Set([...changedCandidateUrls, ...verifiedRemoved])].sort();
  const watchUrls = [...new Set([
    ...diff.artifactOnlyChanged.map(item => item.url),
    ...diff.removed.filter(item => !item.verifiedGone).map(item => item.url),
    ...changedLiveEvidence.entries.filter(item => item.state === 'watch').map(item => item.url)
  ])].sort();
  const sitemapUrl = new URL('sitemap.xml', canonicalSite).href;
  const sitemap = {
    state: afterReport.sitemap.present && !afterReport.sitemap.issues.length && afterReport.pass ? 'pass' : 'fail',
    url: sitemapUrl,
    beforeUrls: beforeReport?.sitemap?.urls?.length ?? 0,
    afterUrls: afterReport.sitemap?.urls?.length ?? 0,
    changed: JSON.stringify(beforeReport?.sitemap?.urls || []) !== JSON.stringify(afterReport.sitemap?.urls || []),
    issues: afterReport.sitemap?.issues || []
  };
  const feed = homepageFeedDiscovery(afterReport, afterArtifactRoot);
  const ownerEvidence = ownerEvidenceQueue({ site: canonicalSite, diff, indexNowReady: readyUrls, sitemapUrl });
  const failures = [
    ...deployment.failures,
    ...changedLiveEvidence.failures,
    ...(sitemap.state === 'fail' ? ['after-sitemap-not-release-ready'] : []),
    ...(feed.state === 'fail' ? feed.issues : [])
  ];
  const watches = [
    ...deployment.watches,
    ...changedLiveEvidence.watches,
    ...diff.artifactOnlyChanged.map(item => `${item.url}:artifact-only-change`),
    ...diff.removed.filter(item => !item.verifiedGone).map(item => `${item.url}:removed-url-live-status-unverified`),
    ...(feed.state === 'watch' ? feed.issues : feed.issues.filter(issue => issue.startsWith('feed-outside-site:')))
  ];
  const completeForHandoff = deployment.pass && changedLiveEvidence.pass;
  const indexNowState = !deployment.pass
    ? 'blocked'
    : blockedCandidates.length
      ? (readyUrls.length ? 'partial' : 'blocked')
      : readyUrls.length ? 'ready' : 'not-needed';
  return {
    version: DEPLOY_DISCOVERY_LOOP_VERSION,
    reviewedAt: registry.reviewedAt,
    site: canonicalSite,
    deployment,
    changedLiveEvidence,
    before: beforeReport ? { pass: beforeReport.pass, sourceSha: beforeReport.sourceSha, cohort: beforeReport.inventory.indexCohort } : null,
    after: { pass: afterReport.pass, sourceSha: afterReport.sourceSha, cohort: afterReport.inventory.indexCohort },
    diff: {
      added: diff.added,
      updated: diff.updated,
      artifactOnlyChanged: diff.artifactOnlyChanged,
      removed: diff.removed,
      unchangedCount: diff.unchanged.length
    },
    sitemap,
    feed,
    indexNow: {
      state: indexNowState,
      readyUrls,
      blockedCandidates,
      watchUrls,
      note: 'Ready means evidence-backed, exact-live-verified for added/updated URLs, and deploy-gated for the existing IndexNow helper. It does not mean submitted, crawled or indexed.'
    },
    ownerEvidenceQueue: ownerEvidence,
    failures,
    watches,
    pass: failures.length === 0 && completeForHandoff && sitemap.state === 'pass',
    guardrails: registry.guardrails,
    note: 'Deploy Discovery Loop proves a bounded release-to-discovery plan. It does not prove indexing, ranking, AI citation, referral traffic or causal impact.'
  };
}

export function formatDeployDiscoveryReport(report) {
  const lines = [
    `ARWP Deploy Discovery Loop ${report.version}`,
    `Site: ${report.site}`,
    `Deployment: ${report.deployment.state.toUpperCase()}`,
    `Changed URL live evidence: ${report.changedLiveEvidence.state.toUpperCase()}`,
    `Canonical diff: +${report.diff.added.length} ~${report.diff.updated.length} byte-watch=${report.diff.artifactOnlyChanged.length} -${report.diff.removed.length}`,
    `IndexNow: ${report.indexNow.state.toUpperCase()} (${report.indexNow.readyUrls.length} ready, ${report.indexNow.watchUrls.length} watch, ${report.indexNow.blockedCandidates.length} blocked)`,
    `Sitemap: ${report.sitemap.state.toUpperCase()} ${report.sitemap.url}`,
    `Feed: ${report.feed.state.toUpperCase()} (${report.feed.feeds.length} advertised)`,
    `Result: ${report.pass ? 'PASS' : 'NOT COMPLETE/PASS'}`
  ];
  if (report.failures.length) lines.push('', 'Failures:', ...report.failures.map(item => `- ${item}`));
  if (report.watches.length) lines.push('', 'Watch:', ...report.watches.map(item => `- ${item}`));
  if (report.indexNow.readyUrls.length) lines.push('', 'IndexNow-ready URLs:', ...report.indexNow.readyUrls.map(item => `- ${item}`));
  return lines.join('\n');
}
