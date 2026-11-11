import '../dist/civica-ui.js';
const palettes = await fetch('../../design-system/palettes.json').then(r => r.json());
const source = await fetch('../../design-system/themes.json').then(r => r.json());
// Filled from the same generated values as the installed theme, not a hand-
// maintained visual approximation. Normalise the machine contract here only.
const themes = source.themes || source;
const app = document.querySelector('home-assistant');
app.attachShadow({mode:'open'});
app.hass = { themes: { themes, theme: 'civica Civic Cobalt Vivid', darkMode: false }, selectedTheme: { theme: 'civica Civic Cobalt Vivid', dark: false } };
window.events = [];
function paint() {
  const theme = themes[app.hass.selectedTheme.theme];
  const vars = { ...theme, ...theme.modes?.[app.hass.selectedTheme.dark ? 'dark' : 'light'] };
  for (const [key, value] of Object.entries(vars)) if (typeof value === 'string' || typeof value === 'number') document.documentElement.style.setProperty(`--${key}`, String(value));
  app.hass.themes.theme = app.hass.selectedTheme.theme;
  app.hass.themes.darkMode = app.hass.selectedTheme.dark;
  for (const palette of palettes.palettes) for (const tone of palettes.tones) {
    if (app.hass.themes.theme === `civica ${palette.name} ${tone[0].toUpperCase()}${tone.slice(1)}`) document.querySelector('header img').src = `../../brand/civica/themes/${palette.id}/${tone}/lockup-on-primary.svg`;
  }
  document.querySelector('civica-theme-settings').hass = app.hass;
}
document.addEventListener('settheme', e => { window.events.push(e.detail); app.hass.selectedTheme = { ...app.hass.selectedTheme, ...e.detail }; paint(); });
document.getElementById('mode').onclick = e => { app.hass.selectedTheme.dark = !app.hass.selectedTheme.dark; e.target.textContent = app.hass.selectedTheme.dark ? 'Use light mode' : 'Use dark mode'; paint(); };
paint();
await import('../../card/dist/govuk-house-lighting-card.js');
const card = document.createElement('govuk-house-lighting-card');
card.setConfig({type:'custom:govuk-house-lighting-card', image:'../../card/assets/floorplan.png'});
card.hass = {states:{},entities:{},devices:{},callService:async()=>{}};
document.getElementById('lighting').append(card);
window.fixture = { app, themes, paint };
