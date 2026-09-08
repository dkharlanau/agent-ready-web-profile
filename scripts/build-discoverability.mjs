import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../lib/discoverability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const corpus = loadCorpus();
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = values => `<ul>${values.map(value => `<li>${esc(value)}</li>`).join('')}</ul>`;
const categoryMap = new Map(corpus.categories.map(c => [c.id, c.title]));
const cards = corpus.tactics.map((t, index) => `<article class="practice" id="${esc(t.id)}" data-category="${esc(t.category)}" data-level="${esc(t.evidence_level)}" data-search="${esc([t.id, t.title, t.problem, ...t.implementation, ...t.applicability].join(' ').toLowerCase())}">
  <div class="practice-meta"><span>${String(index + 1).padStart(3, '0')} / ${esc(categoryMap.get(t.category))}</span><span class="level ${esc(t.evidence_level)}">${esc(t.evidence_level)}</span></div>
  <h2><a href="#${esc(t.id)}">${esc(t.title)}</a></h2><p class="practice-problem">${esc(t.problem)}</p>
  <div class="practice-bottom"><label class="pick"><input type="checkbox" name="tactic" value="${esc(t.id)}"> Add to my plan</label><span>${esc(t.effort)} effort</span></div>
  <details><summary>Implementation, checks & sources</summary><div class="practice-details">
    <h3>Growth routing</h3><p>${(t.growth_hypothesis_ids || []).map(id => `<a href="./growth/hypotheses.json">${esc(id)}</a>`).join(" · ")}</p><p>${(t.recommendation_rule_ids || []).map(id => `<a href="./recommendations/registry.json">${esc(id)}</a>`).join(" · ")}</p><p class="small">Routing links identify related current guidance; they do not certify this practice or its outcome.</p>
    <h3>Make the change</h3>${list(t.implementation)}<h3>Check the result</h3>${list(t.verification)}
    <h3>Measure</h3><p>${esc(t.measurement)}</p><h3>Why try it</h3><p>${esc(t.impact_hypothesis)}</p>
    <h3>Avoid</h3><p>${esc(t.anti_pattern)}</p><p class="applies">Applies to: ${t.applicability.map(esc).join(', ')}</p>
    <p class="practice-sources">Sources: ${t.source_ids.map(id => { const source = corpus.sources.find(s => s.id === id); return `<a href="#source-${esc(id)}">${esc(source.title)}</a>`; }).join(' · ')}</p>
    <code class="tactic-id">${esc(t.id)}</code>
  </div></details>
</article>`).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Discoverability Library — ${corpus.tactics.length} practices | SignalBraid · ARWP</title>
<meta name="description" content="Choose practical improvements for search visibility and AI discoverability. ${corpus.tactics.length} practices with implementation steps, checks, sources and measurement methods.">
<link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html"><link rel="icon" href="./arwp-profile.svg" type="image/svg+xml">
<link rel="describedby" type="application/json" href="./ai/site-profile.json">
<link rel="alternate" type="application/json" href="./knowledge/discoverability-corpus.json" title="Machine-readable practice corpus">
<link rel="stylesheet" href="./discoverability.css"><script src="./discoverability.js" defer></script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': 'https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html#page', url: 'https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html', name: 'SignalBraid · ARWP Discoverability Library', description: `${corpus.tactics.length} source-backed engineering and editorial practices with verification and measurement methods.`, inLanguage: 'en', dateModified: corpus.updated_at, isPartOf: { '@type': 'WebSite', '@id': 'https://dkharlanau.github.io/agent-ready-web-profile/#website' } }).replace(/</g, '\\u003c')}</script>
</head><body><a class="skip" href="#library">Skip to practices</a>
<header class="masthead"><a class="brand" href="./"><img src="./media/signalbraid-lockup.svg" alt="SignalBraid · ARWP" width="248" height="45"></a><nav aria-label="Primary"><a href="./compare/">Compare approaches</a><a href="./DISCOVERABILITY-PLAYBOOK.md">Playbook</a><a href="https://github.com/dkharlanau/agent-ready-web-profile">GitHub ↗</a></nav></header>
<main><section class="intro"><p class="eyebrow">THE DISCOVERABILITY LIBRARY / V${esc(corpus.version)}</p>
<h1>Make good work<br><em>easier to find.</em></h1><div class="intro-bottom"><p>Choose improvements that help people discover, understand and use your site. Every practice comes with a concrete change, a check and a way to measure what happened.</p><div class="edition"><strong>${corpus.tactics.length}</strong><span>practices / ${corpus.categories.length} categories<br>Sources reviewed ${esc(corpus.updated_at)}</span></div></div></section>
<p class="native-route">Part of the <a href="./growth/">Growth Loop</a>. Find a relevant practice, inspect its current hypothesis and rule, then verify a site-specific change. <a href="./examples/editorial/article.html">Article example</a> · <a href="./examples/editorial/comparison.html">Comparison example</a></p>
<section class="evidence-key" aria-label="How to read evidence levels"><p><strong>Documented</strong><span>Supported by linked guidance. A ranking effect is not implied.</span></p><p><strong>Inferred</strong><span>A reasoned implementation idea. Test it on your site.</span></p><p><strong>Experimental</strong><span>An open hypothesis with explicit uncertainty.</span></p></section>
<div class="workspace" id="library"><aside class="controls"><form id="filters" role="search"><label for="practice-search">Find a practice</label><input id="practice-search" type="search" name="q" placeholder="e.g. comparison, citations" autocomplete="off"><label for="category">Category</label><select id="category" name="category"><option value="">All categories</option>${corpus.categories.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select><label for="evidence-level">Evidence</label><select id="evidence-level" name="evidence"><option value="">All evidence levels</option><option value="documented">Documented</option><option value="inferred">Inferred</option><option value="experimental">Experimental</option></select><button type="reset" class="text-button">Clear filters</button></form>
<div class="plan-box"><p class="eyebrow">YOUR NEXT EXPERIMENT</p><h2><span id="selected-count">0</span> practices selected</h2><p>Start with a few changes that address a real gap.</p><details id="plan-details"><summary>Prepare my plan</summary><form id="plan-form"><label for="plan-site">Canonical site URL</label><input id="plan-site" type="url" placeholder="https://example.com/" required><label for="plan-audience">Who is it for?</label><input id="plan-audience" placeholder="Your specific audience" required><label for="plan-action">What useful action should they take?</label><input id="plan-action" placeholder="e.g. Run the worked example" required><button class="primary" type="submit">Download selection</button><p id="plan-message" role="status"></p></form><p class="small">Your selection stays in this browser. Run <code>arwp adoption-plan arwp-adoption.json</code> to generate an implementation plan.</p></details></div>
<a class="download" href="./knowledge/discoverability-corpus.json" download>Download the complete corpus ↓</a></aside>
<section class="results" aria-label="Practices"><div class="results-heading"><p id="result-count" role="status">${corpus.tactics.length} practices</p><a href="#sources">Source register ↓</a></div><noscript><p>All practices and sources are readable below. Enable JavaScript for filters and plan selection.</p></noscript><p id="no-results" hidden>No practices match these filters. Try a broader term or clear the filters.</p>${cards}</section></div>
<section class="sources" id="sources"><p class="eyebrow">FOLLOW THE EVIDENCE</p><h2>Source register</h2><p>Read each source within its stated scope. A standard, a publisher recommendation and an engineering experiment answer different questions.</p><ol>${corpus.sources.map(s => `<li id="source-${esc(s.id)}"><a href="${esc(s.url)}">${esc(s.title)} ↗</a><span>${esc(s.publisher)} · checked ${esc(s.checked_at)} · ${esc(s.authority)}</span><p>${esc(s.notes)}</p></li>`).join('')}</ol></section>
</main><footer><a class="brand" href="./">SignalBraid · ARWP</a><p>Useful content. Inspectable evidence. Measured outcomes.</p><a href="./EDITORIAL-RECEIPTS.md">Editorial receipt contract</a></footer></body></html>\n`;
fs.writeFileSync(path.join(docs, 'discoverability.html'), html);
fs.mkdirSync(path.join(docs, 'knowledge'), { recursive: true });
fs.writeFileSync(path.join(docs, 'knowledge/discoverability-corpus.json'), JSON.stringify(corpus, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'knowledge/source-link-checks.json'), path.join(docs, 'knowledge/source-link-checks.json'));
fs.cpSync(path.join(root, 'examples/editorial'), path.join(docs, 'examples/editorial'), { recursive: true });
fs.mkdirSync(path.join(docs, 'skills/arwp-discoverability'), { recursive: true });
// Browser-served entrypoint links resolve within the Pages artifact.
const skill = fs.readFileSync(path.join(root, 'skills/arwp-discoverability/SKILL.md'), 'utf8').replaceAll('../../docs/', '../../');
fs.writeFileSync(path.join(docs, 'skills/arwp-discoverability/SKILL.md'), skill);
console.log(`Built discoverability library: ${corpus.tactics.length} practices and ${corpus.sources.length} sources; sitemap is managed separately.`);
