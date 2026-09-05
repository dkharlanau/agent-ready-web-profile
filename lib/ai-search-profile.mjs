import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'ai-search-profile.schema.json');

export const AI_SEARCH_PROFILE_VERSION = '0.1';

export const MODULE_DEFAULTS = Object.freeze({
  answerPages: ['P0', 'Create concise pages that answer recurring user/agent questions with canonical facts, sources and stable URLs.'],
  originalResearch: ['P0', 'Publish original measurements, datasets or experiments that cannot be reproduced by generic summary content.'],
  protocolObservatory: ['P0', 'Maintain a dated observatory of relevant protocols, discovery mechanisms, maturity and verified project support.'],
  comparisonPages: ['P1', 'Publish evidence-backed comparisons for closely related protocols, formats and implementation choices.'],
  conceptDefinitions: ['P1', 'Own stable definitions for project concepts with canonical URLs and evidence-backed terminology.'],
  claimsRegistry: ['P1', 'Expose stable claim identifiers with review status, evidence links and machine-readable representations.'],
  evidenceReceipts: ['P1', 'Publish durable observation receipts and reproducible evidence for important project claims.'],
  crawlerMatrix: ['P1', 'Maintain a dated crawler-access matrix based on official documentation and observed configuration.'],
  agentFetchLab: ['P1', 'Run reproducible experiments showing which web surfaces agents actually retrieve for concrete tasks.'],
  knowledgeGraph: ['P2', 'Publish an entity and relationship graph that links concepts, protocols, claims, evidence and project surfaces.'],
  citationVisuals: ['P2', 'Publish reusable charts and diagrams with source notes, alt text and stable URLs for external citation.'],
  externalDistribution: ['P2', 'Distribute original releases to relevant external channels while preserving one canonical source URL.'],
  aiVisibility: ['P2', 'Measure AI/search citations, referrals, grounding queries and external mentions without turning them into a vanity score.'],
  localization: ['P1', 'Expose reviewed language-specific discovery and routing surfaces while keeping canonical technical semantics stable.'],
  history: ['P1', 'Publish a dated human and machine-readable product history with release and maturity status.']
});

export function loadAiSearchProfileSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function createAiSearchProfileValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: false });
  addFormats(ajv);
  return ajv.compile(loadAiSearchProfileSchema());
}

export function loadAiSearchProfile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function makeId(url) {
  const parsed = new URL(url);
  const value = parsed.hostname.replace(/^www\./i, '').replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return (value.length >= 2 ? value : `site-${value || 'web'}`).slice(0, 128);
}

function normalizedCanonicalUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('A canonical website URL is required.');
  const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (parsed.protocol !== 'https:') throw new Error('AI Search Profile canonical URL must use HTTPS.');
  parsed.hash = '';
  return parsed.href;
}

function plannedSurface(url, extra = {}) {
  return { status: 'planned', url, ...extra };
}

function modulePlan() {
  return Object.fromEntries(Object.entries(MODULE_DEFAULTS).map(([key, [priority, description]]) => [
    key,
    { status: 'planned', priority, description }
  ]));
}

export function createAiSearchProfileStarter(input, {
  name,
  id,
  languages = ['en'],
  canonicalLanguage = languages[0] || 'en'
} = {}) {
  const canonicalUrl = normalizedCanonicalUrl(input);
  const origin = new URL(canonicalUrl).origin;
  const base = canonicalUrl.endsWith('/') ? canonicalUrl : `${canonicalUrl}/`;
  const siteName = String(name || new URL(canonicalUrl).hostname).trim();

  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/ai-search-profile.schema.json',
    profileVersion: AI_SEARCH_PROFILE_VERSION,
    site: {
      id: id || makeId(canonicalUrl),
      name: siteName,
      canonicalUrl,
      languages,
      canonicalLanguage
    },
    objective: {
      primary: 'Make the site easy for search systems and AI agents to identify, retrieve, verify and cite through useful original evidence and stable canonical surfaces.',
      targetQuestions: [
        `What is ${siteName}?`,
        `What original information or tools does ${siteName} provide?`,
        `Which machine-readable interfaces does ${siteName} expose?`
      ],
      canonicalTerms: [siteName]
    },
    surfaces: {
      entityHome: { status: 'active', url: canonicalUrl, mediaType: 'text/html' },
      siteProfile: plannedSurface(new URL('ai/site-profile.json', base).href, { mediaType: 'application/json' }),
      llmsCanonical: plannedSurface(new URL('llms.txt', base).href, { language: canonicalLanguage, mediaType: 'text/plain' }),
      history: plannedSurface(new URL('history.html', base).href, { mediaType: 'text/html' }),
      localeManifest: plannedSurface(new URL('ai/locales.json', base).href, { mediaType: 'application/json' }),
      sitemap: plannedSurface(new URL('sitemap.xml', origin).href, { mediaType: 'application/xml' }),
      robots: plannedSurface(new URL('robots.txt', origin).href, { mediaType: 'text/plain' }),
      knowledgeGraph: plannedSurface(new URL('knowledge/graph.json', base).href, { mediaType: 'application/json' }),
      claimsIndex: plannedSurface(new URL('evidence/claims/index.json', base).href, { mediaType: 'application/json' })
    },
    modules: modulePlan(),
    vocabulary: [],
    measurement: {
      signals: [
        { name: 'search visibility', status: 'planned', description: 'Track indexed canonical pages, queries and search performance using available webmaster tooling.' },
        { name: 'AI citations and referrals', status: 'planned', description: 'Track observable AI citations, grounding queries, referrals and external mentions where platforms expose them.' },
        { name: 'referring domains', status: 'planned', description: 'Track external sources that cite or link to canonical research, concepts and visual assets.' }
      ],
      reviewCadence: 'monthly',
      privacy: 'Prefer aggregate, privacy-minimized measurement and do not turn resolver or visitor logs into browsing-history datasets.'
    },
    guardrails: {
      noRankingClaimsWithoutEvidence: true,
      separateOwnedFromIndependentEvidence: true,
      preserveNegativeResults: true,
      canonicalTechnicalSemantics: true,
      noFabricatedAdoption: true,
      noReadinessScore: true
    }
  };
}

export function validateAiSearchProfile(profile) {
  const validate = createAiSearchProfileValidator();
  const valid = Boolean(validate(profile));
  const warnings = [];

  if (profile?.site?.canonicalLanguage && !profile.site.languages?.includes(profile.site.canonicalLanguage)) {
    warnings.push('site.canonicalLanguage is not listed in site.languages.');
  }
  if (profile?.surfaces?.entityHome?.status !== 'active') {
    warnings.push('surfaces.entityHome is not active; a citation profile should have a canonical human-readable entity page.');
  }
  for (const [key, module] of Object.entries(profile?.modules || {})) {
    if (module.status === 'active' && !module.url && !module.machineReadable?.length) {
      warnings.push(`modules.${key} is active but exposes no URL or machine-readable surface.`);
    }
  }

  return { valid, errors: validate.errors ?? [], warnings };
}

export function planAiSearchProfile(profile) {
  const validation = validateAiSearchProfile(profile);
  if (!validation.valid) return { ...validation, next: [], summary: null };

  const entries = Object.entries(profile.modules).map(([key, module]) => ({ key, ...module }));
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  const next = entries
    .filter(item => item.status === 'planned')
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.key.localeCompare(b.key));

  const counts = entries.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    ...validation,
    next,
    summary: {
      modules: entries.length,
      active: counts.active || 0,
      planned: counts.planned || 0,
      paused: counts.paused || 0,
      notApplicable: counts['not-applicable'] || 0,
      nextPriority: next[0]?.priority ?? null
    }
  };
}

export function formatAiSearchProfilePlan(profile) {
  const result = planAiSearchProfile(profile);
  if (!result.valid) return `Invalid AI Search Profile (${result.errors.length} schema error(s)).`;
  const lines = [
    `${profile.site.name} — AI Search & Citation Profile ${profile.profileVersion}`,
    `Modules: ${result.summary.active} active, ${result.summary.planned} planned, ${result.summary.paused} paused, ${result.summary.notApplicable} not applicable.`
  ];
  if (!result.next.length) lines.push('No planned modules remain.');
  else {
    lines.push('', 'Next implementation work:');
    for (const item of result.next) lines.push(`  ${item.priority} ${item.key} — ${item.description}`);
  }
  for (const warning of result.warnings) lines.push(`WARN ${warning}`);
  return lines.join('\n');
}
