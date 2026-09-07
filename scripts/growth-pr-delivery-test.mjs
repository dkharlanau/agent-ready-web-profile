import assert from 'node:assert/strict';
import {
  buildGrowthRemediationManifest
} from '../lib/growth-remediation.mjs';
import {
  buildGrowthPrDeliveryBundle,
  validateGrowthPrDeliveryBundle,
  openGrowthProposalPr,
  GROWTH_PR_AUTHORIZATION
} from '../lib/growth-pr-delivery.mjs';

const plan = {
  profile: '2026-09-07',
  canonicalUrl: 'https://example.com/',
  actions: [
    {
      id: 'growth:cloudflare-content-signals',
      priority: 'P2',
      lane: 'ai-access',
      title: 'Declare content signals',
      status: 'recommended',
      reason: 'Policy fixture.',
      implementation: {
        file: '/robots.txt',
        suggestedPolicy: 'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
        note: 'Use only when this is the publisher policy.'
      }
    },
    {
      id: 'growth:entity-identity',
      priority: 'P1',
      lane: 'entity-identity',
      title: 'Publish identity',
      status: 'recommended',
      reason: 'Identity fixture.',
      implementation: {
        template: 'templates/growth/organization.jsonld',
        placement: 'homepage or canonical About page'
      }
    },
    {
      id: 'growth:non-commodity-review',
      priority: 'P1',
      lane: 'content-quality',
      title: 'Review content quality',
      status: 'manual',
      reason: 'Editorial judgment fixture.',
      implementation: { template: 'templates/growth/content-quality-checklist.md' }
    },
    {
      id: 'trend-owner:provider-setting',
      priority: 'P1',
      lane: 'measurement',
      title: 'Verify owner setting',
      status: 'external-owner-data',
      reason: 'Owner-state fixture.',
      implementation: { surface: 'authenticated platform owner control' }
    }
  ]
};

const remediation = buildGrowthRemediationManifest(plan, { generatedAt: '2026-09-07T08:30:00Z' });
const options = { repository: 'acme/site', base: 'main', generatedAt: '2026-09-07T08:31:00Z' };
const bundle = buildGrowthPrDeliveryBundle(remediation, options);
const validation = validateGrowthPrDeliveryBundle(bundle);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.equal(bundle.version, '0.1');
assert.equal(bundle.repository, 'acme/site');
assert.match(bundle.branch.name, /^arwp\/growth-proposal-20260907-[a-f0-9]{8}$/);
assert.equal(bundle.branch.base, 'main');
assert.equal(bundle.guardrails.reviewArtifactsOnly, true);
assert.equal(bundle.guardrails.writesProductionPaths, false);
assert.equal(bundle.guardrails.robotsPolicyNeverApplied, true);
assert.equal(bundle.guardrails.structuredDataNeverApplied, true);
assert.equal(bundle.guardrails.editorialContentNeverApplied, true);
assert.equal(bundle.guardrails.externalOwnerControlsNeverApplied, true);
assert.equal(bundle.guardrails.noForcePush, true);
assert(bundle.files.every(file => file.path.startsWith('.arwp/proposals/') && file.reviewOnly === true));
assert.equal(bundle.files.some(file => file.path === 'robots.txt' || file.path === '/robots.txt'), false);
assert.equal(bundle.files.some(file => !file.path.startsWith('.arwp/proposals/')), false);
assert(bundle.files.some(file => file.path === '.arwp/proposals/growth-remediation.json'));
assert(bundle.files.some(file => file.path === '.arwp/proposals/README.md'));
assert(bundle.files.some(file => file.path.endsWith('.jsonld')), 'structured-data snippet should be carried as a review artifact');
assert(bundle.files.some(file => file.path.includes('/snippets/')), 'template/policy snippets should be review artifacts');
assert.equal(bundle.gatedItems.length, remediation.items.length);
assert(bundle.gatedItems.every(item => item.humanReviewRequired === true));
assert.match(bundle.pullRequest.body, /review artifacts only/i);
assert.match(bundle.pullRequest.body, /does \*\*not\*\* modify `robots\.txt`/i);

const reordered = JSON.parse(JSON.stringify(remediation));
reordered.guardrails = Object.fromEntries(Object.entries(reordered.guardrails).reverse());
reordered.summary = Object.fromEntries(Object.entries(reordered.summary).reverse());
const deterministic = buildGrowthPrDeliveryBundle(reordered, options);
assert.equal(deterministic.sourceManifest.sha256, bundle.sourceManifest.sha256, 'manifest digest must be key-order independent');
assert.equal(deterministic.branch.name, bundle.branch.name, 'branch name must be deterministic for the same material manifest and date');

const tampered = structuredClone(bundle);
tampered.files[0].path = 'robots.txt';
assert.equal(validateGrowthPrDeliveryBundle(tampered).valid, false, 'production paths must fail the delivery schema');
assert.throws(() => buildGrowthPrDeliveryBundle(remediation, { repository: 'not-a-repository', generatedAt: options.generatedAt }), /owner\/name/);

let unauthorizedCalls = 0;
const unauthorizedFetch = async () => { unauthorizedCalls += 1; throw new Error('network must not be called'); };
await assert.rejects(
  openGrowthProposalPr(bundle, { token: 'token', authorization: 'yes', fetchImpl: unauthorizedFetch }),
  /Explicit authorization required/
);
assert.equal(unauthorizedCalls, 0, 'authorization must be checked before network');
await assert.rejects(
  openGrowthProposalPr(bundle, { token: '', authorization: GROWTH_PR_AUTHORIZATION, fetchImpl: unauthorizedFetch }),
  /GITHUB_TOKEN is required/
);
assert.equal(unauthorizedCalls, 0, 'token must be checked before network');

function response(status, payload = null, textValue = null) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return payload; },
    async text() { return textValue ?? (payload == null ? '' : JSON.stringify(payload)); }
  };
}

const calls = [];
let blobCounter = 0;
let postedTree = null;
let postedRef = null;
const fetchImpl = async (url, request = {}) => {
  const method = request.method || 'GET';
  const body = request.body ? JSON.parse(request.body) : null;
  calls.push({ url, method, body });
  if (method === 'GET' && url.endsWith('/repos/acme/site')) return response(200, { default_branch: 'main' });
  if (method === 'GET' && url.includes('/git/ref/heads/arwp/growth-proposal-')) return response(404, { message: 'Not Found' });
  if (method === 'GET' && url.endsWith('/git/ref/heads/main')) return response(200, { object: { sha: 'base123' } });
  if (method === 'GET' && url.endsWith('/git/commits/base123')) return response(200, { tree: { sha: 'treebase' } });
  if (method === 'POST' && url.endsWith('/git/blobs')) return response(201, { sha: `blob${++blobCounter}` });
  if (method === 'POST' && url.endsWith('/git/trees')) {
    postedTree = body;
    return response(201, { sha: 'treenew' });
  }
  if (method === 'POST' && url.endsWith('/git/commits')) return response(201, { sha: 'commitnew' });
  if (method === 'POST' && url.endsWith('/git/refs')) {
    postedRef = body;
    return response(201, { ref: body.ref, object: { sha: body.sha } });
  }
  if (method === 'POST' && url.endsWith('/pulls')) return response(201, { number: 42, html_url: 'https://github.com/acme/site/pull/42' });
  return response(500, null, `unexpected mock request ${method} ${url}`);
};

const opened = await openGrowthProposalPr(bundle, {
  token: 'test-token',
  authorization: GROWTH_PR_AUTHORIZATION,
  fetchImpl
});
assert.equal(opened.repository, 'acme/site');
assert.equal(opened.base, 'main');
assert.equal(opened.branch, bundle.branch.name);
assert.equal(opened.commitSha, 'commitnew');
assert.equal(opened.prNumber, 42);
assert.equal(opened.url, 'https://github.com/acme/site/pull/42');
assert.equal(opened.reviewArtifactsOnly, true);
assert.equal(blobCounter, bundle.files.length);
assert(postedTree && Array.isArray(postedTree.tree));
assert.equal(postedTree.base_tree, 'treebase');
assert(postedTree.tree.every(item => item.path.startsWith('.arwp/proposals/')));
assert(postedTree.tree.every(item => item.mode === '100644' && item.type === 'blob'));
assert.equal(postedRef.ref, `refs/heads/${bundle.branch.name}`);
assert.equal('force' in postedRef, false, 'review-only delivery must never force-update a ref');
assert.equal(calls.some(call => /\/contents\//.test(call.url)), false, 'delivery must use one Git tree, not path-by-path production contents writes');
assert.equal(calls.some(call => call.body && call.body.force === true), false);

const existingCalls = [];
const existingFetch = async (url, request = {}) => {
  const method = request.method || 'GET';
  existingCalls.push({ url, method });
  if (method === 'GET' && url.endsWith('/repos/acme/site')) return response(200, { default_branch: 'main' });
  if (method === 'GET' && url.includes('/git/ref/heads/arwp/growth-proposal-')) return response(200, { ref: `refs/heads/${bundle.branch.name}` });
  return response(500, null, 'unexpected request after existing branch');
};
await assert.rejects(
  openGrowthProposalPr(bundle, { token: 'test-token', authorization: GROWTH_PR_AUTHORIZATION, fetchImpl: existingFetch }),
  /branch already exists/
);
assert.equal(existingCalls.some(call => call.method === 'POST'), false, 'existing proposal branch must stop delivery before any write');

console.log('PASS review-only Growth PR delivery requires explicit authorization/token, commits only .arwp/proposals artifacts through a new non-force branch, preserves every human gate, and refuses existing branches or production paths');
