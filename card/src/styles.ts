// Only Home Assistant theme variables supplied by themes/govuk.yaml. No hex colours, no !important.
export const STYLES = `
:host { display: block; }
ha-card { font-family: var(--ha-font-family-body); color: var(--primary-text-color); }
.body { padding: 16px; }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 15px; margin-bottom: 8px; }
.title { margin: 0; font-size: var(--ha-card-header-font-size, 24px); font-weight: var(--ha-font-weight-heading, 700); }
.status { margin: 0 0 16px; font-size: var(--ha-font-size-s, 14px); color: var(--secondary-text-color); }
.actions { display: flex; flex-wrap: wrap; gap: 15px; }
/* GOV.UK button: theme body size (19px), weight 400, 2px border, padding 8px 10px 7px = 38px + 2px shadow, matching --ha-button-height. */
.btn { font: inherit; font-size: var(--ha-font-size-m, 19px); font-weight: 400; line-height: 1; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin: 0; padding: 8px 10px 7px; cursor: pointer; text-align: center; vertical-align: top; border: 2px solid transparent; border-radius: 0;
  background: var(--primary-color); color: var(--text-primary-color); box-shadow: 0 2px 0 var(--ha-color-primary-10); }
.btn:hover { background: var(--ha-color-primary-30); }
.btn:active { top: 2px; }
.btn--secondary { background: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); }
.btn--secondary:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
.btn--warning { background: var(--error-color); color: var(--text-primary-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 55%, var(--error-color)); }
.btn--warning:hover { background: color-mix(in srgb, var(--primary-text-color) 20%, var(--error-color)); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:disabled:hover { background: var(--primary-color); }
.btn--secondary:disabled:hover { background: var(--secondary-background-color); }
.btn:disabled:active { top: 0; }
.btn-icon { flex: none; }
.btn[hidden] { display: none; }
.btn:focus-visible:not(:active):not(:hover), .btn:focus:not(:active):not(:hover) { outline: 3px solid transparent; border-color: var(--ha-color-focus); color: var(--primary-text-color); background: var(--ha-color-focus); box-shadow: 0 2px 0 var(--primary-text-color); }
.tab:focus-visible, .tile:focus-visible { outline: 3px solid transparent; background: var(--ha-color-focus); color: var(--primary-text-color); box-shadow: 0 -2px var(--ha-color-focus), 0 4px var(--primary-text-color); }
.tile:focus-visible { outline: var(--wa-focus-ring-width, 3px) solid var(--ha-color-focus); box-shadow: 0 4px 0 var(--primary-text-color); }
.rooms { margin: 0 0 24px; padding: 0; }
.row { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--divider-color); }
.key { font-weight: 700; margin: 0; }
.sub { display: block; font-weight: 400; font-size: var(--ha-font-size-s, 14px); line-height: 1.25; color: var(--secondary-text-color); }
.sub:empty { display: none; }
.act { margin: 0; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.plan { display: block; width: 100%; height: auto; }
.shade { transition: opacity 0.3s; }
.shade--off { fill: var(--primary-text-color); opacity: 0.45; }
.shade--lit { opacity: 0.28; mix-blend-mode: soft-light; }
.hit { fill: transparent; stroke: none; cursor: pointer; }
.hit:hover { fill: var(--ha-color-focus); fill-opacity: 0.18; }
.hit:focus-visible { outline: none; stroke: var(--ha-color-focus); stroke-width: 8px; fill: var(--ha-color-focus); fill-opacity: 0.18; }
.dlg { width: min(640px, 92vw); height: min(520px, 90vh); box-sizing: border-box; flex-direction: column; max-width: none; border: var(--ha-border-width-lg, 4px) solid var(--primary-text-color); border-radius: 0; padding: 24px; background: var(--card-background-color); color: var(--primary-text-color); font-family: var(--ha-font-family-body); }
.dlg[open] { display: flex; }
.dlg--auto { height: auto; }
.dlg::backdrop { background: var(--primary-text-color); opacity: 0.6; }
.dlg-title { margin: 0 0 16px; font-size: 24px; }
.tabs { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0 5px; padding: 5px 0 0; border-bottom: 1px solid var(--divider-color); margin-bottom: 16px; }
.tab { font: inherit; font-size: var(--ha-font-size-m, 19px); line-height: 1.25; padding: 10px 20px; border: 0; border-radius: 0; background: var(--secondary-background-color); color: var(--primary-text-color); text-decoration: underline; text-underline-offset: 0.1578em; cursor: pointer; }
.tab:hover { text-decoration-thickness: max(3px, 0.1875rem, 0.12em); }
.tab[aria-selected=true] { margin: -5px 0 -1px; padding: 14px 19px 16px; border: 1px solid var(--divider-color); border-bottom: 0; background: var(--card-background-color); text-decoration: none; }
.panels { flex: 1; min-height: 0; overflow: auto; padding: 8px; }
.tiles { list-style: none; margin: 0 0 16px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, 64px); gap: 12px; }
.tile:disabled { opacity: 0.5; cursor: not-allowed; }
.tile { position: relative; display: block; width: 64px; height: 64px; padding: 0; cursor: pointer; overflow: hidden; background: var(--card-background-color); border: 2px solid var(--primary-text-color); border-radius: 0; }
.tile[aria-pressed=true] { outline: 4px solid var(--primary-text-color); outline-offset: 2px; }
.swatch { position: absolute; inset: 0; display: block; }
.tile-icon { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); object-fit: contain; pointer-events: none; }
.error-summary { padding: 15px; margin-bottom: 30px; border: 5px solid var(--error-color); color: var(--primary-text-color); }
.error-summary:focus { outline: 3px solid var(--ha-color-focus); }
.error-summary__title { margin: 0 0 15px; font-size: 18px; line-height: 1.1111; font-weight: 700; }
.error-summary__list { margin: 0; padding: 0; list-style: none; font-weight: 700; }
.error-summary__list li { margin: 0; }
.acc { margin-top: 24px; border-top: 1px solid var(--divider-color); border-bottom: 1px solid var(--divider-color); }
.acc-heading { margin: 0; }
.acc-btn { font: inherit; font-weight: 700; display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 15px; box-sizing: border-box; padding: 15px 0; border: 0; border-radius: 0; background: none; color: var(--primary-text-color); text-align: left; cursor: pointer; }
.acc-btn:hover { background: var(--secondary-background-color); }
.acc-btn:focus-visible { outline: 3px solid transparent; background: var(--ha-color-focus); box-shadow: inset 0 -4px 0 var(--primary-text-color); }
.acc-state { font-weight: 400; color: var(--link-color); text-decoration: underline; }
.rooms--unavailable { margin: 0; }
.rooms--unavailable .row:last-child { border-bottom: 0; }
.hint { margin: 0 0 16px; font-size: 14px; color: var(--secondary-text-color); }
.dlg-close { align-self: flex-start; margin-top: 16px; }
.actions--dialog { margin-top: 16px; }
`;
