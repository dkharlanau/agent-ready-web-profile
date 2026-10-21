// Copy into a site's scripts/. ARWP remains an operator tool, not a browser dependency.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'representations';
const arwpRoot = process.env.ARWP_ROOT;
const outputRoot = process.env.ARWP_REPORT_DIR;
if (!arwpRoot || !outputRoot) throw Error('Set ARWP_ROOT to the reviewed ARWP checkout and ARWP_REPORT_DIR to a private directory outside Git.');
fs.mkdirSync(outputRoot, { recursive: true });
const actualOutput = fs.realpathSync(outputRoot);
for (let directory = actualOutput; ; directory = path.dirname(directory)) {
  if (fs.existsSync(path.join(directory, '.git'))) throw Error('Owner reports must remain outside every Git repository.');
  if (directory === path.dirname(directory)) break;
}
const configFile = path.resolve('.arwp/agent-discovery.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
let localInput;
if (process.env.ARWP_LOCAL_BASE && ['representations', 'ai-access'].includes(mode)) {
  const base = new URL(process.env.ARWP_LOCAL_BASE);
  if (base.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('ARWP_LOCAL_BASE must be an explicit HTTP loopback origin.');
  const capture = async (publicUrl, accept) => {
    const source = new URL(publicUrl), target = new URL(source.pathname + source.search, base);
    const requestedAt = new Date().toISOString();
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { accept } });
    let bytes = 0; const chunks = [];
    for await (const chunk of response.body || []) {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) throw Error('Local capture exceeded the two MiB budget.');
      chunks.push(chunk);
    }
    const headers = Object.fromEntries(['vary', 'link', 'content-signal', 'content-usage', 'x-robots-tag'].map(key => [key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), response.headers.get(key)]));
    return { url: target.href, requestedUrl: target.href, canonicalBaseUrl: publicUrl, requestedAt, observedAt: new Date().toISOString(),
      ok: response.ok, status: response.status, contentType: response.headers.get('content-type'), headers, bytes, text: Buffer.concat(chunks).toString('utf8') };
  };
  const pages = [];
  for (const page of config.pages) pages.push({ ...page, html: await capture(page.url, 'text/html'), markdown: await capture(page.markdownUrl || page.url, 'text/markdown') });
  const captures = { version: '0.1', site: config.site, scope: 'local-runtime', pages };
  if (mode === 'ai-access') captures.robots = await capture(new URL('/robots.txt', config.site).href, 'text/plain');
  localInput = path.join(actualOutput, mode+'-local-captures.json');
  fs.writeFileSync(localInput, JSON.stringify(captures, null, 2)+'\n', { flag: 'wx' });
}
let args;
if (['representations', 'ai-access'].includes(mode)) {
  args = [mode, localInput ? '--input='+localInput : '--manifest='+configFile, '--output='+path.join(actualOutput, mode+'.json')];
  if (mode === 'ai-access' && process.env.ARWP_OWNER_CONTROLS) args.push('--owner='+process.env.ARWP_OWNER_CONTROLS);
} else if (mode === 'bing-template') args = ['bing', 'topics-template', '--site='+config.site, '--output='+path.join(actualOutput, 'bing-topics-input.json'), '--json'];
else if (mode === 'bing-review') {
  if (!process.env.BING_TOPICS_INPUT) throw Error('Set BING_TOPICS_INPUT to the private normalized input; no provider data is inferred.');
  args = ['bing', 'topics-inspect', '--input='+process.env.BING_TOPICS_INPUT, '--output='+path.join(actualOutput, 'bing-topics-review.json'), '--json'];
} else throw Error('Use representations, ai-access, bing-template or bing-review.');
const result = spawnSync(process.execPath, [path.resolve(arwpRoot, 'bin/arwp.mjs'), ...args], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
