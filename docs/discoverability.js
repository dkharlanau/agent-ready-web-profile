const search = document.querySelector('#practice-search');
const category = document.querySelector('#category');
const evidence = document.querySelector('#evidence-level');
const cards = [...document.querySelectorAll('.practice')];
// Visible title/problem/action/check text already ships in each card. Do not
// duplicate it in HTML attributes just to make the same words searchable.
const searchable = new Map(cards.map(card => [card, `${card.dataset.search} ${card.textContent}`.toLowerCase()]));
const params = new URLSearchParams(location.search);
search.value = params.get('q') || '';
category.value = params.get('category') || '';
evidence.value = params.get('evidence') || '';
function filter({ interactive = false } = {}) {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const card of cards) {
    const show = (!category.value || category.value === card.dataset.category) && (!evidence.value || evidence.value === card.dataset.level) && terms.every(term => searchable.get(card).includes(term));
    card.hidden = !show;
    if (show) count++;
  }
  document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'pattern' : 'patterns'}`;
  for (const button of document.querySelectorAll('[data-quick-category]')) button.setAttribute('aria-pressed', String(button.dataset.quickCategory === category.value));
  document.querySelector('#no-results').hidden = count > 0;
  const state = new URLSearchParams();
  if (search.value) state.set('q', search.value);
  if (category.value) state.set('category', category.value);
  if (evidence.value) state.set('evidence', evidence.value);
  let fragment = location.hash;
  if (interactive && fragment) {
    let target;
    try { target = cards.find(card => card.id === decodeURIComponent(fragment.slice(1))); } catch { /* Keep non-pattern anchors unchanged. */ }
    if (target?.hidden) fragment = '';
  }
  history.replaceState(null, '', `${location.pathname}${state.size ? `?${state}` : ''}${fragment}`);
}
document.querySelector('#filters').addEventListener('input', () => filter({ interactive: true }));
document.querySelector('#filters').addEventListener('change', () => filter({ interactive: true }));
for (const button of document.querySelectorAll('[data-quick-category]')) button.addEventListener('click', () => { category.value = button.dataset.quickCategory; filter({ interactive: true }); });
document.querySelector('#filters').addEventListener('submit', event => { event.preventDefault(); filter({ interactive: true }); });
document.querySelector('#filters').addEventListener('reset', event => { event.preventDefault(); search.value = ''; category.value = ''; evidence.value = ''; filter({ interactive: true }); });
document.querySelector('.selection-jump').addEventListener('click', () => { document.querySelector('#plan-details').open = true; });
const picked = () => [...document.querySelectorAll('input[name=tactic]:checked')];
const selectionKey = 'goose-arwp-discoverability-selection-v1';
const selectionNote = document.querySelector('#selection-storage-note');
const storageUnavailable = () => { selectionNote.textContent = 'Tab storage is unavailable. Download your selection before leaving this page.'; };
function restoreSelection() {
  let raw;
  try { raw = sessionStorage.getItem(selectionKey); } catch { storageUnavailable(); return; }
  if (!raw) return;
  let saved;
  try { saved = JSON.parse(raw); } catch { selectionNote.textContent = 'The saved selection could not be read. Choose patterns again.'; return; }
  const boxes = [...document.querySelectorAll('input[name=tactic]')];
  const validIds = new Set(boxes.map(box => box.value));
  const ids = saved?.ids;
  if (saved?.corpus !== document.body.dataset.corpusSha256 || !Array.isArray(ids) || ids.length > 25 ||
      ids.some(id => typeof id !== 'string' || !validIds.has(id)) || new Set(ids).size !== ids.length) {
    selectionNote.textContent = 'The saved selection does not match this library version. Choose patterns again.';
    return;
  }
  const selected = new Set(ids);
  for (const box of boxes) box.checked = selected.has(box.value);
  document.querySelector('#selected-count').textContent = picked().length;
}
function saveSelection() {
  try {
    sessionStorage.setItem(selectionKey, JSON.stringify({corpus: document.body.dataset.corpusSha256, ids: picked().map(box => box.value)}));
    selectionNote.textContent = 'Selected patterns are saved in this tab’s session storage. Site and audience details are not saved.';
  }
  catch { storageUnavailable(); }
}
restoreSelection();
function invalidateExport() { document.querySelector('#plan-export').hidden = true; document.querySelector('#copy-message').textContent = ''; document.querySelector('#plan-message').textContent = ''; }
function renderSelection() {
  const selected = picked();
  const list = document.querySelector('#plan-selection-list');
  document.querySelector('#plan-selection-state').textContent = selected.length ? `${selected.length} selected ${selected.length === 1 ? 'pattern' : 'patterns'}` : 'No patterns selected yet.';
  list.replaceChildren();
  selected.forEach((box, index) => {
    const title = box.closest('.practice')?.querySelector('h2 a')?.textContent.trim() || box.value;
    const item = document.createElement('li');
    const label = document.createElement('span');
    const remove = document.createElement('button');
    label.textContent = title;
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${title} from plan`);
    remove.addEventListener('click', () => {
      box.checked = false;
      box.dispatchEvent(new Event('change', {bubbles: true}));
      const remaining = list.querySelectorAll('button');
      (remaining[Math.min(index, remaining.length - 1)] || document.querySelector('#plan-details summary')).focus();
    });
    item.append(label, remove);
    list.append(item);
  });
}
renderSelection();
document.querySelector('#plan-form').addEventListener('input', invalidateExport);
for (const box of document.querySelectorAll('input[name=tactic]')) box.addEventListener('change', () => {
  invalidateExport();
  if (picked().length > 25) {
    box.checked = false;
    document.querySelector('#plan-message').textContent = 'Choose up to 25 patterns for one bounded plan.';
    document.querySelector('#plan-details').open = true;
  }
  document.querySelector('#selected-count').textContent = picked().length;
  saveSelection();
  renderSelection();
});
document.querySelector('#plan-form').addEventListener('submit', event => {
  event.preventDefault();
  const message = document.querySelector('#plan-message');
  let url;
  try { url = new URL(document.querySelector('#plan-site').value); } catch { message.textContent = 'Enter a valid HTTPS site URL.'; return; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) { message.textContent = 'Use the canonical HTTPS URL without credentials, query or fragment.'; return; }
  if (!picked().length) { message.textContent = 'Select at least one pattern from the library.'; return; }
  const config = { site_url: url.href, audience: document.querySelector('#plan-audience').value.trim(), useful_action: document.querySelector('#plan-action').value.trim(), corpus_version: document.body.dataset.corpusVersion, corpus_sha256: document.body.dataset.corpusSha256, tactic_versions: Object.fromEntries(picked().map(box => [box.value, box.closest('.practice').dataset.version])), tactic_ids: picked().map(box => box.value), page_urls: [] };
  if (!config.audience || !config.useful_action) { message.textContent = 'Describe the audience and useful action.'; return; }
  const serialized = JSON.stringify(config, null, 2) + '\n';
  document.querySelector('#plan-json').value = serialized;
  document.querySelector('#plan-export').hidden = false;
  const blob = new Blob([serialized], { type: 'application/json' });
  const objectURL = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = objectURL; a.download = 'arwp-adoption.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  message.textContent = 'Selection prepared. Check your downloads, or inspect and copy the JSON below.';
});
document.querySelector('#copy-selection').addEventListener('click', async () => {
  const message = document.querySelector('#copy-message');
  try { await navigator.clipboard.writeText(document.querySelector('#plan-json').value); message.textContent = 'Selection JSON copied.'; }
  catch { document.querySelector('#plan-json').focus(); document.querySelector('#plan-json').select(); message.textContent = 'Copy the selected JSON using your browser copy command.'; }
});
function revealHash() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const card = cards.find(item => item.id === id);
  if (card) {
    if (card.hidden) { search.value = ''; category.value = ''; evidence.value = ''; filter(); }
    card.querySelector('details').open = true;
    card.scrollIntoView({ block: 'start' });
  }
}
filter();
revealHash();
addEventListener('hashchange', revealHash);
