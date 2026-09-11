---
title: OpenAI / ChatGPT Search publisher controls
---

# OpenAI / ChatGPT Search publisher controls

Status: **source review 2026-09-11**.

This page translates OpenAI's current publisher/developer FAQ into implementation decisions that can be reviewed without collapsing Search discovery, model-training preferences, result suppression and browser-agent compatibility into one generic “AI crawler” switch.

Primary source: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq

## Decision matrix

| Publisher goal | OAI-SearchBot | GPTBot | Page directive / runtime check | What the evidence supports |
| --- | --- | --- | --- | --- |
| Be eligible for ChatGPT summaries/snippets | Allow the intended public page | Publisher choice | Do not add `noindex` when inclusion is intended | OpenAI says OAI-SearchBot access helps content be discovered and included in summaries/snippets. This is eligibility, not a citation guarantee. |
| Be discoverable in ChatGPT but opt out of potential model training | Allow the intended public page | Disallow the intended site/page | No `noindex` when Search inclusion is intended | OpenAI documents OAI-SearchBot and GPTBot as separate controls and says GPTBot opt-out is respected for content acquired through Atlas user interactions. |
| Prevent a URL/title from surfacing in ChatGPT Atlas | The crawler must be able to fetch the page to read the directive | Publisher choice | Use `noindex` on the relevant page | OpenAI says a disallowed URL learned from another source may still surface as a link plus page title; `noindex` is the documented suppression control, and the crawler must be allowed to read it. |
| Keep genuinely private content private | Do not rely on robots metadata as access control | Do not rely on crawler policy as access control | Require real authentication/authorization | `robots.txt`, GPTBot policy and `noindex` are discovery/usage controls, not security boundaries. |
| Improve Atlas agent interaction | Not the primary control | Not the primary control | Prefer native HTML; add accurate ARIA roles, labels and states where needed; run task-completion tests | OpenAI says ChatGPT Agent in Atlas uses ARIA semantics to interpret page structure and interactive elements. |
| Ship an Apps SDK experience that works in Atlas | Not the primary control | Not the primary control | Test the app inside the Chat sidebar at smaller widths | OpenAI explicitly recommends smaller-width sidebar testing for Apps SDK experiences. |

## The important `robots.txt` / `noindex` distinction

A common but unsafe assumption is:

> “If I block a crawler in `robots.txt`, the URL cannot appear.”

That is not what OpenAI currently documents for ChatGPT Atlas. OpenAI says that when it learns a disallowed URL from a third-party search provider or by crawling other pages, it may still surface the link and page title if the page appears relevant.

If the actual publisher requirement is **“do not surface this URL/title”**, the implementation should therefore be reviewed as a suppression problem rather than only a crawler-access problem:

1. put `noindex` on the relevant page;
2. make sure the relevant crawler is allowed to fetch that page so the directive can be read;
3. do not treat `robots.txt` blocking alone as proof of suppression;
4. use authentication/authorization instead when the content itself must be private.

This is a control rule, not an optimization tactic. Do not add `noindex` to pages merely to satisfy a generic audit.

## Search and training are separate decisions

OpenAI currently documents two distinct publisher choices:

```text
ChatGPT Search discovery  -> OAI-SearchBot
potential model training  -> GPTBot
```

A valid publisher policy can therefore be:

```text
User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Disallow: /
```

That example means “Search discovery allowed, GPTBot training crawl denied.” It is not a universal recommendation; the correct setting follows the publisher's own policy.

Do not infer a GPTBot preference from an OAI-SearchBot preference or vice versa.

## Measurement

OpenAI says ChatGPT referral URLs automatically include:

```text
utm_source=chatgpt.com
```

Use that value in first-party analytics to measure inbound ChatGPT Search referral traffic. Crawler logs are not a substitute for referral/conversion evidence, and referral traffic does not prove that a particular technical change caused the visit.

## Atlas interaction semantics

For interactive sites:

- use native semantic elements before adding ARIA;
- use accurate roles, labels and states for controls, menus and forms where native semantics are insufficient;
- avoid decorative or contradictory ARIA;
- test real tasks, not merely the presence of attributes;
- preserve keyboard and screen-reader usability while testing agent interaction.

ARIA presence is not proof that an agent can complete the workflow.

## Apps SDK width gate

For Apps SDK experiences, add a narrow-sidebar runtime acceptance check. At minimum verify that:

- primary content remains readable without critical horizontal clipping;
- primary actions remain visible and reachable;
- dialogs, menus, forms and connection flows fit the constrained surface;
- focus order and keyboard behavior remain coherent;
- important state is not communicated only through a wide desktop layout;
- the same core task can be completed in the Chat sidebar.

This is an app-runtime compatibility check, not a Search ranking factor.

## ARWP interpretation

When applying this guidance to a target site, keep four questions separate:

1. **Discovery:** should OAI-SearchBot be able to fetch the page?
2. **Suppression:** should the URL/title be prevented from surfacing, requiring readable `noindex`?
3. **Training policy:** should GPTBot be allowed for the site/page?
4. **Agent operation:** can Atlas/ChatGPT interact with the interface using accurate semantics and constrained layouts?

Record the publisher's intent before changing any of these controls. A technically valid configuration can be wrong for the owner's policy if the goal was never established.

## Verification boundary

A passing implementation review can establish only that the observed controls match the documented publisher intent in the bounded sample. It does **not** prove that ChatGPT will crawl, cite, rank, recommend, refer traffic to, suppress every discovered copy of, or successfully operate the page in every future runtime.
