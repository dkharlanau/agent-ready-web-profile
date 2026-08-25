import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { fetchPublicJson } from './public-fetch.mjs';

const REQUIRED_CARD_FIELDS = ['name', 'description', 'supportedInterfaces', 'version', 'capabilities', 'defaultInputModes', 'defaultOutputModes', 'skills'];
const REQUIRED_ARRAY_PATHS = new Set([
  '/supportedInterfaces',
  '/defaultInputModes',
  '/defaultOutputModes',
  '/skills'
]);

function b64urlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function b64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function pathFor(parent, key) {
  return `${parent}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

function isRequiredArrayPath(path) {
  if (REQUIRED_ARRAY_PATHS.has(path)) return true;
  return /^\/skills\/\d+\/tags$/.test(path);
}

function normalizePresence(value, path = '') {
  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => normalizePresence(item, `${path}/${index}`)).filter(item => item !== undefined);
    if (!normalized.length && !isRequiredArrayPath(path)) return undefined;
    return normalized;
  }
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value)) {
      if (path === '' && key === 'signatures') continue;
      const normalized = normalizePresence(value[key], pathFor(path, key));
      if (normalized !== undefined) output[key] = normalized;
    }
    const keys = Object.keys(output);
    if (!keys.length && path && path !== '/capabilities') return undefined;
    return output;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('A2A Agent Card contains a non-finite number and cannot be canonicalized.');
  if (value === undefined) return undefined;
  return value;
}

function jcs(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`;
}

export function validateA2aAgentCardV1(card) {
  const issues = [];
  if (!card || typeof card !== 'object' || Array.isArray(card)) return { valid: false, issues: ['Agent Card must be a JSON object.'] };
  for (const field of REQUIRED_CARD_FIELDS) if (!(field in card)) issues.push(`Required Agent Card field is missing: ${field}`);
  if (!Array.isArray(card.supportedInterfaces) || !card.supportedInterfaces.length) issues.push('supportedInterfaces must contain at least one interface.');
  else for (const [index, item] of card.supportedInterfaces.entries()) {
    for (const field of ['url', 'protocolBinding', 'protocolVersion']) if (!item?.[field]) issues.push(`supportedInterfaces[${index}].${field} is required.`);
  }
  if (!Array.isArray(card.defaultInputModes) || !card.defaultInputModes.length) issues.push('defaultInputModes must contain at least one media type.');
  if (!Array.isArray(card.defaultOutputModes) || !card.defaultOutputModes.length) issues.push('defaultOutputModes must contain at least one media type.');
  if (!Array.isArray(card.skills)) issues.push('skills must be an array.');
  else for (const [index, skill] of card.skills.entries()) {
    for (const field of ['id', 'name', 'description']) if (!skill?.[field]) issues.push(`skills[${index}].${field} is required.`);
    if (!Array.isArray(skill?.tags) || !skill.tags.length) issues.push(`skills[${index}].tags must contain at least one tag.`);
  }
  if (!card.capabilities || typeof card.capabilities !== 'object' || Array.isArray(card.capabilities)) issues.push('capabilities must be an object.');
  return { valid: issues.length === 0, issues };
}

export function canonicalizeA2aAgentCard(card) {
  const normalized = normalizePresence(card, '');
  return jcs(normalized);
}

function parseProtected(signature) {
  if (!signature?.protected || !signature?.signature) throw new Error('A2A signature requires protected and signature values.');
  let protectedHeader;
  try { protectedHeader = JSON.parse(b64urlDecode(signature.protected).toString('utf8')); }
  catch { throw new Error('A2A protected JWS header is not valid base64url JSON.'); }
  const unprotected = signature.header && typeof signature.header === 'object' ? signature.header : {};
  for (const key of Object.keys(protectedHeader)) if (key in unprotected) throw new Error(`JWS header parameter appears in both protected and unprotected headers: ${key}`);
  return { protectedHeader, header: { ...unprotected, ...protectedHeader } };
}

function supportedAlgorithm(alg) {
  return alg === 'RS256' || alg === 'ES256';
}

function verifyWithJwk({ alg, jwk, signingInput, signature }) {
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const bytes = b64urlDecode(signature);
  if (alg === 'RS256') return cryptoVerify('RSA-SHA256', Buffer.from(signingInput, 'ascii'), key, bytes);
  if (alg === 'ES256') return cryptoVerify('sha256', Buffer.from(signingInput, 'ascii'), { key, dsaEncoding: 'ieee-p1363' }, bytes);
  return false;
}

async function fetchJwks(url, options) {
  const fetched = await fetchPublicJson(url, {
    fetchImpl: options.fetchImpl,
    resolveImpl: options.resolveImpl,
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes,
    metrics: options.metrics,
    accept: 'application/jwk-set+json, application/json;q=0.9, */*;q=0.1'
  });
  if (!fetched.ok) throw new Error(`JWKS fetch failed with HTTP ${fetched.status}.`);
  if (!Array.isArray(fetched.json?.keys)) throw new Error('JWKS response does not contain a keys array.');
  return { url: fetched.url, keys: fetched.json.keys };
}

export async function verifyA2aAgentCardSignatures(card, {
  fetchImpl = fetch,
  resolveImpl,
  timeoutMs = 8000,
  maxBytes = 256 * 1024,
  maxSignatures = 4
} = {}) {
  const shape = validateA2aAgentCardV1(card);
  const signatures = Array.isArray(card?.signatures) ? card.signatures : [];
  if (!signatures.length) return {
    status: shape.valid ? 'unsigned' : 'invalid-card',
    shape,
    signatures: [],
    verified: 0,
    policy: 'Unsigned A2A Agent Cards are allowed by the protocol and are not treated as invalid merely because no signature is present.'
  };
  if (!shape.valid) return { status: 'invalid-card', shape, signatures: [], verified: 0 };

  const canonical = canonicalizeA2aAgentCard(card);
  const payload = b64urlEncode(Buffer.from(canonical, 'utf8'));
  const results = [];
  const jwksCache = new Map();
  const metrics = { requests: 0, bytes: 0 };

  for (const signature of signatures.slice(0, maxSignatures)) {
    let parsed;
    try { parsed = parseProtected(signature); }
    catch (error) {
      results.push({ status: 'signature-invalid', error: String(error?.message || error) });
      continue;
    }
    const { header } = parsed;
    if (!supportedAlgorithm(header.alg)) {
      results.push({ status: 'unsupported-algorithm', alg: header.alg || null, kid: header.kid || null });
      continue;
    }
    if (!header.kid) {
      results.push({ status: 'key-unavailable', alg: header.alg, error: 'Protected/unprotected JWS header has no kid.' });
      continue;
    }
    if (!header.jku) {
      results.push({ status: 'key-unavailable', alg: header.alg, kid: header.kid, error: 'No public HTTPS jku was declared; ARWP does not invent a trust store.' });
      continue;
    }

    let jwks;
    try {
      if (!jwksCache.has(header.jku)) jwksCache.set(header.jku, await fetchJwks(header.jku, { fetchImpl, resolveImpl, timeoutMs, maxBytes, metrics }));
      jwks = jwksCache.get(header.jku);
    } catch (error) {
      results.push({ status: 'key-unavailable', alg: header.alg, kid: header.kid, jku: header.jku, error: String(error?.message || error) });
      continue;
    }
    const jwk = jwks.keys.find(key => key?.kid === header.kid);
    if (!jwk) {
      results.push({ status: 'key-unavailable', alg: header.alg, kid: header.kid, jku: jwks.url, error: 'No JWKS key matched kid.' });
      continue;
    }

    const signingInput = `${signature.protected}.${payload}`;
    try {
      const verified = verifyWithJwk({ alg: header.alg, jwk, signingInput, signature: signature.signature });
      results.push({
        status: verified ? 'signature-verified' : 'signature-invalid',
        alg: header.alg,
        kid: header.kid,
        jku: jwks.url,
        typ: header.typ || null
      });
    } catch (error) {
      results.push({ status: 'signature-invalid', alg: header.alg, kid: header.kid, jku: jwks.url, error: String(error?.message || error) });
    }
  }

  const verified = results.filter(item => item.status === 'signature-verified').length;
  return {
    status: verified ? 'signature-verified' : results.some(item => item.status === 'signature-invalid') ? 'signature-invalid' : 'not-assessed',
    shape,
    verified,
    signatures: results,
    metrics,
    canonicalization: 'A2A field-presence normalization plus RFC 8785-style JCS. Cross-SDK fixtures remain a separate interoperability gate.'
  };
}

export async function verifyResolvedA2aSignatures(resolution, options = {}) {
  const source = (resolution?.sources || []).find(item => item.type === 'a2a-agent-card' && item.status === 'resolved' && item.url);
  if (!source) return { status: 'not-declared', signatures: [], verified: 0 };
  const fetched = await fetchPublicJson(source.url, {
    fetchImpl: options.fetchImpl || fetch,
    resolveImpl: options.resolveImpl,
    timeoutMs: options.timeoutMs || 8000,
    maxBytes: options.maxBytes || 256 * 1024,
    accept: 'application/json, */*;q=0.1'
  });
  if (!fetched.ok) return { status: 'card-unavailable', url: fetched.url, httpStatus: fetched.status, signatures: [], verified: 0 };
  const result = await verifyA2aAgentCardSignatures(fetched.json, options);
  return { ...result, url: fetched.url };
}
