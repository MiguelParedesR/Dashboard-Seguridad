// ===============================
// sidebar-loader.js
// - Carga dinámica del sidebar y sus estilos.
// - Funciona en todos los módulos HTML sin duplicar código.
// ===============================

const CSS_HREF = '../../css/estilos-sidebar/sidebar.css';
const FA_HREF = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
const SIDEBAR_HTML_PATH = '../../html/base/sidebar.html';
const SIDEBAR_MODULE = '../../js/estilos-sidebar/sidebar.js';

/**
 * Inyecta un <link> si no existe
 */
async function ensureLink(href, attrs = {}) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  for (const k in attrs) link.setAttribute(k, attrs[k]);
  document.head.appendChild(link);
}

/**
 * Carga e inicializa el sidebar
 */
(async () => {
  try {
    // 1️⃣ Asegurar CSS y FontAwesome
    await ensureLink(CSS_HREF, { crossorigin: 'anonymous' });
    await ensureLink(FA_HREF, { crossorigin: 'anonymous', referrerpolicy: 'no-referrer' });

    // 2️⃣ Crear contenedor si no existe
    let container = document.getElementById('sidebar-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sidebar-container';
      // insertarlo al inicio del body
      document.body.insertAdjacentElement('afterbegin', container);
    }

    // 3️⃣ Importar el módulo sidebar.js
    // Antes de importar el módulo, inyectamos únicamente el markup necesario
    // para evitar ejecutar scripts presentes en el HTML (que podrían re-importar
    // modules y duplicar la inicialización).
    try {
      const resp = await fetch(SIDEBAR_HTML_PATH, { cache: 'no-cache' });
      if (resp.ok) {
        const text = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const sidebarEl = doc.querySelector('#sidebar');
        const toggleEl = doc.querySelector('#sidebarToggle');
        // Remove any existing to avoid duplicates
        const existingSidebar = document.getElementById('sidebar');
        if (existingSidebar) existingSidebar.remove();
        const existingToggle = document.getElementById('sidebarToggle');
        if (existingToggle) existingToggle.remove();

        if (sidebarEl) container.insertAdjacentElement('afterbegin', sidebarEl);
        if (toggleEl) container.insertAdjacentElement('beforeend', toggleEl);
      } else {
        console.warn('sidebar-loader: no se pudo obtener el HTML del sidebar, status=', resp.status);
      }
    } catch (err) {
      console.warn('sidebar-loader: error al obtener HTML del sidebar:', err?.message ?? err);
    }

    const mod = await import(SIDEBAR_MODULE);
    const initSidebar = mod.initSidebar ?? mod.default ?? null;

    if (typeof initSidebar === 'function') {
      await initSidebar('#sidebar-container', {
        htmlPath: SIDEBAR_HTML_PATH
      });
      console.info('✅ sidebar-loader: Sidebar inicializado correctamente.');
    } else {
      console.warn('⚠️ sidebar-loader: No se encontró initSidebar exportado en', SIDEBAR_MODULE);
    }
  } catch (err) {
    console.error('❌ sidebar-loader: Fallo al inicializar el sidebar:', err);
  }
})();
