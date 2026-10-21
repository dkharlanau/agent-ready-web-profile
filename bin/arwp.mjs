#!/usr/bin/env node

if (['representations', 'ai-access'].includes(process.argv[2])) {
  await import('./arwp-agent-discovery.mjs');
} else if (process.argv[2] === 'bing') {
  process.argv.splice(2, 1);
  await import('./arwp-bing.mjs');
} else if (process.argv[2] === 'search-doctor') {
  process.argv.splice(2, 1);
  await import('./arwp-search-doctor.mjs');
} else if (process.argv[2] === 'site-gate') {
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
} else if (process.argv[2] === 'localization') {
  process.argv.splice(2, 1);
  await import('./arwp-localization.mjs');
} else {
  await import('./arwp-core.mjs');
}
