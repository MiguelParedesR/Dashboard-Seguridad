'use client';

import { useEffect, useMemo, useState } from 'react';
import IncidentEditor, { type IncidentRow } from '@/components/incidencias/IncidentEditor';

const TYPES = [
  ['TODOS', 'Todos los tipos'],
  ['CABLE', 'Cable RH'],
  ['MERCADERIA', 'Mercadería'],
  ['CHOQUE', 'Choque de unidad'],
  ['SINIESTRO', 'Siniestro']
] as const;

function extra(row: IncidentRow) {
  return row.campos?.valorExtra || { contenedor: null, placa: null };
}

export default function IncidenciasPage() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [editing, setEditing] = useState<IncidentRow | null | undefined>(undefined);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/incidencias', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las incidencias');
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las incidencias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== 'TODOS' && row.tipo_incidencia !== typeFilter) return false;
      if (!search) return true;
      const values = [row.asunto, row.remitente, row.dirigido_a, extra(row).placa, extra(row).contenedor];
      return values.some((value) => String(value || '').toLowerCase().includes(search));
    });
  }, [rows, query, typeFilter]);

  const complete = rows.filter((row) => row.estado === 'COMPLETO').length;
  const drafts = rows.length - complete;

  function saved(row: IncidentRow) {
    setSuccess(row.estado === 'COMPLETO' ? 'Incidencia guardada como informe completo.' : 'Incidencia guardada como borrador.');
    setEditing(undefined);
    setRows((current) => {
      const exists = current.some((item) => item.id === row.id);
      return exists ? current.map((item) => item.id === row.id ? row : item) : [row, ...current];
    });
  }

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Incidencias</div>
          <h1>Gestión integral</h1>
          <p>Flujo migrado desde Formulario-Mamparas con edición, búsqueda por placa/contenedor, anexos y progreso calculado por el servidor.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => { setEditing(null); setSuccess(''); }}>Nueva incidencia</button>
      </div>

      <div className="metric-strip" aria-label="Resumen de incidencias">
        <div className="metric"><div className="value">{rows.length}</div><div className="label">Total</div></div>
        <div className="metric"><div className="value">{complete}</div><div className="label">Completas</div></div>
        <div className="metric"><div className="value">{drafts}</div><div className="label">Borradores</div></div>
        <div className="metric"><div className="value">4</div><div className="label">Tipos estándar</div></div>
      </div>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {success ? <div className="feedback success" role="status">{success}</div> : null}

      {editing !== undefined ? (
        <IncidentEditor key={editing?.id || 'new'} initial={editing} onCancel={() => setEditing(undefined)} onSaved={saved} />
      ) : null}

      <section className="section">
        <div className="section-head">
          <div><h2>Registros</h2><p>{loading ? 'Cargando registros…' : `${filtered.length} incidencias visibles`}</p></div>
          <div className="toolbar">
            <input className="input" aria-label="Buscar incidencias" placeholder="Buscar placa, contenedor o asunto" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" aria-label="Filtrar por tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>{TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <button className="btn btn-secondary" type="button" onClick={load} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
          </div>
        </div>

        {loading ? <div className="empty">Cargando incidencias…</div> : null}
        {!loading && filtered.length === 0 ? <div className="empty">No hay incidencias para los filtros seleccionados.</div> : null}
        {!loading && filtered.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Placa</th><th>Contenedor</th><th>Asunto</th><th>Progreso</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>{filtered.map((row) => <tr key={row.id}>
                <td>{row.fecha_informe || '—'}</td>
                <td>{row.tipo_incidencia}</td>
                <td>{extra(row).placa || '—'}</td>
                <td>{extra(row).contenedor || '—'}</td>
                <td><strong>{row.asunto || '—'}</strong></td>
                <td>{row.progreso}%</td>
                <td><span className={`badge ${row.estado === 'COMPLETO' ? 'success' : 'warning'}`}>{row.estado}</span></td>
                <td><button className="btn btn-secondary" type="button" onClick={() => { setEditing(row); setSuccess(''); }}>Ver / editar</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
