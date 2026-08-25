import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import {
  canonicalizeA2aAgentCard,
  validateA2aAgentCardV1,
  verifyA2aAgentCardSignatures
} from '../lib/a2a-signature.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];

function baseCard() {
  return {
    name: 'Example Agent',
    description: 'Signed Agent Card fixture.',
    supportedInterfaces: [{
      url: 'https://agent.example/a2a',
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0'
    }],
    version: '1.0.0',
    capabilities: {},
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [{
      id: 'search',
      name: 'Search',
      description: 'Search the fixture.',
      tags: ['search']
    }]
  };
}

function protectedHeader(header) {
  return Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
}

function payloadFor(card) {
  return Buffer.from(canonicalizeA2aAgentCard(card), 'utf8').toString('base64url');
}

function jwksFetch(keys) {
  return async url => {
    assert.equal(String(url), 'https://keys.example/jwks.json');
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'content-type': 'application/jwk-set+json' }
    });
  };
}

const unsigned = baseCard();
assert.equal(validateA2aAgentCardV1(unsigned).valid, true);
let result = await verifyA2aAgentCardSignatures(unsigned, { resolveImpl: PUBLIC_DNS });
assert.equal(result.status, 'unsigned');
assert.equal(result.verified, 0);

const invalidShape = { name: 'Broken' };
result = await verifyA2aAgentCardSignatures(invalidShape, { resolveImpl: PUBLIC_DNS });
assert.equal(result.status, 'invalid-card');
assert.ok(result.shape.issues.length > 2);

const { privateKey: rsaPrivate, publicKey: rsaPublic } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const rsaJwk = rsaPublic.export({ format: 'jwk' });
rsaJwk.kid = 'rsa-key';
rsaJwk.alg = 'RS256';
rsaJwk.use = 'sig';
const rsaCard = baseCard();
const rsaProtected = protectedHeader({ alg: 'RS256', kid: 'rsa-key', jku: 'https://keys.example/jwks.json', typ: 'JOSE' });
const rsaInput = `${rsaProtected}.${payloadFor(rsaCard)}`;
const rsaSignature = cryptoSign('RSA-SHA256', Buffer.from(rsaInput, 'ascii'), rsaPrivate).toString('base64url');
rsaCard.signatures = [{ protected: rsaProtected, signature: rsaSignature }];
result = await verifyA2aAgentCardSignatures(rsaCard, {
  fetchImpl: jwksFetch([rsaJwk]), resolveImpl: PUBLIC_DNS, timeoutMs: 1000
});
assert.equal(result.status, 'signature-verified');
assert.equal(result.verified, 1);
assert.equal(result.signatures[0].alg, 'RS256');

const tampered = structuredClone(rsaCard);
tampered.description = 'Tampered after signing.';
result = await verifyA2aAgentCardSignatures(tampered, {
  fetchImpl: jwksFetch([rsaJwk]), resolveImpl: PUBLIC_DNS, timeoutMs: 1000
});
assert.equal(result.status, 'signature-invalid');
assert.equal(result.verified, 0);

const { privateKey: ecPrivate, publicKey: ecPublic } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ecJwk = ecPublic.export({ format: 'jwk' });
ecJwk.kid = 'ec-key';
ecJwk.alg = 'ES256';
ecJwk.use = 'sig';
const ecCard = baseCard();
ecCard.skills[0].examples = [];
const ecProtected = protectedHeader({ alg: 'ES256', kid: 'ec-key', jku: 'https://keys.example/jwks.json' });
const ecInput = `${ecProtected}.${payloadFor(ecCard)}`;
const ecSignature = cryptoSign('sha256', Buffer.from(ecInput, 'ascii'), { key: ecPrivate, dsaEncoding: 'ieee-p1363' }).toString('base64url');
ecCard.signatures = [{ protected: ecProtected, signature: ecSignature }];
result = await verifyA2aAgentCardSignatures(ecCard, {
  fetchImpl: jwksFetch([ecJwk]), resolveImpl: PUBLIC_DNS, timeoutMs: 1000
});
assert.equal(result.status, 'signature-verified');
assert.equal(result.signatures[0].alg, 'ES256');

const unsupported = baseCard();
unsupported.signatures = [{
  protected: protectedHeader({ alg: 'EdDSA', kid: 'ed-key', jku: 'https://keys.example/jwks.json' }),
  signature: Buffer.from('fixture').toString('base64url')
}];
result = await verifyA2aAgentCardSignatures(unsupported, { fetchImpl: jwksFetch([]), resolveImpl: PUBLIC_DNS });
assert.equal(result.status, 'not-assessed');
assert.equal(result.signatures[0].status, 'unsupported-algorithm');

const noKeyLocation = baseCard();
noKeyLocation.signatures = [{
  protected: protectedHeader({ alg: 'RS256', kid: 'rsa-key' }),
  signature: rsaSignature
}];
result = await verifyA2aAgentCardSignatures(noKeyLocation, { resolveImpl: PUBLIC_DNS });
assert.equal(result.status, 'not-assessed');
assert.equal(result.signatures[0].status, 'key-unavailable');

const privateJku = baseCard();
privateJku.signatures = [{
  protected: protectedHeader({ alg: 'RS256', kid: 'rsa-key', jku: 'https://127.0.0.1/jwks.json' }),
  signature: rsaSignature
}];
result = await verifyA2aAgentCardSignatures(privateJku, { fetchImpl: async () => { throw new Error('must not fetch private JWKS'); }, resolveImpl: PUBLIC_DNS });
assert.equal(result.status, 'not-assessed');
assert.match(result.signatures[0].error, /Private or reserved|not allowed/i);

console.log('PASS A2A signature verifier distinguishes unsigned, valid RS256/ES256, tampered, unsupported and unavailable-key states');
