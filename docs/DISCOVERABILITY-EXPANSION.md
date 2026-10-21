# Research expansion: from declarations to usable results

Review: 18 October 2026 · corpus 1.14.0 · agent-assisted source review.

The library now has 247 patterns across 18 categories. This review adds 28
patterns and 20 source references. It reuses existing guidance instead of adding
four near-duplicate proposals. The [decision record](./knowledge/research/review-2026-10-18-expansion.json)
contains the exact IDs and evidence classes. These counts describe the library,
not implemented site changes or Search gains.

## What was missing

| Direction | New review question | Evidence to inspect |
| --- | --- | --- |
| Index measurement | Did the denominator or capture scope change? | Frozen inventory, per-request dates, complete/partial census |
| Crawl and render | Which request actually failed? | Verified crawler logs or initial/rendered dependency captures |
| Repository discovery | Is activity attributable to external use? | Separate traffic and workflow-run receipts; independent usage evidence |
| Agent delivery | Did the intended host receive a usable answer? | Text/structured parity, pagination, read path and negative tasks |
| Entity semantics | Is this a reference, a description or another meaning? | Node identity, term-set scope, provenance and language boundaries |
| Useful output | Can the person restore, open and use the result? | Clean-session scenario replay, export/import and storage-failure tests |
| Services | Do both sides understand the same booking time? | Explicit time zone and controlled boundary cases |
| Distribution | Can a released artifact be reused honestly? | Stable feed entries, rights and canonical version |

The source notes distinguish documented mechanisms from our engineering and
product proposals. A quota specification supports a quota boundary; it does not
prove that a checkpointing design will increase indexed pages. MCP compatibility
recommendations do not guarantee support in every host. A provenance relation
does not certify a claim.

## Select and run

Use the existing CLI. No second recommendation engine or automatic publisher is
introduced:

```bash
node bin/arwp.mjs discoverability --category=agents --limit=20 --json
node bin/arwp.mjs discoverability --category=repositories --limit=20 --json
node bin/arwp.mjs discoverability --search=inspection-resume --json
```

Choose one observed gap. Read its source support, implementation, verification and
measurement before creating an adoption selection. `adoption-plan` retains the
existing 1–25-pattern limit and creates a **planned**, unmeasured record. It does
not change a website or activate an experiment.

Run the normal Technical Integrity preflight before optional tactics. For agent
delivery, also test the actual intended host: a custom HTTP client demonstrates
only that client's path. Missing access and unsupported clients remain unknown.

## Creative pilots worth testing

These are reversible product experiments, not new Search requirements:

- Reopen a worked example from bounded, non-sensitive input state on an existing
  tool page. Keep its canonical owner; do not publish every combination as a URL.
- Compare one real task through plain HTML and the existing MCP interface. Keep
  whichever path produces the correct useful output with less recovery work.
- Offer a versioned local export and verify it in the intended consumer, including
  a fresh-session recovery test. A download event is only an intermediate step.
- Deliver substantive released updates through stable feed entries. Unchanged
  builds must not create new entry dates.

Existing patterns already cover scenario calculators, reusable worksheets,
answer-changing source alerts and intent ownership. Reuse them rather than growing
the library or website through renamed duplicates. Special AI markup, a universal
visibility score and a new gateway without a demonstrated task are not priorities.

For a live pilot, preserve its baseline, actual release evidence, one useful-action
definition and the existing resource KPI: indexed sitemap pages, then property
impressions. Keep technical completion, product usefulness and acquisition outcomes
separate. A failed pilot or unavailable measurement stays in the record.

## Disclosure and verification

This contribution is **source-available / public methodology**. It contains public
source references and procedures, not refreshed owner observations, private query
sets, learned recommendation priors or novel attribution algorithms. Source
retrieval failures are not reviews: unresolved URLs were replaced with a verified
official destination or omitted.

Corpus 1.13.0 is preserved byte-for-byte with its checksum anchor. Existing pattern
IDs and instructions remain unchanged. Build the public library, run its site
checks and the normal repository suite before activating a committed snapshot.
Activation is local analyzer integration, not package publication or site release.
