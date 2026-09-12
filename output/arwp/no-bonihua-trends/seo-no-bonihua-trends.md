# SEO Trend Export (Bonihua excluded)

- Scope: all projects with Bonihua removed
- Current window: 2026-08-13 → 2026-09-09
- Previous window: 2026-07-16 → 2026-08-12
- Excluded: bonihua, sc-domain:bonihua, https://bonihua.com/

## Tracked projects

| Project | Current clicks | Previous clicks | Δ clicks | Current impressions | Previous impressions | Δ impressions | CTR current | CTR previous | CTR delta | Position current | Position previous | Position delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cognitive Biases | 41 | 1 | 40 | 10100 | 260 | 9840 | 0.41% | 0.38% | +0.02 p.p. | 14.40 | 15.73 | -1.34 |
| Metalhatscats | 39 | 59 | -20 | 7477 | 15296 | -7819 | 0.52% | 0.39% | +0.14 p.p. | 11.40 | 11.47 | -0.07 |
| Brali | 33 | 5 | 28 | 7242 | 2414 | 4828 | 0.46% | 0.21% | +0.25 p.p. | 10.89 | 16.44 | -5.55 |
| CBT Cards | 13 | 0 | 13 | 324 | 12 | 312 | 4.01% | 0.00% | +4.01 p.p. | 6.00 | 16.67 | -10.67 |
| Ptichi | 2 | 0 | 2 | 22 | 0 | 22 | 9.09% | 0.00% | +9.09 p.p. | 8.41 | n/a | n/a |
| Personal site | 1 | 1 | 0 | 41 | 150 | -109 | 2.44% | 0.67% | +1.77 p.p. | 8.90 | 8.71 | +0.20 |
| Martenweave | 0 | 0 | 0 | 27 | 11 | 16 | 0.00% | 0.00% | +0.00 p.p. | 4.19 | 1.00 | +3.19 |
| Metkagram | 0 | 2 | -2 | 45 | 15 | 30 | 0.00% | 13.33% | -13.33 p.p. | 5.84 | 13.00 | -7.16 |
| Wooolfmesh | 0 | 0 | 0 | 1 | 5 | -4 | 0.00% | 0.00% | +0.00 p.p. | 2.00 | 6.00 | -4.00 |

## Aggregate (tracked only)
- Clicks: 129 (prev 68), delta 61
- Impressions: 25279 (prev 18163), delta 7116
- CTR: 0.51% (prev 0.37%)
- Avg position: 12.36 (prev 12.16)

## Untracked non-Bonihua GSC properties

## Top growth
- top clicks growth: Cognitive Biases (+40), Brali (+28), CBT Cards (+13)
- top impressions growth: Cognitive Biases (+9840), Brali (+4828), CBT Cards (+312)
- negative trend rows: Metalhatscats (-20,-7819), Personal site (0,-109), Metkagram (-2,30), Wooolfmesh (0,-4)

## Update command

```sh
node output/arwp/no-bonihua-trends/build-no-bonihua-trends.mjs
```

This script reuses local files and rewrites these outputs:
- seo-no-bonihua-trends.artifact.json
- seo-no-bonihua-trends.csv
- seo-no-bonihua-trends.md
