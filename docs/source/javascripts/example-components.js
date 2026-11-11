//= require govuk/all.bundle.js
window.GOVUKFrontend.initAll();
// The generated heading and Show/Hide spans need a literal word boundary when
// the visually hidden divider is excluded from the visible control label.
// Preserve the upstream accessible name, expanded state and event handlers.
document.querySelectorAll('.govuk-accordion__section-toggle').forEach(toggle => {
  toggle.before(document.createTextNode(' '));
});
