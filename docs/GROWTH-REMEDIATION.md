# Growth remediation manifests

Reviewed: **2026-09-06**.

ARWP can turn an existing Growth plan into a machine-readable remediation manifest without editing the target repository:

```bash
arwp-growth https://example.com/ --json > growth.json
arwp-growth-remediation growth.json --output=remediation.json
```

The manifest is deliberately **proposal-only**. It answers a narrower question than the Growth plan: what kind of implementation follow-up is safe to prepare for each action, and where must automation stop?

## Dispositions

| Disposition | Meaning |
| --- | --- |
| `policy-review` | A policy-sensitive surface such as `/robots.txt`; a bounded suggested line may be included, but publisher rights/distribution intent must be reviewed. |
| `structured-data-proposal` | A shipped JSON-LD template may be attached with SHA-256 provenance; identity/content values remain unresolved until reviewed. |
| `template-proposal` | A shipped non-policy template can be attached as starting material, not publish-ready content. |
| `external-link-proposal` | The action points to an external platform/feature; eligibility and current behavior still need verification. |
| `external-owner-review` | Authenticated platform state. ARWP can describe the follow-up but cannot infer or change the setting. |
| `manual-review` | Editorial/governance judgment stays human. A checklist template may be included when available. |
| `advisory` | No bounded implementation metadata exists, so ARWP does not invent a patch. |
| `blocked-unsafe-reference` | A template reference escapes the shipped Growth template boundary or does not resolve to a real shipped file. |

There is no `autofix` disposition.

## Snippet provenance

Only two snippet sources are allowed by the v0.1 builder:

1. an explicit `suggestedPolicy` already carried by a Growth action; or
2. an existing file under the shipped `templates/growth/` boundary.

Shipped template snippets include their relative template reference and SHA-256 digest. Path traversal, missing templates and non-Growth template paths are not read. Placeholders such as `REPLACE_WITH_*` deliberately remain unresolved; ARWP does not fabricate organization names, author identity, dates, profile URLs or policy intent.

## Mutation boundary

The command:

- reads one local Growth JSON file;
- reads only ARWP's own shipped Growth templates when referenced;
- writes only a new manifest file when `--output` is supplied;
- refuses to overwrite an existing output;
- never clones, edits, commits, pushes or opens a PR in a target repository;
- never changes robots/content-rights policy;
- never writes structured data into a page;
- never rewrites editorial copy;
- never changes authenticated Google/Bing/provider controls.

A later repository-mutation mode, if added, must remain separately authorized and must consume this proposal layer rather than bypass it. Policy, structured-data, editorial and owner-control boundaries remain review gates even when repository write authorization exists.

## Why this is separate from ranking claims

A correct implementation proposal is not evidence that Search engines or AI systems will rank, cite or recommend a site. Remediation manifests should be linked to Growth Experiments when impact measurement is useful. Keep/revise/revert decisions remain based on observed implementation and owner-side evidence rather than on the existence of a generated patch plan.

Schema: `schema/growth-remediation-manifest.schema.json`.
