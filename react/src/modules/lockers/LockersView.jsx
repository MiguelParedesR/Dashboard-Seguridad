import { useEffect } from 'react';
import './lockers.css';

export default function LockersView() {
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await import('./lockers.js');
      if (cancelled) return;

      document.title = 'Lockers - Administracion';
      document.body.dataset.view = 'lockers';
      document.body.classList.remove('view-login');

      const event = new CustomEvent('partial:loaded', {
        detail: { href: 'lockers' }
      });
      document.dispatchEvent(event);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main id="main-content" className="lockers-view" data-lockers-view>
      <div className="lockers-shell">
        <header className="lockers-hero">
          <div className="hero-left">
            <h1 className="lockers-title">Lockers</h1>
            <div className="hero-meta" role="group" aria-label="Estados de lockers">
              <button className="hero-chip is-active" type="button" data-estado="ALL" aria-pressed="true">
                Total <span id="lockerTotalCount">--</span>
              </button>
              <button className="hero-chip" type="button" data-estado="OCUPADO" aria-pressed="false">
                Asignados <span id="lockerAssignedCount">--</span>
              </button>
              <button className="hero-chip" type="button" data-estado="LIBRE" aria-pressed="false">
                Libres <span id="lockerFreeCount">--</span>
              </button>
              <button className="hero-chip" type="button" data-estado="SE_DESCONOCE" aria-pressed="false">
                Se desconoce <span id="lockerUnknownCount">--</span>
              </button>
              <button className="hero-chip" type="button" data-estado="MANTENIMIENTO" aria-pressed="false">
                Mantenimiento <span id="lockerMaintenanceCount">--</span>
              </button>
            </div>
          </div>
          <div className="hero-actions">
            <div className="search-block">
              <label className="search-field">
                <span><i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>
                <input
                  id="lockerSearch"
                  type="search"
                  placeholder="Buscar por codigo o nombre"
                  autoComplete="off"
                  aria-label="Buscar lockers"
                />
              </label>
            </div>
          </div>
        </header>

        <section className="lockers-body">
          <section className="lockers-map">
            <div className="local-nav" aria-label="Locales">
              <div className="local-nav-header">
                <div>
                  <p className="hero-kicker">Locales</p>
                  <div className="local-title">Local activo <span id="lockerLocalLabel">--</span></div>
                </div>
                <div className="local-tabs" id="lockerLocalTabs" role="tablist" aria-label="Lista de locales"></div>
              </div>
            </div>

            <div className="view-switcher">
              <span className="view-switcher-label">Vista</span>
              <div className="view-tabs" id="lockerViewTabs" role="group" aria-label="Seleccion de vista">
                <button className="view-tab is-active" type="button" data-view="assignments" aria-pressed="true">Asignaciones</button>
                <button className="view-tab" type="button" data-view="states" aria-pressed="false">Estados</button>
              </div>
            </div>

            <section className="assignment-board" id="lockerAssignmentBoard" aria-label="Asignaciones por area">
              <div className="area-header">
                <div>
                  <h2 className="area-title">Asignaciones por area</h2>
                </div>
              </div>
              <div className="area-list-view" id="lockerAreaListView"></div>
            </section>

            <section className="state-board" id="lockerStateBoard" aria-label="Vista por estados">
              <div className="map-header">
                <div className="map-title">Vista por estados <span className="map-count" id="lockerMapCount">--</span></div>
                <div className="map-hint">Desliza horizontalmente</div>
              </div>
              <div className="map-scroll">
                <div id="lockerStatusColumns" className="status-columns" role="list"></div>
              </div>
            </section>
          </section>

          <aside className="locker-detail-panel" id="lockerDetailPanel" aria-hidden="true">
            <div className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 id="lockerPanelTitle">Detalle del locker</h2>
                  <p id="lockerSelectedHint">Selecciona un locker del mapa.</p>
                </div>
                <button className="panel-close" id="lockerPanelClose" type="button" aria-label="Cerrar panel">
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>

              <div className="panel-hero">
                <div className="panel-code">
                  <span>Codigo</span>
                  <strong id="lockerSelectedCode">--</strong>
                </div>
                <div className="panel-state">
                  <span>Estado actual</span>
                  <div className="selected-state" id="lockerSelectedStateBadge">
                    <span className="selected-state-indicator"></span>
                    <span className="selected-state-label" id="lockerSelectedStateLabel">Sin seleccion</span>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <div className="field field-local">
                  <label htmlFor="lockerLocal">Local</label>
                  <select id="lockerLocal"></select>
                </div>
                <div className="field field-group">
                  <label htmlFor="lockerGroup">Area</label>
                  <select id="lockerGroup"></select>
                </div>
                <div className="field field-name">
                  <label htmlFor="lockerName">Colaborador</label>
                  <input id="lockerName" type="text" placeholder="Nombre del colaborador" />
                </div>
                <div className="field field-date">
                  <label htmlFor="lockerDate">Fecha de asignacion</label>
                  <input id="lockerDate" type="date" />
                </div>
                <div className="field field-toggle">
                  <label className="toggle-label" htmlFor="lockerHasPadlock">
                    <input id="lockerHasPadlock" type="checkbox" />
                    <span>Cuenta con candado asignado</span>
                  </label>
                </div>
                <div className="field field-toggle">
                  <label className="toggle-label" htmlFor="lockerHasDuplicateKey">
                    <input id="lockerHasDuplicateKey" type="checkbox" />
                    <span>Cuenta con duplicado de llave</span>
                  </label>
                </div>
              </div>

              <div className="panel-actions">
                <button className="btn" id="lockerAssignBtn" type="button">Asignar</button>
                <button className="btn ghost" id="lockerReleaseBtn" type="button">Liberar</button>
                <button className="btn ghost" id="lockerBlockBtn" type="button">Bloquear</button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <div className="panel-backdrop" id="lockerPanelBackdrop" aria-hidden="true"></div>
      <div className="locker-toast" id="lockerToast" role="status" aria-live="polite"></div>
      <div className="locker-quick-menu" id="lockerQuickMenu" role="menu" aria-hidden="true">
        <button type="button" className="quick-action" id="lockerQuickAssign" role="menuitem">Asignar</button>
        <button type="button" className="quick-action" id="lockerQuickRelease" role="menuitem">Liberar</button>
        <button type="button" className="quick-action" id="lockerQuickBlock" role="menuitem">Bloquear</button>
      </div>
    </main>
  );
}
