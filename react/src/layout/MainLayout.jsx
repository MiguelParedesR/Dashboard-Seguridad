import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

const MOBILE_TITLE_ROUTES = [
  { startsWith: '/html/base/dashboard.html', title: 'Dashboard' },
  { startsWith: '/incidencias', title: 'Incidencias CCTV' },
  { startsWith: '/lockers/solicitudes/entrega', title: 'Entrega de llaves' },
  { startsWith: '/lockers/solicitudes', title: 'Solicitudes de locker' },
  { startsWith: '/lockers/vista', title: 'Vista de lockers' },
  { startsWith: '/html/admin/admin.html', title: 'Usuarios' },
  { startsWith: '/html/admin/noticias.html', title: 'Noticias' },
  { startsWith: '/html/admin/lockers-config.html', title: 'Config. Lockers' },
  { startsWith: '/html/penalidades/penalidades.html', title: 'Penalidades' },
  { startsWith: '/html/penalidades/excel.html', title: 'Excel Penalidades' },
  { startsWith: '/html/rol-servicios/turnos.html', title: 'Turnos Dia' },
  { startsWith: '/html/rol-servicios/turnoNoche.html', title: 'Turnos Noche' }
];

function resolveMobileTitle(pathname) {
  const normalized = String(pathname || '').trim().toLowerCase();
  const match = MOBILE_TITLE_ROUTES.find((item) => normalized.startsWith(item.startsWith.toLowerCase()));
  return match?.title || 'Dashboard Seguridad';
}

export default function MainLayout() {
  const location = useLocation();
  const mobileTitle = useMemo(() => resolveMobileTitle(location.pathname), [location.pathname]);

  const handleOpenSidebar = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('sidebar:toggle'));
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="mobile-app-bar" aria-label="Navegacion movil">
          <button
            className="mobile-app-menu"
            type="button"
            onClick={handleOpenSidebar}
            aria-label="Abrir menu de navegacion"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="mobile-app-title-wrap">
            <span className="mobile-app-kicker">TPP Seguridad</span>
            <strong className="mobile-app-title">{mobileTitle}</strong>
          </div>
        </header>

        <div id="app-view" className="app-view" aria-live="polite">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
