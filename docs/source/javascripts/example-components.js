//= require govuk/all.bundle.js
// Examples do not need to retain accordion preferences between page loads.
// Keep expansion in the current document without reading or writing storage.
window.GOVUKFrontend.initAll({ accordion: { rememberExpanded: false } });
// The generated heading and Show/Hide spans need a literal word boundary when
// the visually hidden divider is excluded from the visible control label.
// Preserve the upstream accessible name, expanded state and event handlers.
document.querySelectorAll('.govuk-accordion__section-toggle').forEach(toggle => {
  toggle.before(document.createTextNode(' '));
});
