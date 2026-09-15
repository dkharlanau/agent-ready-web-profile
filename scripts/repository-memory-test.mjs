import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'README.md',
  'AGENTS.md',
  'REPO_MAP.md',
  'ROADMAP.md',
  'docs/LOOP-STATUS.md',
  'docs/PRODUCT-LINE.md',
  'docs/REPOSITORY-STEWARDSHIP.md',
  'skills/arwp-repository-stewardship/SKILL.md'
];

for (const relativePath of requiredPaths) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`missing canonical repository-memory path: ${relativePath}`);
  }
}

const memoryDocs = [
  'README.md',
  'AGENTS.md',
  'REPO_MAP.md',
  'ROADMAP.md',
  'docs/LOOP-STATUS.md',
  'docs/README-R4.md',
  'docs/REPOSITORY-STEWARDSHIP.md'
];

const workstationPatterns = [
  { label: 'macOS user path', regex: /\/Users\/[^/\s)]+/g },
  { label: 'Windows user path', regex: /[A-Za-z]:\\Users\\[^\\\s)]+/g }
];

for (const relativePath of memoryDocs) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const { label, regex } of workstationPatterns) {
    const matches = [...content.matchAll(regex)].map((match) => match[0]);
    if (matches.length) {
      failures.push(`${relativePath} contains ${label}: ${[...new Set(matches)].join(', ')}`);
    }
  }
}

const navigationDocs = ['AGENTS.md', 'REPO_MAP.md', 'docs/REPOSITORY-STEWARDSHIP.md'];
const markdownLink = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

for (const relativePath of navigationDocs) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const match of content.matchAll(markdownLink)) {
    let target = match[1].replace(/^<|>$/g, '');
    if (/^(?:https?:|mailto:|data:)/i.test(target) || target.startsWith('#') || target.startsWith('/')) continue;
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;
    try {
      target = decodeURIComponent(target);
    } catch {
      failures.push(`${relativePath} contains an invalid encoded link target: ${target}`);
      continue;
    }
    const resolved = path.resolve(root, path.dirname(relativePath), target);
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
      failures.push(`${relativePath} link escapes repository root: ${target}`);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      failures.push(`${relativePath} points to a missing repository path: ${target}`);
    }
  }
}

const agentsPath = path.join(root, 'AGENTS.md');
if (fs.existsSync(agentsPath)) {
  const agents = fs.readFileSync(agentsPath, 'utf8');
  if (!agents.includes('skills/arwp-repository-stewardship/SKILL.md')) {
    failures.push('AGENTS.md must route repository cleanup to the canonical Repository Stewardship skill');
  }
}

const repoMapPath = path.join(root, 'REPO_MAP.md');
if (fs.existsSync(repoMapPath)) {
  const repoMap = fs.readFileSync(repoMapPath, 'utf8');
  for (const requiredRoute of ['docs/REPOSITORY-STEWARDSHIP.md', 'skills/arwp-repository-stewardship/SKILL.md']) {
    if (!repoMap.includes(requiredRoute)) failures.push(`REPO_MAP.md must route repository stewardship through ${requiredRoute}`);
  }
}

const historicalR4Path = path.join(root, 'docs/README-R4.md');
if (fs.existsSync(historicalR4Path)) {
  const historicalR4 = fs.readFileSync(historicalR4Path, 'utf8');
  if (!/not the current product backlog or priority authority/i.test(historicalR4)) {
    failures.push('docs/README-R4.md must remain explicitly historical rather than becoming a second current backlog');
  }
  if (!historicalR4.includes('../ROADMAP.md')) {
    failures.push('docs/README-R4.md must route current priorities back to ROADMAP.md');
  }
}

const gitignorePath = path.join(root, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  failures.push('missing .gitignore');
} else {
  const rules = fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/).map((line) => line.trim());
  if (!rules.includes('/output/')) failures.push('.gitignore must keep root /output/ out of the public repository');
}

if (failures.length) {
  console.error('Repository memory validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Repository memory validation passed.');
