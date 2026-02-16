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

export default function SolicitarDuplicado() {
  const { session } = useColaboradorContext();
  const [asignacionActiva, setAsignacionActiva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fotoLocker, setFotoLocker] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [declaracion, setDeclaracion] = useState('Solicito duplicado de llave del locker asignado.');

  useEffect(() => {
    let mounted = true;

    const loadAsignacion = async () => {
      setLoading(true);
      setError('');

      try {
        const supabase = await requireSupabaseClient();

        const { data, error: queryError } = await supabase
          .from('asignaciones_locker')
          .select('id,locker_id')
          .eq('colaborador_id', session.colaborador_id)
          .eq('activa', true)
          .order('fecha_asignacion', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!mounted) return;
        setAsignacionActiva(data || null);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'No se pudo validar la asignacion activa.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAsignacion();

    return () => {
      mounted = false;
    };
  }, [session.colaborador_id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending || !asignacionActiva) return;
    if (!fotoLocker) {
      setError('Debes subir una foto para registrar el duplicado.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const supabase = await requireSupabaseClient();

      const fotoLockerUrl = await uploadImage(
        supabase,
        fotoLocker,
        'solicitudes-duplicado',
        session.colaborador_id
      );

      const { error: insertError } = await supabase.from('solicitudes_locker').insert([
        {
          colaborador_id: session.colaborador_id,
          locker_id: asignacionActiva.locker_id,
          estado: 'CREADA_DUPLICADO',
          foto_locker_url: fotoLockerUrl,
          observaciones: declaracion.trim()
        }
      ]);

      if (insertError) throw insertError;
      setSuccess(true);
      setFotoLocker(null);
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la solicitud de duplicado.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="colaborador-page">
      <section className="colaborador-card colaborador-card-flow">
        <span className="colaborador-kicker">APP COLABORADOR</span>
        <h1>Solicitar duplicado de llave</h1>

        {loading && <p>Validando asignacion activa...</p>}
        {!loading && !asignacionActiva && !error && <p>No tienes locker asignado.</p>}
        {error && <p className="colaborador-error">{error}</p>}
        {success && (
          <p className="colaborador-success">
            SOLICITUD DE DUPLICADO CREADA. ACERQUESE A CENTRO DE CONTROL.
          </p>
        )}

        {!loading && asignacionActiva && !success && (
          <form className="colaborador-form" onSubmit={handleSubmit}>
            <p>Locker asignado actual: {asignacionActiva.locker_id}</p>
            <CameraGuide text="Referencia: enfoca el frente del locker asignado." />
            <label htmlFor="foto_duplicado">
              Foto de evidencia
              <input
                id="foto_duplicado"
                name="foto_duplicado"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFotoLocker(event.target.files?.[0] || null)}
                required
                disabled={sending}
              />
            </label>
            <label htmlFor="declaracion_duplicado">
              Declaracion
              <input
                id="declaracion_duplicado"
                name="declaracion_duplicado"
                type="text"
                value={declaracion}
                onChange={(event) => setDeclaracion(event.target.value)}
                required
                disabled={sending}
              />
            </label>

            <button className="colaborador-button" type="submit" disabled={sending}>
              {sending ? 'Registrando...' : 'Crear solicitud'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
