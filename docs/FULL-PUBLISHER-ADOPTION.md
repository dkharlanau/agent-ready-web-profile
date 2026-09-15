# Full Publisher Adoption

`adoption.level: "full-publisher"` is the ARWP completeness claim for a public information website. It is stricter than core profile conformance and does not require unrelated runtime protocols.

The schema requires these surfaces for this level:

- `languages`
- `web.sitemap`, `web.robots`, `web.llms`
- `identity.namespace`, `identity.idPattern`
- `trust.publisher`
- `trust.license`
- `trust.citation`
- `trust.provenance`
- `trust.reviewPolicy`
- `trust.privacy`
- `trust.accessibility`
- `trust.contact`
- `trust.corrections`
- `trust.security`

Conditional surfaces remain conditional. Declare `web.manifest` when a web manifest exists, `trust.terms` when the user relationship needs explicit terms, and `identity.aliases` when aliases are maintained.

Full adoption also requires the ordinary web checks that should stay in established HTML/HTTP mechanisms rather than being duplicated as ARWP fields: canonical and language metadata, favicon delivery, correctly sized touch icons when declared, complete manifest icons when a manifest exists, a stable default social preview image, coherent social-card metadata, and visible first-party publisher/trust information.

Do not invent MCP, A2A, WebMCP, Agent Skills, OpenAPI or another capability merely to satisfy this level. Full Publisher Adoption is a completeness claim about applicable publisher surfaces, not proof of indexing, ranking, citation, accessibility conformance or business outcomes.
