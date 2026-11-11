// Opt-in presentation adapters for these three known custom-card contracts.
// The companion owns attaching/removing the stylesheet when civica is active.
// No selectors cross their shadow roots, and no device or record logic changes.
const base = `
:host { display: block; min-width: 0; color: var(--primary-text-color); font-family: var(--ha-font-family-body, Arial, sans-serif); font-size: var(--civica-font-size-body, 19px); line-height: 1.5; }
:host *, :host *::before, :host *::after { box-sizing: border-box; }
:host ha-card { border: 1px solid var(--divider-color); border-radius: 0; background: var(--card-background-color); color: var(--primary-text-color); box-shadow: none; }
:host h2 { font-size: var(--civica-font-size-heading, 24px); line-height: 1.25; font-weight: 700; letter-spacing: normal; }
:host h3 { font-size: var(--civica-font-size-body, 19px); line-height: 1.3; font-weight: 700; letter-spacing: normal; }
:host ha-icon { --mdc-icon-size: 24px; }
:host a { color: var(--link-color); text-decoration: underline; text-underline-offset: .16em; }
:host a:hover { text-decoration-thickness: 3px; }
:host [hidden] { display: none; }
`;

// These are action boundaries. Structural dividers deliberately use the quieter
// divider token; selects retain an ink outline so their affordance stays clear.
const controls = (button: string, summary: string) => `
${button} { min-width: 44px; min-height: 44px; padding: 8px 10px 7px; border: 2px solid transparent; border-radius: 0; background: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); font: inherit; font-size: var(--civica-font-size-body, 19px); font-weight: 400; line-height: 1.3; text-transform: none; letter-spacing: normal; white-space: normal; overflow-wrap: anywhere; text-decoration: none; }
${button}:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); filter: none; text-decoration: none; }
${button}:focus-visible { outline: 3px solid transparent; border-color: var(--ha-color-focus); background: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); box-shadow: 0 2px 0 var(--civica-focus-text, var(--black-color)); }
${summary} { width: fit-content; max-width: 100%; min-height: 44px; color: var(--link-color); font-size: var(--civica-font-size-small, 16px); line-height: 1.5; list-style: none; text-decoration: underline; text-underline-offset: .16em; }
${summary}::-webkit-details-marker { display: none; }
${summary}::before { content: ''; display: inline-block; flex: 0 0 12px; width: 12px; height: 14px; margin-inline-end: 8px; background: currentColor; clip-path: polygon(0 0, 100% 50%, 0 100%); vertical-align: middle; }
:host details[open] > summary::before { clip-path: polygon(0 10%, 100% 10%, 50% 90%); }
${summary}:focus-visible, :host a:not(.gs-button):not(footer a):focus-visible { outline: 3px solid transparent; background: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); box-shadow: 0 -2px 0 var(--ha-color-focus), 0 4px 0 var(--civica-focus-text, var(--black-color)); text-decoration: none; }
@media (forced-colors: active) { ${button} { border-color: ButtonText; } ${button}:focus-visible, ${summary}:focus-visible { outline: 3px solid Highlight; } ${summary}::before { background: LinkText; } }
`;

const appliances = `${base}
${controls(':host button', ':host summary')}
:host .wrap { padding: 20px; }
:host .header { flex-wrap: wrap; gap: 10px 15px; }
:host .header > div, :host .hero > div { min-width: 0; }
:host .brand, :host .room, :host .eyebrow, :host .subtitle, :host .battery-label, :host .remaining small, :host .metrics dt, :host .metrics dd, :host .footer p, :host .detail-row, :host .note, :host .raw, :host .warning, :host .setting label, :host .setting small, :host .action-notice, :host .feedback, :host .action-help { font-size: var(--civica-font-size-small, 16px); line-height: 1.5; letter-spacing: normal; text-transform: none; }
:host .room { max-width: none; text-align: start; }
:host .hero, :host .dialog-body .hero { grid-template-columns: minmax(80px, 30%) minmax(0, 1fr); gap: 15px; margin-top: 20px; padding: 0; border: 0; border-radius: 0; background: transparent; }
:host .portrait { color: var(--primary-text-color); }
:host .status, :host .unavailable .status, :host .dialog-body .status { font-size: var(--civica-font-size-heading, 24px); line-height: 1.25; font-weight: 700; letter-spacing: normal; }
:host .battery-label strong { font-size: var(--civica-font-size-small, 16px); font-weight: 700; }
:host .battery-track { border-radius: 0; }
:host .remaining { font-size: var(--civica-font-size-body, 19px); line-height: 1.3; }
:host .metrics { margin-top: 15px; gap: 10px 15px; }
:host .metrics dd { font-weight: 700; }
:host .warning { padding: 10px 0 10px 15px; border: 0; border-inline-start: 5px solid var(--warning-color); border-radius: 0; background: transparent; align-items: flex-start; }
:host .warning ha-icon { flex: 0 0 24px; --mdc-icon-size: 24px; }
:host button ha-icon { --mdc-icon-size: 24px; flex: 0 0 24px; }
:host .action-row { gap: 15px; margin-top: 20px; }
:host .action-row .primary { background: var(--primary-color); color: var(--text-primary-color); }
:host .action-row .primary:hover { background: var(--civica-action-hover, var(--dark-primary-color)); }
:host .action-row .primary:focus-visible { background: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); }
:host .detail-row { flex-wrap: wrap; gap: 5px 15px; padding-block: 10px; border-bottom-color: var(--divider-color); }
:host .detail-row strong { font-weight: 700; overflow-wrap: anywhere; }
:host .setting select { min-height: 44px; border: 2px solid var(--primary-text-color); border-radius: 0; background: var(--card-background-color); color: var(--primary-text-color); font-size: var(--civica-font-size-small, 16px); }
:host .setting select:focus-visible { outline: 3px solid var(--ha-color-focus); outline-offset: 0; box-shadow: inset 0 0 0 2px var(--primary-text-color); }
:host .appliance-dialog { border: 1px solid var(--divider-color); border-radius: 0; background: var(--card-background-color); box-shadow: none; overflow-y: auto; }
:host .appliance-dialog::backdrop { background: color-mix(in srgb, var(--black-color) 60%, transparent); }
:host .dialog-header { padding: 20px; border-bottom-color: var(--divider-color); background: var(--card-background-color); flex-wrap: wrap; }
:host .dialog-header h2 { font-size: var(--civica-font-size-heading, 24px); }
:host .dialog-body { padding: 20px; }
:host .dialog-body .hero { margin-top: 0; }
:host .dialog-body h3 { margin-top: 30px; font-size: var(--civica-font-size-body, 19px); font-weight: 700; }
:host .dialog-body .metrics dt, :host .dialog-body .metrics dd, :host .dialog-body .detail-row, :host .dialog-body .note { font-size: var(--civica-font-size-small, 16px); }
:host .dialog-footer { padding: 0 20px 20px; }
@container (max-width: 300px) { :host .hero, :host .dialog-body .hero { grid-template-columns: minmax(0, 1fr); } :host .portrait, :host .dialog-body .portrait { max-height: 125px; } }
@container (max-width: 370px) { :host .setting { grid-template-columns: minmax(0, 1fr); } :host .setting button { justify-self: start; } }
`;

const collection = `${base}
${controls(':host footer a', ':host summary')}
:host ha-card { padding: 20px; }
:host header { gap: 15px; }
:host header > div { min-width: 0; }
:host h2 { margin-block: 5px; overflow-wrap: anywhere; }
:host .kicker, :host .sub, :host .label, :host .caption, :host .hint, :host .empty p, :host details { font-size: var(--civica-font-size-small, 16px); line-height: 1.5; text-transform: none; letter-spacing: normal; }
:host .kicker, :host .label { font-weight: 700; }
:host .calendar-icon { width: 24px; height: 24px; margin-top: 2px; border: 0; border-radius: 0; color: var(--primary-text-color); }
:host .bins { margin-block: 20px; gap: 15px; }
:host .picture { border: 0; border-radius: 0; background: transparent; }
:host .picture::after, :host .combined .label::before { border-radius: 0; }
:host .empty { border: 0; border-inline-start: 5px solid var(--divider-color); border-radius: 0; padding: 0 0 0 15px; }
:host footer { flex-wrap: wrap; gap: 15px; padding-top: 15px; border-top-color: var(--divider-color); }
:host footer a [aria-hidden="true"] { display: none; }
:host details { margin-top: 15px; }
`;

const gasSafety = `${base}
${controls(':host .gs-button', ':host .gs-details summary')}
:host ha-card.gs-card { border-radius: 0; }
:host .gs-face { padding: 20px; border-top: 0; background: var(--card-background-color); color: var(--primary-text-color); }
:host .gs-header { flex-wrap: wrap; gap: 10px 15px; }
:host .gs-heading { font-size: var(--civica-font-size-heading, 24px); font-weight: 700; line-height: 1.25; letter-spacing: normal; }
:host .gs-tag { padding: 2px 8px; border: 0; border-radius: 0; background: var(--secondary-background-color); color: var(--primary-text-color); font-size: var(--civica-font-size-small, 16px); line-height: 1.5; letter-spacing: normal; text-transform: none; white-space: normal; }
:host .gs-date-area { grid-template-columns: minmax(0, 1fr) 48px; gap: 15px; margin-block: 20px; }
:host .gs-kicker, :host .gs-weekday, :host .gs-count-label, :host .gs-recorded, :host .gs-empty-copy, :host .gs-details p, :host .gs-details dl { font-size: var(--civica-font-size-small, 16px); line-height: 1.5; color: var(--secondary-text-color); letter-spacing: normal; text-transform: none; }
:host .gs-kicker { font-weight: 700; }
:host .gs-date, :host .gs-empty, :host .gs-count-number, :host .gs-card[data-state="today"] .gs-count-number { color: var(--primary-text-color); font-size: var(--civica-font-size-heading, 24px); font-weight: 700; line-height: 1.25; letter-spacing: normal; overflow-wrap: anywhere; }
:host .gs-countdown { flex-wrap: wrap; gap: 10px 15px; padding-top: 15px; border-top: 1px solid var(--divider-color); }
:host .gs-recorded { display: flex; flex-wrap: wrap; margin-left: 0; }
:host .gs-recorded svg { width: 20px; height: 20px; }
:host .gs-card[data-state="passed"] .gs-kicker { color: var(--primary-text-color); }
:host .gs-card[data-state="passed"] .gs-tag { color: var(--primary-text-color); }
:host .gs-art { width: 48px; height: 58px; color: var(--secondary-text-color); }
:host .gs-art path[fill^="url("] { fill: currentColor; }
:host .gs-art path[fill]:not([fill^="url("]) { fill: var(--card-background-color); }
:host .gs-art path[stroke] { stroke: currentColor; }
:host .gs-foot { padding: 0 20px 20px; background: var(--card-background-color); }
:host .gs-details summary { display: flex; align-items: center; }
:host .gs-details dt { font-weight: 700; }
:host .gs-details a { color: var(--link-color); }
:host .gs-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; margin-top: 15px; }
:host .gs-button-primary { background: var(--secondary-background-color); color: var(--primary-text-color); border-color: transparent; }
@container (max-width: 370px) { :host .gs-actions { grid-template-columns: minmax(0, 1fr); } }
`;

export const LEGACY_CARD_STYLES: Readonly<Record<string, string>> = Object.freeze({
  'pa-appliance-card': appliances,
  'home-next-collection-card': collection,
  'pa-gas-safety-card': gasSafety,
});
