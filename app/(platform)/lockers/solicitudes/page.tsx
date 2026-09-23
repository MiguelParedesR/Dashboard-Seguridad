'use client';

import { useEffect, useMemo, useState } from 'react';

const PENDING_STATES = ['CREADA', 'EN_REVISION'];

type Solicitud = {
  id: string;
  colaboradorId: string;
  lockerId: string;
  estado: string;
  fotoLockerUrl: string | null;
  observaciones: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  colaboradorNombre: string | null;
  colaboradorDni: string | null;
  lockerCodigo: string | null;
  local: string | null;
  area: string | null;
  lockerEstado: string | null;
};

type Payload = {
  data?: Solicitud[];
  generatedAt?: string;
  success?: boolean;
  action?: 'aprobar' | 'rechazar';
  estado?: string;
  error?: string;
};

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function isPending(estado: unknown) {
  return PENDING_STATES.includes(normalize(estado).toUpperCase());
}

function statusClass(estado: string) {
  const normalized = normalize(estado).toUpperCase();
  if (normalized === 'APROBADA') return 'success';
  if (normalized === 'RECHAZADA') return 'danger';
  return 'warning';
}

function statusLabel(estado: string) {
  return normalize(estado).replace(/_/g, ' ');
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function options(values: Array<string | null>) {
  return [...new Set(values.map((value) => normalize(value)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  );
}

export default function SolicitudesPage() {
  const [rows, setRows] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDIENTES');
  const [localFilter, setLocalFilter] = useState('TODOS');
  const [areaFilter, setAreaFilter] = useState('TODAS');
  const [query, setQuery] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/lockers/solicitudes', { cache: 'no-store' });
      const payload = (await response.json()) as Payload;
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las solicitudes');
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setGeneratedAt(payload.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(row: Solicitud, action: 'aprobar' | 'rechazar') {
    if (working || !isPending(row.estado)) return;

    let motivo: string | undefined;
    if (action === 'aprobar') {
      const confirmed = window.confirm(`¿Aprobar la solicitud del locker ${row.lockerCodigo || 'seleccionado'}?`);
      if (!confirmed) return;
    } else {
      const input = window.prompt('Motivo del rechazo (opcional). Presiona Cancelar para volver sin rechazar:', '');
      if (input === null) return;
      motivo = input.trim() || undefined;
    }

    setWorking(row.id);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/lockers/solicitudes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ solicitudId: row.id, action, motivo })
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok) throw new Error(payload.error || 'No se pudo procesar la solicitud');

      setMessage(
        action === 'aprobar'
          ? 'Solicitud aprobada. La asignación fue creada por la RPC.'
          : 'Solicitud rechazada correctamente.'
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud');
    } finally {
      setWorking('');
    }
  }

  const locals = useMemo(() => options(rows.map((row) => row.local)), [rows]);
  const areas = useMemo(() => options(rows.map((row) => row.area)), [rows]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      const estado = normalize(row.estado).toUpperCase();
      if (statusFilter === 'PENDIENTES' && !isPending(estado)) return false;
      if (statusFilter !== 'PENDIENTES' && statusFilter !== 'TODAS' && estado !== statusFilter) return false;
      if (localFilter !== 'TODOS' && row.local !== localFilter) return false;
      if (areaFilter !== 'TODAS' && row.area !== areaFilter) return false;
      if (!search) return true;

      const haystack = [
        row.colaboradorNombre,
        row.colaboradorDni,
        row.lockerCodigo,
        row.local,
        row.area,
        row.observaciones
      ].map((value) => normalize(value).toLowerCase()).join(' ');
      return haystack.includes(search);
    });
  }, [rows, statusFilter, localFilter, areaFilter, query]);

  const counts = useMemo(() => ({
    pending: rows.filter((row) => isPending(row.estado)).length,
    approved: rows.filter((row) => normalize(row.estado).toUpperCase() === 'APROBADA').length,
    rejected: rows.filter((row) => normalize(row.estado).toUpperCase() === 'RECHAZADA').length,
    total: rows.length
  }), [rows]);

  const hasFilters = Boolean(query.trim()) || statusFilter !== 'PENDIENTES' || localFilter !== 'TODOS' || areaFilter !== 'TODAS';

  function clearFilters() {
    setQuery('');
    setStatusFilter('PENDIENTES');
    setLocalFilter('TODOS');
    setAreaFilter('TODAS');
  }

  return (
    <main>
      <div className="page-head">
        <div>
          <div className="eyebrow">Lockers</div>
          <h1>Solicitudes</h1>
          <p>Aprobación y rechazo ejecutados únicamente por RPC server-side. La concurrencia queda resuelta en PostgreSQL.</p>
          {generatedAt ? <p style={{ marginTop: 8, fontSize: 12 }}>Última lectura: {formatDateTime(generatedAt)}</p> : null}
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading || Boolean(working)} type="button">
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div className="metric-strip" aria-label="Resumen de solicitudes">
        <div className="metric"><div className="value">{counts.pending}</div><div className="label">Pendientes</div></div>
        <div className="metric"><div className="value">{counts.approved}</div><div className="label">Aprobadas</div></div>
        <div className="metric"><div className="value">{counts.rejected}</div><div className="label">Rechazadas</div></div>
        <div className="metric"><div className="value">{counts.total}</div><div className="label">Total</div></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Bandeja operativa</h2>
            <p>{loading ? 'Cargando solicitudes…' : `${filtered.length} solicitudes visibles`}</p>
          </div>
          <div className="toolbar">
            <input
              className="input"
              aria-label="Buscar solicitudes"
              placeholder="Buscar colaborador, DNI o locker"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select className="select" aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="PENDIENTES">Pendientes</option>
              <option value="CREADA">Creada</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="TODAS">Todas</option>
            </select>
            <select className="select" aria-label="Filtrar por local" value={localFilter} onChange={(event) => setLocalFilter(event.target.value)}>
              <option value="TODOS">Todos los locales</option>
              {locals.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="select" aria-label="Filtrar por área" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="TODAS">Todas las áreas</option>
              {areas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {hasFilters ? <button className="btn btn-secondary" type="button" onClick={clearFilters}>Limpiar</button> : null}
          </div>
        </div>

        {error ? <div className="feedback error" role="alert">{error}</div> : null}
        {message ? <div className="feedback success" role="status">{message}</div> : null}
        {loading ? <div className="empty">Cargando solicitudes…</div> : null}
        {!loading && !error && filtered.length === 0 ? <div className="empty">No hay solicitudes que coincidan con los filtros seleccionados.</div> : null}

        {!loading && filtered.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Colaborador</th>
                  <th>DNI</th>
                  <th>Locker</th>
                  <th>Local / área</th>
                  <th>Observación</th>
                  <th>Evidencia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const eligible = isPending(row.estado);
                  const busy = working === row.id;
                  return (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td><strong>{row.colaboradorNombre || 'Sin nombre'}</strong></td>
                      <td>{row.colaboradorDni || 'N/D'}</td>
                      <td><strong>{row.lockerCodigo || '—'}</strong></td>
                      <td>{[row.local, row.area].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{row.observaciones || '—'}</td>
                      <td>
                        {row.fotoLockerUrl ? (
                          <a href={row.fotoLockerUrl} target="_blank" rel="noreferrer">Ver foto</a>
                        ) : '—'}
                      </td>
                      <td><span className={`badge ${statusClass(row.estado)}`}>{statusLabel(row.estado)}</span></td>
                      <td>
                        {eligible ? (
                          <div className="toolbar">
                            <button className="btn btn-primary" disabled={Boolean(working)} onClick={() => act(row, 'aprobar')} type="button">
                              {busy ? 'Procesando…' : 'Aprobar'}
                            </button>
                            <button className="btn btn-danger" disabled={Boolean(working)} onClick={() => act(row, 'rechazar')} type="button">
                              {busy ? 'Procesando…' : 'Rechazar'}
                            </button>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
