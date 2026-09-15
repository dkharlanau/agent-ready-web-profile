import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEarnedDiscoveryRegistry, planEarnedDiscovery } from '../lib/earned-discovery.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = loadEarnedDiscoveryRegistry();

assert.equal(registry.version, '0.1');
assert.equal(registry.reviewedAt, '2026-09-15');
assert.equal(registry.guardrails.noRankingPromise, true);
assert.equal(registry.guardrails.noBacklinkScore, true);
assert.equal(registry.guardrails.noAutomatedLinkBuilding, true);
assert.equal(registry.guardrails.noPaidLinkAuthorityClaim, true);
assert.equal(registry.rules.length, 6);
assert.equal(new Set(registry.rules.map(rule => rule.id)).size, 6);
for (const rule of registry.rules) {
  assert.match(rule.id, /^ED-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(rule.priority));
  assert.ok(rule.claim.length > 40);
  assert.ok(rule.decision.length > 40);
  assert.ok(Array.isArray(rule.sources) && rule.sources.length > 0);
  for (const source of rule.sources) assert.ok(registry.sources[source], `${rule.id} references unknown source ${source}`);
}

function finding(report, id) {
  const result = report.findings.find(item => item.id === id);
  assert.ok(result, `missing finding ${id}`);
  return result;
}

const good = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: {
    url: 'https://example.com/research/microphone-test/',
    kind: 'research',
    originalContribution: true,
    evidenceVisible: true,
    audience: 'people comparing microphones'
  },
  channels: [
    { id: 'community-a', kind: 'community', audienceFit: true, paid: false, linkGoal: 'audience' },
    { id: 'newsletter-owned', kind: 'newsletter', audienceFit: true, paid: false, linkPossible: false },
    { id: 'sponsor-a', kind: 'sponsorship', audienceFit: true, paid: true, linkQualification: 'sponsored' }
  ],
  measurements: ['qualified-referral-visits', 'returning-or-subscribed-readers'],
  automation: { massLinkCreation: false, bulkForumPosting: false }
});
assert.equal(good.ready, true);
assert.equal(good.summary.fail, 0);
assert.equal(finding(good, 'ED-01-promotable-asset').state, 'pass');
assert.equal(finding(good, 'ED-02-audience-channel-fit').state, 'pass');
assert.equal(finding(good, 'ED-03-link-manipulation-boundary').state, 'pass');
assert.equal(finding(good, 'ED-04-paid-link-qualification').state, 'pass');
assert.equal(finding(good, 'ED-05-scaled-promotion-boundary').state, 'pass');
assert.equal(finding(good, 'ED-06-outcome-measurement').state, 'pass');
assert.equal(good.channels.eligible.length, 3);
assert.match(good.note, /does not authorize spam outreach/i);

const weakAsset = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/thin/', originalContribution: false, evidenceVisible: true },
  channels: [{ kind: 'social', audienceFit: true }],
  measurements: ['qualified-referral-visits']
});
assert.equal(weakAsset.ready, false);
assert.equal(finding(weakAsset, 'ED-01-promotable-asset').state, 'fail');

const unknownAsset = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/guide/' },
  channels: [{ kind: 'community', audienceFit: true }],
  measurements: ['qualified-referral-visits']
});
assert.equal(unknownAsset.ready, false);
assert.equal(finding(unknownAsset, 'ED-01-promotable-asset').state, 'watch');

const spam = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/tool/', originalContribution: true, evidenceVisible: true },
  channels: [
    { id: 'forum-bulk', kind: 'forum', audienceFit: true, linkGoal: 'ranking', automatedPosting: true },
    { id: 'partner-swap', kind: 'partner', audienceFit: true, requiresReciprocalLink: true }
  ],
  measurements: ['backlink-count'],
  automation: { massLinkCreation: true, bulkForumPosting: true },
  reciprocalLinkRequirement: true
});
assert.equal(spam.ready, false);
assert.equal(finding(spam, 'ED-03-link-manipulation-boundary').state, 'fail');
assert.equal(finding(spam, 'ED-05-scaled-promotion-boundary').state, 'fail');
assert.equal(finding(spam, 'ED-06-outcome-measurement').state, 'fail');
assert.equal(spam.channels.blocked.length, 2);

const unqualifiedPaid = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/data/', originalContribution: true, evidenceVisible: true },
  channels: [{ id: 'paid-native', kind: 'advertising', audienceFit: true, paid: true, linkQualification: 'none' }],
  measurements: ['qualified-referral-visits']
});
assert.equal(unqualifiedPaid.ready, false);
assert.equal(finding(unqualifiedPaid, 'ED-04-paid-link-qualification').state, 'fail');
assert.ok(unqualifiedPaid.channels.blocked.some(channel => channel.id === 'paid-native'));

const paidNoLink = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/report/', originalContribution: true, evidenceVisible: true },
  channels: [{ id: 'offline-ad', kind: 'advertising', audienceFit: true, paid: true, linkPossible: false }],
  measurements: ['direct-or-brand-demand']
});
assert.equal(finding(paidNoLink, 'ED-04-paid-link-qualification').state, 'not-applicable');
assert.equal(paidNoLink.ready, true);

const missingMeasurement = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/benchmark/', originalContribution: true, evidenceVisible: true },
  channels: [{ kind: 'community', audienceFit: true }]
});
assert.equal(finding(missingMeasurement, 'ED-06-outcome-measurement').state, 'watch');
assert.equal(missingMeasurement.ready, false, 'a distribution plan without outcome measurement must not be ready');

const mixedMeasurement = planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/benchmark/', originalContribution: true, evidenceVisible: true },
  channels: [{ kind: 'community', audienceFit: true }],
  measurements: ['qualified-referral-visits', 'backlink-count']
});
assert.equal(finding(mixedMeasurement, 'ED-06-outcome-measurement').state, 'watch');
assert.equal(mixedMeasurement.ready, false, 'watch measurement state must keep ready false');

assert.throws(() => planEarnedDiscovery({
  site: 'https://example.com/',
  asset: { url: 'https://example.com/x', originalContribution: true, evidenceVisible: true },
  channels: [{ kind: 'unknown-network', audienceFit: true }]
}), /unsupported/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-earned-discovery-'));
try {
  const goodPath = path.join(tmp, 'good.json');
  fs.writeFileSync(goodPath, JSON.stringify({
    site: 'https://example.com/',
    asset: { url: 'https://example.com/research/', originalContribution: true, evidenceVisible: true },
    channels: [{ kind: 'community', audienceFit: true }],
    measurements: ['qualified-referral-visits']
  }));
  const goodCli = spawnSync(process.execPath, ['bin/arwp-earned-discovery.mjs', 'plan', goodPath, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(goodCli.status, 0, goodCli.stderr);
  assert.equal(JSON.parse(goodCli.stdout).ready, true);

  const badPath = path.join(tmp, 'bad.json');
  fs.writeFileSync(badPath, JSON.stringify({
    site: 'https://example.com/',
    asset: { url: 'https://example.com/research/', originalContribution: true, evidenceVisible: true },
    channels: [{ kind: 'forum', audienceFit: true, automatedPosting: true, linkGoal: 'ranking' }],
    measurements: ['backlink-count'],
    automation: { massLinkCreation: true }
  }));
  const badCli = spawnSync(process.execPath, ['bin/arwp-earned-discovery.mjs', 'plan', badPath, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(badCli.status, 1, badCli.stderr);
  assert.ok(JSON.parse(badCli.stdout).summary.fail >= 2);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('PASS Earned Discovery requires a promotable asset and outcome measurement, preserves audience fit, qualifies paid links, and blocks manipulative/automated link acquisition.');
