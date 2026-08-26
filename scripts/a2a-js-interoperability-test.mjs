import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import {
  canonicalizeAgentCard as canonicalizeOfficialAgentCard,
  generateAgentCardSignature,
  verifyAgentCardSignature
} from '@a2a-js/sdk';
import {
  canonicalizeA2aAgentCard,
  verifyA2aAgentCardSignatures
} from '../lib/a2a-signature.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];
const JWKS_URL = 'https://keys.example/jwks.json';
const KID = 'a2a-js-interop-rsa';

function reviewedCard() {
  return {
    name: 'ARWP A2A JS interoperability fixture',
    description: 'A non-empty v1 Agent Card used only for deterministic cross-SDK signature verification.',
    supportedInterfaces: [{
      url: 'https://agent.example/a2a',
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0'
    }],
    version: '1.0.0',
    capabilities: { streaming: true },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json'],
    skills: [{
      id: 'lookup',
      name: 'Lookup',
      description: 'Look up a deterministic fixture value.',
      tags: ['lookup']
    }]
  };
}

function jwksFetch(keys) {
  return async url => {
    assert.equal(String(url), JWKS_URL);
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'content-type': 'application/jwk-set+json' }
    });
  };
}

function protectedHeader(header) {
  return Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
}

const card = reviewedCard();
const officialCanonical = canonicalizeOfficialAgentCard(card);
const arwpCanonical = canonicalizeA2aAgentCard(card);
assert.equal(
  arwpCanonical,
  officialCanonical,
  'ARWP and @a2a-js/sdk@1.0.1 must canonicalize the reviewed interoperability card identically.'
);

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
publicJwk.kid = KID;
publicJwk.alg = 'RS256';
publicJwk.use = 'sig';

// Direction 1: official A2A JavaScript SDK signs; ARWP verifies.
const sdkSigner = generateAgentCardSignature(privateKey, {
  alg: 'RS256',
  kid: KID,
  typ: 'JOSE',
  jku: JWKS_URL
});
const sdkSignedCard = await sdkSigner(structuredClone(card));
const arwpVerification = await verifyA2aAgentCardSignatures(sdkSignedCard, {
  fetchImpl: jwksFetch([publicJwk]),
  resolveImpl: PUBLIC_DNS,
  timeoutMs: 1000
});
assert.equal(arwpVerification.status, 'signature-verified');
assert.equal(arwpVerification.verified, 1);

// Direction 2: ARWP-compatible signing input signs; official SDK verifies.
const protectedValue = protectedHeader({
  alg: 'RS256',
  kid: KID,
  typ: 'JOSE',
  jku: JWKS_URL
});
const payload = Buffer.from(arwpCanonical, 'utf8').toString('base64url');
const signature = cryptoSign(
  'RSA-SHA256',
  Buffer.from(`${protectedValue}.${payload}`, 'ascii'),
  privateKey
).toString('base64url');
const arwpSignedCard = {
  ...structuredClone(card),
  signatures: [{ protected: protectedValue, signature }]
};
const sdkVerifier = verifyAgentCardSignature(async (kid, jku) => {
  assert.equal(kid, KID);
  assert.equal(jku, JWKS_URL);
  return publicKey;
});
await sdkVerifier(arwpSignedCard);

// Both implementations must reject the same post-signing mutation.
const tamperedSdkCard = structuredClone(sdkSignedCard);
tamperedSdkCard.description = 'Tampered after the official SDK signed the card.';
const arwpTampered = await verifyA2aAgentCardSignatures(tamperedSdkCard, {
  fetchImpl: jwksFetch([publicJwk]),
  resolveImpl: PUBLIC_DNS,
  timeoutMs: 1000
});
assert.equal(arwpTampered.status, 'signature-invalid');

const tamperedArwpCard = structuredClone(arwpSignedCard);
tamperedArwpCard.description = 'Tampered after ARWP-compatible signing.';
await assert.rejects(() => sdkVerifier(tamperedArwpCard), /No valid signatures found/i);

console.log('PASS bidirectional A2A signature interoperability with official @a2a-js/sdk@1.0.1 (RS256)');
