# From collection downloads to inspectable agent inputs

A collection can be easy to download and still be hard to use correctly. Which edition is this? Must the ideas be read in order? Where did the agent get that sentence? Vedokrok’s structured-data work made those questions answerable through public files and a read-only tool interface.

This is an owner-authorized technical retrospective recorded on **12 October 2026**, with an [22-lesson machine-readable companion](2026-10-12-vedokrok-structured-data.json). The implementation and observations were performed by an agent; this is an agent self-review, not independent human review. It records implementation experience and bounded public checks. Search visibility, AI citations, traffic, business results and real-user task success were **not measured**.

## What a client can now inspect

The website exposes definitions, topic catalogs, typed relationships, schemas, checksums, change history, collection manifests, collection profiles and an empty agent-output trace template. The vocabulary has 15 project definitions and 15 topic definitions. The catalog registers 12 datasets. These are website projections of approved content; the canonical knowledge corpus remains separate.

The public refresh at **2026-10-12T06:27:59.596Z** downloaded five JSON files. All five returned HTTP 200 with JSON content type and parsed successfully. The companion records their exact SHA-256 digests and byte lengths.

| Public file | Count in the observed response | What that count means |
| --- | ---: | --- |
| [Schema index](https://vedokrok.com/data/schema-index.json) | 20 | Registered JSON Schema contracts |
| [Checksum manifest](https://vedokrok.com/data/checksums.json) | 1,584 | Listed public JSON files, excluding the manifest itself |
| [Collection manifest index](https://vedokrok.com/data/collection-manifests.json) | 123 | Per-collection manifest entries |
| [Collection profile index](https://vedokrok.com/data/collection-profiles.json) | 123 | Per-collection applicability profiles |
| [Data history](https://vedokrok.com/data/data-history.json) | 3 | Retained editions |

This refresh checked the five files themselves. It did not fetch every listed payload. The earlier implementation session reported 1,613 passing local tests, a complete 1,584-file live audit, a 14-tool MCP smoke test and browser checks at widths of 1,280, 390 and 320 pixels. Those historical aggregates are explicitly marked **agent-reported**: raw logs and private repository records are excluded from this public case. Hosted CI executed no steps; it was not a passing run. The ARWP documentation checks do not repeat or independently certify the website checks.

## Names and relationships need different jobs

Definitions now come from one source for visible English copy, JSON and JSON-LD. A stable term URL leads to a real definition anchor. This avoids three slightly different answers to “what does this project mean by agent?” Project format definitions describe an additional type; subject terms describe what the content is about.

The graph goes further than naming things. Its 19 relationship types declare direction, endpoint kinds and authority. A browsing link, a prerequisite and a source supporting a claim serve different purposes. A source can support, challenge, limit or contextualize a proposition; merely linking it does not choose one of those roles. Claim identities in this website projection are scoped to the idea version and position, rather than presented as newly authored canonical claim records.

Collection catalogs use explicit membership selectors. Overlap counts shared stable idea IDs, including pairs with no shared members. Neither measure claims semantic similarity or quality. These boundaries make the files useful without pretending the website has discovered new knowledge relationships.

## A version identifies the record; a digest identifies the download

A released collection can keep its knowledge edition while its website download changes. The implementation therefore keeps record versions and corpus snapshot bindings separate from exact file hashes.

A client verifies the final UTF-8 response bytes after HTTP content decoding, including the file’s trailing newline. Parsing and reserializing first can change whitespace or key order and produce a different digest. [Schema.org DataDownload](https://schema.org/DataDownload) supplies the download description vocabulary; Vedokrok’s own manifest defines which bytes its SHA-256 and size describe.

The checksum manifest excludes itself explicitly. Self-hashing would make its content depend on bytes still being written. A checksum establishes byte agreement, not authenticity or truth. A signed trust boundary would be a separate feature.

History uses explicit append-only checkpoints. The build reads the ledger; recording a checkpoint is a separate operation, and the release gate requires the current built state to have a retained edition. Historical metadata preserves IDs, membership and hashed descriptors without republishing old knowledge prose. An old edition remains identifiable, but consumers must still inspect current notices. A disappeared ID does not tell them whether the item was retired, withdrawn or temporarily unavailable. Observation, recording and deployment times also remain distinct.

## A collection is not automatically a course

The manifest index lets an agent fetch one collection and find exact member versions, payload URLs, hashes, byte counts and current notice locations. The profile adds the collection’s stated purpose and each member’s own conditions and limits. Thin indexes keep these detailed files separately fetchable.

Missing conditions remain missing. Ten released ideas lacked `avoid_when`; provided flags describe that gap. The projection does not fill it with invented advice, treat it as unrestricted use or make one member’s condition apply to the whole collection. Selection guidance written by an agent is labeled separately from released source fields.

All 123 collections in the observed edition were ordinary collections. Their array positions are preserved, `sequence_required` is false, and a suggested starting idea is optional. A learning path may declare a reading sequence and a playbook may declare an action sequence only when that is its released kind. [Schema.org ItemList](https://schema.org/ItemList) distinguishes list position and order; order alone does not establish a prerequisite.

Actual dependencies come from explicit `requires` edges, directed from the member to a currently public target. The projection resolves target versions and whether they belong to the same collection. It does not infer dependencies from earlier positions, reverse edges or invent a topological order. Approval and availability filtering happen before public membership and dependency construction.

## An output trace answers “where from?”, not “is it true?”

The optional trace distinguishes four origins: a sourced summary, agent reasoning, user input and an observed result. It links output locations to exact released item versions and source locations. Old run receipts without the field remain accepted as `not_recorded`; partial and complete trace coverage are separate from whether a run is complete.

Source and output addresses use [JSON Pointer, RFC 6901](https://www.rfc-editor.org/rfc/rfc6901). The validator checks resolution, escaping, array indexes and nonempty readings; it rejects missing locations and inherited object properties. Supplemental references are bounded before extra asset reads, then checked against the current release. An observed result needs a declared observation basis, but validation cannot establish that the event really happened.

[W3C PROV-O](https://www.w3.org/TR/prov-o/) provides derivation vocabulary. The tool returns document-local provenance nodes with version, release and snapshot bindings. `wasDerivedFrom` records origin; it is not the same as a source supporting a claim. Complete trace coverage does not prove an agent’s reasoning, source support or successful execution. The public template is empty, and no real user runs were added to the datasets. Synthetic draft probes checked protocol behavior only.

Final review caught a practical client failure: the tool returned PROV data while its closed advertised output schema did not allow that property. The implementation corrected the schema and validated success and failure responses against it. Testing the handler had been insufficient; a client follows the contract it is shown.

The same distinction applies to the [JSON Schema contracts](https://json-schema.org/draft/2020-12/json-schema-core): they check payload shape, not editorial quality, evidence truth or usefulness. Negative checks rejected wrong item versions, snapshot mismatches, flipped evidence roles, bad pointers, duplicate outputs and incomplete coverage. Compatible additions stayed optional; breaking contracts need their own version and migration boundary.

## Integration exposed four more boundaries

The [sitemap root](https://vedokrok.com/sitemap.xml) became an index of five leaf sitemaps. Crawl audits and submission tooling had to follow those leaves. That is a discovery-interface change, not evidence that a search provider indexed the pages.

The catalog also had to agree across visible links, static JSON-LD and client hydration. Download metadata is enriched after serialization so it describes the actual bytes, while shared dataset definitions keep the catalog views aligned.

Trace validation exposed a missing-input problem: a compact method download needs the reading fields that its source pointers address, including conditions, evidence and sources. An internal record having those fields is insufficient if the client never receives them.

During integration, a fresh-main UI change failed an existing design guard. The implementation repaired the misplaced storage access in the existing logic layer and kept the guard. The reusable lesson is to identify the failing revision and boundary before changing a check. This observation is part of the historical session report, not a result reproduced by the public-file refresh.

## What transfers to ARWP

For a site with released collections and agent tools, first make one existing download inspectable: stable identity, explicit approval, exact bytes, conditions, order and source locations. Then exercise the actual advertised client contract and verify the public response. A new catalog alone will not resolve those ambiguities.

Each JSON lesson carries an observed finding, source references and a separate **inferred transfer recommendation** with applicability, a verification step and a limit. The transfer rules are not provider ranking requirements. This case does not add patterns to the reviewed discoverability corpus, activate an experiment, change owner crawler preferences or establish a performance prior. An outcome study needs its own scoped observations.

### Public implementation entry points

- [Project vocabulary](https://vedokrok.com/data/site-vocabulary.json) and [topic vocabulary](https://vedokrok.com/data/topic-vocabulary.json).
- [Collection catalogs](https://vedokrok.com/data/collection-catalogs.json) and [exact membership overlaps](https://vedokrok.com/data/collection-overlaps.json).
- [Typed discovery graph](https://vedokrok.com/data/discovery-graph.json) and [dataset catalog](https://vedokrok.com/data/data-catalog.json).
- [Empty output trace template](https://vedokrok.com/data/agent-output-trace-template.json) and [the human-facing agent interface](https://vedokrok.com/for-ai).

The writing review used ARWP’s `prompts/writing.md` at the pinned repository revision recorded in the JSON. No human language review or scientific certification is claimed. This pair of research files is a repository case, not a new generated site page or an additional outcome-evidence registry.
