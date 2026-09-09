import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '<!-- BEGIN GOOSE TECHNICAL PREFLIGHT -->';
const END = '<!-- END GOOSE TECHNICAL PREFLIGHT -->';
const block = `${BEGIN}
## Technical preflight

Before optional Search/GEO/content/agent tactics on a public target, run the bounded Technical Integrity audit:

\`\`\`bash
node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json
\`\`\`

Interpret the result conservatively:

- \`FAIL\` — a bounded source-backed blocker was observed; fix it or explicitly resolve why it is intentional before optional acquisition work;
- \`WATCH\` — investigate context, rendered/runtime behavior or audit limits; do not automatically call it a defect;
- \`PASS\` — no issue was observed by that detector in the bounded sample; this is not indexing, ranking or citation proof;
- \`not-applicable\` — the check does not apply to the observed representation.

A bounded fetch failure remains unknown rather than becoming an indexability failure. Non-HTML resources are not required to carry HTML-only canonical markup. If dogfood exposes a detector false positive, repair the detector/evidence boundary instead of editing the target site to satisfy a bad check.

Use Technical Integrity before optional tactics and again after the changed public/deployed surface is observable.
${END}`;

function replaceManaged(text, anchor, label) {
  const start = text.indexOf(BEGIN);
  const finish = text.indexOf(END);
  if (start >= 0 || finish >= 0) {
    if (start < 0 || finish < start) throw new Error(`${label}: malformed Technical preflight managed block.`);
    return `${text.slice(0, start)}${block}${text.slice(finish + END.length)}`;
  }
  const index = text.indexOf(anchor);
  if (index < 0) throw new Error(`${label}: anchor not found: ${anchor}`);
  return `${text.slice(0, index)}${block}\n\n${text.slice(index)}`;
}

function syncRootAgents() {
  const file = path.join(root, 'AGENTS.md');
  let text = fs.readFileSync(file, 'utf8');
  text = replaceManaged(text, '## Growth Loop rules', 'AGENTS.md');
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function syncPublicAgents() {
  const file = path.join(root, 'docs', 'AGENTS.md');
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(
    '`research current Search/recommendation changes -> classify evidence -> select hypotheses -> improve a real site -> verify -> measure -> iterate`',
    '`research current Search/recommendation changes -> classify evidence -> technical preflight -> select hypotheses -> improve a real site -> verify -> measure -> iterate`'
  );
  const growthCommand = 'node bin/arwp-growth.mjs https://example.com --vertical=editorial --json';
  const preflightCommand = 'node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json';
  if (!text.includes(preflightCommand)) {
    if (!text.includes(growthCommand)) throw new Error('docs/AGENTS.md: Growth command anchor not found.');
    text = text.replace(growthCommand, `${preflightCommand}\n${growthCommand}`);
  }
  text = replaceManaged(text, '## Resolver remains', 'docs/AGENTS.md');
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

syncRootAgents();
syncPublicAgents();
console.log('Synchronized Goose Technical Integrity preflight contract into AGENTS.md and docs/AGENTS.md.');
