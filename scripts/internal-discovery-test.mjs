import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeInternalDiscoveryFromPages, validateInternalDiscoveryReport } from '../lib/internal-discovery.mjs';
import { formatInternalDiscoveryMarkdown } from '../lib/internal-discovery-markdown.mjs';

const root = 'https://example.com/';
const html = body => `<!doctype html><html><head><title>Example</title></head><body>${body}</body></html>`;
const page = (url, body, extra = {}) => ({
  requestedUrl: url,
  url,
  ok: true,
  status: 200,
  contentType: 'text/html; charset=utf-8',
  headers: {},
  html: html(body),
  ...extra
});

// HTML-like payloads in inert markup are not source-document links. They
// cannot supply inbound evidence or exhaust the observation cap.
{
  const inert = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root, `<main>
      <script>const link = '<a href="/ghost">Fake</a>';</script>
      <style>.example::before { content: '<a href="/ghost">Fake</a>'; }</style>
      <template><section><a href="/ghost">Template</a><script>const x = '</template><a href="/ghost">Fake</a>';</script></section></template>
      <!-- <a href="/ghost">Comment</a> -->
      <a href="/real">Real link</a>
    </main>`, {maxLinksPerPage:2}),
    page(root+'ghost','<main>Ghost</main>'),
    page(root+'real','<main>Real</main>')
  ]});
  assert.equal(validateInternalDiscoveryReport(inert).valid,true);
  assert.deepEqual(inert.edges.map(edge=>edge.to),[root+'real']);
  assert.deepEqual(inert.gaps.withoutInbound,[root+'ghost']);
  assert.equal(inert.summary.truncatedPages,0);
  assert.equal(inert.summary.gapEvaluationState,'complete');
  const svg = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root,'<svg><a href="/real"><text>Diagram link</text></a></svg>'),
    page(root+'real','<main>Real</main>')
  ]});
  assert.equal(svg.edges[0].to,root+'real','existing SVG anchor behavior is preserved');
}

// A standalone none directive excludes a Google content owner; a preview
// setting whose value is none does not.
for (const [meta, headers, blocked] of [
  ['<meta name="robots" content="NoNe">', {}, true],
  ['<meta name="googlebot" content="none">', {}, true],
  ['<meta name="robots" content="all, none">', {}, true],
  ['', {xRobotsTag:'none'}, true],
  ['<meta name="robots" content="max-image-preview:none">', {}, false],
  ['<meta name="bingbot" content="none">', {}, false]
]) {
  const observed = analyzeInternalDiscoveryFromPages({canonicalUrl:root, pages:[page(root, '', {
    headers, html:`<!doctype html><html><head>${meta}</head><body><main>Example</main></body></html>`
  })]});
  assert.equal(observed.nodes[0].noindex, blocked);
  assert.equal(observed.nodes[0].nodeClass, blocked ? 'non-indexable-state' : 'canonical-owner');
  assert.equal(observed.summary.canonicalOwners, blocked ? 0 : 1);
  assert.equal(validateInternalDiscoveryReport(observed).valid, true);
}

// Scoped header rules apply to their crawler. A merged response may hide the
// boundary between another crawler's rule list and a separate global field.
for (const [header, nodeClass, noindex] of [
  ['googlebot: noindex', 'non-indexable-state', true],
  ['GoogleBot: NONE', 'non-indexable-state', true],
  ['bingbot: noindex', 'canonical-owner', false],
  ['googlebot-news: noindex', 'canonical-owner', false],
  ['bingbot: nofollow, noindex', 'unknown', false],
  ['bingbot: noindex, nofollow, none', 'unknown', false],
  ['noindex, bingbot: nofollow', 'non-indexable-state', true],
  ['bingbot: nofollow, googlebot: noindex', 'non-indexable-state', true],
  ['max-image-preview: none', 'canonical-owner', false],
  ['max-snippet: 0, noindex', 'non-indexable-state', true],
]) {
  const observed = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root, '<main>Root</main>', {headers:{xRobotsTag:header}}),
    page(root+'child', '<main>Child</main>')
  ]});
  assert.equal(validateInternalDiscoveryReport(observed).valid,true);
  assert.equal(observed.nodes[0].nodeClass,nodeClass,header);
  assert.equal(observed.nodes[0].noindex,noindex,header);
  if (nodeClass === 'unknown') {
    assert.ok(observed.nodes[0].evidence.includes('x-robots-tag-scope-ambiguous'));
    assert.equal(observed.summary.gapEvaluationState,'partial');
    assert.deepEqual(observed.gaps.withoutInbound,[]);
    assert.deepEqual(observed.gaps.withoutContinuation,[]);
    assert.match(formatInternalDiscoveryMarkdown(observed),/ambiguous crawler-specific indexing headers/);
  }
}

const pages = [
  page(root, `
    <header><nav><a href="/a">Section A</a></nav></header>
    <main>
      <p>Read <a href="/b">evidence guide B</a>.</p>
      <section class="related-topics"><a href="/c">Related topic C</a></section>
      <p><a href="/tool">Try the diagnostic tool</a></p>
      <p><a href="/old">Old B address</a></p>
    </main>`),
  page('https://example.com/a', '<main><h1>A</h1></main>'),
  page('https://example.com/legacy', '<main>legacy</main>', { requestedUrl: 'https://example.com/legacy', url: 'https://example.com/b', redirected: true }),
  page('https://example.com/b', '<main><h1>B</h1><p><a href="/c">Continue to topic C</a></p></main>'),
  page('https://example.com/c', '<main><h1>C</h1></main>'),
  page('https://example.com/tool', '<main><h1>Tool</h1></main>'),
  page('https://example.com/orphan', '<main><h1>Orphan candidate</h1></main>'),
  page('https://example.com/old', '<main><h1>Old B</h1></main>', { html: '<!doctype html><html><head><link rel="canonical" href="https://example.com/b"></head><body><main><h1>Old B</h1></main></body></html>' }),
  page('https://example.com/draft', '<main><h1>Draft</h1></main>', { html: '<!doctype html><html><head><meta name="robots" content="noindex"></head><body><main><h1>Draft</h1></main></body></html>' })
];

const report = analyzeInternalDiscoveryFromPages({ canonicalUrl: root, pages, generatedAt: '2026-09-09T18:00:00Z' });
assert.equal(validateInternalDiscoveryReport(report).valid, true);
assert.equal(report.summary.reviewedPages, 9);
assert.equal(report.summary.canonicalOwners, 6);
assert.equal(report.summary.redirectAliases, 1);
assert.equal(report.summary.canonicalAliases, 1);
assert.equal(report.summary.nonIndexableStates, 1);
assert.equal(report.summary.unknownNodes, 0);
assert.equal(report.summary.ownerEdges, 5);
assert.equal(report.summary.globalOwnerEdges, 1);
assert.equal(report.summary.contextualOwnerEdges, 2);
assert.equal(report.summary.hubOwnerEdges, 1);
assert.equal(report.summary.utilityOwnerEdges, 1);
assert.equal(report.summary.transitionEdges, 1);
assert.equal(report.summary.gapEvaluationState, 'complete');
assert.deepEqual(report.gaps.withoutInbound, ['https://example.com/orphan']);
assert.deepEqual(report.gaps.globalOnlyInbound, ['https://example.com/a']);
assert.ok(report.gaps.withoutContinuation.includes('https://example.com/a'));
assert.ok(report.gaps.withoutContinuation.includes('https://example.com/c'));
assert.ok(report.gaps.withoutContinuation.includes('https://example.com/tool'));
assert.deepEqual(report.gaps.transitionTargets, ['https://example.com/old']);
assert.ok(report.actions.some(item => item.url === 'https://example.com/orphan' && item.priority === 'P1'));
assert.ok(report.actions.some(item => item.url === 'https://example.com/a' && /global-only/i.test(item.title)));
assert.equal(new Set(report.actions.map(item => item.id)).size, report.actions.length,
  'each review has a distinct ID even when URLs share the same origin and prefix');
const continuationIds = report.actions.filter(item => item.id.startsWith('internal-discovery:continuation:'));
assert.ok(continuationIds.length >= 2);
assert.ok(continuationIds.every(item => /^internal-discovery:continuation:[a-f0-9]{64}$/.test(item.id)));
const reorderedReport = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[...pages].reverse(),generatedAt:'2026-09-09T18:00:00Z'});
const actionKeys = actions => actions.map(item => `${item.url}\n${item.title}\n${item.id}`).sort();
assert.deepEqual(actionKeys(reorderedReport.actions),actionKeys(report.actions), 'action IDs are stable across observation order');
const legacy = structuredClone(report);
legacy.actions[1].id = legacy.actions[0].id;
assert.equal(validateInternalDiscoveryReport(legacy).valid, true,
  'historical v0.1 reports remain schema-readable; old IDs alone are not safe unique keys');
assert.equal(report.guardrails.noPageRankApproximation, true);
assert.equal(report.guardrails.linkCountNotCausality, true);

{
  const selfOnly = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root,'<a href="#main">Skip to content</a><main id="main">Root</main>'),
    page(root+'self-only','<a href="#main">Skip to content</a><main id="main"><a href="/self-only/#part">Contents</a><h2 id="part">Part</h2></main>')
  ]});
  assert.equal(validateInternalDiscoveryReport(selfOnly).valid,true);
  assert.equal(selfOnly.summary.ownerEdges,0);
  assert.equal(selfOnly.summary.contextualOwnerEdges,0);
  assert.deepEqual(selfOnly.gaps.withoutInbound,[root+'self-only']);
  assert.ok(selfOnly.gaps.withoutContinuation.includes(root+'self-only'));
  assert.ok(selfOnly.edges.some(e=>e.from===root+'self-only'&&e.to===root+'self-only'), 'self links stay in raw evidence');
  const review=selfOnly.actions.find(a=>a.url===root+'self-only'&&a.id.startsWith('internal-discovery:inbound:'));
  assert.equal(review.status,'review');assert.match(review.reason,/bounded cohort/);
  assert.match(review.doesNotProve,/indexing/);

  const linked = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root,'<nav><a href="/self-only">Reference</a></nav>'),
    page(root+'self-only','<main><a href="#part">Contents</a><h2 id="part">Part</h2></main>')
  ]});
  assert.deepEqual(linked.gaps.withoutInbound,[]);
  assert.deepEqual(linked.gaps.globalOnlyInbound,[root+'self-only']);
  assert.equal(linked.summary.ownerEdges,1);
  assert.equal(linked.summary.globalOwnerEdges,1);
  assert.equal(linked.summary.contextualOwnerEdges,0);

  const capped = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root,'<a href="#main">Skip</a><main id="main"><a href="/self-only">Reference beyond cap</a></main>',{maxLinksPerPage:1}),
    page(root+'self-only','<main><a href="#part">Contents</a></main>')
  ]});
  assert.equal(capped.summary.gapEvaluationState,'partial');
  assert.deepEqual(capped.gaps.withoutInbound,[]);
  assert.deepEqual(capped.gaps.globalOnlyInbound,[]);
  assert.equal(capped.actions.some(a=>a.id.startsWith('internal-discovery:inbound:')),false);
}

const edge = (from, to) => report.edges.find(item => item.from === from && item.to === to);
assert.equal(edge(root, 'https://example.com/a').linkClass, 'global');
assert.equal(edge(root, 'https://example.com/b').linkClass, 'contextual');
assert.equal(edge(root, 'https://example.com/c').linkClass, 'hub');
assert.equal(edge(root, 'https://example.com/tool').linkClass, 'utility');
assert.equal(edge(root, 'https://example.com/old').targetState, 'transition');

{
  const anchors = analyzeInternalDiscoveryFromPages({canonicalUrl:root,generatedAt:'2026-09-09T18:00:00Z',pages:[
    page(root, `<main>
      <a href="/image" aria-label="Accessible label"><img src="/diagram.webp" alt="Assembly &amp; inspection guide"></a>
      <a href="/title" title="Part &lt;A&gt; reference"><img src="/icon.webp" alt=""></a>
      <a href="/visible" title="Unused title"><img src="/decorative.webp" alt="Unused image text">Visible guide</a>
      <a href="/empty" aria-label="Accessibility label only"><img src="/icon.webp" alt=""></a>
      <a href="/multiple"><picture><source srcset="/diagram.webp" alt="Not an img alternative"><IMG alt='First diagram' src="/a.webp"></picture><img alt="Second > third" src="/b.webp"></a>
      <a href="/ignored"><!-- <img alt="Comment text"> --><script>const s='<img alt="Script text">';</script><style>.x{content:'<img alt="Style text">'}</style><template><img alt="Template text"></template><img src="/decorative.webp" alt=""></a>
      <a href="/bounded"><img alt="${'x'.repeat(550)}" src="/large.webp"></a>
    </main>`)
  ]});
  const link=name=>anchors.edges.find(e=>e.to===root+name);
  assert.equal(validateInternalDiscoveryReport(anchors).valid,true);
  assert.equal(link('image').anchorText,'Assembly & inspection guide');
  assert.equal(link('title').anchorText,'Part <A> reference');
  assert.equal(link('visible').anchorText,'Visible guide');
  assert.equal(link('empty').anchorText,null);
  assert.equal(link('multiple').anchorText,'First diagram Second > third');
  assert.equal(link('ignored').anchorText,null);
  assert.equal(link('bounded').anchorText.length,500);
}

{
  const reordered = analyzeInternalDiscoveryFromPages({
    canonicalUrl: root,
    pages: [
      page(root, '<main><a href="/b">Direct owner</a><a href="/legacy">Legacy alias</a></main>'),
      page('https://example.com/b', '<main><h1>B owner</h1></main>'),
      page('https://example.com/legacy', '<main>legacy</main>', { requestedUrl: 'https://example.com/legacy', url: 'https://example.com/b' })
    ],
    generatedAt: '2026-09-09T18:00:00Z'
  });
  const direct = reordered.edges.find(item => item.to === 'https://example.com/b');
  const legacy = reordered.edges.find(item => item.to === 'https://example.com/legacy');
  assert.equal(direct.targetState, 'canonical-owner', 'direct canonical-owner classification must not depend on alias observation order');
  assert.equal(legacy.targetState, 'transition', 'a link to the requested alias URL must remain a transition');
  assert.equal(reordered.summary.redirectAliases, 1);
}

{
  const truncated = analyzeInternalDiscoveryFromPages({
    canonicalUrl: root,
    pages: [
      page(root, '<main><a href="/a">A</a><a href="/orphan">Orphan but beyond cap</a></main>', { maxLinksPerPage: 1 }),
      page('https://example.com/a', '<main>A</main>'),
      page('https://example.com/orphan', '<main>Orphan</main>')
    ],
    generatedAt: '2026-09-09T18:00:00Z'
  });
  assert.equal(truncated.summary.truncatedPages, 1);
  assert.equal(truncated.summary.gapEvaluationState, 'partial');
  assert.deepEqual(truncated.gaps.withoutInbound, [], 'inbound gaps must be suppressed when a canonical owner link sample is truncated');
  assert.deepEqual(truncated.gaps.globalOnlyInbound, []);
  assert.equal(truncated.actions.some(item => item.id.startsWith('internal-discovery:inbound:')), false);
  const map = formatInternalDiscoveryMarkdown(truncated);
  assert.match(map, /Inbound gap evaluation: \*\*partial\*\*/);
  assert.doesNotMatch(map, /Review a missing inbound crawlable path/);
}

{
  const failed = analyzeInternalDiscoveryFromPages({
    canonicalUrl: root,
    pages: [
      page(root, '<main>Home</main>'),
      { requestedUrl: 'https://example.com/fail', url: 'https://example.com/fail', ok: false, status: null, contentType: null, headers: {}, html: null }
    ],
    generatedAt: '2026-09-09T18:00:00Z'
  });
  assert.equal(failed.summary.unknownNodes, 1);
  assert.deepEqual(failed.gaps.unknownPages, ['https://example.com/fail']);
  assert.equal(failed.nodes.find(item => item.url.endsWith('/fail')).nodeClass, 'unknown');
  assert.match(formatInternalDiscoveryMarkdown(failed), /fail>\) — unknown/);
}

{
  const map = formatInternalDiscoveryMarkdown(report);
  assert.match(map, /bounded raw-HTML sample, not the whole site/);
  assert.match(map, /2026-09-09T18:00:00\.000Z/);
  assert.match(map, /example\.com\/b>\) — contextual/);
  assert.match(map, /example\.com\/old>\) — canonical-alias/);
  assert.doesNotMatch(map, /example\.com\/old>\) — contextual/);
  const hostile = structuredClone(report);
  hostile.cohort.selectionMethod = '<img src=x onerror=alert(1)> [bad](https://example.com)';
  assert.doesNotMatch(formatInternalDiscoveryMarkdown(hostile), /<img src/);
  assert.match(formatInternalDiscoveryMarkdown(hostile), /&lt;img/);
  assert.throws(() => formatInternalDiscoveryMarkdown({}), /Invalid internal discovery report/);
}

assert.throws(() => analyzeInternalDiscoveryFromPages({ canonicalUrl: 'http://example.com/', pages }), /HTTPS/);
assert.throws(() => analyzeInternalDiscoveryFromPages({ canonicalUrl: root, pages: [] }), /non-empty/);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-internal-discovery-'));
const cli = fileURLToPath(new URL('../bin/arwp-internal-discovery.mjs', import.meta.url));
try {
  const reportFile = path.join(directory, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.equal(run('validate', reportFile).status, 0);
  assert.match(run('validate', reportFile).stdout, /PASS Internal Discovery/);
  const mapFile = path.join(directory, 'map.md');
  assert.equal(run('markdown', reportFile, `--output=${mapFile}`).status, 0);
  assert.match(fs.readFileSync(mapFile, 'utf8'), /# Internal discovery map/);
  assert.equal(run('markdown', reportFile, `--output=${mapFile}`).status, 2, 'existing files are not overwritten');
  assert.equal(run('markdown', reportFile, '--output=').status, 2);
  assert.equal(run('--help').status, 0);
  assert.equal(run('validate').status, 2);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

{
  const sample = structuredClone(report);
  const edge = sample.edges.find(item => item.targetState === 'canonical-owner' && item.from !== item.to);
  assert.ok(edge);
  edge.anchorText = 'Read <img src=x> [guide]';
  const map = formatInternalDiscoveryMarkdown(sample);
  assert.match(map, /anchor: “Read &lt;img src=x&gt; &#91;guide&#93;”/);
  assert.doesNotMatch(map, /<img src=x>/);
  edge.anchorText = 'x'.repeat(180);
  assert.match(formatInternalDiscoveryMarkdown(sample), new RegExp(`anchor: “x{160}…”`));
  edge.anchorText = null;
  assert.match(formatInternalDiscoveryMarkdown(sample), /anchor not recorded/);
}

{
  const duplicate = analyzeInternalDiscoveryFromPages({canonicalUrl:root,pages:[
    page(root, '<main><a href="/guide"><img alt="" src="/image.svg"></a><a href="/guide">The useful guide</a>' +
      '<a href="/first">First useful label</a><a href="/first">Second useful label</a>' +
      '<a href="/empty"><img alt="" src="/image.svg"></a><a href="/empty"><img alt="" src="/other.svg"></a></main>'),
    page(root+'guide','<main>Guide</main>'), page(root+'first','<main>First</main>'), page(root+'empty','<main>Empty</main>')
  ]});
  assert.equal(validateInternalDiscoveryReport(duplicate).valid,true);
  const edgeTo = target => duplicate.edges.filter(item => item.from === root && item.to === root+target && item.linkClass === 'contextual');
  assert.equal(edgeTo('guide').length,1);
  assert.equal(edgeTo('guide')[0].anchorText,'The useful guide');
  assert.equal(edgeTo('first').length,1);
  assert.equal(edgeTo('first')[0].anchorText,'First useful label');
  assert.equal(edgeTo('empty').length,1);
  assert.equal(edgeTo('empty')[0].anchorText,null);
  assert.equal(duplicate.summary.ownerEdges,3);
}

console.log('PASS Internal Discovery keeps rendered owner relations, redirects/non-indexable states, structural link classes, observation ordering, partial coverage and Search outcome claims separate.');
