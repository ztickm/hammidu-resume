/**
 * Bootstrap: load Monaco and hydrate the store, then start the router. Load this last.
 */

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
const monacoReady = new Promise((resolve) => { require(['vs/editor/editor.main'], resolve); });
Promise.all([monacoReady, Store.hydrate()]).then(() => {
  Router.init();
});
