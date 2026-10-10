import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../lib/discoverability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const corpus = loadCorpus();
const count = corpus.tactics.length;
const categories = corpus.categories.length;
const base = 'https://dkharlanau.github.io/agent-ready-web-profile/';

function replaceRequired(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`Unable to synchronize ${label}: expected source text was not found.`);
  return text.replace(pattern, replacement);
}

function syncLlms() {
  const file = path.join(docs, 'llms.txt');
  let text = fs.readFileSync(file, 'utf8');
  const begin = '<!-- BEGIN DISCOVERABILITY ROUTING -->';
  const end = '<!-- END DISCOVERABILITY ROUTING -->';
  const block = [
    begin,
    `- [Discoverability Library](${base}discoverability.html): ${count} concrete practices across ${categories} bounded categories with source, verification and native hypothesis/rule routing.`,
    `- [Discoverability routing index](${base}discoverability/index.json): lightweight category → evidence-hub → stable pattern-ID routing without duplicating the full corpus.`,
    `- [Discoverability evidence hubs](${base}sitemap.md#discoverability-evidence-hubs): ${categories} static topical routes with full implementation, verification, measurement and source detail.`,
    `- [Machine-readable corpus](${base}knowledge/discoverability-corpus.json): canonical full pattern payload; planning material, not measured ranking-effect evidence.`,
    end
  ].join('\n');

  const start = text.indexOf(begin);
  const finish = text.indexOf(end);
  if (start >= 0 || finish >= 0) {
    if (start < 0 || finish < start) throw new Error('Malformed discoverability routing block in docs/llms.txt.');
    text = `${text.slice(0, start)}${block}${text.slice(finish + end.length)}`;
  } else {
    const legacy = /- \[Discoverability Library\]\(https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/discoverability\.html\): \d+ concrete practices[^\n]*\n- \[Machine-readable corpus\]\(https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/knowledge\/discoverability-corpus\.json\):[^\n]*/;
    text = replaceRequired(text, legacy, block, 'docs/llms.txt discoverability routing');
  }
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function syncGrowth() {
  const file = path.join(docs, 'growth', 'index.html');
  let text = fs.readFileSync(file, 'utf8');
  const previousLoop = /<div class="direct-answer"><strong>Loop:<\/strong> research → classify → (?:technical preflight → )?baseline → hypothesis → implement → verify → measure → keep \/ revise \/ revert\.<\/div>/;
  const currentLoop = /<div class="direct-answer"><strong>The short version:<\/strong>[^<]*<\/div><details><summary>Full technical workflow<\/summary><p>research → classify → technical preflight → baseline → hypothesis → implement → verify → measure → keep \/ revise \/ revert\.<\/p><\/details>/;
  if (previousLoop.test(text)) {
    text = text.replace(previousLoop, '<div class="direct-answer"><strong>The short version:</strong> choose a problem → check the page → make one useful change → confirm it is live → look at the result → keep it or revise it.</div><details><summary>Full technical workflow</summary><p>research → classify → technical preflight → baseline → hypothesis → implement → verify → measure → keep / revise / revert.</p></details>');
  } else if (!currentLoop.test(text)) {
    throw new Error('Unable to synchronize Growth Loop sequence: neither supported edition was found.');
  }
  const oldCommands = /<pre><code>node bin\/arwp-trends\.mjs list --since=90 --exclude-retired\nnode bin\/arwp-hypotheses\.mjs list --vertical=editorial\nnode bin\/arwp-growth\.mjs https:\/\/example\.com --vertical=editorial --json<\/code><\/pre>/;
  const currentCommands = /node bin\/arwp\.mjs technical-integrity https:\/\/example\.com\/ --max-pages=20 --json/;
  if (oldCommands.test(text)) {
    text = text.replace(oldCommands, '<pre><code>node bin/arwp-trends.mjs list --since=90 --exclude-retired\nnode bin/arwp-hypotheses.mjs list --vertical=editorial\nnode bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json\nnode bin/arwp-growth.mjs https://example.com --vertical=editorial --json</code></pre>');
  } else if (!currentCommands.test(text)) {
    throw new Error('Unable to synchronize Growth preflight commands.');
  }
  const section = '<section class="cite-card" id="practice-library"><h2>Find a change worth trying</h2><p>Browse ' + count + ' practices across ' + categories + ' categories. Start with the problem on your site, then see what to change and how to check it. The detailed source records are still available when you need them.</p><p><a href="../discoverability.html">Find a useful fix</a> · <a href="../discoverability/index.json">Open the technical index</a> · <a href="../examples/editorial/comparison.html">See a worked comparison</a></p></section>';
  text = replaceRequired(text, /<section class="cite-card" id="practice-library">[\s\S]*?<\/section>/, section, 'Growth practice-library reference');
  fs.writeFileSync(file, text, 'utf8');
}

function syncRecommendations() {
  const file = path.join(docs, 'recommendations', 'index.html');
  let text = fs.readFileSync(file, 'utf8');
  const oldCommands = /<pre><code>arwp audit https:\/\/example\.com --json\narwp-growth https:\/\/example\.com --json\narwp-visibility compare before\.json after\.json<\/code><\/pre>/;
  const currentCommands = /arwp technical-integrity https:\/\/example\.com\/ --max-pages=20 --json/;
  if (oldCommands.test(text)) {
    text = text.replace(oldCommands, '<pre><code>arwp technical-integrity https://example.com/ --max-pages=20 --json\narwp audit https://example.com --json\narwp-growth https://example.com --json\narwp-visibility compare before.json after.json</code></pre>');
  } else if (!currentCommands.test(text)) {
    throw new Error('Unable to synchronize Recommendations technical preflight.');
  }
  const section = '<section class="cite-card" id="practice-library"><h2>Pick advice that fits your site</h2><p>Browse ' + count + ' practices across ' + categories + ' categories. Read the reason for each suggestion, start with its first action, and check the result before trying the next idea.</p><p><a href="../discoverability.html">Browse practical fixes</a> · <a href="../discoverability/index.json">Open the technical index</a> · <a href="../examples/editorial/comparison.html">See a worked comparison</a></p></section>';
  text = replaceRequired(text, /<section class="cite-card" id="practice-library">[\s\S]*?<\/section>/, section, 'Recommendations practice-library reference');
  fs.writeFileSync(file, text, 'utf8');
}

syncLlms();
syncGrowth();
syncRecommendations();
console.log(`Synchronized current discoverability references: ${count} patterns, ${categories} categories.`);
