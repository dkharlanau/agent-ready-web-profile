import { canonicalJson, verifyEvidenceReceipt } from './evidence-receipt.mjs';

export const ASSERTION_CONTRACT_VERSION = '0.1';
export const ASSERTION_INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];
const CHANGE_ACTIONS = new Set(['ignore', 'warn', 'fail']);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function asList(value) {
  if (value == null) return null;
  return Array.isArray(value) ? value : [value];
}

function matchesAllowed(actual, expected) {
  const values = asList(expected);
  if (!values) return true;
  return values.includes(actual);
}

function conflictFingerprint(conflict) {
  return canonicalJson({
    kind: conflict?.kind || null,
    capability: conflict?.capability || null,
    severity: conflict?.severity || null,
    message: conflict?.message || null,
    sources: Array.isArray(conflict?.sources) ? [...conflict.sources].sort() : []
  });
}

function interfaceSummary(item) {
  if (!item) return null;
  return {
    url: item.url || null,
    protocol: item.protocol || null,
    kind: item.kind || null,
    sourceId: item.sourceId || null,
    sourceAuthority: item.sourceAuthority || null,
    discoveryScope: item.discoveryScope || null
  };
}

function check(id, passed, { intent = null, expected = null, actual = null, message = null, severity = 'error' } = {}) {
  return { id, passed, intent, expected, actual, severity, message: message || (passed ? 'Condition satisfied.' : 'Condition failed.') };
}

export function validateAssertionContract(contract) {
  const issues = [];
  if (!object(contract)) return { valid: false, issues: ['Contract must be an object.'] };
  if (contract.contractVersion !== ASSERTION_CONTRACT_VERSION) issues.push(`contractVersion must be ${ASSERTION_CONTRACT_VERSION}.`);
  if (typeof contract.target !== 'string' || !contract.target.trim()) issues.push('target is required.');
  if (!object(contract.expect)) issues.push('expect must be an object.');
  else {
    for (const [intent, rule] of Object.entries(contract.expect)) {
      if (!ASSERTION_INTENTS.includes(intent)) {
        issues.push(`Unsupported intent in expect: ${intent}.`);
        continue;
      }
      if (!object(rule)) {
        issues.push(`expect.${intent} must be an object.`);
        continue;
      }
      if (rule.required === true && rule.forbidden === true) issues.push(`expect.${intent} cannot be both required and forbidden.`);
      for (const key of ['protocol', 'kind', 'sourceAuthority', 'outcome']) {
        if (rule[key] != null) {
          const values = asList(rule[key]);
          if (!values.length || values.some(value => typeof value !== 'string' || !value)) issues.push(`expect.${intent}.${key} must be a non-empty string or array of strings.`);
        }
      }
      if (rule.url != null && (typeof rule.url !== 'string' || !rule.url)) issues.push(`expect.${intent}.url must be a non-empty string.`);
      if (rule.urlPrefix != null && (typeof rule.urlPrefix !== 'string' || !rule.urlPrefix)) issues.push(`expect.${intent}.urlPrefix must be a non-empty string.`);
      if (rule.maxRejected != null && (!Number.isInteger(rule.maxRejected) || rule.maxRejected < 0)) issues.push(`expect.${intent}.maxRejected must be a non-negative integer.`);
    }
  }
  if (contract.maxConflicts != null && (!Number.isInteger(contract.maxConflicts) || contract.maxConflicts < 0)) issues.push('maxConflicts must be a non-negative integer.');
  if (contract.forbidConflictKinds != null && (!Array.isArray(contract.forbidConflictKinds) || contract.forbidConflictKinds.some(value => typeof value !== 'string' || !value))) issues.push('forbidConflictKinds must be an array of non-empty strings.');
  if (contract.requiredSourceAuthorities != null && (!Array.isArray(contract.requiredSourceAuthorities) || contract.requiredSourceAuthorities.some(value => typeof value !== 'string' || !value))) issues.push('requiredSourceAuthorities must be an array of non-empty strings.');
  if (contract.canonicalUrl != null && (typeof contract.canonicalUrl !== 'string' || !contract.canonicalUrl)) issues.push('canonicalUrl must be a non-empty string.');
  if (contract.changePolicy != null) {
    if (!object(contract.changePolicy)) issues.push('changePolicy must be an object.');
    else for (const key of ['selectedInterface', 'selectedProtocol', 'planOutcome', 'newConflicts']) {
      if (contract.changePolicy[key] != null && !CHANGE_ACTIONS.has(contract.changePolicy[key])) issues.push(`changePolicy.${key} must be ignore, warn or fail.`);
    }
  }
  return { valid: issues.length === 0, issues };
}

function evaluateIntent(intent, rule, plan) {
  const checks = [];
  const selected = plan?.selected || null;
  const outcome = plan?.outcome || (selected ? 'selected' : 'none');
  const summary = interfaceSummary(selected);

  if (rule.required === true) checks.push(check(`intent.${intent}.required`, Boolean(selected), {
    intent, expected: true, actual: Boolean(selected), message: selected ? `${intent} selected an interface.` : `${intent} is required but no interface was selected.`
  }));
  if (rule.forbidden === true) checks.push(check(`intent.${intent}.forbidden`, !selected, {
    intent, expected: 'no selected interface', actual: summary, message: selected ? `${intent} is forbidden but selected ${selected.url || selected.protocol || selected.kind}.` : `${intent} has no selected interface.`
  }));

  const shouldCheckSelection = Boolean(selected);
  if (rule.protocol != null && shouldCheckSelection) checks.push(check(`intent.${intent}.protocol`, matchesAllowed(selected.protocol || null, rule.protocol), {
    intent, expected: rule.protocol, actual: selected.protocol || null, message: `Selected protocol is ${selected.protocol || 'none'}.`
  }));
  if (rule.kind != null && shouldCheckSelection) checks.push(check(`intent.${intent}.kind`, matchesAllowed(selected.kind || null, rule.kind), {
    intent, expected: rule.kind, actual: selected.kind || null, message: `Selected kind is ${selected.kind || 'none'}.`
  }));
  if (rule.sourceAuthority != null && shouldCheckSelection) checks.push(check(`intent.${intent}.sourceAuthority`, matchesAllowed(selected.sourceAuthority || null, rule.sourceAuthority), {
    intent, expected: rule.sourceAuthority, actual: selected.sourceAuthority || null, message: `Selected source authority is ${selected.sourceAuthority || 'none'}.`
  }));
  if (rule.url != null && shouldCheckSelection) checks.push(check(`intent.${intent}.url`, selected.url === rule.url, {
    intent, expected: rule.url, actual: selected.url || null, message: `Selected URL is ${selected.url || 'none'}.`
  }));
  if (rule.urlPrefix != null && shouldCheckSelection) checks.push(check(`intent.${intent}.urlPrefix`, typeof selected.url === 'string' && selected.url.startsWith(rule.urlPrefix), {
    intent, expected: `${rule.urlPrefix}*`, actual: selected.url || null, message: `Selected URL is ${selected.url || 'none'}.`
  }));
  if (rule.outcome != null) checks.push(check(`intent.${intent}.outcome`, matchesAllowed(outcome, rule.outcome), {
    intent, expected: rule.outcome, actual: outcome, message: `Plan outcome is ${outcome}.`
  }));
  if (rule.maxRejected != null) {
    const rejected = Array.isArray(plan?.rejected) ? plan.rejected.length : 0;
    checks.push(check(`intent.${intent}.maxRejected`, rejected <= rule.maxRejected, {
      intent, expected: `<= ${rule.maxRejected}`, actual: rejected, message: `${intent} has ${rejected} rejected candidate(s).`
    }));
  }

  if (!selected && rule.required !== true && rule.forbidden !== true && [rule.protocol, rule.kind, rule.sourceAuthority, rule.url, rule.urlPrefix].some(value => value != null)) {
    checks.push(check(`intent.${intent}.selectionConstraints`, true, {
      intent,
      expected: 'constraints apply only when optional intent selects an interface',
      actual: null,
      severity: 'info',
      message: `${intent} is optional and selected no interface; selection-specific constraints were not evaluated.`
    }));
  }
  return checks;
}

function compareBaseline(contract, resolution, baselineReceipt) {
  const checks = [];
  if (!baselineReceipt) return checks;
  const verification = verifyEvidenceReceipt(baselineReceipt);
  if (!verification.valid) {
    checks.push(check('baseline.receiptIntegrity', false, { expected: 'valid receipt', actual: verification.issues, message: 'Baseline receipt failed integrity verification.' }));
    return checks;
  }
  const policy = {
    selectedInterface: contract.changePolicy?.selectedInterface || 'ignore',
    selectedProtocol: contract.changePolicy?.selectedProtocol || 'ignore',
    planOutcome: contract.changePolicy?.planOutcome || 'ignore',
    newConflicts: contract.changePolicy?.newConflicts || 'ignore'
  };
  const addChange = (id, changed, action, meta) => {
    if (action === 'ignore') return;
    checks.push(check(id, !changed || action === 'warn', {
      ...meta,
      severity: changed && action === 'warn' ? 'warning' : 'error',
      message: changed ? meta.message : 'No prohibited change observed.'
    }));
  };
  for (const intent of ASSERTION_INTENTS) {
    const before = baselineReceipt.plans?.[intent] || {};
    const after = resolution.plans?.[intent] || {};
    const beforeSelected = before.selected || null;
    const afterSelected = after.selected || null;
    const beforeUrl = beforeSelected?.url || null;
    const afterUrl = afterSelected?.url || null;
    addChange(`change.${intent}.selectedInterface`, beforeUrl !== afterUrl, policy.selectedInterface, {
      intent, expected: beforeUrl, actual: afterUrl, message: `${intent} selected interface changed from ${beforeUrl || 'none'} to ${afterUrl || 'none'}.`
    });
    const beforeProtocol = beforeSelected?.protocol || null;
    const afterProtocol = afterSelected?.protocol || null;
    addChange(`change.${intent}.selectedProtocol`, beforeProtocol !== afterProtocol, policy.selectedProtocol, {
      intent, expected: beforeProtocol, actual: afterProtocol, message: `${intent} selected protocol changed from ${beforeProtocol || 'none'} to ${afterProtocol || 'none'}.`
    });
    const beforeOutcome = before.outcome || (beforeSelected ? 'selected' : 'none');
    const afterOutcome = after.outcome || (afterSelected ? 'selected' : 'none');
    addChange(`change.${intent}.planOutcome`, beforeOutcome !== afterOutcome, policy.planOutcome, {
      intent, expected: beforeOutcome, actual: afterOutcome, message: `${intent} plan outcome changed from ${beforeOutcome} to ${afterOutcome}.`
    });
  }
  if (policy.newConflicts !== 'ignore') {
    const before = new Set((baselineReceipt.conflicts || []).map(conflictFingerprint));
    const newConflicts = (resolution.conflicts || []).filter(item => !before.has(conflictFingerprint(item)));
    checks.push(check('change.newConflicts', newConflicts.length === 0 || policy.newConflicts === 'warn', {
      expected: 'no new conflicts', actual: newConflicts, severity: newConflicts.length && policy.newConflicts === 'warn' ? 'warning' : 'error',
      message: newConflicts.length ? `${newConflicts.length} conflict(s) were not present in the baseline receipt.` : 'No new conflicts observed.'
    }));
  }
  return checks;
}

export function evaluateAssertionContract(contract, resolution, { baselineReceipt = null } = {}) {
  const validation = validateAssertionContract(contract);
  if (!validation.valid) return { valid: false, contractValid: false, passed: false, issues: validation.issues, checks: [], failures: [], warnings: [] };
  if (!object(resolution)) throw new Error('A Resolver resolution is required.');
  const checks = [];
  if (contract.canonicalUrl != null) checks.push(check('canonicalUrl', resolution.canonicalUrl === contract.canonicalUrl, {
    expected: contract.canonicalUrl, actual: resolution.canonicalUrl || null, message: `Resolved canonical URL is ${resolution.canonicalUrl || 'none'}.`
  }));
  for (const [intent, rule] of Object.entries(contract.expect || {})) checks.push(...evaluateIntent(intent, rule, resolution.plans?.[intent]));

  const conflicts = Array.isArray(resolution.conflicts) ? resolution.conflicts : [];
  if (contract.maxConflicts != null) checks.push(check('conflicts.max', conflicts.length <= contract.maxConflicts, {
    expected: `<= ${contract.maxConflicts}`, actual: conflicts.length, message: `Resolution has ${conflicts.length} conflict(s).`
  }));
  for (const kind of contract.forbidConflictKinds || []) {
    const matches = conflicts.filter(item => item?.kind === kind);
    checks.push(check(`conflicts.forbid.${kind}`, matches.length === 0, {
      expected: `no ${kind}`, actual: matches, message: matches.length ? `${matches.length} forbidden ${kind} conflict(s) observed.` : `No ${kind} conflicts observed.`
    }));
  }
  const authorities = new Set((resolution.sources || []).map(item => item?.authority).filter(Boolean));
  for (const authority of contract.requiredSourceAuthorities || []) checks.push(check(`sources.authority.${authority}`, authorities.has(authority), {
    expected: authority, actual: [...authorities].sort(), message: authorities.has(authority) ? `Required source authority ${authority} observed.` : `Required source authority ${authority} was not observed.`
  }));

  checks.push(...compareBaseline(contract, resolution, baselineReceipt));
  const failures = checks.filter(item => item.severity === 'error' && !item.passed);
  const warnings = checks.filter(item => item.severity === 'warning');
  return {
    valid: true,
    contractValid: true,
    passed: failures.length === 0,
    target: contract.target,
    canonicalUrl: resolution.canonicalUrl || null,
    checks,
    failures,
    warnings,
    summary: {
      checks: checks.length,
      passedChecks: checks.filter(item => item.passed).length,
      failures: failures.length,
      warnings: warnings.length,
      conflicts: conflicts.length
    },
    note: 'ARWP assertion contracts test declared interface expectations. They are not readiness scores and do not execute discovered tools/APIs/agents.'
  };
}
