# MCP compatibility pass

The Resolver already has a modern `server/discover` path and a legacy initialize fallback. R4 treats that as a foundation, not proof of broad compatibility.

The compatibility pass should verify:

- current MCP 2026-07-28 `server/discover` request/response semantics;
- stateless modern behavior and routing metadata expectations;
- authorization-required as a distinct non-failure state;
- no credentials inferred/sent from metadata;
- no tool invocation during verification;
- legacy initialize/session behavior remains isolated and explicitly labeled legacy;
- independent server implementations from more than one SDK/runtime;
- static Server Card / runtime identity reconciliation;
- version/support results published in the protocol matrix.

Any fallback added for a specific implementation must be justified by upstream compatibility evidence rather than a hostname-specific branch.
