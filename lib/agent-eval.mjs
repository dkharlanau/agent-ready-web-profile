import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'agent-eval-receipt.schema.json');

export function createAgentEvalValidator() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function validateAgentEvalReceipt(receipt) {
  const validate = createAgentEvalValidator();
  const valid = Boolean(validate(receipt));
  const warnings = [];
  for (const task of receipt?.tasks || []) {
    const modes = task.variants.map(variant => variant.mode);
    if (new Set(modes).size !== modes.length) warnings.push(`task ${task.id} contains duplicate mode variants.`);
    if (!modes.includes('ui')) warnings.push(`task ${task.id} has no UI baseline.`);
    if (receipt?.runtime?.webmcpState === 'observed-runtime' && !modes.includes('webmcp')) warnings.push(`task ${task.id} has no WebMCP variant despite observed runtime support.`);
  }
  return { valid, errors: validate.errors ?? [], warnings };
}

export function loadAgentEvalReceipt(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

export function summarizeAgentEvalReceipt(receipt) {
  const validation = validateAgentEvalReceipt(receipt);
  if (!validation.valid) return { ...validation, site: receipt?.site ?? null, tasks: [] };
  const tasks = receipt.tasks.map(task => {
    const ui = task.variants.find(variant => variant.mode === 'ui') || null;
    const webmcp = task.variants.find(variant => variant.mode === 'webmcp') || null;
    const comparison = ui && webmcp ? {
      successChanged: ui.success !== webmcp.success,
      interactionDelta: webmcp.interactions - ui.interactions,
      retryDelta: webmcp.retries - ui.retries,
      toolCallDelta: webmcp.toolCalls - ui.toolCalls,
      durationDeltaMs: typeof ui.durationMs === 'number' && typeof webmcp.durationMs === 'number' ? webmcp.durationMs - ui.durationMs : null
    } : null;
    return { id: task.id, description: task.description, ui, webmcp, comparison };
  });
  return {
    ...validation,
    site: receipt.site,
    capturedAt: receipt.capturedAt,
    runtime: receipt.runtime,
    tasks,
    guardrails: receipt.guardrails,
    interpretation: 'This receipt is runtime evidence for the tested tasks and environment only. It is not proof of security, universal agent compatibility or search ranking impact.'
  };
}

export function formatAgentEvalSummary(result) {
  if (!result.valid) return `Invalid agent eval receipt (${result.errors.length} schema error(s)).`;
  const lines = [
    `Browser agent eval — ${result.site}`,
    `Runtime: ${result.runtime.browser}${result.runtime.browserVersion ? ` ${result.runtime.browserVersion}` : ''}; WebMCP=${result.runtime.webmcpState}`,
    ''
  ];
  for (const task of result.tasks) {
    lines.push(`${task.id} — ${task.description}`);
    if (task.ui) lines.push(`  UI:     success=${task.ui.success} interactions=${task.ui.interactions} retries=${task.ui.retries} toolCalls=${task.ui.toolCalls}`);
    if (task.webmcp) lines.push(`  WebMCP: success=${task.webmcp.success} interactions=${task.webmcp.interactions} retries=${task.webmcp.retries} toolCalls=${task.webmcp.toolCalls}`);
    if (task.comparison) lines.push(`  Delta:  interactions=${task.comparison.interactionDelta >= 0 ? '+' : ''}${task.comparison.interactionDelta}, retries=${task.comparison.retryDelta >= 0 ? '+' : ''}${task.comparison.retryDelta}${task.comparison.durationDeltaMs == null ? '' : `, durationMs=${task.comparison.durationDeltaMs >= 0 ? '+' : ''}${task.comparison.durationDeltaMs}`}`);
  }
  lines.push('', result.interpretation);
  for (const warning of result.warnings) lines.push(`WARN ${warning}`);
  return lines.join('\n');
}
