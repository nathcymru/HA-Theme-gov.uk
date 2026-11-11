/* Publishing specimens use fixed local records. No fetch, storage or HA calls. */
(() => {
  const normalise = value => value.toLocaleLowerCase().trim();
  for (const form of document.querySelectorAll('form[data-publishing-filter]')) {
    const results = document.getElementById(form.dataset.publishingTarget);
    const query = form.querySelector('input[name="query"]');
    const status = form.querySelector('[data-publishing-status]');
    const empty = results?.querySelector('[data-publishing-empty]');
    if (!results || !query || !status || !empty) continue;
    const records = [...results.querySelectorAll('[data-publishing-record]')];
    const apply = () => {
      const terms = normalise(query.value).split(/\s+/).filter(Boolean);
      const facets = new Map();
      for (const input of form.querySelectorAll('input[data-publishing-facet]:checked')) {
        const field = input.dataset.publishingFacet;
        if (!/^[a-z-]+$/.test(field)) continue;
        if (!facets.has(field)) facets.set(field, new Set());
        facets.get(field).add(normalise(input.value));
      }
      let visible = 0;
      for (const record of records) {
        const text = normalise(record.textContent);
        const matches = terms.every(term => text.includes(term)) && [...facets].every(([field, values]) =>
          values.has(normalise(record.getAttribute(`data-publishing-${field}`) || '')));
        record.hidden = !matches;
        if (matches) visible++;
      }
      empty.hidden = visible !== 0;
      status.textContent = `${visible} of ${records.length} example records shown. No live data was searched.`;
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.reportValidity()) apply();
    });
    form.querySelector('[data-publishing-reset]')?.addEventListener('click', () => {
      form.reset();
      apply();
      query.focus();
    });
    // Authored buttons are disabled until the local-only handlers are ready.
    // Without JavaScript, all records and native disclosures stay available.
    form.querySelectorAll('[data-publishing-enable]').forEach(button => { button.disabled = false; });
  }
  for (const button of document.querySelectorAll('button[data-publishing-print]')) {
    button.addEventListener('click', () => {
      const status = document.getElementById(button.dataset.publishingStatus);
      if (status) status.textContent = 'Opening the browser print dialog for this example. No file is uploaded.';
      window.print();
    });
    button.disabled = false;
  }
})();
