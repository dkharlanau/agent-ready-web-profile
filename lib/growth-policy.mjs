import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const verticalRegistry = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'growth-verticals.json'), 'utf8'));
const SITE_CLASSES = new Set(Object.keys(verticalRegistry.verticals));

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

export function validateGrowthPolicy(policy) {
  const issues = [];
  if (!object(policy)) return { valid: false, issues: ['Growth Policy must be an object.'] };
  if (policy.policyVersion !== '0.1') issues.push('policyVersion must be 0.1.');
  try {
    const target = new URL(policy.target);
    if (target.protocol !== 'https:') issues.push('target must be a public HTTPS URL.');
  } catch {
    issues.push('target must be a valid URL.');
  }
  if (!SITE_CLASSES.has(policy.siteClass)) issues.push(`siteClass must be one of: ${[...SITE_CLASSES].join(', ')}.`);
  if (!object(policy.goals)) issues.push('goals is required.');
  else for (const key of ['googleSearch', 'googleGenerativeSearch', 'chatgptSearch']) if (typeof policy.goals[key] !== 'boolean') issues.push(`goals.${key} must be boolean.`);
  const usage = policy.aiUsagePolicy || {};
  if (usage.modelTraining && !['allow', 'deny', 'unspecified'].includes(usage.modelTraining)) issues.push('aiUsagePolicy.modelTraining is invalid.');
  if (usage.realTimeAiInput && !['allow', 'deny', 'unspecified'].includes(usage.realTimeAiInput)) issues.push('aiUsagePolicy.realTimeAiInput is invalid.');
  if (usage.contentReuse && !['immediate', 'reference', 'full', 'unspecified'].includes(usage.contentReuse)) issues.push('aiUsagePolicy.contentReuse is invalid.');
  if (policy.preferredSources?.domain && !/^[a-z0-9.-]+$/i.test(policy.preferredSources.domain)) issues.push('preferredSources.domain must be a domain/subdomain without path.');
  return { valid: issues.length === 0, issues };
}

function contentSignal(policy) {
  const usage = policy.aiUsagePolicy || {};
  if (!bool(usage.emitCloudflareContentSignals)) return null;
  const tokens = [];
  if (policy.goals?.googleSearch !== false) tokens.push('search=yes');
  else tokens.push('search=no');
  const aiInput = usage.realTimeAiInput === 'allow' ? 'yes' : usage.realTimeAiInput === 'deny' ? 'no' : null;
  if (aiInput) tokens.push(`ai-input=${aiInput}`);
  const train = usage.modelTraining === 'allow' ? 'yes' : usage.modelTraining === 'deny' ? 'no' : null;
  if (train) tokens.push(`ai-train=${train}`);
  if (usage.contentReuse && usage.contentReuse !== 'unspecified') tokens.push(`use=${usage.contentReuse}`);
  return tokens.length ? `Content-Signal: ${tokens.join(', ')}` : null;
}

function robotsIntent(policy) {
  const lines = ['User-agent: *', 'Allow: /'];
  const signal = contentSignal(policy);
  if (signal) lines.push(signal);
  if (policy.goals?.chatgptSearch) lines.push('', 'User-agent: OAI-SearchBot', 'Allow: /');
  if (policy.aiUsagePolicy?.modelTraining === 'deny') lines.push('', 'User-agent: GPTBot', 'Disallow: /');
  else if (policy.aiUsagePolicy?.modelTraining === 'allow') lines.push('', 'User-agent: GPTBot', 'Allow: /');
  return `${lines.join('\n')}\n`;
}

function actionRelevant(action, policy) {
  const id = String(action?.id || '');
  if (!policy.goals?.chatgptSearch && id.includes('openai-oai-searchbot')) return false;
  if (!policy.goals?.googleGenerativeSearch && id.includes('google-generative-ai')) return false;
  if (policy.goals?.bingAi === false && id.includes('bing-ai')) return false;
  if (!policy.preferredSources?.enabled && id.includes('preferred-source')) return false;
  if (policy.measurement?.socialVideoProperties === false && id.includes('platform-properties')) return false;
  return true;
}

function desiredStructuredData(policy) {
  const vertical = verticalRegistry.verticals[policy.siteClass] || verticalRegistry.verticals.general;
  const identity = policy.identity || {};
  return {
    verticalRecommended: vertical.recommendedStructuredData,
    publisherType: identity.publisherType || 'unspecified',
    requireSameAs: bool(identity.requireSameAs, true),
    requireAuthorProfiles: bool(identity.requireAuthorProfiles, false)
  };
}

export function compileGrowthPolicy(plan, policy) {
  const validation = validateGrowthPolicy(policy);
  if (!validation.valid) throw new Error(`Invalid Growth Policy: ${validation.issues.join(' ')}`);
  if (!object(plan) || !Array.isArray(plan.actions)) throw new Error('A Growth Profile plan with actions is required.');
  const target = new URL(policy.target);
  const planTarget = new URL(plan.canonicalUrl || policy.target);
  if (target.hostname !== planTarget.hostname) throw new Error(`Growth Policy target host ${target.hostname} does not match plan host ${planTarget.hostname}.`);
  const vertical = verticalRegistry.verticals[policy.siteClass];
  const actions = plan.actions.filter(item => actionRelevant(item, policy));
  const preferredDomain = policy.preferredSources?.domain || target.hostname;
  return {
    implementationVersion: '0.1',
    policyVersion: policy.policyVersion,
    target: policy.target,
    siteClass: policy.siteClass,
    vertical,
    goals: policy.goals,
    desiredState: {
      robotsIntent: robotsIntent(policy),
      contentSignal: contentSignal(policy),
      structuredData: desiredStructuredData(policy),
      preferredSourcesUrl: policy.preferredSources?.enabled ? `https://www.google.com/preferences/source?q=${preferredDomain}` : null,
      measurement: {
        googleSearchConsole: policy.measurement?.googleSearchConsole !== false,
        googleGenerativeAi: bool(policy.measurement?.googleGenerativeAi, bool(policy.goals?.googleGenerativeSearch)),
        bingAiPerformance: bool(policy.measurement?.bingAiPerformance, policy.goals?.bingAi !== false),
        socialVideoProperties: bool(policy.measurement?.socialVideoProperties, false)
      }
    },
    actions,
    excludedActions: plan.actions.filter(item => !actionRelevant(item, policy)).map(item => ({ id: item.id, reason: 'not selected by owner Growth Policy goals' })),
    guardrails: {
      ownerPolicyIsIntentNotPlatformGuarantee: true,
      noRankingGuarantee: true,
      noAiRecommendationGuarantee: true,
      providerSpecificSyntaxRemainsProviderSpecific: true,
      robotsOutputMustBeMergedWithExistingPolicy: true
    },
    note: 'This manifest translates owner-declared goals into a desired implementation state. It must be merged with existing robots, legal, security and platform requirements rather than blindly replacing them.'
  };
}

export function formatImplementationManifest(value) {
  const lines = [
    `ARWP Growth implementation manifest 0.1`,
    `Target: ${value.target}`,
    `Class: ${value.siteClass}`,
    `Actions in scope: ${value.actions.length}`,
    ''
  ];
  if (value.desiredState.contentSignal) lines.push(`Content-Signal: ${value.desiredState.contentSignal.replace(/^Content-Signal:\s*/, '')}`);
  if (value.desiredState.preferredSourcesUrl) lines.push(`Preferred Sources: ${value.desiredState.preferredSourcesUrl}`);
  lines.push(`Structured data: ${value.desiredState.structuredData.verticalRecommended.join(', ')}`);
  lines.push('', 'Prioritized actions:');
  for (const item of value.actions) lines.push(`- ${item.priority} ${item.title}`);
  lines.push('', value.note);
  return lines.join('\n');
}
