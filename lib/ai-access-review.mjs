import { robotsPathAccess, analyzeTechnicalIntegrityFromPages } from './technical-integrity.mjs';

const roles = [
  ['google-search', 'Googlebot', 'search'], ['google-training', 'Google-Extended', 'non-search-ai-uses'],
  ['bing-search', 'bingbot', 'search'], ['openai-search', 'OAI-SearchBot', 'search'], ['openai-training', 'GPTBot', 'training']
];
export function reviewAiAccess({ url, site = new URL('/', url).href, html, robots, ownerControls = null }) {
  const observedAt = html?.observedAt || null;
  const policyReadable = robots?.ok === true && typeof robots.text === 'string';
  const policy = roles.map(([id, userAgent, purpose]) => ({ id, userAgent, purpose,
    observedAt: robots?.observedAt || null,
    ...(policyReadable ? robotsPathAccess(robots.text, userAgent, url) : { status: 'unknown', reason: 'No readable robots policy captured.' })
  }));
  const report = analyzeTechnicalIntegrityFromPages({ canonicalUrl: url, pages: [{ requestedUrl: url, url: html?.canonicalBaseUrl || html?.url || url,
    ok: html?.ok === true, status: html?.status ?? null, contentType: html?.contentType || null,
    html: html?.text ?? null, headers: html?.headers || {}, bytes: html?.bytes ?? null }], robots: { ...robots, text: robots?.text || '' } });
  const page = report.pages[0];
  let googleGenerativeAi = { state: 'unknown', value: null, effectiveValue: null, observedAt: null,
    reason: 'Search Console inclusion and inheritance cannot be inferred from public HTML, robots.txt or Google-Extended.' };
  if (ownerControls) {
    if (ownerControls.version !== '0.1' || ownerControls.site !== site) throw Error('Owner controls must match the exact site and version.');
    const c = ownerControls.googleSearchGenerativeAi;
    if (c && c.value !== 'unknown') {
      if (!['include', 'exclude', 'inherit'].includes(c.value) || !['include', 'exclude', null].includes(c.effectiveValue ?? null)
        || !Number.isFinite(Date.parse(c.observedAt)) || !/^[a-f0-9]{64}$/.test(c.evidenceSha256 || '')
        || c.source !== 'owner-observation') throw Error('Owner control needs a dated owner observation, evidence SHA-256 and valid values.');
      if (c.value !== 'inherit' && c.effectiveValue && c.value !== c.effectiveValue) throw Error('Explicit and effective owner choices conflict.');
      googleGenerativeAi = { state: 'owner-reported', value: c.value, effectiveValue: c.value === 'inherit' ? c.effectiveValue ?? null : c.value,
        observedAt: c.observedAt, evidenceSha256: c.evidenceSha256, authenticatedByGoose: false };
    }
  }
  return { version: '0.1', kind: 'ai-access-review', url, observedAt,
    ordinaryHttp: { state: html?.ok ? 'accessible-to-audit-client' : 'unknown', status: html?.status ?? null, observedUrl: html?.url ?? null, actualProviderVisitVerified: false },
    crawlerPolicies: policy, userInitiatedAccess: { userAgent: 'ChatGPT-User', state: 'not-established', robotsPolicyIsNotAuthorization: true },
    pageDirectives: { genericNoindex: html?.ok && page.isHtml ? page.genericNoindex : null, googleNoindex: html?.ok && page.isHtml ? page.noindex : null,
      genericDirectives: page.genericDirectives || [], googleDirectives: page.googleDirectives || [], bingDirectives: page.bingDirectives || [] },
    googleGenerativeAi, contentUseDeclarations: { contentSignal: html?.headers?.contentSignal || null, contentUsage: html?.headers?.contentUsage || null,
      meaning: 'Observed declarations only; no universal consumer support or rights grant inferred.' },
    guardrails: { noSettingsMutation: true, noTrainingPreferenceChosen: true, noIndexingOrCitationClaim: true, ordinaryGetIsNotBotVerification: true } };
}
