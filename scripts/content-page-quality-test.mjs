import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  inspectContentPageDirectory,
  inspectContentPageQuality,
  urlForBuiltHtml
} from '../lib/content-page-quality.mjs';

const contract = JSON.parse(fs.readFileSync(new URL('../registry/content-page-quality-contract.json', import.meta.url), 'utf8'));
const comprehensive = JSON.parse(fs.readFileSync(new URL('../registry/comprehensive-site-audit.json', import.meta.url), 'utf8'));

assert.equal(contract.version, '0.1');
assert.equal(contract.enforcement.priorityDoesNotPermitSkipping, true);
assert.equal(contract.enforcement.notApplicableRequiresReason, undefined, 'notApplicableRequiresReason belongs to applicability in v0.1');
assert.equal(contract.applicability.notApplicableRequiresReason, true);
assert.equal(contract.distributionFooter.directShareTargets.minimum, 2);
assert.equal(contract.requirements.length, 12);
assert.deepEqual(
  contract.requirements.map(item => item.id),
  [
    'CPQ-01-page-identity-and-indexability',
    'CPQ-02-search-snippet-surface',
    'CPQ-03-social-preview-metadata',
    'CPQ-04-representative-share-image',
    'CPQ-05-end-of-content-sharing',
    'CPQ-06-sharing-accessibility-and-resilience',
    'CPQ-07-structured-content-semantics',
    'CPQ-08-favicon-and-page-image-separation',
    'CPQ-09-feedback-integrity',
    'CPQ-10-continuation-and-citation',
    'CPQ-11-share-and-feedback-measurement',
    'CPQ-12-final-artifact-family-gate'
  ]
);
assert.equal(comprehensive.version, '0.2');
assert.equal(comprehensive.applicabilityLedger.required, true);
assert.equal(comprehensive.applicabilityLedger.priorityDoesNotPermitSkipping, true);
assert.ok(comprehensive.linkedContracts.includes('registry/content-page-quality-contract.json'));
assert.ok(comprehensive.auditDomains.some(item => item.id === 'content-page-quality-distribution' && item.priority === 'P0'));

function pageHtml({ url = 'https://example.com/guides/share-well/', includeNativeShare = true, feedback = '' } = {}) {
  return `<!doctype html>
<html lang="en" data-arwp-content-detail>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>How to share a useful reference page</title>
  <meta name="description" content="A practical reference for reliable social previews, canonical sharing and accessible distribution controls.">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="How to share a useful reference page">
  <meta property="og:description" content="A practical reference for reliable social previews and accessible sharing.">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="https://example.com/assets/share-well-1200x630.png">
  <meta property="og:image:alt" content="Diagram of a canonical page flowing into social share previews">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"TechArticle","headline":"How to share a useful reference page","url":"${url}","image":"https://example.com/assets/share-well-1200x630.png"}</script>
</head>
<body>
<main>
  <article>
    <h1>How to share a useful reference page</h1>
    <p>This guide explains how a canonical content page can expose a reliable preview, a useful opening answer and distribution controls that continue to work when optional browser APIs are unavailable.</p>
    <p>The primary content remains readable and useful without the sharing JavaScript.</p>
  </article>
  <section data-arwp-distribution-footer aria-label="Share this page">
    ${includeNativeShare ? '<button type="button" data-arwp-share aria-label="Share this page">Share</button>' : ''}
    <button type="button" data-arwp-copy-link aria-label="Copy canonical link">Copy link</button>
    <a data-arwp-share-provider="linkedin" aria-label="Share on LinkedIn" href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.com%2Fguides%2Fshare-well%2F">LinkedIn</a>
    <a data-arwp-share-provider="telegram" aria-label="Share on Telegram" href="https://t.me/share/url?url=https%3A%2F%2Fexample.com%2Fguides%2Fshare-well%2F">Telegram</a>
    ${feedback}
  </section>
  <nav data-arwp-continuation aria-label="Continue from here"><a href="/guides/previews/">Understand social previews</a></nav>
</main>
</body>
</html>`;
}

function byId(report, id) {
  const item = report.checks.find(check => check.id === id);
  assert.ok(item, `missing check ${id}`);
  return item;
}

const valid = inspectContentPageQuality({ html: pageHtml(), url: 'https://example.com/guides/share-well/' });
assert.equal(valid.summary.p0Failures, 0);
assert.equal(valid.summary.p1Failures, 0);
assert.equal(valid.summary.strictPass, true);
assert.equal(byId(valid, 'CPQ-01-page-identity-and-indexability').status, 'pass');
assert.equal(byId(valid, 'CPQ-03-social-preview-metadata').status, 'pass');
assert.equal(byId(valid, 'CPQ-04-representative-share-image').status, 'pass');
assert.equal(byId(valid, 'CPQ-05-end-of-content-sharing').status, 'pass');
assert.equal(byId(valid, 'CPQ-06-sharing-accessibility-and-resilience').status, 'pass');
assert.equal(byId(valid, 'CPQ-07-structured-content-semantics').status, 'pass');
assert.equal(byId(valid, 'CPQ-09-feedback-integrity').status, 'not-applicable');
assert.equal(byId(valid, 'CPQ-12-final-artifact-family-gate').status, 'watch');
assert.deepEqual(valid.observations.providers, ['linkedin', 'telegram']);

const missingNativeShare = inspectContentPageQuality({
  html: pageHtml({ includeNativeShare: false }),
  url: 'https://example.com/guides/share-well/'
});
assert.equal(byId(missingNativeShare, 'CPQ-05-end-of-content-sharing').status, 'fail', 'direct-provider links must not masquerade as the required native/progressive Share control');
assert.equal(missingNativeShare.summary.p0Failures > 0, true);

const fakeFeedback = inspectContentPageQuality({
  html: pageHtml({
    feedback: '<button type="button" data-arwp-feedback aria-label="Useful">Yes</button><span data-arwp-feedback-count>99</span>'
  }),
  url: 'https://example.com/guides/share-well/'
});
assert.equal(byId(fakeFeedback, 'CPQ-09-feedback-integrity').status, 'fail');
assert.equal(fakeFeedback.summary.p1Failures, 1);

const realFeedback = inspectContentPageQuality({
  html: pageHtml({
    feedback: '<button type="button" data-arwp-feedback data-arwp-feedback-sink="analytics:content_useful" aria-label="Useful">Yes</button><span data-arwp-feedback-count data-arwp-feedback-aggregate-source="api:/feedback/aggregate">99</span>'
  }),
  url: 'https://example.com/guides/share-well/'
});
assert.equal(byId(realFeedback, 'CPQ-09-feedback-integrity').status, 'pass');

const wrongCanonical = inspectContentPageQuality({
  html: pageHtml().replaceAll('https://example.com/guides/share-well/', 'https://example.com/guides/other/'),
  url: 'https://example.com/guides/share-well/'
});
assert.equal(byId(wrongCanonical, 'CPQ-01-page-identity-and-indexability').status, 'fail');
assert.equal(byId(wrongCanonical, 'CPQ-03-social-preview-metadata').status, 'fail');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-cpq-'));
try {
  fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html><body><h1>Homepage</h1></body></html>');
  fs.mkdirSync(path.join(tmp, 'guides', 'share-well'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'guides', 'share-well', 'index.html'), pageHtml());
  fs.mkdirSync(path.join(tmp, 'about'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'about', 'index.html'), '<!doctype html><html><body><h1>About</h1></body></html>');

  assert.equal(
    urlForBuiltHtml(path.join(tmp, 'guides', 'share-well', 'index.html'), tmp, 'https://example.com/'),
    'https://example.com/guides/share-well/'
  );

  const family = inspectContentPageDirectory({
    root: tmp,
    baseUrl: 'https://example.com/',
    include(_file, _url, html) {
      return /\bdata-arwp-content-detail(?:\s*=|\s|>)/i.test(html);
    }
  });
  assert.equal(family.discoveredHtmlFiles, 3);
  assert.equal(family.auditedContentPages, 1);
  assert.equal(family.excludedHtmlFiles, 2);
  assert.equal(family.familyGate.strictPass, true);
  assert.equal(family.familyGate.runtimeEvidenceRequiredSeparately, true);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const skill = fs.readFileSync(new URL('../skills/arwp-content-page-quality/SKILL.md', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../docs/CONTENT-PAGE-QUALITY-CONTRACT.md', import.meta.url), 'utf8');
for (const phrase of ['Share', 'Copy link', 'navigator.share', 'not-applicable', 'fake', 'final generated']) {
  assert.ok(skill.includes(phrase), `content-page skill must mention ${phrase}`);
}
for (const phrase of ['Mandatory end-of-content distribution footer', '1200', 'feedback', 'strict applicability ledger']) {
  assert.ok(doc.toLowerCase().includes(phrase.toLowerCase()), `content-page documentation must mention ${phrase}`);
}

console.log('Content Page Quality contract tests passed.');
