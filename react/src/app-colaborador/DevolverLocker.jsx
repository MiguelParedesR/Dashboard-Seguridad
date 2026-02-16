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

export default function DevolverLocker() {
  const { session } = useColaboradorContext();
  const [asignacionActiva, setAsignacionActiva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fotoLlaves, setFotoLlaves] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [declaracion, setDeclaracion] = useState('Declaro que devuelvo la llave asignada');
  const [lockerCodigo, setLockerCodigo] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadAsignacion = async () => {
      setLoading(true);
      setError('');

      try {
        const supabase = await requireSupabaseClient();

        const { data, error: queryError } = await supabase
          .from('asignaciones_locker')
          .select('id,locker_id,fecha_asignacion')
          .eq('colaborador_id', session.colaborador_id)
          .eq('activa', true)
          .order('fecha_asignacion', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!mounted) return;
        setAsignacionActiva(data || null);

        if (data?.locker_id) {
          const { data: lockerData } = await supabase
            .from('lockers')
            .select('codigo')
            .eq('id', data.locker_id)
            .limit(1)
            .maybeSingle();
          if (!mounted) return;
          setLockerCodigo(String(lockerData?.codigo || ''));
        } else {
          setLockerCodigo('');
        }
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
    if (!fotoLlaves) {
      setError('Debes subir una foto de las llaves devueltas.');
      return;
    }
    if (!declaracion.trim()) {
      setError('La declaracion es obligatoria.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const supabase = await requireSupabaseClient();

      const fotoLlavesUrl = await uploadImage(
        supabase,
        fotoLlaves,
        'devoluciones-locker',
        session.colaborador_id
      );

      const { error: movimientoError } = await supabase.from('llaves_movimientos').insert([
        {
          asignacion_id: asignacionActiva.id,
          tipo: 'DEVOLUCION',
          llaves_declaradas: 1,
          llaves_esperadas: 1,
          foto_llaves_url: fotoLlavesUrl,
          declaracion: declaracion.trim(),
          firmado: true
        }
      ]);

      if (movimientoError) throw movimientoError;

      const { error: cierreError } = await supabase
        .from('asignaciones_locker')
        .update({
          activa: false,
          fecha_liberacion: new Date().toISOString()
        })
        .eq('id', asignacionActiva.id);

      if (cierreError) throw cierreError;

      setSuccess(true);
      setFotoLlaves(null);
      setAsignacionActiva(null);
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la devolucion.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="colaborador-page">
      <section className="colaborador-card colaborador-card-flow">
        <span className="colaborador-kicker">APP COLABORADOR</span>
        <h1>Devolver locker</h1>

        {loading && <p>Validando asignacion activa...</p>}
        {!loading && !asignacionActiva && !error && !success && <p>No tienes locker asignado.</p>}
        {error && <p className="colaborador-error">{error}</p>}
        {success && <p className="colaborador-success">DEVOLUCION REGISTRADA</p>}

        {!loading && asignacionActiva && !success && (
          <form className="colaborador-form" onSubmit={handleSubmit}>
            <p>Locker asignado: {lockerCodigo || asignacionActiva.locker_id}</p>
            <p>Fecha asignacion: {asignacionActiva.fecha_asignacion || 'N/D'}</p>
            <CameraGuide text="Referencia: enfoca claramente ambas llaves devueltas." />
            <label htmlFor="foto_devolucion">
              Foto de llaves devueltas
              <input
                id="foto_devolucion"
                name="foto_devolucion"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFotoLlaves(event.target.files?.[0] || null)}
                required
                disabled={sending}
              />
            </label>
            <label htmlFor="declaracion_devolucion">
              Declaracion
              <input
                id="declaracion_devolucion"
                name="declaracion_devolucion"
                type="text"
                value={declaracion}
                onChange={(event) => setDeclaracion(event.target.value)}
                required
                disabled={sending}
              />
            </label>

            <button className="colaborador-button" type="submit" disabled={sending}>
              {sending ? 'Registrando devolucion...' : 'Registrar devolucion'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
