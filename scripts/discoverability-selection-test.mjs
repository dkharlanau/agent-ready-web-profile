import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the actual storage functions against synthetic controls and storage. No
// project, site, audience or user data is part of these fixtures.
const source = fs.readFileSync(new URL('../docs/discoverability.js', import.meta.url), 'utf8');
const start = source.indexOf('const picked = ');
const end = source.indexOf('function invalidateExport()', start);
assert.ok(start >= 0 && end > start, 'selection storage functions must remain testable');
const code = source.slice(start, end);
const hash = 'a'.repeat(64);
function fixture({stored = null, failRead = false, failWrite = false, ids = ['synthetic-a', 'synthetic-b']} = {}) {
  const boxes = ids.map(value => ({value, checked: false}));
  const count = {textContent: '0'}, note = {textContent: 'initial'};
  let written = null;
  const document = {
    body: {dataset: {corpusSha256: hash}},
    querySelector: selector => selector === '#selected-count' ? count : selector === '#selection-storage-note' ? note : null,
    querySelectorAll: selector => selector === 'input[name=tactic]:checked' ? boxes.filter(box => box.checked) : boxes
  };
  const sessionStorage = {
    getItem: () => { if (failRead) throw new Error('unavailable'); return stored; },
    setItem: (key, value) => { if (failWrite) throw new Error('unavailable'); written = {key, value}; }
  };
  const context = vm.createContext({document, sessionStorage});
  vm.runInContext(code, context);
  return {boxes, count, note, context, written: () => written};
}
{
  const f = fixture({stored: JSON.stringify({corpus: hash, ids: ['synthetic-b']})});
  assert.deepEqual(f.boxes.map(box => box.checked), [false, true]);
  assert.equal(f.count.textContent, 1);
  vm.runInContext('saveSelection()', f.context);
  const saved = JSON.parse(f.written().value);
  assert.deepEqual(Object.keys(saved).sort(), ['corpus', 'ids']);
  assert.deepEqual(saved.ids, ['synthetic-b']);
}
for (const stored of [
  JSON.stringify({corpus: 'b'.repeat(64), ids: ['synthetic-a']}),
  JSON.stringify({corpus: hash, ids: ['unknown']}),
  JSON.stringify({corpus: hash, ids: ['synthetic-a', 'synthetic-a']}),
  JSON.stringify({corpus: hash, ids: Array(26).fill('synthetic-a')}),
  '{invalid'
]) {
  const f = fixture({stored});
  assert.equal(f.boxes.some(box => box.checked), false);
  assert.match(f.note.textContent, /choose patterns again/i);
}
{
  const f = fixture({failRead: true});
  assert.match(f.note.textContent, /storage is unavailable/i);
}
{
  const f = fixture({failWrite: true});
  f.boxes[0].checked = true;
  vm.runInContext('saveSelection()', f.context);
  assert.equal(f.boxes[0].checked, true);
  assert.match(f.note.textContent, /download your selection/i);
}
console.log('PASS tab-scoped selection restoration, version checks, private fields and storage fallback');
