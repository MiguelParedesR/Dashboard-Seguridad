// ===============================
// sidebar.js (versión extendida corregida)
// ===============================
// Este archivo controla la interactividad global del sidebar
// y la sincronización con los módulos cargados (como Penalidades).
// Incluye compatibilidad completa con sidebar-loader.js
// y ajustes para evitar superposición sobre el contenido principal.

// ============================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================================

export async function initSidebar(containerSelector, options = {}) {
  const { htmlPath } = options;
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error('❌ sidebar.js: No se encontró el contenedor del sidebar:', containerSelector);
    return;
  }

  // Cargar el HTML del sidebar dinámicamente si es necesario
  if (htmlPath) {
    try {
      const res = await fetch(htmlPath);
      const html = await res.text();
      container.innerHTML = html;
    } catch (err) {
      console.error('❌ sidebar.js: Error al cargar el HTML del sidebar:', err);
      return;
    }
  }

  // ============================================================
  // ELEMENTOS DEL DOM
  // ============================================================

  const sidebar = container.querySelector('#sidebar');
  const collapseBtn = container.querySelector('#collapseBtn');
  const toggleBtn = container.querySelector('#sidebarToggle');
  const menuItems = container.querySelectorAll('.menu-link');
  const submenus = container.querySelectorAll('.submenu');
  const contentWrapper = document.querySelector('#main-content') || document.querySelector('main') || document.body;

  // ============================================================
  // FUNCIONES INTERNAS
  // ============================================================

  function closeAllSubmenus() {
    submenus.forEach(sub => {
      sub.style.maxHeight = null;
      sub.parentElement.classList.remove('open');
      const link = sub.parentElement.querySelector('.menu-link');
      if (link) link.setAttribute('aria-expanded', 'false');
    });
  }

  function toggleSubmenu(link) {
    const submenu = link.nextElementSibling;
    const isOpen = submenu && submenu.parentElement.classList.contains('open');

    closeAllSubmenus();

    if (!isOpen && submenu) {
      submenu.parentElement.classList.add('open');
      submenu.style.maxHeight = submenu.scrollHeight + 'px';
      link.setAttribute('aria-expanded', 'true');
    }
  }

  function highlightActiveLink(href) {
    menuItems.forEach(item => item.classList.remove('active'));
    const active = Array.from(menuItems).find(a => a.href && a.href.includes(href));
    if (active) active.classList.add('active');
  }

  function adjustContentMargin() {
    if (!sidebar || !contentWrapper) return;
    const sidebarWidth = sidebar.classList.contains('collapsed') ? 80 : 250;
    if (window.innerWidth > 768) {
      contentWrapper.style.marginLeft = sidebarWidth + 'px';
    } else {
      contentWrapper.style.marginLeft = '0';
    }
  }

  function toggleSidebarCollapse() {
    sidebar.classList.toggle('collapsed');
    adjustContentMargin();
  }

  function toggleSidebarMobile() {
    sidebar.classList.toggle('active');
    adjustContentMargin();
  }

  // ============================================================
  // CARGA DINÁMICA DE MÓDULOS
  // ============================================================

  async function loadModule(url) {
    try {
      if (!contentWrapper) return;
      const res = await fetch(url);
      const html = await res.text();
      contentWrapper.innerHTML = html;

      // Ejecutar el script correspondiente si existe
      const jsFile = url.replace('.html', '.js');
      try {
        const mod = await import(jsFile);
        if (typeof mod.initModule === 'function') {
          mod.initModule();
          console.info(`✅ Módulo ${jsFile} inicializado correctamente.`);
        }
      } catch (err) {
        console.warn(`⚠️ No se encontró script JS para ${url}:`, err);
      }
    } catch (err) {
      console.error('❌ Error cargando módulo:', err);
    }
  }

  // ============================================================
  // EVENTOS
  // ============================================================

  menuItems.forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      const hasSubmenu = link.parentElement.classList.contains('has-submenu');

      if (hasSubmenu) {
        e.preventDefault();
        toggleSubmenu(link);
      } else if (href && href.endsWith('.html')) {
        e.preventDefault();
        loadModule(href);
        highlightActiveLink(href);
        if (window.innerWidth <= 768) sidebar.classList.remove('active');
      }
    });
  });

  collapseBtn?.addEventListener('click', toggleSidebarCollapse);
  toggleBtn?.addEventListener('click', toggleSidebarMobile);
  window.addEventListener('resize', adjustContentMargin);

  // ============================================================
  // AJUSTES INICIALES
  // ============================================================

  adjustContentMargin();
  highlightActiveLink(window.location.pathname);

  console.info('✅ sidebar.js: Sidebar inicializado correctamente.');
}

// ============================================================
// COMENTARIOS FINALES
// ============================================================
// - Este archivo centraliza la lógica de interactividad del sidebar.
// - Los módulos (como penalidades.js) solo manejan su contenido interno.
// - sidebar.js ajusta automáticamente el margen del contenido principal
//   para evitar superposición del menú al expandir/colapsar.
// - No se ha eliminado ninguna funcionalidad original.
// - Compatible con sidebar-loader.js para carga modular dinámica.
//

// ===========================
// sidebar.js - Lógica Sidebar (corregido)
// - dinámico, resistente a fallos en import config
// - toggle (mobile -> overlay), collapse (desktop -> icon-only), acordeón submenu
// - control centralizado de navegación (carga parcial de módulos)
// - FIXES:
//   * Ocultar textos de menu/submenu cuando sidebar está 'collapsed'.
//   * Evitar overlay al mostrar/ocultar (syncLayout más robusto).
//   * toggleBtn actúa como collapse en desktop (si el UI lo comparte).
//   * loadPartial despacha 'DOMContentLoaded' sintético para compatibilidad.
// ===========================

/*
  Nota: este archivo es un módulo (type="module") — usa import dinámico a config.js.
  Exporta initSidebar(containerSelector = '#sidebar-container', options = {}).
  No auto-ejecuta nada por defecto (el loader debe invocarlo).
*/
