# Resolver mismatch diagnostics — 2026-08-26

This is a durable engineering record of External resolver benchmark run `32929139788` at commit `314093970d0a083fc5a35f2e0f7f8f8a6db9a695`.

The run completed successfully on the existing reviewed 20-site independent corpus. Ground truth was not changed. The new diagnostic layer classifies only mismatches already scored by the benchmark and is intended to make resolver workstreams actionable without editing accepted interfaces to fit Resolver output.

## Resolver-union result

- Independent sites: 20
- Resolved sites: 20
- Failed sites: 0
- Scored intent decisions: 100
- Correct: 81
- Incorrect: 19

The 19 incorrect decisions split into:

| Diagnostic category | Count | Meaning |
| --- | ---: | --- |
| discovery-gap | 6 | A reviewed usable interface existed but Resolver selected no interface for the intent. |
| selection-gap | 3 | Resolver found/selectable evidence but chose an interface outside the reviewed accepted set. |
| over-selection | 10 | The reviewed accepted set was empty but Resolver selected an interface. |
| resolution-failure | 0 | The complete site resolution failed before intent selection. |

By intent, the 19 mismatches were: read 2, search 6, structured 3, tools 4, agent 4.

## Weak sites

| Site fixture | Correct / 5 | Mismatch categories |
| --- | ---: | --- |
| fastmcp-docs | 2 | discovery-gap 2; over-selection 1 |
| langchain-docs | 2 | discovery-gap 2; over-selection 1 |
| mintlify-docs | 2 | over-selection 2; selection-gap 1 |
| supabase-docs | 2 | discovery-gap 1; over-selection 2 |
| vercel-docs | 2 | discovery-gap 1; over-selection 2 |
| a2a-docs | 4 | selection-gap 1 |
| cloudflare-docs | 4 | selection-gap 1 |
| perplexity-docs | 4 | over-selection 1 |
| pinecone-docs | 4 | over-selection 1 |

This narrows the next engineering work: six misses are discovery problems, three are selection/ranking problems, and the largest class is ten over-selection errors. In particular, blindly adding more discovery heuristics would not address most current errors and could make false positives worse.

## Publication safety

`external-diagnostics.json` is generated from the sanitized publication view. Its selected/accepted/site URLs are passed through the publication URL sanitizer, sensitive query values are redacted, URL userinfo/fragments are removed, and free-form resolver failure text is omitted. The same sanitization is also applied if the diagnostic CLI is run directly against a raw engineering report. Regression tests cover this boundary.

## Artifact

Workflow artifact: `arwp-external-benchmark-32929139788` (artifact ID `9592594896`). Digest: `sha256:a1afc0829b0354069c629de6f1d51ee9991208359b4c9ac8adb56ec93c163f81`.

The artifact contains the raw engineering report, sanitized publication report, publication-safe mismatch diagnostics, evidence-liveness report and federation report. These observations are engineering evidence only; they do not establish adoption, token savings, latency gains, ranking gains or answer quality.
