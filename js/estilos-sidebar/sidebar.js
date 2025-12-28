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
  function getAppRootPath() {
    const path = window.location.pathname;
    const htmlIndex = path.indexOf('/html/');
    if (htmlIndex !== -1) return path.slice(0, htmlIndex + 1);
    if (path.endsWith('/')) return path;
    return path.slice(0, path.lastIndexOf('/') + 1);
  }

  function resolveFromRoot(relativePath) {
    const base = new URL(getAppRootPath(), window.location.href);
    return new URL(relativePath.replace(/^\//, ''), base).href;
  }

  const htmlPath = options.htmlPath ?? resolveFromRoot('html/base/sidebar.html');
  const createIfMissing = options.createIfMissing ?? true;
  const toggleSelector = options.toggleSelector ?? '#sidebarToggle';
  const collapseSelector = options.collapseSelector ?? '#collapseBtn';
  const mainSelectorPriority = options.mainSelector ?? null; // si se pasa, se respeta tal cual
  const extractSelector = options.extractSelector ?? 'main, #dashboardContent, .dashboard-content, .wrap, .login-container, #main-content'; // selector para extraer contenido del HTML cargado
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
      await import('../../config.js');
      const dbKey = window.CONFIG?.SUPABASE?.resolveDbKeyForModule?.('sidebar') || 'DASHBOARD';
      const waiter = window.CONFIG?.SUPABASE?.waitForClient;
      supabase = typeof waiter === 'function' ? await waiter(dbKey) : null;
    } catch (err) {
      console.warn('sidebar.js: no se pudo importar config.js (ok en dev).', err?.message ?? err);
    }

    // -------------------------
    // elementos UI
    // -------------------------
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector(toggleSelector);
    const collapseBtn = document.querySelector(collapseSelector);
  // Contenedores que usaremos para ajustar layout — declarar aquí para evitar
  // ReferenceError cuando adjustContentMargin se llame temprano.
  let mainContainer = null;
  let contentWrapper = null;
    const mainSelectors = (mainSelectorPriority ?? '#app-view, main, #dashboardContent, .dashboard-content, .wrap, #main-content')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    for (const sel of mainSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        mainContainer = el;
        break;
      }
    }
    if (toggleBtn) {
      const onToggle = (e) => {
        e.stopPropagation();
        console.debug('sidebar: toggleBtn clicked - isDesktop=', isDesktop(), 'classes=', sidebar.className);
        if (isDesktop()) {
          // en desktop usamos collapse (icon-only)
          const willCollapse = !sidebar.classList.contains('collapsed');
          applyCollapsedState(willCollapse);
        } else {
          // en móvil delegamos a la función especializada que también
          // restaura los textos ocultos cuando se abre el overlay
          // (toggleSidebarMobile contiene la lógica de _mobileOverride)
          try {
            toggleSidebarMobile();
          } catch (err) {
            // fallback: togglear manualmente
            sidebar.classList.toggle('show');
            sidebar.setAttribute('aria-hidden', String(!sidebar.classList.contains('show')));
            if (sidebar.classList.contains('show')) document.body.classList.add(BODY_CLASS_SIDEBAR_OPEN);
            else document.body.classList.remove(BODY_CLASS_SIDEBAR_OPEN);
            adjustContentMargin();
          }
        }
      };
      toggleBtn.addEventListener('click', onToggle, { passive: true });
    }
    // -------------------------
    function resolveUrl(base, url) {
      try {
        return new URL(url, base).href;
      } catch (err) {
        return url;
      }
    }
    function resolveAssetUrl(base, url) {
      if (!url) return url;
      if (/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(url)) return url;
      if (url.startsWith('#') || url.startsWith('//')) return url;
      if (url.startsWith('/')) {
        const rootBase = new URL(getAppRootPath(), window.location.href);
        return new URL(url.replace(/^\//, ''), rootBase).href;
      }
      return resolveUrl(base, url);
    }
    function normalizeHrefValue(raw) {
      try {
        return new URL(raw, window.location.href).pathname;
      } catch (err) {
        return raw;
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
        console.debug('sidebar: toggleBtn clicked - isDesktop=', isDesktop(), 'classes=', sidebar.className);
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
        console.debug('sidebar: collapseBtn clicked - current collapsed=', sidebar.classList.contains('collapsed'));
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
      console.debug('toggleSubmenuForLi called for li:', li);
      if (!li) return;
      const anchor = li.querySelector('.menu-link');
      const submenu = li.querySelector('.submenu');
      if (!submenu) return;

      const isActive = li.classList.contains('active');

      // If sidebar is collapsed on desktop, show a floating flyout instead of opening inline submenu
      if (sidebar.classList.contains('collapsed') && isDesktop()) {
        showFlyoutSubmenu(li);
        return;
      }

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

    // Show a floating submenu (flyout) when sidebar is collapsed on desktop
    function showFlyoutSubmenu(li) {
      // remove existing
      const existing = document.querySelector('.sidebar-flyout');
      if (existing) existing.remove();
      const submenu = li.querySelector('.submenu');
      if (!submenu) return;

      const rect = li.getBoundingClientRect();
      const fly = document.createElement('div');
      fly.className = 'sidebar-flyout';
      // basic styles (inline to avoid editing CSS file)
      Object.assign(fly.style, {
        position: 'fixed',
        top: (rect.top) + 'px',
        left: (sidebar.getBoundingClientRect().right) + 'px',
        minWidth: '200px',
        background: '#394862',
        color: '#fff',
        zIndex: 2000,
        padding: '8px 6px',
        borderRadius: '6px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
      });

      // clone submenu contents
      const list = document.createElement('ul');
      list.className = 'submenu-flyout';
      list.innerHTML = submenu.innerHTML;
      // fix links to behave like normal submenu items
      Array.from(list.querySelectorAll('a')).forEach(a => {
        a.style.color = '#cfd3da';
        a.style.display = 'block';
        a.style.padding = '8px 12px';
      });

      fly.appendChild(list);
      document.body.appendChild(fly);

      // close on outside click or resize
      const onDocClick = (ev) => {
        if (!fly.contains(ev.target) && !li.contains(ev.target)) {
          fly.remove();
          document.removeEventListener('click', onDocClick);
          window.removeEventListener('resize', onDocResize);
        }
      };
      const onDocResize = () => { fly.remove(); document.removeEventListener('click', onDocClick); window.removeEventListener('resize', onDocResize); };
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      window.addEventListener('resize', onDocResize);
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
      const wasActive = sidebar.classList.contains('active');
      const willBeActive = !wasActive;
      sidebar.classList.toggle('active');

      // If sidebar is currently collapsed (desktop collapsed state persisted) and
      // we're opening the mobile overlay, temporarily show label spans so text
      // is visible in the overlay. We mark them with data-mobile-override so we
      // can restore their prior state when the overlay closes.
      if (willBeActive && sidebar.classList.contains('collapsed') && !isDesktop()) {
        const links = sidebar.querySelectorAll('.menu .menu-link');
        links.forEach(link => {
          const spans = Array.from(link.children).filter(ch => ch.tagName === 'SPAN');
          spans.forEach(span => {
            // only override if currently hidden
            if (getComputedStyle(span).display === 'none') {
              span.dataset._mobileOverride = '1';
              span.style.display = '';
            }
          });
        });
        // Also show submenus if any were hidden
        const subs = sidebar.querySelectorAll('.submenu');
        subs.forEach(s => {
          if (s.style.display === 'none') {
            s.dataset._mobileOverride = '1';
            s.style.display = '';
          }
        });
      }

      // If we are closing the overlay and we had previously overridden label display,
      // restore previous inline style from dataset._prevDisplay where present.
      if (!willBeActive) {
        const links = sidebar.querySelectorAll('.menu .menu-link');
        links.forEach(link => {
          const spans = Array.from(link.children).filter(ch => ch.tagName === 'SPAN');
          spans.forEach(span => {
            if (span.dataset._mobileOverride === '1') {
              // restore previous display recorded by applyCollapsedState if exists
              const prev = span.dataset._prevDisplay ?? '';
              span.style.display = prev || '';
              delete span.dataset._mobileOverride;
            }
          });
        });
        const subs = sidebar.querySelectorAll('.submenu');
        subs.forEach(s => {
          if (s.dataset._mobileOverride === '1') {
            if (s.dataset._prevDisplay !== undefined) {
              s.style.display = s.dataset._prevDisplay || '';
              delete s.dataset._prevDisplay;
            } else {
              s.style.display = '';
            }
            delete s.dataset._mobileOverride;
          }
        });
      }

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

          // click handler on the whole link
          link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.debug('sidebar: submenu link clicked', { li, collapsed: sidebar.classList.contains('collapsed'), isDesktop: isDesktop() });
            // si está colapsado (icon-only) y estamos en desktop, no abrimos submenus
            if (sidebar.classList.contains('collapsed') && isDesktop()) return;
            toggleSubmenuForLi(li);
          }, { passive: false });

          // also attach click to arrow icon (if present) to improve hit area
          const arrow = link.querySelector('.arrow');
          if (arrow) {
            arrow.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (sidebar.classList.contains('collapsed') && isDesktop()) return;
              toggleSubmenuForLi(li);
            }, { passive: false });
          }

        } else if (link) {
          // enlace normal top-level (sin submenu) -> prevenir salto si href="#"
          const href = link.getAttribute('href');
          if (!href || href === '#') {
            link.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
          }
        }
      });
    }

    // -------------------------
    // Helper navegación & activo
    // -------------------------
    function setActiveByHref(href) {
      if (!href) return;
      const normalized = normalizeHrefValue(href);
      // limpiar todos
      const lis = sidebar.querySelectorAll('.menu > li');
      lis.forEach(li => li.classList.remove('active-link'));
      const anchors = sidebar.querySelectorAll('.menu a[href]');
      for (const a of anchors) {
        const aHref = a.getAttribute('href') || '';
        const normalizedA = normalizeHrefValue(aHref);
        const normalizedAbs = a.href ? normalizeHrefValue(a.href) : '';
        if (normalizedA === normalized || normalizedAbs === normalized || normalizedAbs.endsWith(normalized)) {
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
    function rewriteRelativeUrls(rootEl, baseForResolve) {
      if (!rootEl) return;
      const nodes = rootEl.querySelectorAll('[href], [src]');
      nodes.forEach((node) => {
        if (node.hasAttribute('href')) {
          const raw = node.getAttribute('href');
          const next = resolveAssetUrl(baseForResolve, raw);
          if (next && next !== raw) node.setAttribute('href', next);
        }
        if (node.hasAttribute('src')) {
          const raw = node.getAttribute('src');
          const next = resolveAssetUrl(baseForResolve, raw);
          if (next && next !== raw) node.setAttribute('src', next);
        }
      });
    }

    function applyViewState(href) {
      const normalized = normalizeHrefValue(href);
      const viewName = normalized.split('/').pop()?.replace(/\.html$/i, '') || 'view';
      document.body.dataset.view = viewName;
      document.body.classList.toggle('view-login', normalized.includes('/login-general/'));
    }

    async function loadPartial(href, pushHistory = true) {
      if (!mainContainer) {
        console.warn('sidebar.js: no hay mainContainer para inyectar contenido.');
        window.location.href = href;
        return;
      }

      const baseForResolve = resolveUrl(location.href, href);

      try {
        mainContainer.classList.add('loading');
        console.debug('loadPartial function called.');

        const res = await fetch(href, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`fetch ${href} status ${res.status}`);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // actualizar titulo
        const newTitle = doc.querySelector('title')?.textContent;
        if (newTitle) document.title = newTitle;

        const extracted = doc.querySelector(extractSelector) ?? doc.querySelector('main') ?? doc.body;
        const extractedClone = extracted.cloneNode(true);
        extractedClone.querySelectorAll('script').forEach(s => s.remove());
        extractedClone.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());
        rewriteRelativeUrls(extractedClone, baseForResolve);
        mainContainer.innerHTML = '';
        if (extractedClone.tagName && extractedClone.tagName.toLowerCase() === 'body') {
          Array.from(extractedClone.children).forEach(child => mainContainer.appendChild(child));
        } else {
          mainContainer.appendChild(extractedClone);
        }

        // estilos del head/body
        const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
        const existingStyleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        styleLinks.forEach((l) => {
          const raw = l.getAttribute('href');
          const hrefResolved = resolveAssetUrl(baseForResolve, raw);
          if (!hrefResolved) return;
          const already = existingStyleLinks.some((link) => link.href === hrefResolved || link.getAttribute('href') === hrefResolved);
          if (already) return;
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = hrefResolved;
          document.head.appendChild(link);
        });

        // scripts del documento (mantener orden para evitar dependencias rotas)
        const docScripts = Array.from(doc.querySelectorAll('script'));
        const knownScripts = new Set(
          Array.from(document.querySelectorAll('script[src]'))
            .map((el) => el.src)
            .filter(Boolean)
        );
        const skipScript = (src) => {
          if (!src) return false;
          return /estilos-sidebar|sidebar(-loader)?\.js/.test(src);
        };
        const copyScriptAttrs = (from, to) => {
          if (!from || !to) return;
          const attrs = ['crossorigin', 'referrerpolicy', 'integrity', 'nonce'];
          attrs.forEach((attr) => {
            if (from.hasAttribute(attr)) {
              const value = from.getAttribute(attr) || '';
              to.setAttribute(attr, value);
            }
          });
          if (from.hasAttribute('nomodule')) {
            to.setAttribute('nomodule', '');
          }
        };
        const loadExternalScript = (src, type, originalEl) => {
          if (!src) return Promise.resolve();
          if (knownScripts.has(src)) return Promise.resolve();
          knownScripts.add(src);
          return new Promise((resolve) => {
            const sc = document.createElement('script');
            sc.src = src;
            sc.async = false;
            sc.defer = false;
            if (type) sc.type = type;
            copyScriptAttrs(originalEl, sc);
            sc.addEventListener('load', () => resolve());
            sc.addEventListener('error', () => {
              console.warn('sidebar.js: error cargando script', src);
              resolve();
            });
            document.body.appendChild(sc);
          });
        };

        for (const s of docScripts) {
          const srcRaw = s.getAttribute('src');
          const type = s.getAttribute('type') || s.type || '';
          if (srcRaw) {
            const src = resolveAssetUrl(baseForResolve, srcRaw);
            if (skipScript(src)) {
              console.debug('sidebar.js: skipping sidebar-related script during partial load', src);
              continue;
            }
            await loadExternalScript(src, type, s);
          } else {
            const inlineText = s.textContent || '';
            if (/initSidebar\(|sidebar-loader\.js|estilos-sidebar/.test(inlineText)) {
              console.debug('sidebar.js: skipping inline script that may re-init sidebar');
              continue;
            }
            const sc = document.createElement('script');
            if (type) sc.type = type;
            copyScriptAttrs(s, sc);
            sc.textContent = inlineText;
            document.body.appendChild(sc);
          }
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
        applyViewState(href);

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
    console.debug('Attaching click handlers to menuLinks, count=', menuLinks.length);
    Array.from(menuLinks).forEach(link => {
      console.debug('menu link found:', link, 'href=', link.getAttribute('href'));
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href') || '';
        const li = link.closest('li');
        const hasSubmenu = li && li.classList.contains('has-submenu');

        console.debug('menu link clicked', { href, hasSubmenu, li });

        if (hasSubmenu) {
          e.preventDefault();
          console.debug('Preventing default for submenu link and toggling submenu for li', li);
          toggleSubmenuForLi(li);
          return;
        }

        if (href && href.endsWith('.html')) {
          e.preventDefault();
          // soporte SPA: carga parcial
          console.debug('Loading partial for href', href);
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

  // NOTE: event listeners for collapse/toggle are attached earlier
  // via specialized handlers (onCollapse/onToggle). Avoid duplicate
  // attachments here to prevent conflicting behavior.
    window.addEventListener('resize', adjustContentMargin);

    // ============================================================
    // AJUSTES INICIALES
    // ============================================================

    adjustContentMargin();
    setActiveByHref(window.location.pathname);
    applyViewState(window.location.pathname);
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
        } else if (data && data.length > 0) {
          const rol = data[0].rol;
          localStorage.setItem('userRole', rol);
          // Aplicar ocultamiento de enlaces admin si es necesario
          if (rol === 'operador') {
            const adminLinks = sidebar.querySelectorAll('a[href*="admin.html"], a[href*="noticias.html"]');
            adminLinks.forEach((link) => {
              const li = link.closest('li');
              if (li) li.style.display = 'none';
            });
          }
        }
      } catch (err) {
        console.warn('sidebar.js: error al verificar rol de usuario', err);
      }
    }

    // Llamar a la función de verificación de rol
    checkUserRoleFromDb();

    try {
      window.__sidebar = window.__sidebar || {};
      window.__sidebar.loadPartial = loadPartial;
      window.__sidebar.setActiveByHref = setActiveByHref;
      window.__sidebar.adjustContentMargin = adjustContentMargin;
      document.dispatchEvent(new CustomEvent('sidebar:ready', { detail: window.__sidebar }));
    } catch (err) {
      console.warn('sidebar.js: no se pudo exponer API de SPA', err);
    }
  })();
}

// ===========================
// MANTENIMIENTO
// ===========================
/*
  - [ ] Revisar y limpiar código comentado o innecesario.
  - [ ] Verificar que todas las rutas relativas a recursos (imágenes, scripts, estilos) sean correctas.
  - [ ] Asegurarse que los eventos y listeners se limpien adecuadamente para evitar fugas de memoria.
  - [ ] Probar en diferentes navegadores y dispositivos para asegurar compatibilidad.
  - [ ] Documentar cualquier comportamiento inesperado o "hacky" para futuras referencias.
*/

// Note: The interactive initialization is handled via initSidebar exported function
// and invoked by `sidebar-loader.js` or inline modules. Avoid duplicate
// DOMContentLoaded handlers here to prevent event-handler duplication.
