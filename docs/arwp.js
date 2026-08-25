const siteInput = document.querySelector('#site-url');
const prepareButton = document.querySelector('#prepare');
const message = document.querySelector('#url-message');
const scanCommand = document.querySelector('#scan-command code');
const initCommand = document.querySelector('#init-command code');

function normalizeSite(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Enter a public HTTPS website.');
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (url.protocol !== 'https:') throw new Error('ARWP scanning is HTTPS-only.');
  if (url.username || url.password) throw new Error('URLs with credentials are not supported.');
  return url.href;
}

function prepareCommands() {
  try {
    const site = normalizeSite(siteInput.value);
    siteInput.value = site;
    scanCommand.textContent = `node bin/arwp.mjs scan ${site}`;
    initCommand.textContent = `node bin/arwp.mjs init ${site}`;
    message.textContent = '';
  } catch (error) {
    message.textContent = error.message;
  }
}

prepareButton.addEventListener('click', prepareCommands);
siteInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') prepareCommands();
});

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
      button.textContent = 'Selected';
      window.setTimeout(() => { button.textContent = 'Copy'; }, 1200);
    }
  });
}
