# Pattern versions and evidence passports

A saved selection should identify the instructions that its owner reviewed. Goose keeps each published pattern ID, versions its instructions, and retains the preceding corpus as an immutable artifact. These are publishing and compatibility checks. They do not prove that a pattern was implemented, indexed, cited or responsible for an outcome.

## Read a passport

Each pattern has these additive fields:

```json
{
  "pattern_version": "1.0.0",
  "review": {
    "reviewed_at": null,
    "scope": "not-individually-reviewed",
    "method": null
  },
  "lifecycle": {
    "status": "active",
    "replacement_ids": [],
    "reason": null
  }
}
```

The 144 patterns published in corpus 1.1.0 retain their IDs, evidence classes and native Growth Hypothesis / recommendation references. Adding a passport does not invent an individual review. Their implicit initial pattern version is 1.0.0. Newly published patterns need a recorded individual review. New individual reviews require an actual date, `scope: "source-support-and-implementation"`, and `method: "agent-assisted"` or `"human"`. Maintainers must have a corresponding review record before making that assertion. The validator checks its shape and date, not the reviewer's identity or the cited source's support.

An individual review covers the stated source support and implementation instructions. It is not a human endorsement, live-site test, causal experiment or ranking result. A source's separate `checked_at` date does not become a pattern's `reviewed_at` date. Null means that an individual review is not recorded.

Published individual reviews also expose `review.support`, a nonempty array of `{ "source_id": "…", "locator": "…", "note": "…" }` traces. Each source must be referenced by that pattern; the locator identifies the relevant section and the note states the bounded support. This makes the review assessable without exposing private owner metrics or reasoning logs. The validator rejects missing references, empty locators/notes, duplicate source/locator pairs, and support assertions on an unreviewed passport. The shipped-corpus test requires support traces for every recorded individual review. It still cannot establish that a note accurately represents its source.

Each source also declares its upstream version honestly:

```json
{ "upstream": { "kind": "living-document", "version": null } }
```

Use `versioned-release` with the publisher's actual version identifier only for a source that identifies a particular release. A local retrieval date, page hash or the word “latest” is not an upstream version. A living source can change after review; neither the passport nor a local checksum proves it is still current. Link-check receipts remain separate from source-support reviews.

## Version an actual change

Published pattern and corpus versions use stable SemVer `MAJOR.MINOR.PATCH`, with nonnegative integers and no leading zeroes. Prerelease and build suffixes are not part of this stable publication contract.

| Change since the previous release | Minimum pattern bump | Minimum corpus bump |
| --- | --- | --- |
| Add a new pattern | Starts at 1.0.0 | Minor |
| Change instructions, applicability, evidence class, routing, or supporting source meaning | Minor | Minor |
| Change recorded individual review metadata only | Patch | Patch |
| Change lifecycle or replacement guidance | Major | Major |
| Add a source/category, or change the native integration reference | No bump for unaffected patterns | Minor |
| Recheck a source date without changing its meaning | No individual pattern bump | Patch |

Higher bumps are permitted. Versions cannot go backwards. A minor instruction change with an unchanged pattern version fails validation even if the corpus version was increased. Updating source meaning also requires bumps for patterns that depended on that source; source `checked_at` alone is excluded from this comparison. The initial addition of source `upstream` metadata to a legacy source is treated as a passport addition.

This is a conservative structural change policy. It does not attempt to infer whether changed prose is synonymous or whether a changed platform policy helps a site. Review the actual diff. New patterns and review dates need real evidence; version numbers are not evidence quality scores.

Never recycle or delete a published ID. Keep an obsolete pattern as a `deprecated` or `retired` record with a specific `reason`. Add `replacement_ids` when another existing pattern replaces it. Self-replacements, missing IDs and cycles are rejected. Active records have no retirement reason or replacement list. The planner rejects inactive selections so that an old unpinned configuration cannot silently schedule a retired practice. Existing native IDs and evidence boundaries remain authoritative; the passport does not create another hypothesis graph.

## Preserve history

The current corpus names its predecessor:

```json
{
  "previous_release": {
    "version": "1.1.0",
    "path": "knowledge/releases/v1.1.0.json",
    "sha256": "88d4583c696c981a174270131bd0504aaf00909d32f9524920923aff04f9c641"
  }
}
```

That initial artifact is the exact corpus bytes from Git commit `28e3e93d82cdcc9587d46d69799840cffb269b86`. Its checksum is also anchored in `DISCOVERABILITY_RELEASES` in `lib/discoverability.mjs`, so editing both the release file and a caller-supplied checksum does not pass validation. A whitespace-only rewrite of the historical file fails. Safe canonical relative paths prevent a supplied descriptor from selecting an unrelated file.

For the next publication, copy the released corpus bytes to a new `knowledge/releases/vX.Y.Z.json` file, append its checksum to the code-reviewed release anchors, retain every older artifact and anchor, and point the new corpus to its immediate predecessor. Never rewrite a historical artifact to make current validation pass. Git review and protected publication procedures remain necessary: these hashes are local integrity checks, not signatures or a tamper-proof external ledger.

## Pin a selection

Existing adoption configurations remain usable. Owners may optionally add any of `corpus_version`, `corpus_sha256`, or `tactic_versions`:

```json
{
  "site_url": "https://example.com/",
  "audience": "People selecting a service",
  "useful_action": "Compare the documented options",
  "tactic_ids": ["arwp-access-status"],
  "corpus_version": "1.2.0",
  "tactic_versions": { "arwp-access-status": "1.0.1" }
}
```

Use the actual ID and version from the current pattern; the example is a configuration shape, not an instruction to adopt that practice. If present, pins are exact: nulls, malformed versions, stale versions, or stale hashes fail before writing a plan. A `tactic_versions` object must contain exactly the selected IDs. It cannot omit a selected pattern or include an unrelated pattern.

The plan includes `corpus_version`, `corpus_sha256`, `tactic_versions`, complete selected passports and source records. Copy those values when freezing a selection. `corpus_sha256` preserves the existing plan convention: SHA-256 of `JSON.stringify(corpus)`, with stored object-key order and no formatting whitespace. It differs from a historical release's checksum over raw file bytes. A changed corpus can leave an individual pattern unchanged; choose the level of pinning that matches the intended review boundary.

When a pin fails, inspect the current diff and relevant upstream evidence before intentionally updating it. Do not automatically replace it with the latest value. An exported selection remains `planned`, with unmeasured outcomes and null deployment time.

## Verify

Run `node scripts/discoverability-test.mjs` for corpus, passports, immutable history, native references, meaningful version changes, configuration pins and CLI output protection. After rebuilding the public library, run the same command with `--site` to check the actual published corpus, pattern/source anchors and editorial artifacts. Package and deployment verification are separate release gates.
