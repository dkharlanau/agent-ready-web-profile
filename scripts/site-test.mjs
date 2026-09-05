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
const historyHtmlPath = path.join(docs, 'history.html');
const historyCssPath = path.join(docs, 'history.css');
const historyJsonPath = path.join(docs, 'history.json');
const llmsPath = path.join(docs, 'llms.txt');
const deLlmsPath = path.join(docs, 'de', 'llms.txt');
const ruLlmsPath = path.join(docs, 'ru', 'llms.txt');
const localeManifestPath = path.join(docs, 'ai', 'locales.json');
const localizationPolicyPath = path.join(docs, 'LOCALIZATION.md');
const selfProfilePath = path.join(docs, 'ai', 'site-profile.json');

for (const file of [
  htmlPath,
  cssPath,
  jsPath,
  directoryPath,
  historyHtmlPath,
  historyCssPath,
  historyJsonPath,
  llmsPath,
  deLlmsPath,
  ruLlmsPath,
  localeManifestPath,
  localizationPolicyPath
]) {
  assert.ok(fs.existsSync(file), `missing static site file: ${path.relative(root, file)}`);
  assert.ok(fs.statSync(file).size > 100, `static site file is unexpectedly empty: ${path.relative(root, file)}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
assert.match(html, /Resolve how a website can actually be used by agents/i);
assert.match(html, /It removes guessing about how a website can be used/i);
assert.match(html, /Without a resolver/i);
assert.match(html, /With ARWP Resolver/i);
assert.match(html, /No format war required/i);
assert.match(html, /Five real websites already publish ARWP profiles/i);
assert.match(html, /ARWP Directory/i);
assert.match(html, /Federated router/i);
assert.match(html, /Benchmark utility before expanding the format/i);
assert.match(html, /data-scanner-endpoint=""/);
assert.match(html, /<meta name="description"/);
assert.match(html, /<link rel="canonical" href="https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/">/);
assert.match(html, /href="\.\/arwp\.css"/);
assert.match(html, /src="\.\/arwp\.js"/);
assert.match(html, /id="site-url"/);
assert.match(html, /node bin\/arwp\.mjs resolve/);
assert.match(html, /node bin\/arwp\.mjs explain/);
assert.match(html, /node bin\/arwp\.mjs plan/);
assert.match(html, /node bin\/arwp\.mjs scan/);
assert.match(html, /rel="describedby" type="text\/plain" href="\.\/llms\.txt" hreflang="en"/);
assert.match(html, /href="\.\/de\/llms\.txt" hreflang="de"/);
assert.match(html, /href="\.\/ru\/llms\.txt" hreflang="ru"/);
assert.match(html, /href="\.\/history\.html"/);
assert.match(html, /href="\.\/LOCALIZATION\.md"/);
assert.doesNotMatch(html, /single\s+AI[- ]readiness\s+score/i, 'site must not market an opaque AI-readiness score');

const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));
assert.equal(directory.sites.length, 5, 'public directory must contain the five reference sites');
for (const site of directory.sites) {
  assert.match(site.profileUrl, /^https:\/\/.+\/ai\/site-profile\.json$/);
  assert.ok(site.capabilities?.web, `${site.id} must declare web capability in the directory`);
}

const historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');
assert.match(historyHtml, /ARWP product history/i);
assert.match(historyHtml, /Active development/i);
assert.match(historyHtml, /Pre-stable/i);
assert.match(historyHtml, /25 Aug 2026/i);
assert.match(historyHtml, /v0\.1\.0/i);
assert.match(historyHtml, /multilingual agent discovery/i);

const history = JSON.parse(fs.readFileSync(historyJsonPath, 'utf8'));
assert.equal(history.status, 'active');
assert.equal(history.maturity, 'pre-stable');
assert.equal(history.startedAt, '2026-08-25');
assert.equal(history.versions.latestRelease, '0.1.0');
assert.ok(history.events.some(event => event.status === 'released' && /v0\.1\.0/.test(event.title)));
assert.ok(history.events.some(event => event.status === 'active' && /multilingual agent discovery/i.test(event.title)));

const locales = JSON.parse(fs.readFileSync(localeManifestPath, 'utf8'));
assert.equal(locales.canonicalLanguage, 'en');
assert.equal(locales.fallbackLanguage, 'en');
assert.deepEqual(locales.humanInterfaceLanguages, ['en']);
assert.deepEqual(locales.agentRoutingLanguages, ['en', 'de', 'ru']);
assert.equal(locales.selection.httpLanguageNegotiation, false);
for (const locale of locales.locales) {
  assert.match(locale.llms, /^https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/.+llms\.txt$/);
}

const englishLlms = fs.readFileSync(llmsPath, 'utf8');
const germanLlms = fs.readFileSync(deLlmsPath, 'utf8');
const russianLlms = fs.readFileSync(ruLlmsPath, 'utf8');
assert.match(englishLlms, /canonical English agent-routing surface/i);
assert.match(englishLlms, /Product history JSON/i);
assert.match(germanLlms, /kanonische technische Sprache/i);
assert.match(russianLlms, /канонический технический язык/i);

const selfProfile = JSON.parse(fs.readFileSync(selfProfilePath, 'utf8'));
assert.deepEqual(selfProfile.languages, ['en', 'de', 'ru']);
assert.equal(selfProfile.web.llms, 'https://dkharlanau.github.io/agent-ready-web-profile/llms.txt');
assert.equal(selfProfile.extensions['io.github.dkharlanau/localized-llms'].manifest, 'https://dkharlanau.github.io/agent-ready-web-profile/ai/locales.json');

const js = fs.readFileSync(jsPath, 'utf8');
assert.match(js, /url\.protocol !== 'https:'/);
assert.match(js, /fetch\('\.\/directory\.json'/, 'site may fetch only its same-origin directory for static rendering');
assert.match(js, /fetch\(endpoint/, 'hosted resolver calls must use a fixed route derived from the configured service endpoint');
assert.match(js, /fixedServiceRoute\('\/resolve'\)/, 'live UI must use the resolver route rather than direct browser fetching');
assert.doesNotMatch(js, /fetch\(site\b|fetch\(siteInput|fetch\(normalizeSite/, 'user-provided URLs must never become a direct browser fetch target');

console.log('PASS ARWP project site leads with resolver utility, publishes source-backed history and multilingual agent routing, and keeps browser resolution behind a fixed bounded service endpoint');
