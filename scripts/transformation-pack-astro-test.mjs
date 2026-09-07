import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileAstroSiteStateGraph } from '../lib/repository-mapper-astro.mjs';
import {
  listTransformationPacks,
  prepareTransformationPackOperation
} from '../lib/transformation-pack.mjs';
import {
  buildTransformationBundle,
  validateTransformationBundle
} from '../lib/transformation-engine.mjs';

const baseCommitSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function write(root, pathname, content) {
  const target = path.join(root, ...pathname.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function upgradeGraph(id, automationClass) {
  const recommendation = {
    id,
    title: id,
    priority: 'P1',
    lane: 'fixture',
    state: 'recommended',
    knowledgeState: 'current',
    authority: 'fixture',
    reason: 'fixture',
    condition: null,
    sources: ['https://example.com/source'],
    change: { automationClass, targets: ['fixture'], recipe: ['fixture'] },
    verification: { checks: ['fixture verification'], successState: 'verified' },
    measurement: { signals: [], ownerDataRequired: false },
    dependencies: [],
    addresses: { actionIds: [], verticalCheckIds: [] },
    evidence: []
  };
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-09-07T18:20:00.000Z',
    site: 'https://astro.example/',
    context: { verticals: ['documentation'], goals: ['search'] },
    knowledge: { registryVersion: '0.1', ruleset: 'fixture', reviewedAt: '2026-09-07', current: 1, reviewDue: 0 },
    summary: { recommended: 1, conditional: 0, reviewDue: 0, byPriority: { P1: 1 }, byAutomationClass: { [automationClass]: 1 } },
    sourceDebt: { actionIds: [], verticalCheckIds: [] },
    recommendations: [recommendation],
    waves: [{ priority: 'P1', recommendationIds: [id] }],
    guardrails: { noRankingGuarantee: true, noInventedFacts: true, ownerDataSeparate: true, productionMutationAuthorized: false, staleKnowledgeNeedsReview: true, negativeResultsPreserved: true }
  };
}

function map(root, extra = {}) {
  return compileAstroSiteStateGraph({
    root,
    repository: { fullName: 'owner/astro-site', baseRef: 'main', baseCommitSha },
    site: { origin: 'https://astro.example', basePath: '/' },
    generatedAt: '2026-09-07T18:21:00.000Z',
    ...extra
  });
}

assert.equal(listTransformationPacks({ adapter: 'astro' }).length, 1);
assert.equal(listTransformationPacks({ adapter: 'astro' })[0].id, 'astro-core-v0.1');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-pack-'));
const pageBefore = '<html><head><title>Astro Fixture</title></head><body><h1>Astro</h1></body></html>\n';
write(root, 'package.json', JSON.stringify({ dependencies: { astro: '^6.0.0' } }, null, 2));
write(root, 'astro.config.mjs', "export default { site: 'https://astro.example', output: 'static', build: { format: 'directory' } };\n");
write(root, 'src/pages/index.astro', pageBefore);
write(root, 'public/sitemap.xml', '<urlset></urlset>\n');
write(root, 'public/llms.txt', '# Astro fixture\n');

const graph = map(root);
assert.equal(graph.routes.find(route => route.routePath === '/').ownerPath, 'src/pages/index.astro');

const canonical = prepareTransformationPackOperation(graph, {
  packId: 'astro-core-v0.1',
  recipeId: 'canonical-link',
  recommendationId: 'astro-canonical',
  routePath: '/',
  beforeContent: pageBefore,
  inputs: { canonicalUrl: 'https://astro.example/' }
});
assert.equal(canonical.status, 'ready');
assert.equal(canonical.path, 'src/pages/index.astro');
const canonicalBundle = buildTransformationBundle(upgradeGraph('astro-canonical', 'mechanical'), {
  repository: { fullName: 'owner/astro-site', baseRef: 'main', baseCommitSha },
  allowedPaths: ['src/pages/index.astro'],
  operations: [canonical.operationSpec]
}, { generatedAt: '2026-09-07T18:22:00.000Z' });
assert.equal(validateTransformationBundle(canonicalBundle).valid, true);
assert.match(canonicalBundle.operations[0].after.content, /rel="canonical" href="https:\/\/astro\.example\/"/);

const jsonld = prepareTransformationPackOperation(graph, {
  packId: 'astro-core-v0.1',
  recipeId: 'source-backed-jsonld',
  recommendationId: 'astro-entity-proof',
  routePath: '/',
  beforeContent: pageBefore,
  inputs: { jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://astro.example/' } },
  reviewedGrounding: true,
  groundedEvidence: ['repo:src/data/site-identity.json']
});
assert.equal(jsonld.status, 'ready');
const jsonldBundle = buildTransformationBundle(upgradeGraph('astro-entity-proof', 'grounded-template'), {
  repository: { fullName: 'owner/astro-site', baseRef: 'main', baseCommitSha },
  allowedPaths: ['src/pages/index.astro'],
  operations: [jsonld.operationSpec]
}, { generatedAt: '2026-09-07T18:23:00.000Z' });
assert.equal(validateTransformationBundle(jsonldBundle).valid, true);
assert.equal(jsonldBundle.operations[0].humanReviewRequired, true);

const sitemapBefore = '<urlset></urlset>\n';
const sitemap = prepareTransformationPackOperation(graph, {
  packId: 'astro-core-v0.1',
  recipeId: 'machine-surface-replace',
  recommendationId: 'astro-sitemap',
  surfaceKey: 'machine:/sitemap.xml',
  beforeContent: sitemapBefore,
  inputs: { content: '<urlset><url><loc>https://astro.example/</loc></url></urlset>\n' },
  reviewedGrounding: true,
  groundedEvidence: ['repo:src/pages/index.astro']
});
assert.equal(sitemap.status, 'ready');
assert.equal(sitemap.path, 'public/sitemap.xml');
const sitemapBundle = buildTransformationBundle(upgradeGraph('astro-sitemap', 'grounded-template'), {
  repository: { fullName: 'owner/astro-site', baseRef: 'main', baseCommitSha },
  allowedPaths: ['public/sitemap.xml'],
  operations: [sitemap.operationSpec]
}, { generatedAt: '2026-09-07T18:24:00.000Z' });
assert.equal(validateTransformationBundle(sitemapBundle).valid, true);

const llmsBlocked = prepareTransformationPackOperation(graph, {
  packId: 'astro-core-v0.1',
  recipeId: 'machine-surface-replace',
  recommendationId: 'astro-llms',
  surfaceKey: 'machine:/llms.txt',
  beforeContent: '# Astro fixture\n',
  inputs: { content: '# changed\n' },
  reviewedGrounding: true,
  groundedEvidence: ['repo:README.md']
});
assert.equal(llmsBlocked.status, 'blocked');
assert.equal(llmsBlocked.reason, 'unsupported-surface-type');

const directHeadMissingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-layout-head-'));
write(directHeadMissingRoot, 'package.json', JSON.stringify({ dependencies: { astro: '^6.0.0' } }));
write(directHeadMissingRoot, 'astro.config.mjs', "export default { output: 'static' };\n");
write(directHeadMissingRoot, 'src/layouts/Base.astro', '<html><head><slot name="head" /></head><body><slot /></body></html>\n');
const indirectBefore = "---\nimport Base from '../layouts/Base.astro';\n---\n<Base><h1>Indirect head</h1></Base>\n";
write(directHeadMissingRoot, 'src/pages/index.astro', indirectBefore);
const indirectGraph = map(directHeadMissingRoot);
const noAnchor = prepareTransformationPackOperation(indirectGraph, {
  packId: 'astro-core-v0.1', recipeId: 'canonical-link', recommendationId: 'astro-canonical', routePath: '/', beforeContent: indirectBefore, inputs: { canonicalUrl: 'https://astro.example/' }
});
assert.equal(noAnchor.status, 'blocked');
assert.equal(noAnchor.reason, 'exact-single-head-close-required');

const serverRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-pack-server-'));
write(serverRoot, 'package.json', JSON.stringify({ dependencies: { astro: '^6.0.0' } }));
write(serverRoot, 'astro.config.mjs', "export default { output: 'server' };\n");
write(serverRoot, 'src/pages/index.astro', pageBefore);
const serverGraph = map(serverRoot);
const runtime = prepareTransformationPackOperation(serverGraph, {
  packId: 'astro-core-v0.1', recipeId: 'canonical-link', recommendationId: 'astro-canonical', routePath: '/', beforeContent: pageBefore, inputs: { canonicalUrl: 'https://astro.example/' }
});
assert.equal(runtime.status, 'blocked');
assert.equal(runtime.reason, 'unresolved-route-ownership');

const existingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-astro-pack-jsonld-'));
write(existingRoot, 'package.json', JSON.stringify({ dependencies: { astro: '^6.0.0' } }));
write(existingRoot, 'astro.config.mjs', "export default { output: 'static' };\n");
const existingBefore = '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script></head><body></body></html>\n';
write(existingRoot, 'src/pages/index.astro', existingBefore);
const existingGraph = map(existingRoot);
const existingJsonld = prepareTransformationPackOperation(existingGraph, {
  packId: 'astro-core-v0.1', recipeId: 'source-backed-jsonld', recommendationId: 'astro-entity-proof', routePath: '/', beforeContent: existingBefore,
  inputs: { jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://astro.example/' } }, reviewedGrounding: true, groundedEvidence: ['repo:identity.json']
});
assert.equal(existingJsonld.status, 'blocked');
assert.equal(existingJsonld.reason, 'existing-jsonld-needs-review');

console.log('PASS Astro Transformation Pack verifies Map -> Pack -> Transformation Engine handoff, direct-source anchors, grounding, public machine surfaces, runtime blocking, editorial llms blocking and existing JSON-LD conflict behavior');
