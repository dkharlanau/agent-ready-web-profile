import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  canonicalJson,
  createEvidenceReceipt,
  sha256Digest,
  validateEvidenceReceipt,
  verifyEvidenceReceipt
} from '../lib/evidence-receipt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'evidence-receipt.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

assert.equal(canonicalJson({ z: 1, a: { y: 2, x: 1 } }), '{"a":{"x":1,"y":2},"z":1}');
assert.equal(canonicalJson({ a: { x: 1, y: 2 }, z: 1 }), '{"a":{"x":1,"y":2},"z":1}');
assert.equal(sha256Digest({ b: 2, a: 1 }), sha256Digest({ a: 1, b: 2 }), 'object key order must not change the digest');
assert.notEqual(sha256Digest([1, 2]), sha256Digest([2, 1]), 'array order is meaningful and must remain covered');

const resolution = {
  resolverVersion: '0.1',
  decisionPolicyVersion: '0.1',
  target: 'https://example.com/docs/',
  canonicalUrl: 'https://example.com/docs/',
  identity: { name: 'Example Docs', description: 'Example', canonicalUrl: 'https://example.com/docs/' },
  sources: [
    { id: 'http-head:0', type: 'http-head', url: 'https://example.com/docs/', status: 'resolved', authority: 'observed-web', contentType: 'text/html' },
    { id: 'ard-catalog:0', type: 'ard-catalog', url: 'https://example.com/.well-known/ard.json', status: 'resolved', authority: 'multivendor-open-draft', contentType: 'application/json' }
  ],
  conflicts: [
    { kind: 'source-mismatch', severity: 'warning', capability: 'MCP', message: 'Two sources disagree.', values: { left: 'a', right: 'b' } }
  ],
  metrics: { resolverRequests: 8, resolverBytes: 2048, note: 'bounded' },
  upstreamStatus: { ARD: 'multivendor-open-draft', A2A: 'upstream-standard' },
  summary: { sourcesAttempted: 9, sourcesResolved: 7, interfacesResolved: 4, conflicts: 1 },
  plans: {
    read: {
      intent: 'read', outcome: 'selected',
      selected: { url: 'https://example.com/llms.txt', kind: 'llms', protocol: 'llms.txt', sourceId: 'homepage-scan', sourceAuthority: 'observed-web', discoveryScope: 'target-observed', score: 101 },
      fallbacks: [{ url: 'https://example.com/docs/', kind: 'html', protocol: 'HTML', sourceId: 'http-head:0', sourceAuthority: 'observed-web' }],
      rejected: [], reason: 'Selected llms evidence.'
    },
    search: { intent: 'search', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'No search interface.' },
    structured: {
      intent: 'structured', outcome: 'insufficient-evidence', selected: null, fallbacks: [],
      rejected: [{ url: 'https://example.com/openapi.json', protocol: 'OpenAPI', kind: 'api-description', sourceId: 'api-catalog:0', rejectionReason: 'root-scope-not-target-scope' }],
      reason: 'Root API evidence rejected for path-scoped target.'
    },
    tools: {
      intent: 'tools', outcome: 'selected',
      selected: { url: 'https://example.com/mcp', protocol: 'MCP', kind: 'mcp', sourceId: 'agents-json:0', sourceAuthority: 'community-convention', transport: 'streamable-http' },
      fallbacks: [], rejected: [], reason: 'Selected MCP.'
    },
    agent: { intent: 'agent', outcome: 'none', selected: null, fallbacks: [], rejected: [], reason: 'No agent interface.' }
  }
};

const observedAt = '2026-09-05T20:00:00Z';
const receipt = createEvidenceReceipt(resolution, { observedAt, toolVersion: '0.2.0' });
assert.equal(receipt.receiptVersion, '0.1');
assert.equal(receipt.observedAt, '2026-09-05T20:00:00.000Z');
assert.equal(receipt.toolVersion, '0.2.0');
assert.equal(receipt.resolverVersion, '0.1');
assert.equal(receipt.decisionPolicyVersion, '0.1');
assert.equal(receipt.sources.length, 2);
assert.equal(receipt.plans.read.selected.url, 'https://example.com/llms.txt');
assert.equal(receipt.plans.structured.outcome, 'insufficient-evidence');
assert.equal(receipt.plans.structured.rejected[0].rejectionReason, 'root-scope-not-target-scope');
assert.equal(receipt.conflicts.length, 1);
assert.equal(receipt.artifactDigests.length, 0);
assert.equal(receipt.boundaries.receiptIsResolverObservation, true);
assert.equal(receipt.boundaries.receiptIsPublisherManifest, false);
assert.equal(receipt.boundaries.receiptIsTrustCertificate, false);
assert.equal(receipt.boundaries.metadataGrantsAuthorization, false);
assert.equal(receipt.boundaries.sourceBodyDigestsCaptured, false);
assert.match(receipt.digests.payload, /^sha256:[a-f0-9]{64}$/);
assert.match(receipt.receiptId, /^urn:sha256:[a-f0-9]{64}$/);
assert.equal(validateEvidenceReceipt(receipt).valid, true);
assert.equal(validateSchema(receipt), true, JSON.stringify(validateSchema.errors));

const verified = verifyEvidenceReceipt(receipt);
assert.equal(verified.valid, true, JSON.stringify(verified.issues));
assert.equal(verified.integrity, true);
assert.equal(verified.expectedDigest, receipt.digests.payload);
assert.equal(verified.expectedReceiptId, receipt.receiptId);

const sameResolutionDifferentKeyOrder = {
  ...resolution,
  identity: { canonicalUrl: 'https://example.com/docs/', description: 'Example', name: 'Example Docs' }
};
const receipt2 = createEvidenceReceipt(sameResolutionDifferentKeyOrder, { observedAt, toolVersion: '0.2.0' });
assert.equal(receipt2.digests.payload, receipt.digests.payload, 'object key order must not change receipt digest');
assert.equal(receipt2.receiptId, receipt.receiptId);

const tampered = structuredClone(receipt);
tampered.plans.tools.selected.url = 'https://evil.example/mcp';
const tamperCheck = verifyEvidenceReceipt(tampered);
assert.equal(tamperCheck.valid, false);
assert.equal(tamperCheck.integrity, false);
assert.ok(tamperCheck.issues.some(issue => /payload digest/.test(issue)));

const tamperedId = structuredClone(receipt);
tamperedId.receiptId = `urn:sha256:${'0'.repeat(64)}`;
const idCheck = verifyEvidenceReceipt(tamperedId);
assert.equal(idCheck.valid, false);
assert.ok(idCheck.issues.some(issue => /receiptId/.test(issue)));

const extraField = structuredClone(receipt);
extraField.futureEvidence = { opaque: true };
const extraCheck = verifyEvidenceReceipt(extraField);
assert.equal(extraCheck.valid, false, 'new top-level evidence is covered by the canonical payload digest');

assert.throws(() => createEvidenceReceipt({}, { observedAt }), /target\/canonicalUrl/);
assert.throws(() => createEvidenceReceipt(resolution, { observedAt: 'not-a-date' }), /valid date\/time/);

console.log('PASS evidence receipt v0.1 canonicalizes Resolver observations, preserves selected/rejected/conflict evidence, validates against schema, detects tampering and keeps receipt integrity separate from publisher trust/authorization');
