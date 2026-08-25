# Hosted ARWP Discovery Service

This directory exposes the existing bounded scanner and Resolver through a small HTTP service for the public project UI.

It is intentionally **not** a generic proxy. The service exposes only:

- `GET /health`
- `POST /scan` with `{ "url": "https://example.com" }`
- `POST /resolve` with `{ "url": "https://example.com" }`
- `POST /explain` with `{ "url": "https://example.com" }`
- `POST /plan` with `{ "url": "https://example.com", "intent": "search" }`
- bounded `OPTIONS` preflight for explicitly allowed browser origins

Supported plan intents are `read`, `search`, `structured`, `tools` and `agent`.

All site-facing operations keep the same public-network boundaries: HTTPS only, DNS checks against private/reserved addresses, redirect revalidation, bounded response sizes, bounded candidate discovery, explicit timeouts and no inference of advanced runtime capabilities from marketing text.

Rate limiting is shared across `/scan`, `/resolve`, `/explain` and `/plan` so adding resolver routes does not multiply the per-client public request budget.

## Run locally

```bash
ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
ARWP_SCANNER_BIND=127.0.0.1 \
PORT=8787 \
npm run scanner:http
```

Examples:

```bash
curl -sS -X POST http://127.0.0.1:8787/resolve \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'

curl -sS -X POST http://127.0.0.1:8787/plan \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","intent":"search"}'
```

## Container

```bash
docker build -f scanner-service/Dockerfile -t arwp-discovery .
docker run --rm -p 8787:8787 \
  -e ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
  arwp-discovery
```

## Public deployment requirements

Before wiring the endpoint into `docs/index.html`, deploy behind HTTPS and set:

- `ARWP_SCANNER_ALLOWED_ORIGINS` to the exact public UI origin(s);
- a platform-level request/body timeout in addition to resolver/scanner timeouts;
- an edge/platform rate limit if available; the service also has a shared in-memory rate limiter;
- privacy-minimized logs that exclude response bodies and do not create a browsing-history dataset;
- a stable `/health` probe.

The project site's `<body data-scanner-endpoint="...">` stores one fixed service endpoint. The UI derives only known fixed service routes from it. When the value is empty, the page stays in local-CLI mode rather than pretending a hosted service exists.
