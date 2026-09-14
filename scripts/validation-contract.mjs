import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const node = (...args) => Object.freeze({ runtime: 'node', args: Object.freeze(args) });
const syntax = (target) => node('--check', target);

export const validationPhases = Object.freeze({
  'core-tests': Object.freeze({
    description: 'Legacy broad deterministic test execution, preserved in the same order as the pre-consolidation npm test contract.',
    commands: Object.freeze([
      node('scripts/test.mjs'),
      node('scripts/quickstart.mjs'),
      node('scripts/gateway-test.mjs'),
      node('scripts/http-gateway-test.mjs'),
      node('scripts/verifier-test.mjs'),
      node('scripts/scanner-test.mjs'),
      node('scripts/health-test.mjs'),
      node('scripts/protocol-checks-test.mjs'),
      node('scripts/public-fetch-test.mjs'),
      node('scripts/resolver-test.mjs'),
      node('scripts/http-discovery-test.mjs'),
      node('scripts/mcp-runtime-test.mjs'),
      node('scripts/a2a-signature-test.mjs'),
      node('scripts/resolver-snapshot-test.mjs'),
      node('scripts/resolver-batch-test.mjs'),
      node('scripts/resolver-monitor-test.mjs'),
      node('scripts/scanner-service-test.mjs'),
      node('scripts/directory-test.mjs'),
      node('scripts/router-test.mjs'),
      node('scripts/resolved-federated-test.mjs'),
      node('scripts/self-profile-test.mjs'),
      node('scripts/ai-search-profile-test.mjs'),
      node('scripts/claims-registry-test.mjs'),
      node('scripts/crawler-matrix-test.mjs'),
      node('scripts/knowledge-graph-test.mjs'),
      node('scripts/recommendations-audit-test.mjs'),
      node('scripts/visibility-evidence-test.mjs'),
      node('scripts/visibility-import-test.mjs'),
      node('scripts/agent-eval-test.mjs'),
      node('scripts/indexnow-test.mjs'),
      node('scripts/site-test.mjs'),
      node('benchmarks/corpus-test.mjs'),
      node('benchmarks/evidence-checker-test.mjs'),
      node('benchmarks/resolver-regression.mjs')
    ])
  }),
  'core-syntax': Object.freeze({
    description: 'Syntax checks from the pre-consolidation npm test contract, preserved in the same order.',
    commands: Object.freeze([
      syntax('benchmarks/evidence-checker.mjs'),
      syntax('benchmarks/evidence-check.mjs'),
      syntax('benchmarks/external-runner.mjs'),
      syntax('benchmarks/federation-runner.mjs'),
      syntax('lib/scanner.mjs'),
      syntax('lib/health.mjs'),
      syntax('lib/protocol-checks.mjs'),
      syntax('lib/public-fetch.mjs'),
      syntax('lib/http-discovery.mjs'),
      syntax('lib/mcp-runtime.mjs'),
      syntax('lib/a2a-signature.mjs'),
      syntax('lib/ai-search-profile.mjs'),
      syntax('lib/site-audit.mjs'),
      syntax('lib/visibility-evidence.mjs'),
      syntax('lib/visibility-import.mjs'),
      syntax('lib/agent-eval.mjs'),
      syntax('lib/indexnow.mjs'),
      syntax('bin/arwp-ai-search.mjs'),
      syntax('bin/arwp-visibility.mjs'),
      syntax('bin/arwp-agent-eval.mjs'),
      syntax('bin/arwp-indexnow.mjs'),
      syntax('scripts/claims-registry-test.mjs'),
      syntax('scripts/crawler-matrix-test.mjs'),
      syntax('scripts/knowledge-graph-test.mjs'),
      syntax('scripts/recommendations-audit-test.mjs'),
      syntax('scripts/visibility-evidence-test.mjs'),
      syntax('scripts/agent-eval-test.mjs'),
      syntax('scripts/indexnow-test.mjs'),
      syntax('scripts/recommendations-source-check.mjs'),
      syntax('lib/resolver-adapters.mjs'),
      syntax('lib/resolver.mjs'),
      syntax('lib/resolver-snapshot.mjs'),
      syntax('lib/resolver-batch.mjs'),
      syntax('lib/resolver-monitor.mjs'),
      syntax('resolver/server.mjs'),
      syntax('monitor/runner.mjs'),
      syntax('scanner-service/handler.mjs'),
      syntax('scanner-service/http-node.mjs'),
      syntax('router/federated.mjs'),
      syntax('router/resolved-federated.mjs'),
      syntax('router/server.mjs'),
      syntax('gateway/factory.mjs'),
      syntax('gateway/server.mjs'),
      syntax('gateway/http.mjs'),
      syntax('gateway/http-entry.mjs'),
      syntax('gateway/http-node.mjs')
    ])
  }),
  'core-supplemental': Object.freeze({
    description: 'Supplemental repository contract checks that historically closed npm test.',
    commands: Object.freeze([
      node('scripts/discoverability-test.mjs', '--site'),
      node('scripts/agent-skills-test.mjs'),
      node('scripts/portfolio-workspace-test.mjs'),
      node('scripts/evidence-relay-test.mjs')
    ])
  }),
  'ci-maturity': Object.freeze({
    description: 'Main-CI maturity evidence inventory checks.',
    commands: Object.freeze([
      node('scripts/project-surfaces-test.mjs', '--site'),
      node('scripts/maturity-profile-test.mjs', '--site'),
      node('bin/arwp-maturity.mjs', 'check', 'docs/maturity/profile.json'),
      syntax('lib/project-surfaces.mjs'),
      syntax('scripts/project-surfaces-test.mjs'),
      syntax('lib/maturity-profile.mjs'),
      syntax('bin/arwp-maturity.mjs'),
      node('-e', "JSON.parse(require('fs').readFileSync('schema/project-surfaces.schema.json','utf8'))")
    ])
  }),
  'ci-site-focus': Object.freeze({
    description: 'Main-CI problem-first Site Focus checks.',
    commands: Object.freeze([
      node('scripts/site-focus-test.mjs'),
      node('scripts/site-focus-engine-test.mjs'),
      node('scripts/site-focus-v2-test.mjs'),
      node('scripts/site-focus-v3-test.mjs'),
      node('scripts/site-focus-dogfood.mjs'),
      syntax('scripts/site-focus-test.mjs'),
      syntax('scripts/site-focus-engine-test.mjs'),
      syntax('scripts/site-focus-v2-test.mjs'),
      syntax('scripts/site-focus-v3-test.mjs'),
      syntax('scripts/site-focus-dogfood.mjs'),
      syntax('lib/site-focus.mjs'),
      syntax('lib/site-focus-intent.mjs'),
      syntax('lib/site-focus-v2.mjs'),
      syntax('lib/site-focus-v3.mjs'),
      syntax('bin/arwp-focus.mjs')
    ])
  }),
  'ci-entity-gap': Object.freeze({
    description: 'Main-CI entity graph gap checks.',
    commands: Object.freeze([
      node('scripts/entity-gap-test.mjs'),
      syntax('lib/entity-gap.mjs'),
      syntax('bin/arwp-entities.mjs')
    ])
  }),
  'ci-entity-remediation': Object.freeze({
    description: 'Main-CI entity remediation checks.',
    commands: Object.freeze([
      node('scripts/entity-remediation-test.mjs'),
      syntax('lib/entity-remediation.mjs'),
      syntax('bin/arwp-entity-remediation.mjs')
    ])
  }),
  'ci-search-surface': Object.freeze({
    description: 'Main-CI Search Surface Blueprint checks.',
    commands: Object.freeze([
      node('scripts/search-surface-test.mjs'),
      syntax('lib/search-surface-core.mjs'),
      syntax('lib/search-surface.mjs'),
      syntax('lib/site-improvement-deep.mjs'),
      syntax('bin/arwp-surfaces.mjs')
    ])
  }),
  'ci-site-improvement': Object.freeze({
    description: 'Main-CI unified Site Improvement checks.',
    commands: Object.freeze([
      node('scripts/site-improvement-test.mjs'),
      node('scripts/site-improvement-vertical-test.mjs'),
      syntax('lib/site-improvement.mjs'),
      syntax('lib/site-improvement-deep.mjs'),
      syntax('lib/site-improvement-vertical.mjs'),
      syntax('lib/growth-vertical-evidence.mjs'),
      syntax('bin/arwp-improve.mjs'),
      syntax('scripts/site-improvement-vertical-test.mjs')
    ])
  }),
  'ci-dataset': Object.freeze({
    description: 'Main-CI dataset publication and DOI checks.',
    commands: Object.freeze([
      node('scripts/dataset-publication-test.mjs'),
      syntax('lib/dataset-publication.mjs'),
      syntax('bin/arwp-dataset.mjs'),
      syntax('scripts/dataset-publication-test.mjs')
    ])
  }),
  'ci-content-profile': Object.freeze({
    description: 'Main-CI adaptive content profile checks.',
    commands: Object.freeze([
      node('scripts/content-profile-test.mjs'),
      syntax('lib/content-profile.mjs'),
      syntax('bin/arwp-content.mjs')
    ])
  }),
  'ci-classification': Object.freeze({
    description: 'Main-CI product classification check.',
    commands: Object.freeze([
      node('scripts/classification-test.mjs')
    ])
  }),
  'ci-benchmark-publication': Object.freeze({
    description: 'Main-CI benchmark publication sanitizer checks.',
    commands: Object.freeze([
      node('benchmarks/publication-report-test.mjs'),
      syntax('benchmarks/publication-report.mjs')
    ])
  }),
  'ci-benchmark-diagnostics': Object.freeze({
    description: 'Main-CI benchmark decision-quality diagnostics.',
    commands: Object.freeze([
      node('benchmarks/selection-diagnostics-test.mjs'),
      node('benchmarks/resolver-regret-test.mjs'),
      node('benchmarks/live-capability-drift-test.mjs'),
      node('benchmarks/ground-truth-review-test.mjs'),
      syntax('benchmarks/selection-diagnostics.mjs'),
      syntax('benchmarks/ground-truth-review.mjs')
    ])
  }),
  'ci-large-homepage': Object.freeze({
    description: 'Main-CI bounded large-homepage scanner check.',
    commands: Object.freeze([
      node('scripts/scanner-large-homepage-test.mjs')
    ])
  }),
  'ci-package-improvement': Object.freeze({
    description: 'Main-CI package improvement surface smoke check.',
    commands: Object.freeze([
      node('scripts/package-improvement-smoke-test.mjs')
    ])
  }),
  'ci-examples': Object.freeze({
    description: 'Main-CI example validation through the public CLI.',
    commands: Object.freeze([
      node('bin/arwp.mjs', 'validate', 'examples/minimal.site-profile.json'),
      node('bin/arwp.mjs', 'validate', 'examples/knowledge-site.site-profile.json')
    ])
  })
});

export const validationGroups = Object.freeze({
  core: Object.freeze(['core-tests', 'core-syntax', 'core-supplemental'])
});

function expandNames(name, seen = new Set()) {
  if (validationPhases[name]) return [name];
  const group = validationGroups[name];
  if (!group) throw new Error(`unknown validation phase or group: ${name}`);
  if (seen.has(name)) throw new Error(`validation group cycle detected at: ${name}`);
  const nextSeen = new Set(seen);
  nextSeen.add(name);
  return group.flatMap((entry) => expandNames(entry, nextSeen));
}

export function flattenValidationContract(name) {
  return expandNames(name).flatMap((phaseName) => validationPhases[phaseName].commands);
}

export function formatCommand(command) {
  return `node ${command.args.map((arg) => JSON.stringify(arg)).join(' ')}`;
}

function listContract(name) {
  const phaseNames = expandNames(name);
  const payload = {
    name,
    phases: phaseNames.map((phaseName) => ({
      name: phaseName,
      description: validationPhases[phaseName].description,
      commands: validationPhases[phaseName].commands.map(formatCommand)
    }))
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function runContract(name) {
  const phaseNames = expandNames(name);
  for (const phaseName of phaseNames) {
    const phase = validationPhases[phaseName];
    process.stdout.write(`\n[validation] ${phaseName}: ${phase.description}\n`);
    for (const command of phase.commands) {
      process.stdout.write(`[validation] ${formatCommand(command)}\n`);
      const result = spawnSync(process.execPath, command.args, {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit'
      });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const listIndex = args.indexOf('--list');
  const name = listIndex >= 0 ? args[listIndex + 1] : args[0];
  if (!name) {
    console.error(`usage: node scripts/validation-contract.mjs <${[...Object.keys(validationGroups), ...Object.keys(validationPhases)].join('|')}>`);
    console.error('       node scripts/validation-contract.mjs --list <name>');
    process.exit(2);
  }
  try {
    if (listIndex >= 0) listContract(name);
    else runContract(name);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
