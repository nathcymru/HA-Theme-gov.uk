// Earlier HA frontends can start extra_module_url before installing their
// scoped custom-element registry. Wait for the app definition before importing
// anything that registers components or installs the companion lifecycle.
// Current HA also guards extra modules; this remains safe after that boundary.
await customElements.whenDefined('home-assistant');
await import('./civica-ui');
export {};
