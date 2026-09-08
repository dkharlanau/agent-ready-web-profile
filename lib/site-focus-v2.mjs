import { analyzeSiteFocusRepository as analyzeRepositoryV1, analyzeSiteFocusSite as analyzeSiteV1, buildSiteFocusReportFromPages as buildFromPagesV1, formatSiteFocusReport as formatV1 } from './site-focus.mjs';
import { findSiteFocusProfile, formatDeclaredSiteFocus, loadSiteFocusProfile } from './site-focus-intent.mjs';
import { applySiteFocusProfile, formatSiteFocusV3, SITE_FOCUS_LATEST_VERSION } from './site-focus-v3.mjs';

export const SITE_FOCUS_VERSION = SITE_FOCUS_LATEST_VERSION;

export function buildSiteFocusReportFromPages(input, options = {}) {
  const { focusProfile = null, focusProfileSource = null, ...baseOptions } = options;
  const base = buildFromPagesV1(input, baseOptions);
  return applySiteFocusProfile(base, focusProfile, { profileSource: focusProfileSource });
}

export function analyzeSiteFocusRepository(canonicalUrl, repoRoot, options = {}) {
  const { focusProfile = undefined, focusProfilePath = null, ...baseOptions } = options;
  const loaded = focusProfile === undefined
    ? findSiteFocusProfile(repoRoot, focusProfilePath)
    : { profile: focusProfile, source: focusProfilePath };
  const base = analyzeRepositoryV1(canonicalUrl, repoRoot, baseOptions);
  return applySiteFocusProfile(base, loaded.profile, { profileSource: loaded.source });
}

export async function analyzeSiteFocusSite(input, options = {}) {
  const { focusProfile = null, focusProfilePath = null, ...baseOptions } = options;
  const loaded = focusProfilePath ? loadSiteFocusProfile(focusProfilePath) : { profile: focusProfile, source: null };
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
