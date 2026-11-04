// Only Home Assistant theme variables supplied by themes/govuk.yaml. No hex colours, no !important.
export const STYLES = `
:host { display: block; }
ha-card { font-family: var(--ha-font-family-body); color: var(--primary-text-color); }
.body { padding: 16px; }
.title { margin: 0 0 8px; font-size: var(--ha-card-header-font-size, 24px); font-weight: var(--ha-font-weight-heading, 700); }
.status { margin: 0 0 16px; color: var(--secondary-text-color); }
.actions { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.btn { font: inherit; font-weight: 700; min-height: 44px; padding: 8px 16px; cursor: pointer; border: 2px solid var(--primary-color); border-radius: 0;
  background: var(--primary-color); color: var(--text-primary-color); box-shadow: 0 2px 0 var(--ha-color-primary-10); }
.btn:hover { background: var(--ha-color-primary-30); border-color: var(--ha-color-primary-30); }
.btn--secondary { background: var(--card-background-color); color: var(--primary-text-color); border-color: var(--primary-text-color); box-shadow: none; }
.btn--secondary:hover { background: var(--divider-color); }
.btn--warning { background: var(--error-color); border-color: var(--error-color); color: var(--text-primary-color); }
.btn--small { min-width: 88px; }
.btn--icon { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; padding: 8px; }
.btn:disabled, .tile:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:focus-visible, .tab:focus-visible, .tile:focus-visible { outline: var(--wa-focus-ring-width, 3px) solid var(--ha-color-focus); outline-offset: 0; box-shadow: 0 4px 0 var(--primary-text-color); }
.rooms { margin: 0 0 24px; padding: 0; }
.row { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--divider-color); }
.key { font-weight: 700; margin: 0; }
.sub { display: block; font-weight: 400; color: var(--secondary-text-color); }
.sub:empty { display: none; }
.act { margin: 0; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
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
.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--divider-color); margin-bottom: 16px; }
.tab { font: inherit; padding: 12px 16px; min-height: 44px; border: 1px solid var(--divider-color); border-bottom: 0; border-radius: 0; background: var(--secondary-background-color); color: var(--primary-text-color); cursor: pointer; }
.tab[aria-selected=true] { background: var(--card-background-color); font-weight: 700; border-top: 4px solid var(--primary-color); }
.panels { flex: 1; min-height: 0; overflow: auto; padding: 8px; }
.tiles { list-style: none; margin: 0 0 16px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, 64px); gap: 12px; }
.tile { position: relative; display: block; width: 64px; height: 64px; padding: 0; cursor: pointer; overflow: hidden; background: var(--card-background-color); border: 2px solid var(--primary-text-color); border-radius: 0; }
.tile[aria-pressed=true] { outline: 4px solid var(--primary-text-color); outline-offset: 2px; }
.swatch { position: absolute; inset: 0; display: block; }
.tile-icon { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); object-fit: contain; pointer-events: none; }
.hint { margin: 0 0 16px; font-size: 14px; color: var(--secondary-text-color); }
.dlg-close { align-self: flex-start; margin-top: 16px; }
`;
