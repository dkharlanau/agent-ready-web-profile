import { scanSite } from './scanner.mjs';
import { readProfileSource, verifyProfileSource } from './verifier.mjs';

const GROUPS = ['web', 'data', 'retrieval', 'agentSkills', 'agentWeb', 'mcp', 'a2a', 'identity', 'trust'];

function groupForKey(key) {
  return GROUPS.find(group => key === group || key.startsWith(`${group}.`)) || 'other';
}

function declaredGroups(profile) {
  const out = {};
  for (const group of GROUPS) out[group] = profile?.[group] ? 'declared' : 'not-declared';
  return out;
}

export async function healthReport(siteUrl, {
  scanImpl = scanSite,
  verifyImpl = verifyProfileSource,
  readProfileImpl = readProfileSource,
  timeoutMs = 8000,
  maxBytes = 512 * 1024
} = {}) {
  const scan = await scanImpl(siteUrl, { timeoutMs, maxBytes });
  const report = {
    site: scan.canonicalUrl,
    observed: {
      evidence: scan.evidence,
      warnings: scan.warnings,
      capabilities: scan.capabilities
    },
    profile: {
      status: scan.existingProfile ? (scan.existingProfile.valid ? 'declared' : 'invalid') : 'not-detected',
      url: scan.existingProfile?.url || null,
      id: scan.existingProfile?.profileId || null
    },
    groups: {},
    resourceHealth: null
  };

  if (!scan.existingProfile?.valid) {
    for (const group of GROUPS) report.groups[group] = group === 'web' ? 'observed' : 'not-assessed';
    return report;
  }

  const [{ profile }, verification] = await Promise.all([
    readProfileImpl(scan.existingProfile.url, { timeoutMs }),
    verifyImpl(scan.existingProfile.url, { timeoutMs })
  ]);
  const states = declaredGroups(profile);
  const byGroup = new Map();
  for (const item of verification.resources || []) {
    const group = groupForKey(item.key);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(item);
  }

  for (const group of GROUPS) {
    if (states[group] === 'not-declared') {
      report.groups[group] = group === 'web' ? 'observed' : 'not-declared';
      continue;
    }
    const resources = byGroup.get(group) || [];
    if (!resources.length) report.groups[group] = 'declared';
    else if (resources.some(item => item.status === 'fail')) report.groups[group] = 'failing';
    else if (resources.some(item => item.status === 'warn')) report.groups[group] = 'warning';
    else report.groups[group] = 'verified';
  }

  report.profile.status = verification.valid ? 'verified' : 'failing';
  report.resourceHealth = {
    valid: verification.valid,
    summary: verification.summary,
    warnings: verification.warnings,
    resources: verification.resources
  };
  return report;
}

export function formatHealthReport(report) {
  const lines = [
    `Site: ${report.site}`,
    `ARWP profile: ${report.profile.status}${report.profile.url ? ` — ${report.profile.url}` : ''}`,
    '',
    'Capability health:'
  ];
  for (const [group, state] of Object.entries(report.groups)) lines.push(`  ${group.padEnd(12)} ${state}`);
  if (report.resourceHealth?.summary) {
    lines.push('', `Declared resources: ${report.resourceHealth.summary.pass} pass, ${report.resourceHealth.summary.warn} warn, ${report.resourceHealth.summary.fail} fail`);
  }
  if (report.observed.warnings?.length) {
    lines.push('', 'Scan warnings:');
    for (const warning of report.observed.warnings) lines.push(`  WARN ${warning}`);
  }
  return lines.join('\n');
}
