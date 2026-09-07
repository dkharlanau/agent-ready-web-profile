import { createHash } from 'node:crypto';
import { buildPortfolioRollout, loadPortfolioRegistry } from './portfolio-rollout.mjs';
import { loadTrendRegistry } from './trend-radar.mjs';

function csvTokens(value) {
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function findUnknownTargets(portfolio, requested) {
  return requested.filter(token => !portfolio.sites.some(site => site.id === token || site.repository === token)).sort();
}

function stableCandidate(candidate) {
  return {
    siteId: candidate.siteId,
    repository: candidate.repository,
    trendId: candidate.trendId,
    stage: candidate.stage,
    provider: candidate.provider,
    detectedAt: candidate.detectedAt,
    matchedVerticals: [...candidate.matchedVerticals],
    actionRefs: [...candidate.actionRefs],
    measurementRefs: [...candidate.measurementRefs],
    source: candidate.source,
    candidateType: candidate.candidateType,
    recommendationStatus: candidate.recommendationStatus
  };
}

function proposalIdFor(siteId, candidates) {
  const payload = JSON.stringify({
    siteId,
    candidates: candidates.map(stableCandidate)
  });
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return `arwp-portfolio-${siteId}-${digest}`;
}

function issueTitle(siteName, candidates) {
  return `ARWP: review ${candidates.length} Search/AI trend rollout candidate${candidates.length === 1 ? '' : 's'} for ${siteName}`;
}

function refsLine(label, refs) {
  return refs.length ? `  - ${label}: ${refs.map(ref => `\`${ref}\``).join(', ')}` : `  - ${label}: none`;
}

function issueBody(proposalId, site, candidates) {
  const lines = [
    '## ARWP portfolio rollout review',
    '',
    `Site: ${site.canonicalUrl}`,
    `Repository: \`${site.repository}\``,
    `Rollout mode: \`${site.rolloutMode}\``,
    `Proposal: \`${proposalId}\``,
    '',
    'This is a review artifact only. It does not authorize a GitHub write or any production change. Re-audit the live target before keeping an implementation action.',
    '',
    '### Trend candidates',
    ''
  ];

  for (const candidate of candidates) {
    lines.push(`- [ ] **${candidate.title}** (\`${candidate.trendId}\`, ${candidate.stage.toUpperCase()}, ${candidate.provider})`);
    lines.push(`  - primary source: ${candidate.source}`);
    lines.push(`  - matched verticals: ${candidate.matchedVerticals.join(', ')}`);
    lines.push(refsLine('Growth action refs', candidate.actionRefs));
    lines.push(refsLine('measurement refs', candidate.measurementRefs));
    lines.push(`  - next: ${candidate.suggestedNextStep}`);
  }

  lines.push(
    '',
    '### Required review boundary',
    '',
    '- Run the current ARWP Growth Profile against the deployed site.',
    '- Keep only actions that are still active for this target and supported by current evidence.',
    '- Treat authenticated provider controls and owner metrics as owner-side evidence, not crawler assumptions.',
    '- Record implementation and later before/after evidence as a Growth Experiment when applicable.',
    '- Do not infer ranking, recommendation, citation, traffic, or conversion gains from this proposal.',
    '',
    '### Delivery guardrail',
    '',
    '`githubMutationAllowed=false`; `productionMutationAllowed=false`; an explicit target-repository authorization is required for any later GitHub write.'
  );

  return lines.join('\n');
}

export function buildPortfolioProposals(
  portfolio = loadPortfolioRegistry(),
  trends = loadTrendRegistry(),
  options = {}
) {
  const rollout = buildPortfolioRollout(portfolio, trends, options);
  const requestedTargets = csvTokens(options.site);
  const unknownTargets = findUnknownTargets(portfolio, requestedTargets);
  const groups = new Map();
  const skipped = [...rollout.skipped];

  for (const candidate of rollout.candidates) {
    if (candidate.rolloutMode === 'observe-only') {
      skipped.push({ siteId: candidate.siteId, trendId: candidate.trendId, reason: 'observe-only-no-proposal' });
      continue;
    }
    if (!groups.has(candidate.siteId)) groups.set(candidate.siteId, []);
    groups.get(candidate.siteId).push(candidate);
  }

  const proposals = [];
  for (const [siteId, candidates] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [...candidates].sort((a, b) => a.stage.localeCompare(b.stage)
      || a.provider.localeCompare(b.provider)
      || a.trendId.localeCompare(b.trendId));
    const first = ordered[0];
    const site = {
      id: siteId,
      name: first.siteName,
      canonicalUrl: first.canonicalUrl,
      repository: first.repository,
      rolloutMode: first.rolloutMode
    };
    const proposalId = proposalIdFor(siteId, ordered);
    proposals.push({
      version: '0.1',
      proposalId,
      site,
      sourceTrendSnapshot: rollout.trendSnapshot,
      candidateCount: ordered.length,
      candidates: ordered.map(candidate => ({
        trendId: candidate.trendId,
        stage: candidate.stage,
        provider: candidate.provider,
        title: candidate.title,
        source: candidate.source,
        matchedVerticals: [...candidate.matchedVerticals],
        actionRefs: [...candidate.actionRefs],
        measurementRefs: [...candidate.measurementRefs],
        candidateType: candidate.candidateType,
        recommendationStatus: candidate.recommendationStatus,
        suggestedNextStep: candidate.suggestedNextStep
      })),
      suggestedIssue: {
        title: issueTitle(site.name, ordered),
        body: issueBody(proposalId, site, ordered)
      },
      delivery: {
        recommendedChannel: site.rolloutMode === 'managed-issue' ? 'managed-issue-review' : 'proposal-only-review',
        githubMutationAllowed: false,
        productionMutationAllowed: false,
        explicitTargetAuthorizationRequired: true,
        liveSiteAuditRequired: true,
        ownerReviewRequired: true
      }
    });
  }

  return {
    version: '0.1',
    generatedAt: rollout.generatedAt,
    portfolioUpdatedAt: rollout.portfolioUpdatedAt,
    sourceTrendSnapshot: rollout.trendSnapshot,
    filters: rollout.filters,
    summary: {
      proposals: proposals.length,
      candidates: proposals.reduce((sum, proposal) => sum + proposal.candidateCount, 0),
      unknownTargets: unknownTargets.length,
      byMode: proposals.reduce((acc, proposal) => {
        acc[proposal.site.rolloutMode] = (acc[proposal.site.rolloutMode] || 0) + 1;
        return acc;
      }, {})
    },
    proposals,
    unknownTargets,
    skipped,
    guardrails: {
      ownerControlledEvidence: true,
      watchRequiresExplicitOptIn: true,
      liveSiteAuditRequired: true,
      githubMutationAllowed: false,
      productionMutationAllowed: false,
      explicitTargetAuthorizationRequired: true,
      unknownTargetsAreReportedNotForced: true,
      noRankingInference: true
    },
    note: 'Portfolio proposals are deterministic review artifacts derived from Trend Radar mapping. They do not create issues, edit repositories, apply production changes, or prove Search/AI gains.'
  };
}

export function formatPortfolioProposals(bundle) {
  const lines = [
    `ARWP portfolio proposals — ${bundle.generatedAt}`,
    `Proposals: ${bundle.summary.proposals}; candidates: ${bundle.summary.candidates}`,
    ''
  ];

  for (const proposal of bundle.proposals) {
    lines.push(`${proposal.site.name} — ${proposal.site.repository} [${proposal.site.rolloutMode}]`);
    lines.push(`  ${proposal.proposalId}`);
    lines.push(`  ${proposal.suggestedIssue.title}`);
  }

  if (bundle.unknownTargets.length) {
    lines.push('', `Unknown targets: ${bundle.unknownTargets.join(', ')}`);
  }
  if (!bundle.proposals.length) lines.push('No target-specific proposals for the selected filters.');
  lines.push('', bundle.note);
  return lines.join('\n');
}
