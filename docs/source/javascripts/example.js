/* Safe, local documentation examples. No network requests or household actions. */
(() => {
  const localStatus = node => node.closest('form, section, article, dialog, .c-example-canvas')?.querySelector('[data-demo-status]');
  document.addEventListener('submit', event => {
    if (!event.target.matches('[data-demo-form]')) return;
    event.preventDefault();
    if (event.target.matches('[data-civica-slider]')) return;
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
  for (const form of document.querySelectorAll('form[data-civica-slider]')) {
    const range = form.querySelector('[data-slider-range]');
    const field = form.querySelector('[data-slider-value]');
    const output = form.querySelector('[data-slider-output]');
    const error = form.querySelector('[data-slider-error]');
    const status = form.querySelector('[data-demo-status]');
    const buttons = [...form.querySelectorAll('button[data-slider-step]')];
    if (!range || !field || !output || !error || !status) continue;
    const min = Number(range.min), max = Number(range.max), step = Number(range.step);
    if (![min, max, step].every(Number.isFinite) || min >= max || step <= 0) continue;
    const unit = form.dataset.sliderUnit;
    const spokenUnit = unit === '%' ? 'per cent' : unit === '°C' ? 'degrees Celsius' : unit;
    const precision = Math.max(...[min, max, step].map(value => (String(value).split('.')[1] || '').length));
    const normalise = value => Number(value.toFixed(precision));
    const display = value => `${value}${unit === '%' ? '' : ' '}${unit}`;
    const message = `Enter a number from ${min} to ${max} in steps of ${step}${step < 1 ? '. Use a decimal point' : ''}.`;
    form.noValidate = true;
    const validate = () => {
      const text = field.value.trim();
      const value = Number(text);
      const increments = (value - min) / step;
      const valid = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(value) &&
        value >= min && value <= max && Math.abs(increments - Math.round(increments)) < 1e-8;
      error.hidden = valid;
      error.textContent = valid ? '' : message;
      field.setAttribute('aria-invalid', String(!valid));
      field.classList.toggle('govuk-input--error', !valid);
      field.closest('.govuk-form-group')?.classList.toggle('govuk-form-group--error', !valid);
      if (!valid) { output.textContent = 'Enter a valid draft value.'; return null; }
      range.value = String(normalise(value));
      range.setAttribute('aria-valuetext', `${normalise(value)} ${spokenUnit}`);
      output.textContent = display(normalise(value));
      for (const button of buttons) {
        const disabled = Number(button.dataset.sliderStep) < 0 ? value <= min : value >= max;
        // Reaching a bound must not discard keyboard focus when its step
        // button becomes unavailable. The exact field names the new value.
        if (disabled && document.activeElement === button) field.focus();
        button.disabled = disabled;
      }
      return normalise(value);
    };
    const clearOutcome = () => { status.textContent = ''; };
    field.addEventListener('input', () => { clearOutcome(); validate(); });
    range.addEventListener('input', () => { field.value = range.value; clearOutcome(); validate(); });
    for (const button of buttons) button.addEventListener('click', () => {
      clearOutcome();
      const current = validate();
      if (current === null) { field.focus(); return; }
      field.value = String(normalise(Math.min(max, Math.max(min, current + Number(button.dataset.sliderStep) * step))));
      validate();
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = validate();
      if (value === null) { clearOutcome(); field.focus(); return; }
      status.textContent = form.dataset.sliderOutcome === 'failed'
        ? `Example request failed. The ${display(value)} draft is retained. The earlier reported value is unchanged. No device command was sent.`
        : `Example request for ${display(value)} accepted locally. A newer device report would be needed to confirm the change. The earlier reported value is unchanged. No device command was sent.`;
    });
    validate();
  }
})();
(() => {
  for (const range of document.querySelectorAll('[data-demo-range]')) {
    const output = range.closest('form')?.querySelector('[data-demo-range-output]');
    if (output) range.addEventListener('input', () => { output.textContent = `${range.value}%`; });
  }
})();
