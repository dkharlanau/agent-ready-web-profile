import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateSiteStateGraph } from './repository-mapper.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'search-appearance-patch-manifest.schema.json');

export const SEARCH_APPEARANCE_PATCH_VERSION = '0.1';

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateSearchAppearancePatchManifest(manifest) {
  const validate = validator();
  const valid = Boolean(validate(manifest));
  return { valid, errors: validate.errors || [] };
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function pageUrl(report) {
  if (!report || typeof report !== 'object') throw new Error('A Search Appearance report is required.');
  if (!Array.isArray(report.actions)) throw new Error('Search Appearance report actions are required.');
  let url;
  try { url = new URL(report.pageUrl); } catch { throw new Error('Search Appearance report pageUrl must be an absolute URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Search Appearance patch preparation requires a public HTTPS pageUrl without credentials.');
  return url;
}

function fileByPath(graph, pathname) {
  return graph.files.find(file => file.path === pathname) || null;
}

function rootRoute(graph) {
  return graph.routes.find(route => route.routePath === '/') || null;
}

function uniqueResolvedOwner(claims) {
  const resolved = claims.filter(claim => claim.state === 'resolved' && claim.ownerPath);
  const paths = [...new Set(resolved.map(claim => claim.ownerPath))];
  if (paths.length !== 1) return null;
  return { path: paths[0], claims: resolved.filter(claim => claim.ownerPath === paths[0]) };
}

function kindFor(actionId) {
  const id = String(actionId || '');
  if (id.endsWith(':jsonld-syntax')) return 'repair-jsonld-syntax';
  if (id.endsWith(':site-name')) return 'reconcile-site-name';
  if (id.endsWith(':name-consistency')) return 'reconcile-name-consistency';
  if (id.endsWith(':favicon-link')) return 'declare-favicon';
  if (id.endsWith(':favicon-format')) return 'verify-favicon-format';
  if (id.endsWith(':favicon-dimensions')) return 'verify-favicon-dimensions';
  return 'review-search-appearance';
}

function ownerFactsFor(kind) {
  if (kind === 'repair-jsonld-syntax') return ['intended structured-data entity and visible first-party facts', 'existing source block that produced the malformed JSON-LD'];
  if (['reconcile-site-name', 'reconcile-name-consistency'].includes(kind)) return ['canonical visible site name', 'genuine alternate names if any', 'current hostname ownership and publisher identity'];
  if (['declare-favicon', 'verify-favicon-format', 'verify-favicon-dimensions'].includes(kind)) return ['real favicon asset selected by the publisher', 'verified image bytes/format', 'verified square pixel dimensions', 'stable public asset URL'];
  return ['publisher-approved intended Search appearance'];
}

function verificationFor(kind) {
  const common = [
    'Rebuild the site from the edited source and inspect the generated hostname-root HTML.',
    'Run node bin/arwp-search-appearance.mjs on the rebuilt hostname-root HTML using its actual public URL.',
    'Verify the deployed production revision matches the reviewed repository commit before recording an outcome.',
    'Observe actual Search appearance separately; a clean static report is not placement or ranking evidence.'
  ];
  if (kind === 'repair-jsonld-syntax') return ['Parse every emitted application/ld+json block and confirm visible-fact parity.', ...common];
  if (['reconcile-site-name', 'reconcile-name-consistency'].includes(kind)) return ['Confirm visible branding, WebSite.name/alternateName, WebSite.url and og:site_name remain coherent without adding a competing WebSite identity.', ...common];
  if (['declare-favicon', 'verify-favicon-format', 'verify-favicon-dimensions'].includes(kind)) return ['Fetch the deployed favicon asset, verify supported bytes/format, square dimensions and stable URL, and verify crawler access separately.', ...common];
  return common;
}

function preconditionsFor(graph, target) {
  const items = [
    'The supplied Search Appearance report and Site State Graph must describe the same hostname root.',
    'Inspect the current source before editing; preserve unrelated metadata, identity nodes, framework behavior and publisher policy.',
    'Do not infer a site name, alternate name, favicon asset or business identity from the audit finding itself.'
  ];
  if (graph.repository.baseCommitSha) items.push(`The target repository must still be based on commit ${graph.repository.baseCommitSha}; otherwise remap ownership and regenerate this manifest.`);
  if (target.beforeSha256) items.push(`The mapped target must still match ${target.beforeSha256}; digest drift requires a new Site State Graph.`);
  else items.push('Exact source ownership is not proven; resolve ownership before any mutation.');
  return items;
}

function ownershipTarget(action, graph) {
  const kind = kindFor(action.id);
  const route = rootRoute(graph);
  const buildPath = route?.buildPath || [];
  const evidence = [...(route?.evidence || [])];

  const jsonldOwner = uniqueResolvedOwner(graph.ownership.filter(claim => claim.routePath === '/' && claim.surfaceType === 'jsonld'));
  let owner = null;
  if (['repair-jsonld-syntax', 'reconcile-site-name', 'reconcile-name-consistency'].includes(kind) && jsonldOwner) {
    owner = jsonldOwner.path;
    for (const claim of jsonldOwner.claims) evidence.push(...(claim.evidence || []));
  } else if (graph.adapter.id === 'static-html' && route?.state === 'resolved' && route.ownerPath) {
    owner = route.ownerPath;
  }

  if (owner) {
    const file = fileByPath(graph, owner);
    if (file && !file.generated && file.sha256) {
      return {
        state: 'resolved', path: owner, beforeSha256: file.sha256, mutationClass: file.mutationClass,
        buildPath, evidence: [...new Set(evidence)]
      };
    }
  }

  const candidates = route?.candidates || [];
  const state = route?.state === 'ambiguous' ? 'ambiguous' : 'unresolved';
  return {
    state,
    path: null,
    beforeSha256: null,
    mutationClass: null,
    buildPath,
    evidence: [...new Set([...evidence, ...candidates.flatMap(candidate => candidate.evidence || [])])]
  };
}

function actionOperation(action, graph, scopeBlocked) {
  const kind = kindFor(action.id);
  const target = scopeBlocked ? {
    state: 'unresolved', path: null, beforeSha256: null, mutationClass: null, buildPath: [],
    evidence: ['hostname-root ownership does not match the supplied Site State Graph scope']
  } : ownershipTarget(action, graph);
  const status = scopeBlocked ? 'blocked' : target.state === 'resolved' ? 'mapped-review' : 'manual-review';
  return {
    id: `patch:${action.id}`,
    findingId: String(action.id),
    status,
    kind,
    priority: String(action.priority || 'P2'),
    authority: 'proposal-only',
    title: String(action.title || action.id),
    reason: scopeBlocked
      ? 'The Search Appearance finding is hostname-scoped, but the supplied Site State Graph does not prove ownership of that hostname root. Do not patch a project subdirectory or unrelated repository to change hostname-wide branding.'
      : String(action.reason || 'Search Appearance finding requires review.'),
    source: /^https:\/\//.test(String(action.source || '')) ? action.source : 'https://developers.google.com/search/docs/appearance/site-names',
    target,
    ownerFactsRequired: ownerFactsFor(kind),
    preconditions: preconditionsFor(graph, target),
    changeIntent: status === 'mapped-review'
      ? 'Read the exact mapped source at the recorded digest, reconcile the finding using publisher-grounded facts, then prepare a separate reviewed repository edit. This manifest does not contain or authorize the edit.'
      : status === 'blocked'
        ? 'Do not mutate this repository for the hostname-level finding. Obtain a Site State Graph for the actual hostname-root owner first.'
        : 'Resolve the exact source owner before preparing any repository edit; build-path candidates are context only and must not be treated as ownership.',
    verification: verificationFor(kind),
    doesNotProve: 'Resolving or editing Search appearance declarations does not prove indexing, displayed site-name/favicon selection, ranking, recommendations, citations, traffic or conversion.'
  };
}

function summary(operations) {
  return {
    total: operations.length,
    mappedReview: operations.filter(item => item.status === 'mapped-review').length,
    manualReview: operations.filter(item => item.status === 'manual-review').length,
    blocked: operations.filter(item => item.status === 'blocked').length
  };
}

export function buildSearchAppearancePatchManifest(report, siteStateGraph, options = {}) {
  const url = pageUrl(report);
  const mapValidation = validateSiteStateGraph(siteStateGraph);
  if (!mapValidation.valid) throw new Error(`Invalid Site State Graph: ${mapValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const siteOrigin = new URL(siteStateGraph.site.origin).origin;
  const scopeBlocked = report.scope !== 'hostname-root' || url.pathname !== '/' || url.search || url.hash || siteOrigin !== url.origin || siteStateGraph.site.basePath !== '/';
  const operations = report.actions.map(action => actionOperation(action, siteStateGraph, scopeBlocked));
  const manifest = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/search-appearance-patch-manifest.schema.json',
    version: SEARCH_APPEARANCE_PATCH_VERSION,
    generatedAt: iso(options.generatedAt),
    site: `${url.origin}/`,
    repository: {
      fullName: siteStateGraph.repository.fullName,
      baseRef: siteStateGraph.repository.baseRef,
      baseCommitSha: siteStateGraph.repository.baseCommitSha,
      siteRoot: siteStateGraph.repository.siteRoot,
      adapter: siteStateGraph.adapter.id
    },
    sourceAudit: {
      pageUrl: report.pageUrl,
      searchAppearanceVersion: String(report.searchAppearanceVersion || 'unknown'),
      evidenceClass: String(report.evidenceClass || 'unknown'),
      scope: report.scope === 'hostname-root' ? 'hostname-root' : 'non-root'
    },
    summary: summary(operations),
    operations,
    guardrails: {
      writesTargetRepository: false,
      requiresExplicitAuthorizationBeforeMutation: true,
      hostnameRootOnly: true,
      noPathGuessing: true,
      ambiguityPreserved: true,
      exactDigestRequiredForMappedReview: true,
      noIdentityInference: true,
      noFaviconFabrication: true,
      noGeneratedOutputPreference: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateSearchAppearancePatchManifest(manifest);
  if (!validation.valid) throw new Error(`Generated Search Appearance patch manifest is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return manifest;
}

export function formatSearchAppearancePatchManifest(manifest) {
  const lines = [
    'ARWP Search Appearance patch preparation',
    `Site: ${manifest.site}`,
    `Repository: ${manifest.repository.fullName}@${manifest.repository.baseCommitSha || manifest.repository.baseRef}`,
    `Operations: ${manifest.summary.total}; mapped-review ${manifest.summary.mappedReview}; manual ${manifest.summary.manualReview}; blocked ${manifest.summary.blocked}`
  ];
  for (const operation of manifest.operations) {
    lines.push('', `${operation.priority} ${operation.status.toUpperCase()} ${operation.findingId}`);
    lines.push(`  ${operation.title}`);
    if (operation.target.path) lines.push(`  Target: ${operation.target.path} (${operation.target.beforeSha256})`);
    else if (operation.target.buildPath.length) lines.push(`  Build-path context: ${operation.target.buildPath.join(' -> ')}`);
    lines.push(`  Intent: ${operation.changeIntent}`);
  }
  lines.push('', 'This is proposal-only ownership evidence. It never edits the target repository and never converts ambiguity into permission to mutate.');
  return lines.join('\n');
}
