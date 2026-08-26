import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeA2aAgentCard,
  verifyA2aAgentCardSignatures
} from '../lib/a2a-signature.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];
const JWKS_URL = 'https://keys.example/python-jwks.json';
const KID = 'a2a-python-interop-ec';
const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), 'a2a-python-interop-helper.py');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-a2a-python-'));

function protectedHeader(header) {
  return Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
}

try {
  // Direction 1: official Python SDK signs; ARWP verifies.
  execFileSync('python3', [helper, 'sign', directory], { stdio: 'inherit' });
  const pythonSigned = JSON.parse(fs.readFileSync(path.join(directory, 'python-signed-card.json'), 'utf8'));
  const pythonJwks = JSON.parse(fs.readFileSync(path.join(directory, 'python-jwks.json'), 'utf8'));
  const pythonCanonical = fs.readFileSync(path.join(directory, 'python-canonical.txt'), 'utf8');
  const arwpCanonical = canonicalizeA2aAgentCard(pythonSigned);

  assert.equal(
    arwpCanonical,
    pythonCanonical,
    'ARWP and official a2a-sdk==1.1.2 must canonicalize the reviewed Python fixture identically.'
  );

  const verification = await verifyA2aAgentCardSignatures(pythonSigned, {
    fetchImpl: async url => {
      assert.equal(String(url), JWKS_URL);
      return new Response(JSON.stringify(pythonJwks), {
        status: 200,
        headers: { 'content-type': 'application/jwk-set+json' }
      });
    },
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  assert.equal(verification.status, 'signature-verified');
  assert.equal(verification.verified, 1);
  assert.equal(verification.signatures[0].alg, 'ES256');

  const tamperedPythonCard = structuredClone(pythonSigned);
  tamperedPythonCard.description = 'Tampered after the Python SDK signed the card.';
  const tamperedVerification = await verifyA2aAgentCardSignatures(tamperedPythonCard, {
    fetchImpl: async () => new Response(JSON.stringify(pythonJwks), {
      status: 200,
      headers: { 'content-type': 'application/jwk-set+json' }
    }),
    resolveImpl: PUBLIC_DNS,
    timeoutMs: 1000
  });
  assert.equal(tamperedVerification.status, 'signature-invalid');

  // Direction 2: ARWP-compatible signing input signs; official Python SDK verifies.
  const unsignedCard = structuredClone(pythonSigned);
  delete unsignedCard.signatures;
  const canonical = canonicalizeA2aAgentCard(unsignedCard);
  assert.equal(canonical, pythonCanonical);

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const protectedValue = protectedHeader({
    alg: 'ES256',
    kid: KID,
    jku: JWKS_URL,
    typ: 'JOSE'
  });
  const payload = Buffer.from(canonical, 'utf8').toString('base64url');
  const signature = cryptoSign(
    'sha256',
    Buffer.from(`${protectedValue}.${payload}`, 'ascii'),
    { key: privateKey, dsaEncoding: 'ieee-p1363' }
  ).toString('base64url');
  const arwpSigned = {
    ...unsignedCard,
    signatures: [{ protected: protectedValue, signature }]
  };

  fs.writeFileSync(
    path.join(directory, 'arwp-signed-card.json'),
    `${JSON.stringify(arwpSigned, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(directory, 'arwp-public.pem'),
    publicKey.export({ type: 'spki', format: 'pem' }),
    'utf8'
  );

  execFileSync('python3', [helper, 'verify', directory], { stdio: 'inherit' });
  console.log('PASS bidirectional A2A signature interoperability with official Python a2a-sdk==1.1.2 (ES256)');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
