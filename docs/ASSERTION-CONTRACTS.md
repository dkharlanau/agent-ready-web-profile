# ARWP Agent-Surface Assertion Contracts v0.1

Status: implemented on `main` · reviewed 2026-09-05

ARWP assertion contracts turn Resolver output into a deployment/CI contract. They answer questions such as:

- must a readable interface still exist?
- must the selected tools interface still be MCP?
- is an agent interface forbidden on this site?
- did the selected URL or protocol change since the last verified receipt?
- did a new discovery conflict appear?

This is **not a readiness score**. The contract tests only the explicit public-interface expectations a publisher or operator chooses to declare.

Implementation:

- `lib/assertion-contract.mjs`
- `schema/assertion-contract.schema.json`
- `bin/arwp-assert.mjs`
- `examples/agent-surface.contract.json`
- `scripts/assertion-contract-test.mjs`
- `scripts/assertion-cli-test.mjs`

## Minimal example

```json
{
  "contractVersion": "0.1",
  "target": "https://example.com/docs/",
  "expect": {
    "read": { "required": true },
    "tools": { "required": true, "protocol": "MCP" },
    "agent": { "required": false }
  }
}
```

## Intent rules

Supported intents are the same Resolver planning intents:

- `read`
- `search`
- `structured`
- `tools`
- `agent`

Each intent rule may use:

```json
{
  "required": true,
  "forbidden": false,
  "protocol": ["MCP", "WebMCP"],
  "kind": "mcp",
  "sourceAuthority": "upstream-standard",
  "outcome": ["selected", "insufficient-evidence"],
  "url": "https://example.com/mcp",
  "urlPrefix": "https://example.com/",
  "maxRejected": 2
}
```

`required` and `forbidden` cannot both be `true`.

If an intent is optional and selects no interface, selection-specific constraints such as `protocol` are not treated as failures. If `required: true`, absence fails the contract.

## Global evidence constraints

A contract may also require:

```json
{
  "canonicalUrl": "https://example.com/docs/",
  "maxConflicts": 0,
  "forbidConflictKinds": ["identity-mismatch"],
  "requiredSourceAuthorities": ["observed-web", "upstream-standard"]
}
```

These checks operate on Resolver evidence. They do not execute a discovered runtime.

## Baseline change policy

A verified Evidence Receipt can serve as a baseline:

```json
{
  "changePolicy": {
    "selectedInterface": "fail",
    "selectedProtocol": "fail",
    "planOutcome": "warn",
    "newConflicts": "fail"
  }
}
```

Allowed actions are:

- `ignore`
- `warn`
- `fail`

Before ARWP uses a baseline receipt, it verifies the receipt's canonical digest. A tampered receipt is itself a contract failure.

Current baseline comparisons include:

- selected interface URL changed;
- selected protocol changed;
- plan outcome changed;
- new conflict fingerprints appeared.

## Live check

```bash
arwp-assert agent-surface.contract.json
```

Live mode runs the ordinary bounded static Resolver. It does not:

- invoke MCP tools;
- call arbitrary OpenAPI operations;
- execute A2A tasks;
- follow ARD registry referrals/pagination automatically;
- infer/send credentials;
- grant authorization.

## Deterministic offline CI check

If a workflow already saved Resolver JSON:

```bash
arwp-assert agent-surface.contract.json \
  --resolution=resolution.json
```

This mode makes no network request in the assertion CLI.

## Compare with a receipt baseline

```bash
arwp-assert agent-surface.contract.json \
  --resolution=current-resolution.json \
  --baseline-receipt=last-good.receipt.json
```

## Emit a receipt for the current evaluation

```bash
arwp-assert agent-surface.contract.json \
  --resolution=current-resolution.json \
  --baseline-receipt=last-good.receipt.json \
  --receipt-output=current.receipt.json \
  --observed-at=2026-09-05T21:00:00Z
```

The receipt captures the Resolver observation. It does not certify that the contract itself is a universal definition of agent readiness.

## Exit codes

`arwp-assert` uses deterministic process exit codes:

| Code | Meaning |
| --- | --- |
| `0` | valid contract evaluated and passed |
| `1` | invalid contract/input or runtime error |
| `2` | valid contract evaluated but one or more failure-level assertions failed |

Warnings never cause exit code `2` by themselves.

## CI usage pattern

A safe deployment pattern is:

1. resolve a public staging/production URL;
2. evaluate the explicit contract;
3. keep a last-good Evidence Receipt as an optional baseline;
4. fail deployment only on contract rules the publisher deliberately marked as failures;
5. review drift rather than hiding it behind a score.

Example policy decisions:

- documentation site: `read.required=true`;
- API product: `structured.required=true` with `protocol=OpenAPI`;
- MCP-enabled product: `tools.required=true`, `protocol=MCP`;
- site that must not expose an agent endpoint: `agent.forbidden=true`;
- stable integration: `changePolicy.selectedInterface=fail`;
- exploratory environment: selected-interface drift may be `warn`.

## Boundaries

Passing an assertion contract does not imply:

- Google/Search/AI ranking;
- AI citation probability;
- publisher-wide security;
- runtime authorization;
- signer trust;
- universal agent readiness.

It only means the observed Resolver evidence satisfied the explicit contract at that run.
