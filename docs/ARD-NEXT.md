# Next ARD interoperability slice

Current ARWP support for ARD v0.91 is intentionally partial. The next implementation slice should be evidence-gated and bounded.

## Goal

Complete the high-value ARD v0.91 discovery semantics without turning normal site resolution into an unbounded federated crawler.

## Required work

- parse the ARD base JSON-LD context and preserve namespaced properties;
- extract in-page JSON-LD ARD entries from HTML;
- extract HTML `<link rel="ard">` in addition to HTTP Link discovery;
- evaluate robots `Agentmap` discovery;
- retain unsupported namespaces as opaque evidence rather than guessing semantics;
- add explicit opt-in registry `POST /search` support with strict request/result/referral limits;
- keep registry search separate from default site resolution;
- add independent public ARD fixtures when stable implementations appear;
- rerun the frozen resolver decision-quality corpus after any planner-policy change.

## Must not do

- do not recursively crawl nested catalogs without strict bounds;
- do not turn A2A Agent Card document URLs into callable endpoints;
- do not infer authorization from discovery metadata;
- do not claim full ARD conformance from static manifest parsing alone;
- do not add ARWP-native catalog fields when ARD can represent the resource.
