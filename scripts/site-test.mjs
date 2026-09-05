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
const mediaHtmlPath = path.join(docs, 'media', 'index.html');
const mediaRightsPath = path.join(docs, 'media', 'rights.json');
const pressFactsPath = path.join(docs, 'media', 'press-facts.json');
const attributionPath = path.join(docs, 'media', 'attribution.txt');
const boilerplatePath = path.join(docs, 'media', 'boilerplate.txt');
const trustHtmlPath = path.join(docs, 'trust', 'index.html');
const trustJsonPath = path.join(docs, 'trust', 'trust.json');
const correctionsHtmlPath = path.join(docs, 'trust', 'corrections.html');
const correctionsJsonPath = path.join(docs, 'trust', 'corrections.json');
const securityPath = path.join(root, 'SECURITY.md');
const scorecardWorkflowPath = path.join(root, '.github', 'workflows', 'scorecard.yml');
const publishWorkflowPath = path.join(root, '.github', 'workflows', 'publish-ecosystem.yml');
const citationPath = path.join(root, 'CITATION.cff');

for (const file of [
  htmlPath, cssPath, jsPath, directoryPath, historyHtmlPath, historyCssPath, historyJsonPath,
  llmsPath, deLlmsPath, ruLlmsPath, localeManifestPath, localizationPolicyPath,
  mediaHtmlPath, mediaRightsPath, pressFactsPath, attributionPath, boilerplatePath,
  trustHtmlPath, trustJsonPath, correctionsHtmlPath, correctionsJsonPath,
  securityPath, scorecardWorkflowPath, publishWorkflowPath, citationPath
]) {
  assert.ok(fs.existsSync(file), `missing project file: ${path.relative(root, file)}`);
  assert.ok(fs.statSync(file).size > 100, `project file is unexpectedly empty: ${path.relative(root, file)}`);
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
assert.match(html, /href="\.\/trust\/">Trust<\/a>/);
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
  assert.match(locale.llms, /^https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/.*llms\.txt$/);
}

const englishLlms = fs.readFileSync(llmsPath, 'utf8');
const germanLlms = fs.readFileSync(deLlmsPath, 'utf8');
const russianLlms = fs.readFileSync(ruLlmsPath, 'utf8');
assert.match(englishLlms, /canonical English agent-routing surface/i);
assert.match(englishLlms, /Product history JSON/i);
assert.match(englishLlms, /Open media & AI reuse/i);
assert.match(englishLlms, /ARWP Trust Center/i);
assert.match(englishLlms, /no DOI is currently claimed/i);
assert.match(englishLlms, /AI\/ML training and dataset inclusion: permitted/i);
assert.match(germanLlms, /kanonische technische Sprache/i);
assert.match(russianLlms, /канонический технический язык/i);

const mediaHtml = fs.readFileSync(mediaHtmlPath, 'utf8');
assert.match(mediaHtml, /Open Media & AI Reuse Pack/i);
assert.match(mediaHtml, /No permission request required/i);
assert.match(mediaHtml, /AI & machine use/i);
assert.match(mediaHtml, /CC BY 4\.0/i);

const rights = JSON.parse(fs.readFileSync(mediaRightsPath, 'utf8'));
assert.equal(rights.permissionRequired, false);
assert.equal(rights.license.spdx, 'CC-BY-4.0');
assert.equal(rights.permissions.press, true);
assert.equal(rights.permissions.news, true);
assert.equal(rights.permissions.aiTraining, true);
assert.equal(rights.permissions.embedding, true);
assert.equal(rights.permissions.retrievalAugmentedGeneration, true);
assert.equal(rights.attribution.requiredForPublicReuse, true);
assert.match(rights.attribution.sourceUrl, /^https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/$/);
assert.ok(rights.doesNotApplyTo.some(item => /third-party/i.test(item)));

const pressFacts = JSON.parse(fs.readFileSync(pressFactsPath, 'utf8'));
assert.equal(pressFacts.project.shortName, 'ARWP');
assert.equal(pressFacts.status.maturity, 'pre-stable');
assert.equal(pressFacts.licenses.openMedia.spdx, 'CC-BY-4.0');
assert.ok(pressFacts.facts.length >= 4);

const trustHtml = fs.readFileSync(trustHtmlPath, 'utf8');
const correctionsHtml = fs.readFileSync(correctionsHtmlPath, 'utf8');
const trust = JSON.parse(fs.readFileSync(trustJsonPath, 'utf8'));
const corrections = JSON.parse(fs.readFileSync(correctionsJsonPath, 'utf8'));
assert.match(trustHtml, /Trust should be inspectable/i);
assert.match(trustHtml, /No DOI is claimed yet/i);
assert.match(trustHtml, /provenance and SBOM attestations prove scoped build\/dependency facts/i);
assert.match(correctionsHtml, /Corrections stay visible/i);
assert.match(correctionsHtml, /No material published factual correction/i);
assert.equal(trust.maturity, 'pre-stable');
assert.equal(trust.reviewModel.primarySourcesPreferred, true);
assert.equal(trust.reviewModel.correctionsVisible, true);
assert.equal(trust.softwareSupplyChain.githubArtifactAttestation.status, 'configured-for-next-npm-publish');
assert.equal(trust.softwareSupplyChain.sbomAttestation.status, 'configured-for-next-npm-publish');
assert.equal(trust.softwareSupplyChain.sbomAttestation.format, 'CycloneDX');
assert.equal(trust.softwareSupplyChain.mcpPublisherDependency.status, 'version-and-digest-pinned');
assert.equal(trust.persistentIdentifiers.doi.status, 'prepared-not-issued');
assert.equal(trust.softwareSupplyChain.openSSFScorecard.status, 'configured');
assert.equal(corrections.entries.length, 0);
assert.equal(corrections.policy.historicalRecordsAreNotSilentlyRewritten, true);

const selfProfile = JSON.parse(fs.readFileSync(selfProfilePath, 'utf8'));
assert.deepEqual(selfProfile.languages, ['en', 'de', 'ru']);
assert.equal(selfProfile.web.llms, 'https://dkharlanau.github.io/agent-ready-web-profile/llms.txt');
assert.equal(selfProfile.extensions['io.github.dkharlanau/localized-llms'].manifest, 'https://dkharlanau.github.io/agent-ready-web-profile/ai/locales.json');
assert.equal(selfProfile.extensions['io.github.dkharlanau/open-media-ai-reuse'].permissionRequired, false);
assert.equal(selfProfile.extensions['io.github.dkharlanau/open-media-ai-reuse'].license, 'CC-BY-4.0');
assert.equal(selfProfile.extensions['io.github.dkharlanau/trust-center'].doi, 'prepared-not-issued');
assert.equal(selfProfile.extensions['io.github.dkharlanau/trust-center'].artifactAttestation, 'configured-for-next-npm-publish');
assert.ok(selfProfile.data.distributions.some(item => item.url.endsWith('/media/rights.json')));
assert.ok(selfProfile.data.distributions.some(item => item.url.endsWith('/trust/trust.json')));
assert.ok(selfProfile.data.distributions.some(item => item.url.endsWith('/trust/corrections.json')));

const security = fs.readFileSync(securityPath, 'utf8');
assert.match(security, /Please do not publish exploit details in a public issue/i);
assert.match(security, /SSRF or private-network reachability bypasses/i);

const scorecardWorkflow = fs.readFileSync(scorecardWorkflowPath, 'utf8');
assert.match(scorecardWorkflow, /ossf\/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc/);
assert.match(scorecardWorkflow, /publish_results: true/);
assert.match(scorecardWorkflow, /id-token: write/);

const publishWorkflow = fs.readFileSync(publishWorkflowPath, 'utf8');
assert.match(publishWorkflow, /attestations: write/);
assert.match(publishWorkflow, /actions\/attest@1e69f48acb82d1966a394da916b4c1698aa569d6/);
assert.match(publishWorkflow, /npm sbom --sbom-format=cyclonedx/);
assert.match(publishWorkflow, /sbom-path: npm-sbom\.cdx\.json/);
assert.match(publishWorkflow, /Pack exact npm artifact/);
assert.match(publishWorkflow, /Publish exact attested tarball/);
assert.match(publishWorkflow, /mcp-publisher_linux_amd64\.tar\.gz/);
assert.match(publishWorkflow, /a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc/);
assert.doesNotMatch(publishWorkflow, /releases\/latest\/download/, 'publish workflow must not execute a mutable latest MCP publisher artifact');

const citation = fs.readFileSync(citationPath, 'utf8');
assert.match(citation, /version: "0\.1\.0"/);
assert.match(citation, /date-released: "2026-08-25"/);
assert.doesNotMatch(citation, /\bdoi:\s*/i, 'CITATION.cff must not claim a DOI before an external provider issues one');

const js = fs.readFileSync(jsPath, 'utf8');
assert.match(js, /url\.protocol !== 'https:'/);
assert.match(js, /fetch\('\.\/directory\.json'/, 'site may fetch only its same-origin directory for static rendering');
assert.match(js, /fetch\(endpoint/, 'hosted resolver calls must use a fixed route derived from the configured service endpoint');
assert.match(js, /fixedServiceRoute\('\/resolve'\)/, 'live UI must use the resolver route rather than direct browser fetching');
assert.doesNotMatch(js, /fetch\(site\b|fetch\(siteInput|fetch\(normalizeSite/, 'user-provided URLs must never become a direct browser fetch target');

console.log('PASS ARWP site publishes resolver utility, evidence-backed discovery, open reuse, security, corrections and verifiable trust/provenance surfaces without fabricating DOI or readiness claims');
