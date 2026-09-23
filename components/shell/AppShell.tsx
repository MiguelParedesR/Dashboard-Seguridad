'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, ClipboardCheck, FileWarning, KeyRound, LayoutDashboard, LockKeyhole, LogOut, Settings2, ShieldCheck } from 'lucide-react';
import type { AppRole } from '@/lib/auth/session';

const groups = [
  {
    label: 'General',
    items: [
      { label: 'Resumen', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
      { label: 'Incidencias', href: '/incidencias', icon: FileWarning, roles: ['admin', 'cctv'] },
      { label: 'Mamparas', href: '/mamparas', icon: ClipboardCheck, roles: ['admin'] }
    ]
  },
  {
    label: 'Lockers',
    items: [
      { label: 'Vista general', href: '/lockers', icon: LockKeyhole, roles: ['admin', 'cctv'] },
      { label: 'Solicitudes', href: '/lockers/solicitudes', icon: KeyRound, roles: ['admin', 'cctv'] },
      { label: 'Incidencias de llaves', href: '/lockers/incidencias', icon: ShieldCheck, roles: ['admin', 'cctv'] }
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Configuración', href: '/admin', icon: Settings2, roles: ['admin'] },
      { label: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['admin'] }
    ]
  }
] as const;

export default function AppShell({ children, role, nombre }: { children: React.ReactNode; role: AppRole; nombre?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>TPP Seguridad</strong>
          <span>Centro de Control</span>
        </div>

        {groups.map((group) => {
          const items = group.items.filter((item) => (item.roles as readonly string[]).includes(role));
          if (!items.length) return null;
          return (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link className={`nav-link ${active ? 'active' : ''}`} href={item.href} key={item.href}>
                    <Icon size={17} strokeWidth={1.9} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="nav-spacer" />
        <div className="user-box">
          <strong>{nombre || 'Usuario'}</strong>
          <span>{role === 'admin' ? 'Administrador' : 'Operador CCTV'}</span>
          <button className="btn btn-secondary" style={{ marginTop: 12, padding: '8px 12px' }} onClick={logout} type="button">
            <LogOut size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /> Salir
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Operación integral</div>
          <div className="badge info">{role === 'admin' ? 'Admin' : 'CCTV'}</div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
