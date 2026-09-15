import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Replace this array with records derived from the site's canonical content source.
const items = [
  {
    title: 'Example release',
    url: 'https://example.github.io/project/updates/example-release/',
    description: 'A reviewed public update.',
    published: '2026-09-14T12:00:00Z'
  }
];

const siteUrl = 'https://example.github.io/project/';
const feedUrl = `${siteUrl}feed.xml`;
const outputRoot = resolve('dist');

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const rfc822 = (value) => new Date(value).toUTCString();
const ordered = [...items].sort((a, b) => new Date(b.published) - new Date(a.published));
const lastBuildDate = ordered.length ? rfc822(ordered[0].published) : rfc822('2026-09-14T00:00:00Z');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Example site updates</title>
    <link>${siteUrl}</link>
    <description>Reviewed updates from the example site.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${ordered.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${rfc822(item.published)}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;

await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'feed.xml'), xml, 'utf8');
console.log(`wrote ${resolve(outputRoot, 'feed.xml')}`);

// Render this in the shared HTML head/template as well:
// <link rel="alternate" type="application/rss+xml" title="Example site updates" href="https://example.github.io/project/feed.xml">
