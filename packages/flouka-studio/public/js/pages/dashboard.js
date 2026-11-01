/**
 * Dashboard: the card grid of job applications and their quick actions.
 */

const Dashboard = {
  show() {
    const master = Store.getMaster();
    const firstName = master?.basics?.name?.split(' ')[0] || 'there';
    document.getElementById('dash-welcome').textContent = `Welcome back, ${firstName}!`;
    this.renderApps();
  },

  renderApps() {
    const grid = document.getElementById('apps-grid');
    const apps = Store.getApps();
    if (!apps.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📝</div>
        <h3>No applications yet</h3>
        <p>Start by tailoring your resume for a specific job.</p>
        <button class="btn btn-primary" onclick="Router.go('#new')">+ New Job Application</button>
      </div>`;
      return;
    }
    grid.innerHTML = apps.map(app => {
      const score = app.jdAnalysis?.match_score;
      const badgeCls = score != null ? scoreClass(score) : 'badge-purple';
      const badgeTxt = score != null ? `${score}%` : 'Pending';
      const company = app.jdAnalysis?.company || '';
      const role    = app.jdAnalysis?.role_title || '';
      const sub     = [role, company].filter(Boolean).join(' @ ');
      return `<div class="app-card" onclick="Router.go('#app/${app.id}')">
        <div class="app-card-header">
          <div class="app-card-icon">📄</div>
          <div>
            <div class="app-card-title">${escHtml(app.name)}</div>
            <div class="app-card-sub">${escHtml(sub)}</div>
          </div>
          <span class="badge ${badgeCls}" style="margin-left:auto">${badgeTxt}</span>
        </div>
        <div class="app-card-meta">
          <span>${fmtDate(app.createdAt)}</span>
        </div>
        <div class="app-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="Router.go('#app/${app.id}')">View</button>
          <button class="btn btn-secondary btn-sm" onclick="Dashboard.quickPDF('${app.id}')">↓ PDF</button>
          <button class="btn btn-danger btn-sm" onclick="Dashboard.deleteApp('${app.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  },

   async quickPDF(id) {
    const app = Store.getApp(id);
    if (!app?.tailoredResume) return;
    try {
      const blob = await API.generatePDFBlob(app.tailoredResume, appRenderConfig(app.config));
      const fullName = resumeFileBase(app.tailoredResume);
      const company = (app.jdAnalysis?.company || '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g,'_').replace(/^_|_$/g,'');
      const filename = company ? `${fullName}_resume_${company}.pdf` : `${fullName}_resume.pdf`;
      downloadBlob(blob, filename);
    } catch(e) { alert('PDF error: ' + e.message); }
  },

  deleteApp(id) {
    if (!confirm('Delete this application?')) return;
    Store.deleteApp(id);
    this.renderApps();
  },
};
