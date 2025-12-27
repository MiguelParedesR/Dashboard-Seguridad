// /js/base/dashboard.js
// Lógica del dashboard: integración visual con sidebar + métricas.
// Este archivo asume que `sidebar` y `sidebarToggle` existen en el DOM
// pero no depende de la implementación interna de sidebar.js.
// Carga config.js por side-effects (window.CONFIG) y resuelve supabase desde globals.
import '../../config.js';

const MODULE_KEY = 'dashboard';

function resolveDbKey() {
  return window.CONFIG?.SUPABASE?.resolveDbKeyForModule?.(MODULE_KEY) || 'DASHBOARD';
}

function getSupabaseClient() {
  const dbKey = resolveDbKey();
  return window.CONFIG?.SUPABASE?.getClient?.(dbKey) || null;
}

document.addEventListener('DOMContentLoaded', () => {
  // Elementos principales
  const dashboardContent = document.getElementById('dashboardContent');
  const sidebar = document.getElementById('sidebar');           // puede venir inline o cargado dinámicamente
  const toggleBtn = document.getElementById('sidebarToggle');   // boton hamburguesa (mobile)
  const collapseBtn = document.getElementById('collapseBtn');  // opcional (desktop icon-only)
  const DESKTOP_BREAK = 1024;

  // Seguridad: si no hay dashboardContent, abortamos (archivo aislado)
  if (!dashboardContent) {
    console.warn('dashboard.js: no se encontró #dashboardContent. Abortando inicialización.');
    return;
  }

  /**
   * Ajusta el margen izquierdo del contenido del dashboard
   * según el estado del sidebar (visible / oculto / collapsed).
   */
  function adjustContentMargin() {
    try {
      // Si no hay sidebar, dejamos margen 0
      if (!sidebar) {
        dashboardContent.style.marginLeft = '0';
        return;
      }

      // Si el sidebar está en estado "collapsed" (icon-only) -> espacio reducido (70px)
      if (sidebar.classList.contains('collapsed')) {
        dashboardContent.style.marginLeft = `${Math.max(70, 64)}px`;
        return;
      }

      // Desktop: si sidebar tiene clase 'show' o estamos en desktop por defecto, dejamos espacio del ancho del sidebar
      const sidebarVisible = sidebar.classList.contains('show') || window.innerWidth > DESKTOP_BREAK;
      if (sidebarVisible) {
        // Off-screen transform may keep width but hidden; read computed width
        const width = sidebar.offsetWidth || 250;
        dashboardContent.style.marginLeft = `${width}px`;
      } else {
        // mobile hidden
        dashboardContent.style.marginLeft = '0';
      }
    } catch (err) {
      console.warn('dashboard.js: fallo en adjustContentMargin', err);
    }
  }

  /**
   * Añade un listener safe al botón toggle (evitando doble-binding).
   * Solo añadimos si existe el botón.
   */
  function bindToggleButton() {
    if (!toggleBtn) return;
    // evitar doble registro
    if (toggleBtn.__dashboardBound) return;
    toggleBtn.__dashboardBound = true;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // togglear clase en sidebar; sidebar.js también puede tener handler, eso está bien
      if (sidebar) sidebar.classList.toggle('show');
      // esperar microtask para que la transición aplique, luego ajustar margen
      requestAnimationFrame(() => adjustContentMargin());
    }, { passive: true });
  }

  /**
   * Si existe collapseBtn (desktop), ajusta el content margin cuando lo cambien.
   * Evitamos duplicar listeners.
   */
  function bindCollapseButton() {
    if (!collapseBtn || !sidebar) return;
    if (collapseBtn.__dashboardBound) return;
    collapseBtn.__dashboardBound = true;

    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('collapsed');
      // Ajustar margen después de la animación
      setTimeout(adjustContentMargin, 160);
    }, { passive: true });
  }

  /**
   * Muestra valores (seguro): si valor === null/undefined se mantiene "--"
   */
  function setMetric(elId, value) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (value === null || value === undefined) el.textContent = '--';
    else el.textContent = String(value);
  }

  /**
   * Contar filas de una tabla via Supabase de forma tolerante.
   * Retorna número (o null si fallo).
   */
  async function countTableRows(table) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      // Intentamos usar head=true para obtener count exacto sin traer rows
      const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        // fallback: intentar select normal y contar
        console.warn(`dashboard.js: countTableRows head error para ${table}`, error.message || error);
      } else if (typeof count === 'number') {
        return count;
      }

      // fallback: traer pocas filas y contar length
      const { data, error: e2 } = await supabase.from(table).select('id').limit(1000);
      if (e2) {
        console.warn(`dashboard.js: countTableRows fallback error para ${table}`, e2.message || e2);
        return null;
      }
      return Array.isArray(data) ? data.length : null;
    } catch (err) {
      console.warn('dashboard.js: countTableRows exception', err);
      return null;
    }
  }

  /**
   * Cargar métricas principales (usa Supabase si está disponible).
   * Tablas conocidas en tu esquema: agentes_seguridad, penalidades_aplicadas, tardanzas_importadas
   */
  async function loadMetrics() {
    // placeholders inmediatos mientras cargamos
    setMetric('usuariosActivos', '--');
    setMetric('incidenciasCCTV', '--');
    setMetric('penalidades', '--');
    setMetric('turnosActivos', '--');

    const supabase = getSupabaseClient();
    if (!supabase) {
      // Si no hay supabase, coloca valores estáticos o deja placeholders
      setMetric('usuariosActivos', 12);
      setMetric('incidenciasCCTV', 5);
      setMetric('penalidades', 3);
      setMetric('turnosActivos', 8);
      return;
    }

    try {
      const [
        agentesCount,
        penalidadesCount,
        tardanzasCount
      ] = await Promise.all([
        countTableRows('agentes_seguridad'),
        countTableRows('penalidades_aplicadas'),
        countTableRows('tardanzas_importadas')
      ]);

      // Mapear resultados (si null => mostrar --)
      setMetric('usuariosActivos', agentesCount !== null ? agentesCount : '--');
      setMetric('penalidades', penalidadesCount !== null ? penalidadesCount : '--');

      // Usamos tardanzas_importadas como proxy para "incidencias CCTV" si no hay tabla específica
      setMetric('incidenciasCCTV', tardanzasCount !== null ? tardanzasCount : '--');

      // Para turnos activos no hay tabla explícita: si hay v_tardanzas_por_dia o similar podríamos consultar.
      // Por ahora intento contar registros de 'tardanzas_importadas' por fecha actual (como proxy).
      if (supabase) {
        try {
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const { data, error } = await supabase.from('tardanzas_importadas').select('id', { count: 'exact', head: true }).eq('fecha_servicio', today);
          if (!error && typeof data === 'undefined') {
            // Cuando head:true y select devuelve undefined data, count is in 'count' (older SDK), fallback below
            // Try another method:
            const { count } = await supabase.from('tardanzas_importadas').select('*', { count: 'exact', head: true }).eq('fecha_servicio', today);
            setMetric('turnosActivos', (typeof count === 'number') ? count : '--');
          } else if (!error && Array.isArray(data)) {
            setMetric('turnosActivos', data.length);
          } else {
            setMetric('turnosActivos', '--');
          }
        } catch (err) {
          setMetric('turnosActivos', '--');
        }
      }

    } catch (err) {
      console.warn('dashboard.js: error al cargar métricas', err);
    }
  }

  /**
   * Inicialización general
   */
  function init() {
    // Bind toggle & collapse safely
    bindToggleButton();
    bindCollapseButton();

    // Ajuste inicial de márgenes
    adjustContentMargin();

    // Re-ajustar al hacer resize
    window.addEventListener('resize', () => {
      // si cambiaron ancho, reajustar margen
      adjustContentMargin();
    }, { passive: true });

    // Cargar métricas (async)
    loadMetrics().catch(err => console.warn('dashboard.js: loadMetrics error', err));
  }

  // Ejecutar init
  init();

  // Exportamos funciones para debugging en dev (opcional)
  try {
    window.__dashboardUtils = window.__dashboardUtils || {};
    window.__dashboardUtils.adjustContentMargin = adjustContentMargin;
    window.__dashboardUtils.loadMetrics = loadMetrics;
  } catch (err) { /* ignore */ }
});
