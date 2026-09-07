import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeEntityGraphPages, formatEntityGapReport } from '../lib/entity-gap.mjs';

const pages = [
  {url:'https://example.com/',html:`<link rel="canonical" href="https://example.com/"><h1>Acme Research</h1><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@id":"https://example.com/#org","@type":"Organization","name":"Acme Research","url":"https://example.com/"},{"@id":"https://example.com/#service","@type":"Service","name":"Evidence Audit","url":"https://example.com/services/","provider":{"@id":"https://example.com/#org"}}]}</script>`},
  {url:'https://example.com/services/',html:`<link rel="canonical" href="https://example.com/services/"><h1>Evidence Audit</h1><script type="application/ld+json">{"@id":"https://example.com/#service","@type":"Service","name":"Evidence Audit","url":"https://example.com/services/","provider":{"@id":"https://example.com/#org"}}</script>`},
  {url:'https://example.com/dataset/',html:`<link rel="canonical" href="https://example.com/dataset/"><h1>Cases Dataset</h1><script type="application/ld+json">{"@id":"https://example.com/#dataset","@type":"Dataset","name":"Cases Dataset","url":"https://example.com/dataset/"}</script>`},
  {url:'https://example.com/guide/',html:`<link rel="canonical" href="https://example.com/guide/"><h1>Implementation Guide</h1><script type="application/ld+json">{"@id":"https://example.com/#guide","@type":"TechArticle","name":"Implementation Guide","url":"https://example.com/guide/"}</script>`},
  {url:'https://example.com/events/launch/',html:`<link rel="canonical" href="https://example.com/events/launch/"><h1>Launch</h1><script type="application/ld+json">{"@id":"https://example.com/#launch","@type":"PublicationEvent","name":"Launch","url":"https://example.com/events/launch/","startDate":"2026-09-07T08:00:00Z"}</script>`},
  {url:'https://example.com/product/',html:`<link rel="canonical" href="https://example.com/product/"><h1>Widget</h1><script type="application/ld+json">{"@type":"Product","name":"Widget","url":"https://example.com/product/"}</script>`}
];

const report = analyzeEntityGraphPages(pages, { canonicalUrl: 'https://example.com/' });
assert.equal(report.reportVersion, '0.1');
assert.equal(report.scope, 'bounded-observed-entity-graph-not-ranking-score');
assert.equal(report.summary.entitiesObserved, 6);
assert.equal(report.summary.stableIds.observed, 5);
assert.equal(report.summary.visibleNameParity.observed, 6);
assert.equal(report.summary.entityPages.observed, 6);
assert.ok(report.gaps.some(gap => gap.family === 'Dataset' && /creator\|publisher/.test(gap.id)));
assert.ok(report.gaps.some(gap => gap.family === 'Dataset' && /license/.test(gap.id)));
assert.ok(report.gaps.some(gap => gap.family === 'Article' && /author/.test(gap.id)));
assert.ok(report.gaps.some(gap => gap.family === 'Event' && /location/.test(gap.id)));
assert.ok(report.gaps.some(gap => gap.family === 'Product' && gap.id.startsWith('stable-id:')));
assert.equal(report.gaps.some(gap => gap.family === 'Service' && /provider/.test(gap.id)), false);
assert.match(formatEntityGapReport(report), /Entity Graph Gap Report/);
assert.match(formatEntityGapReport(report), /not a ranking, rich-result, trust, or citation score/i);

const schema = JSON.parse(fs.readFileSync('schema/entity-gap-report.schema.json', 'utf8'));
assert.equal(schema.properties.scope.const, 'bounded-observed-entity-graph-not-ranking-score');
assert.equal(schema.properties.reportVersion.const, '0.1');

const publicPage = fs.readFileSync('docs/entities/gaps/index.html', 'utf8');
assert.match(publicPage, /Entity Graph Gap Report/i);
assert.match(publicPage, /node bin\/arwp-entities\.mjs/);
assert.match(publicPage, /not a ranking score/i);

console.log(`PASS entity graph gap analysis: ${report.summary.entitiesObserved} observed entities, ${report.gaps.length} explicit gaps, no universal readiness score`);
