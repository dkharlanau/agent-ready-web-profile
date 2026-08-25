export function normalize(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '');
}

function collectScalars(value, out, depth = 0) {
  if (depth > 5 || value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) collectScalars(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value).slice(0, 100)) {
      if (/^(embedding|vector|binary|bytes|image)$/i.test(key)) continue;
      collectScalars(child, out, depth + 1);
    }
  }
}

export function searchableText(record) {
  const values = [];
  collectScalars(record, values);
  return normalize(values.join(' '));
}

export function recordId(record) {
  return record?.canonical_id
    ?? record?.canonicalId
    ?? record?.record_id
    ?? record?.recordId
    ?? record?.id
    ?? record?.slug
    ?? record?.url
    ?? null;
}

export function recordTitle(record) {
  return record?.title
    ?? record?.name
    ?? record?.label
    ?? record?.heading
    ?? recordId(record)
    ?? 'Untitled record';
}

export function recordUrl(record) {
  return record?.canonical_url
    ?? record?.canonicalUrl
    ?? record?.url
    ?? null;
}

export function recordSummary(record) {
  const candidate = record?.summary
    ?? record?.description
    ?? record?.excerpt
    ?? record?.text
    ?? record?.content_text
    ?? record?.content_html
    ?? record?.content
    ?? '';
  const text = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

export function parseIndexText(text, format = 'json') {
  const normalizedFormat = String(format || 'json').toLowerCase();

  if (normalizedFormat === 'jsonl' || normalizedFormat === 'ndjson') {
    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`Invalid ${normalizedFormat.toUpperCase()} at line ${index + 1}: ${error.message}`);
        }
      });
  }

  if (normalizedFormat !== 'json') {
    throw new Error(`Unsupported retrieval index format: ${format}`);
  }

  const payload = JSON.parse(text);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [payload];
}

function queryTerms(query) {
  return normalize(query)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1);
}

export function searchRecords(records, query, limit = 5) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const phrase = normalize(query).trim();

  return records
    .map(record => {
      const haystack = searchableText(record);
      let score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      if (phrase.length > 3 && haystack.includes(phrase)) score += 3;
      if (!score) return null;
      return {
        id: recordId(record),
        title: recordTitle(record),
        url: recordUrl(record),
        summary: recordSummary(record),
        score
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 20)));
}

export function findRecord(records, id) {
  const wanted = normalize(id);
  return records.find(record => {
    const candidates = [
      recordId(record),
      record?.canonical_id,
      record?.canonicalId,
      record?.id,
      record?.slug,
      record?.url,
      ...(Array.isArray(record?.aliases) ? record.aliases : [])
    ].filter(Boolean);
    return candidates.some(candidate => normalize(candidate) === wanted);
  }) ?? null;
}
