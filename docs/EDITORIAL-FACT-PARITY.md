# Check a published page against approved facts

A writer can create fluent copy that misrepresents a price, launch date, customer, ownership or measured outcome. Goose does not use an "AI-generated probability" or a keyword-density threshold to judge quality.

**Scope:** read a local *built* HTML page, then check explicit owner-approved statements against the visible page and generated metadata. This is a source/editorial preflight, not an independent fact-check or ranking test.

## What the owner supplies

Store a locally reviewed JSON contract (sample below is fictional and contains no real product information). The owner must decide which facts are true before running the check.

```json
{
  "version": "0.1",
  "canonicalUrl": "https://example.com/article/",
  "requiredVisibleFacts": [
    "Not released yet",
    "Try one small exercise"
  ],
  "forbiddenClaims": [
    "guaranteed 10x growth",
    "Download now"
  ],
  "approvedMetadataClaims": [
    "one exercise"
  ],
  "mustRemainUnavailable": true,
  "productOfferVerified": false
}
```

```bash
node bin/arwp-editorial.mjs \
  --html=/private/built/article.html \
  --contract=/private/owner/editorial-facts.json \
  --output=/private/reviews/article-preflight.json \
  --json
```

**Checks:** readable `main` and H1, owner-specified canonical identity, meaningful approved visible facts, disallowed claims across text/title/snippet/JSON-LD, parseable JSON-LD, unsupported numeric assertions in metadata, structured Offer claims that need owner evidence and premature product availability statements.

A missing meta description or a new number found only in metadata becomes **review-needed**. A violated explicit approved fact, forbidden claim, invalid JSON-LD, missing reader structure or wrong canonical is **fail**. The script exits nonzero on failed contracts or invalid inputs. A reviewed output cannot overwrite the previous file.

This is a deliberately bounded static check, not a full rendered DOM, screen-reader, dynamic-JS or external rights audit. The inspection does not know whether the owner's statements are true. Someone responsible for the content must confirm source support, license, privacy, whether the example is fictional, real product status, and that metadata paraphrases truthfully. The script never accesses analytics, browser cookies, remote CMS, OpenAI APIs or account credentials.

## Reader, specialist, skeptic, editor

Read the page itself after the machine check. Can a reader make a decision or try one useful action? Is there actual first-party evidence rather than reused generic SEO prose? Does the explanation distinguish what was implemented from what was *measured*? Is there a clearly described reason not to follow the recommendation?

For reusable first-party examples, use [the original evidence worksheet](../templates/growth/original-evidence-review.md) and existing [Controlled Cohorts](CONTROLLED-COHORTS.md), [Growth Experiments](GROWTH-EXPERIMENTS.md) and [Change Receipts](CHANGE-RECEIPTS.md), not a parallel proof registry.

**Current privacy rule:** if the publisher wants brand-level authorship, do not invent or expose a person's identity. An `Organization` or brand editor credit must be consistent with the visible publication and actual owner permission.

Result labels are **source preflight** only. Passing this procedure does not prove Google indexing, a Bing citation, ChatGPT discovery, visits, conversations, conversions, original human authorship or any ranking effect.
