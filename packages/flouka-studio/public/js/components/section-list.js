/**
 * Reusable drag-and-drop list of resume sections.
 */

function createSectionList(ulEl, initConfig, onChange) {
  let removed = [...(initConfig.removedSections || [])];
  let dragged = null;

  function render() {
    ulEl.innerHTML = '';
    const order = initConfig.sectionOrder || ALL_SECTIONS;
    order.forEach(sec => {
      const li = document.createElement('li');
      li.className = 'section-item';
      li.draggable = true;
      li.dataset.section = sec;
      const breakBefore = (initConfig.pageBreakBefore || []).includes(sec);
      const breakAfter  = (initConfig.pageBreakAfter  || []).includes(sec);
      li.innerHTML = `
        <span class="section-drag-handle">⠿</span>
        <span class="section-name">${sec}</span>
        <div class="section-breaks">
          <label class="break-label"><input type="checkbox" class="brk-before" data-sec="${sec}"${breakBefore?' checked':''}> <span>Before</span></label>
          <label class="break-label"><input type="checkbox" class="brk-after"  data-sec="${sec}"${breakAfter ?' checked':''}> <span>After</span></label>
        </div>
        <button class="section-remove" title="Hide section" onclick="sectionListRemove('${sec}',this)">✕</button>
      `;
      // checkbox change
      li.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { notifyChange(); }));
      ulEl.appendChild(li);
    });
    setupDND();
  }

  // expose remove to inline onclick (scoped via closure trick via dataset)
  ulEl.dataset.listId = uid();
  window._sectionLists = window._sectionLists || {};
  window._sectionLists[ulEl.dataset.listId] = { remove: removeSection, restore };

  function removeSection(sec) {
    removed.push(sec);
    initConfig.sectionOrder = (initConfig.sectionOrder || []).filter(s => s !== sec);
    initConfig.removedSections = [...removed];
    render();
    notifyChange();
  }

  function restore() {
    const toRestore = [...removed];
    removed = [];
    initConfig.sectionOrder = [...(initConfig.sectionOrder || []), ...toRestore];
    initConfig.removedSections = [];
    render();
    notifyChange();
  }

  function getConfig() {
    const items = [...ulEl.querySelectorAll('.section-item')].map(i => i.dataset.section);
    const before = [...ulEl.querySelectorAll('.brk-before:checked')].map(i => i.dataset.sec);
    const after  = [...ulEl.querySelectorAll('.brk-after:checked')].map(i => i.dataset.sec);
    return {
      sectionOrder: items,
      pageBreakBefore: before,
      pageBreakAfter: after,
      removedSections: [...removed],
    };
  }

  function notifyChange() {
    const cfg = getConfig();
    // sync back into initConfig so restore() sees latest order
    initConfig.sectionOrder = cfg.sectionOrder;
    initConfig.removedSections = cfg.removedSections;
    initConfig.pageBreakBefore = cfg.pageBreakBefore;
    initConfig.pageBreakAfter  = cfg.pageBreakAfter;
    if (onChange) onChange(cfg);
  }

  function setupDND() {
    ulEl.addEventListener('dragstart', e => {
      if (e.target.classList.contains('section-item')) {
        dragged = e.target; e.target.classList.add('dragging');
      }
    });
    ulEl.addEventListener('dragend', e => {
      if (e.target.classList.contains('section-item')) {
        e.target.classList.remove('dragging');
        notifyChange();
      }
    });
    ulEl.addEventListener('dragover', e => {
      e.preventDefault();
      const after = getDragAfter(ulEl, e.clientY);
      const drag = ulEl.querySelector('.dragging');
      if (!drag) return;
      if (after == null) ulEl.appendChild(drag);
      else ulEl.insertBefore(drag, after);
    });
  }

  render();
  return { getConfig, restore };
}

function getDragAfter(container, y, selector = '.section-item') {
  return [...container.querySelectorAll(`${selector}:not(.dragging)`)].reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const off = y - box.top - box.height / 2;
    return off < 0 && off > closest.off ? { off, el: child } : closest;
  }, { off: -Infinity, el: null }).el;
}

// Global remove handler (called from inline onclick in section list items)
function sectionListRemove(sec, btn) {
  const ul = btn.closest('.section-list');
  if (!ul?.dataset.listId) return;
  window._sectionLists[ul.dataset.listId]?.remove(sec);
}
