# A2A signature interoperability evidence

ARWP treats signature verification as a bounded cryptographic claim, not as a general trust or implementation-conformance claim.

## Official JavaScript SDK cross-check

On 2026-08-26, CI ran a bidirectional reproducible test against the official A2A JavaScript SDK package `@a2a-js/sdk@1.0.1`.

Test: `scripts/a2a-js-interoperability-test.mjs`

The reviewed fixture intentionally uses non-empty required values and an RS256 key so the test checks the signing contract rather than relying on ambiguous optional/default-field cases.

The test asserts all of the following:

1. `@a2a-js/sdk@1.0.1` and ARWP produce exactly the same canonical JSON payload for the reviewed Agent Card.
2. The official SDK signs the card; ARWP verifies that signature using the corresponding public JWK.
3. ARWP-compatible fixture logic signs the same canonical payload; the official SDK verifier accepts it.
4. A post-signing mutation is rejected in both directions.
5. No normalization fallback is applied to make a failed signature pass: canonical payload equality is an explicit assertion.

The first CI run containing this cross-SDK gate was GitHub Actions run `32917963170` on commit `231c527d985a251413a3e7f3585775964d04e39a`; the interoperability step and the full validation job completed successfully.

## Canonicalization scope

The official JavaScript SDK v1.0.1 normalizes an Agent Card through its generated v1 model, removes fields not represented by that model, excludes `signatures`, removes empty values according to its implementation, then applies deterministic JCS-style key ordering. ARWP's current presence-normalization path produced byte-for-byte identical canonical JSON for the reviewed fixture above.

This test deliberately does not turn that single fixture into a universal canonicalization claim. Optional fields explicitly set to protobuf-default-equivalent values, schema extensions and future A2A model changes remain cases that should be tested independently rather than normalized silently.

## What this proves

The successful test is evidence of **bidirectional RS256 signature interoperability with the official A2A JavaScript SDK v1.0.1 for the reviewed fixture**.

It does not prove:

- interoperability with every A2A implementation or language SDK;
- interoperability for every supported signature algorithm;
- trustworthiness of the signer or JWKS host;
- key pinning, PKI, revocation or organizational identity;
- universal compatibility with future A2A schema/default-field behavior;
- existence of an independently hosted public signed Agent Card.

ARWP therefore continues to describe the verifier as internally verified plus cross-checked against the official JavaScript SDK, while leaving the broader multi-implementation interoperability gate open.
