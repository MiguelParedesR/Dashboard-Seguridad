import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/lockers/solicitudes');
  const supabase = getSupabaseAdmin();

  const [lockers, solicitudes, incidenciasLlaves, incidencias, inspecciones] = await Promise.all([
    supabase.from('lockers').select('id,estado', { count: 'exact', head: false }),
    supabase.from('solicitudes_locker').select('id,estado', { count: 'exact', head: false }),
    supabase.from('incidencias_llaves').select('id,resuelta', { count: 'exact', head: false }),
    supabase.from('incidencias').select('id,estado', { count: 'exact', head: false }),
    supabase.from('inspecciones').select('id', { count: 'exact', head: true })
  ]);

  const lockerRows = lockers.data || [];
  const requestRows = solicitudes.data || [];
  const keyIncidentRows = incidenciasLlaves.data || [];
  const incidentRows = incidencias.data || [];

  const metrics = [
    ['Lockers', lockerRows.length, `${lockerRows.filter((x: any) => String(x.estado).toUpperCase() === 'LIBRE').length} libres`],
    ['Solicitudes', requestRows.filter((x: any) => ['CREADA','EN_REVISION'].includes(String(x.estado).toUpperCase())).length, 'pendientes'],
    ['Incidencias llaves', keyIncidentRows.filter((x: any) => !x.resuelta).length, 'por atender'],
    ['Inspecciones', inspecciones.count || 0, 'registros']
  ];

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operación consolidada</div>
          <h1>Seguridad, en una sola vista.</h1>
          <p>Lockers, incidencias e inspecciones comparten una arquitectura moderna y una única experiencia operativa.</p>
        </div>
      </div>

      <div className="metric-strip">
        {metrics.map(([label, value, hint]) => (
          <div className="metric" key={String(label)}>
            <div className="value">{value}</div>
            <div className="label">{label} · {hint}</div>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head"><div><h2>Flujos operativos</h2><p>Accesos directos a las áreas activas.</p></div></div>
        <div className="grid-3">
          <Link className="panel" href="/lockers"><h3>Lockers</h3><p>Disponibilidad, solicitudes, entrega, devolución e incidencias de llaves.</p></Link>
          <Link className="panel" href="/incidencias"><h3>Incidencias</h3><p>{incidentRows.length} informes registrados. Gestión del dominio general recuperado desde Formulario-Mamparas.</p></Link>
          <Link className="panel" href="/mamparas"><h3>Mamparas</h3><p>Inspecciones vehiculares, medidas, evidencias y trazabilidad.</p></Link>
        </div>
      </section>
    </main>
  );
}
