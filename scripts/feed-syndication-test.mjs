import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile(new URL('../registry/feed-syndication.json', import.meta.url), 'utf8'));
const docs = await readFile(new URL('../docs/FEED-SYNDICATION.md', import.meta.url), 'utf8');
const staticExample = await readFile(new URL('../examples/rss/github-pages/generate-feed.mjs', import.meta.url), 'utf8');
const nextExample = await readFile(new URL('../examples/rss/nextjs/app/feed.xml/route.ts', import.meta.url), 'utf8');

assert.equal(registry.status, 'required-baseline');
const ids = new Set(registry.requirements.map((entry) => entry.id));
for (const id of ['FEED-01', 'FEED-02', 'FEED-03', 'FEED-04', 'FEED-05', 'FEED-06', 'FEED-07']) {
  assert(ids.has(id), `missing required feed rule ${id}`);
}
assert.match(docs, /application\/rss\+xml/);
assert.match(docs, /never list an RSS\/Atom\/JSON feed under a `Sitemap:` directive/i);
assert.match(staticExample, /<rss version="2\.0"/);
assert.match(staticExample, /application\/rss\+xml/);
assert.match(nextExample, /Content-Type['"]?: ['"]application\/rss\+xml; charset=utf-8/);
assert.match(nextExample, /<rss version="2\.0"/);

console.log(`feed-syndication: ${registry.requirements.length} requirements verified`);
