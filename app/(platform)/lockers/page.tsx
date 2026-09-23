'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STATE_ORDER = ['LIBRE', 'OCUPADO', 'MANTENIMIENTO', 'BLOQUEADO', 'SE_DESCONOCE'];

type Locker = {
  id: string;
  codigo: string;
  local: string;
  area: string;
  estado: string;
  activo: boolean;
  tiene_candado: boolean;
  tiene_duplicado_llave: boolean;
  llaves_esperadas: number;
  asignacion_id: string | null;
  colaborador_id: string | null;
  colaborador_nombre: string | null;
  fecha_asignacion: string | null;
  incidencias_pendientes: number;
  tiene_incidencia_llaves: boolean;
};

type OverviewPayload = {
  data?: Locker[];
  generatedAt?: string;
  error?: string;
};

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function optionList(values: string[]) {
  return [...new Set(values.map((value) => normalize(value)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  );
}

function stateClass(estado: string) {
  if (estado === 'LIBRE') return 'success';
  if (estado === 'OCUPADO') return 'info';
  if (estado === 'BLOQUEADO') return 'danger';
  return 'warning';
}

function stateLabel(estado: string) {
  if (estado === 'SE_DESCONOCE') return 'Se desconoce';
  return estado.replace(/_/g, ' ').toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function LockersPage() {
  const [rows, setRows] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [local, setLocal] = useState('TODOS');
  const [area, setArea] = useState('TODAS');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/lockers/overview', { cache: 'no-store' });
      const payload = (await response.json()) as OverviewPayload;
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar lockers');
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setGeneratedAt(payload.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar lockers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const locals = useMemo(() => optionList(rows.map((row) => row.local)), [rows]);
  const areas = useMemo(() => optionList(rows.map((row) => row.area)), [rows]);
  const states = useMemo(() => {
    const dynamic = optionList(rows.map((row) => row.estado));
    return [...STATE_ORDER.filter((item) => dynamic.includes(item)), ...dynamic.filter((item) => !STATE_ORDER.includes(item))];
  }, [rows]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (estado !== 'TODOS' && row.estado !== estado) return false;
      if (local !== 'TODOS' && row.local !== local) return false;
      if (area !== 'TODAS' && row.area !== area) return false;
      if (!search) return true;
      return [row.codigo, row.local, row.area, row.colaborador_nombre || ''].join(' ').toLowerCase().includes(search);
    });
  }, [rows, query, estado, local, area]);

  const counts = useMemo(() => ({
    total: rows.length,
    libre: rows.filter((row) => row.estado === 'LIBRE').length,
    ocupado: rows.filter((row) => row.estado === 'OCUPADO').length,
    incidencia: rows.filter((row) => row.tiene_incidencia_llaves).length
  }), [rows]);

  const hasFilters = Boolean(query.trim()) || estado !== 'TODOS' || local !== 'TODOS' || area !== 'TODAS';
  function clearFilters() { setQuery(''); setEstado('TODOS'); setLocal('TODOS'); setArea('TODAS'); }

  return (
    <main>
      <div className="page-head">
        <div><div className="eyebrow">Lockers</div><h1>Vista general</h1><p>Lectura consolidada de lockers activos, asignaciones vigentes e incidencias de llaves.</p>{generatedAt ? <p style={{ marginTop: 8, fontSize: 12 }}>Actualizado {formatDate(generatedAt)} {formatTime(generatedAt)}</p> : null}</div>
        <button className="btn btn-secondary" onClick={load} disabled={loading} type="button">{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>

      <div className="metric-strip" aria-label="Resumen de lockers activos">
        <div className="metric"><div className="value">{counts.total}</div><div className="label">Activos</div></div>
        <div className="metric"><div className="value">{counts.libre}</div><div className="label">Libres</div></div>
        <div className="metric"><div className="value">{counts.ocupado}</div><div className="label">Ocupados</div></div>
        <div className="metric"><div className="value">{counts.incidencia}</div><div className="label">Con incidencia pendiente</div></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div><h2>Inventario operativo</h2><p>{loading ? 'Cargando inventario…' : `${filtered.length} de ${rows.length} lockers visibles`}</p></div>
          <div className="toolbar">
            <input className="input" aria-label="Buscar locker" placeholder="Buscar locker o colaborador" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select className="select" aria-label="Filtrar por local" value={local} onChange={(event) => setLocal(event.target.value)}><option value="TODOS">Todos los locales</option>{locals.map((item) => <option value={item} key={item}>{item}</option>)}</select>
            <select className="select" aria-label="Filtrar por área" value={area} onChange={(event) => setArea(event.target.value)}><option value="TODAS">Todas las áreas</option>{areas.map((item) => <option value={item} key={item}>{item}</option>)}</select>
            <select className="select" aria-label="Filtrar por estado" value={estado} onChange={(event) => setEstado(event.target.value)}><option value="TODOS">Todos los estados</option>{states.map((item) => <option value={item} key={item}>{stateLabel(item)}</option>)}</select>
            {hasFilters ? <button className="btn btn-secondary" onClick={clearFilters} type="button">Limpiar</button> : null}
          </div>
        </div>

        {error ? <div className="feedback error" role="alert">{error}</div> : null}
        {loading ? <div className="empty">Cargando…</div> : null}
        {!loading && !error && filtered.length === 0 ? <div className="empty">No hay lockers que coincidan con los filtros seleccionados.</div> : null}

        {!loading && filtered.length > 0 ? (
          <div className="table-wrap"><table><thead><tr><th>Locker</th><th>Local</th><th>Área</th><th>Estado</th><th>Colaborador</th><th>Asignado</th><th>Llaves</th><th>Alerta</th><th>Acción</th></tr></thead><tbody>
            {filtered.map((row) => <tr key={row.id}>
              <td><strong>{row.codigo}</strong></td><td>{row.local || '—'}</td><td>{row.area || '—'}</td><td><span className={`badge ${stateClass(row.estado)}`}>{stateLabel(row.estado)}</span></td><td>{row.colaborador_nombre || 'Sin asignación'}</td><td>{formatDate(row.fecha_asignacion)}</td><td>{row.llaves_esperadas === 1 ? '1 esperada' : `${row.llaves_esperadas} esperadas`}</td>
              <td>{row.incidencias_pendientes > 0 ? <span className="badge danger">{row.incidencias_pendientes === 1 ? '1 pendiente' : `${row.incidencias_pendientes} pendientes`}</span> : '—'}</td>
              <td>{row.estado === 'OCUPADO' && row.asignacion_id ? <Link className="btn btn-secondary" href={`/lockers/devolucion/${row.asignacion_id}`}>Registrar devolución</Link> : '—'}</td>
            </tr>)}
          </tbody></table></div>
        ) : null}
      </section>
    </main>
  );
}
