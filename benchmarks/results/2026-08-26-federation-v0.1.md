# Resolver-backed federation external observation — 2026-08-26

This is a durable engineering record of the first reviewed independent federation corpus run. It is not an adoption claim and hit count is not an answer-quality metric.

- head: `3fe33ce530167cc24ebe29a481cbf9c3b9c749b5`
- workflow run: `32909627342`
- artifact: `arwp-external-benchmark-32909627342`
- artifact SHA-256: `a046f7ccd8317edd976ffac773fca0ade85b1cf556ac7c29abfb8920fa31d1d4`
- reviewed independent sites: 4
- expected interfaces actually executed: 1
- sites with query hits: 1

| Site | Reviewed interface | Observation | Executed records | Query hits |
| --- | --- | --- | ---: | ---: |
| JSON Feed | `https://www.jsonfeed.org/feed.json` | no compatible resolved surface | 0 | 0 |
| Manton Reece | `https://www.manton.org/feed.json` | no compatible resolved surface | 0 | 0 |
| ai.rud.is | `https://ai.rud.is/feed.json` | expected interface executed | 43 | 3 |
| Daring Fireball | `https://daringfireball.net/feeds/json` | no compatible resolved surface | 0 | 0 |

The positive result is real: the resolver discovered the `ai.rud.is` JSON Feed from ordinary web evidence, federation fetched it through the bounded public-HTTPS path, parsed 43 records, and returned three matches for the reviewed query.

The negative result is equally important. Three sites in the reviewed corpus publish JSON feeds according to publisher/spec evidence, but the current resolver observation did not expose a compatible static feed surface. Ground truth was not changed to match Resolver output. This identifies discovery coverage—not federation parsing—as the next engineering target.

The corresponding 20-site external resolver benchmark in the same workflow also completed successfully with all 20 independent sites resolving. Its aggregate remained ordinary-web 74%, llms-aware 89%, agents-aware 71%, protocol-native 63%, ARWP-profile-only 71%, resolver-union 81%.
