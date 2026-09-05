import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const profileSchemaPath = path.join(root, 'schema', 'content-profile.schema.json');
const itemSchemaPath = path.join(root, 'schema', 'content-item.schema.json');
const archetypeRegistryPath = path.join(root, 'registry', 'content-archetypes.json');

export const CONTENT_PROFILE_VERSION = '0.1';
export const CONTENT_ITEM_VERSION = '0.1';

const DEFAULT_ARCHETYPES = Object.freeze([
  'answer', 'guide', 'tutorial', 'research', 'comparison', 'case-study',
  'analysis', 'opinion', 'reference', 'concept', 'changelog', 'news-update'
]);

const DEFAULT_RELATIONS = Object.freeze([
  'broader', 'narrower', 'prerequisite', 'contrasts-with', 'applies-to',
  'evidence-for', 'updates', 'implements', 'example-of', 'next-question'
]);

const STYLE_WARNING_PHRASES = Object.freeze({
  en: [
    'in today\'s fast-paced world',
    'in today\'s digital landscape',
    'it is important to note',
    'it\'s important to note',
    'let\'s delve',
    'let\'s dive in',
    'this article explores',
    'this article will explore',
    'unlock the power of',
    'game-changer',
    'revolutionary approach',
    'seamlessly integrates',
    'in conclusion'
  ],
  ru: [
    'в современном быстро меняющемся мире',
    'в современном мире',
    'важно отметить',
    'стоит отметить',
    'давайте погрузимся',
    'давайте разберемся',
    'в этой статье мы рассмотрим',
    'в данной статье мы рассмотрим',
    'революционный подход',
    'меняет правила игры',
    'в заключение'
  ],
  de: [
    'in der heutigen schnelllebigen welt',
    'in der heutigen digitalen landschaft',
    'es ist wichtig zu beachten',
    'lassen sie uns eintauchen',
    'dieser artikel untersucht',
    'revolutionärer ansatz',
    'nahtlos integriert',
    'abschließend lässt sich sagen'
  ]
});

function parseJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function createValidator(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function loadContentProfileSchema() {
  return JSON.parse(fs.readFileSync(profileSchemaPath, 'utf8'));
}

export function loadContentItemSchema() {
  return JSON.parse(fs.readFileSync(itemSchemaPath, 'utf8'));
}

export function loadContentArchetypes() {
  return JSON.parse(fs.readFileSync(archetypeRegistryPath, 'utf8'));
}

export function loadContentProfile(filePath) {
  return parseJson(filePath);
}

export function loadContentItem(filePath) {
  return parseJson(filePath);
}

function canonicalUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('A canonical website URL is required.');
  const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (parsed.protocol !== 'https:') throw new Error('Adaptive Content Profile canonical URL must use HTTPS.');
  parsed.hash = '';
  return parsed.href;
}

function makeId(url) {
  const parsed = new URL(url);
  const value = parsed.hostname.replace(/^www\./i, '').replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return (value.length >= 2 ? value : `site-${value || 'web'}`).slice(0, 128);
}

function makeContentId(url) {
  const parsed = new URL(url);
  const raw = `${parsed.hostname}${parsed.pathname === '/' ? '' : `-${parsed.pathname}`}`;
  const value = raw.replace(/^www\./i, '').replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return (value.length >= 2 ? value : 'content-item').slice(0, 160);
}

export function createContentProfileStarter(input, {
  name,
  id,
  languages = ['en'],
  canonicalLanguage = languages[0] || 'en'
} = {}) {
  const url = canonicalUrl(input);
  const siteName = String(name || new URL(url).hostname).trim();
  const base = url.endsWith('/') ? url : `${url}/`;

  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/content-profile.schema.json',
    profileVersion: CONTENT_PROFILE_VERSION,
    site: {
      id: id || makeId(url),
      name: siteName,
      canonicalUrl: url,
      languages,
      canonicalLanguage
    },
    archetypes: {
      registry: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/registry/content-archetypes.json',
      enabled: [...DEFAULT_ARCHETYPES]
    },
    graph: {
      enabled: true,
      relationTypes: [...DEFAULT_RELATIONS],
      minimumMeaningfulRelations: 1,
      machineReadableGraph: new URL('knowledge/graph.json', base).href
    },
    publication: {
      canonicalRequired: true,
      authorIdentity: {
        requiredForEditorialContent: true,
        profileUrlRecommended: true
      },
      dates: {
        published: true,
        modifiedOnlyOnMaterialChange: true,
        reviewedForTimeSensitiveFacts: true
      },
      structuredData: {
        useWhenSemanticallyAccurate: true,
        mirrorVisibleContent: true
      },
      discover: {
        status: 'planned',
        largeImageRecommended: true,
        recommendedMinWidth: 1200,
        recommendedMinPixels: 300000,
        preferredAspectRatio: '16:9',
        maxImagePreviewLarge: true,
        source: 'https://developers.google.com/search/docs/appearance/google-discover'
      },
      preferredSources: {
        status: 'planned',
        placement: 'article-end',
        source: 'https://developers.google.com/search/docs/appearance/preferred-sources',
        notes: 'Enable only after confirming that the domain appears in Google Preferred Sources; do not imply eligibility or ranking guarantees.'
      }
    },
    style: {
      fingerprintLint: true,
      lintMode: 'warn',
      languages
    },
    guardrails: {
      contentGrammarNotTemplate: true,
      formatAdaptive: true,
      noForcedWordCount: true,
      noKeywordDensityTargets: true,
      noMandatoryFaq: true,
      noGenericConclusionRequirement: true,
      noSyntheticStatistics: true,
      noInventedFirstHandExperience: true,
      noQueryVariantPageFactory: true,
      noUniformSectionOrder: true,
      evidenceBeforeDecoration: true,
      visibleContentBeforeMachineMetadata: true,
      noRankingPromise: true
    }
  };
}

export function createContentItemStarter(urlInput, {
  title = 'Untitled content item',
  archetype = 'analysis',
  language = 'en',
  author = 'Editorial team',
  datePublished = new Date().toISOString().slice(0, 10)
} = {}) {
  const url = canonicalUrl(urlInput);
  const registry = loadContentArchetypes();
  const entry = registry.archetypes.find(item => item.id === archetype);
  if (!entry) throw new Error(`Unknown content archetype: ${archetype}`);

  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/content-item.schema.json',
    itemVersion: CONTENT_ITEM_VERSION,
    id: makeContentId(url),
    canonicalUrl: url,
    title,
    language,
    archetype,
    purpose: entry.intent,
    blocks: [...entry.coreSignals],
    evidence: [],
    relations: [],
    visuals: [],
    authorship: {
      authors: [{ name: author }],
      datePublished
    },
    schemaTypes: ['Article'],
    distribution: {
      discoverLargeImage: false,
      maxImagePreviewLarge: false,
      preferredSourcePrompt: false
    }
  };
}

export function validateContentProfile(profile) {
  const validate = createValidator(profileSchemaPath);
  const valid = Boolean(validate(profile));
  const warnings = [];

  if (profile?.site?.canonicalLanguage && !profile.site.languages?.includes(profile.site.canonicalLanguage)) {
    warnings.push('site.canonicalLanguage is not listed in site.languages.');
  }
  if (profile?.style?.fingerprintLint && profile.style.lintMode === 'off') {
    warnings.push('style.fingerprintLint is enabled but lintMode is off.');
  }
  if (profile?.publication?.preferredSources?.status === 'active' && profile.publication.preferredSources.placement === 'none') {
    warnings.push('Preferred Sources is marked active but placement is none.');
  }

  return { valid, errors: validate.errors ?? [], warnings };
}

export function validateContentItem(item) {
  const validate = createValidator(itemSchemaPath);
  const valid = Boolean(validate(item));
  return { valid, errors: validate.errors ?? [] };
}

function baseLanguage(language) {
  return String(language || '').toLowerCase().split('-')[0];
}

function styleWarnings(text, language, customWarningPhrases = []) {
  if (!text) return [];
  const lower = text.toLocaleLowerCase();
  const builtIn = STYLE_WARNING_PHRASES[baseLanguage(language)] || [];
  const phrases = [...new Set([...builtIn, ...customWarningPhrases.map(value => String(value).toLocaleLowerCase())])];
  const found = phrases.filter(phrase => lower.includes(phrase));
  return found.map(phrase => `Possible formulaic/AI-style phrase: “${phrase}”. Review in context; this is a warning, not a ban.`);
}

function expectedEvidence(entry) {
  return !['none', 'source-backed-when-factual'].includes(entry.evidenceExpectation);
}

export function auditContentItem(item, profile = null) {
  const validation = validateContentItem(item);
  if (!validation.valid) return { ...validation, archetype: null, warnings: [], recommendations: [], styleWarnings: [] };

  const registry = loadContentArchetypes();
  const archetype = registry.archetypes.find(entry => entry.id === item.archetype);
  const warnings = [];
  const recommendations = [];

  if (!archetype) {
    warnings.push(`No registry definition found for archetype ${item.archetype}.`);
  } else {
    for (const signal of archetype.coreSignals) {
      if (!item.blocks.includes(signal)) warnings.push(`Missing core semantic signal for ${item.archetype}: ${signal}. The visible heading name may vary; the signal itself should be present.`);
    }
    const missingRecommended = archetype.recommendedBlocks.filter(block => !item.blocks.includes(block));
    if (missingRecommended.length) recommendations.push(`Consider only if useful: ${missingRecommended.join(', ')}.`);
    if (expectedEvidence(archetype) && !(item.evidence?.length > 0)) {
      warnings.push(`${item.archetype} normally needs inspectable evidence (${archetype.evidenceExpectation}), but no evidence records are declared.`);
    }
  }

  const enabledRelations = profile?.graph?.relationTypes || registry.relationVocabulary;
  if (profile?.graph?.enabled !== false) {
    const minimum = profile?.graph?.minimumMeaningfulRelations ?? 1;
    const meaningful = (item.relations || []).filter(relation => enabledRelations.includes(relation.type));
    if (meaningful.length < minimum) {
      recommendations.push(`Add ${minimum - meaningful.length} meaningful content-graph relation(s) if a real relationship exists; never add links just to satisfy a count.`);
    }
  }

  if (item.archetype === 'research' && !(item.visuals || []).some(visual => ['chart', 'diagram', 'table'].includes(visual.kind))) {
    recommendations.push('Research often benefits from a reusable chart, diagram or table when the data supports one; do not add decorative visuals just for completeness.');
  }

  if (item.distribution?.discoverLargeImage) {
    const largeEnough = (item.visuals || []).some(visual => {
      if (visual.kind !== 'image' || !visual.width || !visual.height) return false;
      return visual.width >= 1200 && visual.width * visual.height > 300000;
    });
    if (!largeEnough) warnings.push('discoverLargeImage is enabled but no declared image proves the recommended >=1200 px width and >300,000 total pixels.');
  }

  if (item.authorship?.dateModified && item.authorship.dateModified < item.authorship.datePublished) {
    warnings.push('dateModified predates datePublished.');
  }
  if (item.authorship?.dateReviewed && item.authorship.dateReviewed < item.authorship.datePublished) {
    warnings.push('dateReviewed predates datePublished.');
  }

  const lintEnabled = profile?.style?.fingerprintLint ?? true;
  const lintMode = profile?.style?.lintMode ?? 'warn';
  const styleFindings = lintEnabled && lintMode !== 'off'
    ? styleWarnings(item.contentSample || '', item.language, profile?.style?.customWarningPhrases || [])
    : [];

  if (item.contentSample) {
    const trimmed = item.contentSample.trim().toLocaleLowerCase();
    if (/^(in conclusion|в заключение|abschließend)/.test(trimmed.slice(-250))) {
      styleFindings.push('The ending appears to use a generic conclusion formula. Keep it only if the conclusion adds new synthesis or a decision.');
    }
  }

  return {
    ...validation,
    archetype,
    warnings,
    recommendations,
    styleWarnings: styleFindings
  };
}

export function formatContentPlan(archetypeId) {
  const registry = loadContentArchetypes();
  const entry = registry.archetypes.find(item => item.id === archetypeId);
  if (!entry) throw new Error(`Unknown content archetype: ${archetypeId}`);
  return [
    `${entry.label} (${entry.id})`,
    entry.intent,
    '',
    `Core semantic signals: ${entry.coreSignals.join(', ')}`,
    `Useful blocks when relevant: ${entry.recommendedBlocks.join(', ')}`,
    `Evidence expectation: ${entry.evidenceExpectation}`,
    `Useful graph relations: ${entry.graphRelations.join(', ')}`,
    `Do not force: ${entry.avoidForcing.join('; ')}`,
    '',
    'Block IDs describe meaning, not visible headings or mandatory order.'
  ].join('\n');
}

export function formatContentAudit(result, item) {
  if (!result.valid) return `Invalid Content Item (${result.errors.length} schema error(s)).`;
  const lines = [
    `${item.title} — ${item.archetype}`,
    `Declared blocks: ${item.blocks.join(', ')}`,
    `Evidence records: ${item.evidence?.length || 0}; relations: ${item.relations?.length || 0}; visuals: ${item.visuals?.length || 0}.`
  ];
  for (const warning of result.warnings) lines.push(`WARN ${warning}`);
  for (const warning of result.styleWarnings) lines.push(`STYLE ${warning}`);
  for (const recommendation of result.recommendations) lines.push(`OPTION ${recommendation}`);
  if (!result.warnings.length && !result.styleWarnings.length) lines.push('PASS No structural or style warnings detected.');
  return lines.join('\n');
}
