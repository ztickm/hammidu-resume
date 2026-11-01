/**
 * Application detail: the editor tabs, PDF preview and chat sidebar.
 */

const _configPreviewDebounced = debounce(() => AppDetail._loadPreview(), 800);

const AppDetail = {
  _id: null,
  _tab: 'form',
  _editor: null,
  _form: null,
  _formJson: null,
  _sectionList: null,
  _previewLoaded: false,
  _chatHistory: [],
  _chatOpen: false,
  _chatModel: 'claude-sonnet-4-6',

  show(id) {
    const app = Store.getApp(id);
    if (!app) { Router.go('#dashboard'); return; }
    this._id = id;

    // Update header
    document.getElementById('app-title').textContent = app.name;
    const score = app.jdAnalysis?.match_score;
    const badge = document.getElementById('app-match-badge');
    if (score != null) {
      badge.className = `badge ${scoreClass(score)}`;
      badge.textContent = `${score}% match`;
    } else {
      badge.textContent = '';
    }

    // Reset chat state for this app
    this._chatHistory = [];
    this._chatOpen = false;
    document.getElementById('chat-sidebar').classList.remove('open');

    this._formJson = null;
    this._loadPreview();
    this.setTab('form');
  },

  setTab(tab) {
    this._tab = tab;
    // update tab buttons (scoped — the master resume page has its own tab bar)
    document.querySelectorAll('#pg-app .app-mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    // hide all views
    ['form','edit','configure','info'].forEach(v => {
      document.getElementById(`app-view-${v}`)?.classList.remove('active');
    });
    document.getElementById(`app-view-${tab}`)?.classList.add('active');

    if (tab === 'form')      this._initForm();
    if (tab === 'edit')      this._initEdit();
    if (tab === 'configure') this._initConfigure();
    if (tab === 'info')      this._renderInfo();
  },

  async _loadPreview() {
    const app = Store.getApp(this._id);
    if (!app?.tailoredResume) return;
    const loading = document.getElementById('preview-loading');
    const frame   = document.getElementById('app-preview-frame');
    loading.classList.remove('hidden'); frame.classList.add('hidden');
    try {
      const blob = await API.generatePDFBlob(app.tailoredResume, appRenderConfig(app.config));
      const url = URL.createObjectURL(blob);
      frame.src = url;
      frame.onload = () => {
        loading.classList.add('hidden');
        frame.classList.remove('hidden');
      };
    } catch(e) {
      loading.textContent = 'Preview error: ' + e.message;
    }
  },

  // Both editing tabs write through this editor, so it has to exist before
  // either of them is opened — not just the JSON one.
  _ensureEditor() {
    if (this._editor) return;
    this._editor = monaco.editor.create(document.getElementById('app-editor-container'), {
      language: 'json', theme: 'vs', automaticLayout: true,
      minimap: { enabled: false }, scrollBeyondLastLine: false,
      fontSize: 13, tabSize: 2,
    });
    this._editor.onDidChangeModelContent(debounce(() => {
      this._validateEdit();
      try {
        const resume = JSON.parse(this._editor.getValue());
        Store.updateApp(this._id, { tailoredResume: resume });
        _configPreviewDebounced();
      } catch {}
    }, 800));
  },

  _initEdit() {
    const app = Store.getApp(this._id);
    if (!app) return;
    this._ensureEditor();
    this._editor.setValue(JSON.stringify(app.tailoredResume, null, 2));
    this._editor.layout();
    document.getElementById('app-edit-validation').textContent = 'Edit the resume JSON. Click Save when done.';
  },

  // Feeding the form's result through the editor keeps one persistence path:
  // the editor's own change handler saves and refreshes the preview.
  _initForm() {
    const app = Store.getApp(this._id);
    if (!app) return;
    this._ensureEditor();
    if (!this._form) {
      this._form = createResumeForm(document.getElementById('app-form-container'), (resume) => {
        this._formJson = JSON.stringify(resume);
        this._editor.setValue(JSON.stringify(resume, null, 2));
      });
    }
    const json = JSON.stringify(app.tailoredResume || {});
    if (json !== this._formJson) {
      this._form.setResume(app.tailoredResume || {});
      this._formJson = json;
    }
  },

  formExpand(open) { this._form?.setAllOpen(open); },

  async _validateEdit() {
    let html;
    try {
      const resume = JSON.parse(this._editor.getValue());
      const result = await API.validate(resume);
      html = renderValidationInline(result);
    } catch(e) {
      html = `<span style="color:var(--red)">✗ Not valid JSON: ${escHtml(e.message)}</span>`;
    }
    // Both editing tabs show the same verdict.
    document.getElementById('app-edit-validation').innerHTML = html;
    document.getElementById('app-form-msg').innerHTML = html;
  },

  async saveEdit() {
    const text = this._editor?.getValue();
    if (!text) return;
    try {
      const resume = JSON.parse(text);
      const result = await API.validate(resume);
      if (!result.valid) {
        alert('Please fix these problems before saving:\n\n' + validationAlertText(result));
        return;
      }
      Store.updateApp(this._id, { tailoredResume: resume });
      this._loadPreview();
    } catch(e) {
      alert('JSON parse error: ' + e.message);
    }
  },

  _initConfigure() {
    const app = Store.getApp(this._id);
    if (!app) return;

    // Set slider values
    const fs = document.getElementById('cfg-font-size');
    const lh = document.getElementById('cfg-line-height');
    const lc = document.getElementById('cfg-locale');
    fs.value = app.config?.baseFontSize ?? 12;
    lh.value = app.config?.lineHeight ?? 1.5;
    lc.value = app.config?.locale ?? 'en';
    document.getElementById('cfg-fs-val').textContent = fs.value + 'pt';
    document.getElementById('cfg-lh-val').textContent = lh.value;

    // Init section list
    const ul = document.getElementById('cfg-section-list');
    const cfgCopy = { ...app.config };
    this._sectionList = createSectionList(ul, cfgCopy, (updated) => {
      Store.updateApp(this._id, {
        config: { ...app.config, ...updated }
      });
      _configPreviewDebounced();
    });
  },

  configChanged() {
    const app = Store.getApp(this._id);
    if (!app) return;
    const fs = parseFloat(document.getElementById('cfg-font-size').value);
    const lh = parseFloat(document.getElementById('cfg-line-height').value);
    const lc = document.getElementById('cfg-locale').value;
    document.getElementById('cfg-fs-val').textContent = fs + 'pt';
    document.getElementById('cfg-lh-val').textContent = lh;
    const updated = { ...app.config, baseFontSize: fs, lineHeight: lh, locale: lc };
    Store.updateApp(this._id, { config: updated });
    _configPreviewDebounced();
  },

  restoreSections() {
    this._sectionList?.restore();
  },

  _renderInfo() {
    const app = Store.getApp(this._id);
    const jd = app?.jdAnalysis;
    if (!jd) { document.getElementById('info-match').textContent = '—'; return; }

    document.getElementById('info-match').textContent   = jd.match_score != null ? `${jd.match_score}%` : '—';
    document.getElementById('info-role').textContent    = jd.role_title  || '—';
    document.getElementById('info-company').textContent = jd.company     || '—';

    const gaps = document.getElementById('info-gaps');
    gaps.innerHTML = (jd.gaps || []).map(g => `<span class="gap-tag">${escHtml(g)}</span>`).join('') || '<span class="text-muted">None identified</span>';

    const skills = document.getElementById('info-skills');
    skills.innerHTML = (jd.required_skills || []).map(s => `<span class="skill-tag">${escHtml(s)}</span>`).join('');

    const resp = document.getElementById('info-responsibilities');
    resp.innerHTML = (jd.key_responsibilities || []).map(r => `<li>${escHtml(r)}</li>`).join('');
  },

  toggleChat() {
    this._chatOpen = !this._chatOpen;
    const sidebar = document.getElementById('chat-sidebar');
    sidebar.classList.toggle('open', this._chatOpen);
    if (this._chatOpen && this._chatHistory.length === 0) this._initChat();
  },

  _initChat() {
    const app = Store.getApp(this._id);
    if (!app) return;
    this._chatHistory = app.chatHistory || [];
    populateModelSelect(document.getElementById('chat-model-select'), this._chatModel);
    this._renderChat();
  },

  chatModelChanged() {
    this._chatModel = document.getElementById('chat-model-select').value;
  },

  _renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = this._chatHistory.map(msg => {
      if (msg.role === 'notice') {
        return `<div class="chat-notice">${escHtml(msg.content)}</div>`;
      }
      const bubbleContent = msg.role === 'assistant'
        ? renderMd(msg.content)
        : `<p style="margin:0">${escHtml(msg.content)}</p>`;
      return `<div class="chat-msg chat-msg-${msg.role}"><div class="chat-bubble">${bubbleContent}</div></div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  },

  async sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const app = Store.getApp(this._id);
    if (!app) return;

    this._chatHistory.push({ role: 'user', content: text });
    input.value = '';
    this._renderChat();

    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;
    btn.textContent = '…';

    // Build the messages array for the API (exclude notice entries)
    const apiMessages = this._chatHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const data = await API.chat(
        app.tailoredResume,
        app.jd,
        app.jdAnalysis,
        apiMessages,
        this._chatModel
      );

      this._chatHistory.push({ role: 'assistant', content: data.reply });

      if (data.updated_resume) {
        Store.updateApp(this._id, { tailoredResume: data.updated_resume, chatHistory: this._chatHistory });
        this._chatHistory.push({ role: 'notice', content: '✓ Resume updated' });
      } else {
        Store.updateApp(this._id, { chatHistory: this._chatHistory });
      }
    } catch(e) {
      this._chatHistory.push({ role: 'assistant', content: `Sorry, something went wrong: ${e.message}` });
      Store.updateApp(this._id, { chatHistory: this._chatHistory });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send';
      this._renderChat();
    }
  },

  chatKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendChat();
    }
  },

  toggleDownload() { toggleDropdown('dl-dropdown'); },

   async downloadPDF() {
    document.getElementById('dl-menu').classList.remove('open');
    const app = Store.getApp(this._id);
    if (!app?.tailoredResume) return;
    try {
      const blob = await API.generatePDFBlob(app.tailoredResume, appRenderConfig(app.config));
      const fullName = resumeFileBase(app.tailoredResume);
      const company = (app.jdAnalysis?.company || '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g,'_').replace(/^_|_$/g, '');
      const filename = company ? `${fullName}_resume_${company}.pdf` : `${fullName}_resume.pdf`;
      downloadBlob(blob, filename);
    } catch(e) { alert('PDF error: ' + e.message); }
  },

  downloadJSON() {
    document.getElementById('dl-menu').classList.remove('open');
    const app = Store.getApp(this._id);
    if (!app?.tailoredResume) return;
    const name = resumeFileBase(app.tailoredResume);
    downloadBlob(new Blob([JSON.stringify(app.tailoredResume, null, 2)], { type: 'application/json' }), `${name}_resume.json`);
  },

  async downloadHTML() {
    document.getElementById('dl-menu').classList.remove('open');
    const app = Store.getApp(this._id);
    if (!app?.tailoredResume) return;
    try {
      const blob = await API.generateHTMLBlob(app.tailoredResume, appRenderConfig(app.config));
      const name = resumeFileBase(app.tailoredResume);
      downloadBlob(blob, `${name}_resume.html`);
    } catch(e) { alert('HTML error: ' + e.message); }
  },

  del() {
    if (!confirm('Delete this application? This cannot be undone.')) return;
    Store.deleteApp(this._id);
    Router.go('#dashboard');
  },
};
