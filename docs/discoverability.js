const search = document.querySelector('#practice-search');
const category = document.querySelector('#category');
const evidence = document.querySelector('#evidence-level');
const cards = [...document.querySelectorAll('.practice')];
const params = new URLSearchParams(location.search);
search.value = params.get('q') || '';
category.value = params.get('category') || '';
evidence.value = params.get('evidence') || '';
function filter() {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const card of cards) {
    const show = (!category.value || category.value === card.dataset.category) && (!evidence.value || evidence.value === card.dataset.level) && terms.every(term => card.dataset.search.includes(term));
    card.hidden = !show;
    if (show) count++;
  }
  document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'practice' : 'practices'}`;
  document.querySelector('#no-results').hidden = count > 0;
  const state = new URLSearchParams();
  if (search.value) state.set('q', search.value);
  if (category.value) state.set('category', category.value);
  if (evidence.value) state.set('evidence', evidence.value);
  history.replaceState(null, '', `${location.pathname}${state.size ? `?${state}` : ''}${location.hash}`);
}
document.querySelector('#filters').addEventListener('input', filter);
document.querySelector('#filters').addEventListener('submit', event => { event.preventDefault(); filter(); });
document.querySelector('#filters').addEventListener('reset', () => { search.value = ''; category.value = ''; evidence.value = ''; filter(); });
const picked = () => [...document.querySelectorAll('input[name=tactic]:checked')];
for (const box of document.querySelectorAll('input[name=tactic]')) box.addEventListener('change', () => {
  if (picked().length > 25) {
    box.checked = false;
    document.querySelector('#plan-message').textContent = 'Choose up to 25 practices for one bounded plan.';
    document.querySelector('#plan-details').open = true;
  }
  document.querySelector('#selected-count').textContent = picked().length;
});
document.querySelector('#plan-form').addEventListener('submit', event => {
  event.preventDefault();
  const message = document.querySelector('#plan-message');
  let url;
  try { url = new URL(document.querySelector('#plan-site').value); } catch { message.textContent = 'Enter a valid HTTPS site URL.'; return; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) { message.textContent = 'Use the canonical HTTPS URL without credentials, query or fragment.'; return; }
  if (!picked().length) { message.textContent = 'Select at least one practice from the library.'; return; }
  const config = { site_url: url.href, audience: document.querySelector('#plan-audience').value.trim(), useful_action: document.querySelector('#plan-action').value.trim(), tactic_ids: picked().map(box => box.value), page_urls: [] };
  if (!config.audience || !config.useful_action) { message.textContent = 'Describe the audience and useful action.'; return; }
  const blob = new Blob([JSON.stringify(config, null, 2) + '\n'], { type: 'application/json' });
  const objectURL = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = objectURL; a.download = 'arwp-adoption.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  message.textContent = 'Selection downloaded. Generate the implementation plan with the CLI.';
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
