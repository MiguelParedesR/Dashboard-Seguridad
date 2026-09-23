import { redirect } from 'next/navigation';
import ColaboradorLoginForm from '@/components/auth/ColaboradorLoginForm';
import ColaboradorLogoutButton from '@/components/auth/ColaboradorLogoutButton';
import { getSession, isCollaboratorRole } from '@/lib/auth/session';

export default async function ColaboradorPage() {
  const session = await getSession();

  if (!session) return <ColaboradorLoginForm />;
  if (!isCollaboratorRole(session.role)) redirect('/');

  const dniLabel = session.dni ? `••••${session.dni.slice(-4)}` : 'Validado';

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-mark">TPP</div>
        <h1>Sesión activa</h1>
        <p>Tu identidad de colaborador está validada por el servidor. Las funciones operativas se habilitarán en las fases de migración correspondientes.</p>
        <div className="field">
          <label>Colaborador</label>
          <div className="input" aria-readonly="true">{session.nombre || 'Colaborador'}</div>
        </div>
        <div className="field">
          <label>DNI</label>
          <div className="input" aria-readonly="true">{dniLabel}</div>
        </div>
        <ColaboradorLogoutButton />
      </section>
    </main>
  );
}
