# Competitor and category landscape history

This directory keeps append-only snapshots of ARWP's source-backed product/category map.

A new revision is created when a material product capability, category boundary or upstream-vs-competitor classification changes. Prior snapshots are not silently rewritten.

For 2026-09-05:

- `2026-09-05.json` — r1, initial category map.
- `2026-09-05-r2.json` — r2, expanded competitor research including Agent Ready's empirical corpus and clearer separation of Vercel/ARD guidance from products.
- `2026-09-05-r3.json` — r3, ARD v0.91 correction: ARD is current upstream discovery architecture using canonical `/.well-known/ard.json`, `rel="ard"` and JSON-LD descriptions; predecessor ai-catalog is compatibility evidence.

Use `index.json` to identify the current revision.
