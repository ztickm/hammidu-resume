/**
 * Hash router: maps the URL to a page object and shows onboarding while no
 * master resume exists.
 */

const Router = {
  go(hash) { window.location.hash = hash; },
  init() {
    window.addEventListener('hashchange', () => Router._render());
    Router._render();
  },
  _render() {
    const hash = window.location.hash.slice(1) || '';
    const hasMaster = !!Store.getMaster();
    if (!hasMaster) { Router._show('onboarding'); Onboarding.show(); return; }
    if (hash === 'settings') { Router._show('settings'); SettingsPage.show(); return; }
    if (hash === 'resume')   { Router._show('resume'); MasterResumePage.show(); return; }
    if (hash === 'new')      { Router._show('new'); NewApp.show(); return; }
    if (hash.startsWith('app/')) {
      const id = hash.slice(4);
      Router._show('app');
      AppDetail.show(id);
      return;
    }
    Router._show('dashboard');
    Dashboard.show();
  },
  _show(name) {
    document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
    document.getElementById(`pg-${name}`)?.classList.add('active');
    // Close any open dropdowns
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  },
};
