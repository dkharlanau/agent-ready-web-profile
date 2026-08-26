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

## Official Python SDK cross-check

The next CI gate performs the same style of cross-language check against the released official Python package `a2a-sdk[signing,encryption]==1.1.2`.

Tests: `scripts/a2a-python-interoperability-test.mjs` plus the small SDK-side helper `scripts/a2a-python-interop-helper.py`.

This fixture uses ES256 and proves a second algorithm and a second implementation language:

1. The Python SDK constructs and signs a v1 Agent Card with an ephemeral P-256 key.
2. ARWP and the Python SDK produce byte-for-byte identical canonical payloads for that reviewed card.
3. ARWP verifies the Python SDK's ES256 JWS using the public JWK produced from the same ephemeral key.
4. ARWP-compatible fixture logic signs the same payload and the Python SDK verifier accepts it using the exported public key.
5. Both directions reject a post-signing mutation.

GitHub Actions run `32918172066` on commit `17a18007b71d166a05a09d98f861338154b08b22` completed successfully, including both the JavaScript and Python interoperability steps and the full ARWP validation suite.

The Python dependency is installed only for the CI interoperability gate; it is not added to ARWP's runtime or npm package dependency surface.

## Canonicalization scope

Both official SDK checks assert exact canonical payload equality before relying on signature verification. No fallback canonicalizer or compatibility rewrite is attempted when the payloads differ.

For the reviewed fixtures, ARWP matched the official JavaScript SDK v1.0.1 and official Python SDK v1.1.2 canonical payloads exactly. This does not turn two fixtures into a universal canonicalization claim. Optional fields explicitly set to protobuf-default-equivalent values, schema extensions and future A2A model changes remain cases that should be tested independently rather than normalized silently.

## What this proves

The successful gates provide reproducible evidence of:

- bidirectional RS256 signature interoperability with the official A2A JavaScript SDK v1.0.1 for the reviewed JavaScript fixture;
- bidirectional ES256 signature interoperability with the official A2A Python SDK v1.1.2 for the reviewed Python fixture;
- identical canonical payloads for those two reviewed fixtures;
- rejection of post-signing mutation in both implementation pairings.

They do not prove:

- interoperability with every A2A implementation or every possible Agent Card shape;
- interoperability for every signature algorithm;
- trustworthiness of the signer or JWKS host;
- key pinning, PKI, revocation or organizational identity;
- universal compatibility with future A2A schema/default-field behavior;
- existence of an independently hosted public signed Agent Card.

ARWP can therefore claim reproducible cross-SDK interoperability for the tested JavaScript/RS256 and Python/ES256 fixtures, while keeping broader ecosystem and public-artifact interoperability claims scoped to evidence actually collected.
