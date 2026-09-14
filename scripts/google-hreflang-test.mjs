import assert from 'node:assert/strict';
import { inspectGoogleHreflang } from '../lib/google-hreflang.mjs';

const shouldPass = ['en', 'en-US', 'pt-BR', 'de-ES', 'zh-Hant', 'zh-Hans-US', 'x-default'];
for (const code of shouldPass) {
  const result = inspectGoogleHreflang(code);
  assert.equal(result.googleHreflangEligible, true, `${code} should be Google hreflang eligible: ${JSON.stringify(result)}`);
}

const cases = [
  ['es-419', true, 'region-not-iso-3166-1-alpha2'],
  ['en-001', true, 'region-not-iso-3166-1-alpha2'],
  ['US', true, 'language-not-iso-639-1'],
  ['zz-US', true, 'language-not-iso-639-1'],
  ['en-US-u-ca-gregory', true, 'unsupported-google-hreflang-subtag'],
  ['not_a_locale', false, 'invalid-bcp47']
];

for (const [code, genericLocaleValid, reason] of cases) {
  const result = inspectGoogleHreflang(code);
  assert.equal(result.genericLocaleValid, genericLocaleValid, `${code}: generic locale validity`);
  assert.equal(result.googleHreflangEligible, false, `${code}: must not silently pass the Google-specific validator`);
  assert.equal(result.reason, reason, `${code}: reason`);
}

console.log('Google hreflang eligibility tests passed, including BCP-47-valid/Search-ineligible fault cases.');
