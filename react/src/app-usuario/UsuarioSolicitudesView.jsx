import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchColaboradoresByIds,
  fetchLockersByIds,
  formatDateTime,
  getClientOrThrow,
  normalizeText
} from './usuarioApi.js';
import './usuario.css';

const ESTADOS_PENDIENTES = ['CREADA', 'EN_REVISION'];

function toEstadoClass(estado) {
  return String(estado || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export default function UsuarioSolicitudesView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [solicitudes, setSolicitudes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({
    estado: 'ALL',
    local: 'ALL',
    area: 'ALL'
  });

  const loadSolicitudes = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const { data, error: queryError } = await supabase
        .from('solicitudes_locker')
        .select('id,colaborador_id,locker_id,estado,foto_locker_url,observaciones,created_at')
        .in('estado', ESTADOS_PENDIENTES)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;

      const rows = Array.isArray(data) ? data : [];
      const [colaboradoresMap, lockersMap] = await Promise.all([
        fetchColaboradoresByIds(
          supabase,
          rows.map((item) => item.colaborador_id)
        ),
        fetchLockersByIds(
          supabase,
          rows.map((item) => item.locker_id)
        )
      ]);

      const hydrated = rows.map((item) => {
        const colaborador = colaboradoresMap.get(String(item.colaborador_id));
        const locker = lockersMap.get(String(item.locker_id));
        return {
          ...item,
          colaborador_nombre: normalizeText(colaborador?.nombre_completo, 'Sin nombre'),
          colaborador_dni: normalizeText(colaborador?.dni, 'N/D'),
          locker_codigo: normalizeText(locker?.codigo, '--'),
          local: normalizeText(locker?.local, '--'),
          area: normalizeText(locker?.area, '--')
        };
      });

      setSolicitudes(hydrated);
      setSelectedId((current) => (hydrated.some((item) => String(item.id) === String(current)) ? current : null));
    } catch (err) {
      setSolicitudes([]);
      setSelectedId(null);
      setError(err?.message || 'No se pudo cargar solicitudes pendientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSolicitudes();
  }, [loadSolicitudes]);

  const localOptions = useMemo(() => {
    const values = Array.from(new Set(solicitudes.map((item) => item.local).filter((value) => value && value !== '--')));
    return values.sort((a, b) => a.localeCompare(b, 'es'));
  }, [solicitudes]);

  const areaOptions = useMemo(() => {
    const values = Array.from(new Set(solicitudes.map((item) => item.area).filter((value) => value && value !== '--')));
    return values.sort((a, b) => a.localeCompare(b, 'es'));
  }, [solicitudes]);

  const filteredSolicitudes = useMemo(
    () =>
      solicitudes.filter((item) => {
        if (filters.estado !== 'ALL' && item.estado !== filters.estado) return false;
        if (filters.local !== 'ALL' && item.local !== filters.local) return false;
        if (filters.area !== 'ALL' && item.area !== filters.area) return false;
        return true;
      }),
    [filters.area, filters.estado, filters.local, solicitudes]
  );

  const selected = useMemo(
    () => filteredSolicitudes.find((item) => String(item.id) === String(selectedId)) || null,
    [filteredSolicitudes, selectedId]
  );

  const handleReject = async () => {
    if (!selected || working) return;
    setWorking(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const { error: updateError } = await supabase
        .from('solicitudes_locker')
        .update({ estado: 'RECHAZADA' })
        .eq('id', selected.id);

      if (updateError) throw updateError;

      setSelectedId(null);
      await loadSolicitudes();
    } catch (err) {
      setError(err?.message || 'No se pudo rechazar la solicitud.');
    } finally {
      setWorking(false);
    }
  };

  const handleApprove = async () => {
    if (!selected || working) return;
    setWorking(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();

      const { error: updateError } = await supabase
        .from('solicitudes_locker')
        .update({ estado: 'APROBADA' })
        .eq('id', selected.id);

      if (updateError) throw updateError;

      const { data: asignacion, error: insertError } = await supabase
        .from('asignaciones_locker')
        .insert([
          {
            solicitud_id: selected.id,
            colaborador_id: selected.colaborador_id,
            locker_id: selected.locker_id,
            activa: true
          }
        ])
        .select('id,solicitud_id')
        .single();

      if (insertError) throw insertError;
      if (!asignacion?.id) throw new Error('No se pudo obtener la asignacion creada.');

      navigate(`/usuario/solicitudes/entrega/${asignacion.id}?solicitud=${selected.id}`, {
        replace: true
      });
    } catch (err) {
      setError(err?.message || 'No se pudo aprobar la solicitud.');
      setWorking(false);
    }
  };

  return (
    <main className="usuario-page">
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Solicitudes de locker</h1>
            <p>Gestion de solicitudes en estado CREADA y EN_REVISION.</p>
          </div>
          <button className="usuario-ghost-button" type="button" onClick={loadSolicitudes} disabled={loading || working}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && <p className="usuario-error">{error}</p>}

        <div className="usuario-filters">
          <div className="usuario-filter">
            <label htmlFor="filtroEstado">Estado</label>
            <select
              id="filtroEstado"
              value={filters.estado}
              onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}
            >
              <option value="ALL">Todos</option>
              <option value="CREADA">CREADA</option>
              <option value="EN_REVISION">EN_REVISION</option>
            </select>
          </div>

          <div className="usuario-filter">
            <label htmlFor="filtroLocal">Local</label>
            <select
              id="filtroLocal"
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
            <label htmlFor="filtroArea">Area</label>
            <select
              id="filtroArea"
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
        </div>
      </section>

      <section className="usuario-layout">
        <div className="usuario-card">
          {loading && <p className="usuario-subtle">Cargando solicitudes...</p>}

          {!loading && filteredSolicitudes.length === 0 && (
            <p className="usuario-warning">No hay solicitudes pendientes con los filtros actuales.</p>
          )}

          {!loading && filteredSolicitudes.length > 0 && (
            <div className="usuario-table-wrap">
              <table className="usuario-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>DNI</th>
                    <th>Locker</th>
                    <th>Area</th>
                    <th>Local</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSolicitudes.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.colaborador_nombre}</strong>
                      </td>
                      <td>{item.colaborador_dni}</td>
                      <td>{item.locker_codigo}</td>
                      <td>{item.area}</td>
                      <td>{item.local}</td>
                      <td>
                        <span className={`estado-chip ${toEstadoClass(item.estado)}`}>{item.estado}</span>
                      </td>
                      <td>{formatDateTime(item.created_at)}</td>
                      <td>
                        <button
                          className="usuario-button"
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          disabled={working}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="usuario-panel usuario-card">
          {!selected && <p className="usuario-empty-panel">Selecciona una solicitud para ver detalle.</p>}

          {selected && (
            <>
              <div className="usuario-header">
                <div>
                  <h2>Detalle de solicitud</h2>
                </div>
              </div>

              <div className="usuario-detail-list">
                <div className="usuario-detail-item">
                  <span>Colaborador</span>
                  <strong>{selected.colaborador_nombre}</strong>
                </div>
                <div className="usuario-detail-item">
                  <span>DNI</span>
                  <strong>{selected.colaborador_dni}</strong>
                </div>
                <div className="usuario-detail-item">
                  <span>Locker solicitado</span>
                  <strong>{selected.locker_codigo}</strong>
                </div>
                <div className="usuario-detail-item">
                  <span>Area / Local</span>
                  <strong>
                    {selected.area} / {selected.local}
                  </strong>
                </div>
                <div className="usuario-detail-item">
                  <span>Observaciones</span>
                  <strong>{normalizeText(selected.observaciones, 'Sin observaciones')}</strong>
                </div>
              </div>

              {selected.foto_locker_url ? (
                <img className="usuario-photo" src={selected.foto_locker_url} alt="Foto del locker solicitado" />
              ) : (
                <p className="usuario-subtle">No hay foto de locker registrada.</p>
              )}

              <div className="usuario-actions">
                <button className="btn-danger" type="button" onClick={handleReject} disabled={working}>
                  {working ? 'Procesando...' : 'RECHAZAR'}
                </button>
                <button className="btn-approve" type="button" onClick={handleApprove} disabled={working}>
                  {working ? 'Procesando...' : 'APROBAR'}
                </button>
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
