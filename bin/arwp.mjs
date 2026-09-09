#!/usr/bin/env node

if (process.argv[2] === 'site-gate') {
  await import('./arwp-site-gate.mjs');
} else {
  await import('./arwp-core.mjs');
}
