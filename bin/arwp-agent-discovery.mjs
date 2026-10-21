#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fetchPublicText } from '../lib/public-fetch.mjs';
import { captureRepresentations, reviewRepresentations } from '../lib/agent-representations.mjs';
import { reviewAiAccess } from '../lib/ai-access-review.mjs';

const args = process.argv.slice(2);
const command = args[0];
const option = name => args.find(x => x.startsWith('--' + name + '='))?.slice(name.length + 3);
const read = value => JSON.parse(fs.readFileSync(path.resolve(value), 'utf8'));
if (args.includes('--help') || !['representations', 'ai-access'].includes(command)) {
  console.log('arwp representations --manifest=SITE-CONFIG.json [--output=PRIVATE-REPORT.json] [--captures=PRIVATE-CAPTURES.json]');
  console.log('arwp representations --input=PRIVATE-CAPTURES.json [--output=PRIVATE-REPORT.json]');
  console.log('arwp ai-access --manifest=SITE-CONFIG.json [--owner=PRIVATE-OWNER-CONTROLS.json] [--output=PRIVATE-REPORT.json]');
  console.log('Manifest: {version:"0.1",site:"https://example.test/",pages:[{url,markdownUrl?,contract?}]}. Maximum 20 same-property pages. No settings are changed.');
} else {
  try {
    let captures;
    if (option('input')) captures = read(option('input'));
    else {
      if (!option('manifest')) throw Error('A manifest or capture input is required.');
      const config = read(option('manifest')), site = new URL(config.site);
      if (config.version !== '0.1' || site.protocol !== 'https:' || !Array.isArray(config.pages) || config.pages.length < 1 || config.pages.length > 20) throw Error('Invalid bounded site manifest.');
      for (const page of config.pages) {
        const u = new URL(page.url);
        if (u.origin !== site.origin || !(u.pathname === site.pathname || u.pathname.startsWith(site.pathname.endsWith('/') ? site.pathname : site.pathname + '/'))) throw Error('Page is outside owner property.');
      }
      const pages = [];
      for (const page of config.pages) pages.push(await captureRepresentations(page));
      captures = { version: '0.1', site: site.href, pages };
      if (command === 'ai-access') {
        const requestedAt = new Date().toISOString();
        captures.robots = await fetchPublicText(new URL('/robots.txt', site).href, { accept: 'text/plain' })
          .catch(error => ({ ok: false, url: new URL('/robots.txt', site).href, status: null, error: error.message }));
        Object.assign(captures.robots, { requestedAt, observedAt: new Date().toISOString() });
      }
    }
    if (captures.version !== '0.1' || !Array.isArray(captures.pages) || captures.pages.length < 1 || captures.pages.length > 20) throw Error('Invalid bounded captures.');
    const ownerControls = option('owner') ? read(option('owner')) : null;
    const report = { version: '0.1', kind: command === 'representations' ? 'agent-representations' : 'ai-access', site: captures.site, captureScope: captures.scope || 'public-http',
      pages: captures.pages.map(page => command === 'representations' ? reviewRepresentations(page) : reviewAiAccess({ ...page, site: captures.site, robots: captures.robots, ownerControls })),
      noExternalMutation: true };
    const write = (target, value) => {
      const full = path.resolve(target);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    };
    if (option('captures')) write(option('captures'), captures);
    if (option('output')) write(option('output'), report);
    console.log(JSON.stringify(report, null, 2));
    if (report.pages.some(page => page.state === 'fail')) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
