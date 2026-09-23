'use client';

import { useEffect, useMemo, useState } from 'react';

type Incidencia = {
  id: string;
  tipo?: string;
  descripcion?: string;
  resuelta?: boolean;
  estado?: string;
  created_at?: string;
  resolved_at?: string | null;
  locker?: { codigo?: string; local?: string; area?: string } | null;
  colaborador?: { nombre_completo?: string; dni?: string } | null;
  llaves_esperadas?: number | null;
  llaves_declaradas?: number | null;
  llaves_devueltas?: number | null;
};

export default function IncidenciasLlavesPage() {
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/lockers/incidencias', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar incidencias');
      setRows(payload.data || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function resolve(id: string) {
    setWorking(id); setError('');
    try {
      const response = await fetch('/api/lockers/incidencias', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ incidenciaId: id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo resolver');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setWorking(''); }
  }

  const visible = useMemo(() => showResolved ? rows : rows.filter((r) => !r.resuelta), [rows, showResolved]);
  const pending = rows.filter((r) => !r.resuelta).length;

  return (
    <main>
      <div className="page-head"><div><div className="eyebrow">Lockers · control</div><h1>Incidencias de llaves</h1><p>Fuente canónica: incidencias_llaves. Las cantidades se hidratan desde asignaciones y movimientos reales.</p></div><button className="btn btn-secondary" onClick={load}>Actualizar</button></div>
      <div className="metric-strip">
        <div className="metric"><div className="value">{pending}</div><div className="label">Pendientes</div></div>
        <div className="metric"><div className="value">{rows.filter((r) => r.resuelta).length}</div><div className="label">Resueltas</div></div>
        <div className="metric"><div className="value">{rows.length}</div><div className="label">Históricas</div></div>
        <div className="metric"><div className="value">{rows.filter((r) => (r.llaves_esperadas ?? 0) !== (r.llaves_declaradas ?? r.llaves_devueltas ?? 0)).length}</div><div className="label">Con diferencia</div></div>
      </div>
      <section className="section">
        <div className="section-head"><div><h2>Control operativo</h2><p>Resolver una incidencia no altera manualmente el estado del locker desde la interfaz.</p></div><label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, color:'var(--muted)' }}><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Mostrar resueltas</label></div>
        {error ? <div className="feedback error">{error}</div> : null}
        {loading ? <div className="empty">Cargando…</div> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Locker</th><th>Colaborador</th><th>Tipo</th><th>Esperadas</th><th>Declaradas</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
          {visible.map((row) => <tr key={row.id}><td>{row.created_at ? new Date(row.created_at).toLocaleString('es-PE') : '—'}</td><td><strong>{row.locker?.codigo || '—'}</strong><br/><span style={{color:'var(--muted)'}}>{[row.locker?.local,row.locker?.area].filter(Boolean).join(' · ')}</span></td><td>{row.colaborador?.nombre_completo || '—'}</td><td>{row.tipo || row.descripcion || '—'}</td><td>{row.llaves_esperadas ?? '—'}</td><td>{row.llaves_declaradas ?? row.llaves_devueltas ?? '—'}</td><td><span className={`badge ${row.resuelta ? 'success' : 'danger'}`}>{row.resuelta ? 'RESUELTA' : 'PENDIENTE'}</span></td><td>{!row.resuelta ? <button className="btn btn-primary" disabled={working === row.id} onClick={() => resolve(row.id)}>{working === row.id ? 'Resolviendo…' : 'Resolver'}</button> : '—'}</td></tr>)}
        </tbody></table></div>}
      </section>
    </main>
  );
}
