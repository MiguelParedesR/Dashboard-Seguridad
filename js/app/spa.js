(() => {
  const DEFAULT_VIEW = 'html/base/dashboard.html';

  function getInitialView() {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/')) {
      return hash.slice(2);
    }
    return DEFAULT_VIEW;
  }

  function loadInitialView() {
    const view = getInitialView();
    if (window.__sidebar?.loadPartial) {
      window.__sidebar.loadPartial(view, true);
      return;
    }
    window.location.href = view;
  }

  if (window.__sidebar?.loadPartial) {
    loadInitialView();
  } else {
    document.addEventListener('sidebar:ready', loadInitialView, { once: true });
  }
})();
