import { analyzeSiteFocusRepository as analyzeRepositoryV1, analyzeSiteFocusSite as analyzeSiteV1, buildSiteFocusReportFromPages as buildFromPagesV1, formatSiteFocusReport as formatV1 } from './site-focus.mjs';
import { applySiteFocusIntent, findSiteFocusProfile, formatDeclaredSiteFocus, loadSiteFocusProfile } from './site-focus-intent.mjs';

export const SITE_FOCUS_VERSION = '0.2';

export function buildSiteFocusReportFromPages(input, options = {}) {
  const { focusProfile = null, focusProfileSource = null, ...baseOptions } = options;
  const base = buildFromPagesV1(input, baseOptions);
  return applySiteFocusIntent(base, focusProfile, { profileSource: focusProfileSource });
}

export function analyzeSiteFocusRepository(canonicalUrl, repoRoot, options = {}) {
  const { focusProfile = undefined, focusProfilePath = null, ...baseOptions } = options;
  const loaded = focusProfile === undefined
    ? findSiteFocusProfile(repoRoot, focusProfilePath)
    : { profile: focusProfile, source: focusProfilePath };
  const base = analyzeRepositoryV1(canonicalUrl, repoRoot, baseOptions);
  return applySiteFocusIntent(base, loaded.profile, { profileSource: loaded.source });
}

export async function analyzeSiteFocusSite(input, options = {}) {
  const { focusProfile = null, focusProfilePath = null, ...baseOptions } = options;
  const loaded = focusProfilePath ? loadSiteFocusProfile(focusProfilePath) : { profile: focusProfile, source: null };
  const base = await analyzeSiteV1(input, baseOptions);
  return applySiteFocusIntent(base, loaded.profile, { profileSource: loaded.source });
}

export function formatSiteFocusReport(report) {
  const declared = formatDeclaredSiteFocus(report);
  const base = formatV1(report);
  const roles = report.routeRoleSummary?.roles || {};
  const roleLine = report.declaredFocus ? `Declared route roles: ${Object.entries(roles).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}` : null;
  const drift = (report.siteFindings || []).filter(item => String(item.id).startsWith('declared-') || item.id === 'undeclared-primary-navigation' || item.id === 'unclassified-route-role');
  const driftLines = drift.length ? ['', 'Declared ↔ observed drift:', ...drift.map(item => `REVIEW ${item.id}: ${item.message}`)] : [];
  return [declared, roleLine, ...driftLines, '', base].filter(value => value != null).join('\n');
}
