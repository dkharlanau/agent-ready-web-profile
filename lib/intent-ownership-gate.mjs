import { buildIntentOwnershipReport } from './intent-ownership.mjs';

export const INTENT_OWNERSHIP_GATE_VERSION = '0.1';

export function evaluateIntentOwnershipGate(ledger) {
  const report = buildIntentOwnershipReport(ledger);
  const served = report.families.filter(family => family.intentDisposition === 'serve');
  const failures = served
    .filter(family => family.ownershipState !== 'owned')
    .map(family => ({
      id: family.id,
      label: family.label,
      locale: family.locale,
      ownershipState: family.ownershipState,
      ownerUrls: family.ownerUrls,
      attention: family.attention.map(item => item.code)
    }));

  return {
    version: INTENT_OWNERSHIP_GATE_VERSION,
    kind: 'intent-ownership-gate',
    site: report.site,
    reviewedAt: report.reviewedAt,
    requirement: 'every served intent family has exactly one owner observed as indexable',
    valid: failures.length === 0,
    summary: {
      servedFamilyCount: served.length,
      declinedFamilyCount: report.summary.byState.declined,
      ownedServedFamilyCount: served.filter(family => family.ownershipState === 'owned').length,
      failingServedFamilyCount: failures.length,
      byState: report.summary.byState
    },
    failures,
    boundaries: {
      technicalOwnershipGateOnly: true,
      actualGoogleIndexingProven: false,
      rankingOrCitationProven: false,
      deploymentCommitProven: false,
      productionMutationAuthorized: false
    }
  };
}
