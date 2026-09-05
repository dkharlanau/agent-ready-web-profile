import assert from 'node:assert/strict';
import {
  ARD_BASE_CONTEXT,
  ARD_WELL_KNOWN_PATH,
  ARD_LEGACY_WELL_KNOWN_PATH,
  looksLikeArdEntry,
  validateArdEntry,
  normalizeArdEntry,
  parseAgentmapDirectives,
  extractArdHtml,
  collectArdDiscoverySources
} from '../lib/ard-v091.mjs';

const base = 'https://example.com/docs/page.html';

const entry = {
  '@context': [
    ARD_BASE_CONTEXT,
    { acme: 'https://acme.example/vocab#' }
  ],
  '@id': 'urn:air:example.com:server:weather',
  identifier: 'urn:air:example.com:server:weather',
  displayName: 'Weather Node',
  type: 'application/mcp-server-card+json',
  url: '/mcp/weather-card.json',
  description: 'Weather resource',
  representativeQueries: ['weather in Berlin', 'forecast for Minsk'],
  capabilities: ['WeatherTool'],
  'acme:serviceTier': 'enterprise',
  'acme:region': ['eu-central'],
  futureUnprefixedTerm: { preserve: true }
};

assert.equal(looksLikeArdEntry(entry), true);
const validated = validateArdEntry(entry, { baseUrl: base });
assert.equal(validated.valid, true, JSON.stringify(validated.issues));
assert.deepEqual(validated.warnings, []);

const normalized = normalizeArdEntry(entry, { sourceId: 'ard-inline:0', baseUrl: base, discoveredVia: 'html-jsonld' });
assert.equal(normalized.valid, true);
assert.equal(normalized.baseContext, ARD_BASE_CONTEXT);
assert.deepEqual(normalized.context, entry['@context']);
assert.equal(normalized.jsonLdId, entry['@id']);
assert.equal(normalized.url, 'https://example.com/mcp/weather-card.json');
assert.equal(normalized.extensionTerms['acme:serviceTier'], 'enterprise');
assert.deepEqual(normalized.extensionTerms['acme:region'], ['eu-central']);
assert.deepEqual(normalized.unknownTerms.futureUnprefixedTerm, { preserve: true });
assert.equal(normalized.discoveredVia, 'html-jsonld');

const withoutQueries = validateArdEntry({
  identifier: 'urn:air:example.com:skill:brief',
  displayName: 'Brief Skill',
  type: 'application/ai-skill+md',
  url: 'https://example.com/SKILL.md'
});
assert.equal(withoutQueries.valid, true, 'representativeQueries is a SHOULD, not a hard requirement');
assert.ok(withoutQueries.warnings.some(item => /representativeQueries/.test(item)));

const bothValueForms = validateArdEntry({
  identifier: 'urn:air:example.com:bad:both',
  displayName: 'Bad',
  type: 'application/example+json',
  url: 'https://example.com/a',
  data: {}
});
assert.equal(bothValueForms.valid, false);
assert.ok(bothValueForms.issues.some(item => /Exactly one/.test(item)));

const robots = `
User-agent: *
Allow: /
Agentmap: /.well-known/ard-extra.json
Agentmap: https://registry.example.net/catalog.json
Agentmap: /.well-known/ard-extra.json
`;
const agentmaps = parseAgentmapDirectives(robots, 'https://example.com/');
assert.deepEqual(agentmaps, [
  { url: 'https://example.com/.well-known/ard-extra.json', relation: 'agentmap', legacy: false },
  { url: 'https://registry.example.net/catalog.json', relation: 'agentmap', legacy: false }
]);

const html = `<!doctype html>
<html><head>
<link rel="ard" href="/.well-known/custom-ard.json" type="application/json">
<link rel="ai-catalog alternate" href="/legacy.json" type="application/json">
<script type="application/ld+json">
{
  "@context": [{"lab":"https://lab.example/ns#"}],
  "identifier":"urn:air:example.com:skill:inline",
  "displayName":"Inline Skill",
  "type":"application/ai-skill+md",
  "url":"/skills/inline/SKILL.md",
  "representativeQueries":["summarize this","create a brief"],
  "lab:quality":"reviewed"
}
</script>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@graph":[
    {"@type":"WebSite","name":"Example"},
    {
      "@context":{"x":"https://x.example/#"},
      "identifier":"urn:air:example.com:api:inline",
      "displayName":"Inline API",
      "type":"application/openapi+json",
      "url":"/openapi.json",
      "representativeQueries":["inspect api","find api schema"],
      "x:audience":"agents"
    }
  ]
}
</script>
</head><body></body></html>`;

const htmlDiscovery = extractArdHtml(html, base);
assert.deepEqual(htmlDiscovery.links, [
  { url: 'https://example.com/.well-known/custom-ard.json', relation: 'ard', legacy: false, mediaType: 'application/json' },
  { url: 'https://example.com/legacy.json', relation: 'ai-catalog', legacy: true, mediaType: 'application/json' }
]);
assert.equal(htmlDiscovery.entries.length, 2);
assert.equal(htmlDiscovery.entries[0].identifier, 'urn:air:example.com:skill:inline');
assert.equal(htmlDiscovery.entries[0].url, 'https://example.com/skills/inline/SKILL.md');
assert.equal(htmlDiscovery.entries[0].extensionTerms['lab:quality'], 'reviewed');
assert.equal(htmlDiscovery.entries[1].identifier, 'urn:air:example.com:api:inline');
assert.equal(htmlDiscovery.entries[1].extensionTerms['x:audience'], 'agents');
assert.deepEqual(htmlDiscovery.parseIssues, []);

const combined = collectArdDiscoverySources({ baseUrl: base, html, robotsText: robots });
assert.equal(combined.sources[0].url, `https://example.com${ARD_WELL_KNOWN_PATH}`);
assert.ok(combined.sources.some(item => item.relation === 'ard' && item.url.endsWith('/custom-ard.json')));
assert.ok(combined.sources.some(item => item.relation === 'agentmap' && item.url.endsWith('/ard-extra.json')));
assert.ok(combined.sources.some(item => item.relation === 'legacy-well-known' && item.url === `https://example.com${ARD_LEGACY_WELL_KNOWN_PATH}`));
assert.equal(combined.inlineEntries.length, 2);

const noLegacy = collectArdDiscoverySources({ baseUrl: base, html, robotsText: robots, includeLegacy: false });
assert.equal(noLegacy.sources.some(item => item.legacy), true, 'legacy HTML rel remains observable evidence even when conventional legacy probing is disabled');
assert.equal(noLegacy.sources.some(item => item.relation === 'legacy-well-known'), false);

const malformed = extractArdHtml('<script type="application/ld+json">{not json}</script>', base);
assert.equal(malformed.entries.length, 0);
assert.ok(malformed.parseIssues.some(item => /Invalid JSON-LD/.test(item)));

console.log('PASS ARD v0.91 preserves JSON-LD namespaces, discovers rel=ard and Agentmap sources, keeps predecessor evidence labeled legacy, and does not turn SHOULD guidance into hard failure');
