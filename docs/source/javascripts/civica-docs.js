/* Documentation demonstrations only. Home Assistant settings live in civica-ui.js. */
(() => {
  const demo = document.querySelector('[data-palette-demo]');
  if (!demo) return;
  const select = demo.querySelector('select');
  const muted = demo.querySelector('input[type="checkbox"]');
  const status = demo.querySelector('[role="status"]');
  const update = () => {
    const option = select.selectedOptions[0];
    const tone = muted.checked ? 'muted' : 'vivid';
    const assets = `../images/themes/${option.dataset.paletteId}/${tone}`;
    demo.querySelector('[data-variant-primary]').src = `${assets}/lockup-on-primary.svg`;
    demo.querySelector('[data-variant-canvas]').src = `${assets}/lockup-on-canvas.svg`;
    demo.querySelector('[data-variant-icon]').src = `${assets}/app-icon.svg`;
    demo.style.setProperty('--demo-primary', option.dataset[muted.checked ? 'muted' : 'vivid']);
    demo.style.setProperty('--demo-canvas', muted.checked ? option.dataset.canvas : '#ffffff');
    status.textContent = `${option.textContent}, ${muted.checked ? 'Muted' : 'Vivid'} preview. These choices affect this example only.`;
  };
  select.addEventListener('change', update);
  muted.addEventListener('change', update);
})();

/* Progressive enhancement: navigation, catalogue and source tabs remain usable without JS. */
(() => {
  const narrow = matchMedia('(max-width:760px)');
  const sectionMenu = document.querySelector('.c-section-menu');
  const mainToggle = document.querySelector('.c-menu-toggle');
  const mainLinks = document.getElementById('primary-navigation');
  const arrangeNavigation = () => {
    if (sectionMenu) sectionMenu.open = !narrow.matches;
    if (mainToggle && mainLinks) {
      mainToggle.hidden = !narrow.matches;
      mainToggle.setAttribute('aria-expanded', String(!narrow.matches));
      mainLinks.hidden = narrow.matches;
    }
  };
  arrangeNavigation(); narrow.addEventListener('change', arrangeNavigation);
  mainToggle?.addEventListener('click', () => {
    mainLinks.hidden = !mainLinks.hidden;
    mainToggle.setAttribute('aria-expanded', String(!mainLinks.hidden));
  });
  for (const tabs of document.querySelectorAll('[data-code-tabs]')) {
    const list = tabs.querySelector('.c-code-tabs__list');
    const links = [...list.querySelectorAll('a')];
    const panels = links.map(link => document.getElementById(link.hash.slice(1)));
    list.setAttribute('role', 'tablist'); list.setAttribute('aria-label', 'Example code');
    const activate = index => links.forEach((link, i) => {
      link.setAttribute('aria-selected', String(i === index)); link.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    links.forEach((link, i) => {
      link.id = `tab-${panels[i].id}`; link.setAttribute('role', 'tab'); link.setAttribute('aria-controls', panels[i].id);
      panels[i].setAttribute('role', 'tabpanel'); panels[i].setAttribute('aria-labelledby', link.id); panels[i].tabIndex = 0;
      link.addEventListener('click', event => { event.preventDefault(); activate(i); });
      link.addEventListener('keydown', event => {
        const next = event.key === 'ArrowRight' ? (i + 1) % links.length : event.key === 'ArrowLeft' ? (i + links.length - 1) % links.length : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null;
        if (next !== null) { event.preventDefault(); activate(next); links[next].focus(); }
      });
    }); activate(0);
  }
  for (const button of document.querySelectorAll('[data-copy]')) {
    if (!navigator.clipboard) continue;
    button.hidden = false;
    button.addEventListener('click', async () => {
      const status = button.closest('.c-example').querySelector('.c-copy-status');
      try { await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent); status.textContent = 'HTML copied.'; }
      catch { status.textContent = 'Could not copy automatically. Select and copy the HTML below.'; }
    });
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.data?.type !== 'civica-example-height' || !Number.isFinite(event.data.height)) return;
    const frame = [...document.querySelectorAll('.c-example__frame')].find(item => item.contentWindow === event.source);
    if (frame) frame.height = String(Math.max(100, Math.min(5000, Math.ceil(event.data.height))));
  });
  const filter = document.querySelector('[data-catalogue-filter]');
  if (filter) {
    const items = [...document.querySelectorAll('[data-catalogue-item]')];
    const status = document.querySelector('[data-catalogue-status]');
    const update = () => {
      const words = filter.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
      let count = 0;
      items.forEach(item => { item.hidden = !words.every(word => item.textContent.toLocaleLowerCase().includes(word)); if (!item.hidden) count++; });
      for (const group of document.querySelectorAll('[data-catalogue-group]')) group.hidden = !group.querySelector('[data-catalogue-item]:not([hidden])');
      status.textContent = `${count} ${count === 1 ? 'page' : 'pages'}${words.length ? ' found' : ''}.`;
    };
    filter.value = new URLSearchParams(location.search).get('q') || ''; filter.addEventListener('input', update); update();
  }
})();
