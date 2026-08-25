import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const htmlPath = path.join(docs, 'index.html');
const cssPath = path.join(docs, 'arwp.css');
const jsPath = path.join(docs, 'arwp.js');

for (const file of [htmlPath, cssPath, jsPath]) {
  assert.ok(fs.existsSync(file), `missing static site file: ${path.relative(root, file)}`);
  assert.ok(fs.statSync(file).size > 100, `static site file is unexpectedly empty: ${path.relative(root, file)}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
assert.match(html, /<meta name="description"/);
assert.match(html, /<link rel="canonical" href="https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/">/);
assert.match(html, /href="\.\/arwp\.css"/);
assert.match(html, /src="\.\/arwp\.js"/);
assert.match(html, /id="site-url"/);
assert.match(html, /node bin\/arwp\.mjs scan/);
assert.match(html, /not yet published to npm/i);
assert.doesNotMatch(html, /AI readiness score/i, 'site must not market an opaque AI-readiness score');

const js = fs.readFileSync(jsPath, 'utf8');
assert.match(js, /url\.protocol !== 'https:'/);
assert.doesNotMatch(js, /fetch\s*\(/, 'static project page must not become an arbitrary browser fetch proxy');

console.log('PASS static ARWP project site has required assets, truthful package status, and no arbitrary fetch proxy');
