import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadProfile, validateProfile } from '../lib/validator.mjs';

const referenceDir = path.resolve('examples/reference');
const referenceProfiles = fs.readdirSync(referenceDir)
  .filter(name => name.endsWith('.site-profile.json'))
  .sort()
  .map(name => path.join('examples/reference', name));

const examples = [
  'examples/minimal.site-profile.json',
  'examples/knowledge-site.site-profile.json',
  ...referenceProfiles
];

for (const file of examples) {
  const result = validateProfile(loadProfile(file));
  assert.equal(result.valid, true, `${file} should validate: ${JSON.stringify(result.errors)}`);
}

assert.equal(referenceProfiles.length, 5, 'The v0.1 reference suite should contain five real-site profiles.');

const missingRequired = loadProfile('examples/minimal.site-profile.json');
delete missingRequired.canonicalUrl;
assert.equal(validateProfile(missingRequired).valid, false, 'Missing canonicalUrl must fail validation.');

const falseRemoteMcp = loadProfile('examples/minimal.site-profile.json');
falseRemoteMcp.mcp = { servers: [{ name: 'example/server', transport: 'streamable-http' }] };
assert.equal(validateProfile(falseRemoteMcp).valid, false, 'streamable-http MCP must declare a URL.');

const falseStdioMcp = loadProfile('examples/minimal.site-profile.json');
falseStdioMcp.mcp = { servers: [{ name: 'example/local-server', transport: 'stdio' }] };
assert.equal(validateProfile(falseStdioMcp).valid, false, 'stdio MCP must declare package or source metadata.');

const sourceBackedStdioMcp = loadProfile('examples/minimal.site-profile.json');
sourceBackedStdioMcp.mcp = { servers: [{ name: 'example-source-server', transport: 'stdio', source: 'https://github.com/example/knowledge/tree/main/mcp/server', readOnly: true }] };
assert.equal(validateProfile(sourceBackedStdioMcp).valid, true, 'stdio MCP may be declared through a public source URL.');

const falseWebMcp = loadProfile('examples/minimal.site-profile.json');
falseWebMcp.agentWeb = { webmcp: { enabled: true } };
assert.equal(validateProfile(falseWebMcp).valid, false, 'Enabled WebMCP must declare at least one page.');

const falseSkillName = loadProfile('examples/minimal.site-profile.json');
falseSkillName.agentSkills = { skills: [{ name: 'Bad_Skill_Name', url: 'https://example.com/skills/bad/SKILL.md' }] };
assert.equal(validateProfile(falseSkillName).valid, false, 'Agent Skill names must follow the lowercase hyphenated naming contract.');

// Dogfood page semantics: HTML remains canonical; machine/source companions stay explicit and bounded.
const requiredSemanticFiles = [
  'registry/page-manifest.json', 'registry/entity-catalog.jsonld', 'docs/page-manifest.json', 'docs/entities/catalog.jsonld',
  'docs/product/index.html', 'docs/services/index.html', 'docs/maintainer/index.html', 'docs/events/index.html',
  'docs/events/2026-09-06-search-ai-playbook-release.html', 'docs/entities/index.html',
  'content/pages/product.md', 'content/pages/services.md', 'content/pages/maintainer.md',
  'content/pages/events/2026-09-06-search-ai-playbook-release.md'
];
for (const file of requiredSemanticFiles) assert.ok(fs.existsSync(file), `missing semantic surface: ${file}`);

const pageSemantics = JSON.parse(fs.readFileSync('registry/page-semantics-profiles.json', 'utf8'));
const publishedPageSemantics = JSON.parse(fs.readFileSync('docs/recommendations/page-semantics.json', 'utf8'));
assert.deepEqual(publishedPageSemantics, pageSemantics);
assert.equal(pageSemantics.version, '0.2');
for (const profile of ['service', 'offer-catalog', 'publication-event']) assert.ok(pageSemantics.profiles.some(item => item.id === profile), `missing page profile ${profile}`);
for (const rule of ['service-offer-catalog-semantics', 'publication-event-semantics', 'software-rich-result-eligibility', 'markdown-companion-source-policy']) assert.ok(pageSemantics.rules.some(item => item.id === rule), `missing page semantic rule ${rule}`);

const entityCatalog = JSON.parse(fs.readFileSync('registry/entity-catalog.jsonld', 'utf8'));
assert.deepEqual(JSON.parse(fs.readFileSync('docs/entities/catalog.jsonld', 'utf8')), entityCatalog);
const entities = entityCatalog['@graph'];
const software = entities.find(item => Array.isArray(item['@type']) && item['@type'].includes('SoftwareApplication'));
const maintainer = entities.find(item => item['@type'] === 'Person');
assert.equal(software.offers.price, 0);
assert.equal('aggregateRating' in software, false, 'do not fabricate software ratings');
assert.equal('review' in software, false, 'do not fabricate software reviews');
assert.ok(maintainer.sameAs.includes('https://github.com/dkharlanau'));
assert.ok(maintainer.sameAs.includes('https://www.linkedin.com/in/dkharlanau/'));
assert.equal(entities.filter(item => item['@type'] === 'Service').length, 4);
assert.ok(entities.some(item => item['@type'] === 'OfferCatalog'));
assert.ok(entities.some(item => item['@type'] === 'PublicationEvent'));

const manifest = JSON.parse(fs.readFileSync('registry/page-manifest.json', 'utf8'));
assert.deepEqual(JSON.parse(fs.readFileSync('docs/page-manifest.json', 'utf8')), manifest);
assert.equal(manifest.policy.canonicalSearchSurface, 'html');
assert.equal(manifest.policy.everyPageNeedsMarkdown, false);
assert.equal(manifest.policy.markdownIsRankingSignal, false);
for (const page of manifest.pages.filter(page => page.sourceMarkdown)) assert.equal(page.sourceMarkdown.publishedOnPages, false);

for (const [file, expected] of [
  ['docs/product/index.html', /SoftwareApplication/], ['docs/services/index.html', /OfferCatalog/],
  ['docs/maintainer/index.html', /ProfilePage/], ['docs/events/2026-09-06-search-ai-playbook-release.html', /PublicationEvent/],
  ['docs/entities/index.html', /Entity & Page Map/]
]) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\//);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, expected);
}
assert.match(fs.readFileSync('docs/product/index.html','utf8'), /no rating in the schema/i);
assert.match(fs.readFileSync('docs/services/index.html','utf8'), /not a paid consulting catalog/i);
assert.match(fs.readFileSync('docs/maintainer/index.html','utf8'), /LinkedIn profile/);
assert.match(fs.readFileSync('docs/maintainer/index.html','utf8'), /metkagram\.github\.io/);
assert.match(fs.readFileSync('docs/sitemap.xml','utf8'), /events\/2026-09-06-search-ai-playbook-release\.html/);
assert.match(fs.readFileSync('docs/answers/index.html','utf8'), /Structured project graph/);

await import('./regional-search-surfaces-test.mjs');
await import('./search-appearance-patch-test.mjs');

console.log(`PASS ${examples.length} profiles (${referenceProfiles.length} real references), 6 negative/conditional contract tests, structured product/service/profile/event dogfood surfaces, regional Search routing, and Search Appearance patch preparation`);
