# Site Pattern Detector Authority v0.1

The Detector Authority Registry defines **what an automated or assisted detector is allowed to conclude** before its output enters a Site Pattern Map.

This exists because scaling Cite Goose across many sites creates a new failure mode: a useful heuristic can quietly become an automated accusation. A string match, timestamp comparison or schema parser can nominate a suspicious surface, but that does not mean it has enough evidence to confirm an anti-pattern.

The registry therefore separates detector mechanics from detector authority.

## Authority model

Each detector declares:

- the exact pattern ID and version it targets;
- its mode: `deterministic`, `heuristic`, `manual-assisted` or `provider-observation`;
- whether it has `candidate` or `verdict` authority;
- exactly which verdicts it may emit;
- target scopes it can inspect;
- accepted evidence types;
- required inputs/review context;
- its false-positive boundary;
- explicit limitations.

### Candidate authority

Candidate detectors may emit only:

```json
{"verdict":"unknown"}
```

They identify work for review. They do not confirm presence or absence.

### Verdict authority

Verdict-capable detectors are reserved for observations where the evidence boundary is actually deterministic or where the declared review gate has been completed.

Examples:

- probing a concrete URL and checking the final HTTP/content state can support a bounded `arwp-access-status` verdict;
- interpreting an editorial claim as `anti-magic-agent-file` cannot be made deterministic merely by finding `llms.txt` in the text.

## Manual-required anti-patterns

The current anti-pattern catalog marks its examples `manual-required`.

The detector validator enforces this rule:

- heuristic, deterministic and provider-observation detectors may only nominate such an anti-pattern as `unknown`;
- `present` or `absent` requires `manual-assisted` mode plus a `manual` review gate;
- the Site Pattern Map separately requires the anti-pattern's false-positive boundary to have been reviewed before `present` can be recorded.

This is a two-stage guardrail: detector authority first, site-instance review second.

## Initial detector contracts

The v0.1 registry starts small on purpose.

### Deterministic

`spd_http_status`

Binds to `arwp-access-status@1.0.1`. It can record present/absent for the sampled route only after redirects and soft-error content are checked. It cannot say anything about indexing or rankings.

### Manual-assisted

`spd_searchbot_policy_review`

Binds to `arwp-access-searchbot@1.0.1`. A crawler policy only becomes a verdict after deployed policy, current provider documentation and owner intent are reviewed together.

### Candidate-only anti-pattern detectors

- `spd_magic_agent_file_candidate` → `anti-magic-agent-file@1.0.0`
- `spd_fake_freshness_candidate` → `anti-fake-freshness@1.0.0`
- `spd_schema_costume_candidate` → `anti-schema-costume@1.0.0`
- `spd_green_check_growth_candidate` → `anti-green-check-growth@1.0.0`

All four remain `unknown` until manual review.

## Operational flow

```text
crawler / source scan / provider report
                |
                v
       Detector Authority Registry
   what may this detector conclude?
                |
      +---------+---------+
      |                   |
 candidate-only       verdict-capable
      |                   |
      v                   v
 unknown instance   bounded instance
      |                   |
      +---------+---------+
                |
                v
          Site Pattern Map
                |
                v
      manual boundary review / remediation
```

A detector implementation may become smarter without silently gaining more authority. Increasing authority requires a reviewed registry change.

## CLI

Validate the registry:

```bash
node bin/arwp-pattern-detectors.mjs check
```

List all candidate-only anti-pattern detectors:

```bash
node bin/arwp-pattern-detectors.mjs list \
  --kind=anti-pattern \
  --authority=candidate
```

Inspect detectors for one pattern:

```bash
node bin/arwp-pattern-detectors.mjs list --pattern=anti-fake-freshness
```

## Why this matters for agents

An autonomous agent can safely do more when its epistemic limits are machine-readable.

Instead of one vague instruction such as “detect bad SEO patterns,” an agent can:

1. run deterministic checks and write bounded verdicts;
2. run heuristics and create `unknown` review candidates;
3. attach exact evidence locators;
4. refuse to promote a candidate beyond its registered authority;
5. route manual-required cases to review;
6. preserve the result in the Site Pattern Map;
7. later connect verified remediation and outcomes.

This makes automation more useful because it makes overclaiming harder.

## Files

- Registry: `registry/site-pattern-detectors.json`
- Schema: `schema/site-pattern-detector-registry-v0.1.schema.json`
- Runtime: `lib/site-pattern-detectors.mjs`
- CLI: `bin/arwp-pattern-detectors.mjs`
- Tests: `scripts/site-pattern-detector-test.mjs`
