# ARWP assertions — design direction

`arwp assert` is a proposed CI-facing contract for the public agent surface of a deployed site.

It should reuse Resolver output rather than create another discovery format.

Example:

```json
{
  "assertionVersion": "0.1",
  "target": "https://example.com/docs/",
  "expect": {
    "read": { "required": true },
    "search": { "required": false },
    "structured": { "required": false },
    "tools": { "required": true, "protocol": "MCP" },
    "agent": { "required": false }
  }
}
```

## Intended checks

- required intent disappeared;
- selected protocol changed unexpectedly;
- canonical identity changed;
- new ambiguity/conflict appears;
- explicitly forbidden intent becomes selected;
- durable endpoint changes without an evidenced migration.

## Non-goals

- executing mutable tools;
- authenticating with credentials discovered from metadata;
- inventing operation semantics;
- replacing deployment tests;
- producing an agent-readiness score.

The first implementation should remain small and deterministic enough for GitHub Actions and other CI systems.
