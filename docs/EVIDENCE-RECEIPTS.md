# ARWP Evidence Receipts v0.1

Status: implemented on `main` · reviewed 2026-09-05

An **ARWP Evidence Receipt** is a durable, integrity-protected record of one Resolver observation. It is not a publisher manifest, a new discovery protocol, an authorization grant or a trust certificate.

Implementation:

- `lib/evidence-receipt.mjs`
- `lib/evidence-capture.mjs`
- `schema/evidence-receipt.schema.json`
- `bin/arwp-receipt.mjs`
- `scripts/evidence-receipt-test.mjs`
- `scripts/evidence-capture-test.mjs`
- `scripts/evidence-receipt-cli-test.mjs`
- `scripts/evidence-receipt-explorer.mjs`
- `.github/workflows/evidence-receipts.yml`
- `.github/workflows/reference-evidence-receipt.yml`
- `.github/workflows/evidence-receipt-explorer.yml`

## Create a receipt from saved Resolver output

```bash
arwp resolve https://example.com --json > resolution.json
arwp-receipt create resolution.json --output=receipt.json
```

For reproducible research/CI runs:

```bash
arwp-receipt create resolution.json \
  --observed-at=2026-09-05T20:00:00Z \
  --tool-version=0.2.0 \
  --output=receipt.json
```

This mode does not add any network requests beyond the already completed Resolver run and therefore does not claim source-body hashes unless they were already captured elsewhere.

## Capture a richer live receipt

`capture` is an explicit, higher-evidence mode:

```bash
arwp-receipt capture https://example.com \
  --max-sources=8 \
  --max-bytes=524288 \
  --output=receipt.json
```

The command:

1. runs the ordinary bounded Resolver;
2. creates the normal v0.1 receipt;
3. selects already-**resolved**, public-HTTPS, non-HEAD source URLs;
4. de-duplicates them by URL;
5. performs additional bounded GET refetches only for that explicit capture operation;
6. records SHA-256 evidence for each successfully captured source;
7. preserves HTTP/fetch failures and sources omitted by `maxSources`;
8. recomputes the canonical receipt digest so capture evidence is integrity-covered.

Ordinary `arwp resolve` does **not** pay this additional network cost.

### Source digest scope

Current capture digests use:

`decoded-utf8-complete-bounded-response-body`

That means the digest covers the complete UTF-8 text returned by ARWP's bounded fetch after decoding the received bytes. The receipt separately records:

- requested URL;
- final URL after validated redirects;
- source IDs/types represented by the fetch;
- media type;
- network byte count;
- UTF-8 bytes actually hashed;
- SHA-256;
- configured per-source byte bound.

ARWP does **not** describe this as a hash of HTTP transfer framing or guaranteed raw origin bytes. Bodies that exceed the bound fail capture; ARWP does not publish a digest of a truncated body as if it were complete. HEAD-only evidence is skipped explicitly.

## Verify a receipt

```bash
arwp-receipt verify receipt.json
arwp-receipt verify receipt.json --json
```

Verification recomputes the canonical payload digest and receipt ID. Any change to covered receipt content — including plans, source evidence, conflicts, capture evidence, metrics or future top-level fields — causes integrity verification to fail unless a new receipt is created.

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

A richer `capture` receipt additionally contains `artifactDigests[]` and `captureSummary`.

The receipt compacts interfaces to decision-relevant fields while keeping discovery/source ID, source authority, discovery scope, protocol/kind/URL, selected interfaces, fallbacks, rejected candidates/reasons, conflicts, Resolver network metrics and upstream status.

Where ARD or another extensible source exposes contextual/extension evidence, receipt interface records may preserve `context`, `extensionTerms` and `unknownTerms` when they are already present in the Resolver observation.

## Canonicalization and digest

v0.1 canonicalization is deliberately simple and implementation-defined:

1. JSON object keys are recursively sorted lexicographically;
2. array order is preserved;
3. `undefined` values are omitted;
4. canonical JSON is UTF-8 encoded without insignificant whitespace;
5. SHA-256 is computed over the receipt payload excluding `receiptId` and `digests`;
6. the same digest is represented as `digests.payload = "sha256:<hex>"` and `receiptId = "urn:sha256:<hex>"`.

This is an **ARWP canonical JSON v0.1** rule, not a claim of RFC 8785/JCS compatibility.

## Two valid evidence levels

A basic receipt may intentionally say:

```json
{
  "artifactDigests": [],
  "boundaries": {
    "sourceBodyDigestsCaptured": false
  }
}
```

A richer live capture may say:

```json
{
  "boundaries": {
    "sourceBodyDigestsCaptured": true,
    "sourceBodyDigestScope": "decoded-utf8-complete-bounded-response-body"
  },
  "captureSummary": {
    "captured": 2,
    "failed": 0
  }
}
```

Both are valid observations. ARWP never retroactively adds hashes to an older receipt.

## Public append-only explorer

The public index is:

`https://dkharlanau.github.io/agent-ready-web-profile/evidence/receipts/`

It is generated from immutable `*.receipt.json` records. Every record is integrity-verified before index/detail pages are generated; CI fails if committed generated output differs from the deterministic builder.

The first two records intentionally demonstrate the evidence progression on the owner-controlled ARWP reference site:

1. ordinary Resolver receipt — payload integrity, no body hashes;
2. explicit richer capture — same type of observation plus two scoped source-body SHA-256 records.

Both are classified as `project-reference`, not independent adoption evidence.

## What a valid receipt proves

A receipt with a valid digest establishes that the current receipt content matches the canonical payload from which its receipt ID was derived. When scoped source-body digests are present, it additionally records the decoded bounded bodies ARWP explicitly captured during that observation.

Useful cases include CI evidence retention, Resolver regression investigations, benchmark history, assertion baselines, claim-to-observation linking and comparing decisions across Resolver/policy versions.

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

Receipts are observations. New observations create new receipts rather than rewriting old ones. Corrections preserve the old receipt and explain why a newer receipt supersedes its operational relevance.

## Remaining work

Tracked in issue #21:

- capture and publish independent (not owner-controlled) observations with the same evidence-class discipline;
- let benchmark workflows emit receipts directly when useful;
- add workflow/commit/release provenance fields to the receipt payload where provenance actually exists;
- connect public claims to receipt IDs only when the underlying workflow captured that exact evidence;
- consider raw-byte hashing only if it can be implemented with an explicit representation/content-coding scope without weakening the current semantics.
