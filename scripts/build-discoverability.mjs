import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../lib/discoverability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const corpus = loadCorpus();
const corpusHash = createHash('sha256').update(JSON.stringify(corpus)).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = values => `<ul>${values.map(value => `<li>${esc(value)}</li>`).join('')}</ul>`;
const categoryMap = new Map(corpus.categories.map(c => [c.id, c.title]));
const sourceMap = new Map(corpus.sources.map(s => [s.id, s]));
const date = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not individually reviewed';
const upstream = source => source.upstream?.version || (source.upstream?.kind === 'living-document' ? 'Living document · no fixed release' : 'Upstream version not recorded');
const reviewLabel = tactic => tactic.review?.reviewed_at ? `Pattern reviewed ${date(tactic.review.reviewed_at)}` : 'Individual review pending';
const cards = corpus.tactics.map((t, index) => {
  const sources = t.source_ids.map(id => sourceMap.get(id));
  return `<article class="practice" id="${esc(t.id)}" data-category="${esc(t.category)}" data-level="${esc(t.evidence_level)}" data-version="${esc(t.pattern_version || '1.0.0')}" data-search="${esc([t.id, t.title, t.problem, ...t.implementation, ...t.verification, ...t.applicability, ...sources.map(s => s.title)].join(' ').toLowerCase())}">
  <div class="practice-number" aria-hidden="true">${String(index + 1).padStart(3, '0')}</div>
  <div class="practice-body">
    <p class="practice-category">${esc(categoryMap.get(t.category))}</p>
    <h2><a href="#${esc(t.id)}">${esc(t.title)}</a></h2>
    <p class="practice-problem">${esc(t.problem)}</p>
    <div class="practice-meta"><span>v${esc(t.pattern_version || '1.0.0')}</span><span class="level ${esc(t.evidence_level)}">${esc(t.evidence_level)}</span><span>${esc(reviewLabel(t))}</span></div>
    <details><summary>Read pattern &amp; evidence</summary><div class="practice-details">
      <div class="pattern-passport"><p class="eyebrow">PATTERN PASSPORT</p><dl>
        <div><dt>Pattern version</dt><dd>${esc(t.pattern_version || '1.0.0')}</dd></div>
        <div><dt>Lifecycle</dt><dd>${esc(t.lifecycle?.status || 'active')}</dd></div>
        <div><dt>Individual review</dt><dd>${esc(date(t.review?.reviewed_at))}</dd></div>
        <div><dt>Review scope</dt><dd>${esc(t.review?.scope || 'not-individually-reviewed')}</dd></div>
        <div><dt>Review method</dt><dd>${esc(t.review?.method || 'Not yet reviewed')}</dd></div>
      </dl><p class="small">Source support, an implementation check and a measured search outcome are separate evidence. <a href="./DISCOVERABILITY-VERSIONING.md">Read the version contract</a>.</p></div>
      ${t.review?.support?.length ? `<h3>What the review found</h3><ul class="review-support">${t.review.support.map(item => `<li><a href="${esc(sourceMap.get(item.source_id).url)}">${esc(sourceMap.get(item.source_id).title)}</a><p><strong>${esc(item.locator)}</strong> — ${esc(item.note)}</p></li>`).join('')}</ul>` : ''}
      <h3>Make the change</h3>${list(t.implementation)}
      <h3>Check the result</h3>${list(t.verification)}
      <h3>Measure what happens</h3><p>${esc(t.measurement)}</p>
      <h3>Why try it</h3><p>${esc(t.impact_hypothesis)}</p>
      <h3>Where it fits</h3><p>${t.applicability.map(esc).join(', ')}</p>
      <h3>Watch out for</h3><p>${esc(t.anti_pattern)}</p>
      <h3>Follow the evidence</h3><ol class="pattern-references">${sources.map(s => `<li><a href="${esc(s.url)}">${esc(s.title)}</a><p>${esc(s.notes)}</p><span>${esc(s.publisher)} · source checked ${esc(date(s.checked_at))} · ${esc(upstream(s))}</span><a class="source-record" href="#source-${esc(s.id)}">Source record</a></li>`).join('')}</ol>
      <details class="routing"><summary>Agent routing &amp; stable ID</summary><p>${(t.growth_hypothesis_ids || []).map(id => `<a href="./growth/hypotheses.json">${esc(id)}</a>`).join(' · ')}</p><p>${(t.recommendation_rule_ids || []).map(id => `<a href="./recommendations/registry.json">${esc(id)}</a>`).join(' · ') || 'No current recommendation rule applies.'}</p><p class="small">These links route a practice into the existing Growth Loop. They do not certify an outcome.</p><code class="tactic-id">${esc(t.id)}</code></details>
    </div></details>
  </div>
  <label class="pick"><input type="checkbox" name="tactic" value="${esc(t.id)}" aria-label="Add to plan: ${esc(t.title)}"><span>Add to plan</span></label>
</article>`;
}).join('\n');
const quickIds = ['access', 'editorial', 'comparisons', 'evidence', 'measurement'];
const quickLabels = { access: 'Access', editorial: 'Editorial', comparisons: 'Comparisons', evidence: 'Evidence', measurement: 'Measurement' };
const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': 'https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html#page', url: 'https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html', name: 'Cite Goose — Discoverability Pattern Library', description: `${corpus.tactics.length} engineering and editorial patterns with sources, versions, checks and measurement methods.`, inLanguage: 'en', dateModified: corpus.updated_at, isPartOf: { '@type': 'WebSite', '@id': 'https://dkharlanau.github.io/agent-ready-web-profile/#website' } };
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cite Goose — ${corpus.tactics.length} source-backed website patterns</title>
<meta name="description" content="Make your site worth citing. Choose from ${corpus.tactics.length} practical search and AI discoverability patterns with sources, versions, implementation steps and checks.">
<meta name="theme-color" content="#eff600"><meta property="og:title" content="Cite Goose — Make your site worth citing."><meta property="og:description" content="Practical patterns. Traceable sources. Changes you can measure."><meta property="og:type" content="website"><meta property="og:url" content="https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html">
<link rel="canonical" href="https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html"><link rel="icon" href="./arwp-profile.svg" type="image/svg+xml">
<link rel="describedby" type="application/json" href="./ai/site-profile.json"><link rel="alternate" type="application/json" href="./knowledge/discoverability-corpus.json" title="Versioned pattern corpus">
<link rel="preload" href="./media/cite-goose/inter-tight-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="./cite-goose.css"><link rel="stylesheet" href="./discoverability.css"><script src="./discoverability.js" defer></script>
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head>
<body class="patterns-page" data-corpus-version="${esc(corpus.version)}" data-corpus-sha256="${corpusHash}"><a class="skip" href="#library">Skip to patterns</a>
<header class="goose-header"><a class="goose-brand" href="./"><strong>Cite Goose</strong><span>AGENT-READY<br>WEB PROFILE</span></a><nav aria-label="Primary"><a href="#library">Patterns</a><a href="#evidence-guide">Evidence</a><a href="./DISCOVERABILITY-PLAYBOOK.md">Field notes</a><a href="https://github.com/dkharlanau/agent-ready-web-profile">GitHub</a></nav></header>
<main><section class="goose-hero goose-shell"><div class="goose-hero-copy"><p class="eyebrow">THE DISCOVERABILITY LIBRARY / V${esc(corpus.version)}</p><h1>Make your site<br>worth citing.</h1><p class="goose-lead">Practical patterns. Traceable sources.<br class="desktop-break"> Changes you can measure.</p><div class="goose-actions"><a class="goose-button" href="#library">Find a pattern</a><a class="goose-text-link" href="#evidence-guide">How evidence works</a></div><dl class="goose-edition"><div><dt>Patterns</dt><dd>${corpus.tactics.length}</dd></div><div><dt>Categories</dt><dd>${corpus.categories.length}</dd></div><div><dt>Sources</dt><dd>${corpus.sources.length}</dd></div><div><dt>Corpus release</dt><dd>${esc(corpus.version)}</dd></div></dl></div><img class="goose-hero-art" src="./media/cite-goose/hero.webp" alt="An illustrated goose carrying a note: Show your sources." width="1024" height="1024" fetchpriority="high"></section>
<section class="goose-shell library-section" id="library" aria-label="Pattern library"><div class="library-intro"><p class="eyebrow">SMALL CHANGES. INSPECTABLE REASONS.</p><a href="#plan-details" class="selection-jump">Your plan <span id="selected-count">0</span></a></div>
<form id="filters" class="filter-bar" role="search"><div class="search-control"><label for="practice-search">What does your site need?</label><input id="practice-search" type="search" name="q" placeholder="Search patterns, e.g. comparison, citations…" autocomplete="off"></div><div><label for="category">Category</label><select id="category" name="category"><option value="">All categories</option>${corpus.categories.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></div><div><label for="evidence-level">Evidence</label><select id="evidence-level" name="evidence"><option value="">All evidence</option><option value="documented">Documented</option><option value="inferred">Inferred</option><option value="experimental">Experimental</option></select></div><button type="reset" class="text-button">Reset</button></form>
<div class="quick-filters" aria-label="Popular pattern categories"><button type="button" data-quick-category="" aria-pressed="true">All patterns</button>${quickIds.filter(id => categoryMap.has(id)).map(id => `<button type="button" data-quick-category="${id}" aria-pressed="false">${esc(quickLabels[id])}</button>`).join('')}</div>
<div class="workspace"><section class="results" aria-label="Patterns"><div class="results-heading"><p id="result-count" role="status">${corpus.tactics.length} patterns</p><a href="#sources">Source register</a></div><noscript><p>Every pattern and source is readable below. JavaScript adds filtering and plan selection.</p></noscript><p id="no-results" hidden>No patterns match. Try a broader term or reset the filters.</p>${cards}</section>
<aside class="plan-box" aria-label="Selected improvement plan"><p class="eyebrow">ONE USEFUL NEXT MOVE</p><h2>A plan.<br> With receipts.</h2><p>Choose a few patterns that address a real gap. Keep the evidence and version with the change.</p><details id="plan-details"><summary>Prepare my plan</summary><form id="plan-form"><label for="plan-site">Canonical site URL</label><input id="plan-site" type="url" placeholder="https://example.com/" required><label for="plan-audience">Who is it for?</label><input id="plan-audience" placeholder="Your specific audience" required><label for="plan-action">What useful action should they take?</label><input id="plan-action" placeholder="e.g. Run the worked example" required><button class="goose-button" type="submit">Download selection</button><p id="plan-message" role="status"></p></form><details id="plan-export" hidden><summary>Inspect or copy JSON</summary><label for="plan-json">Version-pinned selection</label><textarea id="plan-json" readonly rows="10" spellcheck="false"></textarea><button type="button" id="copy-selection">Copy selection JSON</button><p id="copy-message" role="status"></p></details><p class="small">Your selection stays in this browser. Generate a plan with <code>arwp adoption-plan arwp-adoption.json</code>.</p></details><a class="download" href="./knowledge/discoverability-corpus.json" download>Download full corpus</a><a class="download" href="./examples/editorial/article.html">Explore an article example</a><a class="download" href="./examples/editorial/comparison.html">Explore a comparison example</a></aside></div></section>
<section class="evidence-guide" id="evidence-guide"><div class="goose-shell"><p class="eyebrow">THE GOOSE ASKS FOR SOURCES.</p><h2>Read the label.<br>Then read the evidence.</h2><p class="evidence-lead">A useful idea can be well grounded without having a proven ranking effect. We keep that distinction visible.</p><div class="evidence-key"><div><h3>Documented</h3><p>A linked source supports the mechanism within its scope. Search impact still needs measurement.</p></div><div><h3>Inferred</h3><p>An implementation idea derived from source guidance. Its fit and effect need a site-specific test.</p></div><div><h3>Experimental</h3><p>A hypothesis to explore with explicit uncertainty, checks and a way to stop.</p></div></div><div class="evidence-notes"><p><strong>Source checked</strong> records source review or retrieval. <strong>Pattern reviewed</strong> records a separate scoped assessment. Neither means a search platform endorsed this library.</p><p>Each pattern carries a stable ID and its own version. Downloaded plans pin the corpus and selected revisions. <a href="./DISCOVERABILITY-VERSIONING.md">Inspect the version contract</a>.</p><p><a href="./growth/">Continue through the Growth Loop</a> to audit, implement, verify and measure a real site.</p></div></div></section>
<section class="sources goose-shell" id="sources"><div class="source-heading"><div><p class="eyebrow">FOLLOW THE EVIDENCE</p><h2>Open the source.</h2></div><p>${corpus.sources.length} references. Upstream versions are shown where known. Living documents can change.</p></div><ol>${corpus.sources.map(s => `<li id="source-${esc(s.id)}"><a href="${esc(s.url)}">${esc(s.title)}</a><span>${esc(s.publisher)} · source checked ${esc(date(s.checked_at))} · ${esc(s.authority)}</span><span>${esc(upstream(s))}</span><p>${esc(s.notes)}</p></li>`).join('')}</ol></section>
<footer class="goose-footer goose-shell"><a class="goose-brand" href="./"><strong>Cite Goose</strong></a><p>Better questions. Useful pages. Traceable changes.</p><a href="./EDITORIAL-RECEIPTS.md">Editorial receipt contract</a></footer></main></body></html>\n`;
fs.writeFileSync(path.join(docs, 'discoverability.html'), html.replace(/[ \t]+$/gm, ''));
fs.mkdirSync(path.join(docs, 'knowledge'), { recursive: true });
fs.writeFileSync(path.join(docs, 'knowledge/discoverability-corpus.json'), JSON.stringify(corpus, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'knowledge/source-link-checks.json'), path.join(docs, 'knowledge/source-link-checks.json'));
if (fs.existsSync(path.join(root, 'knowledge/releases'))) fs.cpSync(path.join(root, 'knowledge/releases'), path.join(docs, 'knowledge/releases'), { recursive: true });
fs.cpSync(path.join(root, 'examples/editorial'), path.join(docs, 'examples/editorial'), { recursive: true });
fs.mkdirSync(path.join(docs, 'skills/arwp-discoverability'), { recursive: true });
const skill = fs.readFileSync(path.join(root, 'skills/arwp-discoverability/SKILL.md'), 'utf8').replaceAll('../../docs/', '../../');
fs.writeFileSync(path.join(docs, 'skills/arwp-discoverability/SKILL.md'), skill);
console.log(`Built Cite Goose library: ${corpus.tactics.length} patterns and ${corpus.sources.length} sources; sitemap is managed separately.`);
