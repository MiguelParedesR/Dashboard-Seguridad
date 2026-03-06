import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAsignacionesByIds,
  fetchColaboradoresByIds,
  fetchLockersByIds,
  formatDateTime,
  getClientOrThrow,
  getIncidenciasLlaves,
  normalizeText,
  uniqueIds
} from '../../app-usuario/usuarioApi.js';
import { getAuthSession, normalizeAuthRole } from '../../services/sessionAuth.js';
import '../../app-usuario/usuario.css';
import './incidencias.css';

const ESTADO_PENDIENTE = 'PENDIENTE';
const ESTADO_RESUELTA = 'RESUELTA';

function normalizeEstado(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  return normalized === ESTADO_RESUELTA ? ESTADO_RESUELTA : ESTADO_PENDIENTE;
}

function formatLockerLabel(lockerCode, lockerId) {
  const code = normalizeText(lockerCode, '');
  if (code) return code;
  const fallbackId = normalizeText(lockerId, '--');
  return `Locker ${fallbackId}`;
}

export default function IncidenciasView() {
  const role = useMemo(() => normalizeAuthRole(getAuthSession()?.role), []);
  const isOperador = role === 'cctv';
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [incidencias, setIncidencias] = useState([]);

  const loadIncidencias = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [supabase, allRows] = await Promise.all([getClientOrThrow(), getIncidenciasLlaves()]);
      const scopedRows = isOperador
        ? allRows.filter((item) => normalizeEstado(item.estado) === ESTADO_PENDIENTE)
        : allRows;

      const asignacionesMap = await fetchAsignacionesByIds(
        supabase,
        scopedRows.map((item) => item.asignacion_id)
      );

      const lockerIds = uniqueIds([
        ...scopedRows.map((item) => item.locker_id),
        ...Array.from(asignacionesMap.values()).map((asignacion) => asignacion?.locker_id)
      ]);
      const colaboradorIds = uniqueIds(
        Array.from(asignacionesMap.values()).map((asignacion) => asignacion?.colaborador_id)
      );

      const [lockersMap, colaboradoresMap] = await Promise.all([
        fetchLockersByIds(supabase, lockerIds),
        fetchColaboradoresByIds(supabase, colaboradorIds)
      ]);

      const hydrated = scopedRows.map((item) => {
        const asignacion = asignacionesMap.get(String(item.asignacion_id));
        const lockerId = item.locker_id ?? asignacion?.locker_id;
        const locker = lockersMap.get(String(lockerId));
        const colaborador = colaboradoresMap.get(String(asignacion?.colaborador_id));
        return {
          ...item,
          estado: normalizeEstado(item.estado),
          locker_label: formatLockerLabel(locker?.codigo, lockerId),
          colaborador_label: normalizeText(colaborador?.nombre_completo, 'Sin colaborador')
        };
      });

      setIncidencias(hydrated);
    } catch (err) {
      setIncidencias([]);
      setError(err?.message || 'No se pudieron cargar las incidencias de llaves.');
    } finally {
      setLoading(false);
    }
  }, [isOperador]);

  useEffect(() => {
    loadIncidencias();
  }, [loadIncidencias]);

  const handleResolver = useCallback(
    async (incidenciaId) => {
      if (!incidenciaId || resolvingId) return;
      setResolvingId(String(incidenciaId));
      setError('');
      setSuccessMessage('');

      try {
        const supabase = await getClientOrThrow();
        const { error: rpcError } = await supabase.rpc('fn_resolver_incidencias_llaves', {
          p_incidencia_id: incidenciaId
        });
        if (rpcError) throw rpcError;

        setIncidencias((current) => {
          const updated = current.map((item) =>
            String(item.id) === String(incidenciaId) ? { ...item, estado: ESTADO_RESUELTA } : item
          );
          return isOperador ? updated.filter((item) => item.estado === ESTADO_PENDIENTE) : updated;
        });
        setSuccessMessage('Incidencia resuelta correctamente.');
      } catch (err) {
        setError(err?.message || 'No se pudo resolver la incidencia.');
      } finally {
        setResolvingId('');
      }
    },
    [isOperador, resolvingId]
  );

  const emptyMessage = isOperador
    ? 'No hay incidencias pendientes para atender.'
    : 'No hay incidencias registradas.';

  return (
    <main className="usuario-page incidencias-page">
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Incidencias de llaves</h1>
            <p>Panel operativo para revisar y resolver inconsistencias detectadas automaticamente.</p>
          </div>
          <button
            className="usuario-ghost-button"
            type="button"
            onClick={loadIncidencias}
            disabled={loading || Boolean(resolvingId)}
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        <p className="usuario-subtle incidencias-scope">
          {isOperador
            ? 'Vista Operador CCTV: solo incidencias PENDIENTE.'
            : 'Vista Administrador: incidencias PENDIENTE y RESUELTA.'}
        </p>

        {successMessage && <p className="usuario-success">{successMessage}</p>}
        {error && <p className="usuario-error">{error}</p>}
      </section>

      <section className="usuario-card">
        {loading && <p className="usuario-subtle">Cargando incidencias...</p>}

        {!loading && incidencias.length === 0 && <p className="usuario-warning">{emptyMessage}</p>}

        {!loading && incidencias.length > 0 && (
          <div className="usuario-table-wrap">
            <table className="usuario-table incidencias-table">
              <thead>
                <tr>
                  <th>Locker</th>
                  <th>Colaborador</th>
                  <th>Llaves esperadas</th>
                  <th>Llaves devueltas</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {incidencias.map((item) => {
                  const isPending = item.estado === ESTADO_PENDIENTE;
                  const isResolving = String(item.id) === String(resolvingId);
                  return (
                    <tr key={item.id}>
                      <td data-label="Locker">{item.locker_label}</td>
                      <td data-label="Colaborador">{item.colaborador_label}</td>
                      <td data-label="Llaves esperadas">{normalizeText(item.llaves_esperadas, '--')}</td>
                      <td data-label="Llaves devueltas">{normalizeText(item.llaves_devueltas, '--')}</td>
                      <td data-label="Fecha">{formatDateTime(item.created_at)}</td>
                      <td data-label="Estado">
                        <span className={`estado-chip ${isPending ? 'pendiente' : 'resuelta'}`}>{item.estado}</span>
                      </td>
                      <td data-label="Accion">
                        {isPending ? (
                          <button
                            className="usuario-button"
                            type="button"
                            onClick={() => handleResolver(item.id)}
                            disabled={Boolean(resolvingId)}
                          >
                            {isResolving ? 'Resolviendo...' : 'Resolver incidencia'}
                          </button>
                        ) : (
                          <span className="usuario-subtle">Sin accion</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
