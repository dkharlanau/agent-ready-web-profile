import { fetchPublicText } from './public-fetch.mjs';

export const AGENT_ACCESSIBILITY_VERSION = '0.1';
const OPENAI_PUBLISHER_FAQ = 'https://help.openai.com/en/articles/12627856-publishers-and-developers-faq';
const STATEFUL_ROLES = new Map([
  ['checkbox', 'aria-checked'],
  ['radio', 'aria-checked'],
  ['switch', 'aria-checked'],
  ['tab', 'aria-selected']
]);

const norm = value => String(value || '').replace(/\s+/g, ' ').trim();

function attrs(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function normalizedPageUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function bodyScope(html) {
  const input = String(html || '');
  return input.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? input;
}

function visibleText(html) {
  return norm(String(html || '')
    .replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&'));
}

function labelEvidence(html) {
  const labelledIds = new Set();
  const wrappedTags = new Set();
  let match;
  const labelRe = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
  while ((match = labelRe.exec(html))) {
    const a = attrs(`<label ${match[1]}>`);
    if (a.for) labelledIds.add(a.for);
    for (const control of match[2].match(/<(?:input|select|textarea)\b[^>]*>/gi) ?? []) wrappedTags.add(norm(control).toLowerCase());
  }
  return { labelledIds, wrappedTags };
}

function hasName(tag, inner, labels, kind) {
  const a = attrs(tag);
  if (norm(a['aria-label']) || norm(a['aria-labelledby'])) return true;
  if (a.id && labels.labelledIds.has(a.id)) return true;
  if (labels.wrappedTags.has(norm(tag).toLowerCase())) return true;
  if (kind === 'input') {
    const type = String(a.type || 'text').toLowerCase();
    if (['submit', 'reset', 'button'].includes(type) && norm(a.value)) return true;
  }
  if (['button', 'a'].includes(kind) && visibleText(inner)) return true;
  if (['button', 'a'].includes(kind) && /<img\b[^>]*\balt\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)/i.test(String(inner || ''))) return true;
  return false;
}

function pageSignals(page) {
  const url = normalizedPageUrl(page.url);
  if (!url) return null;
  const html = bodyScope(page.html);
  const labels = labelEvidence(html);
  const controls = [];
  let match;

  const paired = /<(button|a|select|textarea)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((match = paired.exec(html))) {
    const kind = match[1].toLowerCase();
    const tag = `<${kind} ${match[2]}>`;
    const a = attrs(tag);
    if (kind === 'a' && !a.href && !a.role) continue;
    controls.push({ kind, tag, attrs: a, named: hasName(tag, match[3], labels, kind) });
  }

  const inputRe = /<input\b[^>]*>/gi;
  while ((match = inputRe.exec(html))) {
    const tag = match[0];
    const a = attrs(tag);
    if (String(a.type || '').toLowerCase() === 'hidden') continue;
    controls.push({ kind: 'input', tag, attrs: a, named: hasName(tag, '', labels, 'input') });
  }

  const customRoles = [];
  for (const tag of html.match(/<[A-Za-z][^>]*\brole\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const role = norm(a.role).toLowerCase();
    if (!role) continue;
    const expectedState = STATEFUL_ROLES.get(role) || null;
    customRoles.push({ role, expectedState, stateObserved: expectedState ? expectedState in a : null, named: Boolean(norm(a['aria-label']) || norm(a['aria-labelledby'])) });
  }

  const clickTargets = [];
  for (const tag of html.match(/<(?:div|span)\b[^>]*\bonclick\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    if (!a.role) clickTargets.push(tag);
  }

  return {
    url,
    controls: controls.length,
    unnamedControls: controls.filter(control => !control.named).length,
    customRoleControls: customRoles.length,
    statefulRoleControls: customRoles.filter(control => control.expectedState).length,
    statefulRolesMissingState: customRoles.filter(control => control.expectedState && !control.stateObserved).length,
    nonSemanticClickTargets: clickTargets.length
  };
}

function action(id, priority, lane, title, reason, page, verification) {
  return {
    id,
    priority,
    lane,
    title,
    reason,
    evidenceClass: 'manual-review',
    evidence: [page.url],
    target: { url: page.url },
    proposal: null,
    verification,
    measurement: [
      'Re-run the bounded static review and perform keyboard/screen-reader/browser-agent runtime checks on the affected interaction path.',
      'Treat improved agent task completion as runtime evidence only; this is not a Search ranking signal.'
    ],
    sourceCheck: OPENAI_PUBLISHER_FAQ
  };
}

export function analyzeAgentAccessibilityPages(inputPages) {
  if (!Array.isArray(inputPages) || !inputPages.length) throw new Error('pages must be a non-empty array.');
  const pages = inputPages.map(pageSignals).filter(Boolean);
  const actions = [];
  for (const page of pages) {
    if (page.controls >= 2 && page.unnamedControls > 0) {
      actions.push(action(
        `agent-accessibility:control-names:${page.url}`,
        'P1',
        'agent-accessibility',
        'Review interactive controls without an observable accessible name',
        `${page.unnamedControls}/${page.controls} bounded native/link controls did not expose a visible name, aria-label/aria-labelledby, associated label, submit value or image alt in the fetched HTML. Runtime rendering can change this result, so treat it as a review trigger rather than a compliance failure.`,
        page,
        [
          'Prefer semantic native HTML and visible labels; use ARIA only where native semantics are insufficient.',
          'Verify the rendered control names and roles with accessibility tooling and a browser-agent task, not static HTML alone.'
        ]
      ));
    }
    if (page.statefulRoleControls > 0 && page.statefulRolesMissingState > 0) {
      actions.push(action(
        `agent-accessibility:role-state:${page.url}`,
        'P2',
        'agent-state-semantics',
        'Review custom stateful ARIA roles whose state is not observable',
        `${page.statefulRolesMissingState}/${page.statefulRoleControls} bounded custom checkbox/radio/switch/tab roles lacked the corresponding aria-checked or aria-selected state in fetched HTML. State may be supplied at runtime; verify the rendered interaction model.`,
        page,
        [
          'Verify each custom stateful widget exposes the correct role, name and current state after rendering.',
          'Prefer a native control when it can express the same interaction correctly.'
        ]
      ));
    }
    if (page.nonSemanticClickTargets > 0) {
      actions.push(action(
        `agent-accessibility:click-targets:${page.url}`,
        'P2',
        'agent-native-semantics',
        'Review clickable div/span targets without an observable role',
        `${page.nonSemanticClickTargets} div/span element(s) with inline click handlers were observed without a role. This heuristic does not cover framework-bound events, but it can reveal custom controls that are harder for assistive technology and browser agents to interpret.`,
        page,
        [
          'Replace custom click targets with native button/link controls when appropriate, or expose accurate role/name/state semantics where a custom widget is necessary.',
          'Verify keyboard operation and rendered browser-agent interaction after the change.'
        ]
      ));
    }
  }
  return {
    version: AGENT_ACCESSIBILITY_VERSION,
    scope: 'bounded-static-interactive-semantics-review-not-wcag-or-agent-runtime-certification',
    pages: pages.map(page => ({
      url: page.url,
      controls: page.controls,
      unnamedControls: page.unnamedControls,
      customRoleControls: page.customRoleControls,
      statefulRoleControls: page.statefulRoleControls,
      statefulRolesMissingState: page.statefulRolesMissingState,
      nonSemanticClickTargets: page.nonSemanticClickTargets
    })),
    actions,
    summary: {
      pagesObserved: pages.length,
      interactivePagesObserved: pages.filter(page => page.controls || page.customRoleControls || page.nonSemanticClickTargets).length,
      actions: actions.length,
      byLane: actions.reduce((acc, item) => (acc[item.lane] = (acc[item.lane] || 0) + 1, acc), {})
    },
    source: {
      openAiPublisherDeveloperFaq: OPENAI_PUBLISHER_FAQ,
      interpretation: 'OpenAI documents ARIA labels and roles for ChatGPT Agent in Atlas; ARWP uses static observations only to create runtime review gates.'
    },
    guardrails: {
      nativeHtmlPreferred: true,
      ariaDoesNotReplaceNativeSemantics: true,
      noWcagComplianceClaim: true,
      staticHtmlDoesNotProveRuntimeAccessibility: true,
      browserAgentRuntimeVerificationRequired: true,
      noSearchRankingSignalClaim: true
    }
  };
}

function scopeFor(input) {
  const url = new URL(input);
  url.hash = '';
  url.search = '';
  const pathPrefix = url.pathname.endsWith('/') ? url.pathname : (url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) || '/');
  return { origin: url.origin, pathPrefix };
}

function resolve(value, base) {
  if (!value) return null;
  try { return new URL(value, base).href; } catch { return null; }
}

function pageLinks(html, base) {
  const out = [];
  let match;
  const re = /<a\b([^>]*)>/gi;
  while ((match = re.exec(String(html || '')))) {
    const a = attrs(`<a ${match[1]}>`);
    const url = normalizedPageUrl(resolve(a.href, base));
    if (url) out.push(url);
  }
  return out;
}

export async function analyzeAgentAccessibilitySite(input, { timeoutMs = 8000, maxBytes = 256 * 1024, maxPages = 6, fetchImpl = fetch, resolveImpl } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw new Error('maxPages must be an integer between 1 and 20.');
  const start = new URL(input);
  if (start.protocol !== 'https:') throw new Error('Agent accessibility analysis requires a public HTTPS URL.');
  const scope = scopeFor(start.href);
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const home = await fetchPublicText(start.href, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-agent-accessibility/0.1' });
  if (!home.ok || !home.text) throw new Error(`Unable to fetch start page: HTTP ${home.status ?? 'unknown'}`);
  const candidates = new Set([normalizedPageUrl(home.url || start.href)]);
  for (const value of pageLinks(home.text, home.url || start.href)) {
    const target = new URL(value);
    if (target.origin === scope.origin && target.pathname.startsWith(scope.pathPrefix)) candidates.add(value);
  }
  const pages = [{ url: home.url || start.href, html: home.text, status: home.status }];
  for (const url of [...candidates].filter(Boolean).sort()) {
    if (pages.length >= maxPages) break;
    if (normalizedPageUrl(url) === normalizedPageUrl(home.url || start.href)) continue;
    const response = await fetchPublicText(url, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-agent-accessibility/0.1' }).catch(() => null);
    if (response?.ok && response.text && /html|xhtml/i.test(String(response.contentType || 'text/html'))) pages.push({ url: response.url || url, html: response.text, status: response.status });
  }
  const report = analyzeAgentAccessibilityPages(pages);
  report.canonicalUrl = normalizedPageUrl(home.url || start.href);
  report.discovery = { startUrl: input, candidates: candidates.size, maxPages, maxBytesPerPage: maxBytes, timeoutMs };
  return report;
}
