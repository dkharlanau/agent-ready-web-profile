#!/usr/bin/env node
import fs from 'node:fs';
import {
  compareTreatmentCohortIntegrity,
  formatTreatmentCohortIntegrityReport,
  validateTreatmentCohortIntegrityReport
} from '../lib/treatment-cohort-integrity.mjs';

const MiB = 1024 * 1024;
const usage = `Usage:
  node bin/arwp-treatment-cohort.mjs compare <before-site-state.json> <after-site-state.json> [--treatment=<urls.json>] [--treatment-url=https://example.com/page]... [--output=report.json] [--text]
  node bin/arwp-treatment-cohort.mjs validate <report.json>

Treatment Cohort Integrity compares revision-bound mapped route inputs with an optional declared treatment cohort.
The treatment JSON file must be an array of absolute HTTPS URLs. The command never infers causality or Search outcomes.`;

function readText(file, label, maxBytes = 64 * MiB) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${label} must be a regular local file.`);
  if (stat.size > maxBytes) throw new Error(`${label} exceeds the ${Math.floor(maxBytes / MiB)} MiB input limit.`);
  return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
}

function readJson(file, label, maxBytes = 64 * MiB) {
  return JSON.parse(readText(file, label, maxBytes));
}

function writeExclusive(file, body) {
  fs.writeFileSync(file, body, { encoding: 'utf8', flag: 'wx' });
}

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(usage);
    process.exit(args.includes('--help') ? 0 : 2);
  }
  const command = args.shift();

  if (command === 'validate') {
    if (args.length !== 1 || args[0].startsWith('--')) throw new Error(usage);
    const report = readJson(args[0], 'Treatment Cohort Integrity report');
    const validation = validateTreatmentCohortIntegrityReport(report);
    if (!validation.valid) {
      console.error(validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`PASS Treatment Cohort Integrity v${report.version}: ${report.routes.length} route record(s)`);
    }
  } else if (command === 'compare') {
    const positionals = [];
    const treatmentUrls = [];
    let treatmentFile = null;
    let output = null;
    let text = false;
    for (const arg of args) {
      if (arg === '--text') {
        if (text) throw new Error('Duplicate --text.');
        text = true;
      } else if (arg.startsWith('--treatment-url=')) {
        const value = arg.slice('--treatment-url='.length);
        if (!value) throw new Error('Empty --treatment-url.');
        treatmentUrls.push(value);
      } else if (arg.startsWith('--treatment=')) {
        if (treatmentFile) throw new Error('Duplicate --treatment.');
        treatmentFile = arg.slice('--treatment='.length);
        if (!treatmentFile) throw new Error('Empty --treatment.');
      } else if (arg.startsWith('--output=')) {
        if (output) throw new Error('Duplicate --output.');
        output = arg.slice('--output='.length);
        if (!output) throw new Error('Empty --output.');
      } else if (arg.startsWith('--')) {
        throw new Error(`Unknown option: ${arg.split('=')[0]}`);
      } else {
        positionals.push(arg);
      }
    }
    if (positionals.length !== 2) throw new Error(usage);
    if (treatmentFile) {
      const value = readJson(treatmentFile, 'Treatment URL file', 5 * MiB);
      if (!Array.isArray(value)) throw new Error('Treatment URL file must contain a JSON array.');
      treatmentUrls.push(...value);
    }
    const before = readJson(positionals[0], 'Before Site State Graph');
    const after = readJson(positionals[1], 'After Site State Graph');
    const report = compareTreatmentCohortIntegrity(before, after, { treatmentUrls });
    const body = text ? `${formatTreatmentCohortIntegrityReport(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
    if (output) writeExclusive(output, body);
    else process.stdout.write(body);
  } else {
    throw new Error(usage);
  }
} catch (error) {
  console.error(`arwp-treatment-cohort: ${error.message}`);
  process.exitCode = 2;
}
