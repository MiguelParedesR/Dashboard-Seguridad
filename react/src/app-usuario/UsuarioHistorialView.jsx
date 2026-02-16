import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAsignacionesByIds,
  fetchColaboradoresByIds,
  fetchLockersByIds,
  formatDateOnly,
  formatDateTime,
  getClientOrThrow,
  normalizeText
} from './usuarioApi.js';
import './usuario.css';

async function fetchMovimientos(supabase) {
  const ordered = await supabase
    .from('llaves_movimientos')
    .select('*')
    .order('created_at', { ascending: false });

  if (!ordered.error) {
    return ordered.data || [];
  }

  const fallback = await supabase
    .from('llaves_movimientos')
    .select('*');

  if (fallback.error) throw fallback.error;
  return fallback.data || [];
}

export default function UsuarioHistorialView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({
    local: 'ALL',
    area: 'ALL',
    tipo: 'ALL',
    fecha: ''
  });

  const loadHistorial = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const movimientos = await fetchMovimientos(supabase);
      const asignacionesMap = await fetchAsignacionesByIds(
        supabase,
        movimientos.map((item) => item.asignacion_id)
      );

      const assignments = Array.from(asignacionesMap.values());
      const [lockersMap, colaboradoresMap] = await Promise.all([
        fetchLockersByIds(
          supabase,
          assignments.map((item) => item.locker_id)
        ),
        fetchColaboradoresByIds(
          supabase,
          assignments.map((item) => item.colaborador_id)
        )
      ]);

      const hydrated = movimientos.map((movimiento) => {
        const asignacion = asignacionesMap.get(String(movimiento.asignacion_id));
        const locker = asignacion ? lockersMap.get(String(asignacion.locker_id)) : null;
        const colaborador = asignacion ? colaboradoresMap.get(String(asignacion.colaborador_id)) : null;

        return {
          ...movimiento,
          locker_codigo: normalizeText(locker?.codigo),
          local: normalizeText(locker?.local),
          area: normalizeText(locker?.area),
          colaborador_nombre: normalizeText(colaborador?.nombre_completo, 'Sin nombre')
        };
      });

      setRecords(hydrated);
    } catch (err) {
      setRecords([]);
      setError(err?.message || 'No se pudo cargar el historial de movimientos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistorial();
  }, [loadHistorial]);

  const localOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((item) => item.local).filter((value) => value && value !== '--')));
    return values.sort((a, b) => a.localeCompare(b, 'es'));
  }, [records]);

  const areaOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((item) => item.area).filter((value) => value && value !== '--')));
    return values.sort((a, b) => a.localeCompare(b, 'es'));
  }, [records]);

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        if (filters.local !== 'ALL' && item.local !== filters.local) return false;
        if (filters.area !== 'ALL' && item.area !== filters.area) return false;
        if (filters.tipo !== 'ALL' && String(item.tipo || '').toUpperCase() !== filters.tipo) return false;
        if (filters.fecha) {
          const currentDate = formatDateOnly(item.created_at);
          if (currentDate !== filters.fecha) return false;
        }
        return true;
      }),
    [filters.area, filters.fecha, filters.local, filters.tipo, records]
  );

  return (
    <main className="usuario-page">
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Historial</h1>
            <p>Consulta de movimientos historicos de llaves (solo lectura).</p>
          </div>
          <button className="usuario-ghost-button" type="button" onClick={loadHistorial} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && <p className="usuario-error">{error}</p>}

        <div className="usuario-filters">
          <div className="usuario-filter">
            <label htmlFor="historial-local">Local</label>
            <select
              id="historial-local"
              value={filters.local}
              onChange={(event) => setFilters((current) => ({ ...current, local: event.target.value }))}
            >
              <option value="ALL">Todos</option>
              {localOptions.map((local) => (
                <option key={local} value={local}>
                  {local}
                </option>
              ))}
            </select>
          </div>

          <div className="usuario-filter">
            <label htmlFor="historial-area">Area</label>
            <select
              id="historial-area"
              value={filters.area}
              onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))}
            >
              <option value="ALL">Todas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="usuario-filter">
            <label htmlFor="historial-fecha">Fecha</label>
            <input
              id="historial-fecha"
              type="date"
              value={filters.fecha}
              onChange={(event) => setFilters((current) => ({ ...current, fecha: event.target.value }))}
            />
          </div>

          <div className="usuario-filter">
            <label htmlFor="historial-tipo">Tipo</label>
            <select
              id="historial-tipo"
              value={filters.tipo}
              onChange={(event) => setFilters((current) => ({ ...current, tipo: event.target.value }))}
            >
              <option value="ALL">Todos</option>
              <option value="ENTREGA">ENTREGA</option>
              <option value="DEVOLUCION">DEVOLUCION</option>
            </select>
          </div>
        </div>
      </section>

      <section className="usuario-card">
        {loading && <p className="usuario-subtle">Cargando historial...</p>}
        {!loading && filtered.length === 0 && <p className="usuario-warning">No hay movimientos para los filtros seleccionados.</p>}

        {!loading && filtered.length > 0 && (
          <div className="usuario-table-wrap">
            <table className="usuario-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Colaborador</th>
                  <th>Locker</th>
                  <th>Local</th>
                  <th>Area</th>
                  <th>Declaradas</th>
                  <th>Esperadas</th>
                  <th>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>{normalizeText(item.tipo)}</td>
                    <td>{item.colaborador_nombre}</td>
                    <td>{item.locker_codigo}</td>
                    <td>{item.local}</td>
                    <td>{item.area}</td>
                    <td>{normalizeText(item.llaves_declaradas, '--')}</td>
                    <td>{normalizeText(item.llaves_esperadas, '--')}</td>
                    <td>
                      {item.foto_llaves_url ? (
                        <a href={item.foto_llaves_url} target="_blank" rel="noreferrer">
                          Ver foto
                        </a>
                      ) : (
                        'Sin foto'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
