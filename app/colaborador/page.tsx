import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import ColaboradorLoginForm from '@/components/auth/ColaboradorLoginForm';
import CollaboratorLockerPanel from '@/components/lockers/CollaboratorLockerPanel';
import { getSession, isCollaboratorRole } from '@/lib/auth/session';

export default async function ColaboradorPage() {
  const session = await getSession();

  if (!session) return <ColaboradorLoginForm />;
  if (!isCollaboratorRole(session.role)) redirect('/');

  const dniLabel = session.dni ? `••••${session.dni.slice(-4)}` : 'Validado';

  return (
    <AppShell role={session.role} nombre={session.nombre}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Colaborador</div>
          <h1>Mi espacio</h1>
          <p>Consulta tu asignación activa y registra la devolución de llaves con evidencia desde una sesión protegida por servidor.</p>
        </div>
      </div>

      <section className="section" aria-labelledby="session-heading">
        <div className="section-head">
          <div><h2 id="session-heading">Acceso seguro</h2><p>La identidad visible proviene de la sesión HttpOnly validada en backend.</p></div>
          <span className="badge success">Sesión activa</span>
        </div>
        <div className="form-grid">
          <div className="field"><label>Colaborador</label><div className="input" aria-readonly="true">{session.nombre || 'Colaborador'}</div></div>
          <div className="field"><label>DNI</label><div className="input" aria-readonly="true">{dniLabel}</div></div>
        </div>
      </section>

      <CollaboratorLockerPanel />
    </AppShell>
  );
}
