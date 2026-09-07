#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  createChangeReceipt,
  validateChangeReceipt,
  verifyChangeReceipt,
  verifyChangeReceiptRevision,
  changeReceiptStatus
} from '../lib/change-receipt.mjs';
import {
  reviseChangeReceiptWithTransitionEvidence,
  inspectGitHubTransitionEvidence
} from '../lib/change-receipt-transition.mjs';
import { mergeChangeReceiptIntoBraidGraph, changeReceiptBraidReport } from '../lib/change-receipt-braid.mjs';
import { artifactAdapterSummary } from '../lib/change-receipt-adapters.mjs';

function usage() {
  console.log(`SignalBraid Change Receipt

Usage:
  arwp-change-receipt create <transform-bundle.json> <braid.json> [--execution-kind=local|github-pr --execution=<json>] [--evidence-receipt=<json> --evidence-role=<role>] [--verifications=<json>] [--outcomes=<json>] [--deployment=<json>] [--review=<json>] [--out=<json>]
  arwp-change-receipt revise <receipt.json> [--execution-kind=local|github-pr --execution=<json>] [--mutation=<json>] [--braid=<current-braid.json>] [--evidence-receipt=<json> --evidence-role=<role>] [--verifications=<json>] [--outcomes=<json>] [--visibility=<a.json,b.json>] [--agent-eval=<a.json,b.json>] [--growth-experiment=<a.json,b.json>] [--operation-id=<id>] [--deployment=<json>] [--review=<json>] [--out=<json>]
  arwp-change-receipt adapt <receipt.json> [--visibility=<a.json,b.json>] [--agent-eval=<a.json,b.json>] [--growth-experiment=<a.json,b.json>] [--operation-id=<id>]
  arwp-change-receipt inspect-transition <receipt.json>
  arwp-change-receipt validate <receipt.json>
  arwp-change-receipt verify <receipt.json>
  arwp-change-receipt verify-revision <previous.json> <current.json>
  arwp-change-receipt status <receipt.json>
  arwp-change-receipt braid <braid.json> <receipt.json> [--out=<json>]
  arwp-change-receipt braid-report <braid.json>

For a merged transition, the --mutation JSON must include state=merged, mergeCommitSha, mergedAt/observedAt and explicit evidenceRefs/evidence/mergeUrl. A deployed transition must follow a hardened merged revision and provide deployment.state=deployed with the same commit SHA and explicit deployment evidence.

Canonical outcome adapters preserve provider/task/experiment evidence without inferring causality. Change Receipts are immutable evidence snapshots: new verification/deployment/outcome/re-review evidence creates a new revision; historical receipts are never rewritten.`);
}

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const value of argv) {
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const equal = value.indexOf('=');
    if (equal < 0) flags[value.slice(2)] = true;
    else flags[value.slice(2, equal)] = value.slice(equal + 1);
  }
  return { positionals, flags };
}

function readJson(filename, label) {
  if (!filename || typeof filename !== 'string') throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function optionalJson(filename, label) {
  return typeof filename === 'string' ? readJson(filename, label) : undefined;
}

function listFromFile(filename, label) {
  const value = optionalJson(filename, label);
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function pathList(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

function jsonList(value, label) {
  return pathList(value).map((filename, index) => readJson(filename, `${label} ${index + 1}`));
}

function write(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (typeof filename === 'string') fs.writeFileSync(path.resolve(filename), text, 'utf8');
  else process.stdout.write(text);
}

function executionFromFlags(flags) {
  if (!flags['execution-kind'] && !flags.execution) return undefined;
  if (typeof flags['execution-kind'] !== 'string' || typeof flags.execution !== 'string') throw new Error('--execution-kind and --execution must be supplied together.');
  return {
    kind: flags['execution-kind'],
    receipt: readJson(flags.execution, 'Execution receipt')
  };
}

function evidenceReceiptsFromFlags(flags) {
  if (typeof flags['evidence-receipt'] !== 'string') return [];
  return [{
    receipt: readJson(flags['evidence-receipt'], 'Evidence Receipt'),
    role: typeof flags['evidence-role'] === 'string' ? flags['evidence-role'] : 'supporting-observation'
  }];
}

function commonEvidenceOptions(flags) {
  return {
    execution: executionFromFlags(flags),
    evidenceReceipts: evidenceReceiptsFromFlags(flags),
    verifications: listFromFile(flags.verifications, 'Verification evidence'),
    outcomes: listFromFile(flags.outcomes, 'Outcome evidence'),
    deployment: optionalJson(flags.deployment, 'Deployment evidence'),
    review: optionalJson(flags.review, 'Review decision')
  };
}

function canonicalAdapters(receipt, flags) {
  return artifactAdapterSummary(receipt, {
    visibilitySnapshots: jsonList(flags.visibility, 'Visibility Snapshot'),
    agentEvalReceipts: jsonList(flags['agent-eval'], 'Agent Eval receipt'),
    growthExperiments: jsonList(flags['growth-experiment'], 'Growth Experiment'),
    operationId: typeof flags['operation-id'] === 'string' ? flags['operation-id'] : null
  });
}

function mergeReview(manual, adapted) {
  if (manual === undefined) return adapted;
  if (adapted === undefined) return manual;
  if (JSON.stringify(manual) !== JSON.stringify(adapted)) throw new Error('Manual --review conflicts with a review decision imported from Growth Experiment evidence.');
  return manual;
}

function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['help', '-h', '--help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'create') {
    const bundle = readJson(positionals[1], 'Transformation Bundle');
    const braid = readJson(positionals[2], 'BraidGraph');
    const options = commonEvidenceOptions(flags);
    const receipt = createChangeReceipt(bundle, braid, options);
    write(receipt, flags.out);
    return;
  }

  if (command === 'revise') {
    const previous = readJson(positionals[1], 'Change Receipt');
    const common = commonEvidenceOptions(flags);
    const adapted = canonicalAdapters(previous, flags);
    const combinedOutcomes = [...common.outcomes, ...adapted.outcomes];
    const review = mergeReview(common.review, adapted.review);
    const updates = {
      ...(common.execution ? { execution: common.execution } : {}),
      ...(common.evidenceReceipts.length ? { evidenceReceipts: common.evidenceReceipts } : {}),
      ...(common.verifications.length ? { verifications: common.verifications } : {}),
      ...(combinedOutcomes.length ? { outcomes: combinedOutcomes } : {}),
      ...(common.deployment !== undefined ? { deployment: common.deployment } : {}),
      ...(review !== undefined ? { review } : {}),
      ...(typeof flags.mutation === 'string' ? { mutation: readJson(flags.mutation, 'Mutation transition evidence') } : {}),
      ...(typeof flags.braid === 'string' ? { braidGraph: readJson(flags.braid, 'Current BraidGraph') } : {})
    };
    write(reviseChangeReceiptWithTransitionEvidence(previous, updates), flags.out);
    return;
  }

  if (command === 'adapt') {
    const receipt = readJson(positionals[1], 'Change Receipt');
    write(canonicalAdapters(receipt, flags), flags.out);
    return;
  }

  if (command === 'inspect-transition') {
    write(inspectGitHubTransitionEvidence(readJson(positionals[1], 'Change Receipt')));
    return;
  }

  if (command === 'validate') {
    const validation = validateChangeReceipt(readJson(positionals[1], 'Change Receipt'));
    write(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'verify') {
    const verification = verifyChangeReceipt(readJson(positionals[1], 'Change Receipt'));
    write(verification);
    if (!verification.valid) process.exitCode = 1;
    return;
  }

  if (command === 'verify-revision') {
    const verification = verifyChangeReceiptRevision(
      readJson(positionals[1], 'Previous Change Receipt'),
      readJson(positionals[2], 'Current Change Receipt')
    );
    write(verification);
    if (!verification.valid) process.exitCode = 1;
    return;
  }

  if (command === 'status') {
    write(changeReceiptStatus(readJson(positionals[1], 'Change Receipt')));
    return;
  }

  if (command === 'braid') {
    const braid = readJson(positionals[1], 'BraidGraph');
    const receipt = readJson(positionals[2], 'Change Receipt');
    write(mergeChangeReceiptIntoBraidGraph(braid, receipt), flags.out);
    return;
  }

  if (command === 'braid-report') {
    write(changeReceiptBraidReport(readJson(positionals[1], 'BraidGraph')));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`arwp-change-receipt: ${error.message}`);
  process.exitCode = 1;
}
