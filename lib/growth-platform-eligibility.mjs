import { evaluateSearchPlatformEligibility } from './search-platform-eligibility.mjs';

const VALID_SITE_SCOPES = new Set(['hostname-root', 'subdirectory', 'unknown']);

function normalizeSiteScope(value) {
  return VALID_SITE_SCOPES.has(value) ? value : 'unknown';
}

function summarize(actions) {
  return actions.reduce((acc, item) => {
    acc.totalActions += 1;
    acc.byPriority[item.priority] = (acc.byPriority[item.priority] || 0) + 1;
    acc.byLane[item.lane] = (acc.byLane[item.lane] || 0) + 1;
    return acc;
  }, { totalActions: 0, byPriority: {}, byLane: {} });
}

export function applySearchPlatformEligibilityToGrowthPlan(plan, { siteScope = 'unknown' } = {}) {
  if (!plan || !Array.isArray(plan.actions) || !plan.canonicalUrl) throw new Error('A Growth plan with canonicalUrl and actions is required.');
  const normalizedScope = normalizeSiteScope(siteScope);
  const report = evaluateSearchPlatformEligibility({
    site: plan.canonicalUrl,
    siteScope: normalizedScope,
    stack: 'unknown'
  });
  const preferred = report.findings.find(item => item.id === 'SPE-01-preferred-sources-scope');
  if (!preferred) throw new Error('Search Platform Eligibility did not return the Preferred Sources scope finding.');

  let preferredSourcesDisposition = 'eligible';
  let actions = plan.actions;
  if (preferred.state === 'not-applicable' || preferred.state === 'fail') {
    actions = actions.filter(item => item.id !== 'growth:preferred-source-acquisition');
    preferredSourcesDisposition = preferred.state === 'fail' ? 'blocked-scope-conflict' : 'not-applicable';
  } else if (preferred.state === 'watch') {
    actions = actions.map(item => item.id === 'growth:preferred-source-acquisition'
      ? {
          ...item,
          status: 'watch',
          title: 'Classify hostname scope before adding a Preferred Sources CTA',
          reason: preferred.message,
          implementation: {
            note: 'Set siteScope=hostname-root only when the supplied public site root is the actual hostname root. Do not treat an independent subdirectory as a selectable Preferred Source.'
          }
        }
      : item);
    preferredSourcesDisposition = 'scope-review-required';
  }

  return {
    ...plan,
    actions,
    summary: summarize(actions),
    observations: {
      ...(plan.observations || {}),
      searchPlatformEligibility: {
        version: report.version,
        siteScope: report.siteScope,
        provider: report.provider,
        preferredSources: preferred
      }
    },
    refinements: {
      ...(plan.refinements || {}),
      searchPlatformEligibilityVersion: report.version,
      preferredSourcesDisposition,
      preferredSourcesScopeExplicit: normalizedScope !== 'unknown'
    }
  };
}
