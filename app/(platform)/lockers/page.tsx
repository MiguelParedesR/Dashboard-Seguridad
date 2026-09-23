'use client';

import { useEffect, useMemo, useState } from 'react';

type Locker = {
  id: string;
  codigo?: string;
  local?: string;
  area?: string;
  estado?: string;
  colaborador_nombre?: string | null;
  tiene_candado?: boolean;
  tiene_duplicado_llave?: boolean;
  tiene_incidencia_llaves?: boolean;
};

export default function LockersPage() {
  const [rows, setRows] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('TODOS');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/lockers/overview', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar lockers');
      setRows(payload.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar lockers');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const text = `${row.codigo || ''} ${row.local || ''} ${row.area || ''} ${row.colaborador_nombre || ''}`.toLowerCase();
    const state = String(row.estado || '').toUpperCase();
    return text.includes(query.trim().toLowerCase()) && (estado === 'TODOS' || state === estado);
  }), [rows, query, estado]);

  const counts = useMemo(() => ({
    total: rows.length,
    libre: rows.filter((r) => String(r.estado).toUpperCase() === 'LIBRE').length,
    ocupado: rows.filter((r) => String(r.estado).toUpperCase() === 'OCUPADO').length,
    incidencia: rows.filter((r) => r.tiene_incidencia_llaves).length
  }), [rows]);

  return (
    <main>
      <div className="page-head">
        <div><div className="eyebrow">Lockers</div><h1>Vista general</h1><p>Estado operativo, ocupación y alertas en tiempo real desde una única fuente.</p></div>
        <button className="btn btn-secondary" onClick={load} type="button">Actualizar</button>
      </div>
      <div className="metric-strip">
        <div className="metric"><div className="value">{counts.total}</div><div className="label">Total</div></div>
        <div className="metric"><div className="value">{counts.libre}</div><div className="label">Libres</div></div>
        <div className="metric"><div className="value">{counts.ocupado}</div><div className="label">Ocupados</div></div>
        <div className="metric"><div className="value">{counts.incidencia}</div><div className="label">Con incidencia</div></div>
      </div>
      <section className="section">
        <div className="section-head">
          <div><h2>Inventario</h2><p>Sin cambios manuales de estado desde esta vista.</p></div>
          <div className="toolbar">
            <input className="input" placeholder="Buscar locker, local o colaborador" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)}><option>TODOS</option><option>LIBRE</option><option>OCUPADO</option><option>MANTENIMIENTO</option></select>
          </div>
        </div>
        {error ? <div className="feedback error">{error}</div> : null}
        {loading ? <div className="empty">Cargando…</div> : (
          <div className="table-wrap"><table><thead><tr><th>Locker</th><th>Local</th><th>Área</th><th>Estado</th><th>Colaborador</th><th>Llaves</th><th>Alerta</th></tr></thead><tbody>
            {filtered.map((row) => <tr key={row.id}>
              <td><strong>{row.codigo || '—'}</strong></td><td>{row.local || '—'}</td><td>{row.area || '—'}</td>
              <td><span className={`badge ${String(row.estado).toUpperCase() === 'LIBRE' ? 'success' : String(row.estado).toUpperCase() === 'OCUPADO' ? 'info' : 'warning'}`}>{row.estado || 'SIN ESTADO'}</span></td>
              <td>{row.colaborador_nombre || '—'}</td><td>{Number(Boolean(row.tiene_candado)) + Number(Boolean(row.tiene_duplicado_llave))}</td>
              <td>{row.tiene_incidencia_llaves ? <span className="badge danger">Incidencia</span> : '—'}</td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}
