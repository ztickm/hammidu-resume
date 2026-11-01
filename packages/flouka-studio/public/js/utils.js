/**
 * Helpers shared across pages. Load this before the pages: app-detail.js and
 * master.js call debounce() while they load, and function declarations do not
 * hoist across script files.
 */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Validation rendering ───────────────────────────────────────────────────
// The API returns { valid, issues:[{path,message,severity}], errors, warnings }.
// Older shapes are normalised here so we never fall back to a bare "Invalid".
function validationIssues(result) {
  if (Array.isArray(result?.issues) && result.issues.length) return result.issues;
  const issues = [];
  (result?.errors || []).forEach(e => issues.push({
    path: e.path || '', message: e.message || 'is invalid', severity: 'error',
  }));
  (result?.warnings || []).forEach(w => issues.push({
    path: '', message: typeof w === 'string' ? w : (w.message || 'is invalid'), severity: 'warning',
  }));
  return issues;
}

/** Plain-text reasons, for alert() dialogs. */
function validationAlertText(result) {
  const issues = validationIssues(result);
  if (!issues.length) return 'The resume is invalid, but the validator returned no details.';
  return issues
    .map(i => `• ${i.path ? i.path + ' ' : ''}${i.message}`)
    .join('\n');
}

function issueLine(issue) {
  const path = issue.path ? `<code>${escHtml(issue.path)}</code> ` : '';
  return `${path}${escHtml(issue.message)}`;
}

/** Inline (toolbar) rendering: one-line summary that expands to every reason. */
function renderValidationInline(result) {
  if (result?.valid) return '<span style="color:var(--teal-dark)">✓ Valid JSON Resume</span>';
  const issues = validationIssues(result);
  if (!issues.length) {
    return '<span style="color:var(--red)">✗ Invalid JSON Resume (no details returned)</span>';
  }
  const items = issues.map(i => `<li style="margin:2px 0">${issueLine(i)}</li>`).join('');
  const label = issues.length === 1
    ? issueLine(issues[0])
    : `${issues.length} problems — ${issueLine(issues[0])}`;
  return `<details style="color:var(--red)">
    <summary style="cursor:pointer;list-style:revert">✗ ${label}</summary>
    <ul style="margin:6px 0 2px;padding-left:20px;color:var(--red)">${items}</ul>
  </details>`;
}

/** Block rendering: full message box listing every reason. */
function renderValidationBlock(result, successText) {
  if (result?.valid) {
    return `<div class="msg msg-success">✓ ${escHtml(successText || 'Valid JSON Resume')}</div>`;
  }
  const issues = validationIssues(result);
  if (!issues.length) {
    return '<div class="msg msg-error"><strong>Invalid JSON Resume</strong><br><small>No details returned by the validator.</small></div>';
  }
  const items = issues
    .map(i => `<li style="margin:3px 0">${issueLine(i)}</li>`)
    .join('');
  return `<div class="msg msg-error">
    <strong>Invalid JSON Resume — ${issues.length} problem${issues.length === 1 ? '' : 's'}</strong>
    <ul style="margin:6px 0 0;padding-left:20px">${items}</ul>
  </div>`;
}

function scoreClass(n) {
  if (n >= 80) return 'badge-green';
  if (n >= 60) return 'badge-yellow';
  return 'badge-red';
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); } catch { return iso; }
}

function deriveAppName(resume, jdAnalysis) {
  const name = resume?.basics?.name || 'Resume';
  const role = jdAnalysis?.role_title || '';
  const company = jdAnalysis?.company || '';
  if (role && company) return `${name} — ${role} @ ${company}`;
  if (company) return `${name} @ ${company}`;
  if (role) return `${name} — ${role}`;
  return name;
}

function populateModelSelect(selectEl, currentVal) {
  selectEl.innerHTML = MODEL_OPTIONS.map(m =>
    `<option value="${m.value}"${m.value === currentVal ? ' selected' : ''}>${m.label}</option>`
  ).join('');
}

/** Open/close a `.dropdown` menu, closing it again on the next outside click. */
function toggleDropdown(dropdownId) {
  const root = document.getElementById(dropdownId);
  const menu = root?.querySelector('.dropdown-menu');
  if (!menu) return;
  menu.classList.toggle('open');
  const close = (e) => {
    if (!root.contains(e.target)) {
      menu.classList.remove('open');
      document.removeEventListener('click', close);
    }
  };
  if (menu.classList.contains('open')) setTimeout(() => document.addEventListener('click', close), 0);
}

/** `Jane Doe` → `Jane_Doe`, for use in download filenames. */
function resumeFileBase(resume) {
  return (resume?.basics?.name || 'resume').replace(/\s+/g, '_');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Render config ──────────────────────────────────────────────────────────
function appRenderConfig(cfg) {
  return {
    sectionOrder:    cfg?.sectionOrder,
    pageBreakBefore: cfg?.pageBreakBefore,
    pageBreakAfter:  cfg?.pageBreakAfter,
    baseFontSize:    cfg?.baseFontSize,
    lineHeight:      cfg?.lineHeight,
    locale:          cfg?.locale,
  };
}

// ── Escaping and markdown ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMd(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code style="background:rgba(0,0,0,0.07);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/^[-*•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul style="margin:4px 0 6px;padding-left:18px">${m}</ul>`)
    .replace(/\n\n+/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
