'use client';

import { useEffect, useMemo, useState } from 'react';

type HistoryRow = {
  id: string;
  createdAt: string | null;
  evento: string;
  eventoLabel: string;
  tipoEvento: string;
  operadorNombre: string;
  colaboradorNombre: string;
  lockerCodigo: string;
  local: string;
  area: string;
  llavesText: string;
};

type Payload = { data?: HistoryRow[]; generatedAt?: string; error?: string };

function normalize(value: unknown) { return String(value ?? '').trim(); }
function options(values: string[]) {
  return [...new Set(values.map(normalize).filter((value) => value && value !== '—'))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }));
}
function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
function dateKey(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function LockerHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState('TODOS');
  const [area, setArea] = useState('TODAS');
  const [event, setEvent] = useState('TODOS');
  const [date, setDate] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/lockers/historial', { cache: 'no-store' });
      const payload = (await response.json()) as Payload;
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el historial');
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setGeneratedAt(payload.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const locals = useMemo(() => options(rows.map((row) => row.local)), [rows]);
  const areas = useMemo(() => options(rows.map((row) => row.area)), [rows]);
  const events = useMemo(() => options(rows.map((row) => row.eventoLabel)), [rows]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (local !== 'TODOS' && row.local !== local) return false;
      if (area !== 'TODAS' && row.area !== area) return false;
      if (event !== 'TODOS' && row.eventoLabel !== event) return false;
      if (date && dateKey(row.createdAt) !== date) return false;
      if (!search) return true;
      return [row.eventoLabel, row.tipoEvento, row.operadorNombre, row.colaboradorNombre, row.lockerCodigo, row.local, row.area, row.llavesText]
        .map((value) => normalize(value).toLowerCase())
        .join(' ')
        .includes(search);
    });
  }, [rows, query, local, area, event, date]);

  const hasFilters = Boolean(query.trim()) || local !== 'TODOS' || area !== 'TODAS' || event !== 'TODOS' || Boolean(date);
  function clearFilters() { setQuery(''); setLocal('TODOS'); setArea('TODAS'); setEvent('TODOS'); setDate(''); }

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Lockers · auditoría</div>
          <h1>Historial</h1>
          <p>Consulta de solo lectura desde historial_locker, separada de las incidencias operativas.</p>
          {generatedAt ? <p style={{ marginTop: 8, fontSize: 12 }}>Última lectura: {formatDateTime(generatedAt)}</p> : null}
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading} type="button">{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>

      <section className="section">
        <div className="section-head">
          <div><h2>Trazabilidad de lockers</h2><p>{loading ? 'Cargando historial…' : `${filtered.length} de ${rows.length} eventos visibles`}</p></div>
          <div className="toolbar">
            <input className="input" aria-label="Buscar historial" placeholder="Buscar locker, persona o evento" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" aria-label="Filtrar por local" value={local} onChange={(e) => setLocal(e.target.value)}><option value="TODOS">Todos los locales</option>{locals.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="select" aria-label="Filtrar por área" value={area} onChange={(e) => setArea(e.target.value)}><option value="TODAS">Todas las áreas</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="select" aria-label="Filtrar por evento" value={event} onChange={(e) => setEvent(e.target.value)}><option value="TODOS">Todos los eventos</option>{events.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <input className="input" aria-label="Filtrar por fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {hasFilters ? <button className="btn btn-secondary" type="button" onClick={clearFilters}>Limpiar</button> : null}
          </div>
        </div>

        {error ? <div className="feedback error" role="alert">{error}</div> : null}
        {loading ? <div className="empty">Cargando historial…</div> : null}
        {!loading && !error && filtered.length === 0 ? <div className="empty">No hay eventos para los filtros seleccionados.</div> : null}

        {!loading && filtered.length > 0 ? (
          <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Tipo</th><th>Operador</th><th>Colaborador</th><th>Locker</th><th>Local</th><th>Área</th><th>Llaves</th></tr></thead><tbody>
            {filtered.map((row) => <tr key={row.id}><td>{formatDateTime(row.createdAt)}</td><td><strong>{row.eventoLabel}</strong></td><td>{row.tipoEvento}</td><td>{row.operadorNombre}</td><td>{row.colaboradorNombre}</td><td><strong>{row.lockerCodigo}</strong></td><td>{row.local}</td><td>{row.area}</td><td>{row.llavesText}</td></tr>)}
          </tbody></table></div>
        ) : null}
      </section>
    </main>
  );
}
