import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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

  const flows = [
    {
      href: '/lockers',
      title: 'Lockers',
      description: 'Disponibilidad, solicitudes, entrega, devolución e incidencias de llaves.'
    },
    {
      href: '/incidencias',
      title: 'Incidencias',
      description: `${incidentRows.length} informes registrados. Gestión operativa y seguimiento documental.`
    },
    {
      href: '/mamparas',
      title: 'Mamparas',
      description: 'Inspecciones vehiculares, medidas, evidencias y trazabilidad.'
    }
  ];

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operación consolidada</div>
          <h1>Seguridad, en una sola vista.</h1>
          <p>La información prioritaria aparece primero; cada flujo se abre desde una única superficie de trabajo.</p>
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
        <div className="section-head">
          <div>
            <h2>Flujos operativos</h2>
            <p>Accesos directos, sin tarjetas ni contenedores innecesarios.</p>
          </div>
        </div>
        <div className="flow-list">
          {flows.map((flow) => (
            <Link className="flow-link" href={flow.href} key={flow.href}>
              <strong>{flow.title}</strong>
              <span>{flow.description}</span>
              <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
