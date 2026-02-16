import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession } from '../services/sessionAuth.js';
import { clearUsuarioSessionStorage } from '../app-usuario/usuarioAuth.js';
import '../styles/sidebar.css';

const INCIDENCIAS_URL = 'https://miguelparedesr.github.io/Formulario-Mamparas/?view=%2Findex.html';

const NAV_GROUPS = [
  {
    id: 'main',
    label: 'Principal',
    items: [
      { label: 'Dashboard', to: '/html/base/dashboard.html', icon: 'dashboard' }
    ]
  },
  {
    id: 'cctv',
    label: 'Actividades CCTV',
    items: [
      { label: 'Incidencias', href: INCIDENCIAS_URL, icon: 'alert', external: true },
      { label: 'Lockers', to: '/html/actividades-cctv/lockers.html', icon: 'lockers' }
    ]
  },
  {
    id: 'usuario-lockers',
    label: 'App Usuario',
    items: [
      { label: 'Solicitudes', to: '/usuario/solicitudes', icon: 'request' },
      { label: 'Lockers', to: '/usuario/lockers', icon: 'lockers' },
      { label: 'Asignaciones', to: '/usuario/asignaciones', icon: 'assignments' },
      { label: 'Historial', to: '/usuario/historial', icon: 'history' }
    ]
  },
  {
    id: 'admin',
    label: 'Administracion',
    items: [
      { label: 'Usuarios', to: '/html/admin/admin.html', icon: 'users' },
      { label: 'Noticias', to: '/html/admin/noticias.html', icon: 'news' }
    ]
  },
  {
    id: 'penalidades',
    label: 'Penalidades',
    items: [
      { label: 'Penalidades', to: '/html/penalidades/penalidades.html', icon: 'penalty' },
      { label: 'Excel', to: '/html/penalidades/excel.html', icon: 'excel' }
    ]
  },
  {
    id: 'rol',
    label: 'Rol de Servicios',
    items: [
      { label: 'Turnos Dia', to: '/html/rol-servicios/turnos.html', icon: 'sun' },
      { label: 'Turnos Noche', to: '/html/rol-servicios/turnoNoche.html', icon: 'moon' }
    ]
  }
];

const ICONS = {
  dashboard: 'M4 5.5C4 4.1 5.1 3 6.5 3h11c1.4 0 2.5 1.1 2.5 2.5v13c0 1.4-1.1 2.5-2.5 2.5h-11C5.1 21 4 19.9 4 18.5v-13zm2.5-.5a.5.5 0 0 0-.5.5v4.5h12V5.5a.5.5 0 0 0-.5-.5h-11zM6 12v6.5c0 .3.2.5.5.5H10V12H6zm6 0v7h5.5c.3 0 .5-.2.5-.5V12H12z',
  alert: 'M12 3c.4 0 .7.2.9.6l7.1 12.3c.3.6-.1 1.3-.9 1.3H4.9c-.7 0-1.2-.7-.9-1.3L11.1 3.6c.2-.4.5-.6.9-.6zm0 4.2c-.4 0-.8.4-.8.8v3.9c0 .4.4.8.8.8s.8-.4.8-.8V8c0-.4-.4-.8-.8-.8zm0 8.8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  lockers: 'M5.5 4h13a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V5.5A1.5 1.5 0 0 1 5.5 4zm3.5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM14 7.5h3m-3 4h3m-3 4h3',
  users: 'M7 8.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm-3 9.2c0-2.2 2.7-4 6-4s6 1.8 6 4v1.3H4v-1.3zm12.4-7.8a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zm2.6 8.8v-1c0-1.6-1-3-2.6-3.8 2 .3 3.6 1.6 3.6 3.3v1.5h-1z',
  news: 'M4 5.5C4 4.1 5.1 3 6.5 3h8.5c1.4 0 2.5 1.1 2.5 2.5V6h1.5C20.4 6 21 6.6 21 7.5v9.5c0 1.1-.9 2-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-11zM6.5 5a.5.5 0 0 0-.5.5v11c0 .8.7 1.5 1.5 1.5H18a1 1 0 0 0 1-1V8h-1.5v6.5c0 .6-.4 1-1 1H8a1 1 0 0 1-1-1V5h-.5zM9 8h6m-6 3h6m-6 3h4',
  penalty: 'M12 3l7 4v10l-7 4-7-4V7l7-4zm0 3.1L7 8.2v7.6l5 2.9 5-2.9V8.2l-5-2.1zm0 3.2c.4 0 .8.4.8.8v3.8c0 .4-.4.8-.8.8s-.8-.4-.8-.8v-3.8c0-.4.4-.8.8-.8zm0 6.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  excel: 'M6 4h12a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2.8 4.2 2.2 3-2.2 3h2.1l1.2-1.8 1.2 1.8h2.1l-2.2-3 2.2-3h-2.1l-1.2 1.8-1.2-1.8H8.8z',
  request: 'M5.5 3h10A2.5 2.5 0 0 1 18 5.5V20l-7.5-4L3 20V5.5A2.5 2.5 0 0 1 5.5 3zm1.3 4h8.4m-8.4 3h6.2m-6.2 3h5.1',
  assignments: 'M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5zm1.5 3.2h7m-7 3.4h9m-9 3.4h5m8.3-5.8a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0zm-2.3 3.1c1.8 0 3.3.9 3.3 2v.7h-6.6v-.7c0-1.1 1.5-2 3.3-2z',
  history: 'M12 4a8 8 0 1 1-7.1 4.3.8.8 0 1 1 1.4.7A6.5 6.5 0 1 0 12 5.5V8a.8.8 0 0 1-1.6 0V4.8A.8.8 0 0 1 11.2 4H12zm.8 3.2v4.1l3 1.8a.8.8 0 0 1-.8 1.4l-3.4-2a.8.8 0 0 1-.4-.7V7.2a.8.8 0 1 1 1.6 0z',
  sun: 'M12 4.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 12 4.5zm-5.3 2.2a.75.75 0 0 1 1.06 0l.35.35a.75.75 0 0 1-1.06 1.06l-.35-.35a.75.75 0 0 1 0-1.06zm10.9 0a.75.75 0 0 1 0 1.06l-.35.35a.75.75 0 1 1-1.06-1.06l.35-.35a.75.75 0 0 1 1.06 0zM12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5zm-7.5 3.75A.75.75 0 0 1 5.25 11h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 4.5 12zm13 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75zm-10.9 4.8a.75.75 0 0 1 1.06 0l.35.35a.75.75 0 0 1-1.06 1.06l-.35-.35a.75.75 0 0 1 0-1.06zm10.9 0a.75.75 0 0 1 0 1.06l-.35.35a.75.75 0 1 1-1.06-1.06l.35-.35a.75.75 0 0 1 1.06 0z',
  moon: 'M13.8 4.2c.4-.3.9.1.8.6a7 7 0 0 1-8.6 8.6c-.5.1-.9-.4-.6-.8a8 8 0 0 0 8.4-8.4z'
};

function Icon({ name }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar:collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() =>
    NAV_GROUPS.reduce((acc, group) => {
      acc[group.id] = true;
      return acc;
    }, {})
  );

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sidebar:collapsed', collapsed ? 'true' : 'false');
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', mobileOpen);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const groups = useMemo(() => NAV_GROUPS, []);

  const toggleGroup = (id) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = async () => {
    clearAuthSession();
    clearUsuarioSessionStorage();
    try {
      const waiter = window.CONFIG?.SUPABASE?.waitForClient;
      if (typeof waiter === 'function') {
        const client = await waiter('LOCKERS', { maxAttempts: 4, waitMs: 100 });
        if (client?.auth?.signOut) {
          await client.auth.signOut();
        }
      }
    } catch (err) {
      // Best-effort local logout.
    }
    navigate('/html/login-general/login.html');
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">TPP</div>
        <div className="brand-text">
          <span className="brand-title">Dashboard</span>
          <span className="brand-sub">Seguridad Integral</span>
        </div>
        <button className="collapse-btn" type="button" onClick={() => setCollapsed((prev) => !prev)}>
          <span className="collapse-dot"></span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {groups.map((group) => (
          <div key={group.id} className="nav-group">
            <button className="group-toggle" type="button" onClick={() => toggleGroup(group.id)}>
              <span className="group-label">{group.label}</span>
              <span className={`group-chevron ${openGroups[group.id] ? 'open' : ''}`}></span>
            </button>
            <div className={`group-items ${openGroups[group.id] ? 'open' : ''}`}>
              {group.items.map((item) =>
                item.external ? (
                  <a key={item.href} href={item.href} className="nav-link">
                    <Icon name={item.icon} />
                    <span className="nav-text">{item.label}</span>
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon name={item.icon} />
                    <span className="nav-text">{item.label}</span>
                  </NavLink>
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      <button className="btn ghost sidebar-logout" type="button" onClick={handleLogout}>
        Cerrar sesion
      </button>

      <button className="mobile-toggle" type="button" onClick={() => setMobileOpen((prev) => !prev)}>
        <span className="mobile-line"></span>
        <span className="mobile-line"></span>
        <span className="mobile-line"></span>
      </button>
    </aside>
  );
}
