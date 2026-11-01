/**
 * First-visit onboarding: paste, upload or build the master resume.
 */

const Onboarding = {
  method: null,
  _onbEditor: null,
  _form: null,
  _built: null,

  show() {
    // reset selection
    this.method = null;
    document.querySelectorAll('.onb-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.onb-method').forEach(m => m.classList.add('hidden'));
  },

  select(method) {
    this.method = method;
    document.querySelectorAll('.onb-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`onb-opt-${method}`)?.classList.add('selected');
    document.querySelectorAll('.onb-method').forEach(m => m.classList.add('hidden'));

    if (method === 'paste' || method === 'upload') {
      document.getElementById('onb-method-paste').classList.remove('hidden');
      this._initEditor();
      if (method === 'upload') document.getElementById('onb-file-input').click();
    } else if (method === 'build') {
      document.getElementById('onb-method-build').classList.remove('hidden');
      this._initForm();
    }
  },

  _initEditor() {
    if (this._onbEditor) { this._onbEditor.layout(); return; }
    this._onbEditor = monaco.editor.create(document.getElementById('onb-editor-container'), {
      language: 'json', theme: 'vs', automaticLayout: true,
      minimap: { enabled: false }, scrollBeyondLastLine: false,
      fontSize: 13, tabSize: 2, wordWrap: 'off',
    });
    this._onbEditor.onDidChangeModelContent(debounce(() => this._validateEditor(), 600));
    this._onbEditor.onDidFocusEditorWidget(() => document.getElementById('onb-editor-container').classList.add('focused'));
    this._onbEditor.onDidBlurEditorWidget(()  => document.getElementById('onb-editor-container').classList.remove('focused'));

    // file upload
    document.getElementById('onb-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      this._onbEditor.setValue(text);
      this._validateEditor();
    });

    // drag-and-drop on the drop zone
    const drop = document.getElementById('onb-drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#ccfbf1'; });
    drop.addEventListener('dragleave', () => { drop.style.background = ''; });
    drop.addEventListener('drop', async (e) => {
      e.preventDefault(); drop.style.background = '';
      const file = e.dataTransfer.files[0]; if (!file) return;
      const text = await file.text();
      this._onbEditor.setValue(text);
      this._validateEditor();
    });
  },

  async _validateEditor() {
    const val = document.getElementById('onb-validation');
    const text = this._onbEditor?.getValue().trim();
    if (!text) { val.innerHTML = ''; return; }
    try {
      const resume = JSON.parse(text);
      const result = await API.validate(resume);
      val.innerHTML = renderValidationBlock(result, 'Valid JSON Resume — ready to save');
    } catch (e) {
      val.innerHTML = `<div class="msg msg-error"><strong>Not valid JSON</strong><br><small>${escHtml(e.message)}</small></div>`;
    }
  },

  async save() {
    const text = this._onbEditor?.getValue().trim();
    if (!text) { alert('Please paste or upload a JSON Resume first.'); return; }
    try {
      const resume = JSON.parse(text);
      const result = await API.validate(resume);
      if (!result.valid) { alert('Please fix these problems before saving:\n\n' + validationAlertText(result)); return; }
      Store.setMaster(resume);
      Router.go('#dashboard');
    } catch(e) {
      alert('Error: ' + e.message);
    }
  },

  loadExample() {
    if (!this._onbEditor) this._initEditor();
    this._onbEditor.setValue(JSON.stringify(EXAMPLE_RESUME, null, 2));
    this._validateEditor();
  },

  // ── BUILD FROM SCRATCH ──
  _initForm() {
    if (this._form) return;
    this._form = createResumeForm(document.getElementById('onb-form-container'), (resume) => {
      this._built = resume;
      this._validateForm();
    });
    this._built = {};
  },

  async _validateForm() {
    const result = await API.validate(this._built || {});
    document.getElementById('onb-form-validation').innerHTML =
      renderValidationBlock(result, 'Valid JSON Resume — ready to save');
  },

  loadExampleForm() {
    this._initForm();
    this._built = structuredClone(EXAMPLE_RESUME);
    this._form.setResume(this._built);
    this._validateForm();
  },

  async saveForm() {
    const resume = this._form?.getResume() || {};
    const result = await API.validate(resume);
    if (!result.valid) {
      alert('Please fix these problems before saving:\n\n' + validationAlertText(result));
      return;
    }
    Store.setMaster(resume);
    Router.go('#dashboard');
  },
};
