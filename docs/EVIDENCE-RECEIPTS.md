# ARWP Evidence Receipts v0.1

Status: implemented on `main` · reviewed 2026-09-05

An **ARWP Evidence Receipt** is a durable, integrity-protected record of one Resolver observation. It is not a publisher manifest, a new discovery protocol, an authorization grant or a trust certificate.

Implementation:

- `lib/evidence-receipt.mjs`
- `schema/evidence-receipt.schema.json`
- `bin/arwp-receipt.mjs`
- `scripts/evidence-receipt-test.mjs`
- `scripts/evidence-receipt-cli-test.mjs`
- `.github/workflows/evidence-receipts.yml`

## Create a receipt

First save Resolver output:

```bash
arwp resolve https://example.com --json > resolution.json
```

Then create a receipt:

```bash
arwp-receipt create resolution.json --output=receipt.json
```

For reproducible research/CI runs, pass the observation time explicitly:

```bash
arwp-receipt create resolution.json \
  --observed-at=2026-09-05T20:00:00Z \
  --tool-version=0.2.0 \
  --output=receipt.json
```

Without `--output`, the receipt is written to stdout as JSON.

## Verify a receipt

```bash
arwp-receipt verify receipt.json
arwp-receipt verify receipt.json --json
```

Verification recomputes the canonical payload digest and receipt ID. Any change to covered receipt content — including plans, source evidence, conflicts, metrics or future top-level fields — causes integrity verification to fail unless a new receipt is created.

## Receipt shape

A v0.1 receipt records at minimum:

```json
{
  "receiptVersion": "0.1",
  "receiptId": "urn:sha256:…",
  "producer": "ARWP Resolver",
  "target": "https://example.com/",
  "canonicalUrl": "https://example.com/",
  "observedAt": "2026-09-05T20:00:00.000Z",
  "toolVersion": "0.2.0",
  "resolverVersion": "0.1",
  "decisionPolicyVersion": "0.1",
  "evidenceSummary": {},
  "sources": [],
  "plans": {
    "read": {},
    "search": {},
    "structured": {},
    "tools": {},
    "agent": {}
  },
  "conflicts": [],
  "metrics": {},
  "upstreamStatus": {},
  "artifactDigests": [],
  "boundaries": {},
  "digests": {
    "algorithm": "sha256",
    "canonicalization": "…",
    "payload": "sha256:…"
  }
}
```

The receipt compacts interfaces to decision-relevant fields while keeping:

- discovery/source ID;
- source authority;
- discovery scope;
- protocol/kind/URL;
- selected interfaces;
- fallbacks;
- rejected candidates and rejection reason;
- conflicts;
- Resolver network metrics;
- upstream status.

Where ARD or another extensible source exposes contextual/extension evidence, receipt interface records may preserve `context`, `extensionTerms` and `unknownTerms` when they are already present in the Resolver observation.

## Canonicalization and digest

v0.1 canonicalization is deliberately simple and implementation-defined:

1. JSON object keys are recursively sorted lexicographically;
2. array order is preserved;
3. `undefined` values are omitted;
4. the canonical JSON is UTF-8 encoded without insignificant whitespace;
5. SHA-256 is computed over the receipt payload excluding `receiptId` and `digests`;
6. the same digest is represented as `digests.payload = "sha256:<hex>"` and `receiptId = "urn:sha256:<hex>"`.

This is an **ARWP canonical JSON v0.1** rule, not a claim of RFC 8785/JCS compatibility.

## Important source-body boundary

Current v0.1 protects the integrity of the **receipt payload**. It does **not** claim that every fetched source body was hashed during the original network observation.

Therefore current receipts explicitly publish:

```json
{
  "artifactDigests": [],
  "boundaries": {
    "sourceBodyDigestsCaptured": false
  }
}
```

A future fetch-instrumentation revision may add source/artifact body digests. It must not retroactively claim those digests existed in older receipts.

## What a valid receipt proves

A receipt with a valid digest establishes that the current receipt content matches the canonical payload from which its receipt ID was derived.

That makes it useful for:

- CI evidence retention;
- Resolver regression investigations;
- benchmark run history;
- claim-to-observation linking;
- comparing decisions across Resolver/policy versions;
- proving that a published receipt was later modified.

## What it does not prove

A valid receipt does **not** establish that:

- the publisher endorses ARWP;
- every source statement is true;
- a runtime is currently reachable;
- an Agent Card signer is trustworthy;
- an MCP/A2A operation is authorized;
- an ARD registry relevance score is a security/trust score;
- a website is universally “agent-ready”;
- a website will rank higher or receive AI citations.

## History model

Receipts are observations. New observations create new receipts rather than rewriting old ones.

Public benchmark/research releases should link immutable receipt IDs when receipt capture is enabled for that workflow. Corrections should preserve the old receipt and state why a newer receipt supersedes its interpretation.

## Remaining work

Tracked in issue #21:

- add source-body digests at bounded fetch time where useful;
- attach receipts directly to `resolve` / `assert` / benchmark flows rather than requiring an intermediate JSON file;
- publish a public receipt index/explorer;
- connect public claims to durable receipt IDs;
- attach workflow/release provenance or attestations where available;
- preserve independent vs owner-controlled evidence class in receipt indexes.
