// Shared Home Assistant and civica.uk tokens; no fixed interface colours.
export const STYLES = `
:host { display: block; min-width: 0; }
*, *::before, *::after { box-sizing: border-box; }
ha-card { display: block; font-family: var(--ha-font-family-body, Arial, sans-serif); font-size: var(--civica-font-size-body, 19px); line-height: 1.5; color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 0; box-shadow: none; }
.body { padding: 15px; }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 15px; margin-bottom: 15px; }
.title { margin: 0; font-size: var(--ha-card-header-font-size, 24px); font-weight: var(--ha-font-weight-heading, 700); }
.status { margin: 0 0 20px; font-size: var(--civica-font-size-small, 16px); color: var(--secondary-text-color); }
.actions { display: flex; flex-wrap: wrap; gap: 15px; }
/* GOV.UK button: theme body size (19px), weight 400, 2px border, padding 8px 10px 7px = 38px + 2px shadow, matching --ha-button-height. */
.btn { font: inherit; font-size: var(--civica-font-size-body, 19px); font-weight: 400; line-height: 1.3; min-width: 44px; min-height: 44px; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin: 0; padding: 8px 10px 7px; cursor: pointer; text-align: center; vertical-align: top; border: 2px solid transparent; border-radius: 0;
  background: var(--primary-color); color: var(--text-primary-color); box-shadow: 0 2px 0 var(--ha-color-primary-10); }
.btn:hover { background: var(--civica-action-hover, var(--dark-primary-color)); }
.btn:active { top: 2px; }
.btn--secondary { background: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); }
.btn--secondary:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
.btn--warning { background: var(--civica-danger-fill, var(--error-color)); color: var(--civica-on-danger, var(--text-primary-color)); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 55%, var(--civica-danger-fill, var(--error-color))); }
.btn--warning:hover { background: color-mix(in srgb, var(--primary-text-color) 20%, var(--civica-danger-fill, var(--error-color))); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:disabled:hover { background: var(--primary-color); }
.btn--secondary:disabled:hover { background: var(--secondary-background-color); }
.btn:disabled:active { top: 0; }
.btn-icon { flex: none; }
.btn[hidden] { display: none; }
.btn:focus-visible { outline: 3px solid transparent; border-color: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 2px 0 var(--civica-focus-text, var(--black-color)); }
.rooms { margin: 0 0 20px; padding: 0; }
.row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px 15px; align-items: center; padding: 15px 0; border-bottom: 1px solid var(--divider-color); }
@media (min-width: 540px) { .row { grid-template-columns: minmax(0, 1fr) auto; } }
@media (min-width: 641px) { .body { padding: 20px; } .rooms { margin-bottom: 30px; } }
.row > * { min-width: 0; overflow-wrap: anywhere; }
.row[hidden] { display: none; }
.key { font-weight: 700; margin: 0; }
.sub { display: block; font-weight: 400; font-size: var(--civica-font-size-small, 16px); line-height: 1.5; color: var(--secondary-text-color); }
.sub:empty { display: none; }
.act { margin: 0; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.plan { display: block; width: 100%; height: auto; margin-bottom: 15px; }
.shade { transition: opacity 0.3s; }
.shade--off { fill: var(--primary-text-color); opacity: 0.45; }
.shade--lit { opacity: 0.28; mix-blend-mode: soft-light; }
.hit { fill: transparent; stroke: none; cursor: pointer; }
.hit:hover { fill: var(--ha-color-focus); fill-opacity: 0.18; }
.hit:focus-visible { outline: none; stroke: var(--ha-color-focus); stroke-width: 8px; fill: var(--ha-color-focus); fill-opacity: 0.18; }
.dlg { width: min(640px, 92vw); box-sizing: border-box; flex-direction: column; max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px); overflow-y: auto; border: var(--ha-border-width-lg, 4px) solid var(--primary-text-color); border-radius: 0; padding: 24px; background: var(--card-background-color); color: var(--primary-text-color); font-family: var(--ha-font-family-body); }
.dlg[open] { display: flex; }
.dlg-title { margin: 0 0 16px; font-size: var(--civica-font-size-heading, 24px); }
.dlg::backdrop { background: var(--primary-text-color); opacity: 0.6; }
.error-summary { padding: 15px; margin-bottom: 30px; border: 5px solid var(--error-color); color: var(--primary-text-color); }
.error-summary:focus { outline: 3px solid var(--ha-color-focus); outline-offset: 2px; }
.form-group--error:focus { outline: 3px solid var(--ha-color-focus); outline-offset: 2px; }
.error-summary__title { margin: 0 0 15px; font-size: var(--civica-font-size-heading, 24px); line-height: 1.25; font-weight: 700; }
.error-summary__list { margin: 0; padding: 0; list-style: none; font-weight: 700; }
.error-summary__list li { margin: 0; }
.error-summary__list .link { color: var(--error-color); }
/* GOV.UK details component */
.details { display: block; margin: 15px 0 0; font-size: var(--civica-font-size-body, 19px); line-height: 1.3157894737; }
.details-summary { position: relative; display: block; width: fit-content; min-height: 44px; padding-top: 8px; padding-bottom: 8px; margin-top: 15px; padding-left: 25px; color: var(--link-color); cursor: pointer; list-style: none; }
.details-summary::-webkit-details-marker { display: none; }
.details-summary::before { content: ""; position: absolute; top: -1px; bottom: 0; left: 0; margin: auto; display: block; width: 0; height: 0; clip-path: polygon(0 0, 100% 50%, 0 100%); border-style: solid; border-color: transparent; border-width: 7px 0 7px 12.124px; border-left-color: inherit; }
.details[open] > .details-summary { margin-bottom: 5px; }
.details[open] > .details-summary::before { clip-path: polygon(0 0, 50% 100%, 100% 0); border-width: 12.124px 7px 0; border-left-color: transparent; border-top-color: inherit; }
.details-summary-text { text-decoration: underline; text-decoration-thickness: max(1px, 0.0625rem); text-underline-offset: 0.1578em; }
.details-summary:hover .details-summary-text { text-decoration-thickness: max(3px, 0.1875rem, 0.12em); text-decoration-skip-ink: none; }
.details-summary:focus-visible { outline: 3px solid transparent; color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 -2px var(--ha-color-focus), 0 4px var(--primary-text-color); }
.details-summary:focus-visible .details-summary-text { text-decoration: none; }
.details-text { padding: 15px 0 15px 20px; border-left: 5px solid var(--divider-color); }
.details-text p { margin: 0 0 20px; }
.details-text > :last-child { margin-bottom: 0; }
.link { color: var(--link-color); text-decoration: underline; text-underline-offset: 0.1578em; }
.link:hover { text-decoration-thickness: max(3px, 0.1875rem, 0.12em); }
.link:focus-visible { outline: 3px solid transparent; color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 -2px var(--ha-color-focus), 0 4px var(--primary-text-color); text-decoration: none; }
.scenes-slot { grid-column: 1 / -1; margin: 0; padding: 4px; }
.scenes-slot:empty { display: none; }
/* GOV.UK error message component, with its left-hand error border. */
.form-group--error { padding-left: 15px; border-left: 5px solid var(--error-color); }
.error-message { margin: 0 0 15px; font-weight: 700; color: var(--error-color); }
@media (prefers-reduced-motion: reduce) { .shade { transition: none; } }
@media (forced-colors: active) { .btn:focus-visible, .link:focus-visible, .details-summary:focus-visible { outline: 3px solid Highlight; } .hit:focus-visible { stroke: Highlight; } .btn { border: 2px solid ButtonText; } }
`;
