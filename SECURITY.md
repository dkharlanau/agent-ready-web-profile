# Security policy

Agent-Ready Web Profile (ARWP) is pre-stable interoperability tooling that accepts public URLs, parses external discovery metadata and exposes read-only resolver/gateway surfaces. Security reports are welcome.

## Supported versions

Security fixes are applied to the current `main` branch and the latest published package/release line when practical. Pre-stable versions may change behavior while a fix is being developed.

## Reporting a vulnerability

Please do not publish exploit details in a public issue.

1. Prefer GitHub's private vulnerability-reporting / Security Advisory flow when it is available for this repository.
2. If a private report option is not available, open a minimal public issue that contains no exploit details and asks the maintainer for a private reporting channel.
3. Include the affected ARWP version/commit, component, impact, reproduction conditions and any safe proof-of-concept details in the private report.

Repository security page: https://github.com/dkharlanau/agent-ready-web-profile/security

## Scope notes

Useful reports include, among other things:

- SSRF or private-network reachability bypasses in bounded public URL fetching;
- redirect or DNS-rebinding boundary bypasses;
- unsafe parsing or resource-exhaustion behavior;
- authentication/authorization mistakes in remote gateway or resolver modes;
- signature/provenance verification defects;
- workflow or package-publishing supply-chain issues;
- cases where read-only tooling can unexpectedly mutate external state.

A metadata disagreement, stale upstream protocol description or ordinary website liveness failure is normally an interoperability/data-quality issue rather than a security vulnerability unless it creates a concrete security impact.

## Disclosure

The project aims to acknowledge credible reports, reproduce them, publish a fix and document material security changes without exposing users to avoidable risk. Exact response timelines are not promised for this pre-stable solo-maintained project.
