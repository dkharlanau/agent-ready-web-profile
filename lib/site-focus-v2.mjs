import fs from 'node:fs';
import path from 'node:path';
import { analyzeSiteFocusRepository as analyzeRepositoryV1, analyzeSiteFocusSite as analyzeSiteV1, buildSiteFocusReportFromPages as buildFromPagesV1, formatSiteFocusReport as formatV1 } from './site-focus.mjs';
import { formatDeclaredSiteFocus } from './site-focus-intent.mjs';
import { applySiteFocusProfile, formatSiteFocusV3, SITE_FOCUS_LATEST_VERSION } from './site-focus-v3.mjs';

export const SITE_FOCUS_VERSION = SITE_FOCUS_LATEST_VERSION;

function readFocusProfile(file) {
  const resolved = path.resolve(file);
  const profile = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return { profile, source: resolved };
}

function findFocusProfile(repoRoot, explicitPath = null) {
  const base = path.resolve(repoRoot);
  const candidates = explicitPath
    ? [path.resolve(explicitPath)]
    : [path.join(base, '.arwp', 'site-focus.json'), path.join(base, 'site-focus.json')];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    return readFocusProfile(candidate);
  }
  return { profile: null, source: null };
}

export function buildSiteFocusReportFromPages(input, options = {}) {
  const { focusProfile = null, focusProfileSource = null, ...baseOptions } = options;
  const base = buildFromPagesV1(input, baseOptions);
  return applySiteFocusProfile(base, focusProfile, { profileSource: focusProfileSource });
}

export function analyzeSiteFocusRepository(canonicalUrl, repoRoot, options = {}) {
  const { focusProfile = undefined, focusProfilePath = null, ...baseOptions } = options;
  const loaded = focusProfile === undefined
    ? findFocusProfile(repoRoot, focusProfilePath)
    : { profile: focusProfile, source: focusProfilePath };
  const base = analyzeRepositoryV1(canonicalUrl, repoRoot, baseOptions);
  return applySiteFocusProfile(base, loaded.profile, { profileSource: loaded.source });
}

export async function analyzeSiteFocusSite(input, options = {}) {
  const { focusProfile = null, focusProfilePath = null, ...baseOptions } = options;
  const loaded = focusProfilePath ? readFocusProfile(focusProfilePath) : { profile: focusProfile, source: null };
  const base = await analyzeSiteV1(input, baseOptions);
  return applySiteFocusProfile(base, loaded.profile, { profileSource: loaded.source });
}

export function formatSiteFocusReport(report) {
  const declared = formatDeclaredSiteFocus(report);
  const experience = formatSiteFocusV3(report);
  const base = formatV1(report);
  const roles = report.routeRoleSummary?.roles || {};
  const roleLine = report.declaredFocus ? `Declared route roles: ${Object.entries(roles).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}` : null;
  const drift = (report.siteFindings || []).filter(item => String(item.id).startsWith('declared-') || item.id === 'undeclared-primary-navigation' || item.id === 'unclassified-route-role' || String(item.id).startsWith('homepage-') || String(item.id).startsWith('primary-navigation-') || String(item.id).startsWith('problem-lane-'));
  const driftLines = drift.length ? ['', 'Declared ↔ observed drift:', ...drift.map(item => `REVIEW ${item.id}: ${item.message}`)] : [];
  return [declared, roleLine, experience ? `\n${experience}` : null, ...driftLines, '', base].filter(value => value != null).join('\n');
}
