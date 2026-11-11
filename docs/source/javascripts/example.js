/* Safe, local documentation examples. No network requests or household actions. */
(() => {
  const localStatus = node => node.closest('form, section, article, dialog, .c-example-canvas')?.querySelector('[data-demo-status]');
  document.addEventListener('submit', event => {
    if (!event.target.matches('[data-demo-form]')) return;
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    const status = localStatus(event.target);
    if (status) status.textContent = event.target.dataset.demoSuccess || 'Example complete. Your home has not been changed.';
  });
  let dialogOpener;
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-demo-open]');
    if (open) { const dialog = document.getElementById(open.dataset.demoOpen); if (dialog instanceof HTMLDialogElement) { dialogOpener = open; dialog.showModal(); } }
    const close = event.target.closest('[data-demo-close]');
    if (close) close.closest('dialog')?.close();
    const button = event.target.closest('[data-demo-message]');
    if (button) { const status = localStatus(button); if (status) status.textContent = button.dataset.demoMessage; }
  });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => dialogOpener?.focus()));
  document.querySelectorAll('[data-demo-enable]').forEach(control => { control.disabled = false; });
  const notify = () => parent.postMessage({type:'civica-example-height',height:document.body.scrollHeight}, location.origin);
  new ResizeObserver(notify).observe(document.body);
  window.addEventListener('load', notify);
})();
(() => {
  for (const range of document.querySelectorAll('[data-demo-range]')) {
    const output = range.closest('form')?.querySelector('[data-demo-range-output]');
    if (output) range.addEventListener('input', () => { output.textContent = `${range.value}%`; });
  }
})();
