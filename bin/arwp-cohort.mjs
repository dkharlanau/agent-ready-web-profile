#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateMeasurementGate,
  formatControlledCohortSummary,
  summarizeControlledCohort,
  validateControlledCohort
} from '../lib/controlled-cohort.mjs';
import {
  createCohortPageMapTemplate,
  planCohortSearchObservation,
  reviewCohortGscWebExport
} from '../lib/cohort-search-observation.mjs';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('--') ? args[0] : 'help';
const subject = args[1] && !args[1].startsWith('--') ? args[1] : null;
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = '--' + name + '=';
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf('--' + name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function optionRequired(name) {
  const value = optionValue(name);
  if (!value) throw new Error(command + ' requires --' + name + '.');
  return value;
}

function writeLocalJson(value, output) {
  if (!output) return null;
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
  return target;
}

function usage() {
  console.log([
    'Goose Controlled Cohorts',
    '',
    'Usage:',
    '  arwp-cohort validate <cohort.json> [--json]',
    '  arwp-cohort summarize <cohort.json> [--json]',
    '  arwp-cohort gate <cohort.json> --production-ref=<40-char-sha> [--json]',
    '  arwp-cohort plan <cohort.json> --production-ref=SHA --deployment-date=YYYY-MM-DD --as-of=YYYY-MM-DD [--final-through=YYYY-MM-DD] [--json]',
    '  arwp-cohort page-map <cohort.json> [--output=private-map.json] [--json]',
    '  arwp-cohort check-gsc <cohort.json> --production-ref=SHA --deployment-date=YYYY-MM-DD --as-of=YYYY-MM-DD --final-through=YYYY-MM-DD --window-days=14 --report-scope=web --export-start=YYYY-MM-DD --export-end=YYYY-MM-DD --page-map=private-map.json --export=private-web.csv [--output=private-review.json] [--json]',
    '',
    'The frozen cohort remains the only experiment design authority. Planning starts',
    'only with an independently reviewed exact production SHA and explicit deployment',
    'day; the partial deployment day is excluded from T14/T28/T56. A calendar window',
    'is not an observed outcome. Provider finality and dates are supplied by the owner.',
    '',
    'check-gsc accepts only one joint Date/Page/Query/Clicks/Impressions CSV from Google',
    'Search Console WEB Search. It is NOT a generative-AI export and cannot verify',
    'that the CSV was exported from Search Console. The explicit private page map',
    'links exact canonical URLs to frozen treatment/control IDs. It never guesses URLs.',
    '',
    'Search Console can omit anonymized/low-volume rows. No row means unobserved,',
    'not zero. No outcome or causal decision is made from this helper alone. Keep',
    'private exports and mapping files out of public repositories.'
  ].join('\n'));
}

function observeOptions() {
  return {
    productionRef: optionRequired('production-ref'),
    deploymentDate: optionRequired('deployment-date'),
    asOf: optionRequired('as-of'),
    finalDataThrough: optionValue('final-through')
  };
}

function printPlan(result) {
  console.log('Goose observation plan for ' + result.cohortId);
  console.log('Production gate: ' + result.productionGate);
  console.log('Frozen treatment/control: ' + result.treatmentCount + '/' + result.controlCount);
  console.log('Frozen queries: ' + result.frozenQueryCount);
  console.log('Deployment date (owner claim): ' + result.deploymentDateClaim);
  console.log('Checked as of: ' + result.observationAsOf);
  console.log('Owner final data through: ' + (result.providerFinalDataThroughClaim || 'unknown'));
  for (const window of result.windows) {
    console.log('T' + window.days + '  ' + window.startDate + ' .. ' + window.endDate + '  ' + window.state);
  }
  console.log('Next steps:');
  for (const action of result.nextActions) console.log(' - ' + action);
  console.log('This does not measure traffic, indexing, recommendations or causal impact.');
}

async function main() {
  if (command === 'help' || args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }
  if (!subject) throw new Error(command + ' requires a controlled cohort JSON file.');
  const cohort = readJson(subject);

  if (command === 'validate') {
    const result = validateControlledCohort(cohort);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      if (result.valid) console.log('PASS Controlled Cohort (' + cohort.id + ')');
      else {
        for (const error of result.semanticErrors) console.error('FAIL ' + error);
        for (const error of result.errors) console.error('FAIL ' + (error.instancePath || '/') + ' ' + error.message);
      }
      for (const warning of result.warnings) console.error('WARN ' + warning);
    }
    return result.valid ? 0 : 1;
  }

  if (command === 'summarize') {
    const summary = summarizeControlledCohort(cohort);
    if (jsonOutput) console.log(JSON.stringify(summary, null, 2));
    else console.log(formatControlledCohortSummary(summary));
    return 0;
  }

  if (command === 'gate') {
    const result = evaluateMeasurementGate(cohort, optionRequired('production-ref'));
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('Goose Controlled Cohort gate');
      console.log('Cohort: ' + result.cohortId);
      console.log('Ready: ' + (result.ready ? 'yes' : 'no'));
      console.log('Next state: ' + result.nextState);
      console.log('Observation clock: ' + (result.observationClockMayStart ? 'may start after verified deployment time' : 'must remain stopped'));
      console.log(result.reason);
    }
    return result.ready ? 0 : 2;
  }

  if (command === 'plan') {
    const result = planCohortSearchObservation(cohort, observeOptions());
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else printPlan(result);
    return result.productionGate === 'ready' ? 0 : 2;
  }

  if (command === 'page-map') {
    const map = createCohortPageMapTemplate(cohort);
    const written = writeLocalJson(map, optionValue('output'));
    if (jsonOutput || !written) console.log(JSON.stringify(map, null, 2));
    else console.log('WROTE private page-map template: ' + written + '\nFill in all exact canonical URLs before check-gsc.');
    return 0;
  }

  if (command === 'check-gsc') {
    const options = {
      ...observeOptions(),
      reportScope: optionRequired('report-scope'),
      windowDays: optionRequired('window-days'),
      exportStart: optionRequired('export-start'),
      exportEnd: optionRequired('export-end')
    };
    const pageMap = readJson(optionRequired('page-map'));
    const raw = fs.readFileSync(path.resolve(optionRequired('export')), 'utf8');
    const review = reviewCohortGscWebExport(cohort, pageMap, raw, options);
    const written = writeLocalJson(review, optionValue('output'));
    if (jsonOutput) console.log(JSON.stringify({ ...review, written }, null, 2));
    else {
      console.log('Cohort GSC Web Search: ' + review.cohortId);
      console.log('Window: T' + review.window.days + '  ' + review.window.startDate + ' .. ' + review.window.endDate);
      console.log('State: ' + review.status);
      console.log('Rows matching frozen cohort: ' + review.observed.matchedCohortRows);
      for (const group of ['treatment', 'control']) {
        const value = review.observed[group];
        console.log(group + ': ' + value.observedMembers + '/' + value.frozenMembers
          + ' observed; impressions=' + (value.observedImpressions == null ? 'unknown' : value.observedImpressions)
          + '; clicks=' + (value.observedClicks == null ? 'unknown' : value.observedClicks));
      }
      if (written) console.log('WROTE descriptive, privacy-bounded review: ' + written);
      console.log('Not an outcome decision or proof of treatment effect.');
    }
    return 0;
  }

  throw new Error('Unknown command: ' + command);
}

main().then(code => {
  if (Number.isInteger(code)) process.exitCode = code;
}).catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
