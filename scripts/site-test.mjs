import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const htmlPath = path.join(docs, 'index.html');
const cssPath = path.join(docs, 'arwp.css');
const jsPath = path.join(docs, 'arwp.js');
const directoryPath = path.join(docs, 'directory.json');

for (const file of [htmlPath, cssPath, jsPath, directoryPath]) {
  assert.ok(fs.existsSync(file), `missing static site file: ${path.relative(root, file)}`);
  assert.ok(fs.statSync(file).size > 100, `static site file is unexpectedly empty: ${path.relative(root, file)}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
assert.match(html, /Make your website understandable to AI agents/i);
assert.match(html, /It removes guessing about how a website can be used/i);
assert.match(html, /Without ARWP/i);
assert.match(html, /With ARWP/i);
assert.match(html, /Five real websites already publish ARWP profiles/i);
assert.match(html, /ARWP Directory/i);
assert.match(html, /Federated router/i);
assert.match(html, /data-scanner-endpoint=""/);
assert.match(html, /<meta name="description"/);
assert.match(html, /<link rel="canonical" href="https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/">/);
assert.match(html, /href="\.\/arwp\.css"/);
assert.match(html, /src="\.\/arwp\.js"/);
assert.match(html, /id="site-url"/);
assert.match(html, /node bin\/arwp\.mjs scan/);
assert.doesNotMatch(html, /single\s+AI[- ]readiness\s+score/i, 'site must not market an opaque AI-readiness score');

const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));
assert.equal(directory.sites.length, 5, 'public directory must contain the five reference sites');
for (const site of directory.sites) {
  assert.match(site.profileUrl, /^https:\/\/.+\/ai\/site-profile\.json$/);
  assert.ok(site.capabilities?.web, `${site.id} must declare web capability in the directory`);
}

const js = fs.readFileSync(jsPath, 'utf8');
assert.match(js, /url\.protocol !== 'https:'/);
assert.match(js, /fetch\('\.\/directory\.json'/, 'site may fetch only its same-origin directory for static rendering');
assert.match(js, /fetch\(scannerEndpoint/, 'hosted scan calls must use the fixed configured scanner endpoint');
assert.doesNotMatch(js, /fetch\(site\b|fetch\(siteInput|fetch\(normalizeSite/, 'user-provided URLs must never become a direct browser fetch target');

console.log('PASS ARWP project site explains user value, renders the reference directory, and keeps browser scanning behind a fixed configured endpoint');
