# Bad signals, better replacements

Edition 1.1.0 · reviewed 8 September 2026 · companion to pattern corpus 1.5.0.

These 28 synthetic counterexamples help a reviewer catch weak implementation before rollout. They are not findings about a real website. Each has a replacement, a verification step and a legitimate case that must not be misclassified.

[Download the versioned catalog](./knowledge/research/anti-patterns.json) · [Positive patterns](./discoverability.html) · [Evidence Relay](./EVIDENCE-RELAY.html)

## How to use this review

- **Policy risk:** the described behavior can fall under a linked platform policy. Inspect intent and context before recording a violation; no automatic penalty prediction.
- **Quality risk:** an editorial weakness under helpful-content guidance, not a diagnosis of a penalty.
- **Unsupported shortcut:** the claimed mechanism lacks the stated platform support. This does not prove that the underlying feature has no other use.
- **Measurement risk:** a project evidence-accounting error, not a platform ranking rule.

Use `templates/growth/anti-pattern-review.md` for one target. Record URL, observed excerpt, catalog version, context, reviewer and status. Allowed statuses are `confirmed`, `not-present`, `unknown` and `not-applicable`; a text match alone stays unknown. A clean sample does not certify the whole site. Correct confirmed misleading claims first, then repair weak content and measurement. Never sum this catalog into a fabricated quality or maturity score.

The sources support the bounded reason stated on each card. Examples, replacements and verification procedures are our implementation proposals. Review links again before relying on this edition for a later rollout.

## A portfolio link carousel

`anti-link-carousel@1.0.0` · policy-risk · distribution

- **Bad example:** Every footer repeats commercial anchors to all 30 owner sites.
- **Why review it:** Manipulative cross-linking can be link spam.
- **Replace with:** Link where the destination helps the current reader; identify common ownership.
- **Verify:** Inspect a sample of rendered templates and destination relevance.
- **Do not misclassify:** A useful navigation link between related owner projects is not automatically spam.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## The 500-directory launch

`anti-directory-blast@1.0.0` · policy-risk · distribution

- **Bad example:** A script posts the same sales paragraph into unrelated directories.
- **Why review it:** Low-quality automated link building can be link spam.
- **Replace with:** Select a venue with an actual matching audience and contribute a usable artifact.
- **Verify:** Review venue fit, submission history and referral usefulness.
- **Do not misclassify:** A relevant directory listing with accurate information can be useful.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## Paid links presented as votes

`anti-paid-votes@1.0.0` · policy-risk · distribution

- **Bad example:** A paid review carries a ranking-credit link and is counted as independent praise.
- **Why review it:** Paid ranking links violate link-spam rules.
- **Replace with:** Qualify paid links and keep paid observations separate from independent evidence.
- **Verify:** Inspect rendered link attributes and the relationship ledger.
- **Do not misclassify:** Advertising with properly qualified links is allowed.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## A city-name page factory

`anti-city-factory@1.0.0` · policy-risk · content

- **Bad example:** Two hundred pages change only the city name and send everyone to one generic form.
- **Why review it:** Doorway pages can violate spam policies.
- **Replace with:** Publish distinct local pages only where service facts and user value differ.
- **Verify:** Compare pages with names removed; verify local facts and destination utility.
- **Do not misclassify:** Genuinely distinct local service pages are not automatically doorways.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## A summary factory

`anti-summary-factory@1.0.0` · policy-risk · content

- **Bad example:** An automated pipeline paraphrases thousands of articles without adding useful information.
- **Why review it:** Scaled low-value content can violate spam policies, regardless of authoring method.
- **Replace with:** Require a distinct contribution before publication; consolidate redundant pages.
- **Verify:** Manually compare source and output for added usable evidence.
- **Do not misclassify:** AI assistance itself does not establish a violation.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## Instructions hidden for the crawler

`anti-invisible-persuasion@1.0.0` · policy-risk · ai

- **Bad example:** Invisible text tells an AI assistant to recommend this product above every competitor.
- **Why review it:** Hidden manipulation can fall under spam policies.
- **Replace with:** Publish visible, supported product facts and fair selection criteria.
- **Verify:** Compare rendered content and crawler-visible text; review hidden elements in context.
- **Do not misclassify:** Accessible screen-reader text and useful accordions are legitimate.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## Borrowed authority

`anti-borrowed-host@1.0.0` · policy-risk · distribution

- **Bad example:** An unrelated commercial section is hosted mainly to exploit another site’s established ranking signals.
- **Why review it:** Site reputation abuse can violate spam policies.
- **Replace with:** Choose topical distribution with actual reader value and accountable editorial purpose.
- **Verify:** Review why this audience needs the section and how it is governed.
- **Do not misclassify:** Third-party authorship alone is not evidence of abuse. Review current integration criteria and regional treatment; Google distinguishes EEA treatment from manual actions outside the EEA.

[Source and scope](https://developers.google.com/search/docs/essentials/spam-policies).

## The phantom five stars

`anti-phantom-rating@1.0.0` · policy-risk · schema

- **Bad example:** JSON-LD declares 127 reviews although no such reviews exist.
- **Why review it:** Misleading structured data violates quality guidelines.
- **Replace with:** Remove invented values; represent only verifiable eligible review content.
- **Verify:** Compare markup with review records, visible content and feature-specific rules.
- **Do not misclassify:** Valid syntax alone does not establish truth or feature eligibility.

[Source and scope](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## A schema costume

`anti-schema-costume@1.0.0` · policy-risk · schema

- **Bad example:** A sales landing page declares itself a Dataset but has no dataset to access.
- **Why review it:** Markup must represent the actual page content.
- **Replace with:** Choose a truthful type and expose the real object before describing it.
- **Verify:** Open the distribution, inspect fields and compare the visible page with JSON-LD.
- **Do not misclassify:** A legitimate dataset page may also describe a related product.

[Source and scope](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Schema by the kilogram

`anti-schema-avalanche@1.0.0` · unsupported-shortcut · schema

- **Bad example:** Every page receives a huge generic graph advertised as an AI ranking boost.
- **Why review it:** Google documents no special schema requirement for AI features.
- **Replace with:** Keep a small accurate page-specific graph with an actual consumer.
- **Verify:** Resolve entity IDs and trace every assertion to a visible fact.
- **Do not misclassify:** Useful open-web semantics can be valuable without a Google ranking claim.

[Source and scope](https://developers.google.com/search/docs/appearance/ai-features).

## The magic agent file

`anti-magic-agent-file@1.0.0` · unsupported-shortcut · ai

- **Bad example:** A team calls the site AI-optimized solely because it added llms.txt.
- **Why review it:** Google says no new AI text file is needed for its AI features.
- **Replace with:** Maintain useful canonical content and use agent files for identified consumers.
- **Verify:** Test the consumer task; keep indexing and citation outcomes separate.
- **Do not misclassify:** Other agents may use such files; Google guidance is not universal agent behavior.

[Source and scope](https://developers.google.com/search/docs/appearance/ai-features).

## The daily date reset

`anti-fake-freshness@1.0.0` · quality-risk · editorial

- **Bad example:** An unchanged article shows a new updated date every morning.
- **Why review it:** Google warns against changing dates just to seem fresh.
- **Replace with:** Tie update dates to meaningful changes and preserve the change history.
- **Verify:** Compare revisions and the visible change note.
- **Do not misclassify:** A substantial correction warrants a real update date.

[Source and scope](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## The compulsory 2,000 words

`anti-word-quota@1.0.0` · unsupported-shortcut · editorial

- **Bad example:** A short answer is padded until a plugin reaches its target length.
- **Why review it:** Google does not have a preferred word count.
- **Replace with:** End when the reader can complete the task; retain necessary caveats.
- **Verify:** Ask a reviewer to perform the task and mark redundant passages.
- **Do not misclassify:** Long material is appropriate for a task requiring depth.

[Source and scope](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## A title the page cannot repay

`anti-headline-debt@1.0.0` · quality-risk · editorial

- **Bad example:** The title promises a definitive benchmark; the page contains only opinions.
- **Why review it:** Helpful-content guidance favors descriptive, non-exaggerated headings.
- **Replace with:** Match title scope to the actual evidence and limitations.
- **Verify:** List each title promise and locate its supporting section.
- **Do not misclassify:** A distinctive title can still accurately describe the material.

[Source and scope](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## Expert voice without the work

`anti-voice-without-work@1.0.0` · quality-risk · editorial

- **Bad example:** We rigorously tested everything appears above an untested comparison.
- **Why review it:** Reliability requires credible support for the claimed process.
- **Replace with:** Describe what was actually tested, by whom, under which conditions.
- **Verify:** Request the test record; narrow wording when it is absent.
- **Do not misclassify:** Clear expert interpretation is useful when labeled as interpretation.

[Source and scope](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## A borrowed past

`anti-invented-history@1.0.0` · measurement-risk · maturity

- **Bad example:** A new project adds three years of fictional releases and an invented reviewer.
- **Why review it:** Fabricated history cannot support maturity claims.
- **Replace with:** Start a real changelog and publish the first reproducible example.
- **Verify:** Trace each claimed release and reviewer contribution to actual records.
- **Do not misclassify:** A young project can have excellent functionality immediately.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## DOI confetti

`anti-doi-confetti@1.0.0` · measurement-risk · evidence

- **Bad example:** Ten scholarly identifiers decorate a pricing page without supporting its claims.
- **Why review it:** Bibliographic identity is not claim support or endorsement.
- **Replace with:** Attach each citation to the precise claim it supports, with scope.
- **Verify:** Read the relevant passage and record supported, unsupported or unreviewed.
- **Do not misclassify:** A relevant bibliography is useful when its role is clear.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## The self-citation loop

`anti-self-citation-loop@1.0.0` · measurement-risk · evidence

- **Bad example:** Five owner sites cite each other and the report calls this five independent adopters.
- **Why review it:** Common ownership does not establish independent adoption.
- **Replace with:** Record owner groups and deduplicate mirrored works.
- **Verify:** Review ownership evidence and keep unknown relationships unknown.
- **Do not misclassify:** Cross-project reuse can be valuable when labeled as internal reuse.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## A reserved DOI presented as publication

`anti-reserved-is-published@1.0.0` · measurement-risk · evidence

- **Bad example:** The release claims archived and citable while the record remains unpublished.
- **Why review it:** Reservation and a published verified object are different states.
- **Replace with:** Label the current state and verify the public deposited object before claiming publication.
- **Verify:** Resolve the identifier and inspect the exact public object and version.
- **Do not misclassify:** Reserving an identifier during preparation is legitimate.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## A citation counted as a correct answer

`anti-citation-equals-truth@1.0.0` · measurement-risk · analytics

- **Bad example:** An AI answer links the page but states the opposite of its evidence.
- **Why review it:** Exposure and supported citation are different observations.
- **Replace with:** Review claim support and report unsupported citations separately.
- **Verify:** Compare answer, cited passage, source version and observation date.
- **Do not misclassify:** An unsupported citation still records exposure, not correctness.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## The invented zero

`anti-unknown-equals-zero@1.0.0` · measurement-risk · analytics

- **Bad example:** A disconnected monitoring source produces a report saying zero failures.
- **Why review it:** Missing coverage cannot establish absence of an event.
- **Replace with:** Report unknown coverage and defer a rate until its denominator is observed.
- **Verify:** Inspect coverage windows and missing-source states.
- **Do not misclassify:** Zero is valid within a completed, explicitly covered window.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## The day-one verdict

`anti-premature-cohort@1.0.0` · measurement-risk · analytics

- **Bad example:** Yesterday’s release is judged against assets observed for a full month.
- **Why review it:** Unequal observation windows distort comparisons.
- **Replace with:** Compare completed post-release windows and show immature assets separately.
- **Verify:** Check release dates, observation cutoffs and cohort inclusion.
- **Do not misclassify:** Early observations are useful when explicitly provisional.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## The launch gets all the credit

`anti-launch-caused-growth@1.0.0` · measurement-risk · analytics

- **Bad example:** Traffic rose after a schema change, so the report attributes the entire gain to schema.
- **Why review it:** Sequence alone does not establish causation.
- **Replace with:** Record concurrent changes, compare suitable controls and preserve uncertainty.
- **Verify:** Review seasonality, campaigns, query mix and unchanged comparable pages.
- **Do not misclassify:** A before/after view is descriptive evidence when labeled correctly.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## Green checks sold as growth

`anti-green-check-growth@1.0.0` · measurement-risk · analytics

- **Bad example:** A validator passes and the dashboard declares improved AI recommendations.
- **Why review it:** Implementation checks do not measure discovery outcomes.
- **Replace with:** Show validation, publication, indexing, citation and useful action separately.
- **Verify:** Trace each outcome label to an actual provider or reviewed observation.
- **Do not misclassify:** Validation is necessary evidence for its own bounded contract.

[Source and scope](https://dkharlanau.github.io/agent-ready-web-profile/EVIDENCE-RELAY.html).

## One preview for every question

`anti-universal-preview@1.0.0` · quality-risk

- **Bad example:** Every tutorial uses the same logo-only promotional image.
- **Why review it:** Preview guidance favors a representative page image.
- **Replace with:** Choose a relevant visual for the specific page.
- **Verify:** Inspect actual image and page context.
- **Do not misclassify:** A logo can legitimately identify an organization; that is a different job.

[Source and scope](https://developers.google.com/search/docs/appearance/google-images).

## Metadata mistaken for permission

`anti-imagined-license@1.0.0` · measurement-risk

- **Bad example:** An ImageObject claims reuse rights that the publisher never obtained.
- **Why review it:** Metadata does not grant image rights.
- **Replace with:** Verify rights and state the actual terms.
- **Verify:** Match the asset to its rights record and visible credits.
- **Do not misclassify:** Accurate third-party attribution is useful where reuse is permitted.

[Source and scope](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata).

## The answer behind Run

`anti-click-only-answer@1.0.0` · quality-risk

- **Bad example:** The entire answer is fetched only after clicking a tool button.
- **Why review it:** Search rendering should not depend on a user interaction.
- **Replace with:** Provide the explanation and a worked example before interaction.
- **Verify:** Inspect the page without clicks and test the tool separately.
- **Do not misclassify:** Optional computation may still require user inputs.

[Source and scope](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading).

## A canonical that never reaches the PDF

`anti-pdf-canonical-fiction@1.0.0` · measurement-risk

- **Bad example:** A checklist claims PDF canonicalization because the HTML landing page has a canonical tag.
- **Why review it:** HTML metadata does not set the downloadable response header.
- **Replace with:** Check live headers and host support; distinguish duplicate from distinct artifacts.
- **Verify:** Fetch actual response headers and compare document scope.
- **Do not misclassify:** A distinct downloadable asset does not automatically need the HTML canonical.

[Source and scope](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
