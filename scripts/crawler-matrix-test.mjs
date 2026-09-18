import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs', 'crawler-matrix');
const currentPath = path.join(docs, 'crawlers.json');
const frozenPath = path.join(docs, 'history', '2026-09-05.json');
const historyPath = path.join(docs, 'history', 'index.json');
const noTrainingTemplatePath = path.join(docs, 'templates', 'search-visible-training-blocked.txt');
const openTemplatePath = path.join(docs, 'templates', 'search-and-training-open.txt');
const pagePath = path.join(docs, 'index.html');

for (const file of [currentPath, frozenPath, historyPath, noTrainingTemplatePath, openTemplatePath, pagePath]) {
  assert.ok(fs.existsSync(file), `missing crawler matrix file: ${path.relative(root, file)}`);
  assert.ok(fs.statSync(file).size > 100, `crawler matrix file is unexpectedly empty: ${path.relative(root, file)}`);
}

const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf8'));
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
const noTraining = fs.readFileSync(noTrainingTemplatePath, 'utf8');
const open = fs.readFileSync(openTemplatePath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

assert.equal(current.snapshotDate, '2026-09-18');
assert.equal(current.entries.length, 12);
assert.equal(current.methodology.officialSourcesOnly, true);
assert.equal(current.methodology.unknownStaysUnknown, true);
assert.equal(current.methodology.conflictsStayVisible, true);
assert.equal(current.methodology.noRankingPromise, true);
assert.match(current.methodology.rightsVsAccess, /separate from technical crawler access/i);
assert.equal(frozen.snapshotDate, '2026-09-05');
assert.equal(frozen.entries.length, 10);
assert.notDeepEqual(frozen, current, 'historical crawler snapshots must remain frozen when the current matrix advances');
assert.equal(history.snapshots[0].date, '2026-09-18');
assert.equal(history.snapshots[0].entries, 12);
assert.equal(history.snapshots[0].providers, 5);
assert.ok(history.snapshots.some(snapshot => snapshot.date === '2026-09-05' && snapshot.entries === 10), 'frozen 2026-09-05 snapshot must stay in history');

const ids = current.entries.map(entry => entry.id);
assert.equal(new Set(ids).size, ids.length, 'crawler entry IDs must be unique');
for (const entry of current.entries) {
  assert.ok(entry.officialSources?.length >= 1, `${entry.id} must have at least one official source`);
  assert.match(entry.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entry.reviewedAt <= current.snapshotDate, `${entry.id} review date cannot be newer than snapshot`);
  assert.notEqual(entry.robotsControl, 'allowed', `${entry.id} must describe control semantics, not a vague allowed flag`);
}
const byId = id => current.entries.find(entry => entry.id === id);

const oaiSearch = byId('openai-oai-searchbot');
const gptBot = byId('openai-gptbot');
assert.equal(oaiSearch.role, 'search-indexing');
assert.equal(oaiSearch.searchVisibilityUse, true);
assert.equal(oaiSearch.trainingUse, false);
assert.equal(gptBot.role, 'training');
assert.equal(gptBot.searchVisibilityUse, false);
assert.equal(gptBot.trainingUse, true);
assert.notEqual(oaiSearch.token, gptBot.token, 'OpenAI search and training controls must remain separate');

assert.equal(byId('anthropic-claude-searchbot').role, 'search-indexing');
assert.equal(byId('anthropic-claudebot').role, 'training');
assert.equal(byId('anthropic-claude-user').role, 'user-triggered');
assert.equal(byId('anthropic-claude-user').robotsControl, 'respects-robots');

const googlebot = byId('google-googlebot');
const googleExtended = byId('google-google-extended');
assert.equal(googlebot.searchVisibilityUse, true);
assert.equal(googleExtended.searchVisibilityUse, false);
assert.equal(googleExtended.separateHttpUserAgent, false);
assert.equal(googleExtended.robotsControl, 'robots-product-token');
assert.equal(googlebot.trainingUse, 'not-controlled-by-this-token');

const geminiNotebook = byId('google-gemini-notebook');
const googleAgent = byId('google-google-agent');
assert.equal(geminiNotebook.role, 'user-triggered');
assert.equal(geminiNotebook.token, 'Google-GeminiNotebook');
assert.equal(geminiNotebook.robotsControl, 'generally-ignores-robots-user-triggered');
assert.match(geminiNotebook.notes.join(' '), /Google-NotebookLM.*August 2026/i);
assert.equal(googleAgent.role, 'user-triggered-agent');
assert.equal(googleAgent.robotsControl, 'generally-ignores-robots-user-triggered');
assert.match(googleAgent.notes.join(' '), /Web Bot Auth/i);
assert.doesNotMatch(noTraining, /User-agent: Google-(?:Agent|GeminiNotebook)/, 'user-triggered Google agents must not be emitted as ordinary robots policy rules');
assert.doesNotMatch(open, /User-agent: Google-(?:Agent|GeminiNotebook)/, 'user-triggered Google agents must not be emitted as ordinary robots policy rules');

assert.equal(byId('perplexity-perplexitybot').trainingUse, false);
const perplexityUser = byId('perplexity-perplexity-user');
assert.equal(perplexityUser.status, 'official-source-conflict');
assert.equal(perplexityUser.robotsControl, 'unresolved-official-source-conflict');
assert.ok(perplexityUser.officialSources.length >= 2);
assert.match(perplexityUser.notes.join(' '), /unresolved/i);

const bingbot = byId('microsoft-bingbot');
assert.equal(bingbot.role, 'search-index-upstream');
assert.equal(bingbot.robotsControl, 'respects-robots');
assert.equal(bingbot.trainingUse, 'controlled-separately-by-page-meta');

for (const expected of [
  /User-agent: OAI-SearchBot\nAllow: \/[\s\S]*User-agent: GPTBot\nDisallow: \//,
  /User-agent: Claude-SearchBot\nAllow: \/[\s\S]*User-agent: ClaudeBot\nDisallow: \//,
  /User-agent: Googlebot\nAllow: \/[\s\S]*User-agent: Google-Extended\nDisallow: \//,
  /User-agent: PerplexityBot\nAllow: \//,
  /User-agent: Bingbot\nAllow: \//
]) assert.match(noTraining, expected);
assert.doesNotMatch(noTraining, /User-agent: Perplexity-User/, 'conflicted Perplexity-User behavior must not be emitted as a confident rule');

for (const token of ['OAI-SearchBot', 'GPTBot', 'Claude-SearchBot', 'Claude-User', 'ClaudeBot', 'Googlebot', 'Google-Extended', 'PerplexityBot', 'Bingbot']) {
  assert.match(open, new RegExp(`User-agent: ${token}`));
}
assert.doesNotMatch(open, /User-agent: Perplexity-User/);

assert.match(page, /AI search, user fetch and training are different decisions/i);
assert.match(page, /Official-source conflict/i);
assert.match(page, /search-visible-training-blocked\.txt/);
assert.match(page, /rights\.json/);

console.log('PASS AI crawler matrix preserves separate search/user/training/agent controls, advances dated snapshots without rewriting history, keeps user-triggered Google fetchers out of pretend robots rules, preserves Perplexity conflict, and publishes conservative reusable robots templates');
