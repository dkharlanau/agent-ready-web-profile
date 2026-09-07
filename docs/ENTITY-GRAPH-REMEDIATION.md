# ARWP Entity Graph Remediation Engine

The Entity Graph Remediation Engine turns an ARWP Entity Graph Gap Report into a **proposal-only implementation manifest**.

It is intentionally narrower than an autonomous site editor. The engine may inspect a local first-party repository, identify grounded facts and target files, and emit patch-shaped proposals. It never changes repository files or deploys anything.

## Flow

```text
public site -> arwp-entities -> entity-gap-report.json
                              |
                              v
                     entity remediation
                              |
               +--------------+--------------+
               |                             |
          report only                  --repo-root
               |                             |
       review lanes only            bounded read-only scan
                                             |
                                  grounded facts + targets
                                             |
                                  proposal-only manifest
```

## Run

```bash
node bin/arwp-entities.mjs https://example.com --output=entity-gap-report.json
node bin/arwp-entity-remediation.mjs entity-gap-report.json --repo-root=../site --output=entity-remediation.json
```

Without `--repo-root`, gaps are classified into safe review lanes. With `--repo-root`, ARWP scans a bounded set of JSON, JSON-LD, HTML, Markdown and text files while skipping `.git`, dependencies and generated build directories.

## Dispositions

- `grounded-json-patch-proposal` — a value already exists in first-party structured repository evidence and a separate JSON/JSON-LD target for the same entity is missing it.
- `grounded-structured-data-proposal` — the value is grounded, but the target is embedded HTML JSON-LD, so ARWP emits only a property proposal.
- `verify-deployment` — repository evidence already appears to contain the missing fact/relation/page, so deployment or build drift should be checked before editing.
- `content-review` — visible first-party content must be authored or corrected by a person.
- `entity-page-review` — decide whether a useful canonical entity page is actually warranted; no thin bot-only page is generated.
- `relationship-review` — a relation needs a grounded target before it can be added.
- `identity-review` — stable IDs or identity conflicts require explicit identity decisions.
- `missing-evidence-review` — ARWP cannot find a first-party value and refuses to invent one.
- `advisory` — no bounded remediation rule exists yet.

## Grounding contract

A generated JSON Patch value must already be present in repository evidence associated with the same entity by exact `@id`, or by one unambiguous name+family match when no exact ID evidence exists.

The engine preserves:

- evidence file and JSON pointer;
- target file and JSON pointer when available;
- the proposed operation/value;
- warnings and required human review;
- repository scan bounds and parse errors.

The patch is a **proposal**, not authorization to modify the target.

## Safety boundaries

ARWP does not invent authors, publishers, people, credentials, licenses, prices, ratings, reviews, events or entity relationships. HTML and Markdown are never auto-patched. Symlinks and common generated/dependency directories are skipped by the repository scanner. Repository scanning is bounded by file count and file size.

The engine does not prove that repository state matches production, that a proposed fact is legally/semantically appropriate, or that applying a patch will improve ranking, rich-result eligibility, AI citation or recommendations.

## Machine contract

Schema: `schema/entity-remediation-manifest.schema.json`.

Public overview: `https://dkharlanau.github.io/agent-ready-web-profile/entities/remediation/`.
