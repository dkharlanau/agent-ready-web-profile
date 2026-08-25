# Hosted ARWP Scanner Service

This directory turns the existing bounded `lib/scanner.mjs` implementation into a small HTTP service for the public project UI.

It is intentionally **not** a generic proxy. The service exposes only:

- `GET /health`
- `POST /scan` with `{ "url": "https://example.com" }`
- `OPTIONS /scan` for explicitly allowed browser origins

The scan itself keeps the CLI scanner's existing boundaries: HTTPS only, DNS checks against private/reserved addresses, redirect revalidation, bounded response sizes, bounded candidate discovery and no inference of advanced runtime capabilities from marketing text.

## Run locally

```bash
ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
ARWP_SCANNER_BIND=127.0.0.1 \
PORT=8787 \
npm run scanner:http
```

Then:

```bash
curl -sS -X POST http://127.0.0.1:8787/scan \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

## Container

```bash
docker build -f scanner-service/Dockerfile -t arwp-scanner .
docker run --rm -p 8787:8787 \
  -e ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
  arwp-scanner
```

## Public deployment requirements

Before wiring the endpoint into `docs/index.html`, deploy behind HTTPS and set:

- `ARWP_SCANNER_ALLOWED_ORIGINS` to the exact public UI origin(s);
- a platform-level request/body timeout in addition to the scanner timeout;
- an edge or platform rate limit if available; the service also has an in-memory rate limiter;
- logs that exclude response bodies and do not create a browsing-history dataset;
- a stable `/health` probe.

The project site's `<body data-scanner-endpoint="...">` is the only browser configuration needed. When it is empty, the page stays in local-CLI mode rather than pretending a hosted scanner exists.
