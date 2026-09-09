/** Project maturity surfaces: inspectable ownership/governance roles, not legal certification or ranking advice. */
import { createHash } from 'node:crypto';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const https = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};
const safePath = value => text(value) && !/[:\\\x00]/.test(value)
  && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..');

export const REQUIRED_PROJECT_SURFACE_ROLES = Object.freeze([
  'project-identity',
  'copyright-rights',
  'names-marks',
  'partnership-collaboration',
  'governance',
  'contact-routing',
  'security',
  'corrections',
  'change-history'
]);

export const RECOMMENDED_CONDITIONAL_SURFACE_ROLES = Object.freeze([
  'privacy-data-use',
  'terms-service',
  'service-status',
  'accessibility-statement'
]);

export function auditProjectSurfaces(manifest, { readText } = {}) {
  const errors = [], review = [], files = new Map();
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const read = file => {
    if (!safePath(file)) { errors.push(`Unsafe or missing project-surface path: ${String(file)}`); return null; }
    if (files.has(file)) return files.get(file).content;
    try {
      if (typeof readText !== 'function') throw new Error('repository-scoped reader is required');
      const content = readText(file);
      if (typeof content !== 'string' || !content.trim()) throw new Error('empty or non-text file');
      const bytes = Buffer.from(content, 'utf8');
      if (bytes.length > 5_000_000) throw new Error('file exceeds 5 MB project-surface limit');
      files.set(file, { content, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      return content;
    } catch (error) { errors.push(`${file}: ${error.message}`); return null; }
  };
  const validateHtml = (file, publicUrl) => {
    if (!file.endsWith('.html')) return;
    const html = read(file);
    if (html === null) return;
    require(/<h1(?:\s|>)/i.test(html), `${file}: public policy surface needs an h1`);
    require(/<meta\s+name=["']description["']/i.test(html), `${file}: public policy surface needs a meta description`);
    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]
      || html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)?.[1];
    require(canonical === publicUrl, `${file}: canonical must match declared publicUrl`);
  };

  if (!object(manifest)) return { valid: false, scope: 'project-maturity-surfaces-not-certification', errors: ['Project surface manifest must be an object'], review, files: [] };
  require(manifest.schemaVersion === '1.0', 'Unsupported project surface schemaVersion');
  require(text(manifest.scope), 'scope must explain what this manifest does and does not prove');
  require(object(manifest.product), 'product must be an object');
  require(text(manifest.product?.name), 'product.name is required');
  require(https(manifest.product?.canonicalUrl), 'product.canonicalUrl must be HTTPS');
  require(object(manifest.owner), 'owner must be an object');
  require(https(manifest.owner?.id), 'owner.id must be an HTTPS identifier');
  require(text(manifest.owner?.name), 'owner.name is required');
  require(['Person', 'Organization'].includes(manifest.owner?.type), 'owner.type must be Person or Organization');

  const required = Array.isArray(manifest.requiredSurfaces) ? manifest.requiredSurfaces : [];
  require(Array.isArray(manifest.requiredSurfaces), 'requiredSurfaces must be an array');
  const ids = new Set();
  for (const surface of required) {
    if (!object(surface)) { errors.push('Required project surface must be an object'); continue; }
    require(text(surface.id), 'Required surface id is required');
    require(!ids.has(surface.id), `Duplicate project surface id: ${surface.id}`); ids.add(surface.id);
    require(safePath(surface.path), `${surface.id}: path must be repository-relative`);
    require(https(surface.publicUrl), `${surface.id}: publicUrl must be HTTPS`);
    require(text(surface.job), `${surface.id}: semantic page job is required`);
    const content = safePath(surface.path) ? read(surface.path) : null;
    if (content !== null) validateHtml(surface.path, surface.publicUrl);
  }
  for (const role of REQUIRED_PROJECT_SURFACE_ROLES) require(ids.has(role), `Missing required project maturity role: ${role}`);
  review.push('Required roles are semantic jobs, not a required page count. Multiple roles may share one substantive page when that is clearer.');

  const conditional = Array.isArray(manifest.conditionalSurfaces) ? manifest.conditionalSurfaces : [];
  require(Array.isArray(manifest.conditionalSurfaces), 'conditionalSurfaces must be an array');
  const conditionalIds = new Set();
  for (const surface of conditional) {
    if (!object(surface)) { errors.push('Conditional project surface must be an object'); continue; }
    require(text(surface.id), 'Conditional surface id is required');
    require(!conditionalIds.has(surface.id), `Duplicate conditional surface id: ${surface.id}`); conditionalIds.add(surface.id);
    require(typeof surface.applicable === 'boolean', `${surface.id}: applicable must be boolean`);
    require(text(surface.reason), `${surface.id}: applicability reason is required`);
    if (surface.applicable === true) {
      require(safePath(surface.path), `${surface.id}: applicable surface needs a repository-relative path`);
      require(https(surface.publicUrl), `${surface.id}: applicable surface needs an HTTPS publicUrl`);
      if (safePath(surface.path)) {
        const content = read(surface.path);
        if (content !== null) validateHtml(surface.path, surface.publicUrl);
      }
    }
  }
  review.push('Conditional policies must follow actual product behavior. Accounts, payments, forms, SLAs or regulated commitments can make additional surfaces applicable.');

  const names = Array.isArray(manifest.projectNames) ? manifest.projectNames : [];
  require(Array.isArray(manifest.projectNames) && names.length > 0, 'projectNames must declare current naming roles');
  const nameRoles = new Set(), nameValues = new Set();
  for (const item of names) {
    if (!object(item)) { errors.push('Project name entry must be an object'); continue; }
    require(text(item.name) && text(item.role) && text(item.status), 'Each project name needs name, role and status');
    if (text(item.name)) require(!nameValues.has(item.name), `Duplicate project name: ${item.name}`); nameValues.add(item.name);
    if (text(item.role)) nameRoles.add(item.role);
    if (item.registeredTrademarkClaimed !== undefined) require(typeof item.registeredTrademarkClaimed === 'boolean', `${item.name}: registeredTrademarkClaimed must be boolean`);
    if (item.exclusiveAcronymRightsClaimed !== undefined) require(typeof item.exclusiveAcronymRightsClaimed === 'boolean', `${item.name}: exclusiveAcronymRightsClaimed must be boolean`);
  }
  for (const role of ['canonical-product-name', 'technical-project-name']) require(nameRoles.has(role), `Missing project naming role: ${role}`);
  review.push('Project-reserved naming roles are repository policy, not trademark registration, legal exclusivity or clearance. Verify actual registry/legal status separately.');

  if (manifest.companyRouting !== undefined) {
    require(object(manifest.companyRouting), 'companyRouting must be an object when present');
    if (object(manifest.companyRouting)) {
      require(text(manifest.companyRouting.name), 'companyRouting.name is required');
      require(text(manifest.companyRouting.role), 'companyRouting.role is required');
      if (manifest.companyRouting.url !== undefined) require(https(manifest.companyRouting.url), 'companyRouting.url must be HTTPS');
      if (manifest.companyRouting.availabilityVerifiedByThisRepository !== undefined) require(typeof manifest.companyRouting.availabilityVerifiedByThisRepository === 'boolean', 'companyRouting.availabilityVerifiedByThisRepository must be boolean');
    }
    review.push('An external company/partnership route is routing metadata. It does not establish legal entity type, ownership, employment, endorsement or live availability.');
  }

  require(object(manifest.guardrails), 'guardrails must be an object');
  require(manifest.guardrails?.pageCountIsNotMaturity === true, 'guardrails.pageCountIsNotMaturity must be true');
  require(manifest.guardrails?.legalComplianceClaimedByPresence === false, 'guardrails.legalComplianceClaimedByPresence must be false');
  require(manifest.guardrails?.rankingBenefitClaimed === false, 'guardrails.rankingBenefitClaimed must be false');
  require(manifest.guardrails?.partnershipImpliesEndorsement === false, 'guardrails.partnershipImpliesEndorsement must be false');
  require(manifest.guardrails?.conditionalSurfacesMustMatchActualSiteBehavior === true, 'guardrails.conditionalSurfacesMustMatchActualSiteBehavior must be true');

  return {
    valid: errors.length === 0,
    scope: 'project-maturity-surfaces-not-certification',
    errors,
    review,
    roles: [...ids].sort(),
    conditional: [...conditionalIds].sort(),
    files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, value]) => ({ path, bytes: value.bytes, sha256: value.sha256 }))
  };
}
