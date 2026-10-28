import assert from 'node:assert/strict';
import { parse } from 'parse5';

// The homepage is maintained HTML, not a generated copy of the library.
// Fail closed if its displayed figures drift from the canonical corpus.
export function checkHomepageLibraryCounts(html, corpus) {
  const stack = [parse(html)], editions = [];
  while (stack.length) {
    const node = stack.pop();
    if (node.tagName === 'dl' && node.attrs?.some(a => a.name === 'class' && a.value.split(/\s+/).includes('goose-edition'))) editions.push(node);
    if (node.childNodes) stack.push(...node.childNodes);
  }
  assert.equal(editions.length, 1, 'Homepage must have one discoverability edition list.');
  const text = node => (node.childNodes || []).map(child => child.nodeName === '#text' ? child.value : text(child)).join('').trim();
  const items = editions[0].childNodes.filter(node => node.tagName === 'div').map(node => ({
    label: text(node.childNodes.find(child => child.tagName === 'dt') || {}),
    value: text(node.childNodes.find(child => child.tagName === 'dd') || {})
  }));
  for (const [label, expected] of [['Patterns', corpus.tactics.length], ['Sources', corpus.sources.length]]) {
    const matches = items.filter(item => item.label === label);
    assert.equal(matches.length, 1, `Homepage needs exactly one ${label} count.`);
    assert.equal(matches[0].value, String(expected), `Homepage ${label} count differs from canonical corpus.`);
  }
}

export function checkReadmeLibraryCounts(markdown, corpus) {
  const claims = [...markdown.matchAll(/\*\*(\d+) patterns, (\d+) sources and (\d+) categories\*\*[^\n]*?; (\d+) have an individual source-support review\./g)];
  assert.equal(claims.length, 1, 'README must contain one current library count and review claim.');
  const reviewed = corpus.tactics.filter(tactic => tactic.review?.reviewed_at != null).length;
  assert.deepEqual(claims[0].slice(1).map(Number), [corpus.tactics.length, corpus.sources.length, corpus.categories.length, reviewed],
    'README library counts or dated individual review count differ from canonical corpus.');
}
