const siteInput = document.querySelector('#site-url');
const prepareButton = document.querySelector('#prepare');
const message = document.querySelector('#url-message');
const scanCommand = document.querySelector('#scan-command code');
const initCommand = document.querySelector('#init-command code');
const scanResults = document.querySelector('#scan-results');
const downloadButton = document.querySelector('#download-profile');
const scannerMode = document.querySelector('#scanner-mode');
const scannerEndpoint = document.body.dataset.scannerEndpoint?.trim() || '';

let generatedProfile = null;
let directory = { sites: [] };

function normalizeSite(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Enter a public HTTPS website.');
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (url.protocol !== 'https:') throw new Error('ARWP scanning is HTTPS-only.');
  if (url.username || url.password) throw new Error('URLs with credentials are not supported.');
  if (url.port && url.port !== '443') throw new Error('Non-standard HTTPS ports are not supported by the bounded scanner.');
  return url.href;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
}

function capabilityLabels(capabilities = {}) {
  const labels = [];
  if (capabilities.data) labels.push('Data');
  if (capabilities.retrieval) labels.push('Retrieval');
  if (capabilities.openapi) labels.push('OpenAPI');
  if (capabilities.agentSkills) labels.push('Skills');
  if (capabilities.webmcp) labels.push('WebMCP');
  if (capabilities.mcp) labels.push(capabilities.mcp === 'local' ? 'MCP local' : 'MCP');
  if (capabilities.a2a) labels.push('A2A');
  if (capabilities.trust) labels.push('Trust');
  return labels;
}

function renderReferenceCards() {
  const target = document.querySelector('#reference-cards');
  if (!target) return;
  if (!directory.sites.length) {
    target.innerHTML = '<p class="loading">Directory data is unavailable.</p>';
    return;
  }
  target.innerHTML = directory.sites.map(site => `
    <article class="reference-card" data-site-id="${escapeHtml(site.id)}">
      <span class="reference-card__cat">${escapeHtml(site.category)}</span>
      <h3>${escapeHtml(site.name)}</h3>
      <p>${escapeHtml(site.summary)}</p>
      <div class="cap-list">${capabilityLabels(site.capabilities).map(label => `<span class="cap">${escapeHtml(label)}</span>`).join('')}</div>
      <div class="reference-actions"><a href="${escapeHtml(site.canonicalUrl)}">Site ↗</a><a href="${escapeHtml(site.profileUrl)}">Profile ↗</a></div>
    </article>`).join('');

  for (const card of target.querySelectorAll('.reference-card')) {
    card.addEventListener('click', event => {
      if (event.target.closest('a')) return;
      const site = directory.sites.find(item => item.id === card.dataset.siteId);
      if (site) selectProfileDemo(site);
    });
  }
  selectProfileDemo(directory.sites[0]);
}

function selectProfileDemo(site) {
  const name = document.querySelector('#profile-demo-name');
  const summary = document.querySelector('#profile-demo-summary');
  const url = document.querySelector('#profile-demo-url');
  if (name) name.textContent = site.name;
  if (summary) summary.textContent = `${site.summary} An agent can start at this profile instead of guessing the site's integration surface.`;
  if (url) url.textContent = site.profileUrl;
}

function siteMatchesFilter(site, filter) {
  if (filter === 'all') return true;
  if (filter === 'mcp') return Boolean(site.capabilities?.mcp);
  return Boolean(site.capabilities?.[filter]);
}

function renderDirectory(filter = 'all') {
  const target = document.querySelector('#directory-list');
  if (!target) return;
  const sites = directory.sites.filter(site => siteMatchesFilter(site, filter));
  target.innerHTML = sites.length ? sites.map(site => `
    <article class="directory-row">
      <div><h3>${escapeHtml(site.name)}</h3><small>${escapeHtml(site.category)}</small></div>
      <div><p>${escapeHtml(site.summary)}</p><div class="directory-row__links"><a href="${escapeHtml(site.canonicalUrl)}">Website ↗</a><a href="${escapeHtml(site.profileUrl)}">ARWP profile ↗</a></div></div>
      <div class="cap-list">${capabilityLabels(site.capabilities).map(label => `<span class="cap">${escapeHtml(label)}</span>`).join('')}</div>
    </article>`).join('') : '<p class="loading">No directory sites currently match this capability.</p>';
}

async function loadDirectory() {
  try {
    const response = await fetch('./directory.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.sites)) throw new Error('Invalid directory payload.');
    directory = payload;
  } catch (error) {
    console.warn('Unable to load ARWP directory:', error);
  }
  renderReferenceCards();
  renderDirectory();
}

async function runHostedScan(site) {
  if (!scannerEndpoint) return false;
  scannerMode.textContent = 'live scanner';
  scanResults.hidden = false;
  scanResults.innerHTML = '<p>Scanning bounded public discovery surfaces…</p>';
  const response = await fetch(scannerEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ url: site })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Scanner returned HTTP ${response.status}.`);
  generatedProfile = payload.profile || null;
  const discovered = payload.scan?.discovered || {};
  const rows = [
    ['Sitemap', discovered.sitemap], ['robots.txt', discovered.robots], ['llms.txt', discovered.llms],
    ['OpenAPI', discovered.openapi], ['Existing ARWP profile', discovered.profile]
  ];
  const feeds = discovered.feeds?.length ? `${discovered.feeds.length} feed(s)` : null;
  scanResults.innerHTML = `<h4>Observed public evidence</h4><ul>${rows.map(([label, value]) => `<li>${escapeHtml(label)}: <strong>${value ? 'detected' : 'not detected'}</strong></li>`).join('')}${feeds ? `<li>Feeds: <strong>${escapeHtml(feeds)}</strong></li>` : ''}</ul>`;
  downloadButton.hidden = !generatedProfile;
  return true;
}

async function prepareScan() {
  try {
    const site = normalizeSite(siteInput.value);
    siteInput.value = site;
    scanCommand.textContent = `node bin/arwp.mjs scan ${site}`;
    initCommand.textContent = `node bin/arwp.mjs init ${site}`;
    message.textContent = '';
    generatedProfile = null;
    downloadButton.hidden = true;
    scanResults.hidden = true;
    if (scannerEndpoint) await runHostedScan(site);
    else {
      scannerMode.textContent = 'CLI ready';
      message.textContent = 'Commands prepared. This Pages deployment uses the local scanner until a hosted scanner endpoint is configured.';
    }
  } catch (error) {
    message.textContent = error.message;
    scanResults.hidden = true;
    downloadButton.hidden = true;
  }
}

function downloadGeneratedProfile() {
  if (!generatedProfile) return;
  const blob = new Blob([`${JSON.stringify(generatedProfile, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'site-profile.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

prepareButton?.addEventListener('click', prepareScan);
siteInput?.addEventListener('keydown', event => { if (event.key === 'Enter') prepareScan(); });
downloadButton?.addEventListener('click', downloadGeneratedProfile);

for (const button of document.querySelectorAll('.filter')) {
  button.addEventListener('click', () => {
    for (const item of document.querySelectorAll('.filter')) item.classList.remove('active');
    button.classList.add('active');
    renderDirectory(button.dataset.filter);
  });
}

for (const button of document.querySelectorAll('.copy')) {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copy);
    if (!target) return;
    const text = target.innerText;
    try {
      await navigator.clipboard.writeText(text);
      const oldText = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = oldText; }, 1200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const oldText = button.textContent;
      button.textContent = 'Selected';
      window.setTimeout(() => { button.textContent = oldText; }, 1200);
    }
  });
}

loadDirectory();
