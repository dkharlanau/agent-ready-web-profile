import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'earned-discovery-practices.json');

export const EARNED_DISCOVERY_VERSION = '0.1';

const CHANNEL_KINDS = new Set([
  'community',
  'social',
  'newsletter',
  'word-of-mouth',
  'advertising',
  'sponsorship',
  'partner',
  'directory',
  'forum',
  'press',
  'other'
]);
const PAID_QUALIFICATIONS = new Set(['sponsored', 'nofollow']);

export function loadEarnedDiscoveryRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function normalizeUrl(value, label) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error(`${label} must be a valid URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use HTTP(S)`);
  url.hash = '';
  return url.href;
}

function ruleMap(registry) {
  return new Map((registry.rules || []).map(rule => [rule.id, rule]));
}

function sourceUrls(rule, registry) {
  return (rule.sources || []).map(id => registry.sources?.[id]).filter(Boolean);
}

function finding(rule, registry, state, message, evidence = []) {
  return {
    id: rule.id,
    priority: rule.priority,
    state,
    claim: rule.claim,
    decision: rule.decision,
    message,
    sources: sourceUrls(rule, registry),
    evidence
  };
}

function normalizeChannels(rawChannels) {
  if (rawChannels == null) return [];
  if (!Array.isArray(rawChannels)) throw new Error('channels must be an array');
  return rawChannels.map((channel, index) => {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) throw new Error(`channels[${index}] must be an object`);
    const kind = String(channel.kind || '').trim();
    if (!CHANNEL_KINDS.has(kind)) throw new Error(`channels[${index}].kind is unsupported: ${kind || '<empty>'}`);
    return {
      id: channel.id || `${kind}-${index + 1}`,
      kind,
      name: channel.name ? String(channel.name) : null,
      audienceFit: channel.audienceFit,
      paid: channel.paid === true,
      linkPossible: channel.linkPossible !== false,
      linkQualification: channel.linkQualification || null,
      linkGoal: channel.linkGoal || 'audience',
      requiresReciprocalLink: channel.requiresReciprocalLink === true,
      automatedPosting: channel.automatedPosting === true,
      notes: channel.notes ? String(channel.notes) : null
    };
  });
}

function normalizeMeasurements(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('measurements must be an array');
  return [...new Set(value.map(item => String(item).trim()).filter(Boolean))];
}

function assetFinding(rule, registry, asset) {
  if (asset.originalContribution === false || asset.evidenceVisible === false) {
    return finding(rule, registry, 'fail', 'The asset is explicitly declared non-original or without visible supporting evidence. Improve the asset before planning earned distribution.', [asset.url]);
  }
  if (asset.originalContribution !== true || asset.evidenceVisible !== true) {
    return finding(rule, registry, 'watch', 'Original contribution and visible supporting evidence are not both confirmed. Review the asset before treating distribution as ready work.', [asset.url]);
  }
  return finding(rule, registry, 'pass', 'The asset explicitly declares an original contribution and visible supporting evidence. This is a distribution precondition, not a Search ranking claim.', [asset.url, asset.kind]);
}

function channelClassifications(channels) {
  return channels.map(channel => {
    const reasons = [];
    let state = 'eligible';

    if (channel.audienceFit === false) {
      state = 'blocked';
      reasons.push('audience-fit-false');
    } else if (channel.audienceFit !== true) {
      state = 'watch';
      reasons.push('audience-fit-unknown');
    }
    if (channel.linkGoal === 'ranking') {
      state = 'blocked';
      reasons.push('ranking-link-goal');
    }
    if (channel.requiresReciprocalLink) {
      state = 'blocked';
      reasons.push('required-reciprocal-link');
    }
    if (channel.automatedPosting) {
      state = 'blocked';
      reasons.push('automated-posting');
    }
    if (channel.paid && channel.linkPossible && !PAID_QUALIFICATIONS.has(channel.linkQualification)) {
      state = 'blocked';
      reasons.push('unqualified-paid-link');
    }

    return { ...channel, state, reasons };
  });
}

function audienceFitFinding(rule, registry, channels) {
  if (!channels.length) return finding(rule, registry, 'watch', 'No distribution channels were declared. Add only channels where the intended audience is actually present.');
  const eligible = channels.filter(channel => channel.audienceFit === true).length;
  const unknown = channels.filter(channel => channel.audienceFit !== true && channel.audienceFit !== false).length;
  if (!eligible) {
    return finding(rule, registry, unknown ? 'watch' : 'fail', unknown
      ? 'No channel has confirmed audience fit yet. Validate the audience before outreach.'
      : 'All declared channels are explicitly outside the intended audience. Do not distribute for volume alone.', channels.map(channel => channel.id));
  }
  return finding(rule, registry, unknown ? 'watch' : 'pass', `${eligible}/${channels.length} declared channel(s) have explicit audience fit${unknown ? `; ${unknown} still require review` : ''}.`, channels.filter(channel => channel.audienceFit === true).map(channel => channel.id));
}

function manipulationFinding(rule, registry, channels, automation, reciprocalLinkRequirement) {
  const evidence = [];
  if (automation.massLinkCreation === true) evidence.push('massLinkCreation');
  if (automation.bulkForumPosting === true) evidence.push('bulkForumPosting');
  if (reciprocalLinkRequirement === true) evidence.push('globalReciprocalLinkRequirement');
  for (const channel of channels) {
    if (channel.linkGoal === 'ranking') evidence.push(`${channel.id}:ranking-link-goal`);
    if (channel.requiresReciprocalLink) evidence.push(`${channel.id}:required-reciprocal-link`);
  }
  if (evidence.length) return finding(rule, registry, 'fail', 'The plan contains a link-manipulation tactic. Remove ranking-targeted link acquisition, automated link creation and required reciprocal links.', evidence);
  return finding(rule, registry, 'pass', 'No ranking-targeted link acquisition or required reciprocal-link tactic was declared.');
}

function paidFinding(rule, registry, channels) {
  const paid = channels.filter(channel => channel.paid && channel.linkPossible);
  if (!paid.length) return finding(rule, registry, 'not-applicable', 'No paid/sponsored link-bearing distribution channel was declared.');
  const unqualified = paid.filter(channel => !PAID_QUALIFICATIONS.has(channel.linkQualification));
  if (unqualified.length) {
    return finding(rule, registry, 'fail', 'Paid/sponsored link-bearing channels must use sponsored or nofollow qualification; paid placement is distribution, not earned authority.', unqualified.map(channel => channel.id));
  }
  return finding(rule, registry, 'pass', 'All declared paid/sponsored link-bearing channels use sponsored or nofollow qualification. They remain paid distribution rather than earned authority.', paid.map(channel => `${channel.id}:${channel.linkQualification}`));
}

function scaledFinding(rule, registry, channels, automation) {
  const evidence = [];
  if (automation.massLinkCreation === true) evidence.push('massLinkCreation');
  if (automation.bulkForumPosting === true) evidence.push('bulkForumPosting');
  for (const channel of channels) if (channel.automatedPosting) evidence.push(`${channel.id}:automated-posting`);
  if (evidence.length) return finding(rule, registry, 'fail', 'Mass automated posting/link creation is outside the Earned Discovery contract. Use selective audience-fit distribution around the canonical useful asset.', evidence);
  return finding(rule, registry, 'pass', 'No mass automated posting/link-creation tactic was declared.');
}

function measurementFinding(rule, registry, measurements) {
  if (!measurements.length) return finding(rule, registry, 'watch', 'No outcome measurement was declared. Track audience outcomes rather than outreach attempts or backlink counts.');
  const suspicious = measurements.filter(metric => /backlink|outreach.?count|messages.?sent/i.test(metric));
  if (suspicious.length === measurements.length) {
    return finding(rule, registry, 'fail', 'The measurement plan contains only activity/backlink-count metrics. Add audience or owner-observed outcomes before calling this an experiment.', suspicious);
  }
  return finding(rule, registry, suspicious.length ? 'watch' : 'pass', suspicious.length
    ? 'Outcome measurements exist, but activity/backlink-count metrics are also present and must not be interpreted as Search impact.'
    : 'The plan declares audience/outcome measurements. Preserve uncertainty and do not infer ranking causality from a single observation.', measurements);
}

export function planEarnedDiscovery(rawInput, { registry = loadEarnedDiscoveryRegistry() } = {}) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) throw new Error('input must be a JSON object');
  const site = normalizeUrl(rawInput.site, 'site');
  if (!rawInput.asset || typeof rawInput.asset !== 'object' || Array.isArray(rawInput.asset)) throw new Error('asset must be an object');
  const asset = {
    url: normalizeUrl(rawInput.asset.url, 'asset.url'),
    kind: String(rawInput.asset.kind || 'other'),
    originalContribution: rawInput.asset.originalContribution,
    evidenceVisible: rawInput.asset.evidenceVisible,
    audience: rawInput.asset.audience ? String(rawInput.asset.audience) : null
  };
  const channels = normalizeChannels(rawInput.channels);
  const automation = rawInput.automation && typeof rawInput.automation === 'object' && !Array.isArray(rawInput.automation)
    ? rawInput.automation
    : {};
  const measurements = normalizeMeasurements(rawInput.measurements);
  const rules = ruleMap(registry);
  const ids = [
    'ED-01-promotable-asset',
    'ED-02-audience-channel-fit',
    'ED-03-link-manipulation-boundary',
    'ED-04-paid-link-qualification',
    'ED-05-scaled-promotion-boundary',
    'ED-06-outcome-measurement'
  ];
  for (const id of ids) if (!rules.has(id)) throw new Error(`missing Earned Discovery rule ${id}`);

  const classifiedChannels = channelClassifications(channels);
  const findings = [
    assetFinding(rules.get(ids[0]), registry, asset),
    audienceFitFinding(rules.get(ids[1]), registry, channels),
    manipulationFinding(rules.get(ids[2]), registry, channels, automation, rawInput.reciprocalLinkRequirement),
    paidFinding(rules.get(ids[3]), registry, channels),
    scaledFinding(rules.get(ids[4]), registry, channels, automation),
    measurementFinding(rules.get(ids[5]), registry, measurements)
  ];
  const summary = findings.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1;
    return acc;
  }, { pass: 0, fail: 0, watch: 0, 'not-applicable': 0 });
  const measurementState = findings.find(item => item.id === 'ED-06-outcome-measurement')?.state;
  const ready = summary.fail === 0
    && findings[0].state === 'pass'
    && measurementState === 'pass'
    && classifiedChannels.some(channel => channel.state === 'eligible');

  return {
    version: EARNED_DISCOVERY_VERSION,
    reviewedAt: registry.reviewedAt,
    site,
    asset,
    summary,
    ready,
    findings,
    channels: {
      eligible: classifiedChannels.filter(channel => channel.state === 'eligible'),
      watch: classifiedChannels.filter(channel => channel.state === 'watch'),
      blocked: classifiedChannels.filter(channel => channel.state === 'blocked')
    },
    measurementPlan: measurements,
    suggestedOutcomeMetrics: [
      'qualified-referral-visits',
      'returning-or-subscribed-readers',
      'legitimate-editorial-citations-or-references',
      'direct-or-brand-demand',
      'owner-observed-search-or-ai-visibility'
    ],
    guardrails: registry.guardrails,
    note: 'Earned Discovery plans audience distribution around a useful asset. It does not authorize spam outreach, automated link building, paid-link authority claims or causal ranking claims.'
  };
}

export function formatEarnedDiscovery(report) {
  const lines = [
    `ARWP Earned Discovery ${report.version}`,
    `Site: ${report.site}`,
    `Asset: ${report.asset.url}`,
    `Ready: ${report.ready ? 'yes' : 'no'}`,
    `Findings: ${report.findings.length} (${report.summary.fail} fail, ${report.summary.watch} watch, ${report.summary.pass} pass, ${report.summary['not-applicable']} not-applicable)`,
    ''
  ];
  for (const item of report.findings) {
    lines.push(`${item.state.toUpperCase()} ${item.id} [${item.priority}]`);
    lines.push(`  ${item.message}`);
  }
  if (report.channels.eligible.length) {
    lines.push('', 'Eligible channels:');
    for (const channel of report.channels.eligible) lines.push(`- ${channel.id} (${channel.kind})`);
  }
  if (report.channels.watch.length) {
    lines.push('', 'Channels requiring review:');
    for (const channel of report.channels.watch) lines.push(`- ${channel.id}: ${channel.reasons.join(', ')}`);
  }
  if (report.channels.blocked.length) {
    lines.push('', 'Blocked channels/tactics:');
    for (const channel of report.channels.blocked) lines.push(`- ${channel.id}: ${channel.reasons.join(', ')}`);
  }
  lines.push('', report.note);
  return lines.join('\n');
}
