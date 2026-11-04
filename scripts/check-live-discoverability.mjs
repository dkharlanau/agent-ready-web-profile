import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value ?? '';
const hasClass = (node, name) => attr(node, 'class').split(/\s+/).includes(name);

function elements(root, predicate) {
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(root);
  return matches;
}

function one(root, predicate, label) {
  const matches = elements(root, predicate);
  assert.equal(matches.length, 1, `Expected exactly one ${label}, found ${matches.length}`);
  return matches[0];
}

function textContent(root) {
  return [root.value ?? '', ...(root.childNodes ?? []).map(textContent)].join('').trim();
}

function canonicalUrl(htmlTree, pageUrl) {
  const link = one(htmlTree, node => node.tagName === 'link' && attr(node, 'rel').split(/\s+/).includes('canonical'), 'canonical link');
  return new URL(attr(link, 'href'), pageUrl).href;
}

function assertCategoryId(category) {
  assert.match(category.id ?? '', /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid evidence hub category id');
}

function checkHubDocument(html, url, indexUrl, title) {
  const document = parse(html);
  assert.equal(canonicalUrl(document, url), url, `Evidence hub canonical mismatch: ${url}`);
  const main = one(document, node => node.tagName === 'main', `main in ${url}`);
  const headings = elements(main, node => node.tagName === 'h1' && textContent(node));
  assert.ok(headings.length > 0, `Evidence hub has no heading: ${url}`);
  assert.equal(headings.length, 1, `Evidence hub has multiple headings: ${url}`);
  assert.equal(textContent(headings[0]), title, `Evidence hub heading does not match routing index: ${url}`);
  assert.ok(elements(document, node => node.tagName === 'a' && attr(node, 'href') && new URL(attr(node, 'href'), url).href === indexUrl).length > 0, `Evidence hub has no navigation back to library: ${url}`);
}

export function checkSourceProductionAlignment(sourceUrls, liveUrls, eventName) {
  const removed = liveUrls.filter(url => !sourceUrls.includes(url));
  assert.equal(removed.length, 0, `Previously published evidence hubs missing from source: ${removed.join(', ')}`);
  const unpublished = sourceUrls.filter(url => !liveUrls.includes(url));
  if (unpublished.length && eventName !== 'pull_request') {
    throw new Error(`Production missing source evidence hubs: ${unpublished.join(', ')}`);
  }
  return unpublished;
}

export async function checkSourceEvidenceHubs(categories, baseUrl, readSource = path => readFile(path, 'utf8')) {
  const base = new URL(baseUrl);
  const indexUrl = new URL('discoverability.html', base).href;
  for (const category of categories) {
    assertCategoryId(category);
    const url = new URL(`discoverability/${category.id}.html`, base).href;
    const sourcePath = new URL(`../docs/discoverability/${category.id}.html`, import.meta.url);
    let html;
    try {
      html = await readSource(sourcePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`Missing local source evidence hub: docs/discoverability/${category.id}.html`, { cause: error });
      }
      throw error;
    }
    checkHubDocument(html, url, indexUrl, category.title);
  }
}

export function checkDiscoverabilityLayout(html, index, baseUrl) {
  const base = new URL(baseUrl);
  const pageUrl = new URL('discoverability.html', base).href;
  const document = parse(html);
  assert.equal(canonicalUrl(document, pageUrl), pageUrl, 'Discoverability page must be canonical to its live URL');
  assert.ok(Array.isArray(index.categories) && index.categories.length > 0, 'Routing index has no categories');

  const section = one(document, node => node.tagName === 'section' && attr(node, 'id') === 'categories' && hasClass(node, 'category-hubs'), 'category hubs section');
  const grid = one(section, node => hasClass(node, 'category-grid'), 'category grid');
  const cards = elements(grid, node => node.tagName === 'a' && hasClass(node, 'category-card'));
  const expected = index.categories.map(category => {
    assertCategoryId(category);
    const url = new URL(category.url);
    assert.equal(url.origin, base.origin, `Evidence hub must be same-origin: ${url.href}`);
    assert.ok(url.pathname.startsWith(new URL('discoverability/', base).pathname), `Hub outside discoverability routes: ${url.href}`);
    assert.equal(url.search + url.hash, '', `Hub link cannot have query/fragment: ${url.href}`);
    assert.equal(url.href, new URL(`discoverability/${category.id}.html`, base).href, `Evidence hub route does not match category id: ${category.id}`);
    return url.href;
  });
  const found = cards.map(card => {
    assert.ok(textContent(card), 'Evidence hub card has no readable label');
    const href = attr(card, 'href');
    assert.ok(href, 'Evidence hub card has no href');
    return new URL(href, pageUrl).href;
  });
  assert.equal(new Set(found).size, found.length, 'Duplicate evidence hub links');
  assert.deepEqual([...found].sort(), [...expected].sort(), 'Evidence hub cards differ from routing index');

  const nav = one(document, node => node.tagName === 'nav' && attr(node, 'aria-label') === 'Primary', 'primary navigation');
  const navLinks = elements(nav, node => node.tagName === 'a').map(node => attr(node, 'href'));
  for (const id of ['categories', 'library', 'evidence-guide']) {
    assert.ok(elements(document, node => attr(node, 'id') === id).length === 1, `Missing/duplicate #${id} target`);
    assert.ok(navLinks.includes(`#${id}`), `Primary navigation does not link to #${id}`);
  }
  assert.ok(elements(document, node => node.tagName === 'a' && hasClass(node, 'goose-brand') && new URL(attr(node, 'href'), pageUrl).href === base.href).length > 0, 'Missing home/brand navigation');
  return found;
}

export async function checkEvidenceHubs(categories, baseUrl, fetchImpl = fetch) {
  const base = new URL(baseUrl);
  const indexUrl = new URL('discoverability.html', base).href;
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, categories.length) }, async () => {
    while (cursor < categories.length) {
      const category = categories[cursor++];
      const url = category.url;
      const response = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12000) });
      assert.equal(response.status, 200, `Evidence hub unavailable: ${url} (HTTP ${response.status})`);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/i, `Not HTML: ${url}`);
      assert.equal(response.url, url, `Evidence hub unexpectedly redirected: ${url}`);
      checkHubDocument(await response.text(), url, indexUrl, category.title);
      console.log(`Evidence hub OK: ${url}`);
    }
  }));
}

async function main() {
  const [liveFile, liveIndexFile, baseUrl] = process.argv.slice(2);
  if (!liveFile || !liveIndexFile || !baseUrl) throw new Error('Usage: node scripts/check-live-discoverability.mjs LIVE_HTML LIVE_INDEX BASE_URL');
  const [sourceHtml, sourceIndex, liveHtml, liveIndex] = await Promise.all([
    readFile('docs/discoverability.html', 'utf8'),
    readFile('docs/discoverability/index.json', 'utf8').then(JSON.parse),
    readFile(liveFile, 'utf8'),
    readFile(liveIndexFile, 'utf8').then(JSON.parse)
  ]);
  const sourceUrls = checkDiscoverabilityLayout(sourceHtml, sourceIndex, baseUrl);
  const liveUrls = checkDiscoverabilityLayout(liveHtml, liveIndex, baseUrl);
  // Existing live routes must not disappear in a PR; new PR routes may be unpublished.
  // Scheduled/manual runs must match the published routing inventory exactly.
  const unpublished = checkSourceProductionAlignment(sourceUrls, liveUrls, process.env.GITHUB_EVENT_NAME);
  console.log(`Source: ${sourceUrls.length} hubs; production: ${liveUrls.length} hubs; routes aligned: ${unpublished.length === 0}`);
  if (unpublished.length) console.warn(`WARNING: ${unpublished.length} PR evidence hubs not yet deployed; validate publication after merge.`);
  // Every route added by a PR must already have a real, structurally valid source page.
  await checkSourceEvidenceHubs(sourceIndex.categories, baseUrl);
  await checkEvidenceHubs(liveIndex.categories, baseUrl);
  console.log(`Live discoverability verification passed for ${liveUrls.length} evidence hubs.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
