'use client';

import { useEffect, useMemo, useState } from 'react';

type Incidencia = {
  id: string;
  assignmentId: string | null;
  movementId: string | null;
  tipo: string | null;
  descripcion: string | null;
  estado: 'PENDIENTE' | 'RESUELTA';
  resuelta: boolean;
  createdAt: string | null;
  resolvedAt: string | null;
  lockerCodigo: string | null;
  local: string | null;
  area: string | null;
  colaboradorNombre: string | null;
  colaboradorDni: string | null;
  llavesEsperadas: number | null;
  llavesDeclaradas: number | null;
};

type Payload = { data?: Incidencia[]; generatedAt?: string; error?: string };

function normalize(value: unknown) { return String(value ?? '').trim(); }
function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
function options(values: Array<string | null>) {
  return [...new Set(values.map(normalize).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }));
}

export default function IncidenciasLlavesPage() {
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDIENTE');
  const [localFilter, setLocalFilter] = useState('TODOS');
  const [areaFilter, setAreaFilter] = useState('TODAS');
  const [query, setQuery] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/lockers/incidencias', { cache: 'no-store' });
      const payload = (await response.json()) as Payload;
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar incidencias');
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setGeneratedAt(payload.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar incidencias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function resolve(id: string) {
    if (working) return;
    if (!window.confirm('¿Marcar esta incidencia como resuelta?')) return;
    setWorking(id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/lockers/incidencias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ incidenciaId: id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo resolver la incidencia');
      setMessage('Incidencia resuelta correctamente.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver la incidencia');
    } finally {
      setWorking('');
    }
  }

  const locals = useMemo(() => options(rows.map((row) => row.local)), [rows]);
  const areas = useMemo(() => options(rows.map((row) => row.area)), [rows]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'TODAS' && row.estado !== statusFilter) return false;
      if (localFilter !== 'TODOS' && row.local !== localFilter) return false;
      if (areaFilter !== 'TODAS' && row.area !== areaFilter) return false;
      if (!search) return true;
      return [row.lockerCodigo, row.local, row.area, row.colaboradorNombre, row.colaboradorDni, row.tipo, row.descripcion]
        .map((value) => normalize(value).toLowerCase())
        .join(' ')
        .includes(search);
    });
  }, [rows, statusFilter, localFilter, areaFilter, query]);

  const pending = rows.filter((row) => !row.resuelta).length;
  const resolved = rows.filter((row) => row.resuelta).length;
  const differences = rows.filter((row) => row.llavesEsperadas !== null && row.llavesDeclaradas !== null && row.llavesEsperadas !== row.llavesDeclaradas).length;
  const hasFilters = Boolean(query.trim()) || statusFilter !== 'PENDIENTE' || localFilter !== 'TODOS' || areaFilter !== 'TODAS';

  function clearFilters() {
    setQuery(''); setStatusFilter('PENDIENTE'); setLocalFilter('TODOS'); setAreaFilter('TODAS');
  }

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Lockers · control</div>
          <h1>Incidencias de llaves</h1>
          <p>Control de diferencias y eventos de llaves con resolución centralizada por RPC.</p>
          {generatedAt ? <p style={{ marginTop: 8, fontSize: 12 }}>Última lectura: {formatDateTime(generatedAt)}</p> : null}
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading || Boolean(working)} type="button">{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>

      <div className="metric-strip">
        <div className="metric"><div className="value">{pending}</div><div className="label">Pendientes</div></div>
        <div className="metric"><div className="value">{resolved}</div><div className="label">Resueltas</div></div>
        <div className="metric"><div className="value">{rows.length}</div><div className="label">Históricas</div></div>
        <div className="metric"><div className="value">{differences}</div><div className="label">Con diferencia</div></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div><h2>Control operativo</h2><p>{loading ? 'Cargando…' : `${visible.length} incidencias visibles`}</p></div>
          <div className="toolbar">
            <input className="input" placeholder="Buscar locker o colaborador" aria-label="Buscar incidencia" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="select" aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="PENDIENTE">Pendientes</option><option value="RESUELTA">Resueltas</option><option value="TODAS">Todas</option></select>
            <select className="select" aria-label="Filtrar por local" value={localFilter} onChange={(event) => setLocalFilter(event.target.value)}><option value="TODOS">Todos los locales</option>{locals.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="select" aria-label="Filtrar por área" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option value="TODAS">Todas las áreas</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            {hasFilters ? <button className="btn btn-secondary" type="button" onClick={clearFilters}>Limpiar</button> : null}
          </div>
        </div>

        {error ? <div className="feedback error" role="alert">{error}</div> : null}
        {message ? <div className="feedback success" role="status">{message}</div> : null}
        {loading ? <div className="empty">Cargando incidencias…</div> : null}
        {!loading && !error && visible.length === 0 ? <div className="empty">No hay incidencias que coincidan con los filtros.</div> : null}

        {!loading && visible.length > 0 ? (
          <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Locker</th><th>Colaborador</th><th>Tipo</th><th>Esperadas</th><th>Declaradas</th><th>Diferencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
            {visible.map((row) => {
              const difference = row.llavesEsperadas !== null && row.llavesDeclaradas !== null ? row.llavesDeclaradas - row.llavesEsperadas : null;
              return <tr key={row.id}>
                <td>{formatDateTime(row.createdAt)}</td>
                <td><strong>{row.lockerCodigo || '—'}</strong><br/><span style={{ color: 'var(--muted)' }}>{[row.local, row.area].filter(Boolean).join(' · ') || '—'}</span></td>
                <td>{row.colaboradorNombre || '—'}{row.colaboradorDni ? <><br/><span style={{ color: 'var(--muted)' }}>{row.colaboradorDni}</span></> : null}</td>
                <td>{row.tipo || row.descripcion || '—'}</td>
                <td>{row.llavesEsperadas ?? '—'}</td><td>{row.llavesDeclaradas ?? '—'}</td>
                <td>{difference === null ? '—' : difference === 0 ? <span className="badge success">Sin diferencia</span> : <span className="badge danger">{difference > 0 ? `+${difference}` : difference}</span>}</td>
                <td><span className={`badge ${row.resuelta ? 'success' : 'danger'}`}>{row.estado}</span></td>
                <td>{!row.resuelta ? <button className="btn btn-primary" disabled={Boolean(working)} onClick={() => resolve(row.id)} type="button">{working === row.id ? 'Resolviendo…' : 'Resolver'}</button> : <span style={{ color: 'var(--muted)' }}>{formatDateTime(row.resolvedAt)}</span>}</td>
              </tr>;
            })}
          </tbody></table></div>
        ) : null}
      </section>
    </main>
  );
}
