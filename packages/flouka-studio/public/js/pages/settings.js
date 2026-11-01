/**
 * Settings: the global defaults for the model, prompt and layout.
 */

let _settingsSectionList = null;

const SettingsPage = {
  _sectionList: null,

  show() {
    const s = Store.getSettings();
    populateModelSelect(document.getElementById('settings-model'), s.modelKey);
    document.getElementById('settings-prompt-addition').value = s.promptAddition || '';

    const fs = document.getElementById('s-font-size');
    const lh = document.getElementById('s-line-height');
    fs.value = s.baseFontSize; lh.value = s.lineHeight;
    document.getElementById('s-fs-val').textContent = fs.value + 'pt';
    document.getElementById('s-lh-val').textContent = lh.value;
    document.getElementById('s-locale').value = s.locale;

    const ul = document.getElementById('s-section-list');
    const cfgCopy = {
      sectionOrder:    [...s.sectionOrder],
      pageBreakBefore: [...s.pageBreakBefore],
      pageBreakAfter:  [...s.pageBreakAfter],
      removedSections: [...s.removedSections],
    };
    this._sectionList = createSectionList(ul, cfgCopy, () => {});
  },

  restoreSections() {
    this._sectionList?.restore();
  },

  save() {
    const secCfg = this._sectionList?.getConfig() || {};
    const settings = {
      modelKey:        document.getElementById('settings-model').value,
      promptAddition:  document.getElementById('settings-prompt-addition').value.trim(),
      baseFontSize:    parseFloat(document.getElementById('s-font-size').value),
      lineHeight:      parseFloat(document.getElementById('s-line-height').value),
      locale:          document.getElementById('s-locale').value,
      sectionOrder:    secCfg.sectionOrder    || Store.getSettings().sectionOrder,
      pageBreakBefore: secCfg.pageBreakBefore || [],
      pageBreakAfter:  secCfg.pageBreakAfter  || [],
      removedSections: secCfg.removedSections || [],
    };
    Store.setSettings(settings);
    Router.go('#dashboard');
  },
};
