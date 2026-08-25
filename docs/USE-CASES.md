# Why ARWP Helps

Agent-Ready Web Profile is easiest to understand as a **machine-readable service map for a website**.

A normal website already has navigation for people. An external AI client may still have to guess whether it should scrape HTML, call an API, read a dataset, use a retrieval index, load an Agent Skill, connect to MCP, or trust a particular review/provenance surface.

ARWP gives those interfaces one small discovery entry point:

```text
https://example.com/ai/site-profile.json
```

It does not make a model smarter and it does not replace the interfaces it points to. It reduces integration guesswork.

## 1. Prefer structured data over scraping

A knowledge site may publish both human pages and canonical JSON/NDJSON.

Without a discovery map, an agent may start with HTML because that is the easiest surface to find. With ARWP, a client can see that a canonical data distribution exists and decide whether it is more suitable.

Expected benefit:

- fewer brittle selectors and page-layout assumptions;
- stable IDs across HTML and data;
- easier citation back to canonical pages;
- explicit licensing/provenance alongside the data surface.

## 2. Give RAG systems a maintained retrieval surface

Some sites already build search indexes or RAG-ready NDJSON. ARWP can identify those distributions explicitly instead of forcing each downstream integration to rebuild them from the website.

Expected benefit:

- less repeated crawling/chunking work;
- the publisher can preserve canonical IDs, review state and citations in each record;
- downstream systems can still choose to build their own index when the declared distribution is not suitable.

## 3. Connect a static site to MCP without moving the knowledge

GitHub Pages can host HTML, JSON, schemas, retrieval indexes and Agent Skills, but it cannot execute a remote MCP server.

The generic ARWP gateway keeps the canonical knowledge on the static site and runs a small read-only adapter elsewhere:

```text
static website → site-profile.json → generic gateway → MCP client
```

Expected benefit:

- one gateway implementation can work with many sites;
- the gateway fetches only resources declared by the profile;
- a domain-specific MCP server can replace the generic adapter when richer semantics are required.

## 4. Keep Agent Skills separate from tools

A `SKILL.md` is a reusable procedure. It is not a transport and should not be represented as a remote tool just because both are used by agents.

ARWP makes that distinction explicit. A site can expose a real Agent Skill, an MCP server, both, or neither.

## 5. Make trust surfaces discoverable

For research, enterprise and safety-sensitive knowledge, the integration question is not only “where is the data?” but also:

- who maintains it;
- what was reviewed;
- where provenance lives;
- how to cite it;
- what license applies;
- where security/contact information lives.

ARWP provides a consistent place to find those existing trust surfaces.

## 6. Use one directory across multiple knowledge sites

The repository includes a public directory contract and a federated router.

A client can ask:

```text
Which registered sites expose retrieval?
```

and then search each site's declared retrieval surface while preserving source identity.

This is deliberately different from merging all knowledge into one central database. The publisher remains the canonical source.

## What ARWP does not promise

ARWP is not:

- a Google ranking mechanism;
- proof that a site is high quality;
- an authorization layer;
- a replacement for MCP, WebMCP, Agent Skills, OpenAPI or A2A;
- a single “AI readiness” score.

The profile is useful only when it remains a truthful map of interfaces that actually exist.
