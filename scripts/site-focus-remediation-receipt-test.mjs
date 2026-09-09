import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'site-focus-remediation-receipt-v0.1.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const sha = '0123456789abcdef0123456789abcdef01234567';
const digest = `sha256:${'a'.repeat(64)}`;
const receipt = {
  $schema: schema.$id,
  version: '0.1',
  id: 'sfr_example_20260909_focus_patch',
  generatedAt: '2026-09-09T05:00:00Z',
  site: {
    canonicalUrl: 'https://example.com/',
    repository: 'example/site',
    siteFocusVersion: '0.3'
  },
  baseline: {
    commitSha: sha,
    report: {
      workflowRunId: 100,
      generatedAt: '2026-09-09T04:00:00Z',
      artifactDigest: digest
    }
  },
  findings: [
    {
      id: 'homepage-contract-signal-missing',
      decision: 'patch',
      reason: 'The homepage did not expose enough evidence for the owner-declared problem contract.'
    }
  ],
  change: {
    commits: [sha],
    paths: ['index.html'],
    summary: 'Clarified the homepage problem and evidence boundary.'
  },
  verification: {
    sourceCheck: { workflowRunId: 101, conclusion: 'success' },
    deploy: { workflowRunId: 102, conclusion: 'success', commitSha: sha },
    productionFocus: {
      workflowRunId: 103,
      conclusion: 'success',
      commitSha: sha,
      artifactDigest: digest,
      verifiedAfterSuccessfulDeploy: true
    }
  },
  measurements: [
    {
      metric: 'homepage required signals missing',
      before: 2,
      after: 0,
      interpretation: 'Transparent Site Focus lexical diagnostic in the same fixed crawl scope.'
    }
  ],
  knownUnknowns: [
    'Search ranking impact was not measured.',
    'AI citation or recommendation impact was not measured.'
  ],
  outcome: 'keep',
  formalChangeReceipt: {
    status: 'not-applicable',
    reason: 'The remediation was a reviewed direct patch and did not execute through a Transformation Bundle/BraidGraph path.'
  }
};

assert.equal(validate(receipt), true, JSON.stringify(validate.errors));

const noUnknowns = structuredClone(receipt);
noUnknowns.knownUnknowns = [];
assert.equal(validate(noUnknowns), false, 'known unknowns must remain explicit');

const noDeployProof = structuredClone(receipt);
noDeployProof.verification.productionFocus.verifiedAfterSuccessfulDeploy = false;
assert.equal(validate(noDeployProof), false, 'production proof must explicitly follow a successful deploy');

const fakeFormal = structuredClone(receipt);
fakeFormal.formalChangeReceipt = { status: 'generated', reason: 'claimed without an id' };
assert.equal(validate(fakeFormal), false, 'generated formal Change Receipt status requires a receiptId');

console.log('PASS Site Focus Remediation Receipt v0.1 keeps direct-patch proof deployment-linked, measurable, uncertainty-explicit and distinct from formal SignalBraid Change Receipts');
