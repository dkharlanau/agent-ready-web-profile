import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'search-platform-eligibility.json');

export const SEARCH_PLATFORM_ELIGIBILITY_VERSION = '0.1';

export function loadSearchPlatformEligibilityRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function normalizeSiteRoot(value) {
  const url = new URL(String(value || '').trim());
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('site must be an HTTP(S) URL');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function normalizeBasePath(value) {
  if (value == null || value === '' || value === '/') return '';
  let result = String(value).trim();
  if (!result.startsWith('/')) result = `/${result}`;
  result = result.replace(/\/+$/, '');
  return result === '/' ? '' : result;
}

function expectedBasePath(site) {
  const pathname = new URL(site).pathname.replace(/\/+$/, '');
  return pathname === '' || pathname === '/' ? '' : pathname;
}

function inferProvider(site) {
  const hostname = new URL(site).hostname.toLowerCase();
  if (hostname === 'github.io' || hostname.endsWith('.github.io')) return 'github-pages';
  return 'unknown';
}

function hasType(types, type) {
  return new Set((types || []).map(value => String(value).toLowerCase())).has(type.toLowerCase());
}

function ruleMap(registry) {
  return new Map((registry.rules || []).map(rule => [rule.id, rule]));
}

function finding(rule, state, message, evidence = []) {
  return {
    id: rule.id,
    priority: rule.priority,
    state,
    appliesTo: rule.appliesTo,
    claim: rule.claim,
    decision: rule.decision,
    message,
    source: rule.source,
    evidence
  };
}

function preferredSourcesFinding(rule, input) {
  if (input.siteScope === 'hostname-root') {
    return finding(rule, 'pass', 'The declared site scope is hostname-root, so the site is scope-eligible for Google Preferred Sources. This does not prove user selection or Search prominence.', [input.site]);
  }
  if (input.siteScope === 'subdirectory') {
    return finding(rule, 'not-applicable', 'The declared site is an independent subdirectory scope. Google Preferred Sources accepts a domain or subdomain, not a subdirectory as a separately selectable source.', [input.site]);
  }
  return finding(rule, 'watch', 'Site scope is unknown. Classify whether this product owns the hostname root before recommending a Preferred Sources CTA.', [input.site]);
}

function indexingApiFinding(rule, input) {
  const types = input.structuredDataTypes || [];
  if (hasType(types, 'JobPosting')) {
    return finding(rule, 'pass', 'JobPosting was explicitly declared, so the Google Indexing API content-type scope is applicable. This does not prove indexing.', ['JobPosting']);
  }
  if (hasType(types, 'BroadcastEvent') && hasType(types, 'VideoObject')) {
    return finding(rule, 'pass', 'BroadcastEvent and VideoObject were explicitly declared, so the Google Indexing API livestream scope is applicable. This does not prove indexing.', ['BroadcastEvent', 'VideoObject']);
  }
  if (hasType(types, 'BroadcastEvent')) {
    return finding(rule, 'not-applicable', 'BroadcastEvent was declared without VideoObject. Do not use Google Indexing API unless the BroadcastEvent is embedded in a VideoObject as required by Google.', ['BroadcastEvent']);
  }
  return finding(rule, 'not-applicable', 'No JobPosting or BroadcastEvent-in-VideoObject scope was declared. Do not use Google Indexing API for ordinary site updates.', types);
}

function metadataBaseFinding(rule, input) {
  if (input.stack !== 'nextjs') return finding(rule, 'not-applicable', 'The declared stack is not Next.js.');
  const raw = input.nextjs?.metadataBase;
  if (!raw) {
    return finding(rule, 'watch', 'Next.js metadataBase was not declared. This can be valid when every URL-based metadata field is absolute, but the final artifact needs explicit review.', [input.site]);
  }
  let metadataBase;
  try {
    metadataBase = normalizeSiteRoot(raw);
  } catch {
    return finding(rule, 'fail', 'Next.js metadataBase is not a valid HTTP(S) URL.', [String(raw)]);
  }
  if (metadataBase !== input.site) {
    return finding(rule, 'fail', `Next.js metadataBase resolves to ${metadataBase}, but the declared public site root is ${input.site}.`, [metadataBase, input.site]);
  }
  return finding(rule, 'pass', 'Next.js metadataBase matches the declared public site root.', [metadataBase]);
}

function basePathFinding(rule, input) {
  if (input.stack !== 'nextjs') return finding(rule, 'not-applicable', 'The declared stack is not Next.js.');
  if (input.siteScope === 'unknown') return finding(rule, 'watch', 'Site scope is unknown, so the expected Next.js basePath cannot be established safely.', [input.site]);

  const expected = input.siteScope === 'subdirectory' ? expectedBasePath(input.site) : '';
  const observed = normalizeBasePath(input.nextjs?.basePath);
  if (observed !== expected) {
    return finding(rule, 'fail', `Next.js basePath is ${observed || '<root>'}, but the declared public site scope requires ${expected || '<root>'}.`, [input.site, `basePath=${observed || '<root>'}`]);
  }
  return finding(rule, 'pass', `Next.js basePath matches the declared public site scope (${expected || '<root>'}).`, [input.site, `basePath=${observed || '<root>'}`]);
}

function staticExportFinding(rule, input) {
  if (input.stack !== 'nextjs' || input.nextjs?.staticExport !== true) {
    return finding(rule, 'not-applicable', 'Next.js static export was not declared for this site.');
  }
  if (!Array.isArray(input.nextjs?.unsupportedFeatures)) {
    return finding(rule, 'watch', 'Static export is declared, but no explicit server-dependent feature inventory was supplied. Verify export compatibility before relying on static hosting.', [input.site]);
  }
  if (input.nextjs.unsupportedFeatures.length) {
    return finding(rule, 'fail', `Static export is declared, but server-dependent/unsupported feature(s) were reported: ${input.nextjs.unsupportedFeatures.join(', ')}.`, input.nextjs.unsupportedFeatures);
  }
  return finding(rule, 'pass', 'Static export is declared and the supplied unsupported-feature inventory is empty. A successful production build/final-artifact check is still required.', [input.site]);
}

function githubPagesPublicationFinding(rule, input) {
  if (input.provider !== 'github-pages') return finding(rule, 'not-applicable', 'The declared/inferred provider is not GitHub Pages.');
  const mode = input.publishing?.mode || 'unknown';
  const verified = input.publishing?.finalArtifactVerified;
  if (mode === 'unknown') {
    return finding(rule, 'watch', 'GitHub Pages publishing mode is unknown. Resolve branch publishing versus custom GitHub Actions before treating repository files as production evidence.', [input.site]);
  }
  if (!['github-actions', 'branch'].includes(mode)) {
    return finding(rule, 'fail', `Unsupported GitHub Pages publishing mode declaration: ${mode}.`, [mode]);
  }
  if (verified === false) {
    return finding(rule, 'fail', `GitHub Pages publishing mode is ${mode}, but the final published artifact was explicitly reported as unverified.`, [mode, input.site]);
  }
  if (verified !== true) {
    const cnameNote = input.publishing?.cnameObserved === true ? ' A CNAME file was observed, but it is not proof of the active custom-domain configuration.' : '';
    return finding(rule, 'watch', `GitHub Pages publishing mode is ${mode}, but the final artifact has not been verified.${cnameNote}`, [mode, input.site]);
  }
  return finding(rule, 'pass', `GitHub Pages publishing mode (${mode}) is explicit and the final artifact is marked verified.`, [mode, input.site]);
}

export function evaluateSearchPlatformEligibility(rawInput, { registry = loadSearchPlatformEligibilityRegistry() } = {}) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) throw new Error('input must be a JSON object');
  const site = normalizeSiteRoot(rawInput.site);
  const siteScope = ['hostname-root', 'subdirectory', 'unknown'].includes(rawInput.siteScope) ? rawInput.siteScope : 'unknown';
  const stack = ['nextjs', 'static', 'unknown'].includes(rawInput.stack) ? rawInput.stack : 'unknown';
  const provider = rawInput.provider || inferProvider(site);
  const input = {
    ...rawInput,
    site,
    siteScope,
    stack,
    provider,
    structuredDataTypes: Array.isArray(rawInput.structuredDataTypes) ? rawInput.structuredDataTypes : []
  };

  const rules = ruleMap(registry);
  const required = [
    'SPE-01-preferred-sources-scope',
    'SPE-02-google-indexing-api-scope',
    'SPE-03-nextjs-metadata-base',
    'SPE-04-nextjs-subpath-basepath',
    'SPE-05-nextjs-static-export-compatibility',
    'SPE-06-github-pages-publication-boundary'
  ];
  for (const id of required) if (!rules.has(id)) throw new Error(`missing Search Platform Eligibility rule ${id}`);

  const findings = [
    preferredSourcesFinding(rules.get(required[0]), input),
    indexingApiFinding(rules.get(required[1]), input),
    metadataBaseFinding(rules.get(required[2]), input),
    basePathFinding(rules.get(required[3]), input),
    staticExportFinding(rules.get(required[4]), input),
    githubPagesPublicationFinding(rules.get(required[5]), input)
  ];

  const summary = findings.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1;
    return acc;
  }, { pass: 0, fail: 0, watch: 0, 'not-applicable': 0 });

  return {
    version: SEARCH_PLATFORM_ELIGIBILITY_VERSION,
    reviewedAt: registry.reviewedAt,
    site,
    siteScope,
    provider,
    stack,
    summary,
    findings,
    guardrails: registry.guardrails,
    note: 'Search Platform Eligibility proves only bounded platform/scope configuration evidence. It does not prove indexing, ranking, citation, Preferred Sources selection, traffic or deployment correctness beyond the evidence supplied.'
  };
}

export function formatSearchPlatformEligibility(report) {
  const lines = [
    `ARWP Search Platform Eligibility ${report.version}`,
    `Site: ${report.site}`,
    `Scope: ${report.siteScope}`,
    `Provider: ${report.provider}`,
    `Stack: ${report.stack}`,
    `Findings: ${report.findings.length} (${report.summary.fail} fail, ${report.summary.watch} watch, ${report.summary.pass} pass, ${report.summary['not-applicable']} not-applicable)`,
    ''
  ];
  for (const item of report.findings) {
    lines.push(`${item.state.toUpperCase()} ${item.id} [${item.priority}]`);
    lines.push(`  ${item.message}`);
  }
  lines.push('', report.note);
  return lines.join('\n');
}
