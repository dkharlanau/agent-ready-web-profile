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
  text = replaceRequired(
    text,
    /<div class="direct-answer"><strong>Loop:<\/strong> research → classify → baseline → hypothesis → implement → verify → measure → keep \/ revise \/ revert\.<\/div>/,
    '<div class="direct-answer"><strong>Loop:</strong> research → classify → technical preflight → baseline → hypothesis → implement → verify → measure → keep / revise / revert.</div>',
    'Growth Loop sequence'
  );
  text = replaceRequired(
    text,
    /<pre><code>node bin\/arwp-trends\.mjs list --since=90 --exclude-retired\nnode bin\/arwp-hypotheses\.mjs list --vertical=editorial\nnode bin\/arwp-growth\.mjs https:\/\/example\.com --vertical=editorial --json<\/code><\/pre>/,
    '<pre><code>node bin/arwp-trends.mjs list --since=90 --exclude-retired\nnode bin/arwp-hypotheses.mjs list --vertical=editorial\nnode bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json\nnode bin/arwp-growth.mjs https://example.com --vertical=editorial --json</code></pre>',
    'Growth preflight commands'
  );
  text = replaceRequired(
    text,
    /<section class="cite-card" id="practice-library"><h2>Turn a site gap into a concrete change<\/h2><p>Browse \d+ practices across \d+ categories:[^<]*<\/p><p><a href="\.\.\/discoverability\.html">Open the practice library and prepare a site selection<\/a> · <a href="\.\.\/examples\/editorial\/comparison\.html">Inspect a worked comparison<\/a><\/p><\/section>/,
    `<section class="cite-card" id="practice-library"><h2>Turn a site gap into a concrete change</h2><p>Browse ${count} practices across ${categories} categories: useful articles, sourced comparisons, inline evidence, entity relationships, crawl access and measurement. Full evidence is split into bounded topical hubs so one growing catalog does not become a retrieval monolith.</p><p><a href="../discoverability.html">Open the practice library and prepare a site selection</a> · <a href="../discoverability/index.json">Use the lightweight routing index</a> · <a href="../examples/editorial/comparison.html">Inspect a worked comparison</a></p></section>`,
    'Growth practice-library reference'
  );
  fs.writeFileSync(file, text, 'utf8');
}

function syncRecommendations() {
  const file = path.join(docs, 'recommendations', 'index.html');
  let text = fs.readFileSync(file, 'utf8');
  text = replaceRequired(
    text,
    /<pre><code>arwp audit https:\/\/example\.com --json\narwp-growth https:\/\/example\.com --json\narwp-visibility compare before\.json after\.json<\/code><\/pre>/,
    '<pre><code>arwp technical-integrity https://example.com/ --max-pages=20 --json\narwp audit https://example.com --json\narwp-growth https://example.com --json\narwp-visibility compare before.json after.json</code></pre>',
    'Recommendations workflow preflight'
  );
  text = replaceRequired(
    text,
    /<section class="cite-card" id="practice-library"><h2>Turn a site gap into a concrete change<\/h2><p>Browse \d+ practices across \d+ categories:[^<]*<\/p><p><a href="\.\.\/discoverability\.html">Open the practice library and prepare a site selection<\/a> · <a href="\.\.\/examples\/editorial\/comparison\.html">Inspect a worked comparison<\/a><\/p><\/section>/,
    `<section class="cite-card" id="practice-library"><h2>Turn a site gap into a concrete change</h2><p>Browse ${count} practices across ${categories} categories: useful articles, sourced comparisons, inline evidence, entity relationships, crawl access and measurement. Full pattern evidence is routed through bounded topical hubs rather than one ever-growing HTML payload.</p><p><a href="../discoverability.html">Open the practice library and prepare a site selection</a> · <a href="../discoverability/index.json">Use the lightweight routing index</a> · <a href="../examples/editorial/comparison.html">Inspect a worked comparison</a></p></section>`,
    'Recommendations practice-library reference'
  );
  fs.writeFileSync(file, text, 'utf8');
}

syncLlms();
syncGrowth();
syncRecommendations();
console.log(`Synchronized current discoverability references: ${count} patterns, ${categories} categories.`);
