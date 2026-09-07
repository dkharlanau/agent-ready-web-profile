#!/usr/bin/env node
import { auditDatasetPublication, formatDatasetPublicationReport } from '../lib/dataset-publication.mjs';

function usage() {
  process.stderr.write('Usage: node bin/arwp-dataset.mjs <url> [--json]\n');
}

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
if (!input) {
  usage();
  process.exitCode = 2;
} else {
  try {
    const report = await auditDatasetPublication(input);
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${formatDatasetPublicationReport(report)}\n`);
    if (report.status === 'dataset-doi-missing') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  }
}
