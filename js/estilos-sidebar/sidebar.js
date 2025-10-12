// sidebar.js - Lógica Sidebar (corregido)
// - dinámico, resistente a fallos en import config
// - toggle (mobile -> overlay), collapse (desktop -> icon-only), acordeón submenu
// - control centralizado de navegación (carga parcial de módulos)
// - FIXES:
//   * Ocultar textos de menu/submenu cuando sidebar está 'collapsed'.
//   * toggleBtn actúa como collapse en desktop (si el UI lo comparte).
//   * loadPartial despacha 'DOMContentLoaded' sintético para compatibilidad.
// ===========================

/*
  Nota: este archivo es un módulo (type="module") — usa import dinámico a config.js.
  Exporta initSidebar(containerSelector = '#sidebar-container', options = {}).
  No auto-ejecuta nada por defecto (el loader debe invocarlo).
*/

export async function initSidebar(containerSelector = '#sidebar-container', options = {}) {
  // -------------------------
  // opciones y defaults
  // -------------------------
  const htmlPath = options.htmlPath ?? '../../html/base/sidebar.html';
  const createIfMissing = options.createIfMissing ?? true;
  const toggleSelector = options.toggleSelector ?? '#sidebarToggle';
  const collapseSelector = options.collapseSelector ?? '#collapseBtn';
  const mainSelectorPriority = options.mainSelector ?? null; // si se pasa, se respeta tal cual
  const extractSelector = options.extractSelector ?? 'main'; // selector para extraer contenido del HTML cargado
  const enableRouting = options.enableRouting ?? true; // controla comportamiento SPA parcial
  const DESKTOP_BREAK = options.desktopBreakpoint ?? 1024;

  // clases que puede utilizar tu CSS
  const BODY_CLASS_SIDEBAR_COLLAPSED = options.bodyCollapsedClass ?? 'sidebar-collapsed';
  const BODY_CLASS_SIDEBAR_OPEN = options.bodyOpenClass ?? 'sidebar-open';

  // -------------------------
  // resolver containerSelector
  // -------------------------
  let container;
  if (typeof containerSelector === 'string') {
    container = document.querySelector(containerSelector);
    if (!container && createIfMissing && containerSelector === '#sidebar-container') {
      container = document.createElement('div');
      container.id = 'sidebar-container';
      document.body.insertAdjacentElement('afterbegin', container);
    }
    if (!container && (containerSelector === 'body' || containerSelector === 'document.body')) {
      container = document.body;
    }
  } else if (containerSelector instanceof Element) {
    container = containerSelector;
  }

  if (!container) {
    console.warn(`sidebar.js: initSidebar no encontró el contenedor ${containerSelector}. Abortando inicialización.`);
    return;
  }

  // -------------------------
  // cargar HTML si hace falta
  // -------------------------
  try {
    if (!container.querySelector('#sidebar')) {
      const resp = await fetch(htmlPath);
      if (!resp.ok) throw new Error(`No se pudo cargar ${htmlPath} (status ${resp.status})`);
      container.insertAdjacentHTML('afterbegin', await resp.text());
    }
  } catch (err) {
    console.error('sidebar.js: error al cargar el HTML del sidebar:', err);
    return;
  }

  // -------------------------
  // IIFE principal (para usar await internamente)
  // -------------------------
  (async () => {
    let supabase = null;
    try {
      const cfg = await import('../../config.js');
      supabase = cfg.supabase ?? cfg.default?.supabase ?? null;
    } catch (err) {
      console.warn('sidebar.js: no se pudo importar config.js (ok en dev).', err?.message ?? err);
    }

    // -------------------------
    // elementos UI
    // -------------------------
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector(toggleSelector);
    const collapseBtn = document.querySelector(collapseSelector);
    if (!sidebar) {
      console.error('sidebar.js: no se encontró #sidebar en el DOM. Abortando inicialización.');
      return;
    }

    // Evitar doble inicialización
    if (sidebar.dataset.sidebarInitialized === '1') {
      if (window.innerWidth > DESKTOP_BREAK) sidebar.classList.add('show');
      return;
    }
    sidebar.dataset.sidebarInitialized = '1';

    // -------------------------
    // detectar mainContainer (donde inyectar contenido parcial)
    // -------------------------
    let mainContainer = null;
    if (mainSelectorPriority) mainContainer = document.querySelector(mainSelectorPriority);
    if (!mainContainer) {
      mainContainer = document.querySelector('main.wrap') || document.querySelector('main') || document.querySelector('.dashboard-content') || document.querySelector('#dashboardContent');
    }
    // contentWrapper: elemento sobre el que aplicamos margin-left; conserva fallback robusto
    let contentWrapper = mainContainer || document.querySelector('#main-content') || document.querySelector('main') || document.querySelector('.dashboard-content') || document.querySelector('#dashboardContent') || document.body;

    // -------------------------
    // helpers
    // -------------------------
    function resolveUrl(base, url) {
      try {
        return new URL(url, base).href;
      } catch (err) {
        return url;
      }
    }
    function isDesktop() {
      return window.innerWidth > DESKTOP_BREAK;
    }

    // -------------------------
    // Estado "collapsed" (icon-only) — encapsulado
    // - oculta textos <span> dentro de .menu-link
    // - oculta submenus (display:none) para que no se muestren fuera de contexto
    // - aplica/remueve clase global en body para que tu CSS pueda ajustarse también
    // -------------------------
    function applyCollapsedState(collapsed) {
      if (collapsed) {
        sidebar.classList.add('collapsed');
        document.body.classList.add(BODY_CLASS_SIDEBAR_COLLAPSED);
        // hide label spans
        const links = sidebar.querySelectorAll('.menu .menu-link');
        links.forEach(link => {
          // ocultar solo los spans-label inmediatos (no ocultar badges u otros spans no-label)
          const spans = Array.from(link.children).filter(ch => ch.tagName === 'SPAN');
          spans.forEach(span => {
            // guardamos estado previo para restaurar
            if (span.dataset._prevDisplay === undefined) span.dataset._prevDisplay = span.style.display || '';
            span.style.display = 'none';
          });
        });
        // ocultar submenus para evitar overflow / sobreposición visual
        const submenus = sidebar.querySelectorAll('.submenu');
        submenus.forEach(sm => {
          if (sm.dataset._prevDisplay === undefined) sm.dataset._prevDisplay = sm.style.display || '';
          // forzar cerrado
          sm.style.maxHeight = '0px';
          sm.style.overflow = 'hidden';
          sm.style.display = 'none';
        });
      } else {
        sidebar.classList.remove('collapsed');
        document.body.classList.remove(BODY_CLASS_SIDEBAR_COLLAPSED);
        // restore label spans
        const links = sidebar.querySelectorAll('.menu .menu-link');
        links.forEach(link => {
          const spans = Array.from(link.children).filter(ch => ch.tagName === 'SPAN');
          spans.forEach(span => {
            const prev = span.dataset._prevDisplay ?? '';
            if (prev !== undefined) {
              span.style.display = prev || '';
              delete span.dataset._prevDisplay;
            } else {
              span.style.display = '';
            }
          });
        });
        // restore submenus: quitamos estilos inline que forzamos en collapsed
        const submenus = sidebar.querySelectorAll('.submenu');
        submenus.forEach(sm => {
          // quitamos los estilos que pusimos (dejamos que CSS controle)
          if (sm.dataset._prevDisplay !== undefined) {
            sm.style.display = sm.dataset._prevDisplay || '';
            delete sm.dataset._prevDisplay;
          } else {
            sm.style.display = '';
          }
          sm.style.maxHeight = '';
          sm.style.overflow = '';
          sm.style.transition = '';
        });
      }
      // After changing collapsed state, ensure layout recalculated
      adjustContentMargin();
    }

    // -------------------------
    // Ajusta layout para que el sidebar no se sobreponga en desktop.
    // - Aplica margin-left al mainContainer cuando sidebar visible y no colapsado en desktop.
    // - Añade clase BODY_CLASS_SIDEBAR_OPEN en móvil cuando sidebar está abierto (overlay).
    // -------------------------
    // syncLayout kept for backward compatibility but delegates to adjustContentMargin
    function syncLayout() {
      try {
        adjustContentMargin();
        // ensure mobile overlay class active only when sidebar is shown and not desktop
        if (!isDesktop() && sidebar.classList.contains('show')) {
          document.body.classList.add(BODY_CLASS_SIDEBAR_OPEN);
        } else {
          document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
        }

        // reflect collapsed state on body (keep parity)
        if (isDesktop() && sidebar.classList.contains('collapsed')) {
          document.body.classList.add(BODY_CLASS_SIDEBAR_COLLAPSED);
        } else {
          document.body.classList.remove(BODY_CLASS_SIDEBAR_COLLAPSED);
        }
      } catch (err) {
        console.warn('sidebar.js syncLayout err', err);
      }
    }

    // -------------------------
    // Inicial visibilidad y estado collapsed si ya presente
    // -------------------------
    if (isDesktop()) {
      sidebar.classList.add('show');
    } else {
      sidebar.classList.remove('show');
    }
    // Si el HTML inicial trae 'collapsed', aplicar efectos
    if (sidebar.classList.contains('collapsed')) {
      applyCollapsedState(true);
    }
    adjustContentMargin();

    // -------------------------
    // TOGGLE (mobile). Comportamiento adaptativo:
    // - en desktop: toggleBtn actuará como 'collapse' (icon-only).
    // - en mobile: toggleBtn actúa como overlay show/hide.
    // -------------------------
    if (toggleBtn) {
      const onToggle = (e) => {
        e.stopPropagation();
        if (isDesktop()) {
          // en desktop usamos collapse (icon-only)
          const willCollapse = !sidebar.classList.contains('collapsed');
          applyCollapsedState(willCollapse);
          // If collapsing, keep sidebar visible (but icon-only) — no change to .show
        } else {
          // en móvil, overlay
          const was = sidebar.classList.contains('show');
          sidebar.classList.toggle('show');
          sidebar.setAttribute('aria-hidden', String(!sidebar.classList.contains('show')));
          // marcar body overlay
          if (sidebar.classList.contains('show')) {
            document.body.classList.add(BODY_CLASS_SIDEBAR_OPEN);
          } else {
            document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
          }
          adjustContentMargin();
        }
      };
      toggleBtn.addEventListener('click', onToggle, { passive: true });
    }

    // -------------------------
    // COLLAPSE (desktop) — boton especifico
    // -------------------------
    if (collapseBtn) {
      const onCollapse = (e) => {
        e.stopPropagation();
        const willCollapse = !sidebar.classList.contains('collapsed');
        applyCollapsedState(willCollapse);
      };
      collapseBtn.addEventListener('click', onCollapse, { passive: true });
    }

    // -------------------------
    // SUBMENUS - acordeón mejorado
    // -------------------------
    const menuEl = sidebar.querySelector('.menu');

    function closeOtherSubmenus(exceptLi) {
      if (!menuEl) return;
      Array.from(menuEl.children).forEach(li => {
        if (!(li instanceof HTMLElement)) return;
        if (li === exceptLi) return;
        if (li.classList.contains('active')) {
          li.classList.remove('active');
          const lnk = li.querySelector('.menu-link');
          if (lnk) lnk.setAttribute('aria-expanded', 'false');
          const submenu = li.querySelector('.submenu');
          if (submenu) {
            submenu.style.maxHeight = '0px';
            // opcional: dejar display none si collapsed state applied
            if (sidebar.classList.contains('collapsed')) submenu.style.display = 'none';
          }
        }
      });
    }

    function toggleSubmenuForLi(li) {
      if (!li) return;
      const anchor = li.querySelector('.menu-link');
      const submenu = li.querySelector('.submenu');
      if (!submenu) return;

      const isActive = li.classList.contains('active');

      if (!isActive) {
        // abrir
        li.classList.add('active');
        if (anchor) anchor.setAttribute('aria-expanded', 'true');

        // mostrar y animar
        submenu.style.display = 'block';
        submenu.style.overflow = 'hidden';
        const h = submenu.scrollHeight;
        submenu.style.transition = 'max-height 220ms ease';
        // force reflow
        // eslint-disable-next-line no-unused-expressions
        submenu.offsetHeight;
        submenu.style.maxHeight = h + 'px';

        closeOtherSubmenus(li);
      } else {
        // cerrar
        li.classList.remove('active');
        if (anchor) anchor.setAttribute('aria-expanded', 'false');
        submenu.style.transition = 'max-height 180ms ease';
        submenu.style.maxHeight = '0px';
        // oculta display al terminar (preserva si collapsed)
        setTimeout(() => {
          if (!li.classList.contains('active')) {
            if (sidebar.classList.contains('collapsed')) submenu.style.display = 'none';
            else submenu.style.display = '';
            submenu.style.overflow = '';
            submenu.style.transition = '';
          }
        }, 220);
      }
    }
    // Compatibilidad: cerrar todos los submenus (wrapper)
    function closeAllSubmenus() {
      // reutiliza closeOtherSubmenus pasando null para cerrar todos
      try {
        closeOtherSubmenus(null);
      } catch (e) {
        // en caso no exista closeOtherSubmenus, intentar cerrar por selector
        const subs = sidebar.querySelectorAll('.submenu');
        subs.forEach(s => {
          s.style.maxHeight = '0px';
          const li = s.closest('li');
          if (li) li.classList.remove('open', 'active');
          const lnk = li ? li.querySelector('.menu-link') : null;
          if (lnk) lnk.setAttribute('aria-expanded', 'false');
        });
      }
    }

    // Compatibilidad: toggleSubmenu por link (como en sidebarPrueba1)
    function toggleSubmenu(link) {
      if (!link) return;
      const li = link.closest('li');
      if (!li) return;
      toggleSubmenuForLi(li);
    }

    // Compatibilidad: highlightActiveLink delega en setActiveByHref
    function highlightActiveLink(href) {
      setActiveByHref(href);
    }

    // Compatibilidad: loadModule -> delega en loadPartial si existe
    async function loadModule(url) {
      if (typeof loadPartial === 'function') {
        try {
          await loadPartial(url, true);
        } catch (err) {
          console.warn('loadModule delegó en loadPartial y falló', err);
          window.location.href = url;
        }
      } else {
        // fallback simple
        window.location.href = url;
      }
    }
    function adjustContentMargin() {
      if (!sidebar) return;
      if (!contentWrapper) {
        contentWrapper = mainContainer || document.querySelector('main.wrap') || document.querySelector('main') || document.querySelector('.dashboard-content') || document.querySelector('#dashboardContent') || document.querySelector('#main-content') || document.body;
        if (!contentWrapper) return;
      }
      const sidebarWidth = sidebar.classList.contains('collapsed') ? 80 : 250;
      // En desktop aplicamos el push salvo que esté colapsado (icon-only). En móvil no aplicamos margin.
      if (isDesktop() && !sidebar.classList.contains('collapsed')) {
        contentWrapper.style.marginLeft = sidebarWidth + 'px';
      } else {
        contentWrapper.style.marginLeft = '';
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
    if (menuEl) {
      Array.from(menuEl.children).forEach(li => {
        if (!(li instanceof HTMLElement)) return;
        const link = li.querySelector('.menu-link');
        const submenu = li.querySelector('.submenu');

        if (submenu && link) {
          // inicial aria
          link.setAttribute('role', 'button');
          link.setAttribute('aria-expanded', li.classList.contains('active') ? 'true' : 'false');

          // inicializar estilos de submenu
          if (!li.classList.contains('active')) {
            submenu.style.maxHeight = '0px';
            submenu.style.overflow = 'hidden';
            // si sidebar está collapsed, esconder por completo
            if (sidebar.classList.contains('collapsed')) submenu.style.display = 'none';
          } else {
            submenu.style.display = 'block';
            submenu.style.maxHeight = submenu.scrollHeight + 'px';
          }

          // click handler
          link.addEventListener('click', (e) => {
            e.preventDefault();
            // si está colapsado (icon-only) y estamos en desktop, no abrimos submenus
            if (sidebar.classList.contains('collapsed') && isDesktop()) return;
            toggleSubmenuForLi(li);
          }, { passive: false });

        } else if (link) {
          // enlace normal top-level (sin submenu) -> prevenir salto si href="#"
          const href = link.getAttribute('href');
          if (!href || href === '#') {
            link.addEventListener('click', (e) => e.preventDefault(), { passive: false });
          }
        }
      });
    }

    // -------------------------
    // Helper navegación & activo
    // -------------------------
    function setActiveByHref(href) {
      if (!href) return;
      const normalized = href.split('#')[0].split('?')[0];
      // limpiar todos
      const lis = sidebar.querySelectorAll('.menu > li');
      lis.forEach(li => li.classList.remove('active-link'));
      const anchors = sidebar.querySelectorAll('.menu a[href]');
      for (const a of anchors) {
        const aHref = a.getAttribute('href') || '';
        const normalizedA = aHref.split('#')[0].split('?')[0];
        if (normalizedA === normalized || aHref === normalized || (a.href && a.href.endsWith(normalized))) {
          const li = a.closest('li');
          if (li) {
            li.classList.add('active-link');
            // si es submenu item, abrir su padre
            const parentLi = li.closest('.submenu') ? li.closest('.submenu').closest('li') : null;
            if (parentLi) {
              parentLi.classList.add('active');
              const sub = parentLi.querySelector('.submenu');
              if (sub) {
                sub.style.display = 'block';
                sub.style.maxHeight = sub.scrollHeight + 'px';
              }
            }
          }
          break;
        }
      }
    }

    // -------------------------
    // Carga parcial de HTML (extrae selector `extractSelector`)
    // - ejecuta scripts inline y externos (espera a onload de externos)
    // - despacha DOMContentLoaded sintético y evento partial:loaded
    // -------------------------
    async function loadPartial(href, pushHistory = true) {
      if (!mainContainer) {
        console.warn('sidebar.js: no hay mainContainer para inyectar contenido.');
        window.location.href = href;
        return;
      }

      const baseForResolve = resolveUrl(location.href, href);

      try {
        mainContainer.classList.add('loading');

        const res = await fetch(href, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`fetch ${href} status ${res.status}`);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // actualizar titulo
        const newTitle = doc.querySelector('title')?.textContent;
        if (newTitle) document.title = newTitle;

        const extracted = doc.querySelector(extractSelector) ?? doc.querySelector('main') ?? doc.body;
        mainContainer.innerHTML = extracted.innerHTML;

        // scripts dentro del extracted
        const inlineAndExternalScripts = Array.from(extracted.querySelectorAll('script'));
        // scripts en head (src)
        const headScripts = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src')).filter(Boolean);

        const externalPromises = [];

        // ejecutar scripts dentro del extracted
        for (const s of inlineAndExternalScripts) {
          const srcRaw = s.getAttribute('src');
          const type = s.getAttribute('type') || s.type || '';
          if (srcRaw) {
            const src = resolveUrl(baseForResolve, srcRaw);
            if (!document.querySelector(`script[src="${src}"]`)) {
              const sc = document.createElement('script');
              sc.src = src;
              if (type) sc.type = type;
              const p = new Promise((resolve) => {
                sc.addEventListener('load', () => resolve(src));
                sc.addEventListener('error', () => {
                  console.warn('sidebar.js: error cargando script', src);
                  resolve(src);
                });
              });
              externalPromises.push(p);
              document.body.appendChild(sc);
            }
          } else {
            const sc = document.createElement('script');
            if (type) sc.type = type;
            sc.textContent = s.textContent;
            document.body.appendChild(sc);
          }
        }

        // cargar scripts del head
        for (const srcRaw of headScripts) {
          const src = resolveUrl(baseForResolve, srcRaw);
          if (!document.querySelector(`script[src="${src}"]`)) {
            const sc = document.createElement('script');
            sc.src = src;
            const p = new Promise((resolve) => {
              sc.addEventListener('load', () => resolve(src));
              sc.addEventListener('error', () => {
                console.warn('sidebar.js: error cargando head script', src);
                resolve(src);
              });
            });
            externalPromises.push(p);
            document.body.appendChild(sc);
          }
        }

        // esperar externos (resiliente)
        try {
          await Promise.all(externalPromises);
        } catch (err) {
          console.warn('sidebar.js: warning al esperar scripts externos', err);
        }

        // dispatch DOMContentLoaded sintético y evento parcial
        try {
          const synthetic = new Event('DOMContentLoaded', { bubbles: true, cancelable: false });
          document.dispatchEvent(synthetic);
          const custom = new CustomEvent('partial:loaded', { detail: { href } });
          document.dispatchEvent(custom);
        } catch (err) {
          console.warn('sidebar.js: no se pudo disparar DOMContentLoaded sintético', err);
        }

        // marcar activo
        setActiveByHref(href);

        if (pushHistory) {
          try { history.pushState({ partial: true, href }, '', href); } catch (err) { /* ignore */ }
        }

        // sincronizar layout (usar adjustContentMargin como fuente)
        adjustContentMargin();
      } catch (err) {
        console.error('sidebar.js loadPartial error', err);
        window.location.href = href;
      } finally {
        mainContainer.classList.remove('loading');
      }
    }

    // -------------------------
    // Interceptar clicks de menu (enableRouting)
    // -------------------------
    if (enableRouting) {
      const anchors = sidebar.querySelectorAll('.menu a[href], .menu a.menu-link[href]');
      anchors.forEach(a => {
        const hrefAttr = a.getAttribute('href') || '';
        const isHtmlLike = hrefAttr.endsWith('.html') || hrefAttr.includes('.html#') || hrefAttr.startsWith('/') || hrefAttr.startsWith('./') || hrefAttr.startsWith('../');
        const hasModuleAttr = a.hasAttribute('data-module') || a.dataset.module;
        if (isHtmlLike || hasModuleAttr) {
          a.addEventListener('click', (e) => {
            const url = a.href || hrefAttr;
            const sameOrigin = url.startsWith(location.origin) || !/^(https?:)?\/\//.test(url);
            if (!sameOrigin) return;
            e.preventDefault();
            e.stopPropagation();
            const targetHref = a.getAttribute('href');
            if (!targetHref) return;
            loadPartial(targetHref, true);
            if (!isDesktop() && sidebar.classList.contains('show')) {
              sidebar.classList.remove('show');
              sidebar.setAttribute('aria-hidden', 'true');
              document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
            }
          }, { passive: false });
        }
      });

      window.addEventListener('popstate', (ev) => {
        const state = ev.state;
        if (state && state.partial && state.href) {
          loadPartial(state.href, false);
        }
      });
    }

    // -------------------------
    // ocultar opciones admin si role = operador (UX)
    // -------------------------
    try {
      const userRole = localStorage.getItem('userRole');
      if (userRole === 'operador') {
        const adminLinks = sidebar.querySelectorAll('a[href*="admin.html"], a[href*="noticias.html"]');
        adminLinks.forEach((link) => {
          const li = link.closest('li');
          if (li) li.style.display = 'none';
        });
      }
    } catch (err) {
      console.warn('sidebar.js: error al aplicar roles', err?.message ?? err);
    }

    // -------------------------
    // click fuera cierra sidebar (solo mobile)
    // -------------------------
    document.addEventListener('click', (ev) => {
      if (!isDesktop()) {
        const target = ev.target;
        if (!sidebar.contains(target) && !(toggleBtn && toggleBtn.contains(target))) {
          if (sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            sidebar.setAttribute('aria-hidden', 'true');
            document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
            adjustContentMargin();
          }
        }
      }
    }, { passive: true });

    // -------------------------
    // resize -> ajustar estado y syncLayout
    // -------------------------
    window.addEventListener('resize', () => {
      if (isDesktop()) {
        sidebar.classList.add('show');
        sidebar.setAttribute('aria-hidden', 'false');
        document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
      } else {
        // en mobile no forzamos collapsed
        sidebar.classList.remove('collapsed');
      }
      // Si el elemento tenía la marca collapsed en desktop, reaplicar efectos
      if (isDesktop() && sidebar.classList.contains('collapsed')) {
        applyCollapsedState(true);
      } else if (isDesktop() && !sidebar.classList.contains('collapsed')) {
        applyCollapsedState(false);
      } else {
        // mobile: limpiar estados visuales de collapsed
        document.body.classList.remove(BODY_CLASS_SIDEBAR_COLLAPSED);
      }
      adjustContentMargin();
    }, { passive: true });
    // ============================================================
    // EVENTOS
    // ============================================================

    // Seleccionar enlaces del menú y asociar handlers
    const menuLinks = sidebar.querySelectorAll('.menu > li > .menu-link, .menu > li > a[href]');
    Array.from(menuLinks).forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href') || '';
        const li = link.closest('li');
        const hasSubmenu = li && li.classList.contains('has-submenu');

        if (hasSubmenu) {
          e.preventDefault();
          toggleSubmenuForLi(li);
          return;
        }

        if (href && href.endsWith('.html')) {
          e.preventDefault();
          // soporte SPA: carga parcial
          loadPartial(href, true);
          setActiveByHref(href);
          if (!isDesktop()) {
            sidebar.classList.remove('show');
            sidebar.setAttribute('aria-hidden', 'true');
            document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
          }
        }
      }, { passive: false });
    });

    collapseBtn?.addEventListener('click', toggleSidebarCollapse);
    toggleBtn?.addEventListener('click', toggleSidebarMobile);
    window.addEventListener('resize', adjustContentMargin);

    // ============================================================
    // AJUSTES INICIALES
    // ============================================================

    adjustContentMargin();
    setActiveByHref(window.location.pathname);
    // -------------------------
    // ejemplo: verificar rol desde supabase si supabase está disponible
    // -------------------------
    async function checkUserRoleFromDb() {
      if (!supabase) return;
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        const { data, error } = await supabase.from('usuarios').select('rol').eq('id', userId).limit(1);
        if (error) {
          console.warn('sidebar.js supabase error:', error.message || error);
        } else if (data && data.length) {
          localStorage.setItem('userRole', data[0].rol);
        }
      } catch (err) {
        console.warn('sidebar.js checkUserRoleFromDb err', err);
      }
    }
    checkUserRoleFromDb();

    // -------------------------
    // finalizar init
    // -------------------------
    adjustContentMargin();
  })(); // fin IIFE
} // fin initSidebar

// NOTA: NO hay fallback automático ni auto-inicialización aquí.
// Inicializa siempre desde sidebar-loader.js o llama initSidebar('#sidebar-container') manualmente.
