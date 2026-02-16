import { useEffect, useState } from 'react';
import { useColaboradorContext } from './context/ColaboradorContext.jsx';
import CameraGuide from './components/CameraGuide.jsx';
import { requireSupabaseClient } from '../shared/supabaseClient.js';
import './colaborador.css';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_LOCKERS_BUCKET;

if (STORAGE_BUCKET !== 'lockers') {
  throw new Error('Configuracion invalida: VITE_SUPABASE_LOCKERS_BUCKET debe ser "lockers".');
}

function sanitizeFileName(name) {
  return String(name || 'imagen')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

async function uploadImage(supabase, file, folder, collaboratorId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${folder}/${collaboratorId}/${timestamp}-${sanitizeFileName(file?.name)}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, {
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('No se pudo obtener la URL publica de la imagen.');
  return publicUrl;
}

export default function SolicitarLocker() {
  const { session } = useColaboradorContext();
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalLocker, setModalLocker] = useState(null);
  const [lockerSeleccionado, setLockerSeleccionado] = useState(null);
  const [fotoLocker, setFotoLocker] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadLockers = async () => {
      setLoading(true);
      setError('');

      if (!session?.local || !session?.area) {
        if (!mounted) return;
        setLockers([]);
        setError('Esta vista requiere local QR y area de sesion.');
        setLoading(false);
        return;
      }

      try {
        const supabase = await requireSupabaseClient();

        const { data, error: queryError } = await supabase
          .from('lockers')
          .select('id,codigo,estado')
          .eq('estado', 'LIBRE')
          .eq('activo', true)
          .eq('local', session.local)
          .eq('area', session.area)
          .order('codigo', { ascending: true });

        if (queryError) throw queryError;
        if (!mounted) return;
        setLockers(data || []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'No se pudieron cargar los lockers.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadLockers();

    return () => {
      mounted = false;
    };
  }, [session?.area, session?.local]);

  const handleCrearSolicitud = async (event) => {
    event.preventDefault();
    if (sending || done) return;
    if (!lockerSeleccionado) {
      setError('Selecciona un locker antes de enviar.');
      return;
    }
    if (!fotoLocker) {
      setError('Debes tomar una foto del locker seleccionado.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const supabase = await requireSupabaseClient();

      const fotoLockerUrl = await uploadImage(
        supabase,
        fotoLocker,
        'solicitudes-locker',
        session.colaborador_id
      );

      const { error: insertError } = await supabase.from('solicitudes_locker').insert([
        {
          colaborador_id: session.colaborador_id,
          locker_id: lockerSeleccionado.id,
          estado: 'CREADA',
          foto_locker_url: fotoLockerUrl,
          observaciones: null
        }
      ]);

      if (insertError) throw insertError;

      setDone(true);
      setModalLocker(null);
      setLockerSeleccionado(null);
      setFotoLocker(null);
    } catch (err) {
      setError(err?.message || 'No se pudo crear la solicitud.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="colaborador-page">
      <section className="colaborador-card colaborador-card-flow">
        <span className="colaborador-kicker">APP COLABORADOR</span>
        <h1>Solicitar locker</h1>
        <p>Selecciona un locker libre en tu area y local actual.</p>

        {done && <p className="colaborador-success">SOLICITUD CREADA. ACERQUESE A CENTRO DE CONTROL.</p>}

        {!done && (
          <>
            {loading && <p>Cargando lockers disponibles...</p>}
            {!loading && lockers.length === 0 && !error && <p>No hay lockers disponibles.</p>}
            {error && <p className="colaborador-error">{error}</p>}

            {!loading && lockers.length > 0 && (
              <div className="colaborador-grid">
                {lockers.map((locker) => (
                  <button
                    key={locker.id}
                    type="button"
                    className="locker-card"
                    onClick={() => setModalLocker(locker)}
                    disabled={sending}
                  >
                    <strong>{locker.codigo}</strong>
                    <span>{locker.estado}</span>
                  </button>
                ))}
              </div>
            )}

            {lockerSeleccionado && (
              <form className="colaborador-form colaborador-file" onSubmit={handleCrearSolicitud}>
                <p>Locker elegido: {lockerSeleccionado.codigo}</p>
                <p className="colaborador-subtle">
                  La camara se abrira en modo trasero. Activa flash si el area tiene poca luz.
                </p>
                <CameraGuide text="Referencia: centra la puerta completa del locker." />
                <label htmlFor="foto_locker">
                  Foto del locker
                  <input
                    id="foto_locker"
                    name="foto_locker"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => setFotoLocker(event.target.files?.[0] || null)}
                    required
                    disabled={sending}
                  />
                </label>

                <button className="colaborador-button" type="submit" disabled={sending}>
                  {sending ? 'Enviando solicitud...' : 'Enviar solicitud'}
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {modalLocker && !done && (
        <div className="colaborador-modal-backdrop" role="presentation">
          <section className="colaborador-modal" role="dialog" aria-modal="true">
            <p>Has elegido el locker Nro {modalLocker.codigo}. Verifica que este libre y toma una foto.</p>
            <div className="colaborador-modal-actions">
              <button
                className="colaborador-button is-secondary"
                type="button"
                onClick={() => setModalLocker(null)}
                disabled={sending}
              >
                CANCELAR
              </button>
              <button
                className="colaborador-button"
                type="button"
                onClick={() => {
                  setLockerSeleccionado(modalLocker);
                  setModalLocker(null);
                }}
                disabled={sending}
              >
                SELECCIONAR
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

