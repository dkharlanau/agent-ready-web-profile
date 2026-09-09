#!/usr/bin/env node

if (process.argv[2] === 'site-gate') {
  await import('./arwp-site-gate.mjs');
} else if (process.argv[2] === 'technical-integrity') {
  await import('./arwp-technical-integrity.mjs');
} else if (process.argv[2] === 'freshness') {
  process.argv.splice(2, 1);
  await import('./arwp-freshness.mjs');
} else if (process.argv[2] === 'treatment-cohort') {
  process.argv.splice(2, 1);
  await import('./arwp-treatment-cohort.mjs');
} else if (process.argv[2] === 'url-migration') {
  process.argv.splice(2, 1);
  await import('./arwp-url-migration.mjs');
} else {
  await import('./arwp-core.mjs');
}
