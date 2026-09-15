type FeedItem = {
  title: string;
  url: string;
  description: string;
  published: string;
};

const SITE_URL = 'https://example.com';
const FEED_URL = `${SITE_URL}/feed.xml`;

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

function getFeedItems(): FeedItem[] {
  // Replace with the same canonical content source used by the public UI.
  return [{
    title: 'Example update',
    url: `${SITE_URL}/updates/example/`,
    description: 'A reviewed public update.',
    published: '2026-09-14T12:00:00Z'
  }];
}

export async function GET() {
  const items = getFeedItems()
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Example site updates</title>
    <link>${SITE_URL}/</link>
    <description>Reviewed public updates.</description>
    <language>en</language>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${new Date(item.published).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}

// Also expose autodiscovery from the root layout/head:
// <link rel="alternate" type="application/rss+xml" title="Example site updates" href="/feed.xml" />
