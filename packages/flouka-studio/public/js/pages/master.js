/**
 * Master resume: the form and JSON editors, layout settings and live preview.
 */

const MasterResumePage = {
  _editor: null,
  _form: null,
  _formJson: null,
  _sectionList: null,

  show() {
    const master = Store.getMaster();
    if (!this._editor) {
      this._editor = monaco.editor.create(document.getElementById('master-editor-container'), {
        language: 'json', theme: 'vs', automaticLayout: true,
        minimap: { enabled: false }, scrollBeyondLastLine: false,
        fontSize: 13, tabSize: 2,
      });
      this._editor.onDidChangeModelContent(debounce(() => {
        this._validate();
        _masterPreviewDebounced();
      }, 600));
    }
    this._editor.setValue(master ? JSON.stringify(master, null, 2) : '');
    this._editor.layout();
    document.getElementById('master-validation').textContent = 'Your base resume — used as the foundation for all AI tailoring.';
    this._formJson = null;
    this.setTab('form');
    this._loadPreview();
  },

  setTab(tab) {
    document.querySelectorAll('#pg-resume .app-mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    ['form','edit','configure'].forEach(v => {
      document.getElementById(`master-view-${v}`)?.classList.toggle('active', v === tab);
    });
    if (tab === 'form')      this._initForm();
    if (tab === 'edit')      this._editor?.layout();
    if (tab === 'configure') this._initConfigure();
  },

  // The form edits the same resume as the JSON tab. Writing its result into the
  // editor means validation, the preview and Save all keep working unchanged.
  _initForm() {
    if (!this._form) {
      this._form = createResumeForm(document.getElementById('master-form-container'), (resume) => {
        this._formJson = JSON.stringify(resume);
        this._editor.setValue(JSON.stringify(resume, null, 2));
      });
    }
    const json = JSON.stringify(this._currentResume() || {});
    if (json !== this._formJson) {
      this._form.setResume(JSON.parse(json));
      this._formJson = json;
    }
  },

  formExpand(open) { this._form?.setAllOpen(open); },

  _initConfigure() {
    const s = Store.getMasterConfig();
    const fs = document.getElementById('m-cfg-font-size');
    const lh = document.getElementById('m-cfg-line-height');
    document.getElementById('m-cfg-locale').value = s.locale;
    fs.value = s.baseFontSize;
    lh.value = s.lineHeight;
    document.getElementById('m-cfg-fs-val').textContent = fs.value + 'pt';
    document.getElementById('m-cfg-lh-val').textContent = lh.value;

    const cfgCopy = {
      sectionOrder:    [...s.sectionOrder],
      pageBreakBefore: [...s.pageBreakBefore],
      pageBreakAfter:  [...s.pageBreakAfter],
      removedSections: [...s.removedSections],
    };
    this._sectionList = createSectionList(document.getElementById('m-cfg-section-list'), cfgCopy, (updated) => {
      Store.setMasterConfig({ ...Store.getMasterConfig(), ...updated });
      this._renderConfigOrigin();
      _masterPreviewDebounced();
    });
    this._renderConfigOrigin();
  },

  /** Says whether the master resume is following the global defaults or its own config. */
  _renderConfigOrigin() {
    const custom = Store.hasMasterConfig();
    document.getElementById('m-cfg-origin').innerHTML = custom
      ? 'This resume uses its own layout. Changes here do <strong>not</strong> affect the defaults for new applications.'
      : 'Following the global defaults from Settings. Editing anything here gives the master resume its own layout instead.';
    document.getElementById('m-cfg-reset').classList.toggle('hidden', !custom);
  },

  resetConfig() {
    if (!confirm('Discard the master resume\'s own layout and follow the global defaults again?')) return;
    Store.resetMasterConfig();
    this._initConfigure();
    this._loadPreview();
  },

  configChanged() {
    const fs = parseFloat(document.getElementById('m-cfg-font-size').value);
    const lh = parseFloat(document.getElementById('m-cfg-line-height').value);
    const lc = document.getElementById('m-cfg-locale').value;
    document.getElementById('m-cfg-fs-val').textContent = fs + 'pt';
    document.getElementById('m-cfg-lh-val').textContent = lh;
    Store.setMasterConfig({ ...Store.getMasterConfig(), baseFontSize: fs, lineHeight: lh, locale: lc });
    this._renderConfigOrigin();
    _masterPreviewDebounced();
  },

  restoreSections() {
    this._sectionList?.restore();
  },

  /** What the editor currently holds, falling back to the saved master. */
  _currentResume() {
    try {
      const text = this._editor?.getValue().trim();
      if (text) return JSON.parse(text);
    } catch { /* unparseable — fall through to the saved copy */ }
    return Store.getMaster();
  },

  async _validate() {
    let html;
    try {
      const resume = JSON.parse(this._editor.getValue());
      const result = await API.validate(resume);
      html = renderValidationInline(result);
    } catch(e) {
      html = `<span style="color:var(--red)">✗ Not valid JSON: ${escHtml(e.message)}</span>`;
    }
    // Both editing tabs show the same verdict.
    document.getElementById('master-validation').innerHTML = html;
    document.getElementById('master-form-msg').innerHTML = html;
  },

  // Renders the editor contents — not the saved copy — so unsaved edits show up.
  async _loadPreview() {
    const loading = document.getElementById('master-preview-loading');
    const frame   = document.getElementById('master-preview-frame');
    const resume  = this._currentResume();
    if (!resume) return;
    loading.textContent = 'Generating preview…';
    loading.classList.remove('hidden'); frame.classList.add('hidden');
    try {
      const blob = await API.generatePDFBlob(resume, appRenderConfig(Store.getMasterConfig()));
      frame.src = URL.createObjectURL(blob);
      frame.onload = () => {
        loading.classList.add('hidden');
        frame.classList.remove('hidden');
      };
    } catch(e) {
      loading.textContent = 'Preview error: ' + e.message;
    }
  },

  async save() {
    const text = this._editor?.getValue().trim();
    if (!text) { alert('Resume is empty.'); return; }
    try {
      const resume = JSON.parse(text);
      const result = await API.validate(resume);
      if (!result.valid) { alert('Please fix these problems before saving:\n\n' + validationAlertText(result)); return; }
      Store.setMaster(resume);
      Router.go('#dashboard');
    } catch(e) { alert(e.message); }
  },

  uploadFile(e) {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(text => {
      this._editor?.setValue(text);
      this._validate();
    });
  },

  toggleDownload() { toggleDropdown('master-dl-dropdown'); },

  downloadJSON() {
    document.getElementById('master-dl-menu').classList.remove('open');
    const master = this._currentResume(); if (!master) return;
    downloadBlob(new Blob([JSON.stringify(master, null, 2)], { type: 'application/json' }), `${resumeFileBase(master)}_master.json`);
  },

  async downloadPDF() {
    document.getElementById('master-dl-menu').classList.remove('open');
    const master = this._currentResume(); if (!master) return;
    try {
      const blob = await API.generatePDFBlob(master, appRenderConfig(Store.getMasterConfig()));
      downloadBlob(blob, `${resumeFileBase(master)}_resume.pdf`);
    } catch(e) { alert('PDF error: ' + e.message); }
  },

  async downloadHTML() {
    document.getElementById('master-dl-menu').classList.remove('open');
    const master = this._currentResume(); if (!master) return;
    try {
      const blob = await API.generateHTMLBlob(master, appRenderConfig(Store.getMasterConfig()));
      downloadBlob(blob, `${resumeFileBase(master)}_resume.html`);
    } catch(e) { alert('HTML error: ' + e.message); }
  },
};

const _masterPreviewDebounced = debounce(() => MasterResumePage._loadPreview(), 900);
