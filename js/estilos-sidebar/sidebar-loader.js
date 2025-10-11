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
