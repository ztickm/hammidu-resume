/**
 * Persisted on the server (packages/flouka-studio/storage.ts) so data survives
 * browser storage being cleared. `_cache` is hydrated once at boot (see
 * main.js) and kept in sync synchronously; writes are debounced and sent to
 * the server in the background so no call site needs to be async.
 */

const Store = {
  _cache: { flouka_master: null, flouka_master_config: null, flouka_settings: null, flouka_apps: null },
  _timers: {},

  async hydrate() {
    try {
      const data = await (await fetch('/api/store')).json();
      Object.assign(this._cache, data);
      this._cache.flouka_apps ??= [];
      this._migrateFromLocalStorage();
    } catch (e) {
      console.error('[Store] hydrate failed, starting with empty state', e);
    }
  },

  // One-time migration for users who already had data in localStorage before
  // this change shipped. Only fills gaps — never overwrites server data.
  _migrateFromLocalStorage() {
    if (localStorage.getItem('flouka_migrated_v1')) return;
    const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    if (this._cache.flouka_master == null) { const m = lsGet('flouka_master'); if (m) this.setMaster(m); }
    if (this._cache.flouka_settings == null) { const s = lsGet('flouka_settings'); if (s) this.setSettings(s); }
    if (!this._cache.flouka_apps?.length) { const a = lsGet('flouka_apps'); if (Array.isArray(a) && a.length) this.setApps(a); }
    localStorage.setItem('flouka_migrated_v1', '1');
  },

  getMaster()   { return this._cache.flouka_master; },
  setMaster(r)  { this._set('flouka_master', r); },

  // The master resume has its own layout config, independent of the global
  // settings. While none has been saved it simply follows the global defaults;
  // the first edit on the Configure tab snapshots them and takes over from there.
  hasMasterConfig()   { return this._cache.flouka_master_config != null; },
  resetMasterConfig() { this._set('flouka_master_config', null); },
  getMasterConfig() {
    const s = this.getSettings();
    const defaults = {
      sectionOrder:    [...s.sectionOrder],
      pageBreakBefore: [...s.pageBreakBefore],
      pageBreakAfter:  [...s.pageBreakAfter],
      removedSections: [...s.removedSections],
      baseFontSize:    s.baseFontSize,
      lineHeight:      s.lineHeight,
      locale:          s.locale,
    };
    return { ...defaults, ...(this._cache.flouka_master_config || {}) };
  },
  setMasterConfig(c) { this._set('flouka_master_config', c); },

  getSettings() { return { ...DEFAULT_SETTINGS, ...(this._cache.flouka_settings || {}) }; },
  setSettings(s){ this._set('flouka_settings', s); },
  getApps()     { return this._cache.flouka_apps || []; },
  setApps(a)    { this._set('flouka_apps', a); },
  getApp(id)    { return this.getApps().find(a => a.id === id) || null; },
  addApp(app)   { const apps = this.getApps(); apps.unshift(app); this.setApps(apps); return app; },
  updateApp(id, patch) {
    const apps = this.getApps();
    const i = apps.findIndex(a => a.id === id);
    if (i >= 0) { apps[i] = { ...apps[i], ...patch }; this.setApps(apps); }
  },
  deleteApp(id) { this.setApps(this.getApps().filter(a => a.id !== id)); },

  _set(key, value) {
    this._cache[key] = value;
    clearTimeout(this._timers[key]);
    this._timers[key] = setTimeout(() => {
      fetch(`/api/store/${key}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      }).catch((e) => console.error(`[Store] failed to persist ${key}`, e));
    }, 500);
  },
};
