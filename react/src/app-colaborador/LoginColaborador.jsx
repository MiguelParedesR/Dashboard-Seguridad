import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useColaboradorContext } from './context/ColaboradorContext.jsx';
import { requireSupabaseClient } from '../shared/supabaseClient.js';
import './colaborador.css';

export default function LoginColaborador() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, setSession } = useColaboradorContext();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [dni, setDni] = useState('');
  const [area, setArea] = useState(() => String(searchParams.get('area') || '').trim());
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const localFromQr = String(searchParams.get('local') || '').trim();
  const areaFromQr = String(searchParams.get('area') || '').trim();

  useEffect(() => {
    if (session?.colaborador_id) {
      navigate('/colaborador/home', { replace: true });
    }
  }, [navigate, session?.colaborador_id]);

  useEffect(() => {
    if (!areaFromQr) return;
    setArea((current) => (current ? current : areaFromQr));
  }, [areaFromQr]);

  const findColaborador = async (supabase, nombre) => {
    const byName = await supabase
      .from('colaboradores')
      .select('id,nombre_completo')
      .eq('nombre_completo', nombre)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byName.error) throw byName.error;
    return byName.data || null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;

    const nombre = nombreCompleto.trim();
    const dniValue = dni.trim();
    const areaSesion = (areaFromQr || area).trim();

    if (!nombre || !dniValue || !areaSesion) {
      setError('Completa nombre, DNI y area para continuar.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const supabase = await requireSupabaseClient();

      let colaborador = await findColaborador(supabase, nombre);
      if (!colaborador) {
        const { data: creado, error: errorCreacion } = await supabase.from('colaboradores').insert([
          {
            nombre_completo: nombre,
            activo: true
          }
        ]).select('id,nombre_completo')
          .single();

        if (errorCreacion) throw errorCreacion;
        colaborador = creado;
      }

      const shouldUpdateNombre = String(colaborador?.nombre_completo || '').trim() !== nombre;
      if (shouldUpdateNombre) {
        const { data: updated, error: updateError } = await supabase
          .from('colaboradores')
          .update({ nombre_completo: nombre })
          .eq('id', colaborador.id)
          .select('id,nombre_completo')
          .single();

        if (!updateError && updated) {
          colaborador = updated;
        }
      }

      setSession({
        colaborador_id: colaborador.id,
        nombre: colaborador.nombre_completo || nombre,
        dni: dniValue,
        area: areaSesion,
        local: localFromQr
      });

      navigate('/colaborador/home', { replace: true });
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesion.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="colaborador-page">
      <section className="colaborador-card colaborador-card-login">
        <span className="colaborador-kicker">APP COLABORADOR</span>
        <h1>Ingreso de colaborador</h1>
        <p>Registra tus datos para continuar con la solicitud de locker.</p>

        <form className="colaborador-form" onSubmit={handleSubmit}>
          <label htmlFor="nombre_completo">
            Nombre completo
            <input
              id="nombre_completo"
              name="nombre_completo"
              type="text"
              value={nombreCompleto}
              onChange={(event) => setNombreCompleto(event.target.value)}
              autoComplete="name"
              placeholder="Ejemplo: Rafael Garcia"
              required
            />
          </label>

          <label htmlFor="dni">
            DNI
            <input
              id="dni"
              name="dni"
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(event) => setDni(event.target.value)}
              placeholder="Ejemplo: 75300118"
              required
            />
          </label>

          {areaFromQr ? (
            <p>Area detectada por QR: {areaFromQr}</p>
          ) : (
            <label htmlFor="area">
              Area
              <input
                id="area"
                name="area"
                type="text"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="Ejemplo: LCL"
                required
              />
            </label>
          )}

          <div className="colaborador-meta">
            {localFromQr && <p>Local detectado por QR: {localFromQr}</p>}
            {!localFromQr && <p>Sin local en URL. Se registrara sin local QR.</p>}
          </div>

          {error && <p className="colaborador-error">{error}</p>}

          <button className="colaborador-button" type="submit" disabled={sending}>
            {sending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
