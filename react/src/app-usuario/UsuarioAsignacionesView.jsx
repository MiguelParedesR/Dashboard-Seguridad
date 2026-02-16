import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  fetchColaboradoresByIds,
  fetchLockersByIds,
  fetchRowsByAsignacion,
  formatDateTime,
  getClientOrThrow,
  normalizeText
} from './usuarioApi.js';
import './usuario.css';

export default function UsuarioAsignacionesView() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(() => location.state?.successMessage || '');
  const [asignaciones, setAsignaciones] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [incidencias, setIncidencias] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAsignaciones = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const { data, error: queryError } = await supabase
        .from('asignaciones_locker')
        .select('id,solicitud_id,colaborador_id,locker_id,activa,fecha_asignacion,fecha_liberacion')
        .eq('activa', true)
        .order('fecha_asignacion', { ascending: false });

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
          locker_codigo: normalizeText(locker?.codigo),
          locker_local: normalizeText(locker?.local),
          locker_area: normalizeText(locker?.area)
        };
      });

      setAsignaciones(hydrated);
      setSelectedId((current) => (hydrated.some((item) => String(item.id) === String(current)) ? current : null));
    } catch (err) {
      setAsignaciones([]);
      setSelectedId(null);
      setError(err?.message || 'No se pudieron cargar asignaciones activas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAsignaciones();
  }, [loadAsignaciones]);

  const selected = useMemo(
    () => asignaciones.find((item) => String(item.id) === String(selectedId)) || null,
    [asignaciones, selectedId]
  );

  useEffect(() => {
    let mounted = true;

    const loadDetail = async () => {
      if (!selected?.id) {
        setMovimientos([]);
        setIncidencias([]);
        return;
      }

      setDetailLoading(true);
      setError('');

      try {
        const supabase = await getClientOrThrow();
        const [movRows, incRows] = await Promise.all([
          fetchRowsByAsignacion(supabase, 'llaves_movimientos', selected.id),
          fetchRowsByAsignacion(supabase, 'incidencias_llaves', selected.id)
        ]);

        if (!mounted) return;
        setMovimientos(movRows);
        setIncidencias(incRows);
      } catch (err) {
        if (!mounted) return;
        setMovimientos([]);
        setIncidencias([]);
        setError(err?.message || 'No se pudo cargar detalle de la asignacion.');
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };

    loadDetail();
    return () => {
      mounted = false;
    };
  }, [selected?.id]);

  const handleCloseAsignacion = async () => {
    if (!selected || working) return;
    setWorking(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const { error: closeError } = await supabase
        .from('asignaciones_locker')
        .update({
          activa: false,
          fecha_liberacion: new Date().toISOString()
        })
        .eq('id', selected.id);

      if (closeError) throw closeError;

      setSuccessMessage('Asignacion cerrada correctamente.');
      setSelectedId(null);
      setMovimientos([]);
      setIncidencias([]);
      await loadAsignaciones();
    } catch (err) {
      setError(err?.message || 'No se pudo cerrar la asignacion.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="usuario-page">
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Asignaciones activas</h1>
            <p>Control de lockers actualmente asignados.</p>
          </div>
          <button className="usuario-ghost-button" type="button" onClick={loadAsignaciones} disabled={loading || working}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {successMessage && <p className="usuario-success">{successMessage}</p>}
        {error && <p className="usuario-error">{error}</p>}
      </section>

      <section className="usuario-layout">
        <div className="usuario-card">
          {loading && <p className="usuario-subtle">Cargando asignaciones activas...</p>}

          {!loading && asignaciones.length === 0 && (
            <p className="usuario-warning">No hay asignaciones activas en este momento.</p>
          )}

          {!loading && asignaciones.length > 0 && (
            <div className="usuario-table-wrap">
              <table className="usuario-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Locker</th>
                    <th>Fecha asignacion</th>
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map((item) => (
                    <tr key={item.id}>
                      <td>{item.colaborador_nombre}</td>
                      <td>{item.locker_codigo}</td>
                      <td>{formatDateTime(item.fecha_asignacion)}</td>
                      <td>
                        <span className="estado-chip asignada">ACTIVA</span>
                      </td>
                      <td>
                        <button className="usuario-button" type="button" onClick={() => setSelectedId(item.id)}>
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
          {!selected && <p className="usuario-empty-panel">Selecciona una asignacion para ver detalle.</p>}

          {selected && (
            <>
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
                  <span>Locker</span>
                  <strong>{selected.locker_codigo}</strong>
                </div>
                <div className="usuario-detail-item">
                  <span>Area / Local</span>
                  <strong>
                    {selected.locker_area} / {selected.locker_local}
                  </strong>
                </div>
              </div>

              {detailLoading && <p className="usuario-subtle">Cargando movimientos e incidencias...</p>}

              {!detailLoading && (
                <>
                  <div className="usuario-detail-block">
                    <h3>Historial llaves_movimientos</h3>
                    {movimientos.length === 0 && <p className="usuario-subtle">Sin movimientos registrados.</p>}
                    {movimientos.length > 0 && (
                      <table className="usuario-table-inline">
                        <thead>
                          <tr>
                            <th>Tipo</th>
                            <th>Declaradas</th>
                            <th>Esperadas</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientos.map((item) => (
                            <tr key={item.id}>
                              <td>{normalizeText(item.tipo)}</td>
                              <td>{normalizeText(item.llaves_declaradas, '--')}</td>
                              <td>{normalizeText(item.llaves_esperadas, '--')}</td>
                              <td>{formatDateTime(item.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="usuario-detail-block">
                    <h3>Incidencias</h3>
                    {incidencias.length === 0 && <p className="usuario-subtle">Sin incidencias registradas.</p>}
                    {incidencias.length > 0 && (
                      <ul>
                        {incidencias.map((item) => (
                          <li key={item.id}>
                            <strong>{normalizeText(item.tipo, 'Incidencia')}</strong>
                            <small>{normalizeText(item.descripcion, 'Sin descripcion')}</small>
                            <small>{formatDateTime(item.created_at)}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}

              <div className="usuario-actions">
                <button className="btn-danger" type="button" onClick={handleCloseAsignacion} disabled={working}>
                  {working ? 'Cerrando...' : 'CERRAR ASIGNACION'}
                </button>
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
