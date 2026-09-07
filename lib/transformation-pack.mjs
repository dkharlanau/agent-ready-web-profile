import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateSiteStateGraph } from './repository-mapper.mjs';
import { canonicalJson, sha256, normalizeRepoPath } from './transformation-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'transformation-pack-registry.schema.json');
const registryPath = path.join(root, 'registry', 'transformation-packs.json');

export const TRANSFORMATION_PACK_VERSION = '0.1';

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

function semanticRegistryErrors(registry) {
  const errors = [];
  const packIds = new Set();
  for (const pack of registry?.packs || []) {
    if (packIds.has(pack.id)) errors.push({ instancePath: '/packs', message: `duplicate pack id ${pack.id}` });
    packIds.add(pack.id);
    const recipeIds = new Set();
    for (const recipe of pack.recipes || []) {
      if (recipeIds.has(recipe.id)) errors.push({ instancePath: `/packs/${pack.id}/recipes`, message: `duplicate recipe id ${recipe.id}` });
      recipeIds.add(recipe.id);
      if (recipe.mode === 'machine-file-replace' && recipe.ownershipScope !== 'surface') {
        errors.push({ instancePath: `/packs/${pack.id}/recipes/${recipe.id}`, message: 'machine-file-replace requires surface ownership' });
      }
      if (recipe.mode !== 'machine-file-replace' && recipe.ownershipScope !== 'route') {
        errors.push({ instancePath: `/packs/${pack.id}/recipes/${recipe.id}`, message: 'HTML recipes require route ownership' });
      }
      if (recipe.ownershipScope === 'surface' && !(recipe.surfaceTypes || []).length) {
        errors.push({ instancePath: `/packs/${pack.id}/recipes/${recipe.id}`, message: 'surface recipe requires surfaceTypes' });
      }
      if (recipe.automationClass === 'grounded-template' && recipe.requiresReviewedGrounding !== true) {
        errors.push({ instancePath: `/packs/${pack.id}/recipes/${recipe.id}`, message: 'grounded-template recipe must require reviewed grounding' });
      }
    }
  }
  return errors;
}

export function validateTransformationPackRegistry(registry) {
  const validate = validator();
  const schemaValid = Boolean(validate(registry));
  const errors = [...(validate.errors || [])];
  if (schemaValid) errors.push(...semanticRegistryErrors(registry));
  return { valid: schemaValid && errors.length === 0, errors };
}

export function loadTransformationPackRegistry() {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const validation = validateTransformationPackRegistry(registry);
  if (!validation.valid) throw new Error(`Invalid Transformation Pack registry: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return registry;
}

export function listTransformationPacks(options = {}) {
  const registry = options.registry || loadTransformationPackRegistry();
  const adapter = options.adapter == null ? null : String(options.adapter);
  const status = options.status == null ? null : String(options.status);
  return registry.packs.filter(pack => (!adapter || pack.adapters.includes(adapter)) && (!status || pack.status === status)).map(pack => structuredClone(pack));
}

function boundaries() {
  return {
    packIsMutationAuthorization: false,
    productionMutationPerformed: false,
    ownershipIsAuthorization: false,
    rankingOrCitationEffectPredicted: false,
    policyEditorialOwnerRuntimeMutationAllowed: false
  };
}

function block(pack, recipe, reason, detail = null) {
  return {
    version: TRANSFORMATION_PACK_VERSION,
    packId: pack.id,
    recipeId: recipe.id,
    status: 'blocked',
    reason,
    detail,
    operationSpec: null,
    boundaries: boundaries()
  };
}

function noop(pack, recipe, pathname, reason, evidence) {
  return {
    version: TRANSFORMATION_PACK_VERSION,
    packId: pack.id,
    recipeId: recipe.id,
    status: 'no-op',
    reason,
    path: pathname,
    evidence,
    operationSpec: null,
    boundaries: boundaries()
  };
}

function packAndRecipe(registry, packId, recipeId) {
  const pack = registry.packs.find(item => item.id === packId);
  if (!pack) throw new Error(`Unknown transformation pack: ${packId}`);
  if (pack.status === 'retired') throw new Error(`Transformation pack is retired: ${packId}`);
  const recipe = pack.recipes.find(item => item.id === recipeId);
  if (!recipe) throw new Error(`Unknown transformation recipe ${recipeId} in ${packId}.`);
  return { pack, recipe };
}

function requireInputs(recipe, inputs) {
  for (const key of recipe.requiredInputs || []) {
    if (!(key in inputs)) return key;
    if (typeof inputs[key] === 'string' && !inputs[key].trim()) return key;
    if (inputs[key] == null) return key;
  }
  return null;
}

function routeOwnership(graph, routePath) {
  const route = (graph.routes || []).find(item => item.routePath === routePath);
  if (!route) return { blocked: 'route-not-mapped', detail: routePath };
  if (route.state !== 'resolved' || !route.ownerPath) return { blocked: `${route.state}-route-ownership`, detail: routePath };
  return {
    kind: 'route',
    key: routePath,
    path: route.ownerPath,
    routeUrl: route.url || null,
    evidence: route.evidence || []
  };
}

function surfaceOwnership(graph, surfaceKey, recipe) {
  const surface = (graph.ownership || []).find(item => item.surfaceKey === surfaceKey);
  if (!surface) return { blocked: 'surface-not-mapped', detail: surfaceKey };
  if (surface.state !== 'resolved' || !surface.ownerPath) return { blocked: `${surface.state}-surface-ownership`, detail: surfaceKey };
  if ((recipe.surfaceTypes || []).length && !recipe.surfaceTypes.includes(surface.surfaceType)) {
    return { blocked: 'unsupported-surface-type', detail: surface.surfaceType };
  }
  return {
    kind: 'surface',
    key: surfaceKey,
    path: surface.ownerPath,
    surfaceType: surface.surfaceType,
    routePath: surface.routePath,
    evidence: surface.evidence || []
  };
}

function resolveOwnership(graph, recipe, request) {
  if (recipe.ownershipScope === 'route') {
    if (typeof request.routePath !== 'string') return { blocked: 'route-path-required', detail: null };
    return routeOwnership(graph, request.routePath);
  }
  if (typeof request.surfaceKey !== 'string') return { blocked: 'surface-key-required', detail: null };
  return surfaceOwnership(graph, request.surfaceKey, recipe);
}

function htmlAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function exactHeadClose(beforeContent) {
  const matches = [...String(beforeContent).matchAll(/<\/head\s*>/gi)].map(match => match[0]);
  return matches.length === 1 ? { match: matches[0] } : { blocked: 'exact-single-head-close-required', detail: matches.length };
}

function canonicalLinks(beforeContent) {
  return [...String(beforeContent).matchAll(/<link\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => {
      const rel = tag.match(/\brel\s*=\s*(["'])(.*?)\1/i);
      if (!rel) return false;
      return rel[2].split(/\s+/).map(token => token.toLowerCase()).includes('canonical');
    });
}

function hrefFromTag(tag) {
  const match = String(tag).match(/\bhref\s*=\s*(["'])(.*?)\1/i);
  return match ? match[2] : null;
}

function normalizedHttpsUrl(value) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:') throw new Error(`Transformation pack requires HTTPS URL input: ${value}`);
  return url;
}

function prepareCanonical(pack, recipe, graph, ownership, request, evidence) {
  let canonical;
  try {
    canonical = normalizedHttpsUrl(request.inputs.canonicalUrl);
  } catch (error) {
    return block(pack, recipe, 'invalid-canonical-url', error.message);
  }
  if (canonical.origin !== graph.site.origin) return block(pack, recipe, 'cross-origin-canonical-needs-owner-review', canonical.href);
  if (!ownership.routeUrl) return block(pack, recipe, 'mapped-route-url-required', ownership.key);
  let routeUrl;
  try {
    routeUrl = normalizedHttpsUrl(ownership.routeUrl);
  } catch (error) {
    return block(pack, recipe, 'invalid-mapped-route-url', error.message);
  }
  if (canonical.href !== routeUrl.href) return block(pack, recipe, 'cross-route-canonical-needs-owner-review', `${canonical.href} != ${routeUrl.href}`);

  const existing = canonicalLinks(request.beforeContent);
  if (existing.length > 1) return block(pack, recipe, 'multiple-canonicals-need-review', existing.length);
  if (existing.length === 1) {
    const href = hrefFromTag(existing[0]);
    if (href) {
      try {
        const current = new URL(href, routeUrl).href;
        if (current === canonical.href) return noop(pack, recipe, ownership.path, 'already-correct', evidence);
      } catch {}
    }
    return block(pack, recipe, 'existing-canonical-needs-review', existing[0]);
  }

  const head = exactHeadClose(request.beforeContent);
  if (head.blocked) return block(pack, recipe, head.blocked, head.detail);
  return {
    version: TRANSFORMATION_PACK_VERSION,
    packId: pack.id,
    recipeId: recipe.id,
    status: 'ready',
    path: ownership.path,
    evidence,
    operationSpec: {
      recommendationId: request.recommendationId,
      operation: 'insert-before-exact',
      path: ownership.path,
      beforeContent: request.beforeContent,
      match: head.match,
      expectedMatchCount: 1,
      content: `  <link rel="canonical" href="${htmlAttribute(canonical.href)}">\n`,
      groundedEvidence: [],
      reviewedGrounding: false,
      verification: recipe.verification
    },
    boundaries: boundaries()
  };
}

function jsonldValue(raw) {
  if (typeof raw === 'string') return JSON.parse(raw);
  if (!raw || typeof raw !== 'object') throw new Error('jsonld input must be a JSON object or array.');
  return raw;
}

function prepareJsonLd(pack, recipe, graph, ownership, request, evidence) {
  if (request.reviewedGrounding !== true || !(request.groundedEvidence || []).length) {
    return block(pack, recipe, 'reviewed-grounding-required', null);
  }
  let jsonld;
  try {
    jsonld = jsonldValue(request.inputs.jsonld);
  } catch (error) {
    return block(pack, recipe, 'invalid-jsonld', error.message);
  }
  const serialized = canonicalJson(jsonld).replace(/</g, '\\u003c');
  const snippet = `  <script type="application/ld+json">${serialized}</script>\n`;
  if (String(request.beforeContent).includes(snippet.trim())) return noop(pack, recipe, ownership.path, 'already-correct', evidence);

  const existing = (graph.ownership || []).filter(item => item.surfaceType === 'jsonld' && item.routePath === request.routePath && item.state === 'resolved');
  if (existing.length) return block(pack, recipe, 'existing-jsonld-needs-review', existing.map(item => item.surfaceKey));
  const head = exactHeadClose(request.beforeContent);
  if (head.blocked) return block(pack, recipe, head.blocked, head.detail);

  return {
    version: TRANSFORMATION_PACK_VERSION,
    packId: pack.id,
    recipeId: recipe.id,
    status: 'ready',
    path: ownership.path,
    evidence,
    operationSpec: {
      recommendationId: request.recommendationId,
      operation: 'insert-before-exact',
      path: ownership.path,
      beforeContent: request.beforeContent,
      match: head.match,
      expectedMatchCount: 1,
      content: snippet,
      groundedEvidence: [...new Set(request.groundedEvidence.map(String))],
      reviewedGrounding: true,
      verification: recipe.verification
    },
    boundaries: boundaries()
  };
}

function prepareMachineFile(pack, recipe, ownership, request, evidence) {
  if (request.reviewedGrounding !== true || !(request.groundedEvidence || []).length) {
    return block(pack, recipe, 'reviewed-grounding-required', null);
  }
  const content = request.inputs.content;
  if (typeof content !== 'string') return block(pack, recipe, 'machine-content-must-be-string', null);
  if (content === request.beforeContent) return noop(pack, recipe, ownership.path, 'already-correct', evidence);
  return {
    version: TRANSFORMATION_PACK_VERSION,
    packId: pack.id,
    recipeId: recipe.id,
    status: 'ready',
    path: ownership.path,
    evidence,
    operationSpec: {
      recommendationId: request.recommendationId,
      operation: 'replace-file',
      path: ownership.path,
      beforeContent: request.beforeContent,
      content,
      groundedEvidence: [...new Set(request.groundedEvidence.map(String))],
      reviewedGrounding: true,
      verification: recipe.verification
    },
    boundaries: boundaries()
  };
}

export function prepareTransformationPackOperation(siteStateGraph, request = {}, options = {}) {
  const graphValidation = validateSiteStateGraph(siteStateGraph);
  if (!graphValidation.valid) throw new Error(`Invalid Site State Graph: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const registry = options.registry || loadTransformationPackRegistry();
  const registryValidation = validateTransformationPackRegistry(registry);
  if (!registryValidation.valid) throw new Error('A valid Transformation Pack registry is required.');
  const { pack, recipe } = packAndRecipe(registry, String(request.packId || ''), String(request.recipeId || ''));
  if (!pack.adapters.includes(siteStateGraph.adapter.id)) return block(pack, recipe, 'adapter-not-supported', siteStateGraph.adapter.id);
  if (!request.recommendationId || typeof request.recommendationId !== 'string') throw new Error('recommendationId is required.');
  const inputs = request.inputs && typeof request.inputs === 'object' ? request.inputs : {};
  request = { ...request, inputs };
  const missing = requireInputs(recipe, inputs);
  if (missing) return block(pack, recipe, 'required-input-missing', missing);

  const ownership = resolveOwnership(siteStateGraph, recipe, request);
  if (ownership.blocked) return block(pack, recipe, ownership.blocked, ownership.detail);
  const pathname = normalizeRepoPath(ownership.path);
  const file = (siteStateGraph.files || []).find(item => normalizeRepoPath(item.path) === pathname);
  if (!file) return block(pack, recipe, 'owner-file-not-mapped', pathname);
  if (file.generated) return block(pack, recipe, 'generated-output-not-source-authority', pathname);
  if (!recipe.allowedFileRoles.includes(file.role)) return block(pack, recipe, 'file-role-not-allowed', file.role);
  if (!recipe.allowedMutationClasses.includes(file.mutationClass)) return block(pack, recipe, 'mutation-class-not-allowed', file.mutationClass);
  if (typeof request.beforeContent !== 'string') return block(pack, recipe, 'before-content-required', pathname);
  const observedDigest = sha256(request.beforeContent);
  if (observedDigest !== file.sha256) return block(pack, recipe, 'source-digest-drift', `${observedDigest} != ${file.sha256}`);
  if (recipe.requiresReviewedGrounding && request.reviewedGrounding !== true) return block(pack, recipe, 'reviewed-grounding-required', null);

  const evidence = {
    siteStateGraphDigest: sha256(canonicalJson(siteStateGraph)),
    registryDigest: sha256(canonicalJson(registry)),
    adapter: siteStateGraph.adapter.id,
    ownership: {
      kind: ownership.kind,
      key: ownership.key,
      path: pathname,
      evidence: ownership.evidence || []
    },
    sourceFileSha256: file.sha256,
    fileRole: file.role,
    mutationClass: file.mutationClass
  };

  if (recipe.mode === 'html-canonical-link') return prepareCanonical(pack, recipe, siteStateGraph, ownership, request, evidence);
  if (recipe.mode === 'html-jsonld-script') return prepareJsonLd(pack, recipe, siteStateGraph, ownership, request, evidence);
  if (recipe.mode === 'machine-file-replace') return prepareMachineFile(pack, recipe, ownership, request, evidence);
  return block(pack, recipe, 'unsupported-recipe-mode', recipe.mode);
}
