import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSiteFocusReportFromPages } from '../lib/site-focus-v2.mjs';

const profile = JSON.parse(fs.readFileSync(new URL('../docs/examples/site-focus-v0.3.profile.json', import.meta.url), 'utf8'));

const page = nav => `<!doctype html><html><head><title>Focused specialist site</title><meta name="description" content="A focused public website for owners who need one evidence-backed improvement."><link rel="canonical" href="https://example.com/"></head><body><nav>${nav}</nav><h1>Choose one clear site focus.</h1><p>Review the problem, evidence, outcome and next action.</p><a href="/focus/">Review focus</a></body></html>`;

const declaredLinks = '<a href="/focus/">Focus</a><a href="/improve/">Improve</a><a href="/evidence/">Evidence</a><a href="/about/">About</a>';

const brandReport = buildSiteFocusReportFromPages([
  { url: 'https://example.com/', html: page(`<a class="brand" href="/">Example Brand</a>${declaredLinks}`) }
], { canonicalUrl: 'https://example.com/', focusProfile: profile });

assert.equal(brandReport.metrics.primaryNavDestinations, 4, 'brand identity link to canonical root must not consume the owner navigation budget');
assert.equal(brandReport.declaredAlignment.navigation.unexpectedObserved.length, 0, 'brand identity link must not appear as undeclared navigation');
assert.equal(brandReport.experienceContract.navigation.observedPrimaryItems, 4);
assert.equal(brandReport.guardrails.brandIdentityHomeLinkExcludedFromDeclaredNavigation, true);
assert.ok(!brandReport.siteFindings.some(item => item.id === 'wide-primary-navigation'));
assert.ok(!brandReport.siteFindings.some(item => item.id === 'undeclared-primary-navigation'));

const explicitHomeReport = buildSiteFocusReportFromPages([
  { url: 'https://example.com/', html: page(`<a href="/">Home</a>${declaredLinks}`) }
], { canonicalUrl: 'https://example.com/', focusProfile: profile });

assert.equal(explicitHomeReport.metrics.primaryNavDestinations, 5, 'an explicit Home navigation item must remain part of the primary navigation');
assert.ok(explicitHomeReport.declaredAlignment.navigation.unexpectedObserved.includes('https://example.com/'), 'explicit Home is still undeclared when the owner contract omits it');

console.log('PASS Site Focus excludes canonical-root brand identity links from primary navigation while preserving explicit Home navigation items');
