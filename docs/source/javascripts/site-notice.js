/* Essential acknowledgement only. No consent, telemetry or identifiers. */
(() => {
  const notice = document.querySelector('[data-site-notice]');
  if (!notice) return;
  const button = notice.querySelector('[data-site-notice-dismiss]');
  const status = document.querySelector('[data-site-notice-status]');
  const example = notice.dataset.siteNotice === 'example';
  const name = 'civica_docs_notice';
  const version = 'v1';
  // Derive the base from a build-resolved home link, never the current guide.
  const path = new URL(notice.dataset.docsHome, location.href).pathname.replace(/index\.html$/, '');
  const saved = () => {
    try {
      return document.cookie.split(';').some(part => part.trim() === `${name}=${version}`);
    } catch { return false; }
  };
  if (!example && saved()) {
    notice.hidden = true;
    return;
  }
  button.hidden = false;
  button.addEventListener('click', () => {
    let persisted = false;
    if (!example) {
      try {
        void document.cookie; // Do not write a choice we cannot read back.
        document.cookie = `${name}=${version}; Path=${path}; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        persisted = saved();
      } catch { /* The notice can still be hidden for this page. */ }
    }
    notice.hidden = true;
    if (example || !persisted) {
      status.textContent = example
        ? 'Example notice hidden. No choice has been stored.'
        : 'Notice hidden for this page. Your browser could not save this choice, so the notice may appear again.';
      status.hidden = false;
    }
    // Do not leave focus inside the now-hidden region or steal it on page load.
    const destination = document.getElementById('main-content') || status;
    destination?.focus();
  });
})();
