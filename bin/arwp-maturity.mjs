#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { auditMaturity, safeRelativePath } from '../lib/maturity-profile.mjs';

const [command, file, ...options] = process.argv.slice(2);
try {
  if (!['check', 'receipt'].includes(command) || !safeRelativePath(file) || options.length > 1 || options.some(x => !x.startsWith('--root='))) {
    throw new Error('Usage: node bin/arwp-maturity.mjs <check|receipt> <repository-relative-profile.json> [--root=/path/to/site-repository]');
  }
  const root = fs.realpathSync(path.resolve(options[0]?.slice(7) || '.'));
  const readText = relative => {
    if (!safeRelativePath(relative)) throw new Error('Unsafe repository path');
    const resolved = fs.realpathSync(path.resolve(root, relative));
    const distance = path.relative(root, resolved);
    if (distance.startsWith(`..${path.sep}`) || distance === '..' || path.isAbsolute(distance)) throw new Error('Path escapes repository, including symlinks');
    const stat = fs.statSync(resolved);
    if (!stat.isFile() || stat.size > 5_000_000) throw new Error('Expected a text file no larger than 5 MB');
    return fs.readFileSync(resolved, 'utf8');
  };
  const profileText = readText(file);
  const result = auditMaturity(JSON.parse(profileText), { readText });
  console.log(JSON.stringify(command === 'receipt' ? { ...result, profile: file, profileSha256: createHash('sha256').update(profileText).digest('hex'), revision: null, notice: 'Unsigned local content hashes. Preserve the exact files and source commit when archiving. Not a DOI, security attestation or proof of search impact.' } : result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 2; }
