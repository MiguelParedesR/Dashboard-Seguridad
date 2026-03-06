import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClientOrThrow } from './usuarioApi.js';
import { mapUsuarioRow, normalizeDni, normalizeRole } from './usuarioAuth.js';
import { getDefaultRouteForRole, setAuthSession } from '../services/sessionAuth.js';
import './usuario-login.css';

const USUARIOS_SELECT = 'id,nombre,correo,dni,rol,activo';

function asFriendlyLoginError(error, fallbackMessage) {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('infinite recursion') || raw.includes('policy') || String(error?.code || '') === '42P17') {
    return 'Error de seguridad en Supabase (RLS de usuarios). Debes ajustar policies para login.';
  }
  return error?.message || fallbackMessage;
}

function resolveLoginRole(usuario) {
  const normalized = normalizeRole(usuario?.rolRaw || usuario?.profile);
  if (normalized === 'admin' || normalized === 'cctv') return normalized;
  return '';
}

export default function UsuarioLoginView() {
  const navigate = useNavigate();

  const [dni, setDni] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Ingreso App Usuario';
    document.body.classList.add('view-usuario-login');
    document.body.classList.remove('view-login');
    return () => {
      document.body.classList.remove('view-usuario-login');
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const typedDni = normalizeDni(dni);
    if (!typedDni) {
      setError('Ingresa un DNI valido.');
      return;
    }
    if (!selectedUsuario.dni) {
      setError('El usuario seleccionado no tiene DNI registrado.');
      return;
    }
    if (typedDni !== selectedUsuario.dni) {
      setError('DNI incorrecto para el usuario seleccionado.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const supabase = await getClientOrThrow();
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select(USUARIOS_SELECT)
        .eq('dni', typedDni)
        .limit(2);
      if (queryError) throw queryError;

      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) throw new Error('DNI no registrado.');
      if (rows.length > 1) throw new Error('El DNI esta asociado a mas de un usuario.');

      const validatedUsuario = mapUsuarioRow(rows[0]);
      if (!validatedUsuario.activo) {
        throw new Error('El usuario se encuentra inactivo.');
      }
      if (!validatedUsuario.dni) {
        throw new Error('El usuario no tiene DNI registrado.');
      }
      const role = resolveLoginRole(validatedUsuario);
      if (!role) {
        throw new Error('El usuario no tiene un rol permitido para este acceso.');
      }

      setAuthSession({
        role,
        user: {
          id: validatedUsuario.id,
          nombre: validatedUsuario.nombre,
          dni: validatedUsuario.dni,
          role
        }
      });

      navigate(getDefaultRouteForRole(role), { replace: true });
    } catch (err) {
      setError(asFriendlyLoginError(err, 'No se pudo validar el usuario.'));
      setSubmitting(false);
    }
  };

  return (
    <main className="usuario-login-root">
      <div className="usuario-login-bg" aria-hidden="true"></div>

      <section className="usuario-login-shell">
        <header className="usuario-login-header">
          <h1>Ingreso App Usuario</h1>
          <p>Ingresa tu DNI y el sistema validara tu rol automaticamente.</p>
        </header>

        <form className="usuario-login-form" onSubmit={handleSubmit}>
          <label htmlFor="usuario-dni">
            DNI
            <input
              id="usuario-dni"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ingresa DNI"
              value={dni}
              onChange={(event) => setDni(event.target.value)}
              disabled={submitting}
              required
            />
          </label>

          {error && <p className="usuario-login-error">{error}</p>}

          <button className="usuario-login-submit" type="submit" disabled={!dni.trim() || submitting}>
            {submitting ? 'Validando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
