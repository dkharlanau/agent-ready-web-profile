# Resolver-backed federation external observation — 2026-08-26 v0.2

This is a durable engineering record of the reviewed independent federation corpus after the ordinary-web JSON Feed discovery change. It is not an adoption claim and hit count is not an answer-quality metric.

- head: `cd5b2f83bdfa8b3f186ff730e79536b7e3067679`
- workflow run: `32913518516`
- artifact: `arwp-external-benchmark-32913518516`
- artifact SHA-256: `1585d72a40a49a6e2961bf2db84de8ec063b4aaad3e558429606684ea9f0be8b`
- reviewed independent sites: 4
- expected interfaces actually executed: 4
- sites with query hits: 4

| Site | Reviewed interface | Observation | Executed records | Query hits |
| --- | --- | --- | ---: | ---: |
| JSON Feed | `https://www.jsonfeed.org/feed.json` | expected interface executed | 2 | 2 |
| Manton Reece | `https://www.manton.org/feed.json` | expected interface executed | 25 | 5 |
| ai.rud.is | `https://ai.rud.is/feed.json` | expected interface executed | 43 | 3 |
| Daring Fireball | `https://daringfireball.net/feeds/json` | expected interface executed | 48 | 5 |

The same reviewed corpus that previously executed only 1 of 4 expected JSON Feed interfaces now executes all 4. The fixtures and expected URLs were not changed to obtain the result. The implementation change recognizes `rel="alternate" type="application/json"` as JSON Feed evidence only when the link title or URL shape explicitly identifies a JSON Feed, while keeping generic JSON alternates out of feed discovery.

All four interfaces were discovered as ordinary-web evidence and executed through the bounded resolver-backed federation path. The corpus therefore verifies the specific discovery/parsing path it was designed to exercise; it does not establish adoption, answer quality, ranking quality or general web coverage.

The corresponding 20-site external resolver benchmark in the same workflow also completed successfully with all 20 independent sites resolving. Its aggregate remained ordinary-web 74%, llms-aware 89%, agents-aware 71%, protocol-native 63%, ARWP-profile-only 71%, resolver-union 81%.
