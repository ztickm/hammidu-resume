/**
 * A form view over the resume JSON, so a resume can be edited without touching
 * braces. Every section is described once in RF_SECTIONS (resume-form-schema.js) and onboarding,
 * the master resume page and each application mount the same component, rather
 * than hand-writing three sets of inputs that drift apart.
 *
 * The form never owns the data: it hands a cleaned resume to `onChange` and the
 * host decides where that goes (the Monaco editor, the Store, the preview).
 * Fields the schema does not cover — `meta`, `$schema`, `basics.image` — survive
 * editing because the form mutates the resume it was given instead of rebuilding
 * it from the inputs.
 */

// ── Path / value helpers ───────────────────────────────────────────────────
const rfBlank = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

function rfGet(obj, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), obj);
}

/** Writes `value` at a dotted path, creating missing parents. Blank values
 *  delete the key instead of leaving `""` behind — the validator warns about
 *  empty emails and URLs, so the form must not invent them. */
function rfSet(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const key of keys) {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  if (rfBlank(value)) delete node[last];
  else node[last] = value;
}

/** Turns a control's value into the JSON shape its field expects. */
function rfParse(type, raw) {
  if (type === 'lines') return raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (type === 'tags')  return raw.split(',').map(s => s.trim()).filter(Boolean);
  return raw.trim() === '' ? '' : raw;
}

/** Deep copy with blanks, empty lists and emptied objects dropped, so a
 *  half-filled form never leaks `{}` entries into the saved resume. */
function rfClean(value) {
  if (Array.isArray(value)) {
    return value.map(rfClean).filter(v => !rfBlank(v) && !rfEmptyObject(v));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const clean = rfClean(raw);
      if (rfBlank(clean) || rfEmptyObject(clean)) continue;
      out[key] = clean;
    }
    return out;
  }
  return typeof value === 'string' ? value.trim() : value;
}

function rfEmptyObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;
}

/** A pasted profile URL lands in `username`; split it back apart and fill in
 *  the URL for a bare username on a network we know. */
function rfFillProfileUrls(resume) {
  for (const profile of resume?.basics?.profiles || []) {
    if (/^https?:\/\//i.test(profile.username || '')) {
      profile.url ||= profile.username;
      profile.username = profile.url.replace(/\/+$/, '').split('/').pop();
    }
    if (profile.url || !profile.username) continue;
    const base = RF_PROFILE_URLS[String(profile.network || '').toLowerCase().replace(/\s+/g, '')];
    if (base) profile.url = base + String(profile.username).replace(/^[@/]+/, '');
  }
  return resume;
}

function rfDates(start, end) {
  if (!start && !end) return '';
  return `${start || '?'} → ${end || 'present'}`;
}

// ── The component ──────────────────────────────────────────────────────────
// Entry identity lives in a WeakMap keyed by the item object itself, so a
// collapsed/expanded entry keeps its state across reorders and removals, where
// an array index would silently point at its neighbour.
const _rfIds = new WeakMap();
let _rfIdSeq = 0;
function rfId(item) {
  if (!_rfIds.has(item)) _rfIds.set(item, `rf${++_rfIdSeq}`);
  return _rfIds.get(item);
}

function createResumeForm(host, onChange) {
  const root = document.createElement('div');
  root.className = 'rf';
  host.replaceChildren(root);

  let data = {};
  const openSections = new Set(['basics', 'work']);
  const openEntries  = new Set();
  const notify = debounce(() => onChange?.(rfFillProfileUrls(rfClean(data))), 250);

  // ── HTML ──
  function controlHtml(field, path) {
    const value = rfGet(data, path);
    const attrs = `data-path="${path}" data-ftype="${field.type || 'text'}"`;
    const ph = `placeholder="${escHtml(field.ph || (field.type === 'date' ? 'YYYY-MM' : ''))}"`;

    if (field.type === 'textarea' || field.type === 'lines') {
      const text = field.type === 'lines' ? (Array.isArray(value) ? value.join('\n') : '') : value;
      return `<textarea class="form-textarea" rows="${field.rows || 3}" ${attrs} ${ph}>${escHtml(text)}</textarea>`;
    }
    const text = field.type === 'tags' ? (Array.isArray(value) ? value.join(', ') : '') : value;
    if (!field.suggest) return `<input class="form-input" ${attrs} ${ph} value="${escHtml(text)}">`;
    // A datalist suggests the usual answers without rejecting anything else.
    const listId = `rf-dl-${path.replace(/\W/g, '-')}`;
    return `<input class="form-input" ${attrs} ${ph} list="${listId}" value="${escHtml(text)}">
      <datalist id="${listId}">${field.suggest.map(s => `<option value="${escHtml(s)}">`).join('')}</datalist>`;
  }

  function fieldHtml(field, base) {
    const hint = field.hint ? ` <small class="rf-hint">(${escHtml(field.hint)})</small>` : '';
    return `<div class="form-group">
      <label class="form-label">${escHtml(field.label)}${hint}</label>
      ${controlHtml(field, base ? `${base}.${field.key}` : field.key)}
    </div>`;
  }

  // Two `half` fields share a row; everything else runs full width.
  function fieldsHtml(fields, base) {
    let html = '', pair = [];
    const flush = () => {
      if (pair.length) html += pair.length === 2 ? `<div class="form-row">${pair.join('')}</div>` : pair[0];
      pair = [];
    };
    for (const field of fields) {
      if (!field.half) { flush(); html += fieldHtml(field, base); continue; }
      pair.push(fieldHtml(field, base));
      if (pair.length === 2) flush();
    }
    flush();
    return `<div class="rf-fields">${html}</div>`;
  }

  function entryHtml(section, item, index) {
    const id = rfId(item);
    const title = section.itemTitle(item);
    return `<div class="rf-entry${openEntries.has(id) ? ' open' : ''}" data-entry="${id}">
      <div class="rf-entry-head">
        <span class="rf-entry-grip" title="Drag to reorder">⠿</span>
        <span class="rf-entry-label${title ? '' : ' empty'}">${escHtml(title || section.blank)}</span>
        <span class="rf-entry-sub">${escHtml(section.itemSub?.(item))}</span>
        <button class="rf-entry-del" title="Remove">✕</button>
      </div>
      <div class="rf-entry-body">${fieldsHtml(section.fields, `${section.path}.${index}`)}</div>
    </div>`;
  }

  function sectionHtml(section) {
    let count = '', body;
    if (section.kind === 'array') {
      const items = rfList(section);
      count = `<span class="rf-count">${items.length}</span>`;
      body = `<div class="rf-entries">${items.map((item, i) => entryHtml(section, item, i)).join('')}</div>
        ${items.length ? '' : '<div class="rf-empty">Nothing here yet.</div>'}
        <button class="btn btn-secondary btn-sm mt-12" data-add="1">+ ${escHtml(section.add)}</button>`;
    } else {
      body = fieldsHtml(section.fields, section.path);
    }
    return `<div class="rf-section${openSections.has(section.path) ? ' open' : ''}" data-section="${section.path}">
      <div class="rf-section-head">
        <span class="rf-chevron">▶</span>
        <span>${section.icon}</span>
        <span class="rf-section-title">${escHtml(section.title)}</span>
        ${count}
      </div>
      <div class="rf-section-body">${body}</div>
    </div>`;
  }

  function render() {
    root.innerHTML = RF_SECTIONS.map(sectionHtml).join('');
  }

  // ── Lookups shared by the event handlers ──
  /** The section's array, tolerating a resume where that key holds junk. */
  function rfList(section) {
    const value = rfGet(data, section.path);
    return Array.isArray(value) ? value : [];
  }
  const sectionOf = (el) => RF_SECTIONS.find(s => s.path === el.closest('.rf-section')?.dataset.section);
  const indexOf   = (entry) => [...entry.parentElement.children].indexOf(entry);

  // ── Events — delegated, so a re-render needs no rebinding ──
  root.addEventListener('input', (e) => {
    const { path, ftype } = e.target.dataset;
    if (!path) return;
    rfSet(data, path, rfParse(ftype, e.target.value));
    refreshEntryHead(e.target);
    notify();
  });

  // Keeps a collapsed entry's summary line in step with the fields inside it.
  function refreshEntryHead(el) {
    const entry = el.closest('.rf-entry');
    if (!entry) return;
    const section = sectionOf(entry);
    const item = rfList(section)[indexOf(entry)] || {};
    const title = section.itemTitle(item);
    const label = entry.querySelector('.rf-entry-label');
    label.textContent = title || section.blank;
    label.classList.toggle('empty', !title);
    entry.querySelector('.rf-entry-sub').textContent = section.itemSub?.(item) || '';
  }

  root.addEventListener('click', (e) => {
    const section = sectionOf(e.target);
    if (!section) return;

    if (e.target.closest('.rf-entry-del')) {
      const items = rfList(section);
      items.splice(indexOf(e.target.closest('.rf-entry')), 1);
      rfSet(data, section.path, items);
      render(); notify();
      return;
    }
    if (e.target.closest('[data-add]')) {
      const item = {};
      rfSet(data, section.path, [...rfList(section), item]);
      openSections.add(section.path);
      openEntries.add(rfId(item));
      render(); notify();
      root.querySelector(`[data-entry="${rfId(item)}"] .form-input`)?.focus();
      return;
    }
    const entryHead = e.target.closest('.rf-entry-head');
    if (entryHead) {
      const entry = entryHead.closest('.rf-entry');
      const id = entry.dataset.entry;
      openEntries.has(id) ? openEntries.delete(id) : openEntries.add(id);
      entry.classList.toggle('open');
      return;
    }
    if (e.target.closest('.rf-section-head')) {
      const open = openSections.has(section.path);
      open ? openSections.delete(section.path) : openSections.add(section.path);
      e.target.closest('.rf-section').classList.toggle('open', !open);
    }
  });

  // ── Reordering entries ──
  // An entry is only draggable while the mouse is down on its header. A permanently draggable
  // card swallows mousedowns in its inputs, so text in them could not be selected.
  root.addEventListener('mousedown', (e) => {
    const head = e.target.closest('.rf-entry-head');
    if (head && !e.target.closest('.rf-entry-del')) head.parentElement.draggable = true;
  });
  root.addEventListener('mouseup', () => {
    root.querySelectorAll('.rf-entry[draggable="true"]').forEach(el => el.removeAttribute('draggable'));
  });
  root.addEventListener('dragstart', (e) => {
    const entry = e.target.closest?.('.rf-entry');
    if (!entry || !entry.draggable) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');  // Firefox won't start a drag without data
    entry.classList.add('dragging');
  });
  root.addEventListener('dragover', (e) => {
    const list = e.target.closest?.('.rf-entries');
    const dragging = root.querySelector('.rf-entry.dragging');
    if (!list || !dragging || !list.contains(dragging)) return;
    e.preventDefault();
    const after = getDragAfter(list, e.clientY, '.rf-entry');
    if (after == null) list.appendChild(dragging);
    else list.insertBefore(dragging, after);
  });
  root.addEventListener('dragend', () => {
    const dragging = root.querySelector('.rf-entry.dragging');
    if (!dragging) return;
    dragging.classList.remove('dragging');
    dragging.removeAttribute('draggable');
    const order = [...dragging.parentElement.children].map(el => el.dataset.entry);
    rfList(sectionOf(dragging)).sort((a, b) => order.indexOf(rfId(a)) - order.indexOf(rfId(b)));
    render(); notify();
  });

  render();

  return {
    /** Replaces everything on show; the form works on a copy, never the caller's object. */
    setResume(resume) {
      data = resume && typeof resume === 'object' ? structuredClone(resume) : {};
      render();
    },
    getResume() { return rfFillProfileUrls(rfClean(data)); },
    setAllOpen(open) {
      openSections.clear();
      openEntries.clear();
      if (open) {
        for (const section of RF_SECTIONS) {
          openSections.add(section.path);
          if (section.kind === 'array') rfList(section).forEach(item => openEntries.add(rfId(item)));
        }
      }
      render();
    },
  };
}
