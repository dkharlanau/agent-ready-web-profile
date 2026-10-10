# Goose Controlled Cohorts

Controlled Cohorts are the bridge between a plausible Search/AI recommendation and evidence from an owned site.

The contract freezes three things **before post-change outcomes are reviewed**:

1. treatment pages/entities;
2. comparable unchanged controls;
3. a stable query/prompt panel.

It also refuses to start the observation clock until a production receipt proves that the frozen implementation is actually live.

## Why this exists

A common failure mode in website experiments is to compare “before” with “after” while changing the cohort, query set or deployment state along the way. That makes a positive screenshot easy to obtain and hard to interpret.

Goose instead keeps the cohort explicit and versioned. Small or negative experiments remain useful evidence.

## Contract

`schema/controlled-cohort.schema.json` records:

- exact site and repository;
- frozen repository implementation ref;
- source experiment/evidence artifact;
- treatment and control members;
- fixed query panel and target entities;
- baseline owner/public/deployment evidence;
- production measurement gate;
- declared observation windows and outcomes;
- decision rules and anti-causality guardrails.

A site-specific cohort is allowed to be smaller than a generic playbook target when the real published universe, safety boundary or expansion policy makes a larger cohort artificial.

## CLI

```bash
node bin/arwp-cohort.mjs validate cohort.json
node bin/arwp-cohort.mjs summarize cohort.json
node bin/arwp-cohort.mjs gate cohort.json \
  --production-ref=<exact-live-commit-sha>
```

`gate` returns exit code `0` only when the independently observed production ref exactly matches the frozen implementation ref. A mismatch returns `2` and the observation clock stays stopped.

This deliberately separates:

```text
repository implementation
        !=
verified live deployment
        !=
Search exposure
        !=
ranking/citation
        !=
acquisition/product outcome
```

## Cohort integrity rules

Validation rejects:

- the same entity/source in treatment and control;
- duplicate member or query IDs;
- query targets outside the frozen cohort;
- non-increasing observation windows;
- `ready-to-observe` or `observing` state while the production gate is HOLD;
- a ready production gate whose production SHA does not match the implementation SHA.

Changing query text or treatment/control membership after outcomes are visible should create a new cohort/version rather than rewriting the old freeze.

A later verified deployment must also not be retrofitted into an older frozen implementation when treatment content changed before publication. Preserve the old freeze and create a new revision that:

- keeps the already-frozen assignment/query panel unchanged;
- binds to the exact implementation that was actually verified live;
- records why the earlier freeze never entered observation;
- is created before post-deployment outcomes are used to alter the design.

## First dogfood: Ptichi PTI-DA-001

The original artifact, `knowledge/experiments/2026-09-09-ptichi-cohort-freeze.json`, imported the existing owner-reviewed Ptichi Data Authority experiment rather than inventing a parallel design.

The authoritative site-specific design contains:

- 12 existing treatment entities;
- 6 comparable unchanged controls;
- 12 fixed English Search queries;
- no new indexable URLs;
- 14/28/56-day review windows.

The generic earlier Goose plan suggested 20–50 treatment pages. Ptichi overrides that because its binding expansion gate and current published universe make 20–50 artificial. The smaller real cohort is preferable to manufacturing extra pages for statistical appearance.

### Historical freeze — 2026-09-09

At the first freeze, Ptichi source `main` contained the treatment implementation, but the preserved production receipt pointed to an older commit. The artifact therefore remains immutable `measurement-hold` evidence. Its exact frozen implementation was not later rewritten merely to match a newer deployment.

### Current revision — r2

`knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json` is the current observation-bearing revision.

Before the first later exact-SHA production publication, several treatment pages changed. The English control membership and the fixed 12-query panel did not change. Ptichi's reviewed operating evidence records `13b49e9a5faa9256b5bbded049caf33327abc240` as the exact source revision verified live on 2026-09-13, while later source commits are explicitly not treated as deployed.

R2 therefore:

- preserves the same 12 treatment / 6 control assignment;
- preserves the same 12 query texts and target entities;
- binds both `implementationRef` and `productionRef` to `13b49e9a...`;
- carries the authenticated pre-publication Google Search Console baseline captured on 2026-09-12 with final data through 2026-09-09;
- is `ready-to-observe`, not a measured win.

`ready-to-observe` proves only that the production gate is satisfied for the refrozen implementation. It does not prove indexing, ranking, citation, traffic, conversion or treatment causality. Post-deployment owner evidence must still mature and be reviewed against treatment, controls, confounders and missing evidence.

## Before an outcome review: compare the frozen sources

The October 2026 Ptichi experiment exposed a real failure mode: later editorial work can alter or redirect pages assigned to the **control group**. The existing route-level Treatment Cohort Integrity compares mapped source-to-route inputs; this additional **source-drift** check uses the actual frozen member IDs and committed Git blobs. It does not replace the route/build comparison, canonical page map or owner Search observations.

Run this from the **Goose checkout**, supplying the local **site repository** and its exact descendant commit. A working-tree diff, branch label, GitHub PR or merge is not independent evidence that the content was published.

\`\`\`bash
# Obtain an immutable committed ref from your local target checkout:
git -C /path/to/site rev-parse HEAD

node bin/arwp-cohort.mjs source-drift \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --repo=/path/to/site \
  --after-ref=<exact-40-character-commit> \
  --json
\`\`\`

The checker reads only the two commit trees: the baseline pinned in \`sourceEvidence.repositoryRef\`, and the supplied \`--after-ref\`. Both commits must exist locally, the later one must descend from the baseline, and any identifiable GitHub origin must match the cohort repository. It lists each frozen treatment/control source as \`source-changed\`, \`source-unchanged\` or \`unknown-source-ownership\` (for missing/nonregular files). It ignores uncommitted work and unrelated files. Source equality does **not** prove unchanged shared layouts, generated output, redirects or a deployed page.

To review *dated* publication evidence separately, use a private, owner-reviewed event ledger. See the [synthetic template](../templates/growth/cohort-publication-events.example.json), deliberately rejected with \`sourceClass: "synthetic"\` until actual evidence replaces it.

\`\`\`bash
node bin/arwp-cohort.mjs source-drift \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --repo=/path/to/site --after-ref=<exact-40-character-commit> \
  --deployment-date=2026-09-13 \
  --events=/private/observed-publications.json \
  --json
\`\`\`

The private JSON contract is \`{ "version":"0.1", "sourceClass":"owner-declared", "cohortId":"<frozen-id>", "completeThrough":"YYYY-MM-DD or null", "events":[...] }\`. Each event has a frozen \`memberId\`, \`publishedOn\` calendar day, exact \`productionRef\`, \`kind\` (\`editorial\`, \`redirect\`, \`metadata\`, \`technical\`, \`other\`) and a credential-free HTTPS \`evidenceUrl\` linking to a relevant reviewed publication receipt. This is an **owner claim**, even if internally reviewed; the command does not query hosting or independently verify a deployed page. Use the exact actual publication day, not the PR-merge day unless the deployment receipt independently confirms the same date.

For a 13 September 2026 deployment, the original T14 (14–27 September) can be kept **separate from** control interventions recorded on 4 October; the full T28 (14 September–11 October) and T56 (14 September–8 November) include those event dates. A \`review-control-change\` label requires an event supplied for a frozen control in that window. \`no-control-event-in-supplied-ledger\` **never** proves the control was untouched: the ledger may be incomplete, shared inputs may drift, or production could differ from Git. A change can be a necessary correctness repair; record it instead of reverting valuable or safety-critical work solely for an experiment.

Exit codes: \`0\` means no **source-file drift alert** was observed at the selected refs; \`2\` means changed or unresolved controls, or a dated control-publication event needs review; \`1\` means invalid/inaccessible inputs. No code, Git branch, target site, frozen assignment or Search outcome is modified. Raw/local evidence paths, URLs and derived reports may be commercially sensitive: keep them outside public repositories. The command preserves every neutral/negative result and does not declare a treatment effect.

## Put an observation window to work — without changing the experiment

The next operational job is not another SEO checklist. It is to obtain comparable, **actual owner evidence** for the already-frozen treatment and control pages. Goose now supports two read-only helpers in the existing `arwp-cohort` CLI:

- `plan` calculates when each frozen observation window can be reviewed and whether the owner has confirmed that reporting data is final.
- `check-gsc` inspects a **local** Google Web Search CSV against an owner-confirmed mapping from canonical public URLs to the frozen member IDs. It does not import the raw data into the public repository or create a positive-outcome record.

### 1. Reconfirm production and plan the windows

Use the current R2 cohort, not the historical held freeze. The independently reviewed production record names 13 September 2026 and ref `13b49e9a5faa9256b5bbded049caf33327abc240`. The CLI cannot verify either statement by itself; the owner must reconcile them with the deployment receipt.

```bash
node bin/arwp-cohort.mjs plan \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --as-of=2026-10-10
```

The deployment day is excluded because it may be partial. The fixed windows are therefore **T14: 14–27 September**, **T28: 14 September–11 October**, and **T56: 14 September–8 November 2026** (inclusive). As of 10 October, T28 has not ended. The T14 calendar has ended, but its actual data finality and quality still need owner confirmation. Add `--final-through=YYYY-MM-DD` **only** when that final-data date is verified in the provider report. The helper never converts an elapsed day into a measured success.

The `plan` command refuses to promote a historical HOLD merely because someone supplies a matching ref. Calendar windows remain blocked until both the *existing frozen gate* and the supplied independently observed production ref agree.

### 2. Map the real published pages, not source filenames

```bash
node bin/arwp-cohort.mjs page-map \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --output=/path/outside/repository/private-ptichi-page-map.json
```

Fill the 18 `url: null` entries with the exact published **canonical** HTTPS URLs. Each ID, entity, and treatment/control assignment must remain unchanged. Goose does not guess a public route from `content/goals/*.md`, strip tracking parameters, merge aliases, silently relocate a member, or fill missing entries for you. Duplicate URLs, unknown members and cross-site mappings fail validation.

### 2a. Check Google indexing before interpreting missing search rows

For sites with a dated owner URL Inspection snapshot, Goose can now tell apart four very different observations: a page Google reported indexed, a page Google discovered but has not indexed, a page Google said was unknown, and a page **not inspected in the supplied snapshot**. A missing Search Analytics row cannot answer these questions.

The read-only `check-index` command uses the **same private canonical page map** as the Web Search export workflow. It accepts an owner-provided report with `properties[<exact site>]` and `current_url_inspection.rows`, `total`, `observed_at`, and (optionally) `counts`. This structure matches an actual dated site recovery capture; it is not a request to the Search Console API and does not use credentials.

```bash
node bin/arwp-cohort.mjs check-index \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --page-map=/private/ptichi-page-map.json \
  --inspection=/private/dated-index-inspection.json \
  --output=/private/dated-index-review.json
```

The complete inspection snapshot must be internally consistent: its declared total and coverage counts must match its rows, every inspected URL must be unique and the report must identify the frozen site property. **No public URLs, canonical targets or raw queries are copied into the derived output**; only frozen member IDs and status/coverage summaries are retained. Production HOLD or a mismatched observed SHA blocks cohort attribution. A crawl on or before the claimed deployment date is not evidence that Google processed the new version.

How to interpret the result:

- **Indexed:** the dated report showed a consistent PASS verdict and indexed coverage. This does not establish impressions, clicks, citations, useful visits or continued indexing.
- **Discovered, currently not indexed:** inspect the actual dated crawling, migration and page-value context rather than assuming one universal cause or adding more URLs.
- **Unknown to Google:** look at actual sitemap processing and internal discovery routes. Do not confuse it with a URL that was never checked.
- **Crawled, not indexed / blocked / fetch problem:** inspect the specific observed response or policy and whether it is intentional. Do not automatically remove `noindex` or alter canonicals.
- **Not inspected in this snapshot:** information is missing. It is **not** proof of exclusion, of zero impressions, or of an unknown URL.
- **Canonical differs or last crawl precedes deployment:** investigate the individual URL and release chronology; a difference is not automatically a defect.

The <https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult> contract includes the verdict, coverage state, robots/indexing controls, selected and declared canonicals and last crawl when available. The <https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect> method reports the **indexed version, not a live URL test**. A single index snapshot cannot prove why Google made an indexing decision. Keep the raw owner snapshot and the filled URL map private, and preserve the observation date when comparing later captures.

### 2b. Use the site's actual observer and compare the same pages

The earlier Goose command supported a single dated recovery file. It now also accepts the **unchanged JSON generated by Ptichi's existing read-only observer** (\`scripts/search-observe.py\`). No conversion script, second Google crawler or new measurement database is needed.

The observer reports \`schema_version: 1\`, the exact Search Console property, a report start timestamp (\`retrieved_at\`), \`inspection_scope\` and individual \`inspections[].response.inspectionResult.indexStatusResult\` values. Goose requires a non-partial capture and valid successful URL Inspection results. It recognises two scopes:

- **\`priority_queue\`**: only selected inspected URLs are represented. Other frozen members remain **not inspected**, never "unknown to Google".
- **\`live_sitemap\`**: the declared sitemap population must match the complete inspection array. This is still only the *dated* live-sitemap population, not all historical or future URLs.

Run the existing observer on the authorized owner machine when a new observation is due, with your own private absolute output path. Its real Google credentials are never passed to Goose:

\`\`\`bash
# In the Ptichi repository, with its existing authorized owner credentials:
python3 scripts/search-observe.py \
  --output=/private/observations/ptichi-2026-10-XX.json \
  --full-sitemap
\`\`\`

The observer's \`retrieved_at\` is set when collection starts, before individual URL requests finish. Goose labels it as **report initialization time**, not a false exact per-URL completion timestamp. Its output must be retained privately alongside the date, property, inspection scope, deployment and source/collector version.

In the Goose repository, with the **same previously reviewed frozen URL map**:

\`\`\`bash
node bin/arwp-cohort.mjs check-index \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --page-map=/private/ptichi-page-map.json \
  --inspection=/private/observations/ptichi-2026-10-XX.json \
  --output=/private/observations/ptichi-index-reviewed.json
\`\`\`

If a second dated capture exists, review it **separately first** using \`check-index\`, then compare two derived reviews:

\`\`\`bash
node bin/arwp-cohort.mjs compare-index \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --before=/private/observations/ptichi-index-reviewed-before.json \
  --after=/private/observations/ptichi-index-reviewed-after.json \
  --output=/private/observations/ptichi-index-transition.json
\`\`\`

This answers a narrower, useful question: **which of the exact same frozen URLs changed from not indexed to indexed, which lost indexing, and which were never checked at both dates?** The output preserves treatment and controls separately.

To prevent false improvement claims, the comparison refuses changed URL-map fingerprints, inconsistent frozen member IDs, conflicting source/live refs, different deployment-date claims, undated or reversed captures. A URL inspected for the first time in October is *not* counted as "became indexed" if it had no September inspection. Neither "indexed" nor its change is a proxy for Search impressions, traffic, cause, usefulness or treatment success. Compare final Web page/query evidence as a separate stage.

**Do not copy confidential GSC JSON, private page maps, URL paths, search queries or token-bearing API details into this public repository.** Goose emits only frozen member IDs, status summaries and a stable fingerprint that proves the *same locally supplied map* was used twice; the fingerprint does **not** authenticate Google data. Any external conclusion requires independently reviewed raw receipts and deployment chronology.

### 3. Inspect an actual joint Web Search export locally

In the property owner's Google Search Console account, select **Search results → Web** for the exact intended dates. Export **date + canonical page + query + clicks + impressions together** using the supported Search Analytics API dimensions or an equivalent genuinely joint export. A separate Pages CSV joined to a separate Queries CSV is *not* the same dataset and must not be used. Retain the unmodified export, filters, aggregation basis (`byPage` for page grouping) and report-finality proof privately.

Example for an **actually finalized** T14 export (replace all paths and the final-data date with real owner observations):

```bash
node bin/arwp-cohort.mjs check-gsc \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --as-of=2026-10-10 \
  --final-through=YYYY-MM-DD \
  --window-days=14 --report-scope=web \
  --export-start=2026-09-14 --export-end=2026-09-27 \
  --page-map=/path/outside/repository/private-ptichi-page-map.json \
  --export=/path/outside/repository/private-gsc-web.csv \
  --output=/path/outside/repository/private-t14-review.json
```

The parser checks required dimensions, date range, duplicate rows, exact page mappings and nonnegative counts. It reports separately: treatment vs controls, members actually observed in returned rows, frozen-query-panel appearances in those rows, outside-cohort rows and missing members. **Missing rows are unknown, not zero.** The output contains summary counts and frozen member/query IDs, **not raw URLs or query strings**.

Even a final full-window CSV is subject to Search Console row limits and anonymized-query omissions. Report scope and finality are owner declarations because CSV bytes alone cannot authenticate the provider. This helper intentionally does **not** support relabeling ordinary Web Search as a Google generative-AI report, derive a cross-provider conversion score, or declare that an edit caused more traffic. <https://developers.google.com/webmaster-tools/v1/searchanalytics/query> documents the row limits and page/query dimensions; <https://support.google.com/webmasters/answer/17011364> explains page vs property aggregation and preliminary data.

### 3b. Read the same owner's Web Search evidence without making a fake CSV

The existing Ptichi observer also fetches an authenticated **final Web Search** report with a single joint \`page + query\` dimension. It is a 28-day rolling report, not a date/page/query series. Goose can read that private JSON directly, so an owner no longer has to try joining separate Pages and Queries tables or re-exporting metrics just to inspect what the current collection already contains.

\`\`\`bash
node bin/arwp-cohort.mjs review-observer-web \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --page-map=/private/ptichi-page-map.json \
  --observer=/private/observations/ptichi-owner-readonly.json \
  --output=/private/observations/ptichi-rolling-web-review.json
\`\`\`

This command checks exact property, Pacific reporting timezone, Web Search, \`final\` data state, full 28-day interval, cutoff, the existing production gate and provider response shape. It then shows which **frozen pages actually have rows returned**, and how many page/query impressions and clicks appear for treatment and controls. Frozen query-panel IDs are reported separately. Pages not returned stay **unknown**, not zero.

The owner report's property-level total appears as a **separate number**. It is not added to page/query rows or treated as the same population. Google's page/query export may omit anonymized queries and only return top rows; Goose preserves the collector's \`row_limit_reached\` flag and marks those reports as truncated rather than complete. Never divide this opt-in/partial or page-grain subset into property totals and call it an observed user conversion rate.

**Important timing:** the normal collector's \`current28\` ends on the owner's latest final-data cutoff. A rolling \`current28\` covering 9 September–6 October, for example, is not the frozen T28 of 14 September–11 October. Goose only labels a report as matching a frozen observation window if *both exact boundary dates coincide*. Even then, it is a descriptive Search report: treatment-vs-control comparisons and a later canonical experiment decision require baselines, contamination review, complete observation windows and an assessment of usefulness.

The collector's JSON is read locally: no Google API call, new account permission, new tracker, automatic export publication, conversion assumption or treatment expansion occurs here. Preserve owner evidence privately, and use the existing \`check-gsc\` command only when a **genuine date/page/query** full-window export is needed.

### 4. Make the *review* a separate decision

Only after comparing a real baseline, treatment and control observations, full windows, independent production evidence, contamination, query-to-page fit and useful-task outcomes should the existing Growth Experiment / Recommendation Review mechanism record `keep`, `revise`, `continue-measuring`, `revert` or `retire`. An observed increase is not automatically causal. Preserve neutral, negative and withheld evidence; do not commit private Google exports or site-owner data into this public repository.

## Relationship to Winner Observatory

The fixed query panel can later seed Winner Observatory snapshots:

```text
Controlled Cohort freeze
        ↓
verified production gate
        ↓
Winner snapshot at T0 / T14 / T28 / T56
        ↓
result + citation persistence
        ↓
owner Search/AI evidence
        ↓
treatment vs control review
        ↓
Recommendation Review event
```

Winner Observatory and owner metrics are complementary. Public result observation does not replace Search Console/Bing owner evidence, and owner visibility does not prove a hidden ranking factor.

## Scale-up rule

Do not expand a cohort merely because the site can generate many pages. Expand only after a review establishes that:

- the existing pages are genuinely useful;
- the observed queries fit their jobs;
- control behavior has been considered;
- crawl/index/release truth remains healthy;
- neutral and negative outcomes remain in the record.

A `GO` decision permits the next bounded experiment; it is not a general ranking claim.
