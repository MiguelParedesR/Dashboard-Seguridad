'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  ClipboardCheck,
  FileWarning,
  History,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UserRound,
  X
} from 'lucide-react';
import type { AppRole } from '@/lib/auth/session';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  cctv: 'Operador CCTV',
  colaborador: 'Colaborador'
};

const groups = [
  {
    label: 'General',
    items: [
      { label: 'Resumen', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'], exact: true },
      { label: 'Inicio', href: '/colaborador', icon: UserRound, roles: ['colaborador'], exact: true },
      { label: 'Incidencias', href: '/incidencias', icon: FileWarning, roles: ['admin', 'cctv'], exact: false },
      { label: 'Mamparas', href: '/mamparas', icon: ClipboardCheck, roles: ['admin'], exact: false }
    ]
  },
  {
    label: 'Lockers',
    items: [
      { label: 'Vista general', href: '/lockers', icon: LockKeyhole, roles: ['admin', 'cctv'], exact: true },
      { label: 'Solicitudes', href: '/lockers/solicitudes', icon: KeyRound, roles: ['admin', 'cctv'], exact: false },
      { label: 'Incidencias de llaves', href: '/lockers/incidencias', icon: ShieldCheck, roles: ['admin', 'cctv'], exact: false },
      { label: 'Historial', href: '/lockers/historial', icon: History, roles: ['admin', 'cctv'], exact: false }
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Configuración', href: '/admin', icon: Settings2, roles: ['admin'], exact: false },
      { label: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['admin'], exact: false }
    ]
  }
] as const;

type ShellItem = (typeof groups)[number]['items'][number];

function isActivePath(pathname: string, item: ShellItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AppShell({ children, role, nombre }: { children: React.ReactNode; role: AppRole; nombre?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace(role === 'colaborador' ? '/colaborador' : '/login');
      router.refresh();
    }
  }

  const brandSubtitle = role === 'colaborador' ? 'Portal colaborador' : 'Centro de Control';
  const topbarTitle = role === 'colaborador' ? 'Portal del colaborador' : 'Operación integral';

  return (
    <div className="app-shell">
      <button
        aria-label="Cerrar navegación"
        className={`sidebar-scrim ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        type="button"
      />

      <aside aria-label="Navegación principal" className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-row">
          <div className="brand">
            <strong>TPP Seguridad</strong>
            <span>{brandSubtitle}</span>
          </div>
          <button className="sidebar-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} type="button">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Secciones disponibles">
          {groups.map((group) => {
            const items = group.items.filter((item) => (item.roles as readonly AppRole[]).includes(role));
            if (!items.length) return null;

            return (
              <div className="nav-group" key={group.label}>
                <div className="nav-label">{group.label}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item);
                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={`nav-link ${active ? 'active' : ''}`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={17} strokeWidth={1.9} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="nav-spacer" />
        <div className="user-box">
          <strong>{nombre || 'Usuario'}</strong>
          <span>{roleLabels[role]}</span>
          <button className="btn btn-secondary" style={{ marginTop: 12, padding: '8px 12px' }} onClick={logout} type="button">
            <LogOut size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> Salir
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            aria-expanded={mobileOpen}
            aria-label="Abrir navegación"
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu size={19} />
          </button>
          <div className="topbar-title">{topbarTitle}</div>
          <div className="shell-role">{roleLabels[role]}</div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
