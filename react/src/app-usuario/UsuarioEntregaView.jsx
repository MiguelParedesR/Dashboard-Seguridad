import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchColaboradoresByIds,
  fetchLockersByIds,
  formatDateTime,
  getClientOrThrow,
  normalizeText,
  uploadImageToLockers
} from './usuarioApi.js';
import './usuario.css';

export default function UsuarioEntregaView() {
  const navigate = useNavigate();
  const { asignacionId } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [asignacion, setAsignacion] = useState(null);
  const [locker, setLocker] = useState(null);
  const [colaborador, setColaborador] = useState(null);
  const [fotoEntrega, setFotoEntrega] = useState(null);
  const [fotoRespaldo, setFotoRespaldo] = useState(null);
  const [confirmEntrega, setConfirmEntrega] = useState(false);
  const [confirmRespaldo, setConfirmRespaldo] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const supabase = await getClientOrThrow();
        const { data, error: asignacionError } = await supabase
          .from('asignaciones_locker')
          .select('id,solicitud_id,colaborador_id,locker_id,activa,fecha_asignacion')
          .eq('id', asignacionId)
          .maybeSingle();

        if (asignacionError) throw asignacionError;
        if (!data) throw new Error('No se encontro la asignacion de entrega.');

        const [lockersMap, colaboradoresMap] = await Promise.all([
          fetchLockersByIds(supabase, [data.locker_id]),
          fetchColaboradoresByIds(supabase, [data.colaborador_id])
        ]);

        if (!mounted) return;
        setAsignacion(data);
        setLocker(lockersMap.get(String(data.locker_id)) || null);
        setColaborador(colaboradoresMap.get(String(data.colaborador_id)) || null);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'No se pudo cargar la asignacion para entrega.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [asignacionId]);

  const totalLlavesVisual = useMemo(() => (locker?.tiene_duplicado_llave ? 2 : 1), [locker?.tiene_duplicado_llave]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !asignacion) return;

    if (!fotoEntrega || !fotoRespaldo) {
      setError('Debes subir foto de llave entregada y foto de llaves de respaldo.');
      return;
    }
    if (!confirmEntrega || !confirmRespaldo) {
      setError('Debes confirmar ambas declaraciones para registrar la entrega.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const fotoEntregaUrl = await uploadImageToLockers(
        supabase,
        fotoEntrega,
        'entregas-llaves',
        asignacion.id
      );

      await uploadImageToLockers(supabase, fotoRespaldo, 'entregas-respaldo', asignacion.id);

      const { error: insertError } = await supabase.from('llaves_movimientos').insert([
        {
          asignacion_id: asignacion.id,
          tipo: 'ENTREGA',
          llaves_declaradas: 1,
          llaves_esperadas: 1,
          foto_llaves_url: fotoEntregaUrl,
          declaracion: 'Entrega inicial',
          firmado: true
        }
      ]);

      if (insertError) throw insertError;

      const solicitudId = asignacion.solicitud_id || searchParams.get('solicitud');
      if (!solicitudId) {
        throw new Error('No se encontro la solicitud relacionada para finalizar el flujo.');
      }

      const { error: solicitudError } = await supabase
        .from('solicitudes_locker')
        .update({ estado: 'ASIGNADA' })
        .eq('id', solicitudId);

      if (solicitudError) throw solicitudError;

      navigate('/lockers/asignaciones', {
        replace: true,
        state: { successMessage: 'Entrega registrada y solicitud marcada como ASIGNADA.' }
      });
    } catch (err) {
      setError(err?.message || 'No se pudo confirmar la entrega.');
      setSubmitting(false);
    }
  };

  return (
    <main className="usuario-page">
      <section className="usuario-card">
        <div className="usuario-header">
          <div>
            <h1>Entrega de llaves</h1>
            <p>Registro obligatorio posterior a la aprobacion de solicitud.</p>
          </div>
          <button className="usuario-ghost-button" type="button" onClick={() => navigate('/lockers/solicitudes')}>
            Volver a solicitudes
          </button>
        </div>

        {error && <p className="usuario-error">{error}</p>}
      </section>

      <section className="usuario-layout">
        <div className="usuario-card">
          {loading && <p className="usuario-subtle">Cargando datos de asignacion...</p>}

          {!loading && asignacion && (
            <div className="usuario-detail-list">
              <div className="usuario-detail-item">
                <span>Locker</span>
                <strong>{normalizeText(locker?.codigo)}</strong>
              </div>
              <div className="usuario-detail-item">
                <span>Colaborador</span>
                <strong>{normalizeText(colaborador?.nombre_completo, 'Sin nombre')}</strong>
              </div>
              <div className="usuario-detail-item">
                <span>DNI</span>
                <strong>{normalizeText(colaborador?.dni, 'N/D')}</strong>
              </div>
              <div className="usuario-detail-item">
                <span>Fecha de asignacion</span>
                <strong>{formatDateTime(asignacion.fecha_asignacion)}</strong>
              </div>
              <div className="usuario-detail-item">
                <span>Total llaves esperadas (visual)</span>
                <strong>{totalLlavesVisual}</strong>
              </div>
              <div className="usuario-detail-item">
                <span>Referencia duplicado</span>
                <strong>{locker?.tiene_duplicado_llave ? 'Con duplicado de llave' : 'Sin duplicado registrado'}</strong>
              </div>
            </div>
          )}
        </div>

        <aside className="usuario-card">
          <form className="usuario-form" onSubmit={handleSubmit}>
            <label htmlFor="foto-entrega">
              1) Foto de llave entregada
              <input
                id="foto-entrega"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFotoEntrega(event.target.files?.[0] || null)}
                disabled={submitting || loading}
                required
              />
            </label>

            <label htmlFor="foto-respaldo">
              2) Foto de llaves de respaldo
              <input
                id="foto-respaldo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFotoRespaldo(event.target.files?.[0] || null)}
                disabled={submitting || loading}
                required
              />
            </label>

            <label className="usuario-check" htmlFor="check-entrega">
              <input
                id="check-entrega"
                type="checkbox"
                checked={confirmEntrega}
                onChange={(event) => setConfirmEntrega(event.target.checked)}
                disabled={submitting || loading}
              />
              Confirmo que entrego 1 llave
            </label>

            <label className="usuario-check" htmlFor="check-respaldo">
              <input
                id="check-respaldo"
                type="checkbox"
                checked={confirmRespaldo}
                onChange={(event) => setConfirmRespaldo(event.target.checked)}
                disabled={submitting || loading}
              />
              Confirmo que quedan llaves de respaldo
            </label>

            <button className="usuario-button" type="submit" disabled={submitting || loading || !asignacion}>
              {submitting ? 'Confirmando...' : 'CONFIRMAR ENTREGA'}
            </button>
          </form>
        </aside>
      </section>
    </main>
  );
}
