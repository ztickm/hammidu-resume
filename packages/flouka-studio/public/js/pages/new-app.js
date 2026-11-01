/**
 * New job application: paste a job description and tailor the resume to it.
 */

const NewApp = {
  show() {
    const settings = Store.getSettings();
    populateModelSelect(document.getElementById('new-model-select'), settings.modelKey);
    document.getElementById('new-prompt-addition').value = settings.promptAddition || '';
    document.getElementById('jd-textarea').value = '';
    document.getElementById('new-company').value = '';
    document.getElementById('new-role').value = '';
    document.getElementById('tailor-status').className = 'tailor-status';
    document.getElementById('tailor-btn').disabled = false;
    document.getElementById('blank-btn').disabled = false;
  },

  /** Layout config for a new application — a snapshot of the global settings. */
  _configFromSettings() {
    const settings = Store.getSettings();
    return {
      sectionOrder:    [...settings.sectionOrder],
      pageBreakBefore: [...settings.pageBreakBefore],
      pageBreakAfter:  [...settings.pageBreakAfter],
      removedSections: [...settings.removedSections],
      baseFontSize:    settings.baseFontSize,
      lineHeight:      settings.lineHeight,
      locale:          settings.locale,
    };
  },

  /** Company/role typed by the user — they override whatever the AI inferred. */
  _manualAnalysis() {
    return {
      company:    document.getElementById('new-company').value.trim(),
      role_title: document.getElementById('new-role').value.trim(),
    };
  },

  // Start an application from the master resume verbatim — no AI, no JD needed.
  // The resume is still fully editable (and chattable) on the detail page.
  createUntailored() {
    const master = Store.getMaster();
    if (!master) { Router.go('#onboarding'); return; }

    const manual = this._manualAnalysis();
    const jdAnalysis = (manual.company || manual.role_title) ? manual : null;

    const app = Store.addApp({
      id: uid(),
      name: deriveAppName(master, jdAnalysis),
      createdAt: new Date().toISOString(),
      jd: document.getElementById('jd-textarea').value.trim(),
      jdAnalysis,
      tailoredResume: JSON.parse(JSON.stringify(master)),
      chatHistory: [],
      config: this._configFromSettings(),
    });
    Router.go(`#app/${app.id}`);
  },

  async submit() {
    const jd = document.getElementById('jd-textarea').value.trim();
    if (!jd) { alert('Please paste a job description.'); return; }

    const master = Store.getMaster();
    if (!master) { Router.go('#onboarding'); return; }

    const model = document.getElementById('new-model-select').value;
    const promptAddition = document.getElementById('new-prompt-addition').value.trim();

    const btn      = document.getElementById('tailor-btn');
    const blankBtn = document.getElementById('blank-btn');
    const status   = document.getElementById('tailor-status');
    btn.disabled = true;
    blankBtn.disabled = true;
    status.className = 'tailor-status running';
    status.textContent = `🤖 Analysing JD and tailoring resume with ${model}… (~30s)`;

    try {
      const data = await API.tailor(master, jd, model, promptAddition);
      const manual = this._manualAnalysis();
      const jdAnalysis = {
        ...data.jd_analysis,
        company:    manual.company    || data.jd_analysis?.company    || '',
        role_title: manual.role_title || data.jd_analysis?.role_title || '',
      };
      const app = Store.addApp({
        id: uid(),
        name: deriveAppName(master, jdAnalysis),
        createdAt: new Date().toISOString(),
        jd,
        jdAnalysis,
        tailoredResume: data.tailored_resume,
        chatHistory: [],
        config: this._configFromSettings(),
      });
      Router.go(`#app/${app.id}`);
    } catch(e) {
      status.className = 'tailor-status error';
      status.textContent = `❌ ${e.message}`;
      btn.disabled = false;
      blankBtn.disabled = false;
    }
  },
};
