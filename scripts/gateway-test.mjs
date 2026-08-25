import assert from 'node:assert/strict';
import { parseIndexText, searchRecords, findRecord, recordId } from '../gateway/lib.mjs';

const jsonRecords = parseIndexText(JSON.stringify({
  items: [
    {
      canonical_id: 'demo:topic:planning',
      title: 'Planning fallacy',
      summary: 'People often underestimate task duration.',
      url: 'https://example.com/planning-fallacy/'
    },
    {
      id: 'demo:topic:confirmation',
      title: 'Confirmation bias',
      summary: 'People may favor evidence that supports an existing belief.',
      aliases: ['confirmation-bias']
    }
  ]
}), 'json');

assert.equal(jsonRecords.length, 2);
assert.equal(recordId(jsonRecords[0]), 'demo:topic:planning');

const ndjsonRecords = parseIndexText([
  JSON.stringify({ id: 'one', title: 'One record' }),
  JSON.stringify({ id: 'two', title: 'Two record' })
].join('\n'), 'ndjson');
assert.equal(ndjsonRecords.length, 2);

const results = searchRecords(jsonRecords, 'planning duration', 5);
assert.equal(results.length, 1);
assert.equal(results[0].id, 'demo:topic:planning');
assert.ok(results[0].score >= 2);

assert.equal(findRecord(jsonRecords, 'confirmation-bias')?.id, 'demo:topic:confirmation');
assert.equal(findRecord(jsonRecords, 'missing'), null);

assert.throws(
  () => parseIndexText('x,y\n1,2', 'csv'),
  /Unsupported retrieval index format/
);

assert.throws(
  () => parseIndexText('{bad json}', 'ndjson'),
  /Invalid NDJSON at line 1/
);

console.log('PASS gateway parsers, lexical retrieval, aliases and failure handling');
