import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const home = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
const guide = fs.readFileSync(path.join(docs, 'site-focus.html'), 'utf8');
const css = fs.readFileSync(path.join(docs, 'cite-goose.css'), 'utf8');
const brand = fs.readFileSync(path.join(docs, 'BRAND-GOOSE.md'), 'utf8');
const sitemap = fs.readFileSync(path.join(docs, 'sitemap.xml'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skills', 'arwp-site-focus', 'SKILL.md'), 'utf8');
const v3Guide = fs.readFileSync(path.join(docs, 'SITE-FOCUS-V0.3.md'), 'utf8');
const skillIndex = JSON.parse(fs.readFileSync(path.join(root, 'skills', 'index.json'), 'utf8'));
const publicSkillIndex = JSON.parse(fs.readFileSync(path.join(docs, 'skills', 'index.json'), 'utf8'));

assert.match(home, /Own a problem\.\s*<br>Draw the boundary\./i);
assert.match(home, /GOOSE \/ WE DO/i);
assert.match(home, /GOOSE \/ WE DO NOT/i);
assert.match(home, /01 \/ BE FOUND/i);
assert.match(home, /02 \/ BE USED/i);
assert.match(home, /03 \/ BE PROVEN/i);
assert.match(home, /up to three first-order lanes/i);
assert.match(home, /up to five primary navigation destinations/i);
assert.match(home, /href="\.\/site-focus\.html"/i);
assert.match(home, /<details id="resolver">/i, 'technical resolver depth should stay subordinate to the primary narrative');
assert.match(home, /<details id="examples">/i, 'reference directory should stay subordinate to the primary narrative');
assert.match(home, /<details id="research-depth">/i, 'research infrastructure should stay subordinate to the primary narrative');

const primaryNav = home.match(/<nav aria-label="Primary">([\s\S]*?)<\/nav>/i)?.[1] || '';
const navDestinations = [...primaryNav.matchAll(/<a\s+href=/gi)].length;
assert.ok(navDestinations <= 5, `primary nav should remain <= 5 destinations, found ${navDestinations}`);

assert.match(home, /<img class="goose-hero-art"[^>]+width="1024"[^>]+height="1024"/i, 'hero media should reserve dimensions');
assert.match(css, /\.focus-manifesto\{/);
assert.match(css, /\.lane-grid\{/);
assert.match(css, /\.technical-basement\{/);
assert.match(css, /@media\(max-width:700px\)/);

assert.match(guide, /One sentence before one hundred pages/i);
assert.match(guide, /IN[\s\S]*ADJACENT[\s\S]*OUT/i);
assert.match(guide, /These are house heuristics, not ranking factors or platform requirements/i);
assert.match(guide, /Every route needs a job/i);
assert.match(guide, /Be memorable without becoming heavy/i);

assert.match(skill, /Use this skill before `arwp-discoverability`/i);
assert.match(skill, /Prefer Site Focus v0\.3/i);
assert.match(skill, /primary_problem/i);
assert.match(skill, /we_do_not/i);
assert.match(skill, /primary homepage problem lane.*supporting lanes/i);
assert.match(skill, /up to 5.*primary navigation destinations/i);
assert.match(skill, /performance budgets before design expands/i);
assert.match(skill, /house heuristics or owner-declared budgets/i);
assert.match(skill, /field-data-required/i);
assert.match(skill, /never turn them into a composite readiness\/focus\/beauty score/i);

assert.match(v3Guide, /problem lanes/i);
assert.match(v3Guide, /homepage ownership/i);
assert.match(v3Guide, /navigation budget/i);
assert.match(v3Guide, /owner-declared-not-static-quality-scored/i);
assert.match(v3Guide, /field-data-required/i);
assert.match(v3Guide, /Existing v0\.2 profiles remain supported/i);

assert.ok(skillIndex.skills.some(item => item.name === 'arwp-site-focus' && item.role === 'site-focus-and-information-architecture'));
assert.equal(skillIndex.composition.siteFocus, 'arwp-site-focus');
assert.ok(skillIndex.composition.specialists.includes('arwp-site-focus'));
assert.ok(publicSkillIndex.skills.some(item => item.name === 'arwp-site-focus'));

assert.match(brand, /own a problem, not a pile of adjacent topics/i);
assert.match(brand, /up to 3 homepage problem lanes/i);
assert.match(sitemap, /site-focus\.html/);

console.log('PASS Goose keeps one visible problem territory, explicit anti-scope, small problem-led navigation, v0.3 homepage/experience contracts, bright lightweight design rules and a reusable Site Focus agent gate');
