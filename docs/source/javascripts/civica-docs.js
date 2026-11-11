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
