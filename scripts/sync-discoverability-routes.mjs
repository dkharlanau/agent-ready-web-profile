import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../lib/discoverability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const corpus = loadCorpus();
const base = 'https://dkharlanau.github.io/agent-ready-web-profile/';
const xmlPath = path.join(docs, 'sitemap.xml');
const mdPath = path.join(docs, 'sitemap.md');
const XML_BEGIN = '  <!-- BEGIN DISCOVERABILITY EVIDENCE HUBS -->';
const XML_END = '  <!-- END DISCOVERABILITY EVIDENCE HUBS -->';
const MD_BEGIN = '<!-- BEGIN DISCOVERABILITY EVIDENCE HUBS -->';
const MD_END = '<!-- END DISCOVERABILITY EVIDENCE HUBS -->';

function replaceManagedBlock(text, begin, end, block, insertBefore) {
  const start = text.indexOf(begin);
  const finish = text.indexOf(end);
  if (start >= 0 || finish >= 0) {
    if (start < 0 || finish < start) throw new Error(`Malformed managed block: ${begin}`);
    const after = finish + end.length;
    return `${text.slice(0, start)}${block}${text.slice(after)}`;
  }
  const index = text.indexOf(insertBefore);
  if (index < 0) throw new Error(`Unable to place managed block before: ${insertBefore}`);
  return `${text.slice(0, index)}${block}\n${text.slice(index)}`;
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function syncXml() {
  let xml = fs.readFileSync(xmlPath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const mainUrl = `${base}discoverability.html`;
  const mainPattern = new RegExp(`<url><loc>${mainUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc><lastmod>[^<]+</lastmod></url>`);
  if (!mainPattern.test(xml)) throw new Error('Canonical discoverability.html route is missing from sitemap.xml.');
  xml = xml.replace(mainPattern, `<url><loc>${mainUrl}</loc><lastmod>${today}</lastmod></url>`);

  const routeLines = corpus.categories.map(category =>
    `  <url><loc>${xmlEscape(`${base}discoverability/${category.id}.html`)}</loc><lastmod>${today}</lastmod></url>`
  );
  const block = [XML_BEGIN, ...routeLines, XML_END].join('\n');
  xml = replaceManagedBlock(xml, XML_BEGIN, XML_END, block, '</urlset>');
  fs.writeFileSync(xmlPath, xml.endsWith('\n') ? xml : `${xml}\n`, 'utf8');
}

function syncMarkdown() {
  let md = fs.readFileSync(mdPath, 'utf8');
  const routes = corpus.categories.map(category => {
    const count = corpus.tactics.filter(tactic => tactic.category === category.id).length;
    return `- [${category.title}](${base}discoverability/${category.id}.html) — ${count} full static evidence ${count === 1 ? 'pattern' : 'patterns'}.`;
  });
  const block = [
    MD_BEGIN,
    '',
    '### Discoverability evidence hubs',
    '',
    `The lightweight [routing index](${base}discoverability/index.json) maps ${corpus.tactics.length} stable pattern IDs into ${corpus.categories.length} bounded topical evidence hubs. The canonical full machine corpus remains separate.`,
    '',
    ...routes,
    '',
    MD_END
  ].join('\n');

  const insertionPoint = '- [Machine-readable corpus]';
  md = replaceManagedBlock(md, MD_BEGIN, MD_END, block, insertionPoint);
  fs.writeFileSync(mdPath, md.endsWith('\n') ? md : `${md}\n`, 'utf8');
}

syncXml();
syncMarkdown();
console.log(`Synced ${corpus.categories.length} discoverability evidence hubs into sitemap.xml and sitemap.md.`);
