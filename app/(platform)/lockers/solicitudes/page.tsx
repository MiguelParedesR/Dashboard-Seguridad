'use client';

import { useEffect, useMemo, useState } from 'react';

type Solicitud = {
  id: string;
  estado: string;
  created_at?: string;
  observaciones?: string | null;
  foto_locker_url?: string | null;
  colaboradores?: { nombre_completo?: string; dni?: string } | { nombre_completo?: string; dni?: string }[] | null;
  lockers?: { codigo?: string; local?: string; area?: string; estado?: string } | { codigo?: string; local?: string; area?: string; estado?: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value || undefined; }

export default function SolicitudesPage() {
  const [rows, setRows] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('PENDIENTES');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/lockers/solicitudes', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las solicitudes');
      setRows(payload.data || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function act(row: Solicitud, action: 'aprobar' | 'rechazar') {
    if (working) return;
    const motivo = action === 'rechazar' ? window.prompt('Motivo del rechazo (opcional):') ?? undefined : undefined;
    setWorking(row.id); setError(''); setMessage('');
    try {
      const response = await fetch('/api/lockers/solicitudes', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ solicitudId: row.id, action, motivo })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.mensaje || payload.message || payload.error || 'No se pudo procesar');
      setMessage(action === 'aprobar' ? 'Solicitud aprobada y asignación creada.' : 'Solicitud rechazada.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setWorking(''); }
  }

  const filtered = useMemo(() => rows.filter((row) => filter === 'TODAS' || ['CREADA','EN_REVISION'].includes(String(row.estado).toUpperCase())), [rows, filter]);
  const pending = rows.filter((r) => ['CREADA','EN_REVISION'].includes(String(r.estado).toUpperCase())).length;

  return (
    <main>
      <div className="page-head"><div><div className="eyebrow">Lockers</div><h1>Solicitudes</h1><p>Aprobación y rechazo atómicos mediante RPC. Sin escrituras multitabla desde el navegador.</p></div><button className="btn btn-secondary" onClick={load}>Actualizar</button></div>
      <div className="metric-strip">
        <div className="metric"><div className="value">{pending}</div><div className="label">Pendientes</div></div>
        <div className="metric"><div className="value">{rows.filter((r) => r.estado === 'APROBADA').length}</div><div className="label">Aprobadas</div></div>
        <div className="metric"><div className="value">{rows.filter((r) => r.estado === 'RECHAZADA').length}</div><div className="label">Rechazadas</div></div>
        <div className="metric"><div className="value">{rows.length}</div><div className="label">Total</div></div>
      </div>
      <section className="section">
        <div className="section-head"><div><h2>Bandeja operativa</h2><p>La concurrencia aprobar/rechazar queda protegida en PostgreSQL.</p></div><select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="PENDIENTES">Pendientes</option><option value="TODAS">Todas</option></select></div>
        {error ? <div className="feedback error">{error}</div> : null}{message ? <div className="feedback success">{message}</div> : null}
        {loading ? <div className="empty">Cargando solicitudes…</div> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Colaborador</th><th>DNI</th><th>Locker</th><th>Local / área</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {filtered.map((row) => { const c = one(row.colaboradores); const l = one(row.lockers); const eligible = ['CREADA','EN_REVISION'].includes(String(row.estado).toUpperCase()); return <tr key={row.id}>
            <td>{row.created_at ? new Date(row.created_at).toLocaleString('es-PE') : '—'}</td><td>{c?.nombre_completo || '—'}</td><td>{c?.dni || '—'}</td><td><strong>{l?.codigo || '—'}</strong></td><td>{[l?.local,l?.area].filter(Boolean).join(' · ') || '—'}</td><td><span className={`badge ${eligible ? 'warning' : row.estado === 'APROBADA' ? 'success' : 'danger'}`}>{row.estado}</span></td>
            <td>{eligible ? <div className="toolbar"><button className="btn btn-primary" disabled={Boolean(working)} onClick={() => act(row,'aprobar')}>Aprobar</button><button className="btn btn-danger" disabled={Boolean(working)} onClick={() => act(row,'rechazar')}>Rechazar</button></div> : '—'}</td>
          </tr>; })}
        </tbody></table></div>}
      </section>
    </main>
  );
}
